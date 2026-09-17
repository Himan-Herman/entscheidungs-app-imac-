-- Historical attribution for e-prescriptions.
--
-- ErezeptEntry was the only clinical artifact without a practice reference: it
-- carried patientUserId, issuedByUserId and a bare linkId string. Once the care
-- relationship was gone, nothing said which practice had issued the
-- prescription.
--
-- Two additions, deliberately minimal:
--
--   practiceProfileId          — the issuing practice, as a real relation.
--                                RESTRICT, so the practice cannot be removed
--                                out from under a prescription that names it.
--   issuerPracticeNameAtIssue  — the practice name as it read when the
--                                prescription was issued. A relation answers
--                                "which practice"; only a snapshot answers
--                                "what was it called then". A later rename must
--                                not rewrite history, and if a future retention
--                                operation ever removes a practice for real,
--                                this is what survives.
--
-- Nothing else is copied: no address, no phone number, no branding, and no
-- second copy of the medication data.
--
-- Both columns are added NULLABLE and backfilled here. They are tightened in
-- the following migration, once the backfill is proven complete — an additive
-- step first keeps the previous application version running against this
-- schema, so a deploy can be rolled back.

ALTER TABLE "ErezeptEntry" ADD COLUMN IF NOT EXISTS "practiceProfileId" TEXT;
ALTER TABLE "ErezeptEntry" ADD COLUMN IF NOT EXISTS "issuerPracticeNameAtIssue" TEXT;

-- Backfill from the care relationship the prescription already names. This is
-- the ONLY derivation used: no matching by practice name, no heuristics. A row
-- whose linkId resolves to nothing stays NULL and is caught by the check below.
UPDATE "ErezeptEntry" e
   SET "practiceProfileId" = l."practiceProfileId"
  FROM "PracticePatientLink" l
 WHERE e."linkId" = l."id"
   AND e."practiceProfileId" IS NULL;

UPDATE "ErezeptEntry" e
   SET "issuerPracticeNameAtIssue" = COALESCE(p."displayNameForPatients", p."practiceName")
  FROM "PracticeProfile" p
 WHERE e."practiceProfileId" = p."id"
   AND e."issuerPracticeNameAtIssue" IS NULL;

-- FAIL CLOSED. If any row could not be attributed, the link it names does not
-- resolve, and hardening the reference in the next migration would fail anyway
-- — better to stop here with a message that says what is wrong.
DO $$
DECLARE
    unattributed INT;
BEGIN
    SELECT count(*) INTO unattributed
      FROM "ErezeptEntry" WHERE "practiceProfileId" IS NULL;
    IF unattributed > 0 THEN
        RAISE EXCEPTION
            'ErezeptEntry backfill incomplete: % row(s) name a link that does not exist. Run scripts/checkErezeptLinkIntegrity.js and decide what those rows meant.',
            unattributed;
    END IF;
END $$;

ALTER TABLE "ErezeptEntry"
    ADD CONSTRAINT "ErezeptEntry_practiceProfileId_fkey"
    FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ErezeptEntry_practiceProfileId_idx"
    ON "ErezeptEntry"("practiceProfileId");
