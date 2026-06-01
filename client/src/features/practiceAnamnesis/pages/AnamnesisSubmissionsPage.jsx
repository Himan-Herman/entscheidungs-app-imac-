import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  deleteAnamnesisSubmission,
  fetchAnamnesisSubmissions,
  patchAnamnesisSubmission,
} from "../api/practiceAnamnesisSubmissionsApi.js";
import { fetchAnamnesisTemplate } from "../api/practiceAnamnesisApi.js";
import "../PracticeAnamnesisPages.css";

function getLabel(json, lang) {
  if (!json || typeof json !== "object") return "";
  return json[lang] || json.de || json.en || Object.values(json)[0] || "";
}

const FILTERS = ["all", "new", "viewed", "archived"];

export default function AnamnesisSubmissionsPage() {
  const { templateId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = useMemo(() => getMessages(language).anamnesisSubmissions || getMessages("en").anamnesisSubmissions, [language]);
  const practiceId = searchParams.get("practiceId") || "";

  const [template, setTemplate] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const backUrl = `/practice/anamnesis/${templateId}${practiceId ? `?practiceId=${encodeURIComponent(practiceId)}` : ""}`;

  const load = useCallback(async () => {
    if (!practiceId) return;
    setLoading(true);
    setError("");
    try {
      const [tplRes, subRes] = await Promise.all([
        fetchAnamnesisTemplate(practiceId, templateId),
        fetchAnamnesisSubmissions(practiceId, templateId),
      ]);
      if (!tplRes.res.ok) { setError("loadError"); return; }
      setTemplate(tplRes.data.template);
      if (subRes.res.ok) setSubmissions(subRes.data.submissions || []);
    } catch {
      setError("loadError");
    } finally {
      setLoading(false);
    }
  }, [practiceId, templateId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (filter === "all") return submissions;
    return submissions.filter((s) => s.status === filter);
  }, [submissions, filter]);

  const handleArchive = async (id) => {
    await patchAnamnesisSubmission(practiceId, id, { status: "archived" });
    load();
  };

  const handleUnarchive = async (id) => {
    await patchAnamnesisSubmission(practiceId, id, { status: "viewed" });
    load();
  };

  const handleDelete = async (id) => {
    await deleteAnamnesisSubmission(practiceId, id);
    setConfirmDeleteId(null);
    load();
  };

  const statusLabel = (s) => {
    if (s.status === "new") return t.statusNew;
    if (s.status === "archived") return t.statusArchived;
    return t.statusViewed;
  };

  const templateTitle = template ? getLabel(template.titleJson, language) : "";

  if (loading) return <div className="anamnesis-hub__loading">…</div>;
  if (error) return <div className="anamnesis-hub__error">{t.loadError || error}</div>;

  return (
    <div className="anamnesis-editor">
      <nav className="anamnesis-editor__top-nav">
        <Link className="anamnesis-editor__back-link" to={backUrl}>← {t.backToTemplate}</Link>
      </nav>

      <div className="anamnesis-view__header">
        <div>
          <h1 className="anamnesis-view__title">{t.heading}</h1>
          {templateTitle && <p className="anamnesis-view__desc">{templateTitle}</p>}
        </div>
        <div className="anamnesis-view__header-actions">
          <div className="anamnesis-links__filter-tabs">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                className={`anamnesis-hub__btn anamnesis-hub__btn--sm${filter === f ? "" : " anamnesis-hub__btn--outline"}`}
                onClick={() => setFilter(f)}
              >
                {t[`filter${f.charAt(0).toUpperCase() + f.slice(1)}`]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="anamnesis-hub__intro">{t.intro}</p>

      {filtered.length === 0 ? (
        <p className="anamnesis-hub__empty">{filter === "all" ? t.noSubmissions : t.noSubmissionsFiltered}</p>
      ) : (
        <ul className="anamnesis-submissions__list">
          {filtered.map((sub) => (
            <li key={sub.id} className={`anamnesis-submissions__item anamnesis-submissions__item--${sub.status}`}>
              <div className="anamnesis-submissions__item-meta">
                <span className={`anamnesis-hub__badge${sub.status === "new" ? " anamnesis-hub__badge--new" : sub.status === "archived" ? " anamnesis-hub__badge--archived" : ""}`}>
                  {statusLabel(sub)}
                </span>
                <span className="anamnesis-submissions__date">
                  {t.submittedAt}: {new Date(sub.submittedAt).toLocaleString(language)}
                </span>
                <span className="anamnesis-submissions__lang">
                  {t.language}: {sub.patientLanguage.toUpperCase()}
                </span>
                {sub.link && (
                  <span className="anamnesis-submissions__via">
                    {t.via}: {sub.link.label || `#${sub.link.tokenPrefix}`}
                  </span>
                )}
              </div>
              <div className="anamnesis-submissions__item-actions">
                <button
                  type="button"
                  className="anamnesis-hub__btn anamnesis-hub__btn--sm"
                  onClick={() =>
                    navigate(
                      `/practice/anamnesis/${templateId}/submissions/${sub.id}${practiceId ? `?practiceId=${encodeURIComponent(practiceId)}` : ""}`
                    )
                  }
                >
                  {t.viewDetail}
                </button>
                {sub.status !== "archived" ? (
                  <button type="button" className="anamnesis-hub__btn anamnesis-hub__btn--sm anamnesis-hub__btn--outline" onClick={() => handleArchive(sub.id)}>
                    {t.archive}
                  </button>
                ) : (
                  <button type="button" className="anamnesis-hub__btn anamnesis-hub__btn--sm anamnesis-hub__btn--outline" onClick={() => handleUnarchive(sub.id)}>
                    {t.unarchive}
                  </button>
                )}
                {confirmDeleteId === sub.id ? (
                  <>
                    <button type="button" className="anamnesis-hub__btn anamnesis-hub__btn--sm" style={{ background: "var(--color-danger, #e53)" }} onClick={() => handleDelete(sub.id)}>✓</button>
                    <button type="button" className="anamnesis-hub__btn anamnesis-hub__btn--sm anamnesis-hub__btn--ghost" onClick={() => setConfirmDeleteId(null)}>✕</button>
                    <span className="anamnesis-submissions__confirm-text">{t.confirmDeleteSubmission}</span>
                  </>
                ) : (
                  <button type="button" className="anamnesis-hub__btn anamnesis-hub__btn--sm anamnesis-hub__btn--ghost" onClick={() => setConfirmDeleteId(sub.id)}>🗑</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
