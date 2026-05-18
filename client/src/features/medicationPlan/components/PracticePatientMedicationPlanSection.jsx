import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  archivePracticeMedicationPlan,
  createPracticeMedicationPlan,
  fetchPracticeMedicationPlan,
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
    return new Date(iso).toLocaleString(lang === "de" ? "de-DE" : "en-GB", {
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

function payloadFromRows(rows, title) {
  return {
    title: title.trim() || undefined,
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
export default function PracticePatientMedicationPlanSection({ linkId, practiceId }) {
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
  const [rows, setRows] = useState([EMPTY_ROW()]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [busy, setBusy] = useState(false);

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
          setRows(rowsFromPlan(data.plan));
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
      setRows([EMPTY_ROW()]);
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
        payloadFromRows(rows, title),
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

          {activePlan.status !== "archived" ? (
            <div className="medication-plan__actions">
              <button
                type="button"
                className="patient-threads__btn patient-threads__btn--secondary"
                onClick={handleArchive}
                disabled={busy}
              >
                {t.archive}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
