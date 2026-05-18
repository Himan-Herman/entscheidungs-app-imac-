import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  assignPracticePatient,
  fetchAiAssignmentSuggestion,
  fetchAssignmentHistory,
  forwardPracticePatient,
  unassignPracticePatient,
} from "../api/practicePatientAssignmentApi.js";
import { fetchPracticeTeam } from "../../practiceTeam/api/practiceTeamApi.js";

export default function PracticePatientAssignmentSection({
  practiceId,
  linkId,
  assignment,
  canManage,
  onUpdated,
}) {
  const { language } = useLanguage();
  const t = useMemo(
    () =>
      getMessages(language).practiceOrganization ||
      getMessages("en").practiceOrganization,
    [language],
  );
  const tp = useMemo(
    () => getMessages(language).practicePatients || getMessages("en").practicePatients,
    [language],
  );

  const [team, setTeam] = useState([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [assignmentType, setAssignmentType] = useState("doctor");
  const [note, setNote] = useState(assignment?.assignmentNote || "");
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [aiHint, setAiHint] = useState(null);

  const statusLabel = useCallback(
    (s) => {
      const map = {
        unassigned: t.statusUnassigned,
        assigned: t.statusAssigned,
        forwarded: t.statusForwarded,
        closed: t.statusClosed,
      };
      return map[s] || s;
    },
    [t],
  );

  useEffect(() => {
    if (!practiceId || !canManage) return;
    let cancelled = false;
    (async () => {
      try {
        const [teamData, hist] = await Promise.all([
          fetchPracticeTeam(practiceId),
          fetchAssignmentHistory(linkId, practiceId),
        ]);
        if (cancelled) return;
        setTeam(
          (teamData.members || []).filter(
            (m) => m.status === "active" && m.role !== "viewer",
          ),
        );
        setHistory(hist);
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [practiceId, linkId, canManage]);

  const runAction = async (fn) => {
    setBusy(true);
    setMsg("");
    try {
      await fn();
      const hist = await fetchAssignmentHistory(linkId, practiceId);
      setHistory(hist);
      onUpdated?.();
      setMsg(tp?.saved || "OK");
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const loadAi = async () => {
    setBusy(true);
    try {
      const data = await fetchAiAssignmentSuggestion(linkId, practiceId, language);
      setAiHint(data);
      if (data.suggestedAssigneeUserId) {
        setAssigneeId(data.suggestedAssigneeUserId);
        setAssignmentType(data.suggestedAssignmentType || "doctor");
      }
    } catch {
      setAiHint(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="pp-card" aria-labelledby="assignment-heading">
      <h2 id="assignment-heading">{t.assignmentHeading}</h2>
      <p>
        <strong>{t.assignmentStatus}:</strong>{" "}
        <span aria-live="polite">{statusLabel(assignment?.assignmentStatus)}</span>
      </p>

      {canManage ? (
        <div className="pp-form-stack">
          <label htmlFor="assignee-select">{t.selectTeamMember}</label>
          <select
            id="assignee-select"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            disabled={busy}
          >
            <option value="">—</option>
            {team.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user?.displayName || m.user?.email} ({m.role})
              </option>
            ))}
          </select>

          <label htmlFor="assignment-type">{t.assignmentStatus}</label>
          <select
            id="assignment-type"
            value={assignmentType}
            onChange={(e) => setAssignmentType(e.target.value)}
            disabled={busy}
          >
            <option value="doctor">{t.assignedDoctor}</option>
            <option value="secretary">{t.roleSecretary}</option>
            <option value="assistant">{tp?.roleAssistant || "assistant"}</option>
            <option value="team">{t.assignee}</option>
          </select>

          <label htmlFor="assignment-note">{t.assignmentNote}</label>
          <textarea
            id="assignment-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={busy}
          />

          <div className="pp-actions-row">
            <button
              type="button"
              className="pp-btn pp-btn-primary"
              disabled={busy || !assigneeId}
              onClick={() =>
                runAction(() =>
                  assignPracticePatient(linkId, practiceId, {
                    assigneeUserId: assigneeId,
                    assignmentType,
                    note,
                  }),
                )
              }
            >
              {t.assignButton}
            </button>
            <button
              type="button"
              className="pp-btn"
              disabled={busy || !assigneeId}
              onClick={() =>
                runAction(() =>
                  forwardPracticePatient(linkId, practiceId, {
                    assigneeUserId: assigneeId,
                    assignmentType,
                    note,
                  }),
                )
              }
            >
              {t.forwardButton}
            </button>
            <button
              type="button"
              className="pp-btn pp-btn-danger"
              disabled={busy}
              onClick={() => runAction(() => unassignPracticePatient(linkId, practiceId))}
            >
              {t.unassignButton}
            </button>
            <button type="button" className="pp-btn" disabled={busy} onClick={loadAi}>
              {t.aiSuggestionLabel}
            </button>
          </div>

          {aiHint ? (
            <p className="pp-muted" role="note">
              <strong>{aiHint.aiSuggestionLabel}</strong>: {aiHint.reason}
              <br />
              {aiHint.aiDisclaimer}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="pp-muted">{tp?.readOnlyNotice}</p>
      )}

      {history.length > 0 ? (
        <div>
          <h3>{t.assignmentHistory}</h3>
          <ul className="pp-list">
            {history.map((h) => (
              <li key={h.id}>
                {h.assignedTo?.displayName || h.assignedToUserId} — {h.assignmentType} —{" "}
                {new Date(h.createdAt).toLocaleString(language === "de" ? "de-DE" : "en-GB")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {msg ? (
        <p className="pp-status" role="status">
          {msg}
        </p>
      ) : null}
    </section>
  );
}
