import { ChevronDown } from "lucide-react";

/** @typedef {import("../utils/sessionMetadata.js").LiveTranslationPracticeInfo} LiveTranslationPracticeInfo */

/**
 * @param {{
 *   t: Record<string, string>;
 *   practice: LiveTranslationPracticeInfo;
 *   onChange: (field: keyof LiveTranslationPracticeInfo, value: string) => void;
 * }} props
 */
export default function SetupPracticeAccordion({ t, practice, onChange }) {
  const fields = [
    { id: "live-translation-practice-name", key: "practiceName", label: t.practiceNameLabel, autoComplete: "organization" },
    { id: "live-translation-doctor-name", key: "doctorName", label: t.doctorNameLabel, autoComplete: "name" },
    { id: "live-translation-specialty", key: "specialty", label: t.specialtyLabel, autoComplete: "off" },
    { id: "live-translation-practice-address", key: "practiceAddress", label: t.practiceAddressLabel, autoComplete: "street-address" },
    { id: "live-translation-insurance", key: "insurance", label: t.insuranceLabel, autoComplete: "off" },
    {
      id: "live-translation-appointment-note",
      key: "appointmentNote",
      label: t.appointmentNoteLabel,
      autoComplete: "off",
      multiline: true,
    },
  ];

  return (
    <details className="live-translation__accordion">
      <summary className="live-translation__accordion-summary" aria-label={t.practiceAccordionAria}>
        <span>{t.practiceAccordionTitle}</span>
        <ChevronDown size={18} className="live-translation__accordion-icon" aria-hidden />
      </summary>
      <div className="live-translation__accordion-panel">
        {fields.map((field) => (
          <div key={field.key} className="live-translation__field">
            <label htmlFor={field.id}>{field.label}</label>
            {field.multiline ? (
              <textarea
                id={field.id}
                rows={3}
                autoComplete={field.autoComplete}
                value={practice[field.key]}
                onChange={(e) => onChange(/** @type {keyof LiveTranslationPracticeInfo} */ (field.key), e.target.value)}
              />
            ) : (
              <input
                id={field.id}
                type="text"
                autoComplete={field.autoComplete}
                value={practice[field.key]}
                onChange={(e) => onChange(/** @type {keyof LiveTranslationPracticeInfo} */ (field.key), e.target.value)}
              />
            )}
          </div>
        ))}
      </div>
    </details>
  );
}
