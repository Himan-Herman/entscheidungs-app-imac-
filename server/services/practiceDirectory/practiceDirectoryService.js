/**
 * Internal MedScoutX practice directory.
 *
 * Returns only active MedScoutX practices with public-safe fields.
 * No patient data, no anamnesis, no external providers, no medical evaluation.
 */

import { PrismaClient } from "@prisma/client";
import { parseJsonStringArray } from "../../utils/practiceOrganizationJson.js";

const prisma = new PrismaClient();

const MAX_RESULTS = 100;
const MAX_PARAM_LENGTH = 200;

function trim(v) {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, MAX_PARAM_LENGTH);
}

/**
 * Serialises a PracticeProfile row into the public directory shape.
 * Never exposes userId, patientIntroText, anamnesisEnabled, or internal IDs.
 *
 * @param {object} row  PracticeProfile with optional bookingSettings
 * @returns {object}
 */
function toDirectoryEntry(row) {
  const specialties = parseJsonStringArray(row.specialtiesJson) || [];
  if (row.specialty && !specialties.includes(row.specialty)) {
    specialties.unshift(row.specialty);
  }

  const langs = parseJsonStringArray(row.supportedLanguages) || [];

  const addressParts = [row.street, row.city, row.postalCode].filter(Boolean);
  const resolvedAddress = row.address || (addressParts.length ? addressParts.join(", ") : null);

  const bs = row.bookingSettings;
  const bookingAvailable =
    bs?.bookingEnabled === true && bs?.bookingMode === "medscoutx_request";

  return {
    id: row.id,
    publicSlug: row.publicSlug,
    practiceName: row.displayNameForPatients || row.practiceName,
    specialty: row.specialty || null,
    specialties,
    city: row.city || null,
    postalCode: row.postalCode || null,
    address: resolvedAddress,
    phone: row.phone || null,
    email: row.email || null,
    supportedLanguages: langs,
    bookingAvailable,
  };
}

/**
 * Search active MedScoutX practices.
 *
 * @param {{ q?: string, specialty?: string, city?: string, bookingOnly?: boolean }} params
 * @returns {Promise<{ practices: object[], total: number }>}
 */
export async function searchMedScoutXPractices({ q, specialty, city, bookingOnly } = {}) {
  const qTerm = trim(q);
  const specialtyTerm = trim(specialty);
  const cityTerm = trim(city);

  // Base: only active practices
  const where = { isActive: true };

  // Text search: name, specialty, specialtiesJson (stored as JSON string), city
  if (qTerm) {
    where.OR = [
      { practiceName: { contains: qTerm, mode: "insensitive" } },
      { displayNameForPatients: { contains: qTerm, mode: "insensitive" } },
      { specialty: { contains: qTerm, mode: "insensitive" } },
      { specialtiesJson: { contains: qTerm, mode: "insensitive" } },
      { city: { contains: qTerm, mode: "insensitive" } },
    ];
  }

  // Specialty filter — applied in addition to q
  if (specialtyTerm) {
    const specialtyConditions = [
      { specialty: { contains: specialtyTerm, mode: "insensitive" } },
      { specialtiesJson: { contains: specialtyTerm, mode: "insensitive" } },
    ];
    if (where.OR) {
      // Combine: (q-OR conditions) AND (specialty conditions)
      where.AND = [{ OR: where.OR }, { OR: specialtyConditions }];
      delete where.OR;
    } else {
      where.OR = specialtyConditions;
    }
  }

  // City / postal code filter
  if (cityTerm) {
    const cityConditions = [
      { city: { contains: cityTerm, mode: "insensitive" } },
      { postalCode: { startsWith: cityTerm } },
    ];
    if (where.AND) {
      where.AND.push({ OR: cityConditions });
    } else if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: cityConditions }];
      delete where.OR;
    } else {
      where.OR = cityConditions;
    }
  }

  // Booking filter via relation — only practices with enabled MedScoutX booking
  if (bookingOnly) {
    const bookingCondition = {
      bookingSettings: {
        bookingEnabled: true,
        bookingMode: "medscoutx_request",
      },
    };
    if (where.AND) {
      where.AND.push(bookingCondition);
    } else {
      Object.assign(where, bookingCondition);
    }
  }

  const rows = await prisma.practiceProfile.findMany({
    where,
    select: {
      id: true,
      publicSlug: true,
      practiceName: true,
      displayNameForPatients: true,
      specialty: true,
      specialtiesJson: true,
      city: true,
      postalCode: true,
      address: true,
      street: true,
      phone: true,
      email: true,
      supportedLanguages: true,
      bookingSettings: {
        select: {
          bookingEnabled: true,
          bookingMode: true,
        },
      },
    },
    orderBy: [{ practiceName: "asc" }],
    take: MAX_RESULTS,
  });

  return {
    practices: rows.map(toDirectoryEntry),
    total: rows.length,
  };
}
