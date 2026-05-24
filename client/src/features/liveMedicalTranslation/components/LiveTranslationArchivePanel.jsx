import { useCallback, useMemo, useState } from "react";
import { getPrimaryIntlLocale } from "../../../i18n/intlLocale.js";
import { downloadLiveTranslationPdf } from "../pdf/generateLiveTranslationPdf.js";
import {
  clearLiveTranslationArchive,
  deleteLiveTranslationArchiveItem,
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

/**
 * @param {{
 *   t: Record<string, unknown>;
 *   uiLanguage: string;
 *   onClose?: () => void;
 * }} props
 */
export default function LiveTranslationArchivePanel({ t, uiLanguage, onClose }) {
  const archiveT = /** @type {Record<string, string>} */ (t.archive || {});
  const [items, setItems] = useState(() => listLiveTranslationArchiveItems());
  const [confirmClear, setConfirmClear] = useState(false);

  const refresh = useCallback(() => {
    setItems(listLiveTranslationArchiveItems());
  }, []);

  const handleDelete = useCallback(
    (id) => {
      deleteLiveTranslationArchiveItem(id);
      refresh();
    },
    [refresh],
  );

  const handleClearAll = useCallback(() => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearLiveTranslationArchive();
    setConfirmClear(false);
    refresh();
  }, [confirmClear, refresh]);

  const handleDownload = useCallback(
    (exportData) => {
      if (!exportData) return;
      downloadLiveTranslationPdf(exportData, uiLanguage);
    },
    [uiLanguage],
  );

  const empty = items.length === 0;

  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
      ),
    [items],
  );

  return (
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

      {empty ? (
        <p className="live-translation__archive-empty">{archiveT.empty}</p>
      ) : (
        <ul className="live-translation__archive-list">
          {sorted.map((item) => {
            const meta = item.exportData || {};
            const label = meta.patientName
              ? `${meta.patientName} · ${formatSavedAt(item.savedAt, uiLanguage)}`
              : formatSavedAt(item.savedAt, uiLanguage);
            const turnCount = Array.isArray(meta.transcript) ? meta.transcript.length : 0;

            return (
              <li key={item.id} className="live-translation__archive-item">
                <div className="live-translation__archive-item-main">
                  <span className="live-translation__archive-item-label">{label}</span>
                  <span className="live-translation__archive-item-meta">
                    {archiveT.turnCount.replace("{count}", String(turnCount))}
                  </span>
                </div>
                <div className="live-translation__archive-item-actions">
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
  );
}
