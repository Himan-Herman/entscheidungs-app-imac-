import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import { buildSymptomCheckPrompt } from "../../client/src/pages/prompt/textsymptomPrompt.js";
import { buildSymptomCheckSummaryPrompt } from "../../client/src/pages/prompt/symptomCheckSummaryPrompt.js";
import { parseAndSanitizeSymptomResponse } from "../services/symptomCheck/symptomSummary.js";
import { AI_MODULES } from "../config/aiSafetyPolicy.js";

dotenv.config();
const router = express.Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ASSISTANT_ID = process.env.ASSISTANT_ID;

async function waitForRunCompletion(threadId, runId, timeoutMs = 30000, pollMs = 600) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const run = await openai.beta.threads.runs.retrieve(runId, { thread_id: threadId });
    if (run.status === "completed") return run;
    if (["failed", "cancelled", "expired"].includes(run.status)) {
      throw new Error(`run_${run.status}`);
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error("run_timeout");
}

function extractAssistantText(assistantMsg) {
  if (!assistantMsg || !Array.isArray(assistantMsg.content)) return "";
  return assistantMsg.content
    .filter((p) => p.type === "text" && p.text?.value)
    .map((p) => p.text.value.trim())
    .join("\n\n");
}

function normalizeLocale(value) {
  return value === "en" ? "en" : "de";
}

function isValidThreadId(id) {
  return (
    typeof id === "string" &&
    id.trim() !== "" &&
    id !== "undefined" &&
    id !== "null"
  );
}

function filterMessages(verlauf) {
  return verlauf.filter(
    (m) =>
      m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim(),
  );
}

router.post("/", async (req, res) => {
  const intent = req.body?.intent === "summary" ? "summary" : "chat";
  const locale = normalizeLocale(
    req.body?.patientLanguage || req.body?.uiLocale,
  );
  const organHint =
    typeof req.body?.organHint === "string" && req.body.organHint.trim()
      ? req.body.organHint.trim()
      : null;

  const verlauf = filterMessages(Array.isArray(req.body?.verlauf) ? req.body.verlauf : []);
  if (!verlauf.length) {
    return res.status(400).json({
      ok: false,
      error: "validation_verlauf_required",
      fehler: "validation_verlauf_required",
    });
  }

  try {
    let currentThreadId = isValidThreadId(req.body?.threadId)
      ? req.body.threadId.trim()
      : null;

    if (!currentThreadId) {
      const t = await openai.beta.threads.create();
      currentThreadId = t.id;
    }

    const messagesToAdd =
      intent === "summary" ? verlauf : [verlauf[verlauf.length - 1]];

    const last = messagesToAdd[messagesToAdd.length - 1];
    if (!last || last.role !== "user") {
      return res.status(400).json({
        ok: false,
        error: "validation_last_message_user",
        fehler: "validation_last_message_user",
      });
    }

    for (const msg of messagesToAdd) {
      await openai.beta.threads.messages.create(currentThreadId, {
        role: msg.role,
        content: msg.content.trim(),
      });
    }

    const userTurns =
      intent === "summary"
        ? verlauf.filter((m) => m.role === "user").length
        : Number(req.body?.userTurnCount) ||
          verlauf.filter((m) => m.role === "user").length;

    const instructions =
      intent === "summary"
        ? buildSymptomCheckSummaryPrompt({ locale })
        : buildSymptomCheckPrompt({ userTurns, locale, organHint });

    const run = await openai.beta.threads.runs.create(currentThreadId, {
      assistant_id: ASSISTANT_ID,
      instructions,
    });

    await waitForRunCompletion(run.thread_id, run.id);

    const msgs = await openai.beta.threads.messages.list(currentThreadId, {
      limit: 5,
    });
    const assistantMsg = msgs.data.find((m) => m.role === "assistant");
    const raw = extractAssistantText(assistantMsg) || "";

    const parsed = parseAndSanitizeSymptomResponse(raw, { locale });

    return res.json({
      ok: true,
      antwort: parsed.text,
      summary: parsed.summary,
      threadId: currentThreadId,
      intent,
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "symptom_thread_error",
        module: AI_MODULES.SYMPTOM_CHECK,
        intent,
        message: err?.message || "unknown",
      }),
    );
    return res.status(500).json({
      ok: false,
      error: "symptom_check_failed",
      fehler: "symptom_check_failed",
    });
  }
});

export default router;
