import { useEffect, useRef, useState } from "react";

/**
 * Editing one message in place.
 *
 * The existing text is what the field starts with — an edit is a correction,
 * not a rewrite from nothing. Nothing is saved until the sender says so: there
 * is no auto-save, because a half-typed correction is not what they meant to
 * send, and no suggestion of any kind, because these are the sender's own words
 * about their own health.
 */
export default function MessageEditor({ message, t, saving, error, onSave, onCancel }) {
  const [draft, setDraft] = useState(message.body ?? "");
  const fieldRef = useRef(null);
  const fieldId = `message-edit-${message.id}`;

  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.focus();
    // The caret goes to the end rather than selecting everything: the usual
    // intent is to change part of the text, not to replace all of it.
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const submit = (e) => {
    e.preventDefault();
    if (saving) return;
    onSave(draft);
  };

  return (
    <form className="practice-context__message-editor" onSubmit={submit}>
      <label htmlFor={fieldId} className="practice-context__sr-only">
        {t.editLabel}
      </label>
      <textarea
        id={fieldId}
        ref={fieldRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        disabled={saving}
        data-testid="message-edit-field"
      />
      {error ? (
        <p className="practice-context__state" role="alert" data-testid="message-edit-error">
          {error}
        </p>
      ) : null}
      <div className="practice-context__message-editor-actions">
        <button type="submit" disabled={saving || !draft.trim()} data-testid="message-edit-save">
          {t.editSave}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} data-testid="message-edit-cancel">
          {t.editCancel}
        </button>
      </div>
    </form>
  );
}
