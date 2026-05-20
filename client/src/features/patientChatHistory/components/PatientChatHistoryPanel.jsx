import React, { useId, useState } from "react";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog.jsx";
import {
  SESSION_STATUS_ACTIVE,
  SESSION_STATUS_COMPLETED,
  SESSION_STATUS_DRAFT,
} from "../constants.js";

function interpolate(template, vars) {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
  }
  return out;
}

function formatDateTime(iso, locale) {
  try {
    return new Date(iso).toLocaleString(locale === "en" ? "en-GB" : "de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * @param {object} props
 * @param {Array} props.sessions
 * @param {string | null} props.activeId
 * @param {Record<string, string>} props.labels
 * @param {'de'|'en'} props.language
 * @param {boolean} [props.showRegionFilter]
 * @param {boolean} [props.regionFilterOn]
 * @param {() => void} [props.onToggleRegionFilter]
 * @param {(id: string) => void} props.onOpen
 * @param {(id: string) => void} props.onDelete
 * @param {string} [props.className]
 */
export default function PatientChatHistoryPanel({
  sessions,
  activeId,
  labels,
  language,
  showRegionFilter = false,
  regionFilterOn = false,
  onToggleRegionFilter,
  onOpen,
  onDelete,
  className = "",
}) {
  const [expanded, setExpanded] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const panelId = useId();

  const statusLabel = (status) => {
    if (status === SESSION_STATUS_COMPLETED) return labels.statusCompleted;
    if (status === SESSION_STATUS_ACTIVE) return labels.statusActive;
    return labels.statusDraft;
  };

  const pendingSession = sessions.find((s) => s.id === pendingDeleteId);

  return (
    <section
      className={`pch-panel ${className}`.trim()}
      aria-labelledby={`${panelId}-title`}
    >
      <button
        type="button"
        className="pch-panel__toggle"
        aria-expanded={expanded}
        aria-controls={`${panelId}-list`}
        onClick={() => setExpanded((v) => !v)}
      >
        <span id={`${panelId}-title`} className="pch-panel__title">
          {labels.historyTitle}
        </span>
        <span className="pch-panel__chevron" aria-hidden="true">
          {expanded ? "▾" : "▸"}
        </span>
      </button>

      {showRegionFilter && expanded ? (
        <label className="pch-panel__filter">
          <input
            type="checkbox"
            checked={regionFilterOn}
            onChange={() => onToggleRegionFilter?.()}
          />
          <span>{regionFilterOn ? labels.filterByRegion : labels.filterAll}</span>
        </label>
      ) : null}

      <div
        id={`${panelId}-list`}
        className={`pch-panel__list ${expanded ? "pch-panel__list--open" : ""}`}
        hidden={!expanded}
      >
        {sessions.length === 0 ? (
          <p className="pch-panel__empty">{labels.emptyHistory}</p>
        ) : (
          <ul className="pch-panel__items">
            {sessions.map((session) => {
              const isActive = session.id === activeId;
              const title = session.displayTitle || session.title || "—";
              return (
                <li
                  key={session.id}
                  className={`pch-card ${isActive ? "pch-card--active" : ""}`}
                >
                  <div className="pch-card__meta">
                    <time className="pch-card__date" dateTime={session.updatedAt}>
                      {formatDateTime(session.updatedAt, language)}
                    </time>
                    <span className="pch-card__type">
                      {session.kind === "body_map"
                        ? labels.typeBodyMap
                        : labels.typeSymptomCheck}
                    </span>
                    <span className={`pch-card__status pch-card__status--${session.status}`}>
                      {statusLabel(session.status)}
                    </span>
                  </div>
                  <p className="pch-card__title-text">{title}</p>
                  {isActive ? (
                    <p className="pch-card__current">{labels.currentConversation}</p>
                  ) : null}
                  <div className="pch-card__actions">
                    <button
                      type="button"
                      className="pch-card__btn pch-card__btn--open"
                      disabled={isActive}
                      aria-label={interpolate(labels.openConversationAria, { title })}
                      onClick={() => onOpen(session.id)}
                    >
                      {labels.openConversation}
                    </button>
                    <button
                      type="button"
                      className="pch-card__btn pch-card__btn--delete"
                      aria-label={interpolate(labels.deleteConversationAria, { title })}
                      onClick={() => setPendingDeleteId(session.id)}
                    >
                      {labels.deleteConversation}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDeleteDialog
        open={Boolean(pendingDeleteId)}
        title={labels.deleteConfirmTitle}
        body={labels.deleteConfirmBody}
        confirmLabel={labels.deleteConfirmAction}
        cancelLabel={labels.deleteCancel}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) onDelete(pendingDeleteId);
          setPendingDeleteId(null);
        }}
      />
    </section>
  );
}
