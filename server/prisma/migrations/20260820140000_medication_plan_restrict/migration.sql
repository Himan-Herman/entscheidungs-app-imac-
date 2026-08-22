-- A published medication plan must not disappear because a practice closed.
--
-- Before: MedicationPlan.practicePatientLinkId and .practiceProfileId were both
-- ON DELETE CASCADE. Deleting a practice cascaded to its PracticePatientLinks
-- and, through either key, destroyed the plan and its items. That was measured,
-- not assumed: a practice deletion removed a published plan without a trace.
--
-- After: both are ON DELETE RESTRICT. The database refuses, and the application
-- preflight (contextualPatientDataDeletionGuard) reports it as a structured 409
-- before the delete is attempted.
--
-- BOTH keys have to change. Restricting only the link would leave the direct
-- practiceProfileId path cascading, and the plan would still vanish.
--
-- NOT changed:
--   MedicationPlanItem -> MedicationPlan stays CASCADE. Items belong to their
--     plan and to nothing else; deleting a plan through its own domain logic
--     should still take them.
--   MedicationPlan.patientUserId stays CASCADE. Account deletion is a separate
--     lifecycle the patient asks for, and it is meant to erase.
--
-- Data: untouched. Indexes: untouched. Nullability: untouched.

ALTER TABLE "MedicationPlan"
    DROP CONSTRAINT "MedicationPlan_practicePatientLinkId_fkey";
ALTER TABLE "MedicationPlan"
    ADD CONSTRAINT "MedicationPlan_practicePatientLinkId_fkey"
    FOREIGN KEY ("practicePatientLinkId") REFERENCES "PracticePatientLink"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MedicationPlan"
    DROP CONSTRAINT "MedicationPlan_practiceProfileId_fkey";
ALTER TABLE "MedicationPlan"
    ADD CONSTRAINT "MedicationPlan_practiceProfileId_fkey"
    FOREIGN KEY ("practiceProfileId") REFERENCES "PracticeProfile"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
