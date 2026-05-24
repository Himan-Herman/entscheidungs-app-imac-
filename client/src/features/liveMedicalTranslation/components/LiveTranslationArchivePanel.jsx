import { useCallback, useEffect, useMemo, useState } from "react";
import { getPrimaryIntlLocale } from "../../../i18n/intlLocale.js";
import { liveTranslationLanguageLabel } from "../languages.js";
import { downloadLiveTranslationPdf } from "../pdf/generateLiveTranslationPdf.js";
import {
  clearLiveTranslationArchive,
  deleteLiveTranslationArchiveItem,
  getArchiveItemSortTime,
  listLiveTranslationArchiveItems,
} from "../session/localLiveTranslationArchive.js";

function formatSavedAt(iso, lang) {
  try {
    return new Date(iso).toLocaleString(getPrimaryIntlLocale(lang), {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function resolveItemDateTime(item) {
  const meta = item?.exportData || {};
  return meta.sessionEndedAt || item?.savedAt || meta.sessionStartedAt || "";
}

function formatLanguagePair(patientLanguage, doctorLanguage) {
  const patient = liveTranslationLanguageLabel(patientLanguage);
  const doctor = liveTranslationLanguageLabel(doctorLanguage);
  if (!patient && !doctor) return "";
  return `${patient || "?"} ↔ ${doctor || "?"}`;
}

function ArchiveField({ label, value }) {
  if (!value) return null;
  return (
    <div className="live-translation__archive-field">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ArchiveDetailDialog({
  archiveT,
  turnT,
  uiLanguage,
  meta,
  dateTime,
  transcript,
  onClose,
  onDownload,
}) {
  const patientName = String(meta.patientName || "").trim() || archiveT.unknownPatient;
  const languagePair = formatLanguagePair(meta.patientLanguage, meta.doctorLanguage);

  return (
    <div className="live-translation__archive-detail-backdrop" onClick={onClose} role="presentation">
      <div
        className="live-translation__archive-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="live-translation__archive-detail-header">
          <h3 id="archive-detail-title" className="live-translation__archive-detail-title">
            {archiveT.viewTitle}
          </h3>
          <button
            type="button"
            className="live-translation__archive-close"
            onClick={onClose}
            aria-label={archiveT.viewCloseAria}
          >
            {archiveT.viewClose}
          </button>
        </div>

        <dl className="live-translation__archive-detail-meta">
          <ArchiveField label={archiveT.dateTimeLabel} value={dateTime} />
          <ArchiveField label={archiveT.patientLabel} value={patientName} />
          <ArchiveField label={archiveT.languagePairLabel} value={languagePair} />
          <ArchiveField
            label={archiveT.turnCountLabel}
            value={archiveT.turnCount.replace("{count}", String(transcript.length))}
          />
        </dl>

        <div className="live-translation__archive-detail-scroll">
          {transcript.length === 0 ? (
            <p className="live-translation__archive-empty">{archiveT.noTranscript}</p>
          ) : (
            <ol className="live-translation__archive-detail-turns">
              {transcript.map((turn, index) => {
                const speakerLabel =
                  turn.speaker === "patient" ? turnT.speakerPatient : turnT.speakerDoctor;
                return (
                  <li
                    key={turn.id || `${turn.timestamp}-${index}`}
                    className="live-translation__archive-detail-turn"
                  >
                    <header className="live-translation__archive-detail-turn-header">
                      <span>{speakerLabel}</span>
                      {turn.timestamp ? (
                        <time dateTime={turn.timestamp}>
                          {formatSavedAt(turn.timestamp, uiLanguage)}
                        </time>
                      ) : null}
                    </header>
                    {turn.originalText ? (
                      <p>
                        <span className="live-translation__archive-detail-turn-label">
                          {turnT.original}
                        </span>
                        {turn.originalText}
                      </p>
                    ) : turn.originalMissing ? (
                      <p className="live-translation__archive-detail-turn-missing">
                        {turnT.originalMissing}
                      </p>
                    ) : null}
                    {turn.translatedText ? (
                      <p>
                        <span className="live-translation__archive-detail-turn-label">
                          {turnT.translated}
                        </span>
                        {turn.translatedText}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="live-translation__archive-detail-actions">
          <button type="button" className="live-translation__primary" onClick={onDownload}>
            {archiveT.downloadPdf}
          </button>
          <button type="button" className="live-translation__secondary" onClick={onClose}>
            {archiveT.viewClose}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * @param {{
 *   t: Record<string, unknown>;
 *   uiLanguage: string;
 *   onClose?: () => void;
 *   refreshToken?: number;
 * }} props
 */
export default function LiveTranslationArchivePanel({ t, uiLanguage, onClose, refreshToken = 0 }) {
  const archiveT = /** @type {Record<string, string>} */ (t.archive || {});
  const turnT = /** @type {Record<string, string>} */ (t.turn || {});
  const [items, setItems] = useState(() => listLiveTranslationArchiveItems());
  const [confirmClear, setConfirmClear] = useState(false);
  const [viewItem, setViewItem] = useState(
    /** @type {{ id: string; savedAt: string; exportData: Record<string, unknown> } | null} */ (null),
  );

  const refresh = useCallback(() => {
    setItems(listLiveTranslationArchiveItems());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, refreshToken]);

  const handleDelete = useCallback(
    (id) => {
      deleteLiveTranslationArchiveItem(id);
      if (viewItem?.id === id) setViewItem(null);
      refresh();
    },
    [refresh, viewItem?.id],
  );

  const handleClearAll = useCallback(() => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearLiveTranslationArchive();
    setConfirmClear(false);
    setViewItem(null);
    refresh();
  }, [confirmClear, refresh]);

  const handleDownload = useCallback(
    (exportData) => {
      if (!exportData) return;
      downloadLiveTranslationPdf(exportData, uiLanguage);
    },
    [uiLanguage],
  );

  const sorted = useMemo(
    () => [...items].sort((a, b) => getArchiveItemSortTime(b) - getArchiveItemSortTime(a)),
    [items],
  );

  const empty = sorted.length === 0;
  const viewMeta = viewItem?.exportData || {};

  return (
    <>
      <section className="live-translation__archive" aria-label={archiveT.sectionAria || "Saved sessions"}>
        <div className="live-translation__archive-header">
          <h2 className="live-translation__archive-title">{archiveT.heading}</h2>
          {onClose ? (
            <button type="button" className="live-translation__archive-close" onClick={onClose}>
              {archiveT.close}
            </button>
          ) : null}
        </div>

        <p className="live-translation__archive-note">{archiveT.localOnlyNote}</p>

        <div
          className={[
            "live-translation__archive-scroll",
            empty ? "live-translation__archive-scroll--empty" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label={empty ? undefined : archiveT.listAria}
        >
          {empty ? (
            <p className="live-translation__archive-empty">{archiveT.empty}</p>
          ) : (
            <ul className="live-translation__archive-list">
              {sorted.map((item) => {
                const meta = item.exportData || {};
                const dateTimeIso = resolveItemDateTime(item);
                const dateTime = formatSavedAt(dateTimeIso, uiLanguage);
                const patientName = String(meta.patientName || "").trim() || archiveT.unknownPatient;
                const languagePair = formatLanguagePair(meta.patientLanguage, meta.doctorLanguage);
                const turnCount = Array.isArray(meta.transcript) ? meta.transcript.length : 0;

                return (
                  <li key={item.id} className="live-translation__archive-item">
                    <div className="live-translation__archive-item-main">
                      <time className="live-translation__archive-item-date" dateTime={dateTimeIso}>
                        {dateTime}
                      </time>
                      <dl className="live-translation__archive-item-fields">
                        <ArchiveField label={archiveT.patientLabel} value={patientName} />
                        <ArchiveField label={archiveT.languagePairLabel} value={languagePair} />
                        <ArchiveField
                          label={archiveT.turnCountLabel}
                          value={archiveT.turnCount.replace("{count}", String(turnCount))}
                        />
                      </dl>
                    </div>
                    <div className="live-translation__archive-item-actions">
                      <button
                        type="button"
                        className="live-translation__secondary live-translation__archive-btn"
                        onClick={() => setViewItem(item)}
                        aria-label={archiveT.viewAria}
                      >
                        {archiveT.viewOpen}
                      </button>
                      <button
                        type="button"
                        className="live-translation__secondary live-translation__archive-btn"
                        onClick={() => handleDownload(meta)}
                      >
                        {archiveT.downloadPdf}
                      </button>
                      <button
                        type="button"
                        className="live-translation__secondary live-translation__archive-btn live-translation__archive-btn--danger"
                        onClick={() => handleDelete(item.id)}
                        aria-label={archiveT.deleteOneAria}
                      >
                        {archiveT.deleteOne}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {!empty ? (
          <button
            type="button"
            className={[
              "live-translation__secondary",
              "live-translation__archive-clear",
              confirmClear ? "live-translation__archive-clear--confirm" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={handleClearAll}
          >
            {confirmClear ? archiveT.deleteAllConfirm : archiveT.deleteAll}
          </button>
        ) : null}
      </section>

      {viewItem ? (
        <ArchiveDetailDialog
          archiveT={archiveT}
          turnT={turnT}
          uiLanguage={uiLanguage}
          meta={viewMeta}
          dateTime={formatSavedAt(resolveItemDateTime(viewItem), uiLanguage)}
          transcript={Array.isArray(viewMeta.transcript) ? viewMeta.transcript : []}
          onClose={() => setViewItem(null)}
          onDownload={() => handleDownload(viewMeta)}
        />
      ) : null}
    </>
  );
}
