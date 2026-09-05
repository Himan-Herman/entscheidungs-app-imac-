-- Repair one missing invariant, then finish the cardinality model.
--
-- WHY THIS EXISTS
-- ---------------
-- 20260518120000 created a hand-written partial unique index that keeps a
-- practice from holding two LIVE links to the same account. Production never
-- ran that statement: 51 of the 93 migrations are recorded with
-- applied_steps_count = 0, so the schema there was built from schema.prisma --
-- which cannot express a partial index -- and every Prisma-derived object
-- arrived while every hand-written one did not. A read-only audit confirmed
-- this index is the only such artefact still missing.
--
-- The second half is the change this repair was originally scheduled for: the
-- three-column unique has no status predicate, so for a REPRESENTED person
-- (patientProfileId NOT NULL) it forbids not just a second live link but every
-- second row -- a practice and a represented patient can be linked exactly once,
-- forever, and a revoked relationship can never be re-established. The two
-- partial indexes below say the same thing for both representations:
--
--   at most one link with status IN ('invited','active') per
--   (practice, account, subject), and any number of terminal ones.
--
-- REPLAY SAFETY
-- -------------
-- This runs on two legitimate starting points: production, where the SELF index
-- is absent, and any canonically migrated database, where it already exists.
-- Step 1 therefore verifies STRUCTURE, not existence. `CREATE UNIQUE INDEX IF
-- NOT EXISTS` would accept a same-named index with the wrong columns or the
-- wrong predicate, and an index that only pretends to protect something is
-- worse than one that is missing.
--
-- Order is not negotiable: the SELF guarantee must stand BEFORE the global
-- unique is dropped. Dropping first would leave SELF unprotected for the rest
-- of the transaction, and a crash in between would leave it unprotected for
-- good. Prisma wraps each migration in one transaction, so a failure anywhere
-- below rolls the whole thing back.

-- STEP 1 -- SELF: repair if absent, accept if correct, refuse if wrong.
DO $$
DECLARE
    idx      oid;
    is_uniq  boolean;
    cols     text[];
    pred     text;
    want_pred CONSTANT text :=
      '(("patientProfileId" IS NULL) AND (status = ANY (ARRAY[''invited''::text, ''active''::text])))';
BEGIN
    SELECT i.indexrelid, i.indisunique,
           (SELECT array_agg(a.attname::text ORDER BY k.ord)
              FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
              JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum),
           pg_get_expr(i.indpred, i.indrelid)
      INTO idx, is_uniq, cols, pred
      FROM pg_index i
      JOIN pg_class     c ON c.oid = i.indexrelid
      JOIN pg_class     t ON t.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = 'PracticePatientLink_practice_patient_active_no_profile_key';

    IF idx IS NULL THEN
        -- Production. Create it, and let a duplicate in the data abort the
        -- whole migration rather than be silently tolerated.
        CREATE UNIQUE INDEX "PracticePatientLink_practice_patient_active_no_profile_key"
            ON "PracticePatientLink"("practiceProfileId", "patientUserId")
            WHERE "patientProfileId" IS NULL AND "status" IN ('invited', 'active');
        RAISE NOTICE 'SELF partial unique index created (was missing)';
    ELSE
        -- Canonical. Accept only if it is exactly the index we would have made.
        IF (SELECT t.relname FROM pg_class c JOIN pg_class t ON t.oid =
              (SELECT indrelid FROM pg_index WHERE indexrelid = idx)
             WHERE c.oid = idx) <> 'PracticePatientLink' THEN
            RAISE EXCEPTION 'SELF index exists on the wrong table';
        END IF;
        IF NOT is_uniq THEN
            RAISE EXCEPTION 'SELF index exists but is not UNIQUE';
        END IF;
        IF cols IS DISTINCT FROM ARRAY['practiceProfileId','patientUserId'] THEN
            RAISE EXCEPTION 'SELF index has unexpected key columns: %', cols;
        END IF;
        IF replace(replace(COALESCE(pred, ''), ' ', ''), E'\n', '')
           IS DISTINCT FROM replace(replace(want_pred, ' ', ''), E'\n', '') THEN
            RAISE EXCEPTION 'SELF index has an unexpected predicate: %', pred;
        END IF;
        RAISE NOTICE 'SELF partial unique index already correct (no-op)';
    END IF;
END $$;

-- STEP 2 -- the SELF guarantee must now stand. Confirm before touching anything.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_index i
          JOIN pg_class     c ON c.oid = i.indexrelid
          JOIN pg_class     t ON t.oid = i.indrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
         WHERE n.nspname = 'public'
           AND t.relname = 'PracticePatientLink'
           AND c.relname = 'PracticePatientLink_practice_patient_active_no_profile_key'
           AND i.indisunique
           AND i.indpred IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'SELF invariant not in place after step 1 -- refusing to continue';
    END IF;
END $$;

-- STEP 3 -- the global unique must be exactly what we expect before we drop it.
DO $$
DECLARE
    is_uniq boolean;
    cols    text[];
    pred    text;
BEGIN
    SELECT i.indisunique,
           (SELECT array_agg(a.attname::text ORDER BY k.ord)
              FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
              JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum),
           pg_get_expr(i.indpred, i.indrelid)
      INTO is_uniq, cols, pred
      FROM pg_index i
      JOIN pg_class     c ON c.oid = i.indexrelid
      JOIN pg_class     t ON t.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
       AND t.relname = 'PracticePatientLink'
       AND c.relname = 'PracticePatientLink_practiceProfileId_patientUserId_patient_key';

    IF is_uniq IS NULL THEN
        RAISE EXCEPTION 'the global unique index is missing -- unexpected state, refusing';
    END IF;
    IF NOT is_uniq THEN
        RAISE EXCEPTION 'the global index is not UNIQUE -- unexpected state, refusing';
    END IF;
    IF cols IS DISTINCT FROM
       ARRAY['practiceProfileId','patientUserId','patientProfileId'] THEN
        RAISE EXCEPTION 'the global unique has unexpected key columns: %', cols;
    END IF;
    IF pred IS NOT NULL THEN
        RAISE EXCEPTION 'the global unique unexpectedly has a predicate: %', pred;
    END IF;
END $$;

-- STEP 4 -- the REPRESENTED name must be free, or hold exactly our index.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relname = 'PracticePatientLink_live_link_with_profile_key'
    ) THEN
        RAISE EXCEPTION
          'PracticePatientLink_live_link_with_profile_key already exists -- refusing to replace it';
    END IF;
END $$;

-- STEP 5 -- drop the global unique. Only now, and only after 1-4 passed.
DROP INDEX "PracticePatientLink_practiceProfileId_patientUserId_patient_key";

-- STEP 6 -- REPRESENTED: the symmetric counterpart of the SELF index.
-- Deliberately NOT CONCURRENTLY: that cannot run inside a transaction, and the
-- all-or-nothing property above is worth more than the brief write lock on a
-- table this small.
CREATE UNIQUE INDEX "PracticePatientLink_live_link_with_profile_key"
    ON "PracticePatientLink"("practiceProfileId", "patientUserId", "patientProfileId")
    WHERE "patientProfileId" IS NOT NULL AND "status" IN ('invited', 'active');
