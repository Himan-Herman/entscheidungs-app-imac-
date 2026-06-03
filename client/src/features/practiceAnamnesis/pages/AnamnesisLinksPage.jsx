import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  createAnamnesisLink,
  deleteAnamnesisLink,
  fetchAnamnesisLinks,
  patchAnamnesisLink,
} from "../api/practiceAnamnesisLinksApi.js";
import { fetchAnamnesisTemplate } from "../api/practiceAnamnesisApi.js";
import "../PracticeAnamnesisPages.css";

function getLabel(json, lang) {
  if (!json || typeof json !== "object") return "";
  return json[lang] || json.de || json.en || Object.values(json)[0] || "";
}

function buildPublicUrl(rawToken) {
  return `${window.location.origin}/anamnesis/qr/${rawToken}`;
}

export default function AnamnesisLinksPage() {
  const { templateId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = useMemo(() => getMessages(language).anamnesisLinks || getMessages("en").anamnesisLinks, [language]);
  const practiceId = searchParams.get("practiceId") || "";

  const [template, setTemplate] = useState(null);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newExpiry, setNewExpiry] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [newToken, setNewToken] = useState(null);
  const [newTokenCopied, setNewTokenCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const backUrl = `/practice/anamnesis/${templateId}${practiceId ? `?practiceId=${encodeURIComponent(practiceId)}` : ""}`;

  const load = useCallback(async () => {
    if (!practiceId) return;
    setLoading(true);
    setError("");
    try {
      const [tplRes, linksRes] = await Promise.all([
        fetchAnamnesisTemplate(practiceId, templateId),
        fetchAnamnesisLinks(practiceId, templateId),
      ]);
      if (!tplRes.res.ok) { setError("loadError"); return; }
      setTemplate(tplRes.data.template);
      if (linksRes.res.ok) setLinks(linksRes.data.links || []);
    } catch {
      setError("loadError");
    } finally {
      setLoading(false);
    }
  }, [practiceId, templateId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    const { res, data } = await createAnamnesisLink(practiceId, templateId, {
      label: newLabel || undefined,
      expiresAt: newExpiry || undefined,
    });
    setCreating(false);
    if (!res.ok) return;
    const url = buildPublicUrl(data.rawToken);
    setNewToken(url);
    setShowCreateForm(false);
    setNewLabel("");
    setNewExpiry("");
    QRCode.toDataURL(url, { width: 256, margin: 1 }).then(setQrDataUrl).catch(() => {});
    load();
  };

  const handleCopy = () => {
    if (!newToken) return;
    navigator.clipboard.writeText(newToken).then(() => {
      setNewTokenCopied(true);
      setTimeout(() => setNewTokenCopied(false), 2000);
    });
  };

  const handleQrDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = "anamnesis-qr.png";
    a.click();
  };

  const handleToggleActive = async (link) => {
    if (togglingId) return;
    setTogglingId(link.id);
    const next = !link.isActive;
    setLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, isActive: next } : l)));
    try {
      await patchAnamnesisLink(practiceId, templateId, link.id, { isActive: next });
    } catch {
      setLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, isActive: link.isActive } : l)));
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
    setConfirmDeleteId(null);
    await deleteAnamnesisLink(practiceId, templateId, id);
  };

  const templateTitle = template ? getLabel(template.titleJson, language) : "";

  if (loading) return <div className="anamnesis-hub__loading">{t.loading || "…"}</div>;
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
          <button type="button" className="anamnesis-hub__btn" onClick={() => setShowCreateForm((v) => !v)}>
            + {t.createLink}
          </button>
        </div>
      </div>

      <p className="anamnesis-hub__intro">{t.intro}</p>

      {newToken && (
        <div className="anamnesis-links__token-card">
          <h2 className="anamnesis-links__token-heading">{t.tokenCreatedHeading}</h2>
          <p className="anamnesis-links__token-hint">{t.tokenCreatedHint}</p>
          <div className="anamnesis-links__token-row">
            <input className="anamnesis-links__token-input" readOnly value={newToken} />
            <button type="button" className="anamnesis-hub__btn" onClick={handleCopy}>
              {newTokenCopied ? t.linkCopied : t.copyLink}
            </button>
          </div>
          {qrDataUrl && (
            <div className="anamnesis-links__qr-row">
              <img src={qrDataUrl} alt={t.qrCode} className="anamnesis-links__qr-img" />
              <button type="button" className="anamnesis-hub__btn anamnesis-hub__btn--outline" onClick={handleQrDownload}>
                ↓ {t.qrDownload}
              </button>
            </div>
          )}
          <button type="button" className="anamnesis-hub__btn anamnesis-hub__btn--ghost" aria-label={t.dismiss || t.cancel} onClick={() => setNewToken(null)}>
            ✕ <span className="visually-hidden">{t.dismiss || t.cancel}</span>
          </button>
        </div>
      )}

      {showCreateForm && (
        <form className="anamnesis-links__create-form" onSubmit={handleCreate}>
          <div className="anamnesis-edit__field">
            <label className="anamnesis-edit__label">{t.linkLabel}</label>
            <input
              className="anamnesis-edit__input"
              placeholder={t.linkLabelPlaceholder}
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
          </div>
          <div className="anamnesis-edit__field">
            <label className="anamnesis-edit__label">{t.linkExpiry}</label>
            <input
              type="datetime-local"
              className="anamnesis-edit__input"
              value={newExpiry}
              onChange={(e) => setNewExpiry(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="submit" className="anamnesis-hub__btn" disabled={creating}>
              {creating ? (t.creatingLink || "…") : t.createLinkBtn}
            </button>
            <button type="button" className="anamnesis-hub__btn anamnesis-hub__btn--ghost" aria-label={t.cancel} onClick={() => setShowCreateForm(false)}>
              ✕ <span className="visually-hidden">{t.cancel}</span>
            </button>
          </div>
        </form>
      )}

      {links.length === 0 ? (
        <p className="anamnesis-hub__empty">{t.noLinks}</p>
      ) : (
        <ul className="anamnesis-links__list">
          {links.map((link) => (
            <li key={link.id} className={`anamnesis-links__item${link.isActive ? "" : " anamnesis-links__item--inactive"}`}>
              <div className="anamnesis-links__item-meta">
                <span className="anamnesis-links__item-label">{link.label || `#${link.tokenPrefix}`}</span>
                <span className={`anamnesis-hub__badge${link.isActive ? "" : " anamnesis-hub__badge--archived"}`}>
                  {link.isActive ? t.statusActive : t.statusInactive}
                </span>
                {link._count?.submissions > 0 && (
                  <span className="anamnesis-links__submission-count">
                    {link._count.submissions === 1
                      ? t.submissionCount_one.replace("{{count}}", 1)
                      : t.submissionCount_other.replace("{{count}}", link._count.submissions)}
                  </span>
                )}
              </div>
              <div className="anamnesis-links__item-dates">
                <span>{t.createdAt}: {new Date(link.createdAt).toLocaleDateString(language)}</span>
                {link.expiresAt && (
                  <span>{t.expiresAt}: {new Date(link.expiresAt).toLocaleDateString(language)}</span>
                )}
                <span className="anamnesis-links__prefix">{t.prefix}: {link.tokenPrefix}…</span>
              </div>
              <div className="anamnesis-links__item-actions">
                <button
                  type="button"
                  className="anamnesis-hub__btn anamnesis-hub__btn--sm anamnesis-hub__btn--outline"
                  onClick={() => navigate(`/practice/anamnesis/${templateId}/submissions${practiceId ? `?practiceId=${encodeURIComponent(practiceId)}` : ""}`)}
                >
                  {t.viewSubmissions}
                </button>
                <button
                  type="button"
                  className="anamnesis-hub__btn anamnesis-hub__btn--sm anamnesis-hub__btn--outline"
                  onClick={() => handleToggleActive(link)}
                  disabled={togglingId === link.id}
                >
                  {togglingId === link.id ? (t.toggling || "…") : (link.isActive ? t.deactivate : t.reactivate)}
                </button>
                {confirmDeleteId === link.id ? (
                  <>
                    <button type="button" className="anamnesis-hub__btn anamnesis-hub__btn--sm" style={{ background: "var(--color-danger, #e53)" }} onClick={() => handleDelete(link.id)}>
                      {t.deleteLink}
                    </button>
                    <button type="button" className="anamnesis-hub__btn anamnesis-hub__btn--sm anamnesis-hub__btn--ghost" onClick={() => setConfirmDeleteId(null)}>
                      {t.cancel}
                    </button>
                  </>
                ) : (
                  <button type="button" className="anamnesis-hub__btn anamnesis-hub__btn--sm anamnesis-hub__btn--ghost" aria-label={t.deleteLink} onClick={() => setConfirmDeleteId(link.id)}>
                    🗑
                  </button>
                )}
              </div>
              {confirmDeleteId === link.id && (
                <p className="anamnesis-links__confirm-text">{t.confirmDeleteLink}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
