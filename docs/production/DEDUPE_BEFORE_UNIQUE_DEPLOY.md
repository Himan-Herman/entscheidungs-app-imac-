# Dedupe before unique constraints (Render / Prisma)

When `prisma db push` or `migrate deploy` fails on:

- `AppointmentReminder_reminderKey_key`
- `PatientInboxItem_patientUserId_dedupeKey_key`

the database already contains **duplicate rows** from before idempotent upserts / partial unique indexes.

**Do not use** `prisma db push --accept-data-loss`.

## Root cause

| Constraint | Why duplicates exist |
|--------------|----------------------|
| `reminderKey` UNIQUE | Same logical reminder inserted twice (race before index, or schedule without upsert). Legacy backfill `legacy:{id}` is unique per row; **real** dupes share keys like `appt:{id}:inbox:24h`. |
| `(patientUserId, dedupeKey)` UNIQUE | App dedupes only **non-archived** rows; archived + unread can coexist. Races on `create` before unique index. |

## Safe cleanup rules

### AppointmentReminder — keep one per `reminderKey`

1. `sent` (already delivered — do not drop)
2. `pending` (still scheduled)
3. `processing`
4. `failed`
5. `cancelled`
6. Tie-break: `updatedAt` DESC, then `id` ASC

**Removed rows:** redundant duplicate reminders only. No clinical data in table.

### PatientInboxItem — keep one per `(patientUserId, dedupeKey)` where `dedupeKey` is set

1. `unread` (user should still see notice)
2. `read`
3. `archived`
4. Tie-break: `lastActivityAt` / `createdAt` DESC

Rows with **NULL** `dedupeKey` are **not** deduped (Postgres allows multiple NULLs).

**Removed rows:** duplicate inbox badges for the same source — not a soft-delete merge.

## Procedure (production)

Production may **not** have `reminderKey` / `dedupeKey` yet (only `db push` in build, migrations never applied). **Order matters.**

1. **Backup** Postgres (Render snapshot or `pg_dump`).

2. **Apply migrations** (adds columns, backfill, dedupe, unique indexes):

   ```bash
   cd server
   npx prisma migrate deploy
   ```

   Key migration: `20260621180000_dedupe_before_unique_constraints` (self-contained if `20260621140000` / `20260621170000` were skipped).

3. **Render settings**: Build = `npm ci && npx prisma generate` only. Start = `npx prisma migrate deploy && node app.js`. **No** `db push` in build.

4. **Optional verify** (only **after** step 2 — scripts skip missing columns):

   ```bash
   node scripts/analyzeDuplicateConstraints.js
   node scripts/dedupeDuplicateConstraints.js --dry-run
   ```

   If duplicates remain after migrate deploy:

   ```bash
   node scripts/dedupeDuplicateConstraints.js --execute --confirm
   ```

5. **Redeploy** API service.

## Data loss

| Area | Impact |
|------|--------|
| Reminders | Duplicate **queue rows** removed; kept row reflects best status (prefer `sent` / `pending`). Avoids double send. |
| Inbox | Duplicate **UI list entries** removed; one notice per dedupe key. Archived copy dropped if unread exists. |

No PDFs, messages, or appointments are deleted — only duplicate **operational** rows.

## After dedupe

- `prisma db push` should succeed.
- Prefer **`migrate deploy`** in production over `db push`.
- Worker / reminder schedule uses `reminderKey` upsert — no new dupes expected.
