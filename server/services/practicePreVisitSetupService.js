import { prisma } from "../lib/prisma.js";
import {
  isPracticeAnamnesisEnabled,
  isPracticeBookingEnabled,
} from "../config/featureFlags.js";
import {
  canManageAnamnesis,
  canReadAnamnesis,
  canManageBooking,
  canReadBooking,
} from "../utils/practicePermissions.js";


const MAX_TEMPLATES = 50;

/**
 * Practice-side appointment-preparation setup overview.
 *
 * Read-only, organizational metadata only — surfaces which preparation modules
 * are active and which anamnesis templates exist, so the practice can open the
 * EXISTING preparation flows (/practice/anamnesis, /practice/booking).
 *
 * Returns NO patient data, NO medical free-text, NO question/answer content,
 * NO PDF content, NO chat. Template `titleJson` is the practice-authored
 * organizational label only; question/section texts are never loaded.
 *
 * @param {string} practiceProfileId
 * @param {string} role
 */
export async function getPracticePreVisitSetup(practiceProfileId, role) {
  const pid = String(practiceProfileId || "").trim();
  if (!pid) throw new Error("practiceId_required");

  const anamnesisModule = isPracticeAnamnesisEnabled();
  const bookingModule = isPracticeBookingEnabled();

  const [practice, templateRows, activeTemplateCount, totalTemplateCount, bookingSettings] =
    await Promise.all([
      prisma.practiceProfile.findUnique({
        where: { id: pid },
        select: { anamnesisEnabled: true },
      }),
      anamnesisModule
        ? prisma.practiceAnamnesisTemplate.findMany({
            where: { practiceProfileId: pid },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            take: MAX_TEMPLATES,
            // Minimal selection — title is an organizational label; counts are
            // structural only. No section/question texts, no patient content.
            select: {
              id: true,
              titleJson: true,
              status: true,
              updatedAt: true,
              _count: { select: { sections: true, questions: true, links: true } },
            },
          })
        : Promise.resolve([]),
      anamnesisModule
        ? prisma.practiceAnamnesisTemplate.count({
            where: { practiceProfileId: pid, status: "active" },
          })
        : Promise.resolve(0),
      anamnesisModule
        ? prisma.practiceAnamnesisTemplate.count({ where: { practiceProfileId: pid } })
        : Promise.resolve(0),
      bookingModule
        ? prisma.practiceBookingSettings.findUnique({
            where: { practiceProfileId: pid },
            select: { bookingEnabled: true, bookingMode: true },
          })
        : Promise.resolve(null),
    ]);

  const templates = templateRows.map((t) => ({
    id: t.id,
    titleJson: t.titleJson,
    status: t.status,
    sectionCount: t._count.sections,
    questionCount: t._count.questions,
    linkCount: t._count.links,
    updatedAt: t.updatedAt,
  }));

  return {
    anamnesis: {
      moduleEnabled: Boolean(anamnesisModule),
      practiceEnabled: Boolean(practice?.anamnesisEnabled),
      canRead: canReadAnamnesis(role),
      canManage: canManageAnamnesis(role),
      templateCount: totalTemplateCount,
      activeTemplateCount,
      templates,
    },
    booking: {
      moduleEnabled: Boolean(bookingModule),
      bookingEnabled: Boolean(bookingSettings?.bookingEnabled),
      bookingMode: bookingSettings?.bookingMode || "disabled",
      canRead: canReadBooking(role),
      canManage: canManageBooking(role),
    },
    entryPoints: {
      anamnesis: Boolean(anamnesisModule) && canReadAnamnesis(role),
      booking: Boolean(bookingModule) && canReadBooking(role),
    },
  };
}
