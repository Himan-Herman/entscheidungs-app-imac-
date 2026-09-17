import { useCallback, useEffect, useState } from "react";
import { usePracticeContext } from "../usePracticeContext.js";
import { useScopedRequest } from "../hooks/useScopedRequest.js";
import {
  fetchScopedSessions,
  grantScopedConsent,
  joinScopedSession,
  leaveScopedSession,
} from "../api/scopedTelemedicineApi.js";
import { statusLabelKey } from "../../telemedicine/telemedicineSessionUtils.js";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { getPrimaryIntlLocale } from "../../../i18n/intlLocale.js";
// The stylesheet the cross-practice telemedicine pages already use — this is a
// context migration of that view, not a new video UI.
import "../../telemedicine/styles/TelemedicinePages.css";

/**
 * Video consultations of one care relationship (Phase 2G.2).
 *
 * Shows the sessions belonging to THIS relationship and nothing else — not
 * another practice's, not those of a second relationship with the same
 * practice, and not the ones that name a practice but no relationship. That
 * last group is legitimate (a practice may create a session without a connected
 * patient) and stays reachable through the cross-practice page.
 *
 * Nothing here can open a meeting on its own: the list carries no room
 * identifier, and the meeting URL is issued by the join call after consent and
 * revocation have been checked again on the server.
 */
export default function PracticeContextTelemedicinePage() {
  const { linkId, isActiveRelationship } = usePracticeContext();
  const { run } = useScopedRequest(linkId);
  const { language } = useLanguage();
  const t =
    getMessages(language).patientTelemedicine || getMessages("en").patientTelemedicine;
  const tc = getMessages(language).practiceContext || getMessages("en").practiceContext;

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  /** Keyed by session id: a meeting URL belongs to the one join it came from. */
  const [joinUrls, setJoinUrls] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const outcome = await run(
        ({ signal }) => fetchScopedSessions(linkId, { signal }),
        ({ res, data }) => {
          if (!res.ok || !data.ok) {
            setSessions([]);
            setError(res.status === 404 ? tc.notFoundBody : t.loadError);
            return;
          }
          setSessions(Array.isArray(data.sessions) ? data.sessions : []);
        },
      );
      if (!outcome.applied) return;
    } catch {
      setSessions([]);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [linkId, run, t.loadError, tc.notFoundBody]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (sessionId, work, onData) => {
    setBusyId(sessionId);
    setError("");
    try {
      await run(work, ({ res, data }) => {
        if (!res.ok || !data.ok) {
          setError(data?.error === "consent_required" ? t.consentRequired : t.actionError);
          load();
          return;
        }
        onData(data);
      });
    } catch {
      setError(t.actionError);
    } finally {
      setBusyId("");
    }
  };

  const statusText = (status) => t[statusLabelKey(status)] || t.notAvailable;

  const fmt = (iso) => {
    if (!iso) return t.notAvailable;
    try {
      return new Date(iso).toLocaleString(getPrimaryIntlLocale(language), {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return t.notAvailable;
    }
  };

  return (
    <div className="practice-context telemedicine-page">
      <h1 className="practice-context__title">{tc.telemedicineTitle}</h1>
      <p className="workspace-hub__sub">{tc.telemedicineScopeNote}</p>

      {loading ? (
        <p className="practice-context__state" role="status" aria-live="polite">
          {t.loading}
        </p>
      ) : null}

      {error ? (
        <p className="practice-context__state" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && sessions.length === 0 ? (
        <p className="practice-context__state">{tc.telemedicineEmpty}</p>
      ) : null}

      {!loading && sessions.length > 0 ? (
        <ul className="telemedicine-list" aria-label={tc.telemedicineTitle} data-testid="scoped-telemedicine-list">
          {sessions.map((s) => (
            <li key={s.id} className="telemedicine-card">
              <strong>{s.title || t.detailTitle}</strong>
              <div className="telemedicine-card__meta">
                {/* Status is a word, never only a colour. */}
                <span className="telemedicine-status">{statusText(s.status)}</span>
                {" · "}
                <span>
                  {t.scheduled}: {fmt(s.scheduledStartAt)}
                </span>
              </div>

              {s.linkRevoked ? (
                <p role="status">{t.linkRevoked}</p>
              ) : (
                <div className="telemedicine-card__actions">
                  {!s.consentGranted ? (
                    <>
                      <p>{t.consentText}</p>
                      <button
                        type="button"
                        disabled={!isActiveRelationship || busyId === s.id}
                        onClick={() =>
                          act(
                            s.id,
                            ({ signal }) => grantScopedConsent(linkId, s.id, { signal }),
                            () => load(),
                          )
                        }
                      >
                        {t.consentConfirm}
                      </button>
                    </>
                  ) : (
                    <>
                      <p>{t.consentGranted}</p>
                      <button
                        type="button"
                        disabled={!isActiveRelationship || busyId === s.id}
                        onClick={() =>
                          act(
                            s.id,
                            ({ signal }) => joinScopedSession(linkId, s.id, { signal }),
                            (data) => {
                              // Keyed per session: a URL obtained for one
                              // consultation must never be shown on another.
                              if (data.joinUrl) {
                                setJoinUrls((prev) => ({ ...prev, [s.id]: data.joinUrl }));
                              }
                              load();
                            },
                          )
                        }
                      >
                        {t.joinWaiting}
                      </button>

                      {joinUrls[s.id] ? (
                        <a
                          href={joinUrls[s.id]}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid="scoped-telemedicine-join-url"
                        >
                          {t.openVideo}
                        </a>
                      ) : null}

                      {s.status === "waiting" ? (
                        <>
                          <p aria-live="polite">{t.waitingStatus}</p>
                          <button
                            type="button"
                            disabled={busyId === s.id}
                            onClick={() =>
                              act(
                                s.id,
                                ({ signal }) => leaveScopedSession(linkId, s.id, { signal }),
                                () => {
                                  setJoinUrls((prev) => {
                                    const next = { ...prev };
                                    delete next[s.id];
                                    return next;
                                  });
                                  load();
                                },
                              )
                            }
                          >
                            {t.leaveSession}
                          </button>
                        </>
                      ) : null}
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <ul className="telemedicine-hints">
        <li>{t.technicalMic}</li>
        <li>{t.technicalConnection}</li>
        <li>{t.technicalPrivacy}</li>
      </ul>
    </div>
  );
}
