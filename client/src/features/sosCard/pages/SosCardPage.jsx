import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, QrCode, ShieldAlert, Sparkles, Trash2, Wallet } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  fetchSosCard,
  fetchWalletStatus,
  generateAiSummary,
  generateToken,
  requestApplePass,
  requestGoogleWalletLink,
  revokeToken,
  saveSosCard,
} from "../api/sosCardApi.js";
import SosCardForm from "../components/SosCardForm.jsx";
import SosCardPreview from "../components/SosCardPreview.jsx";
import SosCardQr from "../components/SosCardQr.jsx";
import "../styles/SosCard.css";

export default function SosCardPage() {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const msgs = getMessages(language);
    return msgs.sosCard || getMessages("en").sosCard;
  }, [language]);

  const [card, setCard] = useState(null);
  const [referenced, setReferenced] = useState(null);
  const [allergies, setAllergies] = useState([]);
  const [diagnoses, setDiagnoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [tokenLoading, setTokenLoading] = useState(false);
  const [publicToken, setPublicToken] = useState(null);
  const [showQr, setShowQr] = useState(false);
  const [tab, setTab] = useState("edit");
  const [walletStatus, setWalletStatus] = useState(null);
  const [walletMsg, setWalletMsg] = useState("");

  useEffect(() => {
    if (t?.pageTitle) document.title = t.pageTitle;
  }, [t]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [cardRes, allergyRes, diagRes] = await Promise.all([
        fetchSosCard(),
        fetch("/api/patient/allergies", {
          headers: { Authorization: `Bearer ${localStorage.getItem("medscout_token")}` },
        }).then((r) => r.json()).catch(() => ({})),
        fetch("/api/patient/diagnoses", {
          headers: { Authorization: `Bearer ${localStorage.getItem("medscout_token")}` },
        }).then((r) => r.json()).catch(() => ({})),
      ]);
      if (!cardRes.res.ok) throw new Error("load_failed");
      setCard(cardRes.data.card || null);
      setReferenced(cardRes.data.referenced || null);
      if (cardRes.data.card?.hasPublicToken) {
        setPublicToken("hidden");
      }
      setAllergies(Array.isArray(allergyRes.entries) ? allergyRes.entries : []);
      setDiagnoses(Array.isArray(diagRes.entries) ? diagRes.entries : []);
      // Wallet availability is optional and must never block the page.
      fetchWalletStatus()
        .then(({ res, data }) => {
          if (res.ok && data.ok) setWalletStatus(data);
        })
        .catch(() => {});
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") return;
      setLoadError(t?.loadError || "Fehler beim Laden.");
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(data) {
    setSaving(true);
    setSaveMsg("");
    try {
      const { res, data: result } = await saveSosCard(data);
      if (!res.ok || !result.ok) throw new Error("save_failed");
      setCard(result.card);
      setSaveMsg(t?.saveSuccess || "Gespeichert.");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch {
      setSaveMsg(t?.saveError || "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateSummary() {
    setAiLoading(true);
    setAiError("");
    try {
      const { res, data } = await generateAiSummary();
      if (res.ok && data.ok) {
        setCard((prev) => ({
          ...prev,
          aiSummary: data.aiSummary,
          aiSummaryUpdatedAt: data.aiSummaryUpdatedAt,
        }));
        return;
      }
      // AI not configured (no OpenAI key) → clear "unavailable" notice, not a generic failure.
      if (res.status === 503 || data?.error === "openai_not_configured") {
        setAiError(t?.aiUnavailable || "Automatische Zusammenfassung ist derzeit nicht verfügbar.");
      } else {
        setAiError(t?.aiError || "Zusammenfassung fehlgeschlagen.");
      }
    } catch {
      setAiError(t?.aiError || "Zusammenfassung fehlgeschlagen.");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleGenerateToken() {
    setTokenLoading(true);
    try {
      const { res, data } = await generateToken();
      if (!res.ok || !data.ok) throw new Error("token_failed");
      setPublicToken(data.publicToken);
      setShowQr(true);
    } catch {
      // silent — user can retry
    } finally {
      setTokenLoading(false);
    }
  }

  async function handleRevokeToken() {
    if (!window.confirm(t?.revokeConfirm || "QR-Code deaktivieren?")) return;
    setTokenLoading(true);
    try {
      const { res, data } = await revokeToken();
      if (!res.ok || !data.ok) throw new Error("revoke_failed");
      setPublicToken(null);
      setShowQr(false);
    } catch {
      // silent
    } finally {
      setTokenLoading(false);
    }
  }

  async function handleGoogleWallet() {
    setWalletMsg("");
    try {
      const { res, data } = await requestGoogleWalletLink();
      if (res.ok && data.ok && data.saveUrl) {
        window.open(data.saveUrl, "_blank", "noopener,noreferrer");
      } else {
        setWalletMsg(t?.wallet?.preparing || "");
      }
    } catch {
      setWalletMsg(t?.wallet?.preparing || "");
    }
  }

  async function handleAppleWallet() {
    setWalletMsg("");
    try {
      const res = await requestApplePass();
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("vnd.apple.pkpass")) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "medscoutx-sos.pkpass";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        setWalletMsg(t?.wallet?.preparing || "");
      }
    } catch {
      setWalletMsg(t?.wallet?.preparing || "");
    }
  }

  if (loading) {
    return (
      <div className="sos-card">
        <p style={{ color: "#9ca3af" }}>{t?.loading || "Laden…"}</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="sos-card">
        <p className="sos-card__error">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="sos-card">
      <div className="sos-card__header">
        <ShieldAlert size={28} color="#dc2626" />
        <div>
          <h1 className="sos-card__title">{t?.pageHeading || "Notfallausweis"}</h1>
          <p className="sos-card__subtitle">{t?.subtitle}</p>
        </div>
      </div>

      <div className="sos-card__disclaimer">
        <AlertTriangle size={14} style={{ display: "inline", marginRight: "0.35rem" }} />
        {t?.disclaimer}
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        {["edit", "preview", "qr"].map((id) => (
          <button
            key={id}
            className={`sos-card__btn ${tab === id ? "sos-card__btn--primary" : "sos-card__btn--secondary"}`}
            onClick={() => setTab(id)}
          >
            {t?.[`tab_${id}`] || id}
          </button>
        ))}
      </div>

      {tab === "edit" && (
        <>
          <SosCardForm
            card={card}
            referenced={referenced}
            allergiesCount={allergies.length}
            diagnosesCount={diagnoses.length}
            saving={saving}
            onSave={handleSave}
            t={t}
          />
          <p
            className={saveMsg && saving ? "sos-card__error" : "sos-card__success"}
            role="status"
            aria-live="polite"
          >
            {saveMsg}
          </p>

          <div className="sos-card__section" style={{ marginTop: "1.5rem" }}>
            <p className="sos-card__section-title">{t?.aiSection}</p>
            <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "1rem" }}>
              {t?.aiHint}
            </p>
            {card?.aiSummary && (
              <div className="sos-card__ai-summary" style={{ marginBottom: "1rem" }}>
                {card.aiSummary}
              </div>
            )}
            <button
              className="sos-card__btn sos-card__btn--ai"
              onClick={handleGenerateSummary}
              disabled={aiLoading}
            >
              <Sparkles size={14} style={{ display: "inline", marginRight: "0.35rem" }} />
              {aiLoading ? t?.aiGenerating : t?.aiGenerate}
            </button>
            {aiError && <p className="sos-card__error">{aiError}</p>}
          </div>
        </>
      )}

      {tab === "preview" && (
        <SosCardPreview
          card={card}
          referenced={referenced}
          allergies={allergies}
          diagnoses={diagnoses}
          t={t}
        />
      )}

      {tab === "qr" && (
        <div className="sos-card__section">
          <p className="sos-card__section-title">
            <QrCode size={14} style={{ display: "inline", marginRight: "0.35rem" }} />
            {t?.qrSection}
          </p>
          <p className="sos-card__hint" style={{ marginBottom: "0.5rem" }}>
            {t?.qrHint}
          </p>
          <p className="sos-card__hint" style={{ marginBottom: "1rem" }}>
            {t?.qrNoHealthData}
          </p>

          {!publicToken ? (
            <button
              className="sos-card__btn sos-card__btn--primary"
              onClick={handleGenerateToken}
              disabled={tokenLoading}
            >
              {tokenLoading ? t?.generating : t?.qrGenerate}
            </button>
          ) : (
            <>
              {/* Reassurance: editing SOS data does NOT require re-adding the wallet pass —
                  the QR points at a stable URL that always serves current released data. */}
              <p className="sos-card__success" role="note" style={{ marginBottom: "1rem" }}>
                {t?.wallet?.dataAutoSync}
              </p>
              {showQr && publicToken !== "hidden" && (
                <SosCardQr token={publicToken} t={t} />
              )}
              {publicToken === "hidden" && (
                <button
                  className="sos-card__btn sos-card__btn--secondary"
                  onClick={handleGenerateToken}
                  disabled={tokenLoading}
                  style={{ marginBottom: "1rem" }}
                >
                  {tokenLoading ? t?.generating : t?.qrRegenerate}
                </button>
              )}
              {/* Warning: regenerating or deactivating the token DOES invalidate old wallet passes. */}
              <div className="sos-card__disclaimer" role="note" style={{ marginTop: "1rem" }}>
                {t?.wallet?.tokenRotationWarning}
              </div>
              <div style={{ marginTop: "1rem" }}>
                <button
                  className="sos-card__btn sos-card__btn--danger"
                  onClick={handleRevokeToken}
                  disabled={tokenLoading}
                >
                  <Trash2 size={14} style={{ display: "inline", marginRight: "0.35rem" }} />
                  {t?.qrRevoke}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "qr" && (
        <div className="sos-card__section">
          <p className="sos-card__section-title">
            <Wallet size={14} style={{ display: "inline", marginRight: "0.35rem" }} />
            {t?.wallet?.section}
          </p>
          <p className="sos-card__hint" style={{ marginBottom: "0.5rem" }}>
            {t?.wallet?.hint}
          </p>
          <p className="sos-card__hint" style={{ marginBottom: "1rem" }}>
            {t?.wallet?.minimalNote}
          </p>

          {!publicToken && (
            <p className="sos-card__hint" role="note">
              {t?.wallet?.needsToken}
            </p>
          )}

          <div className="sos-card__actions" style={{ marginTop: 0 }}>
            <button
              type="button"
              className="sos-card__btn sos-card__btn--secondary"
              disabled={!(walletStatus?.appleWalletAvailable && publicToken)}
              onClick={handleAppleWallet}
            >
              <Wallet size={14} aria-hidden="true" /> {t?.wallet?.appleAdd}
            </button>
            <button
              type="button"
              className="sos-card__btn sos-card__btn--secondary"
              disabled={!(walletStatus?.googleWalletAvailable && publicToken)}
              onClick={handleGoogleWallet}
            >
              <Wallet size={14} aria-hidden="true" /> {t?.wallet?.googleAdd}
            </button>
          </div>

          {!walletStatus?.appleWalletAvailable && !walletStatus?.googleWalletAvailable && (
            <p className="sos-card__hint" role="status" style={{ marginTop: "0.75rem" }}>
              {t?.wallet?.preparing}
            </p>
          )}
          {walletMsg && (
            <p className="sos-card__hint" role="status" aria-live="polite" style={{ marginTop: "0.5rem" }}>
              {walletMsg}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
