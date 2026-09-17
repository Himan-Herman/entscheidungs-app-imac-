/**
 * Manual provider smoke test — synthetic content only.
 *
 * Answers one operational question: does the configured endpoint, credential and
 * model actually return a well-formed structured response? It is the step
 * between "the secrets are set" and "we believe the integration works", and it
 * exists so that question is never answered by pointing the feature at a real
 * patient's letter.
 *
 * ── Deliberate properties ───────────────────────────────────────────────────
 * • Not a `*.test.js` file, so `npm test` cannot pick it up. No CI run of this
 *   repository will ever make an external request through it.
 * • Requires an explicit --confirm argument, so it cannot be wired into a
 *   pipeline by accident and cannot be triggered by a stray `npm run`.
 * • Independent of ENABLE_DOCUMENT_TRANSLATION. An operator can verify the
 *   provider while the patient-facing feature stays switched off — which is the
 *   whole point of running it before activation. It does NOT open the patient
 *   route; it constructs the adapter directly.
 * • The input is invented text about an invented person. It is not a document,
 *   it is not derived from one, and it never touches the database or storage.
 * • Prints no key, no host, no model name, and no response text.
 *
 * ── What it does not prove ──────────────────────────────────────────────────
 * That the provider is contractually permitted to process medical documents,
 * that retention is off, or that processing happens in the asserted region.
 * A successful run means the wire works. See
 * docs/production/DOCUMENT_TRANSLATION_ACTIVATION_CHECKLIST.md.
 *
 * Usage:
 *   npm run verify:document-translation-provider -- --confirm
 */

import {
  isDocumentTranslationProviderConfigured,
  resolveDocumentTranslationProvider,
} from "../services/documentTranslation/provider/index.js";
import {
  describeProviderConfig,
  resolveProviderConfig,
} from "../services/documentTranslation/provider/documentTranslationProviderConfig.js";
import { TRANSLATION_MODES } from "../services/documentTranslation/documentTranslationPolicy.js";
import {
  parseProviderPayload,
  validateProviderResponse,
} from "../services/documentTranslation/documentTranslationOutputValidation.js";
import { DOCUMENT_TRANSLATION_PROMPT_VERSIONS } from "../services/documentTranslation/prompts/documentTranslationPrompts.js";

/**
 * Synthetic input, in the shape the real pipeline produces: already extracted,
 * already masked, already segmented. The markers stand in for values the real
 * chain would have removed — which is also why this text is safe: there is no
 * person, no medication and no measurement behind them.
 */
const SYNTHETIC_SEGMENTS = Object.freeze([
  {
    index: 0,
    kind: "heading",
    text: "Testbefund",
    polarity: "neutral",
  },
  {
    index: 1,
    kind: "paragraph",
    text:
      "Dies ist ein synthetischer Testtext ohne personenbezogene Daten. " +
      "Es wurde am ⟦DATE_AAAA⟧ eine Untersuchung durchgefuehrt.",
    polarity: "neutral",
  },
  {
    index: 2,
    kind: "paragraph",
    text: "Kein Hinweis auf eine Auffaelligkeit im Rahmen dieser Testdaten.",
    polarity: "negated",
  },
]);

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.log(
      [
        "This makes a real request to the configured translation provider.",
        "",
        "It sends synthetic text only — no patient data, no document, no database access.",
        "Re-run with --confirm to proceed:",
        "",
        "  npm run verify:document-translation-provider -- --confirm",
        "",
      ].join("\n"),
    );
    process.exitCode = 0;
    return;
  }

  const config = resolveProviderConfig();
  if (!isDocumentTranslationProviderConfigured()) {
    // Variable names and the refusal reason only — never a value.
    console.error("[smoke] provider not configured; nothing was sent.");
    console.error(`[smoke] missing or rejected: ${(config.missing ?? []).join(", ") || "none"}`);
    if (config.reason) console.error(`[smoke] reason: ${config.reason}`);
    process.exitCode = 1;
    return;
  }

  // kind / region / retention only. describeProviderConfig omits the key.
  console.log("[smoke] configuration:", JSON.stringify(describeProviderConfig(config)));
  console.log(
    "[smoke] note: dataRegion and zeroRetention are operator assertions recorded " +
      "in the environment. They are not verified by this script or by any code here.",
  );

  const provider = resolveDocumentTranslationProvider();
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 90_000);

  let failed = false;
  for (const mode of [TRANSLATION_MODES.STRICT, TRANSLATION_MODES.PLAIN]) {
    const label = mode === TRANSLATION_MODES.STRICT ? "strict" : "plain";
    const startedAt = Date.now();
    try {
      const response = await provider.translatePreparedSegments({
        sourceLanguage: "de",
        targetLanguage: mode === TRANSLATION_MODES.STRICT ? "en" : "de",
        mode,
        segments: SYNTHETIC_SEGMENTS,
        signal: controller.signal,
      });

      // The same validation the service applies. A provider that answers 200
      // with a body the schema rejects is a failed smoke test, not a pass.
      const payload = parseProviderPayload(response.raw);
      const segments = validateProviderResponse(payload, SYNTHETIC_SEGMENTS);

      console.log(
        `[smoke] ${label}: ok — ${segments.length} segments, ` +
          `${Date.now() - startedAt} ms, prompt ${DOCUMENT_TRANSLATION_PROMPT_VERSIONS[mode]}`,
      );
      // The returned text is deliberately not printed. It is synthetic here, but
      // a script that prints provider output invites being pointed at something
      // that is not.
    } catch (err) {
      failed = true;
      // Stable code only. A provider message can echo the request back.
      console.error(`[smoke] ${label}: FAILED — ${err?.code ?? err?.name ?? "error"}`);
    }
  }
  clearTimeout(deadline);

  if (failed) {
    process.exitCode = 1;
    return;
  }
  console.log(
    "[smoke] provider reachable and returning valid structured output. " +
      "This does NOT approve activation — see the activation checklist.",
  );
}

await main();
