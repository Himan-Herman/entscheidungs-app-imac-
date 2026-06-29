/**
 * Internal MedScoutX practice directory.
 *
 * Returns only active MedScoutX practices with public-safe fields.
 * No patient data, no anamnesis, no external providers, no medical evaluation.
 */

import { prisma } from "../../lib/prisma.js";
import { parseJsonStringArray } from "../../utils/practiceOrganizationJson.js";


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
 * Normalise a list of requested language codes (e.g. ["de","TR"," ar "]).
 * Lowercased, 2–8 chars, deduped, capped. Returns [] for invalid/empty input.
 *
 * @param {string[] | string | undefined} input
 * @returns {string[]}
 */
function normaliseLanguages(input) {
  const arr = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(",")
      : [];
  const seen = new Set();
  for (const raw of arr) {
    const code = String(raw || "").trim().toLowerCase();
    if (code.length >= 2 && code.length <= 8 && /^[a-z-]+$/.test(code)) seen.add(code);
    if (seen.size >= 10) break;
  }
  return [...seen];
}

/**
 * Search active MedScoutX practices.
 *
 * @param {{ q?: string, specialty?: string, city?: string, bookingOnly?: boolean,
 *           languages?: string[] | string }} params
 *   languages — practice must list AT LEAST ONE of the requested languages (OR) in its profile.
 * @returns {Promise<{ practices: object[], total: number }>}
 */
export async function searchMedScoutXPractices({ q, specialty, city, bookingOnly, languages } = {}) {
  const qTerm = trim(q);
  const specialtyTerm = trim(specialty);
  const cityTerm = trim(city);
  const languageTerms = normaliseLanguages(languages);

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

  // Language filter — practice must list AT LEAST ONE of the requested codes (OR within the
  // language selection). The OR group is then AND-combined with the other filters. Codes are
  // stored quoted in the supportedLanguages JSON string (e.g. ["de","tr"]), so we match "<code>".
  if (languageTerms.length > 0) {
    const langGroup = {
      OR: languageTerms.map((code) => ({
        supportedLanguages: { contains: `"${code}"`, mode: "insensitive" },
      })),
    };
    if (where.AND) {
      where.AND.push(langGroup);
    } else if (where.OR) {
      where.AND = [{ OR: where.OR }, langGroup];
      delete where.OR;
    } else {
      where.AND = [langGroup];
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
