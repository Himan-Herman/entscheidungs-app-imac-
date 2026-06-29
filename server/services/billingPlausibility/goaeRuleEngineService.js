/**
 * Billing-3 — deterministic GOÄ plausibility RULE ENGINE.
 *
 * Pure, rule-based, NO AI, NO EBM. Produces neutral plausibility HINTS only —
 * never a billing decision, never "automatically correct/billable", never a
 * recommendation to add codes or maximise revenue, no € potential.
 *
 * Data-safety: input is reduced to { code, factor, quantity } before evaluation.
 * Output (findings/normalizedItems/metadata) contains NO patient data, NO free-text
 * and NO clinical content — only codes, parsed numbers and rule/severity identifiers.
 */
import { prisma } from "../../lib/prisma.js";
import { findGoaeEntry } from "./goaeCatalogueService.js";
import {
  GOAE_CATALOGUE_META,
  GOAE_FACTOR_THRESHOLDS,
} from "../../data/goaeCatalogue.js";


export const RULE_SEVERITY = Object.freeze({
  INFO: "info",
  WARNING: "warning",
  REVIEW: "review_required",
});

/** Lower bound of the GOÄ factor band (§ 5). */
const MIN_FACTOR = 1.0;

/** @param {unknown} raw → number | null (accepts "2,3" or "2.3"). */
function parseFactor(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = parseFloat(String(raw).trim().replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

/** @param {unknown} raw → integer ≥ 1 | null. */
function parseQuantity(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const s = String(raw).trim();
  if (!/^-?\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return Number.isNaN(n) || n < 1 ? null : n;
}

/**
 * PURE deterministic evaluation. No DB / no I/O — fully unit-testable.
 *
 * @param {{
 *   items: Array<{ code?: unknown, factor?: unknown, quantity?: unknown }>,
 *   lookup: (code: string) => ({ points?: number|null, completenessStatus?: string|null }) | null,
 *   catalogueBase: { available: boolean, label?: string, completeness?: string }
 * }} input
 */
export function evaluateGoaeItems(input) {
  const items = Array.isArray(input?.items) ? input.items : [];
  const lookup = typeof input?.lookup === "function" ? input.lookup : () => null;
  const catalogueBase = input?.catalogueBase || { available: false };

  const findings = [];
  const add = (index, code, ruleId, severity, messageKey, metadata) =>
    findings.push({
      index,
      code: code || null,
      ruleId,
      severity,
      messageKey,
      metadata: metadata || {},
    });

  // ── Catalogue-base hint (emitted once) ──────────────────────────────────────
  if (catalogueBase.available !== true) {
    add(null, null, "catalogue_base_missing", RULE_SEVERITY.INFO, "ruleCatalogueBaseMissing", {});
  } else if (
    typeof catalogueBase.completeness === "string" &&
    /initial|limit|subset|test/i.test(catalogueBase.completeness)
  ) {
    add(null, null, "catalogue_base_initial", RULE_SEVERITY.INFO, "ruleCatalogueBaseInitial", {
      completeness: catalogueBase.completeness,
    });
  }

  const normalizedItems = items.map((raw, index) => {
    const code = String(raw?.code ?? "").trim();
    const factor = parseFactor(raw?.factor);
    const quantity = parseQuantity(raw?.quantity);
    const factorProvided =
      raw?.factor !== undefined && raw?.factor !== null && String(raw?.factor ?? "").trim() !== "";

    if (!code) {
      add(index, null, "code_missing", RULE_SEVERITY.WARNING, "ruleCodeMissing", {});
    } else {
      const entry = lookup(code);
      if (!entry) {
        add(index, code, "code_not_found", RULE_SEVERITY.WARNING, "ruleCodeNotFound", {});
      } else {
        if (entry.points === null || entry.points === undefined) {
          add(index, code, "points_missing", RULE_SEVERITY.REVIEW, "rulePointsMissing", {});
        }
        if (entry.completenessStatus === "needs-review") {
          add(index, code, "entry_needs_review", RULE_SEVERITY.REVIEW, "ruleEntryNeedsReview", {});
        } else if (entry.completenessStatus === "points-uncertain") {
          add(index, code, "entry_points_uncertain", RULE_SEVERITY.INFO, "ruleEntryPointsUncertain", {});
        }
      }
    }

    // Factor band (global § 5 thresholds — no per-code min/max stored).
    if (factorProvided && factor === null) {
      add(index, code, "factor_invalid", RULE_SEVERITY.WARNING, "ruleFactorInvalid", {});
    } else if (factor !== null) {
      if (factor < MIN_FACTOR) {
        add(index, code, "factor_below_min", RULE_SEVERITY.INFO, "ruleFactorBelowMin", {
          factor,
          min: MIN_FACTOR,
        });
      } else if (factor > GOAE_FACTOR_THRESHOLDS.MAX_MEDICAL) {
        add(index, code, "factor_above_max", RULE_SEVERITY.REVIEW, "ruleFactorAboveMax", {
          factor,
          max: GOAE_FACTOR_THRESHOLDS.MAX_MEDICAL,
        });
      } else if (factor > GOAE_FACTOR_THRESHOLDS.JUSTIFICATION_THRESHOLD) {
        add(index, code, "factor_above_threshold", RULE_SEVERITY.WARNING, "ruleFactorAboveThreshold", {
          factor,
          threshold: GOAE_FACTOR_THRESHOLDS.JUSTIFICATION_THRESHOLD,
        });
      }
    }

    // Quantity must be a positive integer.
    if (quantity === null) {
      add(index, code, "quantity_invalid", RULE_SEVERITY.WARNING, "ruleQuantityInvalid", {});
    }

    return { index, code, factor, quantity };
  });

  const summary = {
    itemCount: normalizedItems.length,
    findingCount: findings.length,
    bySeverity: {
      info: findings.filter((f) => f.severity === RULE_SEVERITY.INFO).length,
      warning: findings.filter((f) => f.severity === RULE_SEVERITY.WARNING).length,
      review_required: findings.filter((f) => f.severity === RULE_SEVERITY.REVIEW).length,
    },
  };

  return { normalizedItems, findings, catalogueBase, summary };
}

/**
 * Resolve the lookup + base from the ACTIVE DB catalogue version when available,
 * otherwise fall back to the bundled reference subset. Never throws on a missing
 * table / unavailable DB (e.g. before the Billing-2 migration is deployed).
 */
export async function resolveActiveGoaeCatalogue() {
  try {
    const version = await prisma.goaeCatalogueVersion.findFirst({
      where: { status: "active", codeSystem: "GOAE" },
      orderBy: { createdAt: "desc" },
      select: { id: true, label: true, completeness: true },
    });
    if (version) {
      const items = await prisma.goaeCatalogueItem.findMany({
        where: { versionId: version.id },
        select: { code: true, points: true, completenessStatus: true },
      });
      if (items.length) {
        const map = new Map(items.map((i) => [i.code, i]));
        return {
          catalogueBase: {
            available: true,
            label: version.label,
            completeness: version.completeness,
            source: "db",
          },
          lookup: (code) => map.get(code) || null,
        };
      }
    }
  } catch {
    // table not migrated / DB unavailable → bundled fallback below.
  }
  return {
    catalogueBase: {
      available: false,
      completeness: GOAE_CATALOGUE_META.catalogueCompleteness || "test-subset-only",
      source: "bundled",
    },
    lookup: (code) => {
      const e = findGoaeEntry(code);
      return e.found ? e : null;
    },
  };
}

/**
 * Orchestrator: resolve the active catalogue, then run the pure evaluation.
 * Input items are reduced to { code, factor, quantity } — no note/free-text passes through.
 * @param {Array<{ code?: unknown, factor?: unknown, quantity?: unknown }>} items
 */
export async function runGoaePlausibilityCheck(items) {
  const { lookup, catalogueBase } = await resolveActiveGoaeCatalogue();
  const safeItems = (Array.isArray(items) ? items : []).map((i) => ({
    code: i?.code,
    factor: i?.factor,
    quantity: i?.quantity,
  }));
  return evaluateGoaeItems({ items: safeItems, lookup, catalogueBase });
}
