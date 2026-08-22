import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePracticeContext } from "../usePracticeContext.js";
import { useScopedRequest } from "../hooks/useScopedRequest.js";
import {
  acknowledgeScopedChannelRead,
  editScopedMessage,
  fetchScopedChannel,
  fetchScopedOlderMessages,
  sendScopedMessage,
  transcribeScopedDictation,
  translateScopedMessage,
  withdrawScopedMessage,
} from "../api/scopedCommunicationApi.js";
import MessageTimeline from "../components/MessageTimeline.jsx";
import FocusModal from "../../patientPractices/components/FocusModal.jsx";
import {
  applyMessageUpdate,
  mergeTimeline,
  messageActions,
  readBoundaryOf,
} from "../lib/messageTimeline.js";
import {
  RENDERING_MODES,
  forgetTranslationsOf,
  isTranslatable,
  translationKey,
} from "../lib/messageTranslationState.js";
import { MESSAGE_TRANSLATION_TARGET_LOCALE_CODES } from "../../../i18n/localeConfig.js";
import { dictationSupported, useDictation } from "../hooks/useDictation.js";
import { useMessageSpeech } from "../hooks/useMessageSpeech.js";
import { DICTATION_STATES, canDictate, insertTranscript } from "../lib/dictationState.js";
import {
  SPEECH_SOURCES,
  availableSpeechSources,
  isSpeaking,
  speechSourceFor,
} from "../lib/messageSpeechState.js";
import { LOCALE_OPTIONS } from "../../../i18n/localeConfig.js";
import { hasUnreadFrom } from "../../communication/lib/threadReadState.js";
import { newSendRequestId } from "../../communication/lib/sendRequestId.js";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { getPrimaryIntlLocale } from "../../../i18n/intlLocale.js";

/**
 * Communication inside ONE care relationship — the first real page on the
 * practice context (Phase 2C).
 *
 * Deliberately plain. This phase proves the isolation, not the visual design:
 * existing tokens and existing components only, no chat bubbles, no translation
 * tabs, no audio. The designed messenger follows later.
 *
 * ISOLATION
 * ---------
 * Every request runs through useScopedRequest, so a response can only be
 * applied while its own context is still active. Together with the
 * key={linkId} remount in PracticeScopedOutlet, a message from the previous
 * practice has no path onto this screen: the component that could hold it no
 * longer exists, and a late response is discarded before it reaches setState.
 */
/**
 * Scrolls whichever box actually holds the timeline.
 *
 * The app scrolls the window on some layouts and an inner element on others.
 * Correcting the wrong one is silently a no-op, and the reader's position is
 * lost — so the box is looked up from the element itself rather than assumed.
 */
function scrollNearestBy(el, dy) {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const overflowY = getComputedStyle(node).overflowY;
    const scrollable =
      /(auto|scroll|overlay)/.test(overflowY) && node.scrollHeight > node.clientHeight;
    if (scrollable) {
      node.scrollTop += dy;
      return;
    }
  }
  window.scrollBy(0, dy);
}

export default function PracticeContextMessagesPage() {
  const { linkId, isActiveRelationship } = usePracticeContext();
  const { run } = useScopedRequest(linkId);
  const { language } = useLanguage();
  const t = getMessages(language).practiceContext || getMessages("en").practiceContext;

  const [channel, setChannel] = useState(null);
  // The timeline accumulates; it is never replaced by a channel payload.
  //
  // Every channel response carries only the NEWEST page. Replacing the timeline
  // with it would drop both ends: the history the reader deliberately loaded,
  // and — after sending — the message that the sliding window has just pushed
  // out of its far edge. Merging keeps everything ever seen and lets the fresher
  // copy win where the two overlap.
  const [timeline, setTimeline] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // One message at a time is editable, and one withdrawal at a time is pending
  // confirmation. Both are held by message id rather than by object, so a
  // refreshed timeline cannot leave the page editing a stale copy.
  const [editingId, setEditingId] = useState(null);
  const [mutating, setMutating] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const [withdrawId, setWithdrawId] = useState(null);
  /*
   * One target language for the whole conversation, not one per message.
   *
   * A reader who needs a translation needs it in the same language every time,
   * and a picker under each message would be fifty pickers. It starts from the
   * language the interface is already in — the user's own stated preference —
   * and is theirs to change at any time. It is never derived from a country or
   * an address.
   */
  const [targetLanguage, setTargetLanguage] = useState(() =>
    MESSAGE_TRANSLATION_TARGET_LOCALE_CODES.includes(language)
      ? language
      : MESSAGE_TRANSLATION_TARGET_LOCALE_CODES[0],
  );
  // Keyed by message + state of that message + language, so an edit can never
  // leave an old translation attached to new text.
  const [translations, setTranslations] = useState({});
  const [reply, setReply] = useState("");
  // The composer element, so a dictation can be inserted at the caret rather
  // than appended blindly.
  const replyRef = useRef(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const pendingSendIdRef = useRef(null);
  const listRef = useRef(null);
  // Set while an older page is being inserted: the element the reader is
  // anchored to, and where it sat in the viewport before the insertion.
  const anchorRef = useRef(null);
  const ackedThroughRef = useRef(null);
  const settledInitialViewRef = useRef(false);

  // linkId is an explicit dependency, not an implicit one.
  //
  // PracticeScopedOutlet remounts this page via key={linkId}, so a switch would
  // re-run this effect anyway. Depending on the remount for CORRECTNESS would be
  // fragile: the page must reload its data when its context changes, whether or
  // not something above it happens to destroy it. The barriers are meant to
  // overlap, and each one has to hold on its own.
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const outcome = await run(
        ({ signal }) => fetchScopedChannel(linkId, { signal }),
        ({ res, data }) => {
          if (!res.ok || !data.ok) {
            setChannel(null);
            setError(res.status === 404 ? t.notFoundBody : t.errorBody);
            return;
          }
          const next = data.channel ?? null;
          setChannel(next);
          // The initial page is the newest one; everything older is reachable
          // only through the cursor the server sent with it.
          setTimeline(next?.messages ?? []);
          setCursor(next?.olderCursor ?? null);
          setHasMore(Boolean(next?.hasMoreMessages));
        },
      );
      // A discarded response belongs to a context that is gone; leaving the
      // spinner up would be wrong, but so would clearing it for the new one.
      if (!outcome.applied) return;
    } catch {
      setChannel(null);
      setError(t.errorBody);
    } finally {
      setLoading(false);
    }
  }, [linkId, run, t.errorBody, t.notFoundBody]);

  useEffect(() => {
    load();
  }, [load]);

  // Explicit acknowledgement, never a side effect of the GET (Phase 1' C-3).
  //
  // The boundary is the newest message actually on screen. Acknowledging "the
  // thread" would swallow whatever arrives between this decision and the
  // server's write; naming the last message read cannot, because a later
  // message is not covered by it. The client never sends a timestamp — it names
  // a message and lets the server decide what that means.
  const newestId = readBoundaryOf(timeline);
  const unread = hasUnreadFrom({ messages: timeline }, "practice");

  useEffect(() => {
    if (!newestId || !unread) return;
    // Re-acknowledging the same boundary would be harmless server-side but
    // pointless: the response updates the channel, which re-runs this effect.
    if (ackedThroughRef.current === newestId) return;
    ackedThroughRef.current = newestId;
    run(
      ({ signal }) => acknowledgeScopedChannelRead(linkId, newestId, { signal }),
      ({ res, data }) => {
        if (!res.ok || !data.ok || !data.channel) return;
        setChannel(data.channel);
        setTimeline((prev) => mergeTimeline(prev, data.channel.messages));
      },
    ).catch(() => {
      /* acknowledging must never break reading */
    });
  }, [linkId, newestId, run, unread]);

  const handleLoadOlder = async () => {
    if (!cursor || loadingOlder) return;
    setLoadingOlder(true);
    // Anchored to the oldest message currently on screen rather than to a
    // document height. Which element actually scrolls differs between layouts,
    // and a collapsed <html> reports a height that never grows — but the
    // distance of a real element from the top of the viewport is true either
    // way.
    const oldest = listRef.current?.firstElementChild;
    anchorRef.current = oldest
      ? { el: oldest, top: oldest.getBoundingClientRect().top }
      : null;
    try {
      await run(
        ({ signal }) => fetchScopedOlderMessages(linkId, cursor, { signal }),
        ({ res, data }) => {
          if (!res.ok || !data.ok) {
            // A failed page must not look like the end of the history.
            anchorRef.current = null;
            return;
          }
          setTimeline((prev) => mergeTimeline(data.messages ?? [], prev));
          setCursor(data.olderCursor ?? null);
          setHasMore(Boolean(data.hasMore));
        },
      );
    } catch {
      anchorRef.current = null;
    } finally {
      setLoadingOlder(false);
    }
  };

  // A conversation opens at its newest message, not at its beginning. The list
  // runs oldest-first, so the newest sits at the bottom, next to the composer —
  // exactly where the reader continues. Once only: an acknowledgement or a
  // freshly loaded older page must not drag the view back down.
  useLayoutEffect(() => {
    if (settledInitialViewRef.current) return;
    const last = listRef.current?.lastElementChild;
    if (!last) return;
    settledInitialViewRef.current = true;
    last.scrollIntoView({ block: "end" });
  }, [timeline]);

  // Loading history must not move what is being read. Whatever was inserted
  // above the anchor pushed it down by exactly that much; scrolling by the same
  // distance puts it back where the reader left it.
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    anchorRef.current = null;
    const moved = anchor.el.getBoundingClientRect().top - anchor.top;
    if (moved !== 0) scrollNearestBy(anchor.el, moved);
  }, [timeline]);

  /**
   * Turns the server's refusal into something a person can act on.
   *
   * The server answers with a state, not a fault: the message was read, or it
   * was already withdrawn. Those are facts about the conversation, and the
   * reader deserves to be told which one — never an error code.
   */
  const refusalMessage = (error) => {
    if (error === "message_already_read") return t.errorAlreadyRead;
    if (error === "message_withdrawn") return t.errorWithdrawn;
    if (error === "validation_required") return t.errorEmpty;
    return t.errorEditFailed;
  };

  /**
   * Applies whatever the server decided.
   *
   * On success the changed message replaces its own entry — the rest of the
   * timeline, including any history the reader loaded, stays exactly as it was.
   * On refusal the message is left alone and the reason is shown; the fresh
   * copy that comes back with the refusal is not available, so the timeline is
   * reloaded once to bring the true state (and with it the now-absent controls)
   * on screen.
   */
  const runMutation = async (call) => {
    setMutating(true);
    setMutationError("");
    try {
      const outcome = await run(call, ({ res, data }) => {
        if (res.ok && data.ok && data.message) {
          setTimeline((prev) => applyMessageUpdate(prev, data.message));
          // The wording changed, so every translation of it describes text that
          // is no longer on screen. They are dropped rather than left to be
          // missed by a key comparison.
          setTranslations((prev) => forgetTranslationsOf(prev, data.message.id));
          setEditingId(null);
          return;
        }
        setMutationError(refusalMessage(data.error));
        // The window closed while the control was on screen. Leaving the editor
        // open would invite the reader to try again at something that can no
        // longer succeed, so it closes and the reason takes its place — and the
        // timeline is reloaded to bring the true state, and the now-absent
        // controls, on screen.
        if (res.status === 409) {
          setEditingId(null);
          load();
        }
      });
      if (!outcome.applied) return;
    } catch {
      setMutationError(t.errorEditFailed);
    } finally {
      setMutating(false);
    }
  };

  const handleEditSave = (messageId) => (body) => {
    if (!body.trim()) {
      setMutationError(t.errorEmpty);
      return;
    }
    runMutation(({ signal }) => editScopedMessage(linkId, messageId, body.trim(), { signal }));
  };

  const handleWithdrawConfirmed = () => {
    const id = withdrawId;
    setWithdrawId(null);
    if (id) runMutation(({ signal }) => withdrawScopedMessage(linkId, id, { signal }));
  };

  /**
   * Asks the server for one message in the chosen language.
   *
   * Runs through the same scoped-request machinery as everything else on this
   * page, so a translation still in flight when the reader switches practice is
   * discarded rather than landing under a different conversation.
   */
  const requestTranslation = useCallback(
    async (message, mode = RENDERING_MODES.NORMAL) => {
      const key = translationKey(message, targetLanguage, undefined, mode);
      setTranslations((prev) => ({ ...prev, [key]: { status: "loading" } }));

      try {
        const outcome = await run(
          ({ signal }) =>
            translateScopedMessage(linkId, message.id, targetLanguage, { mode, signal }),
          ({ res, data }) => {
            if (res.ok && data.ok && data.translation) {
              const done = {
                status: "done",
                text: data.translation.translatedText,
                sourceLanguage: data.translation.sourceLanguage ?? null,
              };
              // Stored under the SERVER's fingerprint as well, so a later
              // render finds it by the same key the server would compute.
              setTranslations((prev) => ({
                ...prev,
                [key]: done,
                [translationKey(
                  message,
                  targetLanguage,
                  data.translation.sourceFingerprint,
                  mode,
                )]: done,
              }));
              return;
            }
            // 503 means the feature is not available in this deployment at all;
            // trying again would fail identically, so it is not offered.
            // Three different things can have gone wrong, and the reader is
            // told which: the feature is not available here at all (503, no
            // point retrying), the plainer wording could not be produced
            // safely (422 — the original is fine, the alternative is not), or
            // something failed and may not next time.
            const unavailable = res.status === 503;
            const unsafe = res.status === 422;
            // Named for what it is, and NOT `message`: that name already
            // belongs to the message this request is about, and shadowing it
            // here would put the whole callback's reference to it in a
            // temporal dead zone.
            const reason = unavailable
              ? t.translationUnavailable
              : unsafe
                ? t.simpleUnsafe
                : mode === RENDERING_MODES.SIMPLE
                  ? t.simpleFailed
                  : t.translationFailed;
            setTranslations((prev) => ({
              ...prev,
              [key]: { status: "error", message: reason, retryable: !unavailable && !unsafe },
            }));
            // The message itself may have moved on — edited or withdrawn while
            // the request was in flight. Reloading shows what is true now.
            if (res.status === 404 || res.status === 409) load();
          },
        );
        if (!outcome.applied) return;
      } catch {
        // The request never reached an answer — the network, not the service.
        // The wording still follows the mode that was asked for: telling
        // someone their translation failed when they asked for plainer words
        // describes something they did not do.
        setTranslations((prev) => ({
          ...prev,
          [key]: {
            status: "error",
            message:
              mode === RENDERING_MODES.SIMPLE ? t.simpleFailed : t.translationFailed,
            retryable: true,
          },
        }));
      }
    },
    [
      linkId,
      load,
      run,
      t.simpleFailed,
      t.simpleUnsafe,
      t.translationFailed,
      t.translationUnavailable,
      targetLanguage,
    ],
  );

  /*
   * Dictation.
   *
   * The transcript goes into the composer and stops there. Nothing is sent:
   * the writer reads it, changes it if it is wrong — and it can be wrong — and
   * presses send themselves, at which point the ordinary send path runs.
   */
  const transcribeBlob = useCallback(
    async (blob) => {
      // `run` reports WHETHER a response was applied, not what it produced, so
      // the transcript is caught here. It is only ever assigned inside the
      // apply callback, which the scoped-request machinery does not call for a
      // context that has moved on.
      let transcript = "";
      const outcome = await run(
        ({ signal }) => transcribeScopedDictation(linkId, blob, targetLanguage, { signal }),
        ({ res, data }) => {
          if (res.ok && data.ok && data.draft?.text) {
            transcript = data.draft.text;
            return;
          }
          const err = new Error(data.error ?? "dictation_failed");
          err.status = res.status;
          throw err;
        },
      );
      // A transcript that arrives after the reader has moved on belongs to a
      // conversation that is no longer open; it is dropped, never inserted.
      if (!outcome.applied) return "";
      return transcript;
    },
    [linkId, run, targetLanguage],
  );

  const applyTranscript = useCallback((text) => {
    setReply((current) => {
      const field = replyRef.current;
      const { text: next, caret } = insertTranscript(current, text, {
        start: field?.selectionStart,
        end: field?.selectionEnd,
      });
      // The caret follows the insertion, so typing continues where the
      // dictation ended rather than jumping to the start.
      requestAnimationFrame(() => {
        if (!replyRef.current) return;
        replyRef.current.focus();
        replyRef.current.setSelectionRange(caret, caret);
      });
      return next;
    });
  }, []);

  const dictation = useDictation({
    onTranscript: applyTranscript,
    transcribe: transcribeBlob,
    t,
  });

  /*
   * Reading aloud.
   *
   * On the device, through the browser's own voice. The text is already on
   * screen and already authorized; speaking it locally means it does not travel
   * anywhere a second time.
   */
  const speech = useMessageSpeech();

  const handleSend = async (e) => {
    e.preventDefault();
    if (!reply.trim() || sending) return;
    setSending(true);
    setSendError("");
    if (!pendingSendIdRef.current) pendingSendIdRef.current = newSendRequestId();

    try {
      await run(
        ({ signal }) =>
          sendScopedMessage(linkId, reply.trim(), pendingSendIdRef.current, { signal }),
        ({ res, data }) => {
          if (res.status >= 400 && res.status < 500) pendingSendIdRef.current = null;
          if (!res.ok || !data.ok) {
            setSendError(res.status === 403 ? t.sendForbidden : t.sendError);
            return;
          }
          pendingSendIdRef.current = null;
          setReply("");
          setChannel(data.channel);
          setTimeline((prev) => mergeTimeline(prev, data.channel?.messages));
        },
      );
    } catch {
      setSendError(t.sendError);
    } finally {
      setSending(false);
    }
  };

  const fmt = (iso) => {
    try {
      return new Date(iso).toLocaleString(getPrimaryIntlLocale(language), {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="practice-context" data-testid="scoped-messages">
      {/* Identity lives in the context bar above; this heading names the page. */}
      <h1 className="practice-context__title">{t.messagesTitle}</h1>

      {loading ? (
        <p className="practice-context__state" role="status" aria-live="polite">
          {t.loading}
        </p>
      ) : null}

      {error ? (
        <p className="practice-context__state" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && timeline.length === 0 ? (
        <p className="practice-context__state">{t.messagesEmpty}</p>
      ) : null}

      {!loading && !error && timeline.length > 0 ? (
        <div className="practice-context__translation-bar">
          <label htmlFor="scoped-target-language">{t.targetLanguage}</label>
          <select
            id="scoped-target-language"
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
            data-testid="translation-target-language"
          >
            {MESSAGE_TRANSLATION_TARGET_LOCALE_CODES.map((code) => (
              <option key={code} value={code}>
                {LOCALE_OPTIONS.find((o) => o.code === code)?.nativeName ?? code}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {!loading && !error && timeline.length > 0 ? (
        <MessageTimeline
          ref={listRef}
          messages={timeline}
          editingId={editingId}
          editState={{
            saving: mutating,
            error: editingId ? mutationError : "",
            onSave: editingId ? handleEditSave(editingId) : undefined,
            onCancel: () => {
              setEditingId(null);
              setMutationError("");
            },
          }}
          translationFor={(m) => {
            if (!isTranslatable(m)) return null;
            return {
              canTranslate: true,
              targetLanguage,
              state:
                translations[
                  translationKey(m, targetLanguage, undefined, RENDERING_MODES.NORMAL)
                ] ?? null,
              simpleState:
                translations[
                  translationKey(m, targetLanguage, undefined, RENDERING_MODES.SIMPLE)
                ] ?? null,
              onTranslate: () => requestTranslation(m, RENDERING_MODES.NORMAL),
              onSimplify: () => requestTranslation(m, RENDERING_MODES.SIMPLE),
            };
          }}
          speechFor={(m) => {
            if (!speech.supported) return null;
            const sources = availableSpeechSources(m, translations, targetLanguage);
            if (sources.length === 0) return null;
            return {
              sources,
              speakingHere: isSpeaking(speech.speaking, m.id),
              onStop: speech.stop,
              onSpeak: (source) => {
                // The text is taken from the SAME state the screen renders
                // from, so a rendering that is no longer shown cannot be
                // spoken — and a withdrawn message has nothing at all.
                const chosen = speechSourceFor(m, source, translations, targetLanguage);
                if (!chosen) return;
                speech.speak({
                  messageId: m.id,
                  source,
                  text: chosen.text,
                  lang: chosen.lang,
                });
              },
            };
          }}
          actionsFor={(m) => {
            const { canEdit, canWithdraw } = messageActions(m);
            if (!canEdit && !canWithdraw) return null;
            return {
              canEdit,
              canWithdraw,
              onEdit: () => {
                setMutationError("");
                setEditingId(m.id);
              },
              onWithdraw: () => {
                setMutationError("");
                setWithdrawId(m.id);
              },
            };
          }}
          ownSenderType="patient"
          hasMore={hasMore}
          loadingOlder={loadingOlder}
          onLoadOlder={handleLoadOlder}
          t={t}
          fmt={fmt}
        />
      ) : null}

      {/*
        * Shown outside the editor as well, because a withdrawal has no editor
        * to put it in — and because after a refused change the reader needs the
        * reason where they are looking, not where the control used to be.
        */}
      {mutationError && !editingId ? (
        <p className="practice-context__state" role="alert" data-testid="mutation-error">
          {mutationError}
        </p>
      ) : null}

      {/*
        * Withdrawing cannot be undone, so it is confirmed first — in the app's
        * own dialog, which traps focus and gives it back, rather than a browser
        * prompt that does neither.
        */}
      <FocusModal
        open={Boolean(withdrawId)}
        onClose={() => setWithdrawId(null)}
        titleId="scoped-withdraw-title"
        title={t.withdrawTitle}
      >
        <p>{t.withdrawBody}</p>
        <div className="practice-context__confirm-actions">
          <button type="button" onClick={handleWithdrawConfirmed} data-testid="withdraw-confirm">
            {t.withdrawConfirm}
          </button>
          <button type="button" onClick={() => setWithdrawId(null)} data-testid="withdraw-cancel">
            {t.withdrawCancel}
          </button>
        </div>
      </FocusModal>

      {channel && isActiveRelationship ? (
        <form onSubmit={handleSend} className="practice-context__composer">
          <label htmlFor="scoped-reply">{t.replyLabel}</label>
          <textarea
            id="scoped-reply"
            ref={replyRef}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            disabled={sending}
          />

          {/*
            * Dictation sits beside the composer, not inside the timeline: it
            * produces a draft, and a draft belongs where drafts are written.
            */}
          {canDictate({ isActiveRelationship, supported: dictationSupported() }) ? (
            <div className="practice-context__dictation">
              {dictation.isCapturing ? (
                <button
                  type="button"
                  onClick={dictation.stop}
                  data-testid="dictation-stop"
                  className="practice-context__dictation-btn practice-context__dictation-btn--recording"
                >
                  {t.dictationStop}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={dictation.start}
                  disabled={dictation.state === DICTATION_STATES.PROCESSING || sending}
                  data-testid="dictation-start"
                  className="practice-context__dictation-btn"
                >
                  {t.dictate}
                </button>
              )}

              {/*
                * The state in words, in a live region. A moving dot tells a
                * sighted user their microphone is on; this tells everyone.
                */}
              <p
                className="practice-context__dictation-state"
                role="status"
                aria-live="polite"
                data-testid="dictation-state"
              >
                {/*
                  * Nothing while permission is still being asked: the browser's
                  * own prompt is on screen, and announcing "recording" before
                  * anyone has agreed to it would be untrue.
                  */}
                {dictation.state === DICTATION_STATES.RECORDING ? t.dictationRecording : null}
                {dictation.state === DICTATION_STATES.PROCESSING ? t.dictationProcessing : null}
              </p>

              {dictation.error ? (
                <p
                  className="practice-context__state"
                  role="alert"
                  data-testid="dictation-error"
                >
                  {dictation.error.message}
                </p>
              ) : null}

              {/*
                * Said once, plainly: recognition can be wrong, and the person
                * about to send it is the one who can tell.
                */}
              <p className="practice-context__dictation-hint">{t.dictationHint}</p>
            </div>
          ) : null}
          {sendError ? (
            <p className="practice-context__state" role="alert">
              {sendError}
            </p>
          ) : null}
          <button type="submit" disabled={sending || !reply.trim()}>
            {sending ? t.sending : t.send}
          </button>
        </form>
      ) : null}
    </div>
  );
}
