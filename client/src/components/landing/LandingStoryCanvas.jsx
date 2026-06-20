import React from "react";

function paletteFor(theme) {
  if (theme === "dark") {
    return {
      surface: "#102637",
      surfaceSoft: "#153247",
      line: "#5eead4",
      lineSoft: "rgba(94, 234, 212, 0.24)",
      accent: "#7dd3fc",
      accentTwo: "#2dd4bf",
      text: "#eef6fb",
      muted: "#b5cad7",
      border: "rgba(125, 211, 252, 0.18)",
    };
  }

  return {
    surface: "#ffffff",
    surfaceSoft: "#f3fbfb",
    line: "#0f766e",
    lineSoft: "rgba(15, 118, 110, 0.18)",
    accent: "#0ea5e9",
    accentTwo: "#14b8a6",
    text: "#102033",
    muted: "#5b6b79",
    border: "rgba(14, 165, 233, 0.16)",
  };
}

export default function LandingStoryCanvas({ copy, theme }) {
  const p = paletteFor(theme);
  const storyParagraphs = copy.spotlightParagraphs || [];
  const storyList = copy.spotlightList || [];
  const stageLabels = copy.journeyStageLabels || [];
  const moduleItems = copy.moduleMapItems || [];
  const moduleSignals = copy.moduleMapSignals || [];
  const cloudItems = (copy.journeyFeatureCloud || []).slice(0, 6);

  return (
    <section className="landing-page__section landing-page__story">
      <div className="landing-page__section-heading">
        <p className="landing-page__section-eyebrow">{copy.spotlightEyebrow}</p>
        <h2>{copy.spotlightTitle}</h2>
        <p>{copy.spotlightBody}</p>
      </div>

      <div className="landing-page__story-grid">
        <article className="landing-page__story-card landing-page__story-card--narrative">
          <div className="landing-page__story-card-copy">
            <p className="landing-page__story-card-eyebrow">{copy.visualBridge}</p>
            {storyParagraphs.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>

          <div className="landing-page__story-trajectory" aria-label={copy.howTitle}>
            {stageLabels.map((label, index) => (
              <div key={label} className="landing-page__story-stage">
                <span className="landing-page__story-stage-index">0{index + 1}</span>
                <strong>{label}</strong>
              </div>
            ))}
          </div>

          <ul className="landing-page__story-list">
            {storyList.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="landing-page__story-card landing-page__story-card--atlas">
          <div className="landing-page__story-card-copy">
            <p className="landing-page__story-card-eyebrow">{copy.moduleMapEyebrow}</p>
            <h3>{copy.moduleMapTitle}</h3>
          </div>

          <svg
            className="landing-page__story-svg"
            viewBox="0 0 520 320"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="story-line" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={p.line} />
                <stop offset="50%" stopColor={p.accent} />
                <stop offset="100%" stopColor={p.accentTwo} />
              </linearGradient>
              <linearGradient id="story-bar" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={p.accent} />
                <stop offset="100%" stopColor={p.accentTwo} />
              </linearGradient>
            </defs>

            <rect x="0" y="0" width="520" height="320" rx="32" fill={p.surfaceSoft} />
            <path d="M68 204C136 156 182 158 242 184C304 210 350 210 444 154" fill="none" stroke="url(#story-line)" strokeWidth="8" strokeLinecap="round" />
            <path d="M74 72H446" stroke={p.lineSoft} strokeDasharray="5 9" />
            <path d="M74 256H446" stroke={p.lineSoft} strokeDasharray="5 9" />

            {stageLabels.slice(0, 3).map((label, index) => {
              const x = 88 + index * 172;
              const y = index === 1 ? 172 : index === 2 ? 152 : 194;
              return (
                <g key={label}>
                  <circle cx={x} cy={y} r="22" fill={p.surface} stroke={p.accent} strokeWidth="3" />
                  <circle cx={x} cy={y} r="8" fill={index === 1 ? p.accent : p.accentTwo} />
                  <rect x={x - 46} y={y - 70} width="92" height="28" rx="14" fill={p.surface} stroke={p.border} />
                  <text x={x} y={y - 51} textAnchor="middle" fill={p.text} fontSize="11" fontWeight="700">
                    {label}
                  </text>
                </g>
              );
            })}

            <rect x="184" y="88" width="152" height="94" rx="24" fill={p.surface} stroke={p.border} />
            <text x="260" y="122" textAnchor="middle" fill={p.text} fontSize="20" fontWeight="700">
              {copy.visualBridge}
            </text>
            <text x="260" y="145" textAnchor="middle" fill={p.muted} fontSize="12">
              {copy.brandLine}
            </text>
            <rect x="214" y="156" width="92" height="12" rx="6" fill={p.lineSoft} />
            <rect x="214" y="156" width="58" height="12" rx="6" fill="url(#story-bar)" />

            {moduleItems.slice(0, 4).map((item, index) => {
              const positions = [
                { x: 42, y: 104 },
                { x: 350, y: 98 },
                { x: 54, y: 236 },
                { x: 344, y: 236 },
              ];
              const pos = positions[index];
              return (
                <g key={item}>
                  <rect x={pos.x} y={pos.y} width="126" height="34" rx="17" fill={p.surface} stroke={p.border} />
                  <text x={pos.x + 63} y={pos.y + 22} textAnchor="middle" fill={p.text} fontSize="12" fontWeight="700">
                    {item}
                  </text>
                </g>
              );
            })}

            {[44, 72, 58, 92].map((height, index) => {
              const x = 202 + index * 22;
              const y = 270 - height;
              return (
                <rect
                  key={x}
                  x={x}
                  y={y}
                  width="14"
                  height={height}
                  rx="7"
                  fill="url(#story-bar)"
                  opacity={0.82 - index * 0.08}
                />
              );
            })}

            {cloudItems.map((item, index) => {
              const x = 158 + (index % 3) * 92;
              const y = 34 + Math.floor(index / 3) * 28;
              return (
                <text
                  key={item}
                  x={x}
                  y={y}
                  fill={p.muted}
                  fontSize="11"
                  fontWeight="700"
                >
                  {item}
                </text>
              );
            })}
          </svg>

          <div className="landing-page__story-signal-grid">
            {moduleSignals.map((item) => (
              <span key={item} className="landing-page__story-signal">
                {item}
              </span>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
