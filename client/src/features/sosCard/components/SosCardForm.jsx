import { useState } from "react";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "0+", "0-", "O+", "O-"];

/**
 * @param {{
 *   card: object | null;
 *   saving: boolean;
 *   onSave: (data: object) => void;
 *   t: object;
 * }} props
 */
export default function SosCardForm({ card, saving, onSave, t }) {
  const [bloodType, setBloodType] = useState(card?.bloodType || "");
  const [ec1Name, setEc1Name] = useState(card?.emergencyContact1Name || "");
  const [ec1Phone, setEc1Phone] = useState(card?.emergencyContact1Phone || "");
  const [ec2Name, setEc2Name] = useState(card?.emergencyContact2Name || "");
  const [ec2Phone, setEc2Phone] = useState(card?.emergencyContact2Phone || "");
  const [note, setNote] = useState(card?.firstResponderNote || "");

  function handleSubmit(e) {
    e.preventDefault();
    onSave({
      bloodType: bloodType || null,
      emergencyContact1Name: ec1Name || null,
      emergencyContact1Phone: ec1Phone || null,
      emergencyContact2Name: ec2Name || null,
      emergencyContact2Phone: ec2Phone || null,
      firstResponderNote: note || null,
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="sos-card__section">
        <p className="sos-card__section-title">{t.bloodTypeSection}</p>
        <div className="sos-card__field">
          <label className="sos-card__label" htmlFor="sos-blood-type">
            {t.bloodTypeLabel}
          </label>
          <select
            id="sos-blood-type"
            className="sos-card__select"
            value={bloodType}
            onChange={(e) => setBloodType(e.target.value)}
          >
            <option value="">{t.bloodTypeNone}</option>
            {BLOOD_TYPES.map((bt) => (
              <option key={bt} value={bt}>
                {bt}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="sos-card__section">
        <p className="sos-card__section-title">{t.contactsSection}</p>
        <div className="sos-card__row sos-card__field">
          <div>
            <label className="sos-card__label" htmlFor="sos-ec1-name">
              {t.contact1Name}
            </label>
            <input
              id="sos-ec1-name"
              className="sos-card__input"
              type="text"
              maxLength={120}
              value={ec1Name}
              onChange={(e) => setEc1Name(e.target.value)}
              placeholder={t.contactNamePlaceholder}
            />
          </div>
          <div>
            <label className="sos-card__label" htmlFor="sos-ec1-phone">
              {t.contact1Phone}
            </label>
            <input
              id="sos-ec1-phone"
              className="sos-card__input"
              type="tel"
              maxLength={40}
              value={ec1Phone}
              onChange={(e) => setEc1Phone(e.target.value)}
              placeholder="+49 123 456789"
            />
          </div>
        </div>
        <div className="sos-card__row sos-card__field">
          <div>
            <label className="sos-card__label" htmlFor="sos-ec2-name">
              {t.contact2Name}
            </label>
            <input
              id="sos-ec2-name"
              className="sos-card__input"
              type="text"
              maxLength={120}
              value={ec2Name}
              onChange={(e) => setEc2Name(e.target.value)}
              placeholder={t.contactNamePlaceholder}
            />
          </div>
          <div>
            <label className="sos-card__label" htmlFor="sos-ec2-phone">
              {t.contact2Phone}
            </label>
            <input
              id="sos-ec2-phone"
              className="sos-card__input"
              type="tel"
              maxLength={40}
              value={ec2Phone}
              onChange={(e) => setEc2Phone(e.target.value)}
              placeholder="+49 123 456789"
            />
          </div>
        </div>
      </div>

      <div className="sos-card__section">
        <p className="sos-card__section-title">{t.noteSection}</p>
        <div className="sos-card__field">
          <label className="sos-card__label" htmlFor="sos-note">
            {t.noteLabel}
          </label>
          <textarea
            id="sos-note"
            className="sos-card__textarea"
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t.notePlaceholder}
          />
          <p className="sos-card__label" style={{ marginTop: "0.25rem" }}>
            {t.noteHint}
          </p>
        </div>
      </div>

      <div className="sos-card__actions">
        <button type="submit" className="sos-card__btn sos-card__btn--primary" disabled={saving}>
          {saving ? t.saving : t.save}
        </button>
      </div>
    </form>
  );
}
