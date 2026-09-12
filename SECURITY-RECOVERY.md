# Current verification — 12 September 2026

See [qa-validation-20260912.md](qa-validation-20260912.md) for the current results. The backup workflow is configured but its latest scheduled export fails authentication. Full restoration remains unverified. The status sections below record the earlier preparation work.

# Invitation permissions and recovery

## Applied invitation repair

Applied on 2026-09-10 through Supabase migration
`20260910170126_secure_household_invitation_acceptance`.
The reviewed SQL source is `db/secure-household-invitations.sql`.
The database migration history supplies the version; the source follows this
repository's existing `db/*.sql` convention.

An invitation's recipient, role, household, property, issuer and expiry are
immutable for application clients. Household managers can revoke a pending
invitation, or issue a new one to change the proposed access. A recipient must
accept through `public.accept_household_invitation(invite_id uuid)`.

The public RPC keeps its existing signature and runs as the caller. Its private
implementation verifies the current confirmed Auth email, pending state, expiry,
issuer permissions and property/household relationship before granting access.
The invitation is locked and acceptance, membership and activity logging are
atomic. Direct membership insertion by an invited non-manager is denied.

A property invitation grants its role only on the chosen property, with a
read-only household membership for context. An explicit household invitation
with no property grants the stated household role. Existing higher active
roles are retained. Repeating an accepted invitation does not recreate access
removed afterward. No existing invitations or memberships were rewritten.

This repair does not change the application's invitation screens or send emails.
Its verified boundary is database authorization; a complete browser invitation
journey is a separate acceptance check before opening sharing to external users.

## Reproducible verification

Run `tests/household-invitations.sql` through a database administrator SQL
connection. It creates random synthetic users with the reserved
`invitation-test.invalid` domain, households and properties inside a transaction.
Assertions execute as `authenticated` and `anon`, with synthetic identity claims.
The final `ROLLBACK` removes fixtures and temporary helpers, including on failure
when the failed transaction is closed. Never replace it with `COMMIT`.

All 44 assertions passed both during the rolled-back migration rehearsal and
after application. They cover privilege escalation, direct-join bypasses,
scoped editing, cross-household access, unconfirmed/wrong recipients,
expired/revoked invitations, issuer demotion, replay and valid owner operations.
A separate read-only query confirmed zero fixture accounts afterward.
The security advisor no longer lists the public invitation RPC as a callable
security-definer function. This is targeted verification, not a full security audit.

The shared database correction takes effect for every deployment using that
database; a Vercel deployment is not needed to activate it.

## Backup status — free plan retained

The owner supplied dashboard screenshots confirming the Free plan has no
included automatic backups, and explicitly declined a paid plan. No upgrade
was performed. A free-plan export package is prepared in `ops/backups/`, with
encrypted exports, integrity checks, a private-repository workflow template and
a restoration runbook. It is **not active**: the source database connection and
private backup destination still need configuration. No real database export or
restoration has been performed. See `ops/backups/README.md` for setup and limits.

## Restoration verification still required

The available Supabase connection does not expose backup inventory or restoration
management. Backup dates, retention and restoration success have **not** been
verified. A healthy database, a successful SQL rollback, a Git commit or a new
schema-only branch is not proof of a recoverable data backup.

1. The Free plan has been confirmed from the owner's screenshot. Configure the
   prepared export method, then record the newest successful encrypted archive.
2. Establish a working backup method before
   accepting external users' data. Keep exports encrypted and access restricted;
   never place them in this repository or attach them to an issue.
3. Prepare an isolated, empty local Supabase instance or an available free project
   for a logical restore. No paid project, add-on or upgrade is authorized.
   Do not restore over the live application for a test.
4. A restored database may contain Auth records, secrets and scheduled jobs.
   Restrict access to the copy, disable copied external integrations/jobs before
   testing, and do not connect live email, payments or the public application.
5. On the isolated copy, verify schema, row counts against the selected backup
   point, key relationships, RLS and this invitation test suite. If the backup
   predates this repair, apply the repair to the isolated copy before access tests.
   Check representative budget/property reads using authorized test identities.
6. Record backup timestamp, restore start/end, target, results and missing
   components. Treat restoration as unverified until these checks succeed.
   Remove the temporary copy through the approved resource cleanup process.

Supabase database backups do not include Storage object contents. If file storage
is introduced, provide a separate file backup and restore check. Auth settings,
API keys and other project configuration also need review after cloning.

References checked on 2026-09-10:

- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [Restore to a new project](https://supabase.com/docs/guides/platform/clone-project)
- [Column privileges](https://supabase.com/docs/guides/database/postgres/column-level-security)
- [Row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Security-definer advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
