-- Party-scoped archive state (Phase 2A.2).
--
-- THE DEFECT BEING FIXED
--   Patient and practice shared one `archivedAt` / `status='archived'` pair, so
--   the patient tidying their own list removed the conversation from the
--   practice's work queue and suppressed its unread counter, and either side
--   could undo the other's archive. Archiving is an organizational view state
--   and must belong to exactly one party.
--
-- WHAT THIS DOES
--   1. adds "patientArchivedAt" and "practiceArchivedAt" (both nullable),
--   2. backfills BOTH from the legacy "archivedAt" where it is set,
--   3. rewrites the shared status: "archived" is no longer a status value, so
--      such rows fall back to "closed" when they carry a closedAt and to "open"
--      otherwise — exactly the rule the old restore path already used,
--   4. keeps the legacy "archivedAt" column untouched as evidence.
--
-- LEGACY STRATEGY AND WHY
--   The old model recorded THAT a conversation was archived but never BY WHOM.
--   Attributing it to one party would invent information that never existed.
--   Attributing it to neither would make every previously archived conversation
--   reappear in both lists — resurfacing something a user deliberately put away,
--   which is a privacy-relevant surprise, not merely a UX one.
--   So both parties inherit the archived state (nobody's view changes at
--   migration time) AND the original column is preserved, so the record still
--   says "this was a legacy, unattributed archive" instead of asserting who did
--   it. Either party can undo their own half afterwards.
--
-- WHY IT IS SAFE
--   Two nullable columns and a value rewrite of a column whose old vocabulary is
--   being retired. No message is read, changed or deleted. No conversation
--   changes visibility for anyone. Idempotent: re-running produces the same
--   result.
--
-- BEFORE APPLYING TO AN ENVIRONMENT WITH DATA
--   Run the read-only preflight, which reports legacy archived threads and any
--   status value this migration would rewrite:
--       node scripts/checkThreadChannelUniqueness.js
--
-- ROLLBACK
--   UPDATE "PracticePatientThread" SET status = 'archived' WHERE "archivedAt" IS NOT NULL;
--   ALTER TABLE "PracticePatientThread" DROP COLUMN "patientArchivedAt";
--   ALTER TABLE "PracticePatientThread" DROP COLUMN "practiceArchivedAt";
--   DROP INDEX IF EXISTS "PracticePatientThread_patientUserId_patientArchivedAt_idx";
--   DROP INDEX IF EXISTS "PracticePatientThread_practiceProfileId_practiceArchivedAt_updatedAt_idx";
--   CREATE INDEX "PracticePatientThread_patientUserId_status_idx" ON "PracticePatientThread"("patientUserId", "status");
--   CREATE INDEX "PracticePatientThread_practiceProfileId_updatedAt_idx" ON "PracticePatientThread"("practiceProfileId", "updatedAt");
--   Archive attribution made after the migration is lost by rolling back, but no
--   message content is affected.

ALTER TABLE "PracticePatientThread"
  ADD COLUMN "patientArchivedAt"  TIMESTAMP(3),
  ADD COLUMN "practiceArchivedAt" TIMESTAMP(3);

-- Both parties inherit the unattributed legacy state, so no conversation
-- reappears in anyone's list at migration time.
UPDATE "PracticePatientThread"
   SET "patientArchivedAt"  = "archivedAt",
       "practiceArchivedAt" = "archivedAt"
 WHERE "archivedAt" IS NOT NULL;

-- "archived" leaves the shared status vocabulary.
UPDATE "PracticePatientThread"
   SET status = CASE WHEN "closedAt" IS NOT NULL THEN 'closed' ELSE 'open' END
 WHERE status = 'archived';

DROP INDEX IF EXISTS "PracticePatientThread_patientUserId_status_idx";
DROP INDEX IF EXISTS "PracticePatientThread_practiceProfileId_updatedAt_idx";

CREATE INDEX "PracticePatientThread_patientUserId_patientArchivedAt_idx"
  ON "PracticePatientThread"("patientUserId", "patientArchivedAt");

CREATE INDEX "PracticePatientThread_practiceProfileId_practiceArchivedAt_updatedAt_idx"
  ON "PracticePatientThread"("practiceProfileId", "practiceArchivedAt", "updatedAt");
