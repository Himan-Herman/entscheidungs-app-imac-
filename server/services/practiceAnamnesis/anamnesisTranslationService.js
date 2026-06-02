/**
 * Practice Anamnesis — AI translation service.
 *
 * Translates patient answers from patientLanguage → doctorLanguage.
 * Fires asynchronously after submission is saved. Patient is never blocked.
 *
 * Data sent to AI: question labels + answer text + language codes only.
 * NOT sent: patientInfoJson (name, DOB, insurance), submission IDs, consent data.
 */

import { openai } from "../../openaiClient.js";
import { getOpenAiChatModel } from "../../config/openAiModels.js";
import { PrismaClient } from "@prisma/client";
import {
  buildAnamnesisTranslationSystemPrompt,
  buildAnamnesisTranslationUserMessage,
} from "../../prompts/anamnesisTranslationPrompt.js";
import {
  isTranslatableAnswer,
  answerToTranslatableText,
  parseTranslationResponse,
  translatedTextIsSafe,
  ANAMNESIS_TRANSLATION_BATCH_SIZE,
  ANAMNESIS_TRANSLATION_MAX_TOTAL_CHARS,
  ANAMNESIS_TRANSLATION_MAX_TOKENS,
  ANAMNESIS_TRANSLATION_TIMEOUT_MS,
} from "../../utils/anamnesisTranslationSafety.js";

const prisma = new PrismaClient();

/** @returns {boolean} */
function isTranslationConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/**
 * Splits an array into chunks of size n.
 * @param {T[]} arr
 * @param {number} n
 * @returns {T[][]}
 */
function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/**
 * Translates a single batch of items via OpenAI.
 * Returns null on any error.
 *
 * @param {{ questionId: string, questionLabel: string, value: string }[]} items
 * @param {string} sourceLang
 * @param {string} targetLang
 */
async function translateBatch(items, sourceLang, targetLang) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANAMNESIS_TRANSLATION_TIMEOUT_MS);

  try {
    const completion = await openai.chat.completions.create(
      {
        model: getOpenAiChatModel(),
        messages: [
          { role: "system", content: buildAnamnesisTranslationSystemPrompt(sourceLang, targetLang) },
          { role: "user", content: buildAnamnesisTranslationUserMessage(items, sourceLang, targetLang) },
        ],
        temperature: 0,
        max_tokens: ANAMNESIS_TRANSLATION_MAX_TOKENS,
      },
      { signal: controller.signal },
    );

    const raw = completion.choices[0]?.message?.content?.trim() || "";
    return parseTranslationResponse(raw);
  } catch (err) {
    if (err?.name === "AbortError" || err?.code === "ERR_CANCELED") {
      console.warn("[anamnesisTranslation] API timeout");
    } else {
      console.warn("[anamnesisTranslation] API error:", err?.message || err);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Main entry point — translates a submission and persists the result.
 * Never throws: all errors are caught and stored as translationStatus=failed.
 *
 * @param {string} submissionId
 */
export async function translateAnamnesisSubmission(submissionId) {
  if (!isTranslationConfigured()) {
    await prisma.practiceAnamnesisSubmission.update({
      where: { id: submissionId },
      data: { translationStatus: "unavailable" },
    });
    return;
  }

  let submission;
  try {
    submission = await prisma.practiceAnamnesisSubmission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        patientLanguage: true,
        doctorLanguage: true,
        answersJson: true,
        practiceProfile: { select: { preferredDoctorLanguage: true } },
      },
    });
  } catch (err) {
    console.error("[anamnesisTranslation] DB read failed:", err?.message);
    return;
  }

  if (!submission) return;

  const sourceLang = submission.patientLanguage;
  const targetLang =
    submission.doctorLanguage ||
    submission.practiceProfile?.preferredDoctorLanguage ||
    "de";

  // No translation needed if languages match
  if (sourceLang === targetLang) {
    await prisma.practiceAnamnesisSubmission.update({
      where: { id: submissionId },
      data: { translationStatus: "skipped", translationTargetLanguage: targetLang },
    }).catch(() => {});
    return;
  }

  const answers = Array.isArray(submission.answersJson) ? submission.answersJson : [];

  // Filter to only translatable free-text answers
  const translatableItems = answers
    .filter((a) => isTranslatableAnswer(a))
    .map((a) => ({
      questionId: a.questionId,
      questionLabel: String(a.questionLabel || ""),
      value: answerToTranslatableText(a.value),
    }));

  if (translatableItems.length === 0) {
    await prisma.practiceAnamnesisSubmission.update({
      where: { id: submissionId },
      data: { translationStatus: "skipped", translationTargetLanguage: targetLang },
    }).catch(() => {});
    return;
  }

  // Guard total character budget
  const totalChars = translatableItems.reduce((n, i) => n + i.value.length + i.questionLabel.length, 0);
  if (totalChars > ANAMNESIS_TRANSLATION_MAX_TOTAL_CHARS) {
    console.warn("[anamnesisTranslation] Submission too large to translate:", submissionId);
    await prisma.practiceAnamnesisSubmission.update({
      where: { id: submissionId },
      data: { translationStatus: "failed", translationTargetLanguage: targetLang },
    }).catch(() => {});
    return;
  }

  // Batch into chunks
  const batches = chunk(translatableItems, ANAMNESIS_TRANSLATION_BATCH_SIZE);
  const translationMap = new Map();
  let anyBatchFailed = false;

  for (const batch of batches) {
    const results = await translateBatch(batch, sourceLang, targetLang);
    if (!results) { anyBatchFailed = true; break; }

    for (const r of results) {
      if (!r.questionId) continue;
      // Safety-check translated output
      const safeText = r.translatedText && translatedTextIsSafe(r.translatedText)
        ? r.translatedText
        : null;
      translationMap.set(r.questionId, {
        questionId: r.questionId,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        originalText: r.originalText,
        translatedText: safeText,
        uncertain: r.uncertain || (r.translatedText !== null && safeText === null),
        notes: r.notes,
      });
    }
  }

  if (anyBatchFailed) {
    await prisma.practiceAnamnesisSubmission.update({
      where: { id: submissionId },
      data: { translationStatus: "failed", translationTargetLanguage: targetLang },
    }).catch(() => {});
    return;
  }

  // Build translatedAnswersJson: same structure as answersJson, add translatedText per item
  const translatedAnswersJson = answers.map((a) => {
    const tr = translationMap.get(a.questionId);
    if (!tr) return { ...a, translatedText: null, translationUncertain: false };
    return {
      ...a,
      translatedText: tr.translatedText,
      translationUncertain: tr.uncertain,
      translationNotes: tr.notes?.length ? tr.notes : undefined,
    };
  });

  try {
    await prisma.practiceAnamnesisSubmission.update({
      where: { id: submissionId },
      data: {
        translatedAnswersJson,
        translationStatus: "completed",
        translatedAt: new Date(),
        translationTargetLanguage: targetLang,
      },
    });
  } catch (err) {
    console.error("[anamnesisTranslation] DB write failed:", err?.message);
    await prisma.practiceAnamnesisSubmission.update({
      where: { id: submissionId },
      data: { translationStatus: "failed", translationTargetLanguage: targetLang },
    }).catch(() => {});
  }
}
