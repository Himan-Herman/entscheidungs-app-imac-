-- Retry-safe message sending (Phase 2A.1).
--
-- WHAT THIS DOES
--   Adds a nullable "clientRequestId" to PracticePatientMessage and a UNIQUE
--   index on ("threadId", "clientRequestId"), so repeating the SAME logical
--   send action — a network retry, a double tap, a proxy replay — cannot
--   persist the message a second time.
--
-- WHY THIS SHAPE
--   * Scoped to the thread, never global: the thread is authorized before any
--     insert, so the same key used in two different communication channels
--     yields two unrelated rows. A key can never collide across tenants.
--   * NULL is distinct in a Postgres unique index, so existing rows (all NULL)
--     stay valid and any sender that supplies no key keeps the old behaviour.
--     No backfill, and no invented key for historic messages.
--   * Deduplication is by INTENT, not by content: identical text sent under a
--     new key is a new message, which is what a patient repeating themselves
--     legitimately expects.
--
-- WHY IT IS SAFE
--   Purely additive: one nullable column and one index. No row is read,
--   changed or deleted. Every existing message keeps NULL and therefore cannot
--   violate the constraint.
--
-- ROLLBACK
--   DROP INDEX "PracticePatientMessage_threadId_clientRequestId_key";
--   ALTER TABLE "PracticePatientMessage" DROP COLUMN "clientRequestId";
--   No message content is affected.

ALTER TABLE "PracticePatientMessage"
  ADD COLUMN "clientRequestId" VARCHAR(64);

CREATE UNIQUE INDEX "PracticePatientMessage_threadId_clientRequestId_key"
  ON "PracticePatientMessage"("threadId", "clientRequestId");
