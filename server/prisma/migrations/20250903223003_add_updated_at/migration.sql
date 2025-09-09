-- RedefineTables (SQLite)
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- WICHTIG: Default, damit bestehende Zeilen einen Wert bekommen
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" DATETIME,
    "verificationTokenHash" TEXT,
    "verificationTokenExpires" DATETIME
);

-- updatedAt NICHT aus alter Tabelle selektieren -> Default greift
INSERT INTO "new_User" (
    "id","email","passwordHash","firstName","lastName",
    "dateOfBirth","createdAt","emailVerified","verifiedAt",
    "verificationTokenHash","verificationTokenExpires"
)
SELECT
    "id","email","passwordHash","firstName","lastName",
    "dateOfBirth","createdAt","emailVerified","verifiedAt",
    "verificationTokenHash","verificationTokenExpires"
FROM "User";

DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
