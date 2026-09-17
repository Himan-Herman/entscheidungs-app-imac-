import { useEffect, useRef, useState } from "react";

/**
 * Create one practice-local patient record.
 *
 * Only the fields the backend actually stores appear here. Nothing on this form
 * connects an account, and nothing looks anybody up: the e-mail is a delivery
 * address, never an identity check, and the form says so.
 */
export default function AddPatientEntryDialog({ tx, onCancel, onCreate }) {
  const [form, setForm] = useState({
    givenName: "", familyName: "", dateOfBirth: "",
    email: "", phone: "", practiceRecordNumber: "",
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const dialogRef = useRef(null);
  const firstFieldRef = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    firstFieldRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape" && !saving) { e.preventDefault(); onCancel(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
    };
  }, [onCancel, saving]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (saving) return;

    const givenName = form.givenName.trim();
    const familyName = form.familyName.trim();
    if (!givenName || !familyName) { setError(tx.form.required); return; }
    if (form.dateOfBirth && Number.isNaN(new Date(form.dateOfBirth).getTime())) {
      setError(tx.form.invalidDate); return;
    }
    if (form.email && !form.email.includes("@")) { setError(tx.form.invalidEmail); return; }

    setError(null);
    setSaving(true);
    try {
      await onCreate({
        givenName,
        familyName,
        dateOfBirth: form.dateOfBirth || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        practiceRecordNumber: form.practiceRecordNumber.trim() || null,
      });
    } catch (err) {
      // The server's own validation codes, mapped to the sentences the form
      // already has; anything unexpected stays generic rather than leaking.
      const byCode = {
        validation_name_required: tx.form.required,
        validation_invalid_date: tx.form.invalidDate,
        validation_invalid_email: tx.form.invalidEmail,
      };
      setError(byCode[err?.code] || tx.form.error);
      setSaving(false);
    }
  }

  return (
    <div className="onboarding-modal__backdrop" onMouseDown={(e) => {
      if (e.target === e.currentTarget && !saving) onCancel();
    }}>
      <div
        className="onboarding-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-entry-title"
        ref={dialogRef}
      >
        <h2 id="add-entry-title" className="onboarding-modal__title">{tx.form.title}</h2>
        <p className="onboarding-modal__hint">{tx.form.description}</p>

        <form onSubmit={submit} noValidate>
          <div className="onboarding-grid">
            <label className="onboarding-field">
              <span className="onboarding-field__label">{tx.form.givenName} *</span>
              <input
                className="onboarding-field__input" ref={firstFieldRef} required
                value={form.givenName} onChange={set("givenName")} autoComplete="off"
              />
            </label>
            <label className="onboarding-field">
              <span className="onboarding-field__label">{tx.form.familyName} *</span>
              <input
                className="onboarding-field__input" required
                value={form.familyName} onChange={set("familyName")} autoComplete="off"
              />
            </label>
            <label className="onboarding-field">
              <span className="onboarding-field__label">{tx.form.dateOfBirth}</span>
              <input
                className="onboarding-field__input" type="date"
                value={form.dateOfBirth} onChange={set("dateOfBirth")}
                aria-describedby="dob-hint"
              />
              <span className="onboarding-field__hint" id="dob-hint">{tx.form.dateOfBirthHint}</span>
            </label>
            <label className="onboarding-field">
              <span className="onboarding-field__label">{tx.form.email}</span>
              <input
                className="onboarding-field__input" type="email" inputMode="email"
                value={form.email} onChange={set("email")} autoComplete="off"
                aria-describedby="email-hint"
              />
              <span className="onboarding-field__hint" id="email-hint">{tx.form.emailHint}</span>
            </label>
            <label className="onboarding-field">
              <span className="onboarding-field__label">{tx.form.phone}</span>
              <input
                className="onboarding-field__input" type="tel" inputMode="tel"
                value={form.phone} onChange={set("phone")} autoComplete="off"
              />
            </label>
            <label className="onboarding-field">
              <span className="onboarding-field__label">{tx.form.recordNumber}</span>
              <input
                className="onboarding-field__input"
                value={form.practiceRecordNumber} onChange={set("practiceRecordNumber")}
                autoComplete="off" aria-describedby="record-hint"
              />
              <span className="onboarding-field__hint" id="record-hint">{tx.form.recordNumberHint}</span>
            </label>
          </div>

          {error && (
            <p className="onboarding-alert onboarding-alert--error" role="alert">{error}</p>
          )}

          <div className="onboarding-modal__actions">
            <button
              type="button" className="onboarding-btn onboarding-btn--ghost"
              onClick={onCancel} disabled={saving}
            >
              {tx.form.cancel}
            </button>
            {/* Disabled while in flight: a double submit would create two records. */}
            <button type="submit" className="onboarding-btn" disabled={saving}>
              {saving ? tx.form.saving : tx.form.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
