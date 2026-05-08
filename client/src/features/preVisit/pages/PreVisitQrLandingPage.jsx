import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { apiFetch } from "../../../lib/api";
import { setPracticeContext } from "../constants/preVisitSession";
import PreVisitModuleChrome from "../components/PreVisitModuleChrome";
import "../styles/PreVisitLanguagePage.css";

export default function PreVisitQrLandingPage() {
  const { qrToken } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = useMemo(() => getMessages(language).preVisit.qrLanding, [language]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setError("");
      try {
        const res = await apiFetch(`/api/public/previsit/qr/${encodeURIComponent(qrToken)}`);
        if (!mounted) return;
        if (!res?.data) {
          setError(t.invalid);
          setData(null);
          return;
        }
        setData(res.data);
      } catch {
        if (!mounted) return;
        setError(t.invalid);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (qrToken) void run();
    return () => {
      mounted = false;
    };
  }, [qrToken, t.invalid]);

  function handleStart() {
    if (!data || !qrToken) return;
    setPracticeContext({
      qrToken,
      practiceName: data.practiceName || "",
      targetName: data.targetName || "",
      targetType: data.targetType || "",
      doctorName: data.doctorName || "",
      specialty: data.targetSpecialty || data.specialty || "",
      preferredDoctorLanguage: data.preferredDoctorLanguage || "",
    });
    navigate("/pre-visit");
  }

  return (
    <div className="pre-visit-page">
      <div className="pre-visit-page__shell">
        <PreVisitModuleChrome />
        <article className="pre-visit-card">
          <h1 className="pre-visit-card__title">{t.title}</h1>
          {loading ? <p className="pre-visit-card__lead">{t.loading}</p> : null}
          {!loading && error ? <p className="pre-visit-card__lead">{error}</p> : null}
          {!loading && !error && data ? (
            <>
              {!data.isActive ? <p className="pre-visit-card__lead">{t.inactive}</p> : null}
              <p className="pre-visit-card__lead"><strong>{data.practiceName}</strong></p>
              {data.doctorName || data.targetName ? (
                <p className="pre-visit-card__lead">{data.doctorName || data.targetName}</p>
              ) : null}
              {data.targetSpecialty || data.specialty ? (
                <p className="pre-visit-card__lead">{data.targetSpecialty || data.specialty}</p>
              ) : null}
              {data.patientIntroText ? (
                <p className="pre-visit-card__trust">{data.patientIntroText}</p>
              ) : null}
              <div className="pre-visit-card__actions">
                <button
                  type="button"
                  className="pre-visit-card__submit"
                  onClick={handleStart}
                  disabled={!data.isActive}
                >
                  {t.cta}
                </button>
              </div>
            </>
          ) : null}
        </article>
      </div>
    </div>
  );
}

