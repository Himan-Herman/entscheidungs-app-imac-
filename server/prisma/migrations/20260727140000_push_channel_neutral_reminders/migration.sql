-- Medication reminders become channel-neutral and user-owned.
-- Non-destructive: one constraint is RELAXED, two columns/tables are ADDED.
-- No DROP of data, no DELETE, no UPDATE of existing rows.

-- 1) A reminder no longer requires a web-push subscription to exist.
ALTER TABLE "PushReminder" ALTER COLUMN "subscriptionId" DROP NOT NULL;

-- 2) The timezone used to live on PushSubscription; a reminder without one needs its own.
ALTER TABLE "PushReminder" ADD COLUMN "timezone" TEXT;

-- 3) Deleting a web subscription must no longer delete the patient's reminders.
ALTER TABLE "PushReminder" DROP CONSTRAINT IF EXISTS "PushReminder_subscriptionId_fkey";
ALTER TABLE "PushReminder"
  ADD CONSTRAINT "PushReminder_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "PushSubscription"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 4) Which channels a patient uses, so web push can stay quiet when the app handles it.
CREATE TABLE "PushChannelState" (
  "userId"        TEXT NOT NULL,
  "nativeEnabled" BOOLEAN NOT NULL DEFAULT false,
  "webEnabled"    BOOLEAN NOT NULL DEFAULT true,
  "nativeSeenAt"  TIMESTAMP(3),
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushChannelState_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "PushChannelState"
  ADD CONSTRAINT "PushChannelState_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
