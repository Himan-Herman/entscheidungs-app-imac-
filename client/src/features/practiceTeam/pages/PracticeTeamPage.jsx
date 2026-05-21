import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { authFetch } from "../../../api/authFetch.js";
import { getPrimaryIntlLocale } from '../../../i18n/intlLocale.js';
import {
  acceptPracticeTeamInvite,
  fetchPendingTeamInvites,
  fetchPracticeTeam,
  fetchPracticeTeamAiSummary,
  invitePracticeTeamMember,
  patchPracticeTeamRole,
  revokePracticeTeamMember,
} from "../api/practiceTeamApi.js";
import "../../../styles/PracticeDashboardPage.css";
import "../../../styles/PracticePatientsPage.css";
import "../styles/PracticeTeamPage.css";

const ASSIGNABLE_ROLES = [
  "admin",
  "doctor",
  "secretary",
  "assistant",
  "practice_manager",
  "viewer",
];

function fmt(iso, lang) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(getPrimaryIntlLocale(lang), {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

export default function PracticeTeamPage() {
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practiceTeam || getMessages("en").practiceTeam,
    [language],
  );
  const [searchParams, setSearchParams] = useSearchParams();

  const [practices, setPractices] = useState([]);
  const [practiceId, setPracticeId] = useState(() => searchParams.get("practiceId") || "");
  const [members, setMembers] = useState([]);
  const [yourRole, setYourRole] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("assistant");
  const [inviteBusy, setInviteBusy] = useState(false);

  const [pendingInvites, setPendingInvites] = useState([]);
  const [aiFocusRole, setAiFocusRole] = useState("assistant");
  const [aiSummary, setAiSummary] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const roleLabel = useCallback(
    (role) => {
      const map = {
        owner: t.roleOwner,
        admin: t.roleAdmin,
        doctor: t.roleDoctor,
        assistant: t.roleAssistant,
        viewer: t.roleViewer,
        secretary: t.roleSecretary || getMessages(language).practiceOrganization?.roleSecretary,
        practice_manager:
          t.rolePracticeManager ||
          getMessages(language).practiceOrganization?.rolePracticeManager,
      };
      return map[role] || role;
    },
    [t],
  );

  const statusLabel = useCallback(
    (status) => {
      const map = {
        invited: t.statusInvited,
        active: t.statusActive,
        revoked: t.statusRevoked,
      };
      return map[status] || status;
    },
    [t],
  );

  const errText = useCallback(
    (code) => t.errors?.[code] || t.saveError,
    [t],
  );

  const loadPractices = useCallback(async () => {
    const res = await authFetch("/api/practices");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error("load_practices_failed");
    const rows = Array.isArray(data.practices) ? data.practices : [];
    setPractices(rows);
    if (!practiceId && rows.length > 0) setPracticeId(rows[0].id);
  }, [practiceId]);

  const loadPendingInvites = useCallback(async () => {
    try {
      const { res, data } = await fetchPendingTeamInvites();
      if (!res.ok || !data.ok) return;
      setPendingInvites(Array.isArray(data.invites) ? data.invites : []);
    } catch {
      setPendingInvites([]);
    }
  }, []);

  const loadTeam = useCallback(async () => {
    if (!practiceId) {
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchPracticeTeam(practiceId);
      if (res.status === 403) {
        setError(t.forbidden);
        setMembers([]);
        return;
      }
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setMembers(Array.isArray(data.members) ? data.members : []);
      setYourRole(data.role || "");
      setCanManage(Boolean(data.canManage));
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setMembers([]);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [practiceId, t.forbidden, t.loadError]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    loadPractices().catch(() => setError(t.loadError));
    loadPendingInvites();
  }, [loadPractices, loadPendingInvites, t.loadError]);

  useEffect(() => {
    if (!practiceId) return;
    const next = new URLSearchParams(searchParams);
    next.set("practiceId", practiceId);
    setSearchParams(next, { replace: true });
    loadTeam();
  }, [practiceId, loadTeam, searchParams, setSearchParams]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (filterRole && m.role !== filterRole) return false;
      if (filterStatus && m.status !== filterStatus) return false;
      if (!q) return true;
      const name = (m.user?.displayName || "").toLowerCase();
      const email = (m.user?.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [members, search, filterRole, filterStatus]);

  const onInvite = async (e) => {
    e.preventDefault();
    if (!canManage || !practiceId) return;
    setInviteBusy(true);
    setStatusMsg("");
    try {
      const { res, data } = await invitePracticeTeamMember(practiceId, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      if (!res.ok || !data.ok) throw new Error(data.error || "invite_failed");
      setInviteEmail("");
      setStatusMsg(t.inviteSuccess);
      await loadTeam();
    } catch (err) {
      setStatusMsg(errText(err?.message));
    } finally {
      setInviteBusy(false);
    }
  };

  const onRoleChange = async (membershipId, role) => {
    if (!canManage || !practiceId) return;
    setStatusMsg("");
    try {
      const { res, data } = await patchPracticeTeamRole(practiceId, membershipId, role);
      if (!res.ok || !data.ok) throw new Error(data.error || "role_failed");
      setStatusMsg(t.roleChangeSuccess);
      await loadTeam();
    } catch (err) {
      setStatusMsg(errText(err?.message));
    }
  };

  const onRevoke = async (membershipId) => {
    if (!canManage || !practiceId) return;
    if (!window.confirm(t.revokeConfirm)) return;
    setStatusMsg("");
    try {
      const { res, data } = await revokePracticeTeamMember(practiceId, membershipId);
      if (!res.ok || !data.ok) throw new Error(data.error || "revoke_failed");
      setStatusMsg(t.revokeSuccess);
      await loadTeam();
    } catch (err) {
      setStatusMsg(errText(err?.message));
    }
  };

  const onAcceptInvite = async (pid) => {
    setStatusMsg("");
    try {
      const { res, data } = await acceptPracticeTeamInvite(pid);
      if (!res.ok || !data.ok) throw new Error(data.error || "accept_failed");
      setStatusMsg(t.acceptSuccess);
      await loadPendingInvites();
      if (pid === practiceId) await loadTeam();
    } catch (err) {
      setStatusMsg(errText(err?.message));
    }
  };

  const onAiSummary = async () => {
    if (!canManage || !practiceId) return;
    setAiBusy(true);
    setAiSummary("");
    try {
      const { res, data } = await fetchPracticeTeamAiSummary(practiceId, {
        locale: language,
        focusRole: aiFocusRole,
      });
      if (!res.ok || !data.ok) throw new Error(data.error || "ai_failed");
      setAiSummary(data.summary || "");
    } catch (err) {
      setStatusMsg(err?.message === "ai_not_configured" ? t.errors.ai_not_configured : t.aiError);
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="practice-dashboard practice-team">
      <Link className="practice-dashboard__back" to="/practice">
        {t.backHub}
      </Link>

      <header className="practice-dashboard__header">
        <h1>{t.heading}</h1>
        <p className="practice-dashboard__sub">{t.intro}</p>
        {yourRole ? (
          <p className="practice-team__your-role">
            {t.yourRole}: <strong>{roleLabel(yourRole)}</strong>
          </p>
        ) : null}
      </header>

      {practices.length > 1 ? (
        <label className="practice-dashboard__filter">
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

      {pendingInvites.length > 0 ? (
        <section className="practice-team__pending" aria-labelledby="pending-invites-heading">
          <h2 id="pending-invites-heading">{t.pendingInvitesHeading}</h2>
          <ul className="practice-team__pending-list">
            {pendingInvites.map((inv) => (
              <li key={inv.membershipId}>
                <span>
                  {inv.practiceName || t.notProvided} — {roleLabel(inv.role)}
                </span>
                <button type="button" onClick={() => void onAcceptInvite(inv.practiceProfileId)}>
                  {t.acceptInvite}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {statusMsg ? (
        <p className="practice-team__status" role="status">
          {statusMsg}
        </p>
      ) : null}

      {error ? (
        <p className="practice-dashboard__error" role="alert">
          {error}
        </p>
      ) : null}

      {!canManage && !error ? (
        <p className="practice-team__hint" role="note">
          {t.readOnlyHint}
        </p>
      ) : null}

      {canManage ? (
        <section className="practice-team__invite" aria-labelledby="invite-heading">
          <h2 id="invite-heading">{t.inviteHeading}</h2>
          <form className="practice-team__invite-form" onSubmit={onInvite}>
            <label>
              <span>{t.inviteEmail}</span>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder={t.inviteEmailPlaceholder}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </label>
            <label>
              <span>{t.inviteRole}</span>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                aria-label={t.inviteRole}
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={inviteBusy}>
              {inviteBusy ? t.loading : t.inviteSubmit}
            </button>
          </form>
        </section>
      ) : null}

      <div className="practice-team__filters">
        <label>
          <span>{t.searchLabel}</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchLabel}
          />
        </label>
        <label>
          <span>{t.filterRole}</span>
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
            <option value="">{t.filterAll}</option>
            {["owner", ...ASSIGNABLE_ROLES].map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t.filterStatus}</span>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">{t.filterAll}</option>
            <option value="invited">{t.statusInvited}</option>
            <option value="active">{t.statusActive}</option>
            <option value="revoked">{t.statusRevoked}</option>
          </select>
        </label>
      </div>

      {loading ? (
        <p className="practice-dashboard__muted">{t.loading}</p>
      ) : (
        <>
        <div className="practice-team__table-wrap practice-patients__table-wrap">
          <table className="practice-team__table">
            <caption className="practice-team__sr-only">{t.heading}</caption>
            <thead>
              <tr>
                <th scope="col">{t.colName}</th>
                <th scope="col">{t.colEmail}</th>
                <th scope="col">{t.colRole}</th>
                <th scope="col">{t.colStatus}</th>
                {canManage ? <th scope="col">{t.colActions}</th> : null}
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 5 : 4}>{t.membersEmpty}</td>
                </tr>
              ) : (
                filteredMembers.map((m) => {
                  const isOwner = m.isPracticeOwner;
                  const displayName = m.user?.displayName || t.notProvided;
                  return (
                    <tr key={m.id}>
                      <td>
                        {displayName}
                        {isOwner ? (
                          <span className="practice-team__badge">{t.ownerBadge}</span>
                        ) : null}
                      </td>
                      <td>{m.user?.email || "—"}</td>
                      <td>
                        {canManage && !isOwner && m.status !== "revoked" ? (
                          <select
                            value={m.role}
                            aria-label={`${t.actionChangeRole} ${displayName}`}
                            onChange={(e) => void onRoleChange(m.id, e.target.value)}
                          >
                            {ASSIGNABLE_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {roleLabel(r)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span>{roleLabel(m.role)}</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`practice-team__status-pill practice-team__status-pill--${m.status}`}
                        >
                          {statusLabel(m.status)}
                        </span>
                        {m.invitedAt ? (
                          <span className="practice-team__meta">{fmt(m.invitedAt, language)}</span>
                        ) : null}
                      </td>
                      {canManage ? (
                        <td>
                          {!isOwner && m.status !== "revoked" ? (
                            <button
                              type="button"
                              className="practice-team__danger"
                              onClick={() => void onRevoke(m.id)}
                              aria-label={`${t.actionRevoke} ${displayName}`}
                            >
                              {t.actionRevoke}
                            </button>
                          ) : (
                            "—"
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="practice-patients__cards" aria-label={t.heading}>
          {filteredMembers.length === 0 ? (
            <p className="practice-dashboard__muted">{t.membersEmpty}</p>
          ) : (
            filteredMembers.map((m) => {
              const isOwner = m.isPracticeOwner;
              const displayName = m.user?.displayName || t.notProvided;
              return (
                <article key={m.id} className="practice-patients__card-item">
                  <div className="practice-dashboard__card-top">
                    <h2 className="practice-dashboard__muted" style={{ margin: 0, fontSize: "1rem" }}>
                      {displayName}
                      {isOwner ? (
                        <span className="practice-team__badge">{t.ownerBadge}</span>
                      ) : null}
                    </h2>
                    <span
                      className={`practice-team__status-pill practice-team__status-pill--${m.status}`}
                    >
                      {statusLabel(m.status)}
                    </span>
                  </div>
                  <p className="practice-patients__card-meta">{m.user?.email || "—"}</p>
                  <dl className="ms-responsive-list__card-row">
                    <dt>{t.colRole}</dt>
                    <dd>
                      {canManage && !isOwner && m.status !== "revoked" ? (
                        <select
                          value={m.role}
                          aria-label={`${t.actionChangeRole} ${displayName}`}
                          onChange={(e) => void onRoleChange(m.id, e.target.value)}
                        >
                          {ASSIGNABLE_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {roleLabel(r)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        roleLabel(m.role)
                      )}
                    </dd>
                  </dl>
                  {canManage && !isOwner && m.status !== "revoked" ? (
                    <div className="ms-responsive-list__card-actions">
                      <button
                        type="button"
                        className="practice-team__danger"
                        onClick={() => void onRevoke(m.id)}
                        aria-label={`${t.actionRevoke} ${displayName}`}
                      >
                        {t.actionRevoke}
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
        </>
      )}

      {canManage ? (
        <section className="practice-team__ai" aria-labelledby="ai-heading">
          <h2 id="ai-heading">{t.aiHeading}</h2>
          <p className="practice-team__ai-disclaimer">{t.aiDisclaimer}</p>
          <div className="practice-team__ai-controls">
            <label>
              <span>{t.aiFocusRole}</span>
              <select value={aiFocusRole} onChange={(e) => setAiFocusRole(e.target.value)}>
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => void onAiSummary()} disabled={aiBusy}>
              {aiBusy ? t.aiLoading : t.aiRun}
            </button>
          </div>
          {aiSummary ? (
            <article className="practice-team__ai-output" aria-live="polite">
              <p className="practice-team__ai-label">{t.aiSuggestionLabel}</p>
              <pre>{aiSummary}</pre>
            </article>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
