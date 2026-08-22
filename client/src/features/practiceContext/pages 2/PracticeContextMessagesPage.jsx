import { useCallback, useEffect, useRef, useState } from "react";
import { usePracticeContext } from "../usePracticeContext.js";
import { useScopedRequest } from "../hooks/useScopedRequest.js";
import {
  acknowledgeScopedChannelRead,
  fetchScopedChannel,
  sendScopedMessage,
} from "../api/scopedCommunicationApi.js";
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
export default function PracticeContextMessagesPage() {
  const { linkId, isActiveRelationship } = usePracticeContext();
  const { run } = useScopedRequest(linkId);
  const { language } = useLanguage();
  const t = getMessages(language).practiceContext || getMessages("en").practiceContext;

  const [channel, setChannel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const pendingSendIdRef = useRef(null);

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
          setChannel(data.channel ?? null);
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
  useEffect(() => {
    if (!channel || !hasUnreadFrom(channel, "practice")) return;
    run(
      ({ signal }) => acknowledgeScopedChannelRead(linkId, { signal }),
      ({ res, data }) => {
        if (res.ok && data.ok && data.channel) setChannel(data.channel);
      },
    ).catch(() => {
      /* acknowledging must never break reading */
    });
  }, [channel, linkId, run]);

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

  const messages = channel?.messages ?? [];

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

      {!loading && !error && messages.length === 0 ? (
        <p className="practice-context__state">{t.messagesEmpty}</p>
      ) : null}

      {!loading && !error && messages.length > 0 ? (
        <ol
          className="practice-context__messages"
          data-testid="scoped-message-list"
          aria-label={t.messagesLabel}
        >
          {messages.map((m) => (
            <li key={m.id} className="practice-context__message">
              <p className="practice-context__meta">
                {m.senderType === "patient" ? t.senderYou : t.senderPractice} ·{" "}
                {fmt(m.createdAt)}
              </p>
              <p>{m.body}</p>
            </li>
          ))}
        </ol>
      ) : null}

      {channel && isActiveRelationship ? (
        <form onSubmit={handleSend} className="practice-context__composer">
          <label htmlFor="scoped-reply">{t.replyLabel}</label>
          <textarea
            id="scoped-reply"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            disabled={sending}
          />
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
