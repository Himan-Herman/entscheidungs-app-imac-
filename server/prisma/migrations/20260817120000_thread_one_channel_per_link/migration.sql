-- One permanent communication channel per care relationship (Phase 2A).
--
-- WHAT THIS DOES
--   Adds a UNIQUE index on PracticePatientThread("practicePatientLinkId") so a
--   PracticePatientLink can carry exactly one thread, and drops the now
--   redundant composite index on ("practicePatientLinkId", "status") — a unique
--   index on the leading column already serves every lookup by that column, and
--   with at most one row per link the status component adds nothing but write
--   cost.
--
-- WHY IT IS SAFE
--   Additive and non-destructive: no row is inserted, updated or deleted, no
--   column is dropped, no data is merged. The only way this migration can fail
--   is by refusing to apply, which is the intended behaviour if duplicates
--   exist — it will never silently discard a conversation.
--
-- BEFORE APPLYING TO AN ENVIRONMENT WITH DATA
--   Run the read-only preflight first:
--       node scripts/checkThreadChannelUniqueness.js
--   It reports any PracticePatientLink carrying more than one thread, with the
--   status and message count of each, WITHOUT changing anything. If it reports
--   duplicates, stop and decide how to consolidate them — this migration
--   deliberately contains no automatic clean-up, because merging or deleting a
--   medical conversation is a product decision, not a schema decision.
--
-- ROLLBACK
--   DROP INDEX "PracticePatientThread_practicePatientLinkId_key";
--   CREATE INDEX "PracticePatientThread_practicePatientLinkId_status_idx"
--     ON "PracticePatientThread"("practicePatientLinkId", "status");
--   No data is lost by rolling back.
--
-- FUTURE TOPIC THREADS
--   Introducing per-topic threads later means dropping this unique index and
--   creating a composite one. Every existing row stays valid, so that is also a
--   non-destructive migration.

CREATE UNIQUE INDEX "PracticePatientThread_practicePatientLinkId_key"
  ON "PracticePatientThread"("practicePatientLinkId");

DROP INDEX IF EXISTS "PracticePatientThread_practicePatientLinkId_status_idx";
