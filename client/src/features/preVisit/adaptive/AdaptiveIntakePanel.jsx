import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { getAdaptiveCategoryConfig } from "./adaptiveCategories.js";
import {
  compactAdaptiveContext,
  getAdaptiveSlice,
} from "./adaptiveSessionUtils.js";
import { sanitizeSafetyFlags } from "./adaptivePromptRules.js";

const AdaptiveIntakePanel = forwardRef(function AdaptiveIntakePanel(
  {
    categoryKey,
    categoryTitle,
    session,
    setSession,
    patientLanguage,
    labels,
    onFinished,
    onExitStep,
    onSkipStep,
    onBusyChange,
  },
  ref
) {
  const cfg = getAdaptiveCategoryConfig(categoryKey);
  const slice = useMemo(
    () => getAdaptiveSlice(session, categoryKey),
    [session, categoryKey]
  );
  const [replyDraft, setReplyDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  const persistSlice = useCallback(
    (nextSlice) => {
      setSession((prev) => ({
        ...prev,
        intakeV1: {
          schemaVersion: 2,
          ...prev.intakeV1,
          [categoryKey]: nextSlice,
        },
      }));
    },
    [categoryKey, setSession]
  );

  useImperativeHandle(
    ref,
    () => ({
      appendDictatedText(snippet) {
        const s = String(snippet || "").trim();
        if (!s) return;
        if (slice.currentQuestion) {
          setReplyDraft((d) => (String(d || "").trim() ? `${String(d).trim()} ${s}` : s));
          return;
        }
        const merged = String(slice.compiledAnswer || "").trim()
          ? `${String(slice.compiledAnswer || "").trim()} ${s}`
          : s;
        persistSlice({
          ...slice,
          compiledAnswer: merged,
          status: "active",
        });
      },
    }),
    [persistSlice, slice]
  );

  const callAdaptive = useCallback(
    async (currentReply, previousReplies) => {
      const payload = {
        patientLanguage,
        categoryKey,
        categoryTitle,
        existingCategoryAnswer: String(slice.compiledAnswer || "").slice(0, 2000),
        currentPatientReply: String(currentReply || "").slice(0, 2000),
        previousReplies: Array.isArray(previousReplies)
          ? previousReplies.map((r) => String(r || "").slice(0, 640)).slice(0, 8)
          : [],
        recentQuestions: Array.isArray(slice.askedQuestions)
          ? slice.askedQuestions.map((q) => String(q || "").slice(0, 160)).slice(-8)
          : [],
        maxFollowups: Number(cfg?.maxFollowups || 2),
        previousSessionContext:
          sessionRef.current?.caseTimeline?.summary &&
          sessionRef.current?.caseTimeline?.relatedSessionId
            ? sessionRef.current.caseTimeline.summary
            : undefined,
        compactContext: compactAdaptiveContext(
          sessionRef.current?.answers || {},
          categoryKey,
        ),
        longitudinalCaseCompact: String(
          sessionRef.current?.longitudinalCase?.compactTimelineSnippet || "",
        ).slice(0, 1200),
      };
      const res = await fetch("/api/previsit/adaptive-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "request_failed");
      }
      return {
        nextQuestion: String(data?.nextQuestion || "").trim(),
        isComplete: Boolean(data?.isComplete),
        compiledAnswer: String(data?.compiledAnswer || "").trim(),
        safetyFlags: sanitizeSafetyFlags(data?.safetyFlags),
      };
    },
    [
      categoryKey,
      categoryTitle,
      cfg?.maxFollowups,
      patientLanguage,
      slice.compiledAnswer,
      slice.askedQuestions,
    ]
  );

  async function submitReply() {
    setError("");
    const reply = String(
      slice.currentQuestion ? replyDraft : slice.compiledAnswer || ""
    ).trim();
    if (!reply) {
      setError(labels.adaptiveAnswerRequired);
      return;
    }
    if (slice.followupsUsed >= (cfg?.maxFollowups || 2)) {
      onFinished(String(slice.compiledAnswer || "").trim() || reply);
      return;
    }
    setBusy(true);
    try {
      const previousReplies = [...(slice.replies || [])];
      const out = await callAdaptive(reply, previousReplies);
      const nextReplies = [...previousReplies, reply];
      const priorAsked = Array.isArray(slice.askedQuestions)
        ? slice.askedQuestions
        : [];
      const askedQuestions =
        String(slice.currentQuestion || "").trim().length > 0
          ? [...priorAsked, String(slice.currentQuestion).trim()].filter(Boolean).slice(-10)
          : priorAsked;
      const nextSlice = {
        ...slice,
        followupsUsed: nextReplies.length,
        replies: nextReplies,
        askedQuestions,
        currentQuestion: out.isComplete ? "" : out.nextQuestion,
        compiledAnswer: out.compiledAnswer || String(slice.compiledAnswer || ""),
        safetyFlags: out.safetyFlags,
        status: out.isComplete ? "complete" : "active",
      };
      persistSlice(nextSlice);
      setReplyDraft("");
      if (out.isComplete) {
        onFinished(nextSlice.compiledAnswer || nextReplies.join("\n"));
      }
    } catch {
      setError(labels.adaptiveServiceError || labels.audioErrorGeneric);
    } finally {
      setBusy(false);
    }
  }

  function handleSeedChange(v) {
    persistSlice({
      ...slice,
      compiledAnswer: v,
      status: "active",
    });
  }

  return (
    <>
      <p className="pre-visit-adaptive__hint">
        {cfg && patientLanguage === "en" ? cfg.seedPromptEn : cfg?.seedPromptDe || labels.adaptiveSeedHint}
      </p>
      {slice.currentQuestion ? (
        <div className="pre-visit-adaptive__followup" role="region">
          <p className="pre-visit-adaptive__label">{labels.adaptiveFollowupLabel}</p>
          <p className="pre-visit-adaptive__question">{slice.currentQuestion}</p>
        </div>
      ) : null}

      <div className="pre-visit-chat__field">
        <label className="pre-visit-chat__textarea-label" htmlFor={`previsit-adaptive-${categoryKey}`}>
          {labels.sectionLabelAnswer}
        </label>
        <textarea
          id={`previsit-adaptive-${categoryKey}`}
          className="pre-visit-chat__textarea"
          value={slice.currentQuestion ? replyDraft : slice.compiledAnswer || ""}
          onChange={(e) =>
            slice.currentQuestion ? setReplyDraft(e.target.value) : handleSeedChange(e.target.value)
          }
          placeholder={labels.answerPlaceholder}
          rows={6}
          autoComplete="off"
          disabled={busy}
        />
      </div>

      {error ? (
        <p className="pre-visit-adaptive__error" role="alert">
          {error}
        </p>
      ) : null}

      <p className="pre-visit-adaptive__meta" aria-live="polite">
        {labels.adaptiveProgressMeta
          .replace("{{n}}", String(slice.followupsUsed || 0))
          .replace("{{max}}", String(cfg?.maxFollowups || 2))}
      </p>

      <div className="pre-visit-chat__actions">
        <button
          type="button"
          className="pre-visit-chat__btn pre-visit-chat__btn--secondary"
          onClick={onExitStep}
          disabled={busy}
        >
          {labels.back}
        </button>
        <button
          type="button"
          className="pre-visit-chat__btn pre-visit-chat__btn--secondary"
          onClick={onSkipStep}
          disabled={busy}
        >
          {labels.adaptiveSkip || "Skip"}
        </button>
        <button
          type="button"
          className="pre-visit-chat__btn pre-visit-chat__btn--primary"
          onClick={() => void submitReply()}
          disabled={busy}
        >
          {busy ? labels.adaptiveBusy : labels.next}
        </button>
      </div>
    </>
  );
});

AdaptiveIntakePanel.displayName = "AdaptiveIntakePanel";

export default AdaptiveIntakePanel;

