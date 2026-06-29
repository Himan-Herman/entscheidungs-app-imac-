/**
 * Billing-2 seed — OPTIONAL initial / internal / limited GOÄ catalogue base.
 *
 * This is NOT a complete or authoritative GOÄ catalogue. It loads the existing
 * hand-curated subset from ../data/goaeCatalogue.js (provenance + per-entry
 * completenessStatus preserved) into a single ACTIVE GoaeCatalogueVersion clearly
 * labelled "initial-internal-subset". Points/titles must be verified against the
 * official GOÄ text before any billing use.
 *
 * Reference data only — no patient data, no billing records.
 * Idempotent: skips if an active "initial-internal-subset" GOÄ version already exists.
 *
 * Run MANUALLY (e.g. once on Render after `npx prisma migrate deploy`):
 *   node server/scripts/seedGoaeCatalogue.js
 */
import { prisma } from "../lib/prisma.js";
import { GOAE_ENTRIES, GOAE_CATALOGUE_META } from "../data/goaeCatalogue.js";

const LABEL = "initial-internal-subset";

async function main() {
  const existing = await prisma.goaeCatalogueVersion.findFirst({
    where: { codeSystem: "GOAE", label: LABEL },
  });
  if (existing) {
    console.log(
      `[seedGoaeCatalogue] version "${LABEL}" already exists (${existing.id}) — skipping (idempotent).`,
    );
    return;
  }

  const version = await prisma.goaeCatalogueVersion.create({
    data: {
      codeSystem: "GOAE",
      label: LABEL,
      status: "active",
      completeness: "initial-internal-subset",
      source: GOAE_CATALOGUE_META.sourceName ?? null,
      sourceUrl: GOAE_CATALOGUE_META.sourceUrl ?? null,
      notes:
        "Initial internal/limited GOÄ subset — NOT a complete or authoritative catalogue. " +
        "Points/titles must be verified against the official GOÄ text before billing use.",
    },
  });

  let inserted = 0;
  for (const e of GOAE_ENTRIES) {
    await prisma.goaeCatalogueItem.create({
      data: {
        versionId: version.id,
        code: String(e.ziffer ?? "").trim(),
        title: String(e.title ?? ""),
        points: typeof e.points === "number" ? e.points : null,
        section: e.section ?? null,
        activeStatus: e.activeStatus ?? null,
        completenessStatus: e.completenessStatus ?? null,
        sourceName: e.sourceName ?? null,
        sourceUrl: e.sourceUrl ?? null,
        sourceReference: e.sourceLineOrReference ?? null,
        sourceVersionDate: e.sourceVersionDate ?? null,
        notes: e.notes ?? null,
      },
    });
    inserted += 1;
  }

  console.log(
    `[seedGoaeCatalogue] created active version ${version.id} ("${LABEL}", initial-internal-subset) with ${inserted} items.`,
  );
}

main()
  .catch((err) => {
    console.error("[seedGoaeCatalogue] failed:", err?.message ?? err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
