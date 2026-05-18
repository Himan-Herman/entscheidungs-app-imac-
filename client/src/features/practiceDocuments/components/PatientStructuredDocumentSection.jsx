import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { fetchPatientStructuredDocument } from "../api/documentOcrApi.js";
import "../styles/DocumentOcrSection.css";

/**
 * @param {{ documentId: string }} props
 */
export default function PatientStructuredDocumentSection({ documentId }) {
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).documentOcr || getMessages("en").documentOcr,
    [language],
  );
  const [structured, setStructured] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    const { res, data } = await fetchPatientStructuredDocument(documentId);
    if (res.ok && data.ok && data.structured) {
      setStructured(data.structured);
    } else {
      setStructured(null);
    }
    setLoading(false);
  }, [documentId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !structured?.entries?.length) return null;

  return (
    <section className="document-ocr" aria-labelledby="patient-structured-heading">
      <h2 id="patient-structured-heading">{t.structuredViewHeading}</h2>
      <p className="document-ocr__hint">{t.sourcePractice}</p>
      <p className="document-ocr__hint" role="note">
        {t.autoDetectedHint}
      </p>
      <p className="patient-inbox__safety">{t.patientDisclaimer}</p>

      <h3>{t.labTableHeading}</h3>
      <div className="document-ocr__table-wrap">
        <table className="document-ocr__table" aria-label={t.labTableHeading}>
          <thead>
            <tr>
              <th scope="col">{t.colLabel}</th>
              <th scope="col">{t.colValue}</th>
              <th scope="col">{t.colUnit}</th>
              <th scope="col">{t.colReference}</th>
            </tr>
          </thead>
          <tbody>
            {structured.entries.map((row, i) => (
              <tr key={row.id || i}>
                <td>{row.label}</td>
                <td>{row.valueText || t.unclear}</td>
                <td>{row.unit || t.notProvided}</td>
                <td>{row.referenceRangeText || t.notProvided}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="document-ocr__cards" aria-label={t.labTableHeading}>
        {structured.entries.map((row, i) => (
          <dl key={row.id || i} className="document-ocr__card">
            <dt>{t.colLabel}</dt>
            <dd>{row.label}</dd>
            <dt>{t.colValue}</dt>
            <dd>{row.valueText || t.unclear}</dd>
            <dt>{t.colUnit}</dt>
            <dd>{row.unit || t.notProvided}</dd>
            <dt>{t.colReference}</dt>
            <dd>{row.referenceRangeText || t.notProvided}</dd>
          </dl>
        ))}
      </div>
    </section>
  );
}
