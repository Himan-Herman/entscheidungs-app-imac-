import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { getPrimaryIntlLocale } from '../../../i18n/intlLocale.js';
import {
  archivePracticeMedicationPlan,
  createPracticeMedicationPlan,
  deletePracticeMedicationPlan,
  fetchPracticeMedicationPlan,
  fetchPracticeMedicationPlanAiFormat,
  fetchPracticeMedicationPlans,
  publishPracticeMedicationPlan,
  updatePracticeMedicationPlan,
} from "../api/practiceMedicationPlansApi.js";
import MedicationPlanItemCard from "./MedicationPlanItemCard.jsx";
import "../../../styles/PatientThreadsPage.css";
import "../../visitMedications/styles/VisitMedications.css";
import "../styles/MedicationPlan.css";

const EMPTY_ROW = () => ({
  medicationName: "",
  dosage: "",
  frequency: "",
  route: "",
  schedule: "",
  startDate: "",
  endDate: "",
  instructions: "",
});

function fmt(iso, lang) {
  try {
    return new Date(iso).toLocaleString(getPrimaryIntlLocale(lang), {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

function toDateInput(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function statusLabel(status, t) {
  const map = {
    draft: t.statusDraft,
    published: t.statusPublished,
    archived: t.statusArchived,
  };
  return map[status] || status;
}

function rowsFromPlan(plan) {
  if (!plan?.items?.length) return [EMPTY_ROW()];
  return plan.items.map((item) => ({
    medicationName: item.medicationName || "",
    dosage: item.dosage || "",
    frequency: item.frequency || "",
    route: item.route || "",
    schedule: item.schedule || "",
    startDate: toDateInput(item.startDate),
    endDate: toDateInput(item.endDate),
    instructions: item.instructions || "",
  }));
}

function payloadFromRows(rows, title, note) {
  return {
    title: title.trim() || undefined,
    note: note.trim() || undefined,
    items: rows
      .filter((r) => r.medicationName.trim())
      .map((r, index) => ({
        medicationName: r.medicationName.trim(),
        dosage: r.dosage.trim() || undefined,
        frequency: r.frequency.trim() || undefined,
        route: r.route.trim() || undefined,
        schedule: r.schedule.trim() || undefined,
        startDate: r.startDate || undefined,
        endDate: r.endDate || undefined,
        instructions: r.instructions.trim() || undefined,
        sortOrder: index,
      })),
  };
}

/**
 * @param {{ linkId: string, practiceId: string }} props
 */
export default function PracticePatientMedicationPlanSection({
  linkId,
  practiceId,
  readOnly = false,
}) {
  const { language } = useLanguage();
  const t = useMemo(
    () =>
      getMessages(language).practiceMedicationPlan ||
      getMessages("en").practiceMedicationPlan,
    [language],
  );
  const cardT = useMemo(
    () =>
      getMessages(language).patientMedicationPlan ||
      getMessages("en").patientMedicationPlan,
    [language],
  );

  const [plans, setPlans] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [activePlan, setActivePlan] = useState(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState([EMPTY_ROW()]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteStep, setDeleteStep] = useState(0);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiPreview, setAiPreview] = useState("");

  const isDraft = activePlan?.status === "draft";

  const loadList = useCallback(async () => {
    if (!linkId || !practiceId) return;
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchPracticeMedicationPlans(linkId, practiceId);
      if (res.status === 404 && data.error === "feature_disabled") {
        setPlans([]);
        setError(t.featureDisabled);
        return;
      }
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setPlans(Array.isArray(data.plans) ? data.plans : []);
    } catch {
      setPlans([]);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [linkId, practiceId, t.featureDisabled, t.loadError]);

  const loadPlan = useCallback(
    async (planId) => {
      if (!planId) {
        setActivePlan(null);
        return;
      }
      setBusy(true);
      try {
        const { res, data } = await fetchPracticeMedicationPlan(
          linkId,
          practiceId,
          planId,
        );
        if (res.ok && data.ok) {
          setActivePlan(data.plan);
          setTitle(data.plan.title || "");
          setNote(data.plan.note || "");
          setRows(rowsFromPlan(data.plan));
          setDeleteStep(0);
          setAiPreview("");
        }
      } finally {
        setBusy(false);
      }
    },
    [linkId, practiceId],
  );

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (activeId) loadPlan(activeId);
    else {
      setActivePlan(null);
      setTitle("");
      setNote("");
      setRows([EMPTY_ROW()]);
      setDeleteStep(0);
      setAiPreview("");
    }
  }, [activeId, loadPlan]);

  function updateRow(index, key, value) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
  }

  function addRow() {
    setRows((prev) => [...prev, EMPTY_ROW()]);
  }

  function removeRow(index) {
    setRows((prev) =>
      prev.length <= 1 ? [EMPTY_ROW()] : prev.filter((_, i) => i !== index),
    );
  }

  async function handleNewDraft() {
    setBusy(true);
    setError("");
    setStatusMsg("");
    try {
      const { res, data } = await createPracticeMedicationPlan(linkId, practiceId, {
        items: [],
      });
      if (!res.ok || !data.ok) {
        setError(t.createError);
        return;
      }
      await loadList();
      setActiveId(data.plan.id);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveDraft(e) {
    e.preventDefault();
    if (!activeId || !isDraft) return;
    setBusy(true);
    setError("");
    setStatusMsg("");
    try {
      const { res, data } = await updatePracticeMedicationPlan(
        linkId,
        practiceId,
        activeId,
        payloadFromRows(rows, title, note),
      );
      if (!res.ok || !data.ok) {
        setError(t.saveError);
        return;
      }
      setActivePlan(data.plan);
      setStatusMsg(t.saved);
      await loadList();
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish() {
    if (!activeId || !isDraft) return;
    const payload = payloadFromRows(rows, title);
    if (!payload.items.length) {
      setError(t.validationMedication);
      return;
    }
    setBusy(true);
    setError("");
    setStatusMsg("");
    try {
      const saveRes = await updatePracticeMedicationPlan(
        linkId,
        practiceId,
        activeId,
        payload,
      );
      if (!saveRes.res.ok || !saveRes.data.ok) {
        setError(t.publishError);
        return;
      }
      const { res, data } = await publishPracticeMedicationPlan(
        linkId,
        practiceId,
        activeId,
      );
      if (!res.ok || !data.ok) {
        setError(t.publishError);
        return;
      }
      setActivePlan(data.plan);
      setStatusMsg(t.published);
      await loadList();
    } finally {
      setBusy(false);
    }
  }

  async function handleAiFormat() {
    if (!activeId) return;
    setAiBusy(true);
    setError("");
    try {
      const { res, data } = await fetchPracticeMedicationPlanAiFormat(
        linkId,
        practiceId,
        activeId,
        { locale: language },
      );
      if (res.status === 503 && data.error === "ai_not_configured") {
        setError(t.aiNotConfigured);
        return;
      }
      if (!res.ok || !data.ok || !data.text) {
        setError(t.aiError);
        return;
      }
      setAiPreview(data.text);
    } finally {
      setAiBusy(false);
    }
  }

  async function handleDelete() {
    if (!activeId) return;
    if (deleteStep < 1) {
      setDeleteStep(1);
      setStatusMsg("");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { res, data } = await deletePracticeMedicationPlan(
        linkId,
        practiceId,
        activeId,
      );
      if (!res.ok || !data.ok) {
        setError(t.deleteError);
        return;
      }
      setStatusMsg(t.deleted);
      setActiveId("");
      setDeleteStep(0);
      await loadList();
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive() {
    if (!activeId) return;
    setBusy(true);
    setError("");
    setStatusMsg("");
    try {
      const { res, data } = await archivePracticeMedicationPlan(
        linkId,
        practiceId,
        activeId,
      );
      if (!res.ok || !data.ok) {
        setError(t.archiveError);
        return;
      }
      setActivePlan(data.plan);
      setStatusMsg(t.archived);
      await loadList();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="practice-dashboard__card medication-plan"
      aria-labelledby="practice-medication-plan-heading"
    >
      <h2
        id="practice-medication-plan-heading"
        className="practice-dashboard__analytics-heading"
      >
        {t.sectionTitle}
      </h2>
      <p className="practice-dashboard__muted">{t.sectionIntro}</p>

      {loading ? <p className="practice-dashboard__muted">{t.loading}</p> : null}
      {error ? (
        <p className="practice-dashboard__error" role="alert">
          {error}
        </p>
      ) : null}
      {statusMsg ? (
        <p className="medication-plan__success" role="status">
          {statusMsg}
        </p>
      ) : null}

      {!readOnly ? (
        <div className="medication-plan__actions">
          <button
            type="button"
            className="patient-threads__btn patient-threads__btn--primary"
            onClick={handleNewDraft}
            disabled={busy}
          >
            {t.newDraft}
          </button>
        </div>
      ) : null}

      {!loading && plans.length === 0 && !error ? (
        <p className="practice-dashboard__muted">{t.empty}</p>
      ) : null}

      {plans.length > 0 ? (
        <ul className="patient-threads__list" aria-label={t.planListCaption}>
          {plans.map((plan) => {
            const st = statusLabel(plan.status, t);
            const label = plan.title?.trim() || t.versionLabel.replace("{version}", plan.version);
            return (
              <li key={plan.id} className="patient-threads__item">
                <button
                  type="button"
                  className="patient-threads__btn patient-threads__btn--secondary"
                  style={{ width: "100%", textAlign: "left", marginBottom: "0.35rem" }}
                  onClick={() => setActiveId(plan.id)}
                  aria-pressed={activeId === plan.id}
                  aria-label={`${label}, ${t.statusAria.replace("{status}", st)}`}
                >
                  {label} · {st}
                </button>
                <span className="medication-plan__status">
                  {fmt(plan.updatedAt, language)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {activePlan ? (
        <div className="medication-plan__editor">
          {activePlan.status !== "draft" ? (
            <p className="practice-dashboard__muted" role="note">
              {t.readOnlyHint}
              {activePlan.publishedAt
                ? ` ${t.publishedAt.replace("{date}", fmt(activePlan.publishedAt, language))}`
                : ""}
            </p>
          ) : null}

          {isDraft ? (
            <form onSubmit={handleSaveDraft}>
              <label htmlFor="mp-title">{t.titleLabel}</label>
              <input
                id="mp-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.titlePlaceholder}
                disabled={busy}
              />
              <label htmlFor="mp-note">{t.noteLabel}</label>
              <textarea
                id="mp-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t.notePlaceholder}
                disabled={busy}
              />

              {rows.map((row, index) => (
                <fieldset
                  key={index}
                  className="medication-plan__row-card"
                  aria-labelledby={`mp-row-${index}`}
                >
                  <legend id={`mp-row-${index}`}>
                    {t.medicationNameLabel} {index + 1}
                  </legend>
                  <div className="medication-plan__grid medication-plan__grid--two">
                    <div>
                      <label htmlFor={`mp-name-${index}`}>{t.medicationNameLabel}</label>
                      <input
                        id={`mp-name-${index}`}
                        type="text"
                        value={row.medicationName}
                        onChange={(e) => updateRow(index, "medicationName", e.target.value)}
                        placeholder={t.medicationNamePlaceholder}
                        disabled={busy}
                        required={false}
                      />
                    </div>
                    <div>
                      <label htmlFor={`mp-dosage-${index}`}>{t.dosageLabel}</label>
                      <input
                        id={`mp-dosage-${index}`}
                        type="text"
                        value={row.dosage}
                        onChange={(e) => updateRow(index, "dosage", e.target.value)}
                        placeholder={t.dosagePlaceholder}
                        disabled={busy}
                      />
                    </div>
                    <div>
                      <label htmlFor={`mp-freq-${index}`}>{t.frequencyLabel}</label>
                      <input
                        id={`mp-freq-${index}`}
                        type="text"
                        value={row.frequency}
                        onChange={(e) => updateRow(index, "frequency", e.target.value)}
                        placeholder={t.frequencyPlaceholder}
                        disabled={busy}
                      />
                    </div>
                    <div>
                      <label htmlFor={`mp-route-${index}`}>{t.routeLabel}</label>
                      <input
                        id={`mp-route-${index}`}
                        type="text"
                        value={row.route}
                        onChange={(e) => updateRow(index, "route", e.target.value)}
                        placeholder={t.routePlaceholder}
                        disabled={busy}
                      />
                    </div>
                    <div>
                      <label htmlFor={`mp-schedule-${index}`}>{t.scheduleLabel}</label>
                      <input
                        id={`mp-schedule-${index}`}
                        type="text"
                        value={row.schedule}
                        onChange={(e) => updateRow(index, "schedule", e.target.value)}
                        placeholder={t.schedulePlaceholder}
                        disabled={busy}
                      />
                    </div>
                    <div>
                      <label htmlFor={`mp-start-${index}`}>{t.startDateLabel}</label>
                      <input
                        id={`mp-start-${index}`}
                        type="date"
                        value={row.startDate}
                        onChange={(e) => updateRow(index, "startDate", e.target.value)}
                        disabled={busy}
                      />
                    </div>
                    <div>
                      <label htmlFor={`mp-end-${index}`}>{t.endDateLabel}</label>
                      <input
                        id={`mp-end-${index}`}
                        type="date"
                        value={row.endDate}
                        onChange={(e) => updateRow(index, "endDate", e.target.value)}
                        disabled={busy}
                      />
                    </div>
                  </div>
                  <label htmlFor={`mp-inst-${index}`}>{t.instructionsLabel}</label>
                  <textarea
                    id={`mp-inst-${index}`}
                    value={row.instructions}
                    onChange={(e) => updateRow(index, "instructions", e.target.value)}
                    placeholder={t.instructionsPlaceholder}
                    disabled={busy}
                  />
                  <button
                    type="button"
                    className="vm-editor__remove"
                    onClick={() => removeRow(index)}
                    disabled={busy}
                    aria-label={t.removeMedication}
                  >
                    <Trash2 size={16} aria-hidden />
                    {t.removeMedication}
                  </button>
                </fieldset>
              ))}

              <button
                type="button"
                className="vm-editor__add"
                onClick={addRow}
                disabled={busy}
              >
                <Plus size={18} aria-hidden />
                {t.addMedication}
              </button>

              <div className="medication-plan__actions">
                <button
                  type="submit"
                  className="patient-threads__btn patient-threads__btn--primary"
                  disabled={busy}
                >
                  {t.saveDraft}
                </button>
                <button
                  type="button"
                  className="patient-threads__btn patient-threads__btn--secondary"
                  onClick={handlePublish}
                  disabled={busy}
                >
                  {t.publish}
                </button>
              </div>
            </form>
          ) : (
            <div className="vm-list" role="list">
              {activePlan.note ? (
                <p className="practice-dashboard__muted" role="note">
                  {activePlan.note}
                </p>
              ) : null}
              {(activePlan.items || []).map((item) => (
                <MedicationPlanItemCard
                  key={item.id}
                  item={item}
                  t={cardT}
                  language={language}
                />
              ))}
            </div>
          )}

          {!readOnly && activePlan ? (
            <div className="medication-plan__actions">
              <button
                type="button"
                className="patient-threads__btn patient-threads__btn--secondary"
                onClick={handleAiFormat}
                disabled={busy || aiBusy}
                aria-busy={aiBusy}
              >
                {aiBusy ? t.aiBusy : t.aiFormat}
              </button>
            </div>
          ) : null}

          {aiPreview ? (
            <div
              className="medication-plan__ai-preview"
              role="region"
              aria-labelledby="mp-ai-preview-heading"
            >
              <h3 id="mp-ai-preview-heading" className="medication-plan__ai-title">
                {t.aiDraftLabel}
              </h3>
              <p className="patient-inbox__safety">{t.aiDisclaimer}</p>
              <pre className="medication-plan__ai-text">{aiPreview}</pre>
            </div>
          ) : null}

          {!readOnly && activePlan ? (
            <div className="medication-plan__actions">
              {activePlan.status !== "archived" ? (
                <button
                  type="button"
                  className="patient-threads__btn patient-threads__btn--secondary"
                  onClick={handleArchive}
                  disabled={busy}
                >
                  {t.archive}
                </button>
              ) : null}
              <button
                type="button"
                className="patient-threads__btn patient-threads__btn--secondary"
                onClick={handleDelete}
                disabled={busy}
                aria-describedby={deleteStep > 0 ? "mp-delete-hint" : undefined}
              >
                {deleteStep > 0 ? t.deleteConfirmButton : t.delete}
              </button>
              {deleteStep > 0 ? (
                <div id="mp-delete-hint" role="alert" className="medication-plan__delete-hint">
                  <p>
                    <strong>{t.deleteConfirmTitle}</strong>
                  </p>
                  <p>{t.deleteConfirmHint}</p>
                  <button
                    type="button"
                    className="patient-threads__btn patient-threads__btn--secondary"
                    onClick={() => setDeleteStep(0)}
                    disabled={busy}
                  >
                    {t.deleteCancel}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
