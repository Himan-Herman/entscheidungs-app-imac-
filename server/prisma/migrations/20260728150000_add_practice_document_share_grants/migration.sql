-- Patient-controlled release of a single practice document to one other
-- connected practice.
--
-- Purely additive: one new table. No existing row is read, changed or deleted,
-- no backfill, and no grant is created — a document is shared only when the
-- patient explicitly says so.
--
-- The existing PracticeDocumentShare is left untouched. It means something
-- different (the origin practice releasing a document to its own patient) and
-- carries no target practice; see the model comment in schema.prisma.

CREATE TABLE "PracticeDocumentShareGrant" (
  "id"                          TEXT NOT NULL,
  "documentId"                  TEXT NOT NULL,
  "patientUserId"               TEXT NOT NULL,
  "sourcePracticeProfileId"     TEXT NOT NULL,
  "sourcePracticePatientLinkId" TEXT NOT NULL,
  "targetPracticeProfileId"     TEXT NOT NULL,
  "targetPracticePatientLinkId" TEXT NOT NULL,
  "status"                      TEXT NOT NULL,
  "grantedByUserId"             TEXT NOT NULL,
  "grantedAt"                   TIMESTAMP(3) NOT NULL,
  "revokedAt"                   TIMESTAMP(3),
  "expiresAt"                   TIMESTAMP(3),
  "createdAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PracticeDocumentShareGrant_pkey" PRIMARY KEY ("id")
);

-- Real foreign keys, no polymorphic string references.
--
-- ON DELETE RESTRICT throughout: a grant is the record of who was allowed to
-- read a medical document and when. Cascading it away with the document, the
-- practice, the link or the user would erase exactly the evidence the grant
-- exists to preserve. Revocation is a status change, never a delete.
ALTER TABLE "PracticeDocumentShareGrant"
  ADD CONSTRAINT "PracticeDocumentShareGrant_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "PracticeDocument"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PracticeDocumentShareGrant"
  ADD CONSTRAINT "PracticeDocumentShareGrant_patientUserId_fkey"
  FOREIGN KEY ("patientUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PracticeDocumentShareGrant"
  ADD CONSTRAINT "PracticeDocumentShareGrant_grantedByUserId_fkey"
  FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PracticeDocumentShareGrant"
  ADD CONSTRAINT "PracticeDocumentShareGrant_sourcePracticeProfileId_fkey"
  FOREIGN KEY ("sourcePracticeProfileId") REFERENCES "PracticeProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PracticeDocumentShareGrant"
  ADD CONSTRAINT "PracticeDocumentShareGrant_sourcePracticePatientLinkId_fkey"
  FOREIGN KEY ("sourcePracticePatientLinkId") REFERENCES "PracticePatientLink"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PracticeDocumentShareGrant"
  ADD CONSTRAINT "PracticeDocumentShareGrant_targetPracticeProfileId_fkey"
  FOREIGN KEY ("targetPracticeProfileId") REFERENCES "PracticeProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PracticeDocumentShareGrant"
  ADD CONSTRAINT "PracticeDocumentShareGrant_targetPracticePatientLinkId_fkey"
  FOREIGN KEY ("targetPracticePatientLinkId") REFERENCES "PracticePatientLink"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Only one ACTIVE grant per (document, target link) can exist. Partial on
-- purpose: a revoked or expired grant is kept as history and never overwritten,
-- so a full unique index would make re-granting after a revoke impossible
-- without deleting the record of the revocation.
--
-- Prisma cannot express a partial unique index in schema.prisma. The model
-- therefore declares a plain @@index on the same columns; this index is the
-- authoritative constraint and is documented in the model comment.
CREATE UNIQUE INDEX "PracticeDocumentShareGrant_active_unique"
  ON "PracticeDocumentShareGrant"("documentId", "targetPracticePatientLinkId")
  WHERE "status" = 'active';

CREATE INDEX "PracticeDocumentShareGrant_documentId_targetLink_idx"
  ON "PracticeDocumentShareGrant"("documentId", "targetPracticePatientLinkId");
CREATE INDEX "PracticeDocumentShareGrant_targetLink_status_idx"
  ON "PracticeDocumentShareGrant"("targetPracticePatientLinkId", "status");
CREATE INDEX "PracticeDocumentShareGrant_patientUserId_status_idx"
  ON "PracticeDocumentShareGrant"("patientUserId", "status");
CREATE INDEX "PracticeDocumentShareGrant_documentId_status_idx"
  ON "PracticeDocumentShareGrant"("documentId", "status");

-- Invariants the database enforces itself, so a future code path cannot write
-- a grant that the authorization layer would then honour.

-- Only the patient may release their own document. This is the single most
-- important invariant of the whole feature, so it is not left to application
-- code alone: a practice cannot activate a share, and neither can an owner,
-- admin or doctor acting "on behalf of" the patient.
ALTER TABLE "PracticeDocumentShareGrant"
  ADD CONSTRAINT "PracticeDocumentShareGrant_granted_by_patient_check"
  CHECK ("patientUserId" = "grantedByUserId");

-- Sharing with the practice the document already came from is meaningless and
-- would create a second, weaker access path to the origin practice's own data.
ALTER TABLE "PracticeDocumentShareGrant"
  ADD CONSTRAINT "PracticeDocumentShareGrant_distinct_practice_check"
  CHECK ("sourcePracticeProfileId" <> "targetPracticeProfileId");

ALTER TABLE "PracticeDocumentShareGrant"
  ADD CONSTRAINT "PracticeDocumentShareGrant_distinct_link_check"
  CHECK ("sourcePracticePatientLinkId" <> "targetPracticePatientLinkId");

-- The state machine, written as CASE so every combination yields a real
-- boolean. A chain of ORs would let a NULL status through as UNKNOWN, which
-- PostgreSQL accepts.
--   active  -> not revoked
--   revoked -> revocation timestamp present
--   expired -> expiry timestamp present, in the past at the time of transition
ALTER TABLE "PracticeDocumentShareGrant"
  ADD CONSTRAINT "PracticeDocumentShareGrant_status_check"
  CHECK (
    CASE
      WHEN "status" = 'active'  THEN "revokedAt" IS NULL
      WHEN "status" = 'revoked' THEN "revokedAt" IS NOT NULL
      WHEN "status" = 'expired' THEN "expiresAt" IS NOT NULL
      ELSE false
    END
  );
