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
      shadow: "rgba(0, 0, 0, 0.24)",
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
    shadow: "rgba(16, 32, 51, 0.12)",
  };
}

export default function LandingJourneyCharts({ copy, theme }) {
  const p = paletteFor(theme);
  const bars = copy.journeyChartBars || [];
  const donutLabels = copy.journeyChartDonut || [];
  const tags = copy.journeyChartTags || [];
  const featureCloud = copy.journeyFeatureCloud || [];
  const barHeights = [74, 118, 92, 132, 104];

  return (
    <section className="landing-page__section landing-page__journey-data">
      <div className="landing-page__section-heading">
        <p className="landing-page__section-eyebrow">{copy.journeyCanvasEyebrow}</p>
        <h2>{copy.journeyCanvasTitle}</h2>
        <p>{copy.journeyCanvasBody}</p>
      </div>

      <div className="landing-page__journey-grid" aria-label={copy.journeyCanvasAria}>
        <article className="landing-page__journey-card landing-page__journey-card--bars">
          <div className="landing-page__journey-copy">
            <p className="landing-page__journey-eyebrow">Flow</p>
            <h3>{copy.journeyChartOneTitle}</h3>
            <p>{copy.journeyChartOneBody}</p>
          </div>

          <div className="landing-page__journey-visual-shell">
            <svg
              className="landing-page__journey-svg"
              viewBox="0 0 420 244"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="journey-bars-fill" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={p.accent} />
                  <stop offset="100%" stopColor={p.accentTwo} />
                </linearGradient>
                <linearGradient id="journey-bars-line" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={p.line} />
                  <stop offset="100%" stopColor={p.accent} />
                </linearGradient>
              </defs>

              <rect x="0" y="0" width="420" height="244" rx="28" fill={p.surfaceSoft} />
              <path d="M50 40H374" stroke={p.lineSoft} strokeDasharray="4 9" />
              <path d="M50 92H374" stroke={p.lineSoft} strokeDasharray="4 9" />
              <path d="M50 144H374" stroke={p.lineSoft} strokeDasharray="4 9" />
              <path d="M50 196H374" stroke={p.lineSoft} strokeDasharray="4 9" />
              <path d="M50 196H374" stroke={p.border} strokeWidth="1.5" />

              {barHeights.map((height, index) => {
                const x = 56 + index * 62;
                const y = 196 - height;
                return (
                  <g key={bars[index] || index}>
                    <rect
                      x={x}
                      y={y}
                      width="42"
                      height={height}
                      rx="16"
                      fill="url(#journey-bars-fill)"
                      opacity={0.9 - index * 0.08}
                    />
                    <text
                      x={x + 21}
                      y="220"
                      textAnchor="middle"
                      fill={p.muted}
                      fontSize="11"
                      fontWeight="700"
                    >
                      {bars[index] || ""}
                    </text>
                  </g>
                );
              })}

              <path
                d="M77 122C106 98 118 98 137 82C162 62 180 82 206 90C230 98 247 72 266 64C286 56 304 72 324 84"
                stroke="url(#journey-bars-line)"
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
              />
              {[["77", "122"], ["137", "82"], ["206", "90"], ["266", "64"], ["324", "84"]].map(([x, y]) => (
                <g key={`${x}-${y}`}>
                  <circle cx={x} cy={y} r="9" fill={p.surface} stroke={p.accent} strokeWidth="3" />
                  <circle cx={x} cy={y} r="3.5" fill={p.accentTwo} />
                </g>
              ))}
            </svg>

            <div className="landing-page__journey-callout">
              <span className="landing-page__journey-callout-label">
                {copy.slogan}
              </span>
            </div>
          </div>
        </article>

        <article className="landing-page__journey-card landing-page__journey-card--donut">
          <div className="landing-page__journey-copy">
            <p className="landing-page__journey-eyebrow">Focus</p>
            <h3>{copy.journeyChartTwoTitle}</h3>
            <p>{copy.journeyChartTwoBody}</p>
          </div>

          <div className="landing-page__journey-donut">
            <svg
              className="landing-page__journey-svg"
              viewBox="0 0 280 220"
              aria-hidden="true"
            >
              <rect x="0" y="0" width="280" height="220" rx="28" fill={p.surfaceSoft} />
              <circle cx="140" cy="108" r="58" fill="none" stroke={p.lineSoft} strokeWidth="22" />
              <circle
                cx="140"
                cy="108"
                r="58"
                fill="none"
                stroke={p.accent}
                strokeWidth="22"
                strokeDasharray="146 364"
                strokeLinecap="round"
                transform="rotate(-90 140 108)"
              />
              <circle
                cx="140"
                cy="108"
                r="58"
                fill="none"
                stroke={p.accentTwo}
                strokeWidth="22"
                strokeDasharray="104 364"
                strokeDashoffset="-158"
                strokeLinecap="round"
                transform="rotate(-90 140 108)"
              />
              <circle
                cx="140"
                cy="108"
                r="58"
                fill="none"
                stroke={p.line}
                strokeWidth="22"
                strokeDasharray="84 364"
                strokeDashoffset="-274"
                strokeLinecap="round"
                transform="rotate(-90 140 108)"
              />

              <circle cx="140" cy="108" r="34" fill={p.surface} />
              <text x="140" y="103" textAnchor="middle" fill={p.text} fontSize="16" fontWeight="700">
                {copy.visualBridge}
              </text>
              <text x="140" y="123" textAnchor="middle" fill={p.muted} fontSize="11">
                {copy.journeyChartTwoCenter}
              </text>
            </svg>

            <div className="landing-page__journey-legend">
              {donutLabels.map((label, index) => (
                <div key={label} className="landing-page__journey-legend-item">
                  <i
                    style={{
                      background:
                        index === 0 ? p.accent : index === 1 ? p.accentTwo : p.line,
                    }}
                  />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="landing-page__journey-card landing-page__journey-card--network">
          <div className="landing-page__journey-copy">
            <p className="landing-page__journey-eyebrow">Bridge</p>
            <h3>{copy.journeyChartThreeTitle}</h3>
            <p>{copy.journeyChartThreeBody}</p>
          </div>

          <svg
            className="landing-page__journey-svg"
            viewBox="0 0 360 244"
            aria-hidden="true"
          >
            <rect x="0" y="0" width="360" height="244" rx="28" fill={p.surfaceSoft} />
            <path
              d="M86 96L144 56L212 74L246 138L196 188L122 176L86 96Z"
              fill="none"
              stroke={p.lineSoft}
              strokeWidth="2"
            />
            <path
              d="M96 190C126 170 144 168 170 174C202 182 222 206 266 206"
              fill="none"
              stroke={p.accent}
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path
              d="M96 154C116 132 136 120 162 120C194 120 214 130 244 154"
              fill="none"
              stroke={p.accentTwo}
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.82"
            />

            {[
              { x: 90, y: 92, label: tags[0] || "", fill: p.accent },
              { x: 146, y: 54, label: tags[1] || "", fill: p.accentTwo },
              { x: 216, y: 72, label: tags[2] || "", fill: p.line },
              { x: 248, y: 140, label: tags[3] || "", fill: p.accent },
            ].map((node) => (
              <g key={node.label}>
                <circle cx={node.x} cy={node.y} r="16" fill={p.surface} stroke={node.fill} strokeWidth="3" />
                <circle cx={node.x} cy={node.y} r="6" fill={node.fill} />
                <text x={node.x + 24} y={node.y + 4} fill={p.text} fontSize="11" fontWeight="700">
                  {node.label}
                </text>
              </g>
            ))}

            <rect x="32" y="24" width="116" height="28" rx="14" fill={p.surface} stroke={p.border} />
            <text x="90" y="42" textAnchor="middle" fill={p.text} fontSize="11" fontWeight="700">
              {copy.brandLine}
            </text>

            <path d="M34 214H324" stroke={p.lineSoft} strokeDasharray="4 8" />
          </svg>
        </article>
      </div>

      <div className="landing-page__feature-cloud" aria-label={copy.metricsAria}>
        {featureCloud.map((item, index) => (
          <span
            key={item}
            className={`landing-page__feature-chip landing-page__feature-chip--${index % 4}`}
          >
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}
