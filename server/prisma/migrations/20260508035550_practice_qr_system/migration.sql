-- CreateTable
CREATE TABLE "public"."PracticeProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "practiceName" TEXT NOT NULL,
    "publicSlug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "specialty" TEXT,
    "preferredDoctorLanguage" TEXT NOT NULL DEFAULT 'de',
    "patientIntroText" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PracticeProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PracticeQrTarget" (
    "id" TEXT NOT NULL,
    "practiceProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "targetName" TEXT NOT NULL,
    "targetType" TEXT NOT NULL DEFAULT 'practice',
    "doctorName" TEXT,
    "specialty" TEXT,
    "recipientEmail" TEXT,
    "preferredDoctorLanguage" TEXT,
    "qrToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PracticeQrTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PracticeProfile_publicSlug_key" ON "public"."PracticeProfile"("publicSlug");

-- CreateIndex
CREATE INDEX "PracticeProfile_userId_idx" ON "public"."PracticeProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeQrTarget_qrToken_key" ON "public"."PracticeQrTarget"("qrToken");

-- CreateIndex
CREATE INDEX "PracticeQrTarget_practiceProfileId_idx" ON "public"."PracticeQrTarget"("practiceProfileId");

-- AddForeignKey
ALTER TABLE "public"."PracticeProfile" ADD CONSTRAINT "PracticeProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PracticeQrTarget" ADD CONSTRAINT "PracticeQrTarget_practiceProfileId_fkey" FOREIGN KEY ("practiceProfileId") REFERENCES "public"."PracticeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
