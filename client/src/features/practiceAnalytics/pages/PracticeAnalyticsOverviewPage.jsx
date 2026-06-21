import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { getPrimaryIntlLocale } from "../../../i18n/intlLocale.js";
import { fetchPracticeAnalyticsOverview } from "../api/practiceAnalyticsApi.js";
import "../styles/PracticeAnalyticsOverviewPage.css";

export default function PracticeAnalyticsOverviewPage() {
  const [searchParams] = useSearchParams();
  const practiceId = searchParams.get("practiceId") || "";
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practiceAnalytics || getMessages("en").practiceAnalytics,
    [language],
  );

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fmtNum = useCallback(
    (n) => {
      const v = Number(n) || 0;
      try {
        return v.toLocaleString(getPrimaryIntlLocale(language));
      } catch {
        return String(v);
      }
    },
    [language],
  );

  const load = useCallback(async () => {
    if (!practiceId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { res, data: payload } = await fetchPracticeAnalyticsOverview(practiceId);
      if (!res.ok || !payload.ok) throw new Error("load_failed");
      setData(payload);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setData(null);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [practiceId, t.loadError]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    void load();
  }, [load]);

  const cards = useMemo(() => {
    if (!data) return [];
    return [
      { key: "completed", label: t.mCompletedWindow, value: data.preVisit?.completedWindow },
      { key: "submissions", label: t.mSubmissionsWindow, value: data.anamnesis?.submissionsWindow },
      { key: "newCases", label: t.mPreVisitWindow, value: data.preVisit?.window },
      { key: "templates", label: t.mTemplatesActive, value: data.anamnesis?.templatesActive },
      { key: "team", label: t.mTeamActive, value: data.team?.activeMembers },
      { key: "invites", label: t.mPendingInvites, value: data.team?.pendingInvites },
      { key: "events", label: t.mTrackedEventsWindow, value: data.usage?.trackedEventsWindow },
    ];
  }, [data, t]);

  const hasAnyUsage = useMemo(() => {
    if (!data) return false;
    return (
      (data.preVisit?.total || 0) > 0 ||
      (data.anamnesis?.templatesTotal || 0) > 0 ||
      (data.anamnesis?.submissionsTotal || 0) > 0 ||
      (data.usage?.trackedEventsTotal || 0) > 0
    );
  }, [data]);

  return (
    <div className="pan">
      <Link
        className="pan__back"
        to={practiceId ? `/practice?practiceId=${encodeURIComponent(practiceId)}` : "/practice"}
      >
        {t.backLink}
      </Link>
      <h1 className="pan__title">{t.heading}</h1>
      <p className="pan__intro">{t.intro}</p>
      <p className="pan__note" role="note">
        {t.safetyNote}
      </p>

      {loading ? (
        <p className="pan__status" aria-live="polite">
          {t.loading}
        </p>
      ) : error ? (
        <p className="pan__status pan__status--error" role="alert">
          {error}
        </p>
      ) : !data ? (
        <p className="pan__status">{t.loadError}</p>
      ) : (
        <>
          <p className="pan__window">
            {t.windowPrefix} {data.windowDays} {t.windowDays}
          </p>

          {!hasAnyUsage ? <p className="pan__status">{t.empty}</p> : null}

          <h2 className="pan__section-title">{t.kpiHeading}</h2>
          <div className="pan__grid">
            {cards.map((c) => (
              <div className="pan__card" key={c.key}>
                <div className="pan__card-value">{fmtNum(c.value)}</div>
                <div className="pan__card-label">{c.label}</div>
              </div>
            ))}
          </div>

          <h2 className="pan__section-title">{t.roiHeading}</h2>
          <div className="pan__roi">
            {data.roi?.hasBasis ? (
              <>
                <div className="pan__roi-figures">
                  <div>
                    <div className="pan__roi-value">{fmtNum(data.roi.estimatedMinutesSaved)}</div>
                    <div className="pan__roi-label">{t.roiMinutes}</div>
                  </div>
                  <div>
                    <div className="pan__roi-value">{fmtNum(data.roi.estimatedHoursSaved)}</div>
                    <div className="pan__roi-label">{t.roiHours}</div>
                  </div>
                </div>
                <p className="pan__roi-meta">
                  {t.roiBasisLabel}: {fmtNum(data.roi.completedPreparations)} · {t.roiFactorLabel}:{" "}
                  {fmtNum(data.roi.minutesPerPreparation)} {t.roiFactorUnit}
                </p>
              </>
            ) : (
              <p className="pan__status">{t.roiNoBasis}</p>
            )}
            <p className="pan__roi-note">{t.roiNote}</p>
          </div>
        </>
      )}
    </div>
  );
}
