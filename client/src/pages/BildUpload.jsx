import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
} from "react";
import { Link } from "react-router-dom";
import "../styles/BildUpload.css";
import { useTheme } from "../ThemeMode";
import VoiceInput from "../components/VoiceInput.jsx";
import { FaPaperPlane } from "react-icons/fa";
import { authFetch } from "../api/authFetch";
import DisclaimerShort from "../components/DisclaimerShort";
import { Image as ImageIcon, Camera, Video } from "lucide-react";
import SpeakButton from "../components/SpeakButton.jsx";
import { useLanguage } from "../i18n/LanguageContext";
import { LOCALE_OPTIONS } from "../i18n/localeConfig.js";
import { getMessages } from "../i18n/translations/index.js";
import { useOnlineStatus } from "../hooks/useOnlineStatus.js";

const LS_VERLAUF_KEY = "bildChatVerlauf";
const LS_THREAD_KEY = "bildThreadId";
const LS_CONSENT_KEY = "medscoutx_image_analysis_ack_v1";
const MAX_CHARS = 1200;

function stripHtml(html) {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

export default function BildUpload() {
  const [bild, setBild] = useState(null);
  const [beschreibung, setBeschreibung] = useState("");
  const [ladezustand, setLadezustand] = useState(false);
  const [verlauf, setVerlauf] = useState([]);
  const { theme } = useTheme();
  const { language } = useLanguage();
  const online = useOnlineStatus();

  const t = useMemo(() => {
    const bundle = getMessages(language);
    return bundle.imageAnalysis ?? getMessages("en").imageAnalysis;
  }, [language]);

  const uiLanguageLabel = useMemo(() => {
    const code =
      typeof language === "string" ? language.toLowerCase() : "en";
    const opt = LOCALE_OPTIONS.find((o) => o.code === code);
    return opt?.nativeName ?? code;
  }, [language]);

  const [consentOk, setConsentOk] = useState(() => {
    try {
      return localStorage.getItem(LS_CONSENT_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [consentDraft, setConsentDraft] = useState(false);

  const galleryInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const letztesBild = useRef(null);
  const previewUrlRef = useRef(null);
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);
  const lastPersistedVerlaufJson = useRef(null);

  const [showCam, setShowCam] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const MIN_TXTAREA_H = 44;

  const autoResize = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, MIN_TXTAREA_H)}px`;
  };

  useLayoutEffect(() => {
    autoResize(textareaRef.current);
  }, [beschreibung]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [verlauf]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks()?.forEach((tr) => tr.stop());
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!consentOk) return;

    try {
      const raw = localStorage.getItem(LS_VERLAUF_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setVerlauf(parsed);
          lastPersistedVerlaufJson.current = JSON.stringify(parsed);
        }
      }
    } catch (e) {
      console.warn("[BildUpload] could not read chat history:", e);
      localStorage.removeItem(LS_VERLAUF_KEY);
    }

    const tid = localStorage.getItem(LS_THREAD_KEY);
    if (tid && tid !== "null" && tid !== "undefined" && tid.trim() !== "") {
      /* thread id kept for continuity; image must be re-selected for next send */
    } else {
      localStorage.removeItem(LS_THREAD_KEY);
    }
  }, [consentOk]);

  useEffect(() => {
    if (!consentOk) return;
    const snap = JSON.stringify(verlauf);
    if (snap === lastPersistedVerlaufJson.current) return;
    lastPersistedVerlaufJson.current = snap;
    try {
      localStorage.setItem(LS_VERLAUF_KEY, snap);
    } catch (e) {
      console.warn("[BildUpload] could not persist chat:", e);
    }
  }, [verlauf, consentOk]);

  function revokePreview() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }

  const handleBeschreibungChange = (e) => {
    setBeschreibung(e.target.value.slice(0, MAX_CHARS));
  };

  const handleBildAuswahl = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    revokePreview();
    const objectURL = URL.createObjectURL(file);
    previewUrlRef.current = objectURL;
    setBild(objectURL);
    letztesBild.current = file;
    try {
      localStorage.removeItem(LS_THREAD_KEY);
    } catch {
      /* ignore */
    }
    if (e.target) e.target.value = "";
  };

  const removeImage = () => {
    revokePreview();
    setBild(null);
    letztesBild.current = null;
  };

  function persistConsent() {
    try {
      localStorage.setItem(LS_CONSENT_KEY, "1");
    } catch {
      /* ignore */
    }
    setConsentOk(true);
  }

  const startWebcam = async () => {
    try {
      let constraints = { video: true };
      if (/Mobi|Android/i.test(navigator.userAgent)) {
        constraints = { video: { facingMode: "environment" } };
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setShowCam(true);

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.muted = true;
      video.setAttribute("muted", "");
      video.playsInline = true;
      video.setAttribute("playsinline", "");

      video.onloadedmetadata = async () => {
        try {
          await video.play();
        } catch (err) {
          console.warn("video.play():", err);
        }
      };
    } catch (e) {
      window.alert(t.cameraDenied);
      console.error(e);
    }
  };

  const stopWebcam = () => {
    streamRef.current?.getTracks()?.forEach((tr) => tr.stop());
    streamRef.current = null;
    setShowCam(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], "snapshot.jpg", { type: "image/jpeg" });
        revokePreview();
        const objectURL = URL.createObjectURL(file);
        previewUrlRef.current = objectURL;
        setBild(objectURL);
        letztesBild.current = file;
        try {
          localStorage.removeItem(LS_THREAD_KEY);
        } catch {
          /* ignore */
        }
        stopWebcam();
      },
      "image/jpeg",
      0.9,
    );
  };

  const handleVoice = (text) => {
    if (!text) return;
    setBeschreibung((prev) =>
      (
        prev +
        (prev && !prev.endsWith(" ") ? " " : "") +
        text
      ).slice(0, MAX_CHARS),
    );
    textareaRef.current?.focus();
  };

  const handleFrageSenden = async () => {
    if (!consentOk || !beschreibung.trim()) return;
    if (!online) {
      window.alert(t.offlineError);
      return;
    }
    if (!letztesBild.current) {
      const warnung = t.needImageWarning;
      setVerlauf((prev) => [...prev, { frage: beschreibung.trim(), antwort: warnung }]);
      setBeschreibung("");
      return;
    }

    const text = beschreibung.trim();
    setLadezustand(true);
    try {
      const formData = new FormData();
      formData.append("prompt", text);
      formData.append("bild", letztesBild.current);
      formData.append("bildTyp", "medizinisch");
      formData.append(
        "letzteSprache",
        uiLanguageLabel,
      );

      const existingThreadId = localStorage.getItem(LS_THREAD_KEY);
      if (existingThreadId) formData.append("threadId", existingThreadId);

      const response = await authFetch("/api/symptom", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.fehler || "failed");
      }

      if (data.threadId) localStorage.setItem(LS_THREAD_KEY, data.threadId);

      const antwortText =
        typeof data.antwort === "string"
          ? data.antwort
          : data.fehler || t.serverError;
      setVerlauf((prev) => [...prev, { frage: text, antwort: antwortText }]);
      setBeschreibung("");
    } catch (error) {
      console.error("[BildUpload]", error);
      setVerlauf((prev) => [
        ...prev,
        { frage: text, antwort: t.serverError },
      ]);
    } finally {
      setLadezustand(false);
    }
  };

  const resetChat = () => {
    setVerlauf([]);
    removeImage();
    setBeschreibung("");
    try {
      localStorage.removeItem(LS_VERLAUF_KEY);
      localStorage.removeItem(LS_THREAD_KEY);
      lastPersistedVerlaufJson.current = JSON.stringify([]);
    } catch (e) {
      console.warn("[BildUpload] reset:", e);
    }
  };

  const clearVerlauf = () => {
    setVerlauf([]);
    try {
      localStorage.setItem(LS_VERLAUF_KEY, JSON.stringify([]));
      lastPersistedVerlaufJson.current = JSON.stringify([]);
    } catch (e) {
      console.warn("[BildUpload] clear chat:", e);
    }
  };

  const maxCharsHint = t.maxCharsLabel.replace("{{max}}", String(MAX_CHARS));
  const voiceLabels = {
    start: t.voiceStart,
    stop: t.voiceStop,
    micError: t.voiceMicError,
    transcriptionError: t.voiceTxError,
  };

  return (
    <main
      className={`bildupload-page bildupload-page--${theme}`}
      data-theme={theme}
      aria-labelledby="bildanalyse-heading"
      role="main"
    >
      <div className="bildupload-shell">
        <header className="bildupload-header">
          <div className="bildupload-header-text">
            <h1 id="bildanalyse-heading" className="bildupload-title">
              {t.heading}
            </h1>
            <p className="bildupload-subtitle">{t.subtitle}</p>
          </div>
          <div className="bildupload-header-meta" aria-hidden="true">
            <span className="chip chip--accent">{t.chipPrimary}</span>
            <span className="chip chip--soft">{t.chipSecondary}</span>
          </div>
        </header>

        <section className="image-analysis-safety" role="region" aria-label={t.consentTitle}>
          <p className="image-analysis-safety__lead">{t.storeDisclaimer}</p>
          <p className="image-analysis-safety__emergency">{t.emergencyNote}</p>
          <p className="image-analysis-safety__storage">{t.storageNote}</p>
        </section>

        <section className="bildupload-disclaimer-section" aria-label="Disclaimer">
          <DisclaimerShort />
        </section>

        {!consentOk ? (
          <section className="image-analysis-consent" aria-labelledby="img-consent-title">
            <h2 id="img-consent-title" className="image-analysis-consent__title">
              {t.consentTitle}
            </h2>
            <label className="image-analysis-consent__check">
              <input
                type="checkbox"
                checked={consentDraft}
                onChange={(e) => setConsentDraft(e.target.checked)}
              />
              <span>{t.consentCheckbox}</span>
            </label>
            <p className="image-analysis-consent__links">
              <Link to="/datenschutz">{t.consentPrivacyLink}</Link>
              {" · "}
              <Link to="/settings/privacy">{t.accountDataLink}</Link>
            </p>
            <button
              type="button"
              className="image-analysis-consent__cta"
              disabled={!consentDraft}
              onClick={persistConsent}
            >
              {t.consentContinue}
            </button>
          </section>
        ) : null}

        {consentOk ? (
          <div className="bildupload-layout">
            <section
              className="bildupload-panel bildupload-panel--left"
              aria-label={t.panelUploadTitle}
            >
              <h2 className="panel-title">{t.panelUploadTitle}</h2>
              <p className="panel-description">{t.panelUploadIntro}</p>
              <p className="image-analysis-webcam-note">{t.webcamExplainer}</p>

              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                onChange={handleBildAuswahl}
                className="visually-hidden"
                aria-hidden="true"
                tabIndex={-1}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleBildAuswahl}
                className="visually-hidden"
                aria-hidden="true"
                tabIndex={-1}
              />

              <div className="upload-actions" role="group" aria-label={t.panelUploadTitle}>
                <button
                  type="button"
                  className="upload-btn upload-btn--large"
                  onClick={() => galleryInputRef.current?.click()}
                >
                  <ImageIcon size={20} strokeWidth={2} aria-hidden="true" />
                  <span>{t.uploadGallery}</span>
                </button>
                <button
                  type="button"
                  className="upload-btn upload-btn--large"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera size={20} strokeWidth={2} aria-hidden="true" />
                  <span>{t.uploadCamera}</span>
                </button>
                <button type="button" className="upload-btn upload-btn--large" onClick={startWebcam}>
                  <Video size={20} strokeWidth={2} aria-hidden="true" />
                  <span>{t.uploadWebcam}</span>
                </button>
              </div>

              <div className="bild-preview-wrapper" aria-live="polite">
                {bild ? (
                  <figure className="bild-preview-card">
                    <img src={bild} alt={t.previewAlt} className="bild-vorschau-klein" />
                    <figcaption className="bild-preview-caption">{t.previewCaption}</figcaption>
                    <button
                      type="button"
                      className="btn btn--ghost-danger image-analysis-remove-img"
                      onClick={removeImage}
                      aria-label={t.removeImageAria}
                    >
                      {t.removeImage}
                    </button>
                  </figure>
                ) : (
                  <div className="bild-placeholder" aria-hidden="true">
                    <div className="bild-placeholder-outline" />
                    <p>{t.previewEmpty}</p>
                  </div>
                )}
              </div>

              <div className="control-row">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={resetChat}
                  aria-label={t.newChatAria}
                >
                  <span className="icon" aria-hidden="true">
                    ↻
                  </span>
                  <span>{t.newChat}</span>
                </button>
                <button
                  type="button"
                  className="btn btn--ghost-danger"
                  onClick={clearVerlauf}
                  aria-label={t.clearHistoryAria}
                >
                  <span className="icon" aria-hidden="true">
                    🧹
                  </span>
                  <span>{t.clearHistory}</span>
                </button>
              </div>

              <p className="image-analysis-processing-note">{t.processingNote}</p>

              <p className="image-analysis-account-hint">
                {t.accountDataHint}{" "}
                <Link to="/settings/privacy">{t.accountDataLink}</Link>
              </p>
            </section>

            <section
              className="bildupload-panel bildupload-panel--right"
              aria-label={t.chatTitle}
            >
              <div
                className="chat-card"
                role="group"
                aria-label={t.chatTitle}
                aria-busy={ladezustand}
              >
                <header className="chat-header">
                  <div>
                    <h2 className="panel-title">{t.chatTitle}</h2>
                    <p className="panel-description">{t.chatIntro}</p>
                  </div>
                  <div className="chat-header-badge">
                    <span className="status-dot" aria-hidden="true" />
                    <span className="status-label">{online ? t.statusReady : t.offlineBadge}</span>
                  </div>
                </header>

                <section
                  className="chatverlauf image-analysis-chatlog"
                  style={{ maxHeight: 320, overflowY: "auto" }}
                  role="log"
                  aria-live="polite"
                  aria-relevant="additions text"
                  aria-label={t.chatTitle}
                >
                  {verlauf.length === 0 && (
                    <p className="chat-placeholder">
                      {t.placeholderEmpty}
                      <br />
                      <span className="chat-placeholder-example">{t.placeholderExample}</span>
                    </p>
                  )}

                  {verlauf.map((eintrag, index) => (
                    <article
                      key={index}
                      className="chat-message-block"
                      aria-label={`${index + 1}`}
                    >
                      <div className="frage-block message-bubble message-bubble--user">
                        <strong className="message-label">{t.userLabel}</strong>
                        <p className="message-text message-text--pre">{eintrag.frage}</p>
                      </div>
                      <div className="antwort-block message-bubble message-bubble--meda">
                        <div className="message-header-row">
                          <strong className="message-label">{t.assistantLabel}</strong>
                          <SpeakButton
                            text={stripHtml(eintrag.antwort || "")}
                            className="tts-btn"
                            ariaLabel={t.speakAria}
                          />
                        </div>
                        <p className="message-text message-text--pre">{eintrag.antwort}</p>
                      </div>
                    </article>
                  ))}
                  <div ref={chatEndRef} />
                </section>

                <div className="loading-row" aria-live="polite" aria-atomic="true">
                  {ladezustand ? (
                    <p className="loading-text" role="status">
                      {t.loadingText}
                    </p>
                  ) : null}
                </div>

                <div className="eingabe-bereich">
                  <div className="bild-eingabe-label-row">
                    <label htmlFor="bildbeschreibung" className="bild-eingabe-label">
                      {t.questionLabel}
                    </label>
                    <span className="bild-eingabe-hint">{maxCharsHint}</span>
                  </div>

                  <textarea
                    id="bildbeschreibung"
                    ref={textareaRef}
                    placeholder={t.questionPlaceholder}
                    value={beschreibung}
                    maxLength={MAX_CHARS}
                    rows={2}
                    disabled={!bild}
                    onChange={(e) => {
                      handleBeschreibungChange(e);
                      autoResize(e.target);
                    }}
                    onInput={(e) => autoResize(e.target)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleFrageSenden();
                      }
                    }}
                    className="chat-textarea"
                    aria-label={t.questionLabel}
                  />

                  <div className="eingabe-actions">
                    <span
                      className={`char-count ${
                        beschreibung.length >= MAX_CHARS ? "limit" : ""
                      }`}
                      aria-live="polite"
                    >
                      {beschreibung.length}/{MAX_CHARS}
                    </span>

                    <div className="voice-wrap">
                      <VoiceInput
                        onTranscribed={handleVoice}
                        className="voice-input-wrap"
                        labels={voiceLabels}
                        notice={bild ? t.micNotice : undefined}
                      />
                    </div>

                    <button
                      type="button"
                      className="send-btn"
                      onClick={() => void handleFrageSenden()}
                      disabled={
                        ladezustand ||
                        !online ||
                        !bild ||
                        !beschreibung.trim()
                      }
                      aria-label={t.sendAria}
                    >
                      <FaPaperPlane aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {!bild ? (
                  <p className="eingabe-disabled-hint" role="note">
                    {t.inputDisabledHint}
                  </p>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}
      </div>

      {showCam ? (
        <div
          className="webcam-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="webcam-dialog-title"
        >
          <div className="webcam-dialog">
            <h2 id="webcam-dialog-title" className="webcam-title">
              {t.webcamTitle}
            </h2>
            <p className="webcam-subtitle">{t.webcamIntro}</p>

            <div className="webcam-video-wrapper">
              <video ref={videoRef} className="webcam-video" playsInline muted />
            </div>

            <div className="webcam-actions">
              <button type="button" className="primary-btn" onClick={capturePhoto}>
                <span aria-hidden="true">📸</span>
                <span>{t.webcamCapture}</span>
              </button>
              <button type="button" className="secondary-btn" onClick={stopWebcam}>
                {t.webcamCancel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
