-- The e-prescription's care relationship becomes a real reference.
--
-- `linkId` has always been a NOT NULL string with no foreign key: the database
-- guaranteed nothing about it, and a value naming a deleted link simply stayed
-- there. Phase 2F.1 measured that and worked around it in the query layer;
-- this closes it at the source.
--
-- The COLUMN NAME is kept. Every other model calls this `practicePatientLinkId`
-- and consistency would be nicer, but renaming would mean carrying two link
-- columns through a deploy — and "which of these two ids is authoritative" is
-- exactly the ambiguity this whole lifecycle block exists to remove. The Prisma
-- relation is named `practicePatientLink`, so the domain reads correctly where
-- it matters while the physical column stays stable and the change stays
-- reversible by dropping one constraint.
--
-- ON DELETE RESTRICT, matching MedicationPlan: a prescription outlives the end
-- of a relationship, so the relationship must not be erased under it.

DO $$
DECLARE
    unresolved INT;
BEGIN
    SELECT count(*) INTO unresolved
      FROM "ErezeptEntry" e
      LEFT JOIN "PracticePatientLink" l ON l."id" = e."linkId"
     WHERE l."id" IS NULL;
    IF unresolved > 0 THEN
        RAISE EXCEPTION
            'ErezeptEntry.linkId: % row(s) reference no care relationship. Refusing to add the foreign key.',
            unresolved;
    END IF;

    -- The link and the entry must agree on the patient. A foreign key would
    -- happily accept a row where they disagree, so it is checked here instead.
    SELECT count(*) INTO unresolved
      FROM "ErezeptEntry" e
      JOIN "PracticePatientLink" l ON l."id" = e."linkId"
     WHERE l."patientUserId" <> e."patientUserId";
    IF unresolved > 0 THEN
        RAISE EXCEPTION
            'ErezeptEntry.linkId: % row(s) name a care relationship belonging to a different patient.',
            unresolved;
    END IF;
END $$;

ALTER TABLE "ErezeptEntry"
    ADD CONSTRAINT "ErezeptEntry_linkId_fkey"
    FOREIGN KEY ("linkId") REFERENCES "PracticePatientLink"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Attribution is complete for every row, so it can be required from now on.
ALTER TABLE "ErezeptEntry" ALTER COLUMN "practiceProfileId" SET NOT NULL;
