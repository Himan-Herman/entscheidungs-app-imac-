import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  ClipboardList,
  LayoutList,
  Pause,
  Play,
  ShieldCheck,
  UserRound,
  Volume2,
  VolumeX,
} from "lucide-react";

/**
 * Original, lightweight visuals for the role-selection page.
 * Theme-aware via JS palette, decorative SVGs are aria-hidden, and every
 * motion effect is gated on prefers-reduced-motion (and pointer-tilt on a
 * fine hover pointer) so reduced-motion / touch users get a calm, static page.
 */

function paletteFor(theme) {
  if (theme === "dark") {
    return {
      patient: "#38bdf8",
      practice: "#2dd4bf",
      glowPatient: "rgba(56, 189, 248, 0.22)",
      glowPractice: "rgba(45, 212, 191, 0.20)",
      track: "rgba(148, 163, 184, 0.22)",
    };
  }

  return {
    patient: "#0ea5e9",
    practice: "#0d9488",
    glowPatient: "rgba(14, 165, 233, 0.18)",
    glowPractice: "rgba(13, 148, 136, 0.16)",
    track: "rgba(15, 23, 42, 0.08)",
  };
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Count from 0 to `target` once in view; `active` flips true when it starts. */
function useCountUp(target, { duration = 1400 } = {}) {
  const ref = useRef(null);
  const [value, setValue] = useState(0);
  const [active, setActive] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      setValue(target);
      setActive(true);
      return undefined;
    }

    let frame = 0;
    let startTime = 0;

    const step = (now) => {
      if (!startTime) startTime = now;
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !started.current) {
            started.current = true;
            setActive(true);
            frame = requestAnimationFrame(step);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.45 },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [target, duration]);

  return { ref, value, active };
}

/** Pointer-driven 3D tilt + cursor spotlight. No-op on touch / reduced motion. */
function usePointerTilt() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window.matchMedia !== "function") return undefined;

    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!fine.matches || prefersReducedMotion()) return undefined;

    let frame = 0;

    const onMove = (event) => {
      const rect = el.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.style.setProperty("--mx", `${(px * 100).toFixed(2)}%`);
        el.style.setProperty("--my", `${(py * 100).toFixed(2)}%`);
        el.style.setProperty("--rx", `${((px - 0.5) * 9).toFixed(2)}deg`);
        el.style.setProperty("--ry", `${((0.5 - py) * 9).toFixed(2)}deg`);
      });
    };

    const onLeave = () => {
      cancelAnimationFrame(frame);
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);

    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(frame);
    };
  }, []);

  return ref;
}

function PatientMotif() {
  return (
    <svg viewBox="0 0 80 80" fill="none" focusable="false" aria-hidden="true">
      <rect
        x="20"
        y="10"
        width="40"
        height="56"
        rx="9"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <path
        d="M27 44h7l3.5-11 6 21 3.5-10h6"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="29" y1="22" x2="51" y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="29" y1="56" x2="44" y2="56" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function PracticeMotif() {
  return (
    <svg viewBox="0 0 80 80" fill="none" focusable="false" aria-hidden="true">
      <rect
        x="12"
        y="18"
        width="30"
        height="48"
        rx="5"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <line x1="20" y1="28" x2="34" y2="28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="20" y1="38" x2="34" y2="38" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="20" y1="48" x2="34" y2="48" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="50" y="40" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="2.5" />
      <rect x="61" y="40" width="6" height="9" rx="1.5" stroke="currentColor" strokeWidth="2.5" />
      <rect x="50" y="53" width="6" height="9" rx="1.5" stroke="currentColor" strokeWidth="2.5" />
      <rect x="60" y="53" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}

/** Interactive role card: 3D tilt, cursor spotlight, depth parallax. */
export function RoleCard({ variant, title, subtitle, modules, cta, onClick }) {
  const ref = usePointerTilt();
  const isPatient = variant === "patient";
  const Icon = isPatient ? UserRound : Building2;

  return (
    <article ref={ref} className={`role-entry__card role-entry__card--${variant}`}>
      <span className="role-entry__card-glow" aria-hidden="true" />
      <span className="role-entry__card-motif" aria-hidden="true">
        {isPatient ? <PatientMotif /> : <PracticeMotif />}
      </span>

      <div className="role-entry__card-body">
        <div className="role-entry__card-icon" aria-hidden="true">
          <Icon size={28} strokeWidth={1.5} />
        </div>
        <h2 className="role-entry__card-title">{title}</h2>
        <p className="role-entry__card-sub">{subtitle}</p>
        <ul className="role-entry__modules">
          {modules.map((item) => (
            <li key={item}>
              <span className="role-entry__module-tick" aria-hidden="true">
                <Check size={13} strokeWidth={3} />
              </span>
              {item}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={`role-entry__cta role-entry__cta--${
            isPatient ? "primary" : "secondary"
          }`}
          onClick={onClick}
        >
          <span>{cta}</span>
          <ArrowRight
            className="role-entry__cta-arrow"
            size={18}
            aria-hidden="true"
          />
        </button>
      </div>
    </article>
  );
}

/**
 * One preview clip in an elegant 9:16 media frame.
 * Click anywhere on the video toggles play/pause; a corner button toggles sound.
 * Starts on the poster (no autoplay) — light on bandwidth and reduced-motion safe.
 */
function ShowcaseVideo({ src, poster, copy }) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return undefined;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onVolume = () => setMuted(v.muted);

    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("volumechange", onVolume);

    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("volumechange", onVolume);
    };
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      const promise = v.play();
      if (promise && typeof promise.catch === "function") {
        promise.catch(() => {});
      }
    } else {
      v.pause();
    }
  };

  const toggleMute = (event) => {
    event.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  };

  return (
    <div className="role-entry__media-frame">
      <video
        ref={videoRef}
        className="role-entry__video"
        src={src}
        poster={poster}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={copy.aria}
      />
      <button
        type="button"
        className={`role-entry__video-toggle${playing ? " is-playing" : ""}`}
        onClick={togglePlay}
        aria-label={playing ? copy.pause : copy.play}
      >
        <span
          className="role-entry__video-icon role-entry__video-icon--play"
          aria-hidden="true"
        >
          <Play size={24} strokeWidth={2} />
        </span>
        <span
          className="role-entry__video-icon role-entry__video-icon--pause"
          aria-hidden="true"
        >
          <Pause size={22} strokeWidth={2} />
        </span>
      </button>
      <button
        type="button"
        className="role-entry__video-mute"
        onClick={toggleMute}
        aria-label={muted ? copy.unmute : copy.mute}
      >
        {muted ? (
          <VolumeX size={17} aria-hidden="true" />
        ) : (
          <Volume2 size={17} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

/** Showcase section: a centred heading plus one or more preview clips. */
export function RoleEntryShowcase({ copy, videos }) {
  const items = Array.isArray(videos) ? videos.filter(Boolean) : [];

  return (
    <div className="role-entry__showcase">
      <div className="role-entry__section-head role-entry__showcase-head">
        <p className="role-entry__section-eyebrow">{copy.eyebrow}</p>
        <h2 className="role-entry__section-title">{copy.title}</h2>
        <p className="role-entry__showcase-body">{copy.body}</p>
      </div>

      <div className="role-entry__media-row" data-count={items.length}>
        {items.map((video) => (
          <ShowcaseVideo
            key={video.src}
            src={video.src}
            poster={video.poster}
            copy={copy}
          />
        ))}
      </div>
    </div>
  );
}

/** Decorative ambient backdrop: soft gradient orbs and a calm pulse line. */
export function RoleEntryBackdrop({ theme }) {
  const p = paletteFor(theme);

  return (
    <div className="role-entry__backdrop" aria-hidden="true">
      <svg
        className="role-entry__backdrop-svg"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <defs>
          <radialGradient id="role-orb-patient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={p.glowPatient} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <radialGradient id="role-orb-practice" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={p.glowPractice} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <linearGradient id="role-pulse" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={p.patient} stopOpacity="0" />
            <stop offset="45%" stopColor={p.patient} stopOpacity="0.7" />
            <stop offset="55%" stopColor={p.practice} stopOpacity="0.7" />
            <stop offset="100%" stopColor={p.practice} stopOpacity="0" />
          </linearGradient>
        </defs>

        <circle
          className="role-entry__orb role-entry__orb--one"
          cx="240"
          cy="220"
          r="300"
          fill="url(#role-orb-patient)"
        />
        <circle
          className="role-entry__orb role-entry__orb--two"
          cx="980"
          cy="560"
          r="340"
          fill="url(#role-orb-practice)"
        />

        <path
          className="role-entry__pulse"
          d="M0 470 H360 l28 -150 l34 270 l30 -190 l26 70 H720 l30 -120 l36 230 l28 -120 H1200"
          fill="none"
          stroke="url(#role-pulse)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

const FLOW_ICONS = [ClipboardList, LayoutList, ShieldCheck];

/** Three-step "how it works" diagram — accessible list with a connecting rail. */
export function RoleEntryFlow({ flow }) {
  const steps = Array.isArray(flow?.steps) ? flow.steps : [];

  return (
    <div className="role-entry__flow-wrap">
      <span className="role-entry__flow-rail" aria-hidden="true" />
      <ol className="role-entry__flow" aria-label={flow?.aria}>
        {steps.map((step, index) => {
          const Icon = FLOW_ICONS[index] ?? ClipboardList;
          return (
            <li className="role-entry__flow-step" key={step.title}>
              <span className="role-entry__flow-node" aria-hidden="true">
                <Icon size={22} strokeWidth={1.6} />
                <span className="role-entry__flow-index">{index + 1}</span>
              </span>
              <h3 className="role-entry__flow-title">{step.title}</h3>
              <p className="role-entry__flow-body">{step.body}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function MetricCard({ item, theme, gradientId }) {
  const { ref, value, active } = useCountUp(item.value);
  const p = paletteFor(theme);
  const circumference = 2 * Math.PI * 30;
  const visibleFraction = 0.72;

  return (
    <li
      ref={ref}
      className="role-entry__metric"
      aria-label={`${item.value} — ${item.label}. ${item.hint}`}
    >
      <span className="role-entry__metric-dial" aria-hidden="true">
        <svg viewBox="0 0 72 72" focusable="false">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={p.patient} />
              <stop offset="100%" stopColor={p.practice} />
            </linearGradient>
          </defs>
          <circle
            cx="36"
            cy="36"
            r="30"
            fill="none"
            stroke={p.track}
            strokeWidth="5"
          />
          <circle
            className="role-entry__metric-arc"
            cx="36"
            cy="36"
            r="30"
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={
              active
                ? circumference * (1 - visibleFraction)
                : circumference
            }
            transform="rotate(-90 36 36)"
          />
        </svg>
        <span className="role-entry__metric-value">{value}</span>
      </span>
      <span className="role-entry__metric-label" aria-hidden="true">
        {item.label}
      </span>
      <span className="role-entry__metric-hint" aria-hidden="true">
        {item.hint}
      </span>
    </li>
  );
}

/** Honest product-capability counters in glass "stat dial" cards. */
export function RoleEntryMetrics({ metrics, theme }) {
  const items = Array.isArray(metrics?.items) ? metrics.items : [];

  return (
    <ul className="role-entry__metrics" aria-label={metrics?.aria}>
      {items.map((item, index) => (
        <MetricCard
          key={item.label}
          item={item}
          theme={theme}
          gradientId={`role-metric-grad-${index}`}
        />
      ))}
    </ul>
  );
}
