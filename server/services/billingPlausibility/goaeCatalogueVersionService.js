import { prisma } from "../../lib/prisma.js";


/**
 * Read the active GOÄ catalogue version (reference metadata + item count only).
 *
 * Returns null when no active version exists yet (e.g. before the optional seed
 * has been run). Reference data only — NO patient data, NO billing records, NO
 * clinical free-text, no internal-only fields beyond stable metadata.
 *
 * @returns {Promise<null | {
 *   id: string, codeSystem: string, label: string, status: string,
 *   completeness: string, source: string|null, sourceUrl: string|null,
 *   validFrom: Date|null, validTo: Date|null, updatedAt: Date, itemCount: number
 * }>}
 */
export async function getActiveGoaeCatalogueVersion() {
  const version = await prisma.goaeCatalogueVersion.findFirst({
    where: { status: "active", codeSystem: "GOAE" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      codeSystem: true,
      label: true,
      status: true,
      completeness: true,
      source: true,
      sourceUrl: true,
      validFrom: true,
      validTo: true,
      updatedAt: true,
    },
  });
  if (!version) return null;

  const itemCount = await prisma.goaeCatalogueItem.count({
    where: { versionId: version.id },
  });

  return { ...version, itemCount };
}
