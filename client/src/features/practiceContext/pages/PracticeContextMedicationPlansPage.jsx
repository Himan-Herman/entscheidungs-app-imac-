import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usePracticeContext } from "../usePracticeContext.js";
import { useScopedRequest } from "../hooks/useScopedRequest.js";
import {
  askScopedMedicationPlanQuestion,
  fetchScopedMedicationPlans,
} from "../api/scopedMedicationPlansApi.js";
import MedicationPlanItemCard from "../../medicationPlan/components/MedicationPlanItemCard.jsx";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { getPrimaryIntlLocale } from "../../../i18n/intlLocale.js";
// The stylesheets the cross-practice medication pages already use — this is a
// context migration of that view, not a new medication UX.
import "../../../styles/PatientInboxPage.css";
import "../../visitMedications/styles/VisitMedications.css";
import "../../medicationPlan/styles/MedicationPlan.css";

/**
 * Medication plans of one care relationship (Phase 2E.3).
 *
 * Shows the published plans this practice released to the patient, and nothing
 * else — not the plans of another practice, not those of another link to the
 * SAME practice, and not the medications the patient records for themselves.
 * That last separation matters: the personal medication manager is the
 * patient's own record and stays patient-global; showing it here would suggest
 * this practice issued it.
 *
 * Content is rendered by the existing MedicationPlanItemCard, so drug names,
 * dosages, frequencies and intake times appear exactly as the practice entered
 * them. Nothing on this page reformats, normalises or interprets them, and no
 * medication data is sent to an AI provider from here.
 *
 * Every request runs through useScopedRequest, so a response can only be
 * applied while its own context is still active.
 */
export default function PracticeContextMedicationPlansPage() {
  const { linkId, isActiveRelationship } = usePracticeContext();
  const { run } = useScopedRequest(linkId);
  const { language } = useLanguage();
  const t =
    getMessages(language).patientMedicationPlan ||
    getMessages("en").patientMedicationPlan;
  const tc = getMessages(language).practiceContext || getMessages("en").practiceContext;

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyPlanId, setBusyPlanId] = useState("");
  const [sentPlanId, setSentPlanId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const outcome = await run(
        ({ signal }) => fetchScopedMedicationPlans(linkId, { signal }),
        ({ res, data }) => {
          if (!res.ok || !data.ok) {
            setPlans([]);
            setError(res.status === 404 ? tc.notFoundBody : t.loadError);
            return;
          }
          setPlans(Array.isArray(data.plans) ? data.plans : []);
        },
      );
      if (!outcome.applied) return;
    } catch {
      setPlans([]);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [linkId, run, t.loadError, tc.notFoundBody]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Any acknowledgement belongs to the plan it was sent for. Keying it by plan
   * id rather than holding a single boolean means a switch of context cannot
   * leave a "question sent" note attached to a different practice's plan — the
   * page is remounted per link, and the id would not match in any case.
   */
  const ask = async (planId) => {
    setBusyPlanId(planId);
    setError("");
    setSentPlanId("");
    try {
      await run(
        ({ signal }) => askScopedMedicationPlanQuestion(linkId, planId, { signal }),
        ({ res, data }) => {
          if (!res.ok || !data.ok) {
            setError(t.questionError);
            return;
          }
          setSentPlanId(planId);
        },
      );
    } catch {
      setError(t.questionError);
    } finally {
      setBusyPlanId("");
    }
  };

  const fmtDate = (iso) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString(getPrimaryIntlLocale(language), {
        dateStyle: "medium",
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="practice-context patient-inbox medication-plan-detail">
      <h1 className="practice-context__title">{tc.medicationTitle}</h1>
      <p className="patient-inbox__intro">{tc.medicationScopeNote}</p>

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

      {!loading && !error && plans.length === 0 ? (
        <p className="practice-context__state">{tc.medicationEmpty}</p>
      ) : null}

      {/*
        Said in words, because the model marks no plan as "the current one":
        publishing a plan does not archive its predecessor, so several released
        plans can stand side by side. Order alone must not be read as validity.
      */}
      {!loading && plans.length > 1 ? (
        <p className="patient-inbox__muted">{tc.medicationOrderNote}</p>
      ) : null}

      {!loading && plans.length > 0 ? (
        <ul className="patient-inbox__list" data-testid="scoped-medication-plan-list">
          {plans.map((plan) => (
            <li key={plan.id} className="patient-inbox__item">
              <h2 className="patient-inbox__item-title">
                {plan.title || t.planTitleFallback}
              </h2>
              <p className="patient-inbox__item-meta">
                {t.versionLabel.replace("{version}", String(plan.version))}
                {plan.publishedAt
                  ? ` · ${t.publishedAt.replace("{date}", fmtDate(plan.publishedAt))}`
                  : ""}
              </p>
              {plan.note ? <p className="patient-inbox__muted">{plan.note}</p> : null}

              {plan.items.length > 0 ? (
                <div className="vm-list">
                  {plan.items.map((item) => (
                    <MedicationPlanItemCard
                      key={item.id}
                      item={item}
                      t={t}
                      language={language}
                    />
                  ))}
                </div>
              ) : null}

              {isActiveRelationship ? (
                <div className="patient-inbox__item-action">
                  <button
                    type="button"
                    className="patient-inbox__btn"
                    disabled={busyPlanId === plan.id}
                    onClick={() => ask(plan.id)}
                  >
                    {t.askQuestion}
                  </button>
                  {sentPlanId === plan.id ? (
                    <p className="patient-inbox__muted" role="status" aria-live="polite">
                      {t.questionSent}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {/*
        A signpost, not a merge: the patient's own medication record is theirs
        and lives outside every practice context.
      */}
      <p>
        <Link
          className="practice-context__own-medication-link"
          to="/patient/medication-plans"
        >
          {tc.medicationOwnLink}
        </Link>
      </p>

      <p className="patient-inbox__safety">{t.safetyNote}</p>
    </div>
  );
}
