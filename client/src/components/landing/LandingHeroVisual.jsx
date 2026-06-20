import React from "react";

function paletteFor(theme) {
  if (theme === "dark") {
    return {
      bgTop: "#0e2233",
      bgBottom: "#0a1722",
      panel: "#102637",
      panelSoft: "#153247",
      line: "#5eead4",
      lineSoft: "rgba(94, 234, 212, 0.24)",
      accent: "#7dd3fc",
      accentTwo: "#2dd4bf",
      text: "#eef6fb",
      muted: "#b5cad7",
      chip: "#173345",
      chipStroke: "rgba(125, 211, 252, 0.24)",
    };
  }

  return {
    bgTop: "#f7fbfc",
    bgBottom: "#edf7f7",
    panel: "#ffffff",
    panelSoft: "#f3fbfb",
    line: "#0f766e",
    lineSoft: "rgba(15, 118, 110, 0.18)",
    accent: "#0ea5e9",
    accentTwo: "#14b8a6",
    text: "#102033",
    muted: "#5b6b79",
    chip: "#eef8fa",
    chipStroke: "rgba(14, 165, 233, 0.18)",
  };
}

export default function LandingHeroVisual({ copy, theme }) {
  const p = paletteFor(theme);

  return (
    <>
      <div className="landing-page__visual-stage" role="img" aria-label={copy.visualAria}>
        <svg
          className="landing-page__visual-svg"
          viewBox="0 0 640 420"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="landing-stage-bg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={p.bgTop} />
              <stop offset="100%" stopColor={p.bgBottom} />
            </linearGradient>
            <linearGradient id="landing-stage-line" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={p.accent} />
              <stop offset="100%" stopColor={p.accentTwo} />
            </linearGradient>
            <filter id="landing-soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="10" stdDeviation="14" floodOpacity="0.12" />
            </filter>
          </defs>

          <rect
            x="18"
            y="18"
            width="604"
            height="384"
            rx="38"
            fill="url(#landing-stage-bg)"
          />

          <circle cx="110" cy="90" r="56" fill={p.lineSoft} />
          <circle cx="554" cy="320" r="72" fill={p.lineSoft} />

          <rect
            x="54"
            y="96"
            width="188"
            height="204"
            rx="28"
            fill={p.panel}
            filter="url(#landing-soft-shadow)"
          />
          <circle cx="100" cy="144" r="24" fill={p.accent} fillOpacity="0.18" />
          <circle cx="100" cy="140" r="12" fill={p.accent} />
          <path
            d="M82 166c6-16 30-16 36 0v8H82z"
            fill={p.accent}
          />
          <text x="136" y="138" fill={p.text} fontSize="20" fontWeight="700">
            {copy.visualPatient}
          </text>
          <text x="136" y="162" fill={p.muted} fontSize="12">
            {copy.visualStatusPrepared}
          </text>

          <rect x="74" y="190" width="98" height="30" rx="15" fill={p.chip} stroke={p.chipStroke} />
          <text x="123" y="209" textAnchor="middle" fill={p.text} fontSize="11" fontWeight="600">
            {copy.visualChipSymptoms}
          </text>
          <rect x="80" y="232" width="118" height="30" rx="15" fill={p.chip} stroke={p.chipStroke} />
          <text x="139" y="251" textAnchor="middle" fill={p.text} fontSize="11" fontWeight="600">
            {copy.visualChipDocuments}
          </text>
          <rect x="88" y="274" width="104" height="30" rx="15" fill={p.chip} stroke={p.chipStroke} />
          <text x="140" y="293" textAnchor="middle" fill={p.text} fontSize="11" fontWeight="600">
            {copy.visualChipMessages}
          </text>

          <rect
            x="268"
            y="142"
            width="110"
            height="138"
            rx="26"
            fill={p.panelSoft}
            stroke={p.chipStroke}
            strokeWidth="1.5"
            filter="url(#landing-soft-shadow)"
          />
          <text x="323" y="170" textAnchor="middle" fill={p.text} fontSize="15" fontWeight="700">
            {copy.visualBridge}
          </text>
          <rect x="290" y="188" width="68" height="10" rx="5" fill={p.line} fillOpacity="0.18" />
          <rect x="290" y="208" width="54" height="10" rx="5" fill={p.line} fillOpacity="0.18" />
          <rect x="290" y="228" width="76" height="10" rx="5" fill={p.line} fillOpacity="0.18" />
          <rect x="290" y="250" width="60" height="10" rx="5" fill={p.line} fillOpacity="0.18" />

          <rect x="292" y="98" width="62" height="28" rx="14" fill={p.panel} stroke={p.chipStroke} />
          <text x="323" y="116" textAnchor="middle" fill={p.text} fontSize="11" fontWeight="700">
            {copy.visualChipLanguage}
          </text>

          <rect
            x="398"
            y="94"
            width="188"
            height="210"
            rx="28"
            fill={p.panel}
            filter="url(#landing-soft-shadow)"
          />
          <circle cx="446" cy="140" r="24" fill={p.accentTwo} fillOpacity="0.2" />
          <path
            d="M438 145h16M446 137v16M454 160c10 0 18 8 18 18"
            stroke={p.accentTwo}
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          <text x="482" y="138" fill={p.text} fontSize="20" fontWeight="700">
            {copy.visualPractice}
          </text>
          <text x="482" y="162" fill={p.muted} fontSize="12">
            {copy.visualStatusLinked}
          </text>

          <rect x="424" y="190" width="134" height="12" rx="6" fill={p.line} fillOpacity="0.18" />
          <rect x="424" y="214" width="122" height="12" rx="6" fill={p.line} fillOpacity="0.18" />
          <rect x="424" y="238" width="140" height="12" rx="6" fill={p.line} fillOpacity="0.18" />
          <rect x="424" y="262" width="108" height="12" rx="6" fill={p.line} fillOpacity="0.18" />

          <path
            d="M242 198C266 198 274 190 286 178"
            stroke="url(#landing-stage-line)"
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M378 178C392 192 404 198 424 198"
            stroke="url(#landing-stage-line)"
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M242 250C268 250 278 254 286 260"
            stroke="url(#landing-stage-line)"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
            opacity="0.72"
          />
          <path
            d="M378 260C392 252 402 248 424 248"
            stroke="url(#landing-stage-line)"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
            opacity="0.72"
          />

          <rect x="422" y="52" width="128" height="28" rx="14" fill={p.chip} stroke={p.chipStroke} />
          <text x="486" y="70" textAnchor="middle" fill={p.text} fontSize="11" fontWeight="700">
            {copy.visualStatusSecure}
          </text>
        </svg>
      </div>

      <div className="landing-page__insight-grid" aria-label={copy.visualInsightsAria}>
        <article className="landing-page__insight-card">
          <p className="landing-page__insight-eyebrow">{copy.spotlightEyebrow}</p>
          <h3>{copy.spotlightTitle}</h3>
          <p>{copy.spotlightBody}</p>
          <ul className="landing-page__insight-list">
            {(copy.spotlightList || []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="landing-page__insight-card">
          <p className="landing-page__insight-eyebrow">{copy.moduleMapEyebrow}</p>
          <h3>{copy.moduleMapTitle}</h3>
          <div className="landing-page__module-stack">
            {(copy.moduleMapItems || []).map((item, index) => (
              <div key={item} className="landing-page__module-row">
                <span>{item}</span>
                <div className="landing-page__module-meter" aria-hidden="true">
                  <i style={{ width: `${88 - index * 12}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </>
  );
}
