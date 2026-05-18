import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authFetch } from "../../../api/authFetch.js";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  deletePracticeLogo,
  fetchPracticeLogoBlobUrl,
  fetchPracticeSettings,
  patchPracticeSettings,
  postPracticeDescriptionAiDraft,
  uploadPracticeLogo,
} from "../api/practiceSettingsApi.js";
import "../../../styles/PracticeDashboardPage.css";
import "../styles/PracticeSettingsPage.css";

function errLabel(code, t) {
  return t.errors?.[code] || t.saveError;
}

const EMPTY_FORM = {
  practiceName: "",
  specialty: "",
  description: "",
  website: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  postalCode: "",
  country: "",
  preferredDoctorLanguage: "de",
  supportedLanguages: "de",
  openingHours: "",
  patientIntroText: "",
  displayNameForPatients: "",
  accentColor: "#0F766E",
  organizationType: "",
  specialties: "",
  stateRegion: "",
  acceptsPublicInsurance: "",
  acceptsPrivateInsurance: "",
  acceptsSelfPay: "",
  emergencyCareAvailable: false,
  onlineAppointmentsAvailable: false,
  videoConsultationAvailable: false,
  accessibilityWheelchair: false,
  accessibilityElevator: false,
  accessibilityEntrance: false,
  accessibilityRestroom: false,
};

export default function PracticeSettingsPage() {
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practiceSettings || getMessages("en").practiceSettings,
    [language],
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const logoRevokeRef = useRef(null);

  const [practices, setPractices] = useState([]);
  const [practiceId, setPracticeId] = useState(() => searchParams.get("practiceId") || "");
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [logoPreview, setLogoPreview] = useState(null);
  const [hasUploadedLogo, setHasUploadedLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [aiNotes, setAiNotes] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const loadPractices = useCallback(async () => {
    const res = await authFetch("/api/practices");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error("load_failed");
    return Array.isArray(data.practices) ? data.practices : [];
  }, []);

  const applySettings = useCallback(
    async (settings) => {
      if (logoRevokeRef.current) {
        URL.revokeObjectURL(logoRevokeRef.current);
        logoRevokeRef.current = null;
      }
      setForm({
        practiceName: settings.practiceName || "",
        specialty: settings.specialty || "",
        description: settings.description || "",
        website: settings.website || "",
        phone: settings.phone || "",
        email: settings.email || "",
        address: settings.address || "",
        city: settings.city || "",
        postalCode: settings.postalCode || "",
        country: settings.country || "",
        preferredDoctorLanguage: settings.preferredDoctorLanguage || "de",
        supportedLanguages: (settings.supportedLanguages || ["de"]).join(", "),
        openingHours: settings.openingHours || "",
        patientIntroText: settings.patientIntroText || "",
        displayNameForPatients: settings.displayNameForPatients || "",
        accentColor: settings.accentColor || "#0F766E",
        organizationType: settings.organization?.organizationType || "",
        specialties: (settings.organization?.specialties || []).join(", "),
        stateRegion: settings.organization?.stateRegion || "",
        acceptsPublicInsurance: settings.organization?.acceptsPublicInsurance || "",
        acceptsPrivateInsurance: settings.organization?.acceptsPrivateInsurance || "",
        acceptsSelfPay: settings.organization?.acceptsSelfPay || "",
        emergencyCareAvailable: Boolean(settings.organization?.emergencyCareAvailable),
        onlineAppointmentsAvailable: Boolean(
          settings.organization?.onlineAppointmentsAvailable,
        ),
        videoConsultationAvailable: Boolean(
          settings.organization?.videoConsultationAvailable,
        ),
        accessibilityWheelchair: Boolean(settings.organization?.accessibility?.wheelchair),
        accessibilityElevator: Boolean(settings.organization?.accessibility?.elevator),
        accessibilityEntrance: Boolean(
          settings.organization?.accessibility?.accessibleEntrance,
        ),
        accessibilityRestroom: Boolean(
          settings.organization?.accessibility?.accessibleRestroom,
        ),
      });
      setCanManage(Boolean(settings.canManage));
      setHasUploadedLogo(Boolean(settings.hasUploadedLogo));
      if (settings.logoUrl) {
        const blob = await fetchPracticeLogoBlobUrl(settings.logoUrl);
        if (blob) {
          logoRevokeRef.current = blob;
          setLogoPreview(blob);
        } else if (String(settings.logoUrl).startsWith("http")) {
          setLogoPreview(settings.logoUrl);
        } else {
          setLogoPreview(null);
        }
      } else {
        setLogoPreview(null);
      }
    },
    [],
  );

  const loadSettings = useCallback(async () => {
    if (!practiceId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchPracticeSettings(practiceId);
      if (!res.ok || !data.ok) throw new Error(data.error || "load_failed");
      await applySettings(data.settings);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [practiceId, applySettings, t.loadError]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    loadPractices()
      .then((rows) => {
        setPractices(rows);
        if (!practiceId && rows[0]?.id) setPracticeId(rows[0].id);
      })
      .catch(() => setError(t.loadError));
  }, [loadPractices, practiceId, t.loadError]);

  useEffect(() => {
    if (practiceId) {
      setSearchParams({ practiceId }, { replace: true });
      void loadSettings();
    }
  }, [practiceId, loadSettings, setSearchParams]);

  useEffect(
    () => () => {
      if (logoRevokeRef.current) URL.revokeObjectURL(logoRevokeRef.current);
    },
    [],
  );

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!canManage || !practiceId) return;
    setSaving(true);
    setStatusMsg("");
    setError("");
    try {
      const langs = form.supportedLanguages
        .split(/[,;\s]+/)
        .map((x) => x.trim())
        .filter(Boolean);
      const specialties = form.specialties
        .split(/[,;]+/)
        .map((x) => x.trim())
        .filter(Boolean);
      const { res, data } = await patchPracticeSettings(practiceId, {
        practiceName: form.practiceName,
        specialty: form.specialty,
        description: form.description,
        website: form.website,
        phone: form.phone,
        email: form.email,
        address: form.address,
        city: form.city,
        postalCode: form.postalCode,
        country: form.country,
        preferredDoctorLanguage: form.preferredDoctorLanguage,
        supportedLanguages: langs,
        openingHours: form.openingHours,
        patientIntroText: form.patientIntroText,
        displayNameForPatients: form.displayNameForPatients,
        accentColor: form.accentColor,
        organizationType: form.organizationType || null,
        specialties,
        stateRegion: form.stateRegion || null,
        acceptsPublicInsurance: form.acceptsPublicInsurance || null,
        acceptsPrivateInsurance: form.acceptsPrivateInsurance || null,
        acceptsSelfPay: form.acceptsSelfPay || null,
        emergencyCareAvailable: form.emergencyCareAvailable,
        onlineAppointmentsAvailable: form.onlineAppointmentsAvailable,
        videoConsultationAvailable: form.videoConsultationAvailable,
        accessibility: {
          wheelchair: form.accessibilityWheelchair,
          elevator: form.accessibilityElevator,
          accessibleEntrance: form.accessibilityEntrance,
          accessibleRestroom: form.accessibilityRestroom,
        },
      });
      if (!res.ok || !data.ok) throw new Error(data.error || "save_failed");
      await applySettings(data.settings);
      setStatusMsg(t.saved);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setError(errLabel(e.message, t));
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !canManage) return;
    setLogoBusy(true);
    setError("");
    try {
      const { res, data } = await uploadPracticeLogo(practiceId, file);
      if (!res.ok || !data.ok) throw new Error(data.error || "upload_failed");
      await applySettings(data.settings);
      setStatusMsg(t.saved);
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") return;
      setError(errLabel(err.message, t));
    } finally {
      setLogoBusy(false);
    }
  }

  async function handleLogoDelete() {
    if (!canManage) return;
    setLogoBusy(true);
    setError("");
    try {
      const { res, data } = await deletePracticeLogo(practiceId);
      if (!res.ok || !data.ok) throw new Error(data.error || "delete_failed");
      await applySettings(data.settings);
      setStatusMsg(t.saved);
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") return;
      setError(errLabel(err.message, t));
    } finally {
      setLogoBusy(false);
    }
  }

  async function handleAiDraft() {
    if (!canManage) return;
    setAiBusy(true);
    setAiText("");
    setError("");
    try {
      const { res, data } = await postPracticeDescriptionAiDraft(practiceId, {
        locale: language,
        draftNotes: aiNotes,
        currentDescription: form.description,
      });
      if (!res.ok || !data.ok) throw new Error("ai_failed");
      setAiText(data.text || "");
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setAiText(t.aiError);
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="practice-dashboard practice-settings">
      <div className="practice-dashboard__inner">
        <header className="practice-dashboard__header">
          <Link className="practice-dashboard__back" to="/practice">
            {t.backHub}
          </Link>
          <h1 className="practice-dashboard__title">{t.heading}</h1>
          <p className="practice-dashboard__intro">{t.intro}</p>
        </header>

        {practices.length > 1 ? (
          <label className="practice-dashboard__field">
            <span>{t.selectPractice}</span>
            <select
              value={practiceId}
              onChange={(e) => setPracticeId(e.target.value)}
              aria-label={t.selectPractice}
            >
              {practices.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.practiceName}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {loading ? <p className="practice-dashboard__muted">{t.loading}</p> : null}
        {error ? (
          <p className="practice-dashboard__error" role="alert">
            {error}
          </p>
        ) : null}
        {statusMsg ? (
          <p className="practice-dashboard__muted" role="status">
            {statusMsg}
          </p>
        ) : null}
        {!canManage && !loading ? (
          <p className="practice-settings__readonly" role="status">
            {t.readOnlyNotice}
          </p>
        ) : null}

        {!loading && practiceId ? (
          <form className="practice-settings__form" onSubmit={handleSave}>
            <section className="practice-settings__section" aria-labelledby="ps-profile">
              <h2 id="ps-profile" className="practice-settings__section-title">
                {t.sectionProfile}
              </h2>
              <div className="practice-settings__grid">
                <label>
                  <span>{t.practiceName}</span>
                  <input
                    required
                    value={form.practiceName}
                    disabled={!canManage}
                    onChange={(e) => updateField("practiceName", e.target.value)}
                  />
                </label>
                <label>
                  <span>{t.specialty}</span>
                  <input
                    value={form.specialty}
                    disabled={!canManage}
                    onChange={(e) => updateField("specialty", e.target.value)}
                  />
                </label>
              </div>
              <label className="practice-settings__full">
                <span>{t.description}</span>
                <textarea
                  rows={4}
                  value={form.description}
                  disabled={!canManage}
                  onChange={(e) => updateField("description", e.target.value)}
                />
              </label>
              {canManage ? (
                <div className="practice-settings__ai">
                  <label>
                    <span>{t.aiDescriptionNotes}</span>
                    <input
                      type="text"
                      value={aiNotes}
                      onChange={(e) => setAiNotes(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="practice-dashboard__link-btn"
                    disabled={aiBusy}
                    onClick={() => void handleAiDraft()}
                  >
                    {aiBusy ? t.aiDescriptionLoading : t.aiDescription}
                  </button>
                  {aiText ? (
                    <div className="practice-settings__ai-output" role="region">
                      <p className="practice-settings__ai-label">{t.aiSuggestionLabel}</p>
                      <p className="practice-dashboard__muted">{t.aiHint}</p>
                      <pre>{aiText}</pre>
                      <button
                        type="button"
                        className="practice-dashboard__link-btn"
                        onClick={() => {
                          updateField("description", aiText);
                          setAiText("");
                        }}
                      >
                        {t.aiApply}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="practice-settings__section" aria-labelledby="ps-org">
              <h2 id="ps-org" className="practice-settings__section-title">
                {tOrg.sectionOrganization}
              </h2>
              <div className="practice-settings__grid">
                <label>
                  <span>{tOrg.sectionOrganization}</span>
                  <select
                    value={form.organizationType}
                    disabled={!canManage}
                    onChange={(e) => updateField("organizationType", e.target.value)}
                  >
                    <option value="">—</option>
                    <option value="single_practice">{tOrg.orgTypeSingle}</option>
                    <option value="group_practice">{tOrg.orgTypeGroup}</option>
                    <option value="mvz">{tOrg.orgTypeMvz}</option>
                    <option value="clinic">{tOrg.orgTypeClinic}</option>
                    <option value="outpatient">{tOrg.orgTypeOutpatient}</option>
                    <option value="other">{tOrg.orgTypeOther}</option>
                  </select>
                </label>
                <label className="practice-settings__full">
                  <span>{tOrg.specialties}</span>
                  <input
                    value={form.specialties}
                    disabled={!canManage}
                    onChange={(e) => updateField("specialties", e.target.value)}
                  />
                </label>
                <label>
                  <span>{tOrg.stateRegion}</span>
                  <input
                    value={form.stateRegion}
                    disabled={!canManage}
                    onChange={(e) => updateField("stateRegion", e.target.value)}
                  />
                </label>
                {[
                  ["acceptsPublicInsurance", tOrg.acceptsPublicInsurance],
                  ["acceptsPrivateInsurance", tOrg.acceptsPrivateInsurance],
                  ["acceptsSelfPay", tOrg.acceptsSelfPay],
                ].map(([key, label]) => (
                  <label key={key}>
                    <span>{label}</span>
                    <select
                      value={form[key]}
                      disabled={!canManage}
                      onChange={(e) => updateField(key, e.target.value)}
                    >
                      <option value="">—</option>
                      <option value="yes">{tOrg.insuranceYes}</option>
                      <option value="no">{tOrg.insuranceNo}</option>
                      <option value="unknown">{tOrg.insuranceUnknown}</option>
                    </select>
                  </label>
                ))}
                <label className="practice-settings__checkbox">
                  <input
                    type="checkbox"
                    checked={form.emergencyCareAvailable}
                    disabled={!canManage}
                    onChange={(e) => updateField("emergencyCareAvailable", e.target.checked)}
                  />
                  <span>{tOrg.emergencyCare}</span>
                </label>
                <label className="practice-settings__checkbox">
                  <input
                    type="checkbox"
                    checked={form.onlineAppointmentsAvailable}
                    disabled={!canManage}
                    onChange={(e) =>
                      updateField("onlineAppointmentsAvailable", e.target.checked)
                    }
                  />
                  <span>{tOrg.onlineAppointments}</span>
                </label>
                <label className="practice-settings__checkbox">
                  <input
                    type="checkbox"
                    checked={form.videoConsultationAvailable}
                    disabled={!canManage}
                    onChange={(e) =>
                      updateField("videoConsultationAvailable", e.target.checked)
                    }
                  />
                  <span>{tOrg.videoConsultation}</span>
                </label>
              </div>
              <fieldset className="practice-settings__fieldset">
                <legend>{tOrg.accessibilityHeading}</legend>
                {[
                  ["accessibilityWheelchair", tOrg.wheelchair],
                  ["accessibilityElevator", tOrg.elevator],
                  ["accessibilityEntrance", tOrg.accessibleEntrance],
                  ["accessibilityRestroom", tOrg.accessibleRestroom],
                ].map(([key, label]) => (
                  <label key={key} className="practice-settings__checkbox">
                    <input
                      type="checkbox"
                      checked={form[key]}
                      disabled={!canManage}
                      onChange={(e) => updateField(key, e.target.checked)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </fieldset>
            </section>

            <section className="practice-settings__section" aria-labelledby="ps-contact">
              <h2 id="ps-contact" className="practice-settings__section-title">
                {t.sectionContact}
              </h2>
              <div className="practice-settings__grid">
                <label>
                  <span>{t.phone}</span>
                  <input
                    type="tel"
                    value={form.phone}
                    disabled={!canManage}
                    onChange={(e) => updateField("phone", e.target.value)}
                  />
                </label>
                <label>
                  <span>{t.email}</span>
                  <input
                    type="email"
                    value={form.email}
                    disabled={!canManage}
                    onChange={(e) => updateField("email", e.target.value)}
                  />
                </label>
                <label>
                  <span>{t.website}</span>
                  <input
                    type="url"
                    value={form.website}
                    disabled={!canManage}
                    onChange={(e) => updateField("website", e.target.value)}
                  />
                </label>
                <label className="practice-settings__full">
                  <span>{t.address}</span>
                  <input
                    value={form.address}
                    disabled={!canManage}
                    onChange={(e) => updateField("address", e.target.value)}
                  />
                </label>
                <label>
                  <span>{t.postalCode}</span>
                  <input
                    value={form.postalCode}
                    disabled={!canManage}
                    onChange={(e) => updateField("postalCode", e.target.value)}
                  />
                </label>
                <label>
                  <span>{t.city}</span>
                  <input
                    value={form.city}
                    disabled={!canManage}
                    onChange={(e) => updateField("city", e.target.value)}
                  />
                </label>
                <label>
                  <span>{t.country}</span>
                  <input
                    value={form.country}
                    disabled={!canManage}
                    onChange={(e) => updateField("country", e.target.value)}
                  />
                </label>
                <label>
                  <span>{t.preferredLanguage}</span>
                  <select
                    value={form.preferredDoctorLanguage}
                    disabled={!canManage}
                    onChange={(e) => updateField("preferredDoctorLanguage", e.target.value)}
                  >
                    <option value="de">Deutsch</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <label>
                  <span>{t.supportedLanguages}</span>
                  <input
                    value={form.supportedLanguages}
                    disabled={!canManage}
                    onChange={(e) => updateField("supportedLanguages", e.target.value)}
                  />
                </label>
              </div>
            </section>

            <section className="practice-settings__section" aria-labelledby="ps-hours">
              <h2 id="ps-hours" className="practice-settings__section-title">
                {t.sectionHours}
              </h2>
              <label className="practice-settings__full">
                <span>{t.openingHours}</span>
                <textarea
                  rows={2}
                  value={form.openingHours}
                  disabled={!canManage}
                  onChange={(e) => updateField("openingHours", e.target.value)}
                  aria-describedby="ps-hours-hint"
                />
                <span id="ps-hours-hint" className="practice-dashboard__muted">
                  {t.openingHoursHint}
                </span>
              </label>
            </section>

            <section className="practice-settings__section" aria-labelledby="ps-branding">
              <h2 id="ps-branding" className="practice-settings__section-title">
                {t.sectionBranding}
              </h2>
              <div className="practice-settings__grid">
                <label>
                  <span>{t.displayNamePatients}</span>
                  <input
                    value={form.displayNameForPatients}
                    disabled={!canManage}
                    onChange={(e) => updateField("displayNameForPatients", e.target.value)}
                  />
                </label>
                <label>
                  <span>{t.accentColor}</span>
                  <input
                    type="color"
                    value={form.accentColor?.startsWith("#") ? form.accentColor : "#0F766E"}
                    disabled={!canManage}
                    onChange={(e) => updateField("accentColor", e.target.value.toUpperCase())}
                    aria-describedby="ps-accent-hint"
                  />
                  <span id="ps-accent-hint" className="practice-dashboard__muted">
                    {t.accentColorHint}
                  </span>
                </label>
              </div>
              <label className="practice-settings__full">
                <span>{t.patientHint}</span>
                <textarea
                  rows={2}
                  value={form.patientIntroText}
                  disabled={!canManage}
                  onChange={(e) => updateField("patientIntroText", e.target.value)}
                />
              </label>
              <div className="practice-settings__logo">
                <span className="practice-settings__logo-label">{t.logo}</span>
                {logoPreview ? (
                  <img src={logoPreview} alt={t.logoPreviewAlt} className="practice-settings__logo-img" />
                ) : null}
                {canManage ? (
                  <div className="practice-settings__logo-actions">
                    <label className="practice-dashboard__link-btn practice-settings__file-label">
                      {logoBusy ? t.logoUploading : t.logoUpload}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="practice-settings__file-input"
                        disabled={logoBusy}
                        onChange={handleLogoUpload}
                      />
                    </label>
                    {hasUploadedLogo || logoPreview ? (
                      <button
                        type="button"
                        className="practice-dashboard__link-btn"
                        disabled={logoBusy}
                        onClick={() => void handleLogoDelete()}
                      >
                        {t.logoDelete}
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <p className="practice-dashboard__muted">{t.logoHint}</p>
              </div>
            </section>

            <section className="practice-settings__section" aria-labelledby="ps-privacy">
              <h2 id="ps-privacy" className="practice-settings__section-title">
                {t.sectionPrivacy}
              </h2>
              <p className="practice-dashboard__safety" role="note">
                {t.privacyNote}
              </p>
            </section>

            <section className="practice-settings__section" aria-labelledby="ps-team">
              <h2 id="ps-team" className="practice-settings__section-title">
                {t.sectionTeam}
              </h2>
              <p className="practice-dashboard__muted">{t.teamLinkDesc}</p>
              <Link
                className="practice-dashboard__link-btn"
                to={`/practice/team?practiceId=${encodeURIComponent(practiceId)}`}
              >
                {t.teamLink}
              </Link>
            </section>

            {canManage ? (
              <div className="practice-settings__submit">
                <button
                  type="submit"
                  className="patient-threads__btn patient-threads__btn--primary"
                  disabled={saving}
                  aria-busy={saving}
                >
                  {saving ? t.saving : t.save}
                </button>
              </div>
            ) : null}
          </form>
        ) : null}
      </div>
    </div>
  );
}
