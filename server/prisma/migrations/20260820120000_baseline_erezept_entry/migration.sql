-- Baseline migration for "ErezeptEntry".
--
-- WHY THIS EXISTS
-- ---------------
-- The table is present in the Prisma schema and in every environment that was
-- ever touched by `prisma db push`, but no migration created it: of 87 tables
-- it was the only one missing from the migration history. A database built
-- purely from `prisma migrate deploy` therefore did NOT have it, and the
-- application would fail at runtime.
--
-- SAFE IN BOTH DIRECTIONS
-- -----------------------
-- A: fresh database   -> the table is created here.
-- B: existing database with a db-push table -> creation is skipped, and the
--    DO block below then PROVES the existing structure matches. A plain
--    CREATE TABLE IF NOT EXISTS would silently accept a table that differs,
--    which is precisely the failure this migration is meant to end.
--
-- On any mismatch this migration FAILS. It never alters or drops an existing
-- table: repairing a divergent structure is a decision, not a side effect.

CREATE TABLE IF NOT EXISTS "ErezeptEntry" (
    "id" TEXT NOT NULL,
    "patientUserId" TEXT NOT NULL,
    "issuedByUserId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "medicationName" VARCHAR(300) NOT NULL,
    "icdCode" VARCHAR(20),
    "dosage" VARCHAR(200),
    "instructions" TEXT,
    "tokenCode" VARCHAR(40) NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'issued',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErezeptEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ErezeptEntry_patientUserId_status_idx"
    ON "ErezeptEntry"("patientUserId", "status");
CREATE INDEX IF NOT EXISTS "ErezeptEntry_patientUserId_deletedAt_idx"
    ON "ErezeptEntry"("patientUserId", "deletedAt");
CREATE INDEX IF NOT EXISTS "ErezeptEntry_linkId_idx"
    ON "ErezeptEntry"("linkId");

-- Foreign keys. Added only when absent so an existing table keeps the ones it
-- already has. `linkId` deliberately gets NO foreign key here: this migration
-- records what exists, it does not change the lifecycle. Deciding what happens
-- to a prescription when its care relationship disappears is Phase 2F.3B.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ErezeptEntry_patientUserId_fkey') THEN
        ALTER TABLE "ErezeptEntry" ADD CONSTRAINT "ErezeptEntry_patientUserId_fkey"
            FOREIGN KEY ("patientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ErezeptEntry_issuedByUserId_fkey') THEN
        ALTER TABLE "ErezeptEntry" ADD CONSTRAINT "ErezeptEntry_issuedByUserId_fkey"
            FOREIGN KEY ("issuedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Structural proof. Runs in both directions: on a fresh database it confirms
-- what was just created, on an existing one it confirms the db-push table is
-- the same table. FAIL CLOSED — no automatic repair.
DO $$
DECLARE
    expected TEXT[][] := ARRAY[
        ['id','text','NO'],
        ['patientUserId','text','NO'],
        ['issuedByUserId','text','NO'],
        ['linkId','text','NO'],
        ['medicationName','character varying','NO'],
        ['icdCode','character varying','YES'],
        ['dosage','character varying','YES'],
        ['instructions','text','YES'],
        ['tokenCode','character varying','NO'],
        ['status','character varying','NO'],
        ['issuedAt','timestamp without time zone','NO'],
        ['validUntil','timestamp without time zone','NO'],
        ['redeemedAt','timestamp without time zone','YES'],
        ['notes','text','YES'],
        ['deletedAt','timestamp without time zone','YES'],
        ['createdAt','timestamp without time zone','NO'],
        ['updatedAt','timestamp without time zone','NO']
    ];
    i INT;
    found_type TEXT;
    found_null TEXT;
    actual_count INT;
BEGIN
    SELECT count(*) INTO actual_count
      FROM information_schema.columns WHERE table_name = 'ErezeptEntry';
    IF actual_count <> array_length(expected, 1) THEN
        RAISE EXCEPTION
            'ErezeptEntry baseline mismatch: expected % columns, found %. Refusing to continue.',
            array_length(expected, 1), actual_count;
    END IF;

    FOR i IN 1 .. array_length(expected, 1) LOOP
        SELECT data_type, is_nullable INTO found_type, found_null
          FROM information_schema.columns
         WHERE table_name = 'ErezeptEntry' AND column_name = expected[i][1];

        IF found_type IS NULL THEN
            RAISE EXCEPTION 'ErezeptEntry baseline mismatch: column "%" is missing.', expected[i][1];
        END IF;
        IF found_type <> expected[i][2] OR found_null <> expected[i][3] THEN
            RAISE EXCEPTION
                'ErezeptEntry baseline mismatch on "%": expected % / nullable=%, found % / nullable=%.',
                expected[i][1], expected[i][2], expected[i][3], found_type, found_null;
        END IF;
    END LOOP;
END $$;
