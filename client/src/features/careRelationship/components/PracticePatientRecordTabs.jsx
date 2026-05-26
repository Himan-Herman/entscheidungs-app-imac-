import { useId } from "react";

const TABS = [
  { id: "overview", labelKey: "tabOverview" },
  { id: "profile", labelKey: "tabProfile" },
  { id: "previsits", labelKey: "tabPreVisits" },
  { id: "medication", labelKey: "tabMedication" },
  { id: "documents", labelKey: "tabDocuments" },
  { id: "vitals", labelKey: "tabVitals" },
  { id: "vaccinations", labelKey: "tabVaccinations" },
  { id: "healthHistory", labelKey: "tabHealthHistory" },
  { id: "erezept", labelKey: "tabErezept" },
  { id: "messages", labelKey: "tabMessages" },
  { id: "activity", labelKey: "tabActivity" },
];

/**
 * @param {{ activeTab: string, onTabChange: (id: string) => void, t: Record<string, string> }} props
 */
export default function PracticePatientRecordTabs({ activeTab, onTabChange, t }) {
  const baseId = useId();

  return (
    <div className="practice-record__tabs-wrap">
      <div className="practice-record__tab-select-wrap">
        <label htmlFor={`${baseId}-tab-select`} className="practice-team__sr-only">
          {t.recordTabSelect}
        </label>
        <select
          id={`${baseId}-tab-select`}
          className="practice-record__tab-select"
          value={activeTab}
          onChange={(e) => onTabChange(e.target.value)}
          aria-label={t.recordTabSelect}
        >
          {TABS.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {t[tab.labelKey]}
            </option>
          ))}
        </select>
      </div>
      <div
        className="practice-record__tabs practice-record__tabs--desktop"
        role="tablist"
        aria-label={t.recordTabsLabel}
      >
        {TABS.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              className={`practice-record__tab${selected ? " practice-record__tab--active" : ""}`}
              onClick={() => onTabChange(tab.id)}
            >
              {t[tab.labelKey]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { TABS };
