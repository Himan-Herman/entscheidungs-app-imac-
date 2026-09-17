import { forwardRef } from "react";
import { isEdited, isWithdrawn, messageReadState } from "../lib/messageTimeline.js";
import MessageActions from "./MessageActions.jsx";
import MessageTranslation from "./MessageTranslation.jsx";
import MessageEditor from "./MessageEditor.jsx";

/**
 * The message timeline of one conversation.
 *
 * Split out of the page on purpose (Phase 3A). The page owns loading, paging
 * and acknowledgement; this component owns nothing but rendering. That split is
 * what makes per-message states possible later — an edited or withdrawn message
 * changes MessageItem alone, not the page that happens to display it.
 *
 * ORDER
 * -----
 * `messages` arrives oldest-first, in the server's total order (createdAt, id).
 * The list is rendered in exactly that order, so "load older" prepends and
 * "send" appends, and neither has to re-sort anything on the client.
 */

/**
 * One message.
 *
 * `isOwn` is derived from the sender identity the server sent, never from the
 * position or the colour of the row. Presentation may change; authorship may
 * not.
 */
function MessageItem({ message, ownSenderType, t, fmt, editing, editState, actions, translation, speech }) {
  const isOwn = message.senderType === ownSenderType;
  const withdrawn = isWithdrawn(message);
  // A read state is only shown for one's own messages: it answers "has the
  // other side seen this", which is meaningless on a message one received.
  //
  // Two states only — sent and read. There is no delivery tracking behind this
  // channel, so no third state is claimed. `readAt` is per message: a message
  // sent after the other side last read stays "sent" even in a thread that was
  // read before. A withdrawn message reports neither: what matters about it is
  // that it was taken back.
  const state = withdrawn ? null : messageReadState(message, ownSenderType);
  const isRead = state === "read";

  return (
    <li
      className="practice-context__message"
      data-testid="scoped-message"
      // Stable across an edit: the text may change, the message does not.
      data-message-id={message.id}
    >
      <p className="practice-context__meta">
        {isOwn ? t.senderYou : t.senderPractice} · {fmt(message.createdAt)}
      </p>

      {withdrawn ? (
        /*
         * The message stays in the conversation and says what happened to it.
         * Phrased from the reader's side, because "you withdrew this" and
         * "this was withdrawn" are different facts and only one of them is
         * true for any given reader.
         */
        <p className="practice-context__message-withdrawn" data-testid="message-withdrawn">
          {isOwn ? t.withdrawnOwn : t.withdrawnOther}
        </p>
      ) : editing ? (
        <MessageEditor
          message={message}
          t={t}
          saving={editState.saving}
          error={editState.error}
          onSave={editState.onSave}
          onCancel={editState.onCancel}
        />
      ) : (
        <>
          {/*
            * The original, always. A translation is added below it, never in
            * its place — so the reader can compare a term against what was
            * actually written without doing anything to get it back.
            *
            * The heading appears only once a translation is present: labelling
            * a lone message "Original" would raise a question the reader does
            * not yet have.
            */}
          {translation?.state?.status === "done" || translation?.simpleState?.status === "done" ? (
            <p className="practice-context__translation-heading" data-testid="original-heading">
              {t.original}
            </p>
          ) : null}
          <p
            className="practice-context__message-body"
            lang={translation?.state?.sourceLanguage || undefined}
          >
            {message.body}
          </p>
          {/*
            * Both renderings can be on screen at once, each labelled, always
            * below the original. Asking for the plainer wording does not
            * discard a translation that was already fetched, and neither ever
            * replaces the message itself.
            */}
          {translation ? (
            <MessageTranslation
              state={translation.state}
              targetLanguage={translation.targetLanguage}
              mode="normal"
              t={t}
              onRetry={translation.onTranslate}
            />
          ) : null}
          {translation ? (
            <MessageTranslation
              state={translation.simpleState}
              targetLanguage={translation.targetLanguage}
              mode="simple"
              t={t}
              onRetry={translation.onSimplify}
            />
          ) : null}
        </>
      )}

      {/*
        * Said in words, not only by a moving icon: someone who cannot see the
        * control still needs to know their device is talking.
        */}
      {speech?.speakingHere ? (
        <p
          className="practice-context__speaking"
          role="status"
          aria-live="polite"
          data-testid="message-speaking"
        >
          {t.speaking}
        </p>
      ) : null}

      {!withdrawn && !editing && isEdited(message) ? (
        // Words, not an icon: a small mark next to a message is exactly the
        // kind of thing a reader does not decode.
        <p className="practice-context__message-edited" data-testid="message-edited">
          {t.edited}
        </p>
      ) : null}

      {state ? (
        <p
          className={`practice-context__message-status${
            isRead ? " practice-context__message-status--read" : ""
          }`}
          data-testid={isRead ? "message-status-read" : "message-status-sent"}
        >
          <span aria-hidden="true">{isRead ? t.statusRead : t.statusSent}</span>
          <span className="practice-context__sr-only">
            {isRead ? t.statusAriaRead : t.statusAriaSent}
          </span>
        </p>
      ) : null}

      {/*
        * The menu appears only while the server says the message can still be
        * changed. That answer may be a moment old — the recipient could read it
        * in between — which is why the mutation is decided again on the server
        * and never here.
        */}
      {/*
        * One menu carries every action on a message. Translating sits beside
        * editing rather than in a control of its own: a permanent button under
        * every line of a fifty-message conversation is fifty controls to read
        * past. A withdrawn message has no menu at all — there is nothing left
        * to change and nothing left to translate.
        */}
      {!editing && !withdrawn && (actions || translation?.canTranslate || speech) ? (
        <MessageActions
          t={t}
          onEdit={actions?.canEdit ? actions.onEdit : null}
          onWithdraw={actions?.canWithdraw ? actions.onWithdraw : null}
          onTranslate={
            translation?.canTranslate && translation.state?.status !== "done"
              ? translation.onTranslate
              : null
          }
          onSimplify={
            translation?.canTranslate && translation.simpleState?.status !== "done"
              ? translation.onSimplify
              : null
          }
          speech={speech}
        />
      ) : null}
    </li>
  );
}

const MessageTimeline = forwardRef(function MessageTimeline(
  {
    messages,
    ownSenderType,
    hasMore,
    loadingOlder,
    onLoadOlder,
    t,
    fmt,
    editingId,
    editState,
    actionsFor,
    translationFor,
    speechFor,
  },
  listRef,
) {
  return (
    <div className="practice-context__timeline">
      {/* The older-history control sits above the oldest message, where the
          history it loads will appear. */}
      {hasMore ? (
        <button
          type="button"
          className="practice-context__load-older"
          onClick={onLoadOlder}
          disabled={loadingOlder}
          data-testid="load-older"
        >
          {loadingOlder ? t.loadingOlder : t.loadOlder}
        </button>
      ) : (
        <p className="practice-context__timeline-start" data-testid="no-older">
          {t.noOlder}
        </p>
      )}

      <ol
        className="practice-context__messages"
        data-testid="scoped-message-list"
        aria-label={t.messagesLabel}
        ref={listRef}
      >
        {messages.map((m) => (
          <MessageItem
            key={m.id}
            message={m}
            ownSenderType={ownSenderType}
            t={t}
            fmt={fmt}
            editing={editingId === m.id}
            editState={editState}
            actions={actionsFor ? actionsFor(m) : null}
            translation={translationFor ? translationFor(m) : null}
            speech={speechFor ? speechFor(m) : null}
          />
        ))}
      </ol>
    </div>
  );
});

export default MessageTimeline;
