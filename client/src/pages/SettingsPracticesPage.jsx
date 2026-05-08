import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations/index.js";
import { authFetch } from "../api/authFetch.js";
import PreVisitModuleChrome from "../features/preVisit/components/PreVisitModuleChrome.jsx";
import "../styles/SettingsPracticesPage.css";

const EMPTY_PRACTICE = {
  practiceName: "",
  publicSlug: "",
  logoUrl: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  specialty: "",
  preferredDoctorLanguage: "de",
  patientIntroText: "",
  isActive: true,
};

const EMPTY_TARGET = {
  targetName: "",
  targetType: "practice",
  doctorName: "",
  specialty: "",
  recipientEmail: "",
  preferredDoctorLanguage: "",
  isActive: true,
};

export default function SettingsPracticesPage() {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const b = getMessages(language);
    return b.settingsPractices ?? getMessages("en").settingsPractices;
  }, [language]);
  const [practices, setPractices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState(() => ({ ...EMPTY_PRACTICE }));
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [activePracticeId, setActivePracticeId] = useState("");
  const [targets, setTargets] = useState([]);
  const [targetLoading, setTargetLoading] = useState(false);
  const [targetForm, setTargetForm] = useState(() => ({ ...EMPTY_TARGET }));
  const [editingTargetId, setEditingTargetId] = useState(null);
  const [targetSaving, setTargetSaving] = useState(false);
  const [targetError, setTargetError] = useState("");
  const appBaseUrl =
    (typeof window !== "undefined" && window.location?.origin) || "";

  const loadPractices = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await authFetch("/api/practices");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error("load_failed");
      setPractices(Array.isArray(data.practices) ? data.practices : []);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setLoadError(t.loadError);
      setPractices([]);
    } finally {
      setLoading(false);
    }
  }, [t.loadError]);

  const loadTargets = useCallback(
    async (practiceId) => {
      if (!practiceId) {
        setTargets([]);
        return;
      }
      setTargetLoading(true);
      setTargetError("");
      try {
        const res = await authFetch(
          `/api/practices/${encodeURIComponent(practiceId)}/qr-targets`
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error("load_targets_failed");
        setTargets(Array.isArray(data.targets) ? data.targets : []);
      } catch (e) {
        if (e?.message === "SESSION_EXPIRED") return;
        setTargets([]);
        setTargetError(t.targetLoadError);
      } finally {
        setTargetLoading(false);
      }
    },
    [t.targetLoadError]
  );

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    void loadPractices();
  }, [loadPractices]);

  useEffect(() => {
    if (!activePracticeId) return;
    void loadTargets(activePracticeId);
  }, [activePracticeId, loadTargets]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateTargetField(key, value) {
    setTargetForm((prev) => ({ ...prev, [key]: value }));
  }

  function openAddPractice() {
    setShowForm(true);
    setEditingId(null);
    setForm({ ...EMPTY_PRACTICE });
    setSaveError("");
  }

  function openEditPractice(item) {
    setShowForm(true);
    setEditingId(item.id);
    setForm({
      practiceName: item.practiceName || "",
      publicSlug: item.publicSlug || "",
      logoUrl: item.logoUrl || "",
      address: item.address || "",
      phone: item.phone || "",
      email: item.email || "",
      website: item.website || "",
      specialty: item.specialty || "",
      preferredDoctorLanguage: item.preferredDoctorLanguage || "de",
      patientIntroText: item.patientIntroText || "",
      isActive: item.isActive !== false,
    });
    setSaveError("");
  }

  async function submitPractice(e) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      const payload = {
        ...form,
        practiceName: form.practiceName.trim(),
        publicSlug: form.publicSlug.trim(),
        preferredDoctorLanguage: form.preferredDoctorLanguage.trim(),
      };
      const res = await authFetch(
        editingId ? `/api/practices/${encodeURIComponent(editingId)}` : "/api/practices",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "save_failed");
      setShowForm(false);
      setEditingId(null);
      setForm({ ...EMPTY_PRACTICE });
      await loadPractices();
    } catch (e2) {
      if (e2?.message === "SESSION_EXPIRED") return;
      setSaveError(t.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function deletePractice(id) {
    if (!window.confirm(t.deleteConfirm)) return;
    try {
      const res = await authFetch(`/api/practices/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("delete_failed");
      if (activePracticeId === id) {
        setActivePracticeId("");
        setTargets([]);
      }
      await loadPractices();
    } catch {
      alert(t.deleteError);
    }
  }

  function openManageTargets(practiceId) {
    setActivePracticeId((prev) => (prev === practiceId ? "" : practiceId));
    setEditingTargetId(null);
    setTargetForm({ ...EMPTY_TARGET });
    setTargetError("");
  }

  function openEditTarget(target) {
    setEditingTargetId(target.id);
    setTargetForm({
      targetName: target.targetName || "",
      targetType: target.targetType || "practice",
      doctorName: target.doctorName || "",
      specialty: target.specialty || "",
      recipientEmail: target.recipientEmail || "",
      preferredDoctorLanguage: target.preferredDoctorLanguage || "",
      isActive: target.isActive !== false,
    });
  }

  async function submitTarget(e) {
    e.preventDefault();
    if (!activePracticeId) return;
    setTargetSaving(true);
    setTargetError("");
    try {
      const payload = {
        ...targetForm,
        targetName: targetForm.targetName.trim(),
      };
      const url = editingTargetId
        ? `/api/practices/${encodeURIComponent(
            activePracticeId
          )}/qr-targets/${encodeURIComponent(editingTargetId)}`
        : `/api/practices/${encodeURIComponent(activePracticeId)}/qr-targets`;
      const res = await authFetch(url, {
        method: editingTargetId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "save_target_failed");
      setEditingTargetId(null);
      setTargetForm({ ...EMPTY_TARGET });
      await loadTargets(activePracticeId);
    } catch (e2) {
      if (e2?.message === "SESSION_EXPIRED") return;
      setTargetError(t.targetSaveError);
    } finally {
      setTargetSaving(false);
    }
  }

  async function deleteTarget(id) {
    if (!activePracticeId) return;
    if (!window.confirm(t.targetDeleteConfirm)) return;
    try {
      const res = await authFetch(
        `/api/practices/${encodeURIComponent(
          activePracticeId
        )}/qr-targets/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("delete_target_failed");
      await loadTargets(activePracticeId);
    } catch {
      alert(t.targetDeleteError);
    }
  }

  async function copyLink(path) {
    const full = `${appBaseUrl}${path}`;
    try {
      await navigator.clipboard.writeText(full);
      alert(t.linkCopied);
    } catch {
      window.prompt(t.copyFallback, full);
    }
  }

  return (
    <div className="settings-practices">
      <div className="settings-practices__inner">
        <PreVisitModuleChrome />
        <header className="settings-practices__header">
          <h1 className="settings-practices__title">{t.heading}</h1>
          <p className="settings-practices__intro">{t.intro}</p>
          <div className="settings-practices__top-links">
            <Link className="settings-practices__back" to="/startseite">
              {t.backHome}
            </Link>
            <Link className="settings-practices__back" to="/practice/dashboard">
              {t.openDashboard}
            </Link>
          </div>
        </header>

        {loadError ? <p className="settings-practices__error">{loadError}</p> : null}

        <div className="settings-practices__toolbar">
          <button className="settings-practices__btn settings-practices__btn--primary" onClick={openAddPractice} type="button">
            {t.addPractice}
          </button>
        </div>

        {showForm ? (
          <form className="settings-practices__form" onSubmit={submitPractice}>
            <label className="settings-practices__label">{t.fieldPracticeName} *
              <input className="settings-practices__input" required value={form.practiceName} onChange={(e) => updateField("practiceName", e.target.value)} />
            </label>
            <label className="settings-practices__label">{t.fieldPublicSlug} *
              <input className="settings-practices__input" required value={form.publicSlug} onChange={(e) => updateField("publicSlug", e.target.value)} />
            </label>
            <label className="settings-practices__label">{t.fieldPreferredDoctorLanguage} *
              <input className="settings-practices__input" required value={form.preferredDoctorLanguage} onChange={(e) => updateField("preferredDoctorLanguage", e.target.value)} />
            </label>
            <label className="settings-practices__label">{t.fieldSpecialty}
              <input className="settings-practices__input" value={form.specialty} onChange={(e) => updateField("specialty", e.target.value)} />
            </label>
            <label className="settings-practices__label">{t.fieldLogoUrl}
              <input className="settings-practices__input" value={form.logoUrl} onChange={(e) => updateField("logoUrl", e.target.value)} />
            </label>
            <label className="settings-practices__label">{t.fieldAddress}
              <textarea className="settings-practices__textarea" rows={2} value={form.address} onChange={(e) => updateField("address", e.target.value)} />
            </label>
            <label className="settings-practices__label">{t.fieldPhone}
              <input className="settings-practices__input" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
            </label>
            <label className="settings-practices__label">{t.fieldEmail}
              <input className="settings-practices__input" type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} />
            </label>
            <label className="settings-practices__label">{t.fieldWebsite}
              <input className="settings-practices__input" value={form.website} onChange={(e) => updateField("website", e.target.value)} />
            </label>
            <label className="settings-practices__label">{t.fieldPatientIntroText}
              <textarea className="settings-practices__textarea" rows={3} value={form.patientIntroText} onChange={(e) => updateField("patientIntroText", e.target.value)} />
            </label>
            <label className="settings-practices__check">
              <input type="checkbox" checked={form.isActive} onChange={(e) => updateField("isActive", e.target.checked)} />
              <span>{t.fieldIsActive}</span>
            </label>
            {saveError ? <p className="settings-practices__error">{saveError}</p> : null}
            <div className="settings-practices__actions">
              <button type="button" className="settings-practices__btn settings-practices__btn--ghost" onClick={() => setShowForm(false)}>{t.cancel}</button>
              <button type="submit" className="settings-practices__btn settings-practices__btn--primary" disabled={saving}>{t.save}</button>
            </div>
          </form>
        ) : null}

        {loading ? (
          <p className="settings-practices__muted">{t.loadingPractices}</p>
        ) : practices.length === 0 ? (
          <p className="settings-practices__empty">{t.empty}</p>
        ) : (
          <ul className="settings-practices__list">
            {practices.map((p) => {
              const baseLink = `/pre-visit/qr`;
              const isActiveCard = activePracticeId === p.id;
              return (
                <li className="settings-practices__card" key={p.id}>
                  <h3 className="settings-practices__card-title">{p.practiceName}</h3>
                  {p.specialty ? <p className="settings-practices__line">{p.specialty}</p> : null}
                  <p className="settings-practices__line">{t.languageLabel}: {p.preferredDoctorLanguage || "de"}</p>
                  <p className="settings-practices__line">{t.publicQrBase}: {baseLink}</p>
                  <div className="settings-practices__card-actions">
                    <button type="button" className="settings-practices__btn settings-practices__btn--ghost" onClick={() => openEditPractice(p)}>{t.edit}</button>
                    <button type="button" className="settings-practices__btn settings-practices__btn--danger" onClick={() => void deletePractice(p.id)}>{t.delete}</button>
                    <button type="button" className="settings-practices__btn settings-practices__btn--primary" onClick={() => openManageTargets(p.id)}>{t.manageTargets}</button>
                  </div>

                  {isActiveCard ? (
                    <div className="settings-practices__targets">
                      <h4 className="settings-practices__targets-title">{t.targetsTitle}</h4>
                      {targetError ? <p className="settings-practices__error">{targetError}</p> : null}
                      <form className="settings-practices__form settings-practices__form--target" onSubmit={submitTarget}>
                        <label className="settings-practices__label">{t.targetName} *
                          <input className="settings-practices__input" required value={targetForm.targetName} onChange={(e) => updateTargetField("targetName", e.target.value)} />
                        </label>
                        <label className="settings-practices__label">{t.targetType}
                          <select className="settings-practices__input" value={targetForm.targetType} onChange={(e) => updateTargetField("targetType", e.target.value)}>
                            <option value="practice">practice</option>
                            <option value="doctor">doctor</option>
                            <option value="department">department</option>
                            <option value="appointment_type">appointment_type</option>
                          </select>
                        </label>
                        <label className="settings-practices__label">{t.targetDoctorName}
                          <input className="settings-practices__input" value={targetForm.doctorName} onChange={(e) => updateTargetField("doctorName", e.target.value)} />
                        </label>
                        <label className="settings-practices__label">{t.targetSpecialty}
                          <input className="settings-practices__input" value={targetForm.specialty} onChange={(e) => updateTargetField("specialty", e.target.value)} />
                        </label>
                        <label className="settings-practices__label">{t.targetRecipientEmail}
                          <input className="settings-practices__input" type="email" value={targetForm.recipientEmail} onChange={(e) => updateTargetField("recipientEmail", e.target.value)} />
                        </label>
                        <label className="settings-practices__label">{t.targetPreferredDoctorLanguage}
                          <input className="settings-practices__input" value={targetForm.preferredDoctorLanguage} onChange={(e) => updateTargetField("preferredDoctorLanguage", e.target.value)} />
                        </label>
                        <label className="settings-practices__check">
                          <input type="checkbox" checked={targetForm.isActive} onChange={(e) => updateTargetField("isActive", e.target.checked)} />
                          <span>{t.fieldIsActive}</span>
                        </label>
                        <div className="settings-practices__actions">
                          {editingTargetId ? <button type="button" className="settings-practices__btn settings-practices__btn--ghost" onClick={() => { setEditingTargetId(null); setTargetForm({ ...EMPTY_TARGET }); }}>{t.cancel}</button> : null}
                          <button type="submit" className="settings-practices__btn settings-practices__btn--primary" disabled={targetSaving}>{t.save}</button>
                        </div>
                      </form>
                      {targetLoading ? <p className="settings-practices__muted">{t.loadingTargets}</p> : (
                        <ul className="settings-practices__target-list">
                          {targets.map((target) => {
                            const path = `/pre-visit/qr/${target.qrToken}`;
                            return (
                              <li className="settings-practices__target-card" key={target.id}>
                                <p className="settings-practices__line"><strong>{target.targetName}</strong> ({target.targetType})</p>
                                {target.doctorName ? <p className="settings-practices__line">{target.doctorName}</p> : null}
                                {target.specialty ? <p className="settings-practices__line">{target.specialty}</p> : null}
                                <p className="settings-practices__line">{path}</p>
                                <div className="settings-practices__card-actions">
                                  <button type="button" className="settings-practices__btn settings-practices__btn--ghost" onClick={() => openEditTarget(target)}>{t.edit}</button>
                                  <button type="button" className="settings-practices__btn settings-practices__btn--danger" onClick={() => void deleteTarget(target.id)}>{t.delete}</button>
                                  <button type="button" className="settings-practices__btn settings-practices__btn--primary" onClick={() => void copyLink(path)}>{t.copyLink}</button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

