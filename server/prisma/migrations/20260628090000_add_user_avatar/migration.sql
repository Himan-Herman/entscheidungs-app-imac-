-- AlterTable: optional self-uploaded patient profile picture.
-- Both columns are nullable and additive (no data migration / backfill needed).
ALTER TABLE "public"."UserProfile" ADD COLUMN "avatarStorageKey" TEXT;
ALTER TABLE "public"."UserProfile" ADD COLUMN "avatarMimeType" TEXT;
