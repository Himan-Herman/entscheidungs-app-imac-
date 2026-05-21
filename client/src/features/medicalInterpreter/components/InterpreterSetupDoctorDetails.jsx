/**
 * @param {{
 *   open: boolean;
 *   onToggle: (open: boolean) => void;
 *   conversationTitle: string;
 *   doctorName: string;
 *   practiceName: string;
 *   specialty: string;
 *   appointmentDateTime: string;
 *   onFieldChange: (field: string, value: string) => void;
 *   labels: object;
 * }} props
 */
export default function InterpreterSetupDoctorDetails({
  open,
  onToggle,
  conversationTitle,
  doctorName,
  practiceName,
  specialty,
  appointmentDateTime,
  onFieldChange,
  labels: t,
}) {
  return (
    <section className="interpreter-setup__section interpreter-setup__section--optional">
      <details
        className="interpreter-setup__details"
        open={open}
        onToggle={(e) => onToggle(e.currentTarget.open)}
      >
        <summary className="interpreter-setup__summary">
          {open ? t.doctorInfo.toggleHide : t.doctorInfo.toggleShow}
        </summary>
        <p className="interpreter-setup__hint">{t.doctorInfo.intro}</p>

        <div className="interpreter-setup__field">
          <label className="interpreter-setup__label" htmlFor="interp-conversation-title">
            {t.doctorInfo.conversationTitle}
          </label>
          <input
            id="interp-conversation-title"
            type="text"
            className="interpreter-setup__input"
            value={conversationTitle}
            onChange={(e) => onFieldChange("conversationTitle", e.target.value)}
            placeholder={t.doctorInfo.conversationTitlePlaceholder}
            autoComplete="off"
            maxLength={200}
          />
        </div>

        <div className="interpreter-setup__field">
          <label className="interpreter-setup__label" htmlFor="interp-doctor-name">
            {t.doctorInfo.doctorName}
          </label>
          <input
            id="interp-doctor-name"
            type="text"
            className="interpreter-setup__input"
            value={doctorName}
            onChange={(e) => onFieldChange("doctorName", e.target.value)}
            placeholder={t.doctorInfo.doctorNamePlaceholder}
            autoComplete="name"
            maxLength={200}
          />
        </div>

        <div className="interpreter-setup__field">
          <label className="interpreter-setup__label" htmlFor="interp-practice-name">
            {t.doctorInfo.practiceName}
          </label>
          <input
            id="interp-practice-name"
            type="text"
            className="interpreter-setup__input"
            value={practiceName}
            onChange={(e) => onFieldChange("practiceName", e.target.value)}
            placeholder={t.doctorInfo.practiceNamePlaceholder}
            autoComplete="organization"
            maxLength={200}
          />
        </div>

        <div className="interpreter-setup__field">
          <label className="interpreter-setup__label" htmlFor="interp-specialty">
            {t.doctorInfo.specialty}
          </label>
          <input
            id="interp-specialty"
            type="text"
            className="interpreter-setup__input"
            value={specialty}
            onChange={(e) => onFieldChange("specialty", e.target.value)}
            placeholder={t.doctorInfo.specialtyPlaceholder}
            autoComplete="off"
            maxLength={120}
          />
        </div>

        <div className="interpreter-setup__field">
          <label className="interpreter-setup__label" htmlFor="interp-appointment">
            {t.doctorInfo.appointmentDate}
          </label>
          <input
            id="interp-appointment"
            type="datetime-local"
            className="interpreter-setup__input"
            value={appointmentDateTime}
            onChange={(e) => onFieldChange("appointmentDateTime", e.target.value)}
          />
        </div>
      </details>
    </section>
  );
}
