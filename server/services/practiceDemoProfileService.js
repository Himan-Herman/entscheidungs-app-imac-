import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const DEMO_PRACTICE_NAME = "Medscout Klinik";

/** Demo profile for empty accounts — on by default; set PRACTICE_DEMO_PROFILE_ENABLED=false to disable. */
export function isPracticeDemoProfileEnabled() {
  return process.env.PRACTICE_DEMO_PROFILE_ENABLED !== "false";
}

function demoSlugForUser(userId) {
  const safe = String(userId || "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase()
    .slice(0, 12);
  return `medscout-klinik-${safe || "demo"}`;
}

/**
 * Creates a test practice profile for the user when they have none yet.
 * Idempotent per user (by name or slug).
 */
export async function ensureDemoPracticeProfileForUser(userId) {
  if (!isPracticeDemoProfileEnabled() || !userId) return null;

  const accessWhere = {
    OR: [{ userId }, { members: { some: { userId, status: "active" } } }],
  };

  const existingDemo = await prisma.practiceProfile.findFirst({
    where: {
      ...accessWhere,
      practiceName: DEMO_PRACTICE_NAME,
    },
  });
  if (existingDemo) return existingDemo;

  const count = await prisma.practiceProfile.count({ where: accessWhere });
  if (count > 0) return null;

  const publicSlug = demoSlugForUser(userId);

  try {
    return await prisma.practiceProfile.create({
      data: {
        userId,
        practiceName: DEMO_PRACTICE_NAME,
        publicSlug,
        preferredDoctorLanguage: "de",
        specialty: "Allgemeinmedizin",
        patientIntroText:
          "Demo-Praxisprofil zum Testen von MedScoutX — nur für Entwicklung und Tests.",
        isActive: true,
        members: {
          create: {
            userId,
            role: "owner",
            status: "active",
            acceptedAt: new Date(),
          },
        },
      },
    });
  } catch (err) {
    if (err?.code === "P2002") {
      return prisma.practiceProfile.findFirst({
        where: { publicSlug, userId },
      });
    }
    throw err;
  }
}
