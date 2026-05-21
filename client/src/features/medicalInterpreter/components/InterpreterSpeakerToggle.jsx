import { SPEAKER_DOCTOR, SPEAKER_PATIENT } from "../constants.js";

/**
 * @param {{
 *   speaker: 'patient'|'doctor';
 *   onSpeakerChange: (s: 'patient'|'doctor') => void;
 *   disabled?: boolean;
 *   labels: object;
 * }} props
 */
export default function InterpreterSpeakerToggle({
  speaker,
  onSpeakerChange,
  disabled = false,
  labels: t,
}) {
  return (
    <div
      className="interpreter-live__speaker"
      role="group"
      aria-label={t.aria.speakerRole}
    >
      <button
        type="button"
        className={`interpreter-live__speaker-btn${speaker === SPEAKER_PATIENT ? " interpreter-live__speaker-btn--active" : ""}`}
        aria-pressed={speaker === SPEAKER_PATIENT}
        disabled={disabled}
        onClick={() => onSpeakerChange(SPEAKER_PATIENT)}
      >
        {t.room.speakerTogglePatient}
      </button>
      <button
        type="button"
        className={`interpreter-live__speaker-btn${speaker === SPEAKER_DOCTOR ? " interpreter-live__speaker-btn--active" : ""}`}
        aria-pressed={speaker === SPEAKER_DOCTOR}
        disabled={disabled}
        onClick={() => onSpeakerChange(SPEAKER_DOCTOR)}
      >
        {t.room.speakerToggleClinician}
      </button>
    </div>
  );
}
