import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  createAnamnesisTemplate,
  fetchAnamnesisTemplate,
  patchAnamnesisTemplate,
  putFullAnamnesisTemplate,
} from "../api/practiceAnamnesisApi.js";
import {
  STANDARD_QUESTION_CATALOG,
  emptyLangMap,
  newDraftQuestion,
  questionFromCatalog,
} from "../standardQuestions.js";
import "../PracticeAnamnesisPages.css";

const LANGS = ["de", "en", "fr", "it", "es"];
const QUESTION_TYPES = ["text", "textarea", "single_choice", "multi_choice", "date", "number", "yes_no"];

function getLabel(json, lang) {
  if (!json || typeof json !== "object") return "";
  return json[lang] || json.de || json.en || Object.values(json)[0] || "";
}

function newDraftSection() {
  return {
    _clientId: `_sec_${Math.random().toString(36).slice(2)}`,
    titleJson: emptyLangMap(),
    questions: [],
  };
}

function templateToDraft(tpl) {
  if (!tpl) return null;
  const sections = Array.isArray(tpl.sections) && tpl.sections.length > 0
    ? tpl.sections.map((s) => ({
        _clientId: s.id,
        titleJson: { ...emptyLangMap(), ...(s.titleJson || {}) },
        questions: (s.questions || []).map((q) => ({
          _clientId: q.id,
          type: q.type || "text",
          labelJson: { ...emptyLangMap(), ...(q.labelJson || {}) },
          hintJson: { ...emptyLangMap(), ...(q.hintJson || {}) },
          optionsJson: Array.isArray(q.optionsJson) ? q.optionsJson.map((o) => ({ ...emptyLangMap(), ...o })) : [],
          isRequired: Boolean(q.isRequired),
        })),
      }))
    : [];

  const unsectioned = Array.isArray(tpl.questions) ? tpl.questions : [];
  if (unsectioned.length > 0 && sections.length === 0) {
    const generalSection = {
      _clientId: `_sec_general`,
      titleJson: { de: "Allgemein", en: "General", fr: "Général", it: "Generale", es: "General" },
      questions: unsectioned.map((q) => ({
        _clientId: q.id,
        type: q.type || "text",
        labelJson: { ...emptyLangMap(), ...(q.labelJson || {}) },
        hintJson: { ...emptyLangMap(), ...(q.hintJson || {}) },
        optionsJson: Array.isArray(q.optionsJson) ? q.optionsJson.map((o) => ({ ...emptyLangMap(), ...o })) : [],
        isRequired: Boolean(q.isRequired),
      })),
    };
    sections.push(generalSection);
  }

  return {
    titleJson: { ...emptyLangMap(), ...(tpl.titleJson || {}) },
    descriptionJson: { ...emptyLangMap(), ...(tpl.descriptionJson || {}) },
    sections,
  };
}

// ── Type badge ────────────────────────────────────────────────────────────────

const TYPE_ICONS = {
  text: "T",
  textarea: "¶",
  single_choice: "◉",
  multi_choice: "☑",
  date: "📅",
  number: "#",
  yes_no: "?",
};

// ── Main component ────────────────────────────────────────────────────────────

export default function PracticeAnamnesisTemplatePage() {
  const { templateId } = useParams();
  const isNew = !templateId || templateId === "new";

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = useMemo(() => getMessages(language).practiceAnamnesis || getMessages("en").practiceAnamnesis, [language]);

  const practiceId = searchParams.get("practiceId") || "";
  const startInEditMode = searchParams.get("edit") === "1" || isNew;

  const [activeLang, setActiveLang] = useState(LANGS.includes(language) ? language : "de");

  // ── Server data ──────────────────────────────────────────────────────────
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [fetchError, setFetchError] = useState("");

  // ── Edit mode ────────────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(startInEditMode);
  const [draft, setDraft] = useState(isNew ? { titleJson: emptyLangMap(), descriptionJson: emptyLangMap(), sections: [] } : null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const savedIdRef = useRef(isNew ? null : templateId);

  useEffect(() => { document.title = isNew ? t.editorTitle : (getLabel(template?.titleJson, activeLang) || t.editorTitle); }, [template, t.editorTitle, activeLang, isNew]);

  const load = useCallback(async () => {
    if (isNew || !practiceId) return;
    setLoading(true);
    setFetchError("");
    try {
      const { res, data } = await fetchAnamnesisTemplate(practiceId, templateId);
      if (!res.ok || !data.ok) throw new Error(data?.error || "load_failed");
      setTemplate(data.template);
      savedIdRef.current = data.template.id;
      if (startInEditMode) setDraft(templateToDraft(data.template));
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setFetchError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [isNew, practiceId, templateId, t.loadError, startInEditMode]);

  useEffect(() => { void load(); }, [load]);

  function enterEditMode() {
    setDraft(templateToDraft(template));
    setEditingQuestionId(null);
    setSaveError("");
    setSaveSuccess(false);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    if (!window.confirm(t.cancelEditConfirm)) return;
    setDraft(null);
    setEditingQuestionId(null);
    setSaveError("");
    setIsEditing(false);
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);

    try {
      const body = {
        titleJson: draft.titleJson,
        descriptionJson: draft.descriptionJson,
        sections: draft.sections,
      };

      if (!savedIdRef.current) {
        // New template — create it first
        const { res, data } = await createAnamnesisTemplate(practiceId, {
          titleJson: draft.titleJson,
          descriptionJson: draft.descriptionJson,
        });
        if (!res.ok || !data.ok) throw new Error(data?.error || "save_failed");
        savedIdRef.current = data.template.id;
      }

      const { res, data } = await putFullAnamnesisTemplate(practiceId, savedIdRef.current, body);
      if (!res.ok || !data.ok) throw new Error(data?.error || "save_failed");

      setTemplate(data.template);
      setDraft(null);
      setEditingQuestionId(null);
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      if (isNew) {
        navigate(`/practice/anamnesis/${savedIdRef.current}?practiceId=${encodeURIComponent(practiceId)}`, { replace: true });
      }
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setSaveError(t.saveError);
    } finally {
      setSaving(false);
    }
  }

  // ── Draft mutations ───────────────────────────────────────────────────────

  function setDraftField(path, value) {
    setDraft((prev) => {
      const next = { ...prev };
      if (path === "titleJson") next.titleJson = value;
      if (path === "descriptionJson") next.descriptionJson = value;
      return next;
    });
  }

  function addSection() {
    setDraft((prev) => ({ ...prev, sections: [...prev.sections, newDraftSection()] }));
  }

  function updateSection(secClientId, patch) {
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => s._clientId === secClientId ? { ...s, ...patch } : s),
    }));
  }

  function deleteSection(secClientId) {
    if (!window.confirm(t.confirmDeleteSection)) return;
    setDraft((prev) => ({ ...prev, sections: prev.sections.filter((s) => s._clientId !== secClientId) }));
  }

  function moveSection(secClientId, dir) {
    setDraft((prev) => {
      const idx = prev.sections.findIndex((s) => s._clientId === secClientId);
      const next = [...prev.sections];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...prev, sections: next };
    });
  }

  function addQuestion(secClientId) {
    const q = newDraftQuestion();
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s._clientId === secClientId ? { ...s, questions: [...s.questions, q] } : s,
      ),
    }));
    setEditingQuestionId(q._clientId);
  }

  function addStandardQuestion(secClientId, catalogId) {
    const item = STANDARD_QUESTION_CATALOG.find((x) => x.id === catalogId);
    if (!item) return;
    const q = questionFromCatalog(item);
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s._clientId === secClientId ? { ...s, questions: [...s.questions, q] } : s,
      ),
    }));
    setEditingQuestionId(q._clientId);
  }

  function updateQuestion(secClientId, qClientId, patch) {
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s._clientId === secClientId
          ? { ...s, questions: s.questions.map((q) => q._clientId === qClientId ? { ...q, ...patch } : q) }
          : s,
      ),
    }));
  }

  function deleteQuestion(secClientId, qClientId) {
    if (!window.confirm(t.confirmDeleteQuestion)) return;
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s._clientId === secClientId
          ? { ...s, questions: s.questions.filter((q) => q._clientId !== qClientId) }
          : s,
      ),
    }));
    if (editingQuestionId === qClientId) setEditingQuestionId(null);
  }

  function moveQuestion(secClientId, qClientId, dir) {
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => {
        if (s._clientId !== secClientId) return s;
        const idx = s.questions.findIndex((q) => q._clientId === qClientId);
        const next = [...s.questions];
        const target = idx + dir;
        if (target < 0 || target >= next.length) return s;
        [next[idx], next[target]] = [next[target], next[idx]];
        return { ...s, questions: next };
      }),
    }));
  }

  function addOption(secClientId, qClientId) {
    updateQuestion(secClientId, qClientId, {
      optionsJson: [
        ...(draft.sections.find((s) => s._clientId === secClientId)?.questions.find((q) => q._clientId === qClientId)?.optionsJson || []),
        emptyLangMap(),
      ],
    });
  }

  function updateOption(secClientId, qClientId, optIdx, val) {
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => {
        if (s._clientId !== secClientId) return s;
        return {
          ...s,
          questions: s.questions.map((q) => {
            if (q._clientId !== qClientId) return q;
            const opts = q.optionsJson.map((o, i) => i === optIdx ? { ...o, [activeLang]: val } : o);
            return { ...q, optionsJson: opts };
          }),
        };
      }),
    }));
  }

  function removeOption(secClientId, qClientId, optIdx) {
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => {
        if (s._clientId !== secClientId) return s;
        return {
          ...s,
          questions: s.questions.map((q) => {
            if (q._clientId !== qClientId) return q;
            return { ...q, optionsJson: q.optionsJson.filter((_, i) => i !== optIdx) };
          }),
        };
      }),
    }));
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderTypeIcon(type) {
    return <span className="anamnesis-editor__type-badge" title={t[`type_${type}`] || type}>{TYPE_ICONS[type] || "?"}</span>;
  }

  function renderViewQuestion(q, idx) {
    const label = getLabel(q.labelJson, activeLang) || getLabel(q.labelJson, "de") || `Frage ${idx + 1}`;
    const hint = q.hintJson ? getLabel(q.hintJson, activeLang) : "";
    const required = q.isRequired;

    return (
      <div key={q.id || q._clientId || idx} className="anamnesis-view__question">
        <div className="anamnesis-view__question-row">
          {renderTypeIcon(q.type)}
          <span className="anamnesis-view__question-label">
            {required && <span className="anamnesis-view__required" aria-label="Pflichtfeld">*</span>}
            {label}
          </span>
        </div>
        {hint && <div className="anamnesis-view__question-hint">{hint}</div>}
        {(q.type === "single_choice" || q.type === "multi_choice") && Array.isArray(q.optionsJson) && (
          <ul className="anamnesis-view__options">
            {q.optionsJson.map((opt, i) => (
              <li key={i} className="anamnesis-view__option">
                <span className="anamnesis-view__option-marker">
                  {q.type === "single_choice" ? "○" : "□"}
                </span>
                {getLabel(opt, activeLang) || `Option ${i + 1}`}
              </li>
            ))}
          </ul>
        )}
        {q.type === "yes_no" && (
          <div className="anamnesis-view__yes-no">
            <span className="anamnesis-view__yes-no-btn">Ja</span>
            <span className="anamnesis-view__yes-no-btn">Nein</span>
          </div>
        )}
        {q.type === "textarea" && <div className="anamnesis-view__textarea-preview" aria-hidden="true" />}
        {q.type === "number" && <div className="anamnesis-view__number-preview" aria-hidden="true" />}
        {q.type === "date" && <div className="anamnesis-view__date-preview" aria-hidden="true" />}
      </div>
    );
  }

  function renderEditQuestion(sec, q) {
    const isOpen = editingQuestionId === q._clientId;

    return (
      <div key={q._clientId} className={`anamnesis-edit__question${isOpen ? " anamnesis-edit__question--open" : ""}`}>
        <div className="anamnesis-edit__question-header">
          <button
            type="button"
            className="anamnesis-edit__question-toggle"
            onClick={() => setEditingQuestionId(isOpen ? null : q._clientId)}
            aria-expanded={isOpen}
          >
            {renderTypeIcon(q.type)}
            <span className="anamnesis-edit__question-preview">
              {q.isRequired && <span className="anamnesis-view__required">*</span>}
              {getLabel(q.labelJson, activeLang) || getLabel(q.labelJson, "de") || t.questionLabel}
            </span>
            <span className="anamnesis-edit__question-chevron">{isOpen ? "▲" : "▼"}</span>
          </button>
          <div className="anamnesis-edit__question-controls">
            <button type="button" className="anamnesis-edit__icon-btn" onClick={() => moveQuestion(sec._clientId, q._clientId, -1)} aria-label={t.moveUp} title={t.moveUp}>↑</button>
            <button type="button" className="anamnesis-edit__icon-btn" onClick={() => moveQuestion(sec._clientId, q._clientId, 1)} aria-label={t.moveDown} title={t.moveDown}>↓</button>
            <button type="button" className="anamnesis-edit__icon-btn anamnesis-edit__icon-btn--danger" onClick={() => deleteQuestion(sec._clientId, q._clientId)} aria-label={t.deleteQuestion} title={t.deleteQuestion}>🗑</button>
          </div>
        </div>

        {isOpen && (
          <div className="anamnesis-edit__question-form">
            {/* Type */}
            <div className="anamnesis-edit__field">
              <label className="anamnesis-edit__label">{t.questionType}</label>
              <select
                className="anamnesis-edit__select"
                value={q.type}
                onChange={(e) => updateQuestion(sec._clientId, q._clientId, { type: e.target.value })}
              >
                {QUESTION_TYPES.map((tp) => (
                  <option key={tp} value={tp}>{t[`type_${tp}`] || tp}</option>
                ))}
              </select>
            </div>

            {/* Label */}
            <div className="anamnesis-edit__field">
              <label className="anamnesis-edit__label">{t.questionLabel} [{activeLang.toUpperCase()}]</label>
              <input
                className="anamnesis-edit__input"
                type="text"
                value={q.labelJson[activeLang] || ""}
                onChange={(e) => updateQuestion(sec._clientId, q._clientId, { labelJson: { ...q.labelJson, [activeLang]: e.target.value } })}
              />
            </div>

            {/* Hint */}
            <div className="anamnesis-edit__field">
              <label className="anamnesis-edit__label">{t.questionHint} [{activeLang.toUpperCase()}]</label>
              <input
                className="anamnesis-edit__input"
                type="text"
                value={q.hintJson?.[activeLang] || ""}
                onChange={(e) => updateQuestion(sec._clientId, q._clientId, { hintJson: { ...(q.hintJson || emptyLangMap()), [activeLang]: e.target.value } })}
              />
            </div>

            {/* Required */}
            <div className="anamnesis-edit__field">
              <label className="anamnesis-edit__checkbox-row">
                <input
                  type="checkbox"
                  checked={Boolean(q.isRequired)}
                  onChange={(e) => updateQuestion(sec._clientId, q._clientId, { isRequired: e.target.checked })}
                />
                <span>{t.questionRequired}</span>
              </label>
            </div>

            {/* Options */}
            {(q.type === "single_choice" || q.type === "multi_choice") && (
              <div className="anamnesis-edit__field">
                <label className="anamnesis-edit__label">{t.questionOptions} [{activeLang.toUpperCase()}]</label>
                <ul className="anamnesis-edit__options">
                  {(q.optionsJson || []).map((opt, optIdx) => (
                    <li key={optIdx} className="anamnesis-edit__option-row">
                      <input
                        className="anamnesis-edit__input anamnesis-edit__input--option"
                        type="text"
                        value={opt[activeLang] || ""}
                        onChange={(e) => updateOption(sec._clientId, q._clientId, optIdx, e.target.value)}
                        placeholder={`Option ${optIdx + 1}`}
                      />
                      <button
                        type="button"
                        className="anamnesis-edit__icon-btn anamnesis-edit__icon-btn--danger"
                        onClick={() => removeOption(sec._clientId, q._clientId, optIdx)}
                        aria-label={t.removeOption}
                      >×</button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="anamnesis-edit__add-btn"
                  onClick={() => addOption(sec._clientId, q._clientId)}
                >
                  + {t.addOption}
                </button>
              </div>
            )}

            <button
              type="button"
              className="anamnesis-edit__done-btn"
              onClick={() => setEditingQuestionId(null)}
            >
              ✓ {t.doneEditing}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Loading / error ───────────────────────────────────────────────────────

  if (loading) return <div className="anamnesis-editor"><p className="anamnesis-editor__loading">{t.loading}</p></div>;
  if (fetchError) return <div className="anamnesis-editor"><p className="anamnesis-editor__error">{fetchError}</p></div>;

  // ── View mode ─────────────────────────────────────────────────────────────

  if (!isEditing && template) {
    const title = getLabel(template.titleJson, activeLang);
    const desc = template.descriptionJson ? getLabel(template.descriptionJson, activeLang) : null;

    return (
      <div className="anamnesis-editor">
        <nav className="anamnesis-editor__top-nav">
          <Link className="anamnesis-editor__back-link" to={`/practice/anamnesis${practiceId ? `?practiceId=${encodeURIComponent(practiceId)}` : ""}`}>
            ← {t.backList}
          </Link>
        </nav>

        <div className="anamnesis-view__header">
          <div>
            <h1 className="anamnesis-view__title">{title || "—"}</h1>
            {desc && <p className="anamnesis-view__desc">{desc}</p>}
            <span className={`anamnesis-hub__badge${template.status === "archived" ? " anamnesis-hub__badge--archived" : ""}`}>
              {template.status === "archived" ? t.statusArchived : t.statusActive}
            </span>
          </div>

          <div className="anamnesis-view__header-actions">
            {/* Language tabs */}
            <div className="anamnesis-editor__lang-tabs" role="tablist" aria-label={t.languageTab}>
              {LANGS.map((lng) => (
                <button
                  key={lng}
                  type="button"
                  role="tab"
                  aria-selected={activeLang === lng}
                  className={`anamnesis-editor__lang-tab${activeLang === lng ? " anamnesis-editor__lang-tab--active" : ""}`}
                  onClick={() => setActiveLang(lng)}
                >
                  {lng.toUpperCase()}
                </button>
              ))}
            </div>
            <button type="button" className="anamnesis-hub__btn" onClick={enterEditMode}>
              ✏ {t.startEditing}
            </button>
          </div>
        </div>

        {saveSuccess && (
          <p className="anamnesis-editor__status anamnesis-editor__status--success" role="status">{t.saved}</p>
        )}

        {(!template.sections || template.sections.length === 0) && (!template.questions || template.questions.length === 0) ? (
          <div className="anamnesis-hub__empty">
            <p>{t.noSections}</p>
            <button type="button" className="anamnesis-hub__btn" onClick={enterEditMode}>✏ {t.startEditing}</button>
          </div>
        ) : (
          <div className="anamnesis-view__sections">
            {(template.sections || []).map((sec, sIdx) => (
              <section key={sec.id} className="anamnesis-view__section">
                <h2 className="anamnesis-view__section-title">
                  <span className="anamnesis-view__section-number">{sIdx + 1}</span>
                  {getLabel(sec.titleJson, activeLang) || `Abschnitt ${sIdx + 1}`}
                </h2>
                <div className="anamnesis-view__questions">
                  {(sec.questions || []).map((q, qIdx) => renderViewQuestion(q, qIdx))}
                </div>
              </section>
            ))}
            {/* Unsectioned legacy questions */}
            {Array.isArray(template.questions) && template.questions.length > 0 && (
              <section className="anamnesis-view__section">
                <h2 className="anamnesis-view__section-title">
                  <span className="anamnesis-view__section-number">+</span>
                  Allgemein
                </h2>
                <div className="anamnesis-view__questions">
                  {template.questions.map((q, qi) => renderViewQuestion(q, qi))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Edit mode (also used for new template) ────────────────────────────────

  if (!draft) return <div className="anamnesis-editor"><p>{t.loading}</p></div>;

  return (
    <div className="anamnesis-editor anamnesis-editor--editing">
      {/* Edit mode top bar */}
      <div className="anamnesis-edit__topbar" role="banner">
        <div className="anamnesis-edit__topbar-label">
          <span className="anamnesis-edit__topbar-icon">✏</span>
          {t.editModeLabel}
          <span className="anamnesis-edit__topbar-hint">{t.editModeHint}</span>
        </div>
        <div className="anamnesis-edit__topbar-actions">
          <button
            type="button"
            className="anamnesis-hub__btn"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? t.saving : t.save}
          </button>
          {!isNew && (
            <button
              type="button"
              className="anamnesis-hub__btn anamnesis-hub__btn--outline"
              onClick={handleCancelEdit}
              disabled={saving}
            >
              {t.cancel}
            </button>
          )}
          {isNew && (
            <Link
              className="anamnesis-hub__btn anamnesis-hub__btn--outline"
              to={`/practice/anamnesis${practiceId ? `?practiceId=${encodeURIComponent(practiceId)}` : ""}`}
            >
              {t.cancel}
            </Link>
          )}
        </div>
      </div>

      {saveError && (
        <p className="anamnesis-editor__status anamnesis-editor__status--error" role="alert">{saveError}</p>
      )}

      <nav className="anamnesis-editor__top-nav" style={{ marginTop: "0.5rem" }}>
        <Link className="anamnesis-editor__back-link" to={`/practice/anamnesis${practiceId ? `?practiceId=${encodeURIComponent(practiceId)}` : ""}`}>
          ← {t.backList}
        </Link>
      </nav>

      {/* Language tabs */}
      <div className="anamnesis-editor__lang-tabs" role="tablist" aria-label={t.languageTab} style={{ marginTop: "1rem" }}>
        {LANGS.map((lng) => (
          <button
            key={lng}
            type="button"
            role="tab"
            aria-selected={activeLang === lng}
            className={`anamnesis-editor__lang-tab${activeLang === lng ? " anamnesis-editor__lang-tab--active" : ""}`}
            onClick={() => setActiveLang(lng)}
          >
            {t[`lang_${lng}`] || lng.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Template metadata */}
      <div className="anamnesis-edit__meta-card">
        <div className="anamnesis-edit__field">
          <label className="anamnesis-edit__label" htmlFor="tpl-title">
            {t.templateTitle} [{activeLang.toUpperCase()}]
          </label>
          <input
            id="tpl-title"
            className="anamnesis-edit__input anamnesis-edit__input--title"
            type="text"
            value={draft.titleJson[activeLang] || ""}
            onChange={(e) => setDraftField("titleJson", { ...draft.titleJson, [activeLang]: e.target.value })}
            placeholder={t.templateTitlePlaceholder}
          />
        </div>
        <div className="anamnesis-edit__field">
          <label className="anamnesis-edit__label" htmlFor="tpl-desc">
            {t.templateDescription} [{activeLang.toUpperCase()}]
          </label>
          <input
            id="tpl-desc"
            className="anamnesis-edit__input"
            type="text"
            value={draft.descriptionJson[activeLang] || ""}
            onChange={(e) => setDraftField("descriptionJson", { ...draft.descriptionJson, [activeLang]: e.target.value })}
          />
        </div>
      </div>

      {/* Sections */}
      {draft.sections.length === 0 && (
        <div className="anamnesis-hub__empty" style={{ margin: "1.5rem 0" }}>
          <p>{t.noSections}</p>
        </div>
      )}

      {draft.sections.map((sec, sIdx) => (
        <div key={sec._clientId} className="anamnesis-edit__section">
          {/* Section header */}
          <div className="anamnesis-edit__section-header">
            <span className="anamnesis-edit__section-number">{sIdx + 1}</span>
            <input
              className="anamnesis-edit__input anamnesis-edit__input--section-title"
              type="text"
              value={sec.titleJson[activeLang] || ""}
              onChange={(e) => updateSection(sec._clientId, { titleJson: { ...sec.titleJson, [activeLang]: e.target.value } })}
              placeholder={t.sectionTitlePlaceholder}
              aria-label={`${t.sectionTitle} ${sIdx + 1}`}
            />
            <div className="anamnesis-edit__section-controls">
              <button type="button" className="anamnesis-edit__icon-btn" onClick={() => moveSection(sec._clientId, -1)} disabled={sIdx === 0} title={t.moveUp}>↑</button>
              <button type="button" className="anamnesis-edit__icon-btn" onClick={() => moveSection(sec._clientId, 1)} disabled={sIdx === draft.sections.length - 1} title={t.moveDown}>↓</button>
              <button type="button" className="anamnesis-edit__icon-btn anamnesis-edit__icon-btn--danger" onClick={() => deleteSection(sec._clientId)} title={t.deleteSection}>🗑</button>
            </div>
          </div>

          {/* Questions */}
          <div className="anamnesis-edit__questions">
            {sec.questions.length === 0 && (
              <p className="anamnesis-edit__no-questions">{t.noQuestions}</p>
            )}
            {sec.questions.map((q) => renderEditQuestion(sec, q))}
          </div>

          {/* Add question controls */}
          <div className="anamnesis-edit__add-question-row">
            <button
              type="button"
              className="anamnesis-hub__btn anamnesis-hub__btn--sm"
              onClick={() => addQuestion(sec._clientId)}
            >
              + {t.addQuestion}
            </button>
            <select
              className="anamnesis-edit__catalog-select"
              defaultValue=""
              onChange={(e) => { if (e.target.value) { addStandardQuestion(sec._clientId, e.target.value); e.target.value = ""; } }}
              aria-label={t.addStandardQuestion}
            >
              <option value="" disabled>⭐ {t.addStandardQuestion}</option>
              {STANDARD_QUESTION_CATALOG.map((item) => (
                <option key={item.id} value={item.id}>{t[item.labelKey] || item.id}</option>
              ))}
            </select>
          </div>
        </div>
      ))}

      {/* Add section */}
      <button
        type="button"
        className="anamnesis-edit__add-section-btn"
        onClick={addSection}
      >
        + {t.addSection}
      </button>

      {/* Bottom save bar */}
      <div className="anamnesis-edit__bottom-bar">
        <button type="button" className="anamnesis-hub__btn" onClick={() => void handleSave()} disabled={saving}>
          {saving ? t.saving : t.save}
        </button>
        {!isNew && (
          <button type="button" className="anamnesis-hub__btn anamnesis-hub__btn--outline" onClick={handleCancelEdit} disabled={saving}>
            {t.cancel}
          </button>
        )}
        {saveError && <span className="anamnesis-editor__status anamnesis-editor__status--error">{saveError}</span>}
      </div>
    </div>
  );
}
