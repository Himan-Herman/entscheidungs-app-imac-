-- ConsentRecord.patientUserId had no foreign key in the migration history.
--
-- Found by comparing a database built purely from `prisma migrate deploy`
-- against the development database: the development one had the constraint
-- (added by `prisma db push`), the fresh one did not. Same class of drift as
-- the missing ErezeptEntry table, one level down — a constraint rather than a
-- table, and therefore invisible to a table-level check.
--
-- Additive and idempotent: an environment that already has it is untouched.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ConsentRecord_patientUserId_fkey'
    ) THEN
        -- Refuse rather than silently drop: a row pointing at no user means the
        -- data needs a decision, not a constraint.
        IF EXISTS (
            SELECT 1 FROM "ConsentRecord" c
             LEFT JOIN "User" u ON u."id" = c."patientUserId"
             WHERE u."id" IS NULL
        ) THEN
            RAISE EXCEPTION
                'ConsentRecord.patientUserId: rows reference no user. Refusing to add the foreign key.';
        END IF;

        ALTER TABLE "ConsentRecord"
            ADD CONSTRAINT "ConsentRecord_patientUserId_fkey"
            FOREIGN KEY ("patientUserId") REFERENCES "User"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
