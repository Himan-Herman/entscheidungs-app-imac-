import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import { buildKoerpersymptomPrompt } from "../../client/src/pages/prompt/koerpersymptomPrompt.js";
import { buildKoerpersymptomSummaryPrompt } from "../../client/src/pages/prompt/koerpersymptomSummaryPrompt.js";
import { parseAndSanitizeBodyMapResponse } from "../services/bodyMap/bodyMapSummary.js";
import { AI_MODULES } from "../config/aiSafetyPolicy.js";

dotenv.config();
const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

if (!process.env.OPENAI_API_KEY) {
  console.warn("[koerpersymptom] OPENAI_API_KEY missing");
}

const ASSISTANT_ID = process.env.ASSISTANT_ID_KOERPERSYMPTOM;

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

router.post("/", async (req, res) => {
  const { verlauf } = req.body;
  const locale = normalizeLocale(req.body?.patientLanguage);
  const intent = req.body?.intent === "summary" ? "summary" : "chat";
  const organName =
    typeof req.body?.organName === "string" && req.body.organName.trim()
      ? req.body.organName.trim()
      : "marked body region";

  if (!Array.isArray(verlauf) || verlauf.length === 0) {
    return res.status(400).json({
      ok: false,
      error: "validation_verlauf_required",
    });
  }

  const messages = verlauf.filter(
    (m) =>
      m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim(),
  );

  if (!messages.length) {
    return res.status(400).json({
      ok: false,
      error: "validation_verlauf_required",
    });
  }

  try {
    const currentThreadId =
      req.body.threadId || (await openai.beta.threads.create()).id;

    for (const msg of messages) {
      await openai.beta.threads.messages.create(currentThreadId, {
        role: msg.role,
        content: msg.content.trim(),
      });
    }

    const userTurns = messages.filter((v) => v.role === "user").length;
    const instructions =
      intent === "summary"
        ? buildKoerpersymptomSummaryPrompt({ organName, locale })
        : buildKoerpersymptomPrompt({ organName, userTurns, locale });

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

    const parsed = parseAndSanitizeBodyMapResponse(raw, {
      locale,
      organLabel: organName,
    });

    return res.json({
      ok: true,
      threadId: currentThreadId,
      antwort: parsed.text,
      summary: parsed.summary,
      intent,
    });
  } catch (e) {
    console.error(
      JSON.stringify({
        event: "koerpersymptom_thread_error",
        module: AI_MODULES.BODY_MAP,
        intent,
        message: e?.message || "unknown",
      }),
    );
    return res.status(500).json({
      ok: false,
      error: "koerpersymptom_failed",
    });
  }
});

export default router;
