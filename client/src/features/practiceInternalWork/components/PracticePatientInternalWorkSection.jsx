import { useCallback, useEffect, useMemo, useState } from "react";
import { Lock, NotebookPen, CalendarClock, Check } from "lucide-react";

import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations/index.js";
import {
  completeReminder,
  createInternalNote,
  createReminder,
  fetchInternalNotes,
  fetchReminders,
  updateInternalNote,
} from "../api/internalWorkApi.js";
import "../styles/InternalWork.css";

/**
 * The practice team's own notes and follow-ups on ONE patient relationship.
 *
 * This lives in its own tab, with its own composer, deliberately away from the
 * patient conversation. Nothing here is ever sent to the patient, and the
 * interface says so in words on every note and above every input — not with a
 * colour or an icon that a hurried reader can miss.
 */
export default function PracticePatientInternalWorkSection({ linkId, practiceId, readOnly = false }) {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const m = getMessages(language);
    return m.practiceInternalWork ?? getMessages("en").practiceInternalWork;
  }, [language]);

  const [notes, setNotes] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");

  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDue, setReminderDue] = useState("");
  const [savingReminder, setSavingReminder] = useState(false);
  const [reminderFilter, setReminderFilter] = useState("open");
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const [n, r] = await Promise.all([
      fetchInternalNotes(linkId, practiceId),
      fetchReminders(linkId, practiceId, "all"),
    ]);
    if (!n.ok || !r.ok) {
      setLoadError(t.loadError);
      setNotes([]);
      setReminders([]);
    } else {
      setNotes(n.data.notes ?? []);
      setReminders(r.data.reminders ?? []);
    }
    setLoading(false);
  }, [linkId, practiceId, t.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  const dateTime = useCallback(
    (value) => (value ? new Date(value).toLocaleString(language) : ""),
    [language],
  );

  async function submitNote(e) {
    e.preventDefault();
    if (!noteDraft.trim() || savingNote) return;
    setSavingNote(true);
    setActionError("");
    const res = await createInternalNote(linkId, practiceId, noteDraft.trim());
    setSavingNote(false);
    if (!res.ok) {
      setActionError(t.saveError);
      return;
    }
    setNoteDraft("");
    setNotes((prev) => [res.data.note, ...prev]);
  }

  async function submitEdit(noteId) {
    if (!editDraft.trim()) return;
    setActionError("");
    const res = await updateInternalNote(linkId, practiceId, noteId, editDraft.trim());
    if (!res.ok) {
      setActionError(t.saveError);
      return;
    }
    setNotes((prev) => prev.map((n) => (n.id === noteId ? res.data.note : n)));
    setEditingId(null);
    setEditDraft("");
  }

  async function submitReminder(e) {
    e.preventDefault();
    if (!reminderTitle.trim() || !reminderDue || savingReminder) return;
    setSavingReminder(true);
    setActionError("");
    const res = await createReminder(linkId, practiceId, {
      title: reminderTitle.trim(),
      dueAt: new Date(reminderDue).toISOString(),
    });
    setSavingReminder(false);
    if (!res.ok) {
      setActionError(t.saveError);
      return;
    }
    setReminderTitle("");
    setReminderDue("");
    setReminders((prev) => [...prev, res.data.reminder]);
  }

  async function markDone(reminderId) {
    setActionError("");
    const res = await completeReminder(linkId, practiceId, reminderId);
    if (!res.ok) {
      setActionError(t.saveError);
      return;
    }
    setReminders((prev) => prev.map((r) => (r.id === reminderId ? res.data.reminder : r)));
  }

  const visibleReminders = reminders.filter((r) =>
    reminderFilter === "open" ? !r.completedAt
      : reminderFilter === "completed" ? Boolean(r.completedAt)
      : true,
  );

  return (
    <section className="internal-work" aria-labelledby="internal-work-title">
      <header className="internal-work__header">
        <h2 id="internal-work-title" className="internal-work__title">
          <NotebookPen size={20} strokeWidth={2} aria-hidden="true" />
          {t.sectionTitle}
        </h2>
        {/* Stated in words, not signalled by colour: this is the whole point of
            the section and must survive a monochrome screenshot. */}
        <p className="internal-work__scope" role="note">
          <Lock size={16} strokeWidth={2} aria-hidden="true" />
          <strong>{t.teamOnlyBadge}</strong> {t.teamOnlyExplainer}
        </p>
      </header>

      {loadError ? (
        <p className="internal-work__error" role="alert">{loadError}</p>
      ) : null}
      {actionError ? (
        <p className="internal-work__error" role="alert">{actionError}</p>
      ) : null}

      {loading ? (
        <p className="internal-work__loading" aria-live="polite">{t.loading}</p>
      ) : (
        <>
          {/* ── notes ─────────────────────────────────────────────────── */}
          <div className="internal-work__block">
            <h3 className="internal-work__subtitle">{t.notesTitle}</h3>

            {readOnly ? null : (
              <form className="internal-work__composer" onSubmit={submitNote}>
                <label className="internal-work__label" htmlFor="internal-note-body">
                  {t.noteComposerLabel}
                </label>
                <p className="internal-work__composer-hint" id="internal-note-hint">
                  {t.noteComposerHint}
                </p>
                <textarea
                  id="internal-note-body"
                  className="internal-work__textarea"
                  aria-describedby="internal-note-hint"
                  rows={3}
                  value={noteDraft}
                  maxLength={4000}
                  placeholder={t.notePlaceholder}
                  onChange={(e) => setNoteDraft(e.target.value)}
                />
                <button
                  type="submit"
                  className="internal-work__btn internal-work__btn--primary"
                  disabled={!noteDraft.trim() || savingNote}
                >
                  {savingNote ? t.saving : t.saveNote}
                </button>
              </form>
            )}

            {notes.length === 0 ? (
              <p className="internal-work__empty">{t.notesEmpty}</p>
            ) : (
              <ul className="internal-work__list">
                {notes.map((note) => (
                  <li key={note.id} className="internal-work__note" data-testid="internal-note">
                    <p className="internal-work__note-meta">
                      <span className="internal-work__note-author">
                        {note.authorName || t.unknownAuthor}
                      </span>
                      <span className="internal-work__note-time">{dateTime(note.createdAt)}</span>
                      {note.editedAt ? (
                        <span className="internal-work__note-edited">{t.edited}</span>
                      ) : null}
                      <span className="internal-work__note-flag">{t.teamOnlyBadge}</span>
                    </p>

                    {editingId === note.id ? (
                      <div className="internal-work__edit">
                        <label className="internal-work__sr-only" htmlFor={`edit-${note.id}`}>
                          {t.editNote}
                        </label>
                        <textarea
                          id={`edit-${note.id}`}
                          className="internal-work__textarea"
                          rows={3}
                          value={editDraft}
                          maxLength={4000}
                          onChange={(e) => setEditDraft(e.target.value)}
                        />
                        <div className="internal-work__edit-actions">
                          <button
                            type="button"
                            className="internal-work__btn internal-work__btn--primary"
                            onClick={() => void submitEdit(note.id)}
                          >
                            {t.saveNote}
                          </button>
                          <button
                            type="button"
                            className="internal-work__btn"
                            onClick={() => { setEditingId(null); setEditDraft(""); }}
                          >
                            {t.cancel}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="internal-work__note-body">{note.body}</p>
                        {note.canEdit && !readOnly ? (
                          <button
                            type="button"
                            className="internal-work__btn internal-work__btn--link"
                            onClick={() => { setEditingId(note.id); setEditDraft(note.body); }}
                          >
                            {t.editNote}
                          </button>
                        ) : null}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── reminders ─────────────────────────────────────────────── */}
          <div className="internal-work__block">
            <h3 className="internal-work__subtitle">
              <CalendarClock size={18} strokeWidth={2} aria-hidden="true" />
              {t.remindersTitle}
            </h3>
            <p className="internal-work__composer-hint">{t.remindersHint}</p>

            {readOnly ? null : (
              <form className="internal-work__reminder-form" onSubmit={submitReminder}>
                <div className="internal-work__field">
                  <label className="internal-work__label" htmlFor="reminder-title">
                    {t.reminderTitleLabel}
                  </label>
                  <input
                    id="reminder-title"
                    className="internal-work__input"
                    value={reminderTitle}
                    maxLength={200}
                    placeholder={t.reminderPlaceholder}
                    onChange={(e) => setReminderTitle(e.target.value)}
                  />
                </div>
                <div className="internal-work__field">
                  <label className="internal-work__label" htmlFor="reminder-due">
                    {t.reminderDueLabel}
                  </label>
                  <input
                    id="reminder-due"
                    type="datetime-local"
                    className="internal-work__input"
                    value={reminderDue}
                    onChange={(e) => setReminderDue(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="internal-work__btn internal-work__btn--primary"
                  disabled={!reminderTitle.trim() || !reminderDue || savingReminder}
                >
                  {savingReminder ? t.saving : t.saveReminder}
                </button>
              </form>
            )}

            <div className="internal-work__filters" role="group" aria-label={t.filterLabel}>
              {["open", "completed", "all"].map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`internal-work__filter${reminderFilter === key ? " internal-work__filter--active" : ""}`}
                  aria-pressed={reminderFilter === key}
                  onClick={() => setReminderFilter(key)}
                >
                  {t[`filter_${key}`]}
                </button>
              ))}
            </div>

            {visibleReminders.length === 0 ? (
              <p className="internal-work__empty">{t.remindersEmpty}</p>
            ) : (
              <ul className="internal-work__list">
                {visibleReminders.map((r) => (
                  <li key={r.id} className="internal-work__reminder" data-testid="internal-reminder">
                    <p className="internal-work__reminder-head">
                      {/* Status as a word. Colour alone would fail anyone who
                          cannot distinguish it. */}
                      <span
                        className={`internal-work__status${r.completedAt ? " internal-work__status--done" : ""}`}
                      >
                        {r.completedAt ? t.statusDone : t.statusOpen}
                      </span>
                      <span className="internal-work__reminder-due">
                        {t.dueOn} {dateTime(r.dueAt)}
                      </span>
                    </p>
                    <p className="internal-work__reminder-title">{r.title}</p>
                    <p className="internal-work__note-meta">
                      <span>{r.createdByName || t.unknownAuthor}</span>
                      {r.assignedToName ? (
                        <span>{t.assignedTo} {r.assignedToName}</span>
                      ) : null}
                      <span className="internal-work__note-flag">{t.teamOnlyBadge}</span>
                    </p>
                    {!r.completedAt && !readOnly ? (
                      <button
                        type="button"
                        className="internal-work__btn"
                        onClick={() => void markDone(r.id)}
                      >
                        <Check size={16} strokeWidth={2} aria-hidden="true" />
                        {t.markDone}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
