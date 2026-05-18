import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { getMessages } from "../../i18n/translations";
import { fetchPracticeLogoBlobUrl } from "../../features/practiceSettings/api/practiceSettingsApi.js";
import "./PracticeBrandingBar.css";

/**
 * Subtle practice branding for patient-facing views. MedScoutX safety/consent UI stays separate.
 * @param {{ branding?: { displayName?: string, practiceName?: string, logoUrl?: string | null, accentColor?: string | null, patientHint?: string | null, specialty?: string | null } | null, compact?: boolean }} props
 */
export default function PracticeBrandingBar({ branding, compact = false }) {
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practiceSettings || getMessages("en").practiceSettings,
    [language],
  );
  const [logoSrc, setLogoSrc] = useState(null);

  const displayName =
    branding?.displayName?.trim() || branding?.practiceName?.trim() || "";
  const accent = branding?.accentColor || null;

  useEffect(() => {
    let revoked = null;
    let cancelled = false;
    async function load() {
      if (revoked) {
        URL.revokeObjectURL(revoked);
        revoked = null;
      }
      setLogoSrc(null);
      const path = branding?.logoUrl;
      if (!path) return;
      if (String(path).startsWith("http://") || String(path).startsWith("https://")) {
        if (!cancelled) setLogoSrc(path);
        return;
      }
      const blobUrl = await fetchPracticeLogoBlobUrl(path);
      if (cancelled) {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        return;
      }
      revoked = blobUrl;
      setLogoSrc(blobUrl);
    }
    void load();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [branding?.logoUrl]);

  if (!displayName && !branding?.patientHint) return null;

  return (
    <aside
      className={`practice-branding-bar${compact ? " practice-branding-bar--compact" : ""}`}
      style={accent ? { "--practice-accent": accent } : undefined}
      aria-label={displayName}
    >
      <div className="practice-branding-bar__inner">
        {logoSrc ? (
          <img
            className="practice-branding-bar__logo"
            src={logoSrc}
            alt=""
            width={40}
            height={40}
          />
        ) : null}
        <div className="practice-branding-bar__text">
          <p className="practice-branding-bar__name">{displayName}</p>
          {branding?.specialty && !compact ? (
            <p className="practice-branding-bar__meta">{branding.specialty}</p>
          ) : null}
          {branding?.patientHint && !compact ? (
            <p className="practice-branding-bar__hint">{branding.patientHint}</p>
          ) : null}
        </div>
      </div>
      <p className="practice-branding-bar__platform" role="note">
        {t.medscoutBrandNote}
      </p>
    </aside>
  );
}
