import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { authFetch } from "../../../api/authFetch.js";
import PreVisitModuleChrome from "../components/PreVisitModuleChrome.jsx";
import "../styles/PreVisitCasesPage.css";

export default function PreVisitCasesPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = useMemo(() => getMessages(language).preVisit.cases, [language]);
  const [hasToken, setHasToken] = useState(
    () => !!localStorage.getItem("medscout_token"),
  );
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createCategory, setCreateCategory] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHasToken(!!localStorage.getItem("medscout_token"));
  }, []);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  const load = useCallback(async () => {
    if (!hasToken) {
      setCases([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams();
      if (search.trim()) q.set("q", search.trim());
      if (archived) q.set("archived", "1");
      const res = await authFetch(`/api/previsit/cases?${q.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error("load");
      setCases(Array.isArray(data.cases) ? data.cases : []);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setError(t.loadError);
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [hasToken, search, archived, t.loadError]);

  useEffect(() => {
    const h = setTimeout(() => void load(), 240);
    return () => clearTimeout(h);
  }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!createTitle.trim()) return;
    setSaving(true);
    try {
      const res = await authFetch("/api/previsit/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createTitle.trim(),
          description: createDesc.trim() || null,
          category: createCategory.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error("save");
      setCreateOpen(false);
      setCreateTitle("");
      setCreateDesc("");
      setCreateCategory("");
      await load();
      if (data.case?.id) {
        navigate(`/pre-visit/cases/${encodeURIComponent(data.case.id)}`);
      }
    } catch {
      setError(t.saveError);
    } finally {
      setSaving(false);
    }
  }

  if (!hasToken) {
    return (
      <div className="pre-visit-cases">
        <div className="pre-visit-cases__inner">
          <PreVisitModuleChrome />
          <p className="pre-visit-cases__lead">{t.loginHint}</p>
          <Link className="pre-visit-cases__link" to="/login">
            {t.loginCta}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pre-visit-cases">
      <div className="pre-visit-cases__inner">
        <PreVisitModuleChrome />
        <header className="pre-visit-cases__header">
          <h1 className="pre-visit-cases__title">{t.title}</h1>
          <p className="pre-visit-cases__intro">{t.intro}</p>
          <p className="pre-visit-cases__safety">{t.safetyNote}</p>
        </header>

        <div className="pre-visit-cases__toolbar">
          <input
            type="search"
            className="pre-visit-cases__search"
            placeholder={t.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t.searchPlaceholder}
          />
          <label className="pre-visit-cases__check">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
            />
            <span>{t.showArchived}</span>
          </label>
          <button
            type="button"
            className="pre-visit-cases__btn pre-visit-cases__btn--primary"
            onClick={() => setCreateOpen((v) => !v)}
          >
            {t.createCase}
          </button>
        </div>

        {error ? (
          <p className="pre-visit-cases__error" role="alert">
            {error}
          </p>
        ) : null}

        {createOpen ? (
          <form className="pre-visit-cases__form" onSubmit={handleCreate}>
            <label className="pre-visit-cases__label">
              {t.fieldTitle} *
              <input
                className="pre-visit-cases__input"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                required
                maxLength={140}
              />
            </label>
            <label className="pre-visit-cases__label">
              {t.fieldCategory}
              <input
                className="pre-visit-cases__input"
                value={createCategory}
                onChange={(e) => setCreateCategory(e.target.value)}
                maxLength={80}
              />
            </label>
            <label className="pre-visit-cases__label">
              {t.fieldDescription}
              <textarea
                className="pre-visit-cases__textarea"
                rows={3}
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                maxLength={2000}
              />
            </label>
            <div className="pre-visit-cases__form-actions">
              <button
                type="button"
                className="pre-visit-cases__btn"
                onClick={() => setCreateOpen(false)}
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="pre-visit-cases__btn pre-visit-cases__btn--primary"
                disabled={saving}
              >
                {t.save}
              </button>
            </div>
          </form>
        ) : null}

        {loading ? (
          <p className="pre-visit-cases__muted">{t.loading}</p>
        ) : cases.length === 0 ? (
          <p className="pre-visit-cases__empty">{t.empty}</p>
        ) : (
          <ul className="pre-visit-cases__list">
            {cases.map((c) => (
              <li key={c.id}>
                <Link className="pre-visit-cases__card" to={`/pre-visit/cases/${c.id}`}>
                  <h2 className="pre-visit-cases__card-title">{c.title}</h2>
                  {c.category ? (
                    <p className="pre-visit-cases__card-meta">{c.category}</p>
                  ) : null}
                  <p className="pre-visit-cases__card-meta">
                    {t.sessionCount}: {c._count?.sessions ?? 0}
                  </p>
                  {c.description ? (
                    <p className="pre-visit-cases__card-desc">{c.description}</p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <nav className="pre-visit-cases__nav">
          <Link className="pre-visit-cases__link" to="/pre-visit/my-preparations">
            {t.linkPreparations}
          </Link>
          <Link className="pre-visit-cases__link" to="/startseite">
            {t.backHome}
          </Link>
        </nav>
      </div>
    </div>
  );
}
