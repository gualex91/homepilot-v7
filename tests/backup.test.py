"""Offline safeguards: real GPG round trips; stubbed SQL/CLI export plumbing.

These tests do not claim to validate PostgreSQL restoration or the live database.
"""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('nuvabri_backup', ROOT / 'ops/backups/backup.py')
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)
PHRASE = 'fixture-only-random-passphrase-83612904-DoNotUse'
URL = f'postgresql://postgres.{b.SOURCE_REF}:test%40password@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require'


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def package(self):
        folder = self.root / 'plain'
        folder.mkdir()
        for name in b.FILES:
            (folder / name).write_text('synthetic-data-only-' + name + '\n')
        archive = self.root / 'package.tar.gz'
        b.make_package(folder, archive)
        return archive

    def crypto_home(self):
        home = self.root / 'gpg'
        home.mkdir(mode=0o700)
        return home

    def test_source_password_is_decoded_and_read_only(self):
        env = b.connection_env(URL)
        self.assertEqual(env['PGPASSWORD'], 'test@password')
        self.assertEqual(env['PGSSLMODE'], 'require')
        self.assertIn('default_transaction_read_only=on', env['PGOPTIONS'])
        self.assertNotIn('SUPABASE_DB_URL', env)

    def test_wrong_project_host_and_transaction_pooler_rejected(self):
        for url in [URL.replace(b.SOURCE_REF, 'x' * 20), URL.replace(':5432/', ':6543/'),
                    URL.replace('pooler.supabase.com', 'attacker.invalid'),
                    URL.replace('sslmode=require', 'sslmode=disable'), URL + '&options=anything', '',
                    URL.replace('/postgres?', '/wrong?')]:
            with self.subTest(url=url), self.assertRaises(b.BackupError):
                b.connection_env(url)

    def test_direct_connection_accepted(self):
        env = b.connection_env(f'postgresql://postgres:fixture@db.{b.SOURCE_REF}.supabase.co:5432/postgres')
        self.assertEqual(env['PGUSER'], 'postgres')

    def test_bad_secrets_rejected(self):
        for phrase in [None, '', 'short', 'a' * 50, PHRASE + '\n', PHRASE + '\0']:
            with self.subTest(phrase=phrase), self.assertRaises(b.BackupError):
                b.secret_phrase(phrase)

    def test_child_failure_never_prints_secrets(self):
        result = subprocess.CompletedProcess(['psql'], 1, URL.encode(), PHRASE.encode())
        with patch.object(b.subprocess, 'run', return_value=result):
            with self.assertRaises(b.BackupError) as ctx:
                b.run(['psql'])
        self.assertNotIn(URL, str(ctx.exception))
        self.assertNotIn(PHRASE, str(ctx.exception))

    def test_encrypt_unpack_exact_roundtrip(self):
        archive, home = self.package(), self.crypto_home()
        encrypted = self.root / 'encrypted.gpg'
        b.gpg_file(archive, encrypted, PHRASE, home=home)
        self.assertNotIn(b'synthetic-data-only', encrypted.read_bytes())
        output = self.root / 'unpacked'
        with patch.dict(os.environ, {'NUVABRI_BACKUP_PASSPHRASE': PHRASE}):
            b.unpack_backup(encrypted, output)
        for name in b.FILES:
            self.assertEqual((output / name).read_bytes(), (self.root / 'plain' / name).read_bytes())
            self.assertEqual((output / name).stat().st_mode & 0o777, 0o600)
        self.assertFalse(json.loads((output / 'manifest.json').read_text())['restore_tested'])

    def test_wrong_phrase_produces_no_extracted_files(self):
        archive, home = self.package(), self.crypto_home()
        encrypted = self.root / 'encrypted.gpg'
        b.gpg_file(archive, encrypted, PHRASE, home=home)
        output = self.root / 'unpacked'
        with patch.dict(os.environ, {'NUVABRI_BACKUP_PASSPHRASE': PHRASE + '-wrong'}):
            with self.assertRaises(b.BackupError):
                b.unpack_backup(encrypted, output)
        self.assertFalse(output.exists())

    def test_corrupted_ciphertext_is_rejected(self):
        archive, home = self.package(), self.crypto_home()
        encrypted = self.root / 'encrypted.gpg'
        b.gpg_file(archive, encrypted, PHRASE, home=home)
        data = bytearray(encrypted.read_bytes())
        data[-30] ^= 0xff
        encrypted.write_bytes(data)
        output = self.root / 'unpacked'
        with patch.dict(os.environ, {'NUVABRI_BACKUP_PASSPHRASE': PHRASE}):
            with self.assertRaises(b.BackupError):
                b.unpack_backup(encrypted, output)
        self.assertFalse(output.exists())

    def test_manifest_hash_detects_modified_member(self):
        self.package()
        (self.root / 'plain/data.sql').write_text('modified')
        archive = self.root / 'modified.tar.gz'
        with tarfile.open(archive, 'w:gz') as tar:
            for name in (*b.FILES, 'manifest.json'):
                tar.add(self.root / 'plain' / name, arcname=name)
        with self.assertRaises(b.BackupError):
            b.validate_package(archive)

    def test_path_traversal_symlink_duplicate_and_oversize_are_rejected(self):
        original = self.package()
        for case in ['traversal', 'symlink', 'duplicate', 'oversize']:
            archive = self.root / (case + '.tar.gz')
            with tarfile.open(original, 'r:gz') as source, tarfile.open(archive, 'w:gz') as target:
                for member in source.getmembers():
                    target.addfile(member, source.extractfile(member))
                info = tarfile.TarInfo('../escape' if case == 'traversal' else 'data.sql')
                if case == 'symlink':
                    info.type, info.linkname = tarfile.SYMTYPE, '/etc/passwd'
                target.addfile(info, io.BytesIO(b''))
            with self.subTest(case=case), self.assertRaises(b.BackupError):
                if case == 'oversize':
                    with patch.object(b, 'MAX_PLAIN', 1):
                        b.validate_package(original)
                else:
                    b.validate_package(archive)

    def mock_export(self, *, omit_table=False, fail_name=None):
        real_run = b.run
        calls = []
        def fake_run(args, **kwargs):
            if args[0] == 'gpg':
                return real_run(args, **kwargs)
            calls.append(args)
            if args == ['supabase', '--version']:
                return b.CLI_VERSION.encode()
            if args[-1] == '--help':
                return b'--db-url --file --role-only --data-only --use-copy --schema'
            path = Path(args[args.index('--file') + 1])
            if path.name == fail_name:
                raise b.BackupError('Export failed')
            content = '-- fixture-only SQL\n'
            if path.name == 'data.sql' and not omit_table:
                content += 'COPY public.properties (id) FROM stdin;\n\\.\nCOPY auth.users (id) FROM stdin;\n\\.\n'
            path.write_text(content)
            return b''
        inventory = {'storage_objects': 0, 'vault_secrets': 0,
                     'application_tables': ['public.properties']}
        def fake_sql(query, env):
            return json.dumps(inventory).encode() if query == b.INVENTORY_SQL else b'-- no customizations\n'
        stack = contextlib.ExitStack()
        stack.enter_context(patch.object(b, 'run', side_effect=fake_run))
        stack.enter_context(patch.object(b, 'sql', side_effect=fake_sql))
        stack.enter_context(patch.object(b.shutil, 'which', return_value='/fixture/bin'))
        stack.enter_context(patch.dict(os.environ, {'SUPABASE_DB_URL': URL,
            'NUVABRI_BACKUP_PASSPHRASE': PHRASE, 'GITHUB_ACTIONS': 'false'}))
        self.addCleanup(stack.close)
        return calls

    def test_export_only_publishes_verified_encrypted_files(self):
        calls = self.mock_export()
        output = self.root / 'published'
        b.export_backup(output)
        self.assertEqual({p.name for p in output.iterdir()}, {'backup.tar.gz.gpg', 'backup.sha256'})
        self.assertEqual(len([c for c in calls if '--file' in c]), 5)
        # Temp directories containing plain SQL were removed after success.
        self.assertTrue(all(not Path(c[c.index('--file') + 1]).exists() for c in calls if '--file' in c))

    def test_omitted_table_fails_without_publishing(self):
        self.mock_export(omit_table=True)
        output = self.root / 'published'
        with self.assertRaises(b.BackupError):
            b.export_backup(output)
        self.assertFalse(output.exists())

    def test_dump_failure_removes_plaintext_and_preserves_previous_backup(self):
        calls = self.mock_export(fail_name='data.sql')
        previous = self.root / 'previous.gpg'
        previous.write_bytes(b'previous-encrypted-fixture')
        output = self.root / 'published'
        with self.assertRaises(b.BackupError):
            b.export_backup(output)
        self.assertFalse(output.exists())
        self.assertEqual(previous.read_bytes(), b'previous-encrypted-fixture')
        self.assertTrue(all(not Path(c[c.index('--file') + 1]).exists() for c in calls if '--file' in c))

    def test_archive_size_guard_prevents_upload(self):
        self.mock_export()
        output = self.root / 'published'
        with patch.object(b, 'MAX_ARCHIVE', 1), self.assertRaises(b.BackupError):
            b.export_backup(output)
        self.assertFalse(output.exists())

    def test_cloud_public_repository_is_rejected(self):
        with patch.dict(os.environ, {'SUPABASE_DB_URL': URL, 'NUVABRI_BACKUP_PASSPHRASE': PHRASE,
                                     'GITHUB_ACTIONS': 'true', 'NUVABRI_PRIVATE_REPOSITORY': 'false'}):
            with self.assertRaisesRegex(b.BackupError, 'private repository'):
                b.export_backup(self.root / 'published')


if __name__ == '__main__':
    unittest.main()
