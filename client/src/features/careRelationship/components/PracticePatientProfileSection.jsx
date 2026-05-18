import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  fetchPracticePatientProfile,
  postPracticePatientProfileAiSummary,
} from "../api/practicePatientProfileApi.js";
import "../../../styles/PracticePatientsPage.css";

function insuranceLabel(value, t) {
  const map = {
    statutory: t.insuranceStatutory,
    private: t.insurancePrivate,
    self_pay: t.insuranceSelfPay,
    other: t.insuranceOther,
    prefer_not_say: t.insurancePreferNotSay,
  };
  return map[value] || value || t.noValue;
}

function ProfileField({ label, value, sourceLabel }) {
  const display = value?.trim() ? value : "—";
  return (
    <div className="practice-patients__detail-row">
      <dt>{label}</dt>
      <dd>
        {display}
        <span className="practice-dashboard__muted" style={{ display: "block", fontSize: "0.85rem" }}>
          {sourceLabel}
        </span>
      </dd>
    </div>
  );
}

/**
 * @param {{ linkId: string, practiceId: string }} props
 */
export default function PracticePatientProfileSection({
  linkId,
  practiceId,
  readOnly = false,
}) {
  const { language } = useLanguage();
  const t = useMemo(
    () =>
      getMessages(language).practicePatientProfile ||
      getMessages("en").practicePatientProfile,
    [language],
  );

  const [profile, setProfile] = useState(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!linkId || !practiceId) return;
    setLoading(true);
    setError("");
    setDenied(false);
    try {
      const { res, data } = await fetchPracticePatientProfile(linkId, practiceId);
      if (res.status === 404 && data.error === "feature_disabled") {
        setError(t.featureDisabled);
        return;
      }
      if (res.status === 403 && data.error === "profile_access_denied") {
        setDenied(true);
        setProfile(null);
        return;
      }
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setProfile(data.profile);
    } catch {
      setError(t.loadError);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [linkId, practiceId, t.featureDisabled, t.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadAiSummary() {
    if (!linkId || !practiceId || readOnly) return;
    setAiLoading(true);
    setAiError("");
    setAiSummary("");
    try {
      const { res, data } = await postPracticePatientProfileAiSummary(
        linkId,
        practiceId,
        language,
      );
      if (res.status === 503 && data.error === "ai_not_configured") {
        setAiError(t.aiNotConfigured);
        return;
      }
      if (!res.ok || !data.ok) {
        setAiError(t.aiSummaryError);
        return;
      }
      setAiSummary(data.summary || "");
    } catch {
      setAiError(t.aiSummaryError);
    } finally {
      setAiLoading(false);
    }
  }

  const source = t.providedByPatient;

  return (
    <section
      className="practice-dashboard__card"
      aria-labelledby="practice-patient-profile-heading"
    >
      <h2 id="practice-patient-profile-heading" className="practice-dashboard__analytics-heading">
        {t.sectionTitle}
      </h2>
      <p className="practice-dashboard__muted">{t.sectionIntro}</p>
      <p className="practice-dashboard__muted" role="note">
        {t.notVerifiedNote}
      </p>

      {loading ? <p className="practice-dashboard__muted">{t.loading}</p> : null}
      {error ? (
        <p className="practice-dashboard__error" role="alert">
          {error}
        </p>
      ) : null}
      {denied ? (
        <p className="practice-dashboard__muted" role="status">
          {t.notShared}
        </p>
      ) : null}

      {profile && !loading && !denied ? (
        <>
          {!readOnly ? (
            <div style={{ marginTop: "1rem" }}>
              <button
                type="button"
                className="patient-threads__btn patient-threads__btn--secondary"
                disabled={aiLoading}
                aria-busy={aiLoading}
                onClick={loadAiSummary}
              >
                {aiLoading ? t.aiSummaryLoading : t.aiSummaryButton}
              </button>
              {aiError ? (
                <p className="practice-dashboard__error" role="alert" style={{ marginTop: "0.5rem" }}>
                  {aiError}
                </p>
              ) : null}
              {aiSummary ? (
                <aside
                  className="practice-dashboard__card"
                  style={{ marginTop: "1rem", padding: "1rem" }}
                  aria-labelledby="practice-profile-ai-heading"
                >
                  <h3
                    id="practice-profile-ai-heading"
                    className="practice-dashboard__analytics-heading"
                    style={{ fontSize: "1rem" }}
                  >
                    {t.aiSummaryHeading}
                  </h3>
                  <p className="practice-dashboard__muted" role="note">
                    {t.aiSummaryHint}
                  </p>
                  <pre
                    className="practice-dashboard__muted"
                    style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", marginTop: "0.5rem" }}
                  >
                    {aiSummary}
                  </pre>
                </aside>
              ) : null}
            </div>
          ) : null}

          {profile.dependentProfile ? (
            <div style={{ marginTop: "1rem" }}>
              <h3 className="practice-dashboard__analytics-heading" style={{ fontSize: "1rem" }}>
                {t.dependentHeading}
              </h3>
              <dl className="practice-patients__detail-grid">
                <ProfileField
                  label={t.fieldName}
                  value={profile.dependentProfile.displayName}
                  sourceLabel={source}
                />
                <ProfileField
                  label={t.fieldRelation}
                  value={profile.dependentProfile.relationLabel}
                  sourceLabel={source}
                />
                <ProfileField
                  label={t.fieldDateOfBirth}
                  value={profile.dependentProfile.dateOfBirth}
                  sourceLabel={source}
                />
                <ProfileField
                  label={t.fieldLanguage}
                  value={profile.dependentProfile.preferredLanguage}
                  sourceLabel={source}
                />
                <ProfileField
                  label={t.fieldGender}
                  value={profile.dependentProfile.genderOrSalutation}
                  sourceLabel={source}
                />
              </dl>
              <p className="practice-dashboard__muted">{t.healthNotForDependent}</p>
            </div>
          ) : null}

          <div style={{ marginTop: "1rem" }}>
            <h3 className="practice-dashboard__analytics-heading" style={{ fontSize: "1rem" }}>
              {t.basicHeading}
            </h3>
            <dl className="practice-patients__detail-grid">
              <ProfileField
                label={t.fieldName}
                value={
                  profile.basic.displayName ||
                  [profile.basic.firstName, profile.basic.lastName].filter(Boolean).join(" ")
                }
                sourceLabel={source}
              />
              <ProfileField
                label={t.fieldEmail}
                value={profile.basic.email}
                sourceLabel={source}
              />
              <ProfileField
                label={t.fieldDateOfBirth}
                value={profile.basic.dateOfBirth}
                sourceLabel={source}
              />
              <ProfileField
                label={t.fieldLanguage}
                value={profile.basic.preferredLanguage}
                sourceLabel={source}
              />
              <ProfileField
                label={t.fieldGender}
                value={profile.basic.genderOrSalutation}
                sourceLabel={source}
              />
              <ProfileField
                label={t.fieldEmergency}
                value={profile.basic.emergencyContactNote}
                sourceLabel={source}
              />
              <ProfileField
                label={t.fieldInsurance}
                value={insuranceLabel(profile.basic.insuranceType, t)}
                sourceLabel={source}
              />
            </dl>
          </div>

          {profile.health ? (
            <div style={{ marginTop: "1rem" }}>
              <h3 className="practice-dashboard__analytics-heading" style={{ fontSize: "1rem" }}>
                {t.healthHeading}
              </h3>
              <dl className="practice-patients__detail-grid">
                <ProfileField
                  label={t.fieldAllergies}
                  value={profile.health.allergies}
                  sourceLabel={source}
                />
                <ProfileField
                  label={t.fieldMedications}
                  value={profile.health.regularMedications}
                  sourceLabel={source}
                />
                <ProfileField
                  label={t.fieldChronic}
                  value={profile.health.chronicConditions}
                  sourceLabel={source}
                />
                <ProfileField
                  label={t.fieldImportantNotes}
                  value={profile.health.importantNotes}
                  sourceLabel={source}
                />
              </dl>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
