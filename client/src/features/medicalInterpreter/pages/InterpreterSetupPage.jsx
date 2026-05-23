import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  clearInterpreterInviteContext,
  readInterpreterInviteContext,
} from "../utils/interpreterInviteContext.js";
import { useMedicalInterpreterMessages } from "../hooks/useMedicalInterpreterMessages.js";
import {
  SESSION_STATUS_DRAFT,
  SESSION_STATUS_ENDED,
} from "../constants.js";
import {
  createSession,
  getCurrentSession,
  setCurrentSessionId,
  updateSessionMetadata,
} from "../store/interpreterSessionStore.js";
import {
  buildProfileSnapshotFromSettings,
  fetchInterpreterProfileSettings,
  hasUsableProfileSettings,
} from "../api/interpreterProfileApi.js";
import InterpreterSetupLanguageFields from "../components/InterpreterSetupLanguageFields.jsx";
import InterpreterSetupProfileConsent from "../components/InterpreterSetupProfileConsent.jsx";
import InterpreterSetupDoctorDetails from "../components/InterpreterSetupDoctorDetails.jsx";
import { INTERPRETER_SETUP_LANGUAGE_CODES } from "../constants/setupLanguages.js";
import InterpreterCloudSetupNote from "../components/InterpreterCloudSetupNote.jsx";
import { setInterpreterAck } from "../utils/interpreterAck.js";
import { useInterpreterCloud } from "../hooks/useInterpreterCloud.js";
import "../styles/MedicalInterpreter.css";

function toDatetimeLocalValue(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

function fromDatetimeLocalValue(value) {
  const v = String(value || "").trim();
  if (!v) return undefined;
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toISOString();
  } catch {
    return undefined;
  }
}

export default function InterpreterSetupPage() {
  const t = useMedicalInterpreterMessages();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const forceNewSession = searchParams.get("new") === "1";
  const fromInvite = searchParams.get("fromInvite") === "1";
  const inviteContext = useMemo(
    () => (fromInvite ? readInterpreterInviteContext() : null),
    [fromInvite],
  );

  const [sessionId, setSessionId] = useState(null);
  const [patientLanguage, setPatientLanguage] = useState("");
  const [doctorLanguage, setDoctorLanguage] = useState("");
  const [conversationTitle, setConversationTitle] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [practiceName, setPracticeName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [appointmentDateTime, setAppointmentDateTime] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [profileConsent, setProfileConsent] = useState(false);
  const [profileSectionVisible, setProfileSectionVisible] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState("");
  const [languageError, setLanguageError] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [privacyError, setPrivacyError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const profileSettingsRef = useRef(null);
  const cloud = useInterpreterCloud();

  useEffect(() => {
    document.title = t.start.pageTitle;
  }, [t.start.pageTitle]);

  const hydrateFromSession = useCallback((session) => {
    setSessionId(session.sessionId);
    setPatientLanguage(session.patientLanguage || "");
    setDoctorLanguage(session.doctorLanguage || "");
    setConversationTitle(session.conversationTitle || "");
    setDoctorName(session.doctorName || "");
    setPracticeName(session.practiceName || "");
    setSpecialty(session.specialty || "");
    setAppointmentDateTime(toDatetimeLocalValue(session.appointmentDateTime));
    setProfileConsent(session.profileConsentUsed === true);
    const hasOptional =
      Boolean(session.conversationTitle) ||
      Boolean(session.doctorName) ||
      Boolean(session.practiceName) ||
      Boolean(session.specialty) ||
      Boolean(session.appointmentDateTime);
    setDetailsOpen(hasOptional);
  }, []);

  useEffect(() => {
    if (forceNewSession) return;
    const current = getCurrentSession();
    if (current && current.status !== SESSION_STATUS_ENDED) {
      hydrateFromSession(current);
      return;
    }
    if (inviteContext?.practiceDisplayName) {
      setPracticeName(inviteContext.practiceDisplayName);
      setDetailsOpen(true);
    }
  }, [hydrateFromSession, forceNewSession, inviteContext]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchInterpreterProfileSettings();
      if (cancelled) return;
      if (!result.ok) {
        setProfileSectionVisible(false);
        if (result.error === "network") {
          setProfileLoadError(t.profile.loadError);
        }
        return;
      }
      profileSettingsRef.current = result;
      const usable = hasUsableProfileSettings(result);
      setProfileSectionVisible(usable);
      setProfileLoadError("");

      const current = getCurrentSession();
      if (current && current.status !== SESSION_STATUS_ENDED) return;

      const profile = result.profile ?? {};
      const prefPatient = String(profile.preferredPatientLanguage || "")
        .slice(0, 12)
        .toLowerCase();
      if (
        prefPatient &&
        INTERPRETER_SETUP_LANGUAGE_CODES.includes(prefPatient)
      ) {
        setPatientLanguage((prev) => prev || prefPatient);
      }
      const prefDoctor = String(profile.preferredDoctorLanguage || "")
        .slice(0, 12)
        .toLowerCase();
      if (prefDoctor && INTERPRETER_SETUP_LANGUAGE_CODES.includes(prefDoctor)) {
        setDoctorLanguage((prev) => prev || prefDoctor);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t.profile.loadError]);

  const onFieldChange = useCallback((field, value) => {
    if (field === "conversationTitle") setConversationTitle(value);
    if (field === "doctorName") setDoctorName(value);
    if (field === "practiceName") setPracticeName(value);
    if (field === "specialty") setSpecialty(value);
    if (field === "appointmentDateTime") setAppointmentDateTime(value);
  }, []);

  const validateLanguages = useCallback(() => {
    if (!patientLanguage.trim() || !doctorLanguage.trim()) {
      setLanguageError(t.languages.required);
      return false;
    }
    setLanguageError("");
    return true;
  }, [patientLanguage, doctorLanguage, t.languages.required]);

  const buildSessionPatch = useCallback(() => {
    /** @type {import('../types.js').InterpreterProfileSnapshot | undefined} */
    let profileSnapshot;
    const profileConsentUsed = profileConsent === true;
    if (profileConsentUsed && profileSettingsRef.current) {
      profileSnapshot =
        buildProfileSnapshotFromSettings(profileSettingsRef.current) ?? undefined;
    }

    /** @type {import('../types.js').InterpreterInviteContext|undefined} */
    let sessionInviteContext;
    if (inviteContext?.practiceDisplayName) {
      sessionInviteContext = {
        practiceDisplayName: inviteContext.practiceDisplayName,
        linkedAt: new Date().toISOString(),
        source: "practice_invite",
        sharingConsentGranted: false,
      };
    }

    return {
      patientLanguage: patientLanguage.trim(),
      doctorLanguage: doctorLanguage.trim(),
      conversationTitle: conversationTitle.trim() || undefined,
      doctorName: doctorName.trim() || undefined,
      practiceName:
        practiceName.trim() ||
        inviteContext?.practiceDisplayName?.trim() ||
        undefined,
      specialty: specialty.trim() || undefined,
      appointmentDateTime: fromDatetimeLocalValue(appointmentDateTime),
      profileConsentUsed,
      profileSnapshot: profileConsentUsed ? profileSnapshot : undefined,
      storageConsent: true,
      status: SESSION_STATUS_DRAFT,
      inviteContext: sessionInviteContext,
    };
  }, [
    appointmentDateTime,
    conversationTitle,
    doctorLanguage,
    doctorName,
    patientLanguage,
    practiceName,
    profileConsent,
    specialty,
    inviteContext,
  ]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateLanguages()) return;
    if (!privacyAccepted) {
      setPrivacyError(t.privacy.acceptRequired);
      return;
    }
    setPrivacyError("");

    setSubmitting(true);
    try {
      const patch = buildSessionPatch();
      let id = sessionId;

      if (forceNewSession || !id) {
        const created = createSession(patch);
        id = created?.sessionId ?? null;
      } else {
        const updated = updateSessionMetadata(id, patch);
        if (!updated) {
          const created = createSession(patch);
          id = created?.sessionId ?? null;
        }
      }

      if (!id) {
        setLanguageError(t.errors.generic);
        return;
      }

      setCurrentSessionId(id);
      setInterpreterAck();
      if (inviteContext) {
        clearInterpreterInviteContext();
      }
      navigate("/patient/interpreter/live", { replace: false });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="medical-interpreter-page medical-interpreter-page--setup interp-root" id="main-content">
      <Link className="medical-interpreter-page__back" to="/patient/interpreter">
        {t.start.back}
      </Link>

      <h1 className="medical-interpreter-page__title">{t.languages.heading}</h1>
      <p className="medical-interpreter-page__intro">{t.languages.intro}</p>
      <p className="interpreter-setup__hint">{t.languages.requiredLegend}</p>

      <p className="medical-interpreter-safety" role="note">
        {t.safety.strip}
      </p>

      {inviteContext?.practiceDisplayName ? (
        <section
          className="interp-invite-setup-banner"
          role="note"
          aria-labelledby="interp-invite-setup-banner-title"
        >
          <h2 id="interp-invite-setup-banner-title" className="interp-invite-setup-banner__title">
            {t.invite.setupBannerTitle}
          </h2>
          <p>
            {t.invite.setupBannerBody.replace(
              "{practice}",
              inviteContext.practiceDisplayName,
            )}
          </p>
        </section>
      ) : null}

      <form
        className="interpreter-setup__form"
        onSubmit={handleSubmit}
        noValidate
        aria-labelledby="interp-setup-form-title"
      >
        <span id="interp-setup-form-title" className="visually-hidden">
          {t.languages.heading}
        </span>

        <InterpreterSetupLanguageFields
          patientLanguage={patientLanguage}
          doctorLanguage={doctorLanguage}
          onPatientLanguage={(v) => {
            setPatientLanguage(v);
            if (languageError) setLanguageError("");
          }}
          onDoctorLanguage={(v) => {
            setDoctorLanguage(v);
            if (languageError) setLanguageError("");
          }}
          languageError={languageError}
          labels={t}
        />

        <InterpreterSetupProfileConsent
          visible={profileSectionVisible}
          checked={profileConsent}
          onCheckedChange={setProfileConsent}
          loadError={profileLoadError}
          labels={t}
        />

        <InterpreterSetupDoctorDetails
          open={detailsOpen}
          onToggle={setDetailsOpen}
          conversationTitle={conversationTitle}
          doctorName={doctorName}
          practiceName={practiceName}
          specialty={specialty}
          appointmentDateTime={appointmentDateTime}
          onFieldChange={onFieldChange}
          labels={t}
        />

        <InterpreterCloudSetupNote labels={t} canUseCloud={cloud.canUseCloud} />

        <div className="interpreter-setup__checkbox-row">
          <input
            type="checkbox"
            id="interp-setup-privacy-accept"
            className="interpreter-setup__checkbox"
            checked={privacyAccepted}
            onChange={(e) => {
              setPrivacyAccepted(e.target.checked);
              if (e.target.checked) setPrivacyError("");
            }}
            aria-required="true"
            aria-invalid={privacyError ? true : undefined}
            aria-describedby={
              privacyError
                ? "interp-setup-privacy-error interp-setup-privacy-hint"
                : "interp-setup-privacy-hint"
            }
          />
          <label
            htmlFor="interp-setup-privacy-accept"
            className="interpreter-setup__checkbox-label"
          >
            {t.privacy.acceptLabel}
          </label>
        </div>
        <p id="interp-setup-privacy-hint" className="interpreter-setup__hint">
          {t.privacy.body2}
        </p>
        <p className="interpreter-privacy__legal-links">
          <Link to="/datenschutz">{t.privacy.linkPrivacy}</Link>
          <span aria-hidden="true"> · </span>
          <Link to="/disclaimer">{t.privacy.linkDisclaimer}</Link>
        </p>
        {privacyError ? (
          <p
            id="interp-setup-privacy-error"
            className="interpreter-setup__error"
            role="alert"
          >
            {privacyError}
          </p>
        ) : null}

        <div className="interpreter-setup__actions">
          <Link
            className="medical-interpreter-page__nav-link"
            to="/patient/interpreter"
          >
            {t.start.cancel}
          </Link>
          <button
            type="submit"
            className="medical-interpreter-page__nav-link medical-interpreter-page__nav-link--primary interpreter-setup__submit"
            disabled={submitting}
          >
            {t.start.next}
          </button>
        </div>
      </form>
    </main>
  );
}
