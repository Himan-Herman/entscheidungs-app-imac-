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

function wrapSvgText(text, maxCharsPerLine = 24, maxLines = 2) {
  if (!text) {
    return [];
  }

  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length <= maxCharsPerLine) {
      currentLine = nextLine;
      return;
    }

    if (currentLine) {
      lines.push(currentLine);
    }
    currentLine = word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length <= maxLines) {
    return lines;
  }

  const visibleLines = lines.slice(0, maxLines - 1);
  visibleLines.push(lines.slice(maxLines - 1).join(" "));
  return visibleLines;
}

export default function LandingStoryCanvas({ copy, theme }) {
  const p = paletteFor(theme);
  const storyParagraphs = copy.spotlightParagraphs || [];
  const storyList = copy.spotlightList || [];
  const stageLabels = copy.journeyStageLabels || [];
  const moduleItems = copy.moduleMapItems || [];
  const moduleSignals = copy.moduleMapSignals || [];
  const cloudItems = (copy.journeyFeatureCloud || []).slice(0, 4);
  const normalizedStageLabels = new Set(
    stageLabels.map((item) => item.toLocaleLowerCase()),
  );
  const visualModules = moduleItems
    .filter((item) => !normalizedStageLabels.has(item.toLocaleLowerCase()))
    .slice(0, 3);
  const bridgeLines = wrapSvgText(copy.brandLine, 24, 2);

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
            viewBox="0 0 520 332"
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

            <rect x="0" y="0" width="520" height="332" rx="32" fill={p.surfaceSoft} />
            <path d="M72 70H448" stroke={p.lineSoft} strokeDasharray="5 9" />
            <path d="M72 254H448" stroke={p.lineSoft} strokeDasharray="5 9" />

            {cloudItems.map((item, index) => {
              const x = 116 + index * 96;
              return (
                <text
                  key={item}
                  x={x}
                  y="40"
                  textAnchor="middle"
                  fill={p.muted}
                  fontSize="11"
                  fontWeight="700"
                >
                  {item}
                </text>
              );
            })}

            {stageLabels.slice(0, 3).map((label, index) => {
              const x = 96 + index * 154;
              return (
                <g key={label}>
                  <rect x={x - 48} y="86" width="96" height="30" rx="15" fill={p.surface} stroke={p.border} />
                  <text x={x} y="105" textAnchor="middle" fill={p.text} fontSize="11" fontWeight="700">
                    {label}
                  </text>
                </g>
              );
            })}

            <path
              d="M96 198C146 154 194 156 244 180C298 206 358 206 426 160"
              fill="none"
              stroke="url(#story-line)"
              strokeWidth="9"
              strokeLinecap="round"
            />

            <g>
              <circle cx="96" cy="198" r="22" fill={p.surface} stroke={p.accent} strokeWidth="4" />
              <circle cx="96" cy="198" r="8" fill={p.accentTwo} />
            </g>

            <g>
              <circle cx="260" cy="182" r="18" fill={p.surface} stroke={p.accent} strokeWidth="3" />
              <circle cx="260" cy="182" r="7" fill={p.accentTwo} />
            </g>

            <g>
              <circle cx="426" cy="160" r="26" fill={p.surface} stroke={p.accent} strokeWidth="4" />
              <circle cx="426" cy="160" r="9" fill={p.accentTwo} />
            </g>

            <rect x="146" y="114" width="228" height="132" rx="30" fill={p.surface} stroke={p.border} />
            <text x="260" y="164" textAnchor="middle" fill={p.text} fontSize="22" fontWeight="700">
              {copy.visualBridge}
            </text>
            <text x="260" y="190" textAnchor="middle" fill={p.muted} fontSize="12">
              {bridgeLines.map((line, index) => (
                <tspan key={line} x="260" dy={index === 0 ? 0 : 16}>
                  {line}
                </tspan>
              ))}
            </text>
            <rect x="202" y="218" width="116" height="12" rx="6" fill={p.lineSoft} />
            <rect x="202" y="218" width="70" height="12" rx="6" fill="url(#story-bar)" />

            {visualModules.map((item, index) => {
              const positions = [
                { x: 52, y: 270, width: 136 },
                { x: 194, y: 270, width: 152 },
                { x: 354, y: 270, width: 126 },
              ];
              const pos = positions[index];
              return (
                <g key={item}>
                  <rect x={pos.x} y={pos.y} width={pos.width} height="34" rx="17" fill={p.surface} stroke={p.border} />
                  <text x={pos.x + pos.width / 2} y={pos.y + 22} textAnchor="middle" fill={p.text} fontSize="12" fontWeight="700">
                    {item}
                  </text>
                </g>
              );
            })}

            {[52, 84, 64].map((height, index) => {
              const x = 216 + index * 26;
              const y = 272 - height;
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
