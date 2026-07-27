import { useCallback, useEffect, useMemo, useState } from "react";
import { computeSupply } from "../supplyCalc.js";
import {
  disablePush,
  fetchPushConfig,
  fetchPushStatus,
  isIosNeedsInstall,
  isPushSupported,
  sendTestPush,
  subscribeAndSync,
  syncReminders,
} from "../notifications/pushClient.js";
import {
  isNativeRemindersSupported,
  requestNativeReminderPermission,
  scheduleNativeReminders,
  cancelNativeReminders,
  pendingNativeReminderCount,
  checkNativeReminderPermission,
} from "../notifications/nativeReminders.js";
import { authFetch } from "../../../api/authFetch.js";

const PREFS_KEY = "medscoutx_med_reminders_v1";
const DAY_MS = 24 * 60 * 60 * 1000;

function readPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
    return {
      times: Array.isArray(raw.times) && raw.times.length ? raw.times : ["08:00", "20:00"],
      sound: raw.sound !== false,
      vibration: raw.vibration !== false,
    };
  } catch {
    return { times: ["08:00", "20:00"], sound: true, vibration: true };
  }
}

function writePrefs(p) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

/** Build the reminder set: one per intake time + one refill reminder (2 days before empty). */
function buildReminders(times, entries, labels) {
  const reminders = times
    .filter(Boolean)
    .map((timeOfDay) => ({
      type: "intake",
      timeOfDay,
      label: labels.intakeBody,
      url: "/patient/medication-plans/summary",
    }));

  const supplies = (entries || []).map((e) => computeSupply(e)).filter(Boolean);
  if (supplies.length > 0) {
    const earliest = supplies.reduce(
      (min, s) => (s.runOutDate.getTime() < min ? s.runOutDate.getTime() : min),
      supplies[0].runOutDate.getTime(),
    );
    const fireAt = new Date(earliest - 2 * DAY_MS);
    fireAt.setHours(9, 0, 0, 0);
    if (fireAt.getTime() > Date.now()) {
      reminders.push({
        type: "refill",
        fireAt: fireAt.toISOString(),
        label: labels.refillBody,
        url: "/patient/medication-plans",
      });
    }
  }
  return reminders;
}

/**
 * @param {object} props
 * @param {Array} props.entries own-medication entries (for the refill reminder)
 * @param {object} props.t `summary.reminders` i18n block
 */
export default function MedicationRemindersPanel({ entries, t }) {
  const supported = isPushSupported();
  /** In the app the OS schedules locally; Web Push is off there by design. */
  const nativeSupported = isNativeRemindersSupported();

  const iosHint = isIosNeedsInstall();

  const [config, setConfig] = useState({ enabled: false, publicKey: "" });
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(false);
  const [prefs, setPrefs] = useState(readPrefs);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const labels = useMemo(
    () => ({ intakeBody: t.intakeBody, refillBody: t.refillBody }),
    [t.intakeBody, t.refillBody],
  );

  /**
   * Store the reminder times server-side (channel-neutral) and plan them on this
   * device. `channel: "native"` tells the server to stay quiet on web push, so the
   * same reminder cannot also arrive as a browser notification.
   */
  const saveNativeReminders = useCallback(async (times) => {
    const reminders = buildReminders(times, entries, labels);
    await authFetch("/api/patient/push", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: "native",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        reminders,
      }),
    }).catch(() => {});
    return scheduleNativeReminders(times, {
      title: t.nativeTitle || t.heading,
      body: t.nativeBody || "",
    });
  }, [entries, labels, t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cfg = await fetchPushConfig();
      if (cancelled) return;
      setConfig(cfg);
      if (cfg.enabled && supported) {
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (!cancelled) {
            setActive(
              !!sub && "Notification" in window && Notification.permission === "granted",
            );
          }
          const { res, data } = await fetchPushStatus();
          if (!cancelled && res.ok && data.enabled && Array.isArray(data.intakeTimes) && data.intakeTimes.length) {
            setPrefs((p) => ({ ...p, times: data.intakeTimes }));
          }
        } catch {
          /* ignore */
        }
      }
      if (nativeSupported) {
        // Honest status: what this device has actually planned, not what we hope.
        const [pending, granted] = await Promise.all([
          pendingNativeReminderCount(),
          checkNativeReminderPermission(),
        ]);
        if (!cancelled) setActive(pending > 0 && granted === "granted");
        const { res, data } = await fetchPushStatus();
        if (!cancelled && res.ok && Array.isArray(data.intakeTimes) && data.intakeTimes.length) {
          setPrefs((p) => ({ ...p, times: data.intakeTimes }));
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supported, nativeSupported]);

  const persist = useCallback((next) => {
    setPrefs(next);
    writePrefs(next);
  }, []);

  const doEnable = async () => {
    setBusy(true);
    setMsg({ type: "", text: "" });

    // Native path: ask the OS only now — this runs from a deliberate button press.
    if (nativeSupported) {
      const granted = await requestNativeReminderPermission();
      if (!granted) {
        setBusy(false);
        setMsg({ type: "error", text: t.permissionDenied });
        return;
      }
      const res = await saveNativeReminders(prefs.times);
      setBusy(false);
      setActive(res.scheduled > 0);
      setMsg(res.scheduled > 0
        ? { type: "success", text: t.enabledMsg }
        : { type: "error", text: t.genericError });
      return;
    }

    const reminders = buildReminders(prefs.times, entries, labels);
    const result = await subscribeAndSync({
      publicKey: config.publicKey,
      reminders,
      prefs: { sound: prefs.sound, vibration: prefs.vibration },
    });
    setBusy(false);
    if (result.ok) {
      setActive(true);
      setMsg({ type: "success", text: t.enabledMsg });
    } else if (result.error === "permission_denied") {
      setMsg({ type: "error", text: t.permissionDenied });
    } else {
      setMsg({ type: "error", text: t.genericError });
    }
  };

  const doDisable = async () => {
    setBusy(true);
    setMsg({ type: "", text: "" });
    if (nativeSupported) {
      await cancelNativeReminders();
      await authFetch("/api/patient/push", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "native", reminders: [] }),
      }).catch(() => {});
    }
    await disablePush();
    setBusy(false);
    setActive(false);
    setMsg({ type: "success", text: t.disabledMsg });
  };

  const doSave = async () => {
    setBusy(true);
    setMsg({ type: "", text: "" });
    // Native: re-plan on the device so a changed time takes effect immediately.
    if (nativeSupported) {
      const res = await saveNativeReminders(prefs.times);
      setBusy(false);
      setMsg(res.scheduled > 0
        ? { type: "success", text: t.savedMsg }
        : { type: "error", text: t.genericError });
      return;
    }
    const reminders = buildReminders(prefs.times, entries, labels);
    const result = await syncReminders({
      reminders,
      prefs: { sound: prefs.sound, vibration: prefs.vibration },
    });
    setBusy(false);
    setMsg(
      result.ok
        ? { type: "success", text: t.savedMsg }
        : { type: "error", text: t.genericError },
    );
  };

  const doTest = async () => {
    setBusy(true);
    setMsg({ type: "", text: "" });
    try {
      const { res, data } = await sendTestPush(t.testBody);
      setMsg(
        res.ok && data.delivered > 0
          ? { type: "success", text: t.testSent }
          : { type: "error", text: t.testFailed },
      );
    } catch {
      setMsg({ type: "error", text: t.testFailed });
    } finally {
      setBusy(false);
    }
  };

  const setTime = (idx, value) =>
    persist({ ...prefs, times: prefs.times.map((v, i) => (i === idx ? value : v)) });
  const addTime = () => persist({ ...prefs, times: [...prefs.times, "12:00"] });
  const removeTime = (idx) =>
    persist({ ...prefs, times: prefs.times.filter((_, i) => i !== idx) });

  return (
    <section className="pmed-rem" aria-labelledby="pmed-rem-title">
      <h2 id="pmed-rem-title" className="pmed-rem__title">
        {t.title}
      </h2>
      <p className="pmed-rem__intro" role="note">
        {t.intro}
      </p>

      {!supported && !nativeSupported ? (
        <p className="pmed-rem__note" role="note">
          {t.unsupported}
        </p>
      ) : loading ? (
        <p className="pmed-summary__muted">{t.loading}</p>
      ) : !config.enabled && !nativeSupported ? (
        <p className="pmed-rem__note" role="note">
          {t.serverDisabled}
        </p>
      ) : (
        <>
          {iosHint && !nativeSupported ? (
            <p className="pmed-rem__ios" role="note">
              {t.iosHint}
            </p>
          ) : null}

          {nativeSupported ? (
            <p className="pmed-rem__note" role="note">
              {t.nativeChannelHint}
            </p>
          ) : null}

          <label className="pmed-rem__toggle">
            <input
              type="checkbox"
              checked={active}
              disabled={busy}
              onChange={(e) => (e.target.checked ? doEnable() : doDisable())}
            />
            <span>{t.enableLabel}</span>
          </label>

          {active ? (
            <div className="pmed-rem__config">
              <fieldset className="pmed-rem__fieldset">
                <legend className="pmed-rem__legend">{t.timesLegend}</legend>
                <div className="pmed-rem__times">
                  {prefs.times.map((time, idx) => (
                    <div className="pmed-rem__time-row" key={`${idx}-${time}`}>
                      <input
                        type="time"
                        className="pmed-summary__input pmed-rem__time-input"
                        value={time}
                        aria-label={`${t.timeLabel} ${idx + 1}`}
                        onChange={(e) => setTime(idx, e.target.value)}
                      />
                      {prefs.times.length > 1 ? (
                        <button
                          type="button"
                          className="pmed-btn pmed-btn--secondary pmed-rem__time-remove"
                          onClick={() => removeTime(idx)}
                          aria-label={`${t.removeTime} ${time}`}
                        >
                          ✕
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="pmed-btn pmed-btn--secondary"
                  onClick={addTime}
                >
                  + {t.addTime}
                </button>
              </fieldset>

              <div className="pmed-rem__prefs">
                <label className="pmed-rem__pref">
                  <input
                    type="checkbox"
                    checked={prefs.sound}
                    onChange={(e) => persist({ ...prefs, sound: e.target.checked })}
                  />
                  <span>{t.soundLabel}</span>
                </label>
                <label className="pmed-rem__pref">
                  <input
                    type="checkbox"
                    checked={prefs.vibration}
                    onChange={(e) =>
                      persist({ ...prefs, vibration: e.target.checked })
                    }
                  />
                  <span>{t.vibrationLabel}</span>
                </label>
              </div>

              <p className="pmed-rem__refill-note">{t.refillNote}</p>

              <div className="pmed-rem__actions">
                <button
                  type="button"
                  className="pmed-btn pmed-btn--primary"
                  onClick={doSave}
                  disabled={busy}
                >
                  {t.saveBtn}
                </button>
                <button
                  type="button"
                  className="pmed-btn pmed-btn--secondary"
                  hidden={nativeSupported}
                  onClick={doTest}
                  disabled={busy}
                >
                  {t.testBtn}
                </button>
              </div>
            </div>
          ) : null}

          {msg.text ? (
            <p
              className={
                msg.type === "success" ? "pmed-send__ok" : "pmed-send__error"
              }
              role={msg.type === "success" ? "status" : "alert"}
            >
              {msg.text}
            </p>
          ) : null}
        </>
      )}

      <p className="pmed-rem__disclaimer" role="note">
        {t.disclaimer}
      </p>
    </section>
  );
}
