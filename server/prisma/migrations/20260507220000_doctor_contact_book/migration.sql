-- CreateTable
CREATE TABLE "DoctorContact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "doctorName" TEXT NOT NULL,
    "practiceName" TEXT,
    "specialty" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DoctorContact_userId_idx" ON "DoctorContact"("userId");

-- AddForeignKey
ALTER TABLE "DoctorContact" ADD CONSTRAINT "DoctorContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
