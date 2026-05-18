import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  archivePracticeDocument,
  deletePracticeDocument,
  createPracticeDocument,
  fetchPracticeDocument,
  fetchPracticeDocuments,
  revokePracticeDocumentShare,
  sharePracticeDocument,
  updatePracticeDocumentDraft,
  uploadPracticeDocumentFile,
} from "../api/practiceDocumentsApi.js";
import DeleteDocumentDialog from "./DeleteDocumentDialog.jsx";
import "../../../styles/PatientThreadsPage.css";
import "../styles/PracticeDocuments.css";

const TYPE_OPTIONS = [
  "report",
  "lab",
  "imaging",
  "referral",
  "discharge",
  "prescription_info",
  "other",
];

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

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(status, t) {
  const map = {
    draft: t.statusDraft,
    shared: t.statusShared,
    archived: t.statusArchived,
    deleted: t.statusDeleted,
  };
  return map[status] || status;
}

function typeLabel(type, t) {
  const map = {
    report: t.typeReport,
    lab: t.typeLab,
    imaging: t.typeImaging,
    referral: t.typeReferral,
    discharge: t.typeDischarge,
    prescription_info: t.typePrescriptionInfo,
    other: t.typeOther,
  };
  return map[type] || type;
}

/**
 * @param {{ linkId: string, practiceId: string }} props
 */
export default function PracticePatientDocumentsSection({ linkId, practiceId }) {
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practiceDocuments || getMessages("en").practiceDocuments,
    [language],
  );

  const fileInputRef = useRef(null);
  const [documents, setDocuments] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [activeDoc, setActiveDoc] = useState(null);
  const [docType, setDocType] = useState("other");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);

  const isDraft = activeDoc?.status === "draft";
  const isShared = activeDoc?.status === "shared";
  const isDeleted = activeDoc?.status === "deleted";

  const loadList = useCallback(async () => {
    if (!linkId || !practiceId) return;
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchPracticeDocuments(linkId, practiceId);
      if (res.status === 404 && data.error === "feature_disabled") {
        setDocuments([]);
        setError(t.featureDisabled);
        return;
      }
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setDocuments(Array.isArray(data.documents) ? data.documents : []);
    } catch {
      setDocuments([]);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [linkId, practiceId, t.featureDisabled, t.loadError]);

  const loadDoc = useCallback(
    async (documentId) => {
      if (!documentId) {
        setActiveDoc(null);
        return;
      }
      setBusy(true);
      try {
        const { res, data } = await fetchPracticeDocument(linkId, practiceId, documentId);
        if (res.ok && data.ok) {
          setActiveDoc(data.document);
          setDocType(data.document.type || "other");
          setTitle(data.document.title || "");
          setDescription(data.document.description || "");
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
    if (activeId) loadDoc(activeId);
    else {
      setActiveDoc(null);
      setDocType("other");
      setTitle("");
      setDescription("");
    }
  }, [activeId, loadDoc]);

  async function handleCreateDraft() {
    if (!title.trim()) {
      setError(t.validationTitle);
      return;
    }
    setBusy(true);
    setError("");
    setStatusMsg("");
    try {
      const { res, data } = await createPracticeDocument(linkId, practiceId, {
        type: docType,
        title: title.trim(),
        description: description.trim() || undefined,
      });
      if (!res.ok || !data.ok) {
        setError(t.createError);
        return;
      }
      await loadList();
      setActiveId(data.document.id);
      setStatusMsg(t.saved);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveDraft(e) {
    e.preventDefault();
    if (!activeId || !isDraft) return;
    if (!title.trim()) {
      setError(t.validationTitle);
      return;
    }
    setBusy(true);
    setError("");
    setStatusMsg("");
    try {
      const { res, data } = await updatePracticeDocumentDraft(linkId, practiceId, activeId, {
        type: docType,
        title: title.trim(),
        description: description.trim() || undefined,
      });
      if (!res.ok || !data.ok) {
        setError(t.saveError);
        return;
      }
      setActiveDoc(data.document);
      setStatusMsg(t.saved);
      await loadList();
    } finally {
      setBusy(false);
    }
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !activeId) return;
    setBusy(true);
    setError("");
    setStatusMsg("");
    try {
      const { res, data } = await uploadPracticeDocumentFile(
        linkId,
        practiceId,
        activeId,
        file,
      );
      if (!res.ok || !data.ok) {
        setError(t.uploadError);
        return;
      }
      setActiveDoc(data.document);
      setStatusMsg(t.uploaded);
      await loadList();
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    if (!activeId) return;
    if (!activeDoc?.files?.length) {
      setError(t.validationFile);
      return;
    }
    setBusy(true);
    setError("");
    setStatusMsg("");
    try {
      const { res, data } = await sharePracticeDocument(linkId, practiceId, activeId);
      if (!res.ok || !data.ok) {
        setError(t.shareError);
        return;
      }
      setActiveDoc(data.document);
      setStatusMsg(t.shared);
      await loadList();
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    if (!activeId) return;
    setBusy(true);
    setError("");
    setStatusMsg("");
    try {
      const { res, data } = await revokePracticeDocumentShare(linkId, practiceId, activeId);
      if (!res.ok || !data.ok) {
        setError(t.revokeError);
        return;
      }
      setActiveDoc(data.document);
      setStatusMsg(t.revoked);
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
      const { res, data } = await archivePracticeDocument(linkId, practiceId, activeId);
      if (!res.ok || !data.ok) {
        setError(t.archiveError);
        return;
      }
      setActiveDoc(data.document);
      setStatusMsg(t.archived);
      await loadList();
    } finally {
      setBusy(false);
    }
  }

  function openDeleteDialog() {
    setDeleteStep(1);
    setDeleteOpen(true);
  }

  function closeDeleteDialog() {
    setDeleteOpen(false);
    setDeleteStep(1);
  }

  async function handleDeleteConfirm() {
    if (!activeId) return;
    setBusy(true);
    setError("");
    setStatusMsg("");
    try {
      const { res, data } = await deletePracticeDocument(linkId, practiceId, activeId);
      if (!res.ok || !data.ok) {
        setError(t.deleteError);
        return;
      }
      setActiveDoc(data.document);
      setStatusMsg(t.deleted);
      closeDeleteDialog();
      await loadList();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="practice-dashboard__card practice-documents"
      aria-labelledby="practice-documents-heading"
    >
      <h2 id="practice-documents-heading" className="practice-dashboard__analytics-heading">
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
          onClick={() => {
            setActiveId("");
            setActiveDoc(null);
            setDocType("other");
            setTitle("");
            setDescription("");
          }}
          disabled={busy}
        >
          {t.newDocument}
        </button>
      </div>

      {!loading && documents.length === 0 && !error && !activeId ? (
        <p className="practice-dashboard__muted">{t.empty}</p>
      ) : null}

      {documents.length > 0 ? (
        <ul className="patient-threads__list" aria-label={t.documentListCaption}>
          {documents.map((doc) => {
            const st = statusLabel(doc.status, t);
            return (
              <li key={doc.id} className="patient-threads__item">
                <button
                  type="button"
                  className="patient-threads__btn patient-threads__btn--secondary"
                  style={{ width: "100%", textAlign: "left", marginBottom: "0.35rem" }}
                  onClick={() => setActiveId(doc.id)}
                  aria-pressed={activeId === doc.id}
                  aria-label={`${doc.title}, ${t.statusAria.replace("{status}", st)}`}
                >
                  {doc.title} · {typeLabel(doc.type, t)} · {st}
                </button>
                <span className="medication-plan__status">{fmt(doc.updatedAt, language)}</span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {(activeDoc || !activeId) && (
        <div className="practice-documents__form">
          {!activeId ? (
            <>
              <label htmlFor="pd-type-new">{t.typeLabel}</label>
              <select
                id="pd-type-new"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                disabled={busy}
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {typeLabel(opt, t)}
                  </option>
                ))}
              </select>
              <label htmlFor="pd-title-new">{t.titleLabel}</label>
              <input
                id="pd-title-new"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.titlePlaceholder}
                disabled={busy}
              />
              <label htmlFor="pd-desc-new">{t.descriptionLabel}</label>
              <textarea
                id="pd-desc-new"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.descriptionPlaceholder}
                disabled={busy}
              />
              <button
                type="button"
                className="patient-threads__btn patient-threads__btn--primary"
                onClick={handleCreateDraft}
                disabled={busy}
              >
                {t.saveDraft}
              </button>
            </>
          ) : null}

          {activeDoc ? (
            <>
              {isDeleted ? (
                <p className="practice-dashboard__muted" role="note">
                  {t.deletedReadOnly}
                </p>
              ) : null}
              {!isDeleted && activeDoc.status !== "draft" ? (
                <p className="practice-dashboard__muted" role="note">
                  {t.readOnlyHint}
                  {activeDoc.sharedAt
                    ? ` ${t.sharedAt.replace("{date}", fmt(activeDoc.sharedAt, language))}`
                    : ""}
                </p>
              ) : null}

              {isDraft && !isDeleted ? (
                <form onSubmit={handleSaveDraft}>
                  <label htmlFor="pd-type">{t.typeLabel}</label>
                  <select
                    id="pd-type"
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    disabled={busy}
                  >
                    {TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {typeLabel(opt, t)}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="pd-title">{t.titleLabel}</label>
                  <input
                    id="pd-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t.titlePlaceholder}
                    disabled={busy}
                  />
                  <label htmlFor="pd-desc">{t.descriptionLabel}</label>
                  <textarea
                    id="pd-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t.descriptionPlaceholder}
                    disabled={busy}
                  />
                  <button
                    type="submit"
                    className="patient-threads__btn patient-threads__btn--primary"
                    disabled={busy}
                  >
                    {t.saveDraft}
                  </button>
                </form>
              ) : (
                <div>
                  <p>
                    <strong>{activeDoc.title}</strong>
                  </p>
                  <p className="practice-dashboard__muted">{typeLabel(activeDoc.type, t)}</p>
                  {activeDoc.description ? (
                    <p className="practice-dashboard__muted">{activeDoc.description}</p>
                  ) : null}
                </div>
              )}

              {activeDoc.files?.length > 0 ? (
                <div>
                  <p className="practice-dashboard__muted" style={{ fontWeight: 600 }}>
                    {t.filesAttached}
                  </p>
                  <ul className="practice-documents__file-list">
                    {activeDoc.files.map((f) => (
                      <li key={f.id}>
                        {f.originalFileName} · {t.fileSize.replace("{size}", formatBytes(f.sizeBytes))}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {isDraft && !isDeleted ? (
                <div className="practice-documents__upload-row">
                  <label htmlFor="pd-file-input" className="patient-threads__btn patient-threads__btn--secondary">
                    {t.chooseFile}
                  </label>
                  <input
                    ref={fileInputRef}
                    id="pd-file-input"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,application/pdf,image/*"
                    onChange={handleFileSelected}
                    disabled={busy}
                    style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}
                  />
                  <span className="practice-dashboard__muted">{t.uploadHint}</span>
                </div>
              ) : null}

              <div className="medication-plan__actions">
                {isDraft ? (
                  <button
                    type="button"
                    className="patient-threads__btn patient-threads__btn--primary"
                    onClick={handleShare}
                    disabled={busy}
                  >
                    {t.share}
                  </button>
                ) : null}
                {isShared ? (
                  <button
                    type="button"
                    className="patient-threads__btn patient-threads__btn--secondary"
                    onClick={handleRevoke}
                    disabled={busy}
                  >
                    {t.revoke}
                  </button>
                ) : null}
                {!isDeleted && activeDoc.status !== "archived" ? (
                  <button
                    type="button"
                    className="patient-threads__btn patient-threads__btn--secondary"
                    onClick={handleArchive}
                    disabled={busy}
                  >
                    {t.archive}
                  </button>
                ) : null}
                {!isDeleted ? (
                  <button
                    type="button"
                    className="patient-threads__btn practice-documents__btn--delete-outline"
                    onClick={openDeleteDialog}
                    disabled={busy}
                  >
                    {t.deleteDocument}
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      )}

      <DeleteDocumentDialog
        open={deleteOpen}
        step={deleteStep}
        busy={busy}
        t={t}
        onCancel={closeDeleteDialog}
        onConfirmStep1={() => setDeleteStep(2)}
        onConfirmStep2={handleDeleteConfirm}
      />
    </section>
  );
}
