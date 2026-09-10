#!/usr/bin/env python3
"""Encrypted Supabase logical exports. No credentials or SQL are printed.

Export is read-only. Unpack never connects to a database or restores anything.
Use the reviewed restoration procedure in README.md on an isolated target.
"""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
from urllib.parse import parse_qs, unquote, urlsplit

CLI_VERSION = "2.117.0"
SOURCE_REF = "vkfvjwxajgeafzyphjvh"
MAX_ARCHIVE = 40 * 1024 * 1024
MAX_PLAIN = 1024 * 1024 * 1024
FILES = (
    "roles.sql", "schema.sql", "data.sql", "history-schema.sql", "history-data.sql",
    "managed-customizations.sql", "inventory.json",
)


class BackupError(Exception):
    pass


def secret_phrase(value):
    if not value or len(value) < 32 or len(set(value)) < 8 or any(c in value for c in "\r\n\0"):
        raise BackupError("NUVABRI_BACKUP_PASSPHRASE: use a unique random secret of at least 32 characters.")
    return value


def connection_env(url):
    """Validate the expected source. Keep the password out of psql argv/logs."""
    try:
        p = urlsplit(url)
        host = p.hostname or ""
        user = unquote(p.username or "")
        password = unquote(p.password or "")
        port = p.port or 5432
        direct = host == f"db.{SOURCE_REF}.supabase.co" and user == "postgres"
        pooler = (re.fullmatch(r"aws-[a-z0-9-]+\.pooler\.supabase\.com", host)
                  and user == f"postgres.{SOURCE_REF}")
        if (p.scheme not in ("postgres", "postgresql") or not (direct or pooler)
                or port != 5432 or p.path != "/postgres" or not password or p.fragment):
            raise ValueError()
        query = parse_qs(p.query, keep_blank_values=True)
        if set(query) - {"sslmode"} or query.get("sslmode", ["require"]) != ["require"]:
            raise ValueError()
        if any(c in password for c in "\r\n\0"):
            raise ValueError()
    except (TypeError, ValueError):
        raise BackupError("SUPABASE_DB_URL must be this project's Session pooler or direct PostgreSQL URL on port 5432, with its database password and sslmode=require.") from None
    env = {k: v for k, v in os.environ.items() if not k.startswith("PG")
           and k not in ("SUPABASE_DB_URL", "NUVABRI_BACKUP_PASSPHRASE")}
    env.update(PGHOST=host, PGPORT=str(port), PGUSER=user, PGPASSWORD=password,
               PGDATABASE="postgres", PGSSLMODE="require", PGCONNECT_TIMEOUT="20",
               PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=120000 -c search_path=pg_catalog")
    return env


def run(args, *, env=None, input=None, timeout=180):
    try:
        result = subprocess.run(args, env=env, input=input, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, timeout=timeout, check=False)
    except (OSError, subprocess.TimeoutExpired):
        raise BackupError("A required program is unavailable or timed out; no backup was published.") from None
    if result.returncode:
        # Child output can contain a URL/password or database values. Never echo it.
        raise BackupError(f"{Path(args[0]).name} failed (exit {result.returncode}); no backup was published.")
    return result.stdout


def sql(query, env):
    return run(["psql", "-X", "--no-password", "--no-align", "--tuples-only",
                "--set", "ON_ERROR_STOP=1", "--command", query], env=env)


INVENTORY_SQL = """
select jsonb_build_object(
  'server_version', current_setting('server_version'),
  'source_ref', 'vkfvjwxajgeafzyphjvh',
  'sampled_at', now(),
  'storage_objects', (select count(*) from storage.objects),
  'vault_secrets', (select count(*) from vault.secrets),
  'application_tables', (select jsonb_agg(n.nspname || '.' || c.relname order by n.nspname, c.relname)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='r' and n.nspname in ('public','nuvabri_analytics','nuvabri_security')),
  'extensions', (select jsonb_agg(jsonb_build_object('name',extname,'version',extversion)) from pg_extension),
  'user_count', (select count(*) from auth.users),
  'property_count', (select count(*) from public.properties),
  'budget_count', (select count(*) from public.budget_plans)
);
"""

# The default CLI schema export excludes managed schemas. Capture application
# triggers and policies in auth/storage separately, without changing either one.
CUSTOMIZATIONS_SQL = """
select coalesce(string_agg(ddl, E'\\n' order by ddl), '-- No managed-schema customizations') from (
  select pg_get_triggerdef(t.oid, true) || ';' as ddl
    from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    join pg_proc f on f.oid=t.tgfoid
    join pg_namespace fn on fn.oid=f.pronamespace
    where not t.tgisinternal and n.nspname in ('auth','storage')
      and fn.nspname in ('public','nuvabri_security','nuvabri_analytics')
      and not exists (select 1 from pg_depend d where d.classid='pg_trigger'::regclass
        and d.objid=t.oid and d.deptype='e')
  union all
  select format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s;',
    policyname, schemaname, tablename, permissive, cmd,
    (select string_agg(quote_ident(r), ', ') from unnest(roles) r),
    case when qual is null then '' else ' USING (' || qual || ')' end,
    case when with_check is null then '' else ' WITH CHECK (' || with_check || ')' end)
    from pg_policies where schemaname in ('auth','storage')
) custom;
"""


def digest(path):
    with path.open("rb") as f:
        return hashlib.file_digest(f, "sha256").hexdigest()


def gpg_file(source, target, phrase, *, decrypt=False, home):
    env = {k: v for k, v in os.environ.items()
           if k not in ("SUPABASE_DB_URL", "NUVABRI_BACKUP_PASSPHRASE", "PGPASSWORD")}
    args = ["gpg", "--no-options", "--homedir", str(home), "--batch", "--yes",
            "--pinentry-mode", "loopback", "--passphrase-fd", "0", "--no-symkey-cache",
            "--output", str(target)]
    if decrypt:
        args += ["--decrypt", str(source)]
    else:
        args += ["--symmetric", "--cipher-algo", "AES256", "--s2k-mode", "3",
                 "--s2k-digest-algo", "SHA256", "--s2k-count", "65011712", str(source)]
    run(args, env=env, input=(phrase + "\n").encode(), timeout=180)


def validate_package(path):
    """Validate every member before extracting, including hashes and size limits."""
    try:
        with tarfile.open(path, "r:gz") as archive:
            members = archive.getmembers()
            names = [m.name for m in members]
            if (set(names) != set(FILES) | {"manifest.json"} or len(names) != len(set(names))
                    or any(not m.isfile() or m.size < 0 for m in members)
                    or sum(m.size for m in members) > MAX_PLAIN):
                raise BackupError("Archive members are invalid; nothing was extracted.")
            m = archive.getmember("manifest.json")
            if m.size > 65536:
                raise BackupError("Invalid manifest size.")
            manifest = json.load(archive.extractfile(m))
            if (manifest.get("format") != 1 or manifest.get("source_ref") != SOURCE_REF
                    or set(manifest.get("files", {})) != set(FILES)):
                raise BackupError("Invalid backup manifest.")
            for name in FILES:
                entry = manifest["files"][name]
                member = archive.getmember(name)
                content = archive.extractfile(member)
                if (entry["size"] != member.size or entry["size"] == 0
                        or hashlib.file_digest(content, "sha256").hexdigest() != entry["sha256"]):
                    raise BackupError("Backup integrity check failed.")
            return manifest
    except (tarfile.TarError, OSError, ValueError, KeyError, TypeError, AttributeError):
        raise BackupError("Invalid backup archive; nothing was extracted.") from None


def make_package(folder, archive_path):
    manifest = {"format": 1, "source_ref": SOURCE_REF, "created_at": dt.datetime.now(dt.timezone.utc).isoformat(),
                "supabase_cli": CLI_VERSION, "restore_tested": False,
                "files": {name: {"size": (folder / name).stat().st_size,
                                   "sha256": digest(folder / name)} for name in FILES}}
    (folder / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    with tarfile.open(archive_path, "w:gz") as archive:
        for name in (*FILES, "manifest.json"):
            archive.add(folder / name, arcname=name, recursive=False)
    validate_package(archive_path)


def export_backup(output):
    phrase = secret_phrase(os.environ.get("NUVABRI_BACKUP_PASSPHRASE"))
    url = os.environ.get("SUPABASE_DB_URL", "")
    env = connection_env(url)
    if os.environ.get("GITHUB_ACTIONS") == "true" and os.environ.get("NUVABRI_PRIVATE_REPOSITORY") != "true":
        raise BackupError("Cloud backups must run in a private repository.")
    for program in ("supabase", "docker", "psql", "gpg"):
        if not shutil.which(program):
            raise BackupError(f"Install {program} before exporting.")
    if run(["supabase", "--version"]).decode().strip() != CLI_VERSION:
        raise BackupError(f"Use the reviewed Supabase CLI version {CLI_VERSION}.")
    # Discover supported flags at runtime rather than silently relying on a changed CLI.
    help_text = run(["supabase", "db", "dump", "--help"]).decode()
    for flag in ("--db-url", "--file", "--role-only", "--data-only", "--use-copy", "--schema"):
        if flag not in help_text:
            raise BackupError("Supabase CLI flags changed; review required.")
    inventory = json.loads(sql(INVENTORY_SQL, env))
    if inventory["storage_objects"] or inventory["vault_secrets"]:
        raise BackupError("Storage files or Vault secrets need a separate recoverable export before this backup can be considered complete.")
    output = Path(output).resolve()
    if output.exists():
        raise BackupError("Choose a new output directory; existing backups are never overwritten.")
    # Keep plaintext outside the checkout and remove it on success or failure.
    with tempfile.TemporaryDirectory(prefix="nuvabri-backup-") as tmp:
        root = Path(tmp)
        folder = root / "plain"
        folder.mkdir(mode=0o700)
        (folder / "inventory.json").write_text(json.dumps(inventory, indent=2) + "\n")
        (folder / "managed-customizations.sql").write_bytes(sql(CUSTOMIZATIONS_SQL, env))
        jobs = [
            ("roles.sql", ["--role-only"]), ("schema.sql", []),
            ("data.sql", ["--data-only", "--use-copy"]),
            ("history-schema.sql", ["--schema", "supabase_migrations"]),
            ("history-data.sql", ["--schema", "supabase_migrations", "--data-only", "--use-copy"]),
        ]
        for name, flags in jobs:
            print(f"Exporting {name}…", flush=True)
            run(["supabase", "db", "dump", "--db-url", url, "--file", str(folder / name), *flags],
                env=env, timeout=600)
            if not (folder / name).is_file() or not (folder / name).stat().st_size:
                raise BackupError("An export is missing or empty; no backup was published.")
        data_text = (folder / "data.sql").read_text()
        tables = list(inventory["application_tables"] or []) + ["auth.users"]
        for table in tables:
            schema, name = table.split(".", 1)
            pattern = rf'COPY\s+"?{re.escape(schema)}"?\."?{re.escape(name)}"?\s*\('
            if not re.search(pattern, data_text):
                raise BackupError("The data dump omitted a required table; no backup was published.")
        packed = root / "backup.tar.gz"
        make_package(folder, packed)
        home = root / "gnupg"
        home.mkdir(mode=0o700)
        encrypted = root / "backup.tar.gz.gpg"
        gpg_file(packed, encrypted, phrase, home=home)
        if encrypted.stat().st_size > MAX_ARCHIVE:
            raise BackupError("Encrypted export exceeds the 40 MiB storage guard; nothing was published.")
        decrypted = root / "verified.tar.gz"
        gpg_file(encrypted, decrypted, phrase, decrypt=True, home=home)
        validate_package(decrypted)
        if digest(packed) != digest(decrypted):
            raise BackupError("Encryption round trip failed.")
        output.mkdir(mode=0o700, parents=True)
        try:
            target = output / "backup.tar.gz.gpg"
            shutil.copyfile(encrypted, target)
            target.chmod(0o600)
            (output / "backup.sha256").write_text(digest(target) + "  backup.tar.gz.gpg\n")
        except BaseException:
            shutil.rmtree(output)
            raise
    print("Encrypted export verified. Database restoration remains untested.")


def unpack_backup(source, output):
    phrase = secret_phrase(os.environ.get("NUVABRI_BACKUP_PASSPHRASE"))
    source, output = Path(source).resolve(), Path(output).resolve()
    if output.exists():
        raise BackupError("Choose a new extraction directory.")
    if not source.is_file() or source.stat().st_size > MAX_ARCHIVE:
        raise BackupError("Encrypted archive is missing or exceeds the size limit.")
    with tempfile.TemporaryDirectory(prefix="nuvabri-check-") as tmp:
        root = Path(tmp)
        home = root / "gnupg"
        home.mkdir(mode=0o700)
        plain = root / "backup.tar.gz"
        gpg_file(source, plain, phrase, decrypt=True, home=home)
        validate_package(plain)
        output.mkdir(mode=0o700, parents=True)
        try:
            with tarfile.open(plain, "r:gz") as archive:
                # Explicit flat allowlist: never use extractall() on a supplied archive.
                for name in (*FILES, "manifest.json"):
                    with (output / name).open("xb") as target:
                        shutil.copyfileobj(archive.extractfile(name), target)
                    (output / name).chmod(0o600)
        except BaseException:
            shutil.rmtree(output)
            raise
    print("Decrypted files verified. No database was changed.")


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    exp = sub.add_parser("export")
    exp.add_argument("--output", required=True)
    dec = sub.add_parser("unpack")
    dec.add_argument("--input", required=True)
    dec.add_argument("--output", required=True)
    args = parser.parse_args()
    try:
        if args.command == "export":
            export_backup(args.output)
        else:
            unpack_backup(args.input, args.output)
    except (BackupError, OSError, ValueError):
        # Known errors are intentionally generic: no secrets, row values or raw tracebacks.
        error = sys.exc_info()[1]
        print(str(error) if isinstance(error, BackupError) else "Backup operation failed; no success was recorded.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
