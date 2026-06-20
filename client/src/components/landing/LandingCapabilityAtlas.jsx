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

function AtlasVisual({ kind, p }) {
  if (kind === "orientation") {
    return (
      <svg className="landing-page__atlas-mini-svg" viewBox="0 0 240 136" aria-hidden="true">
        <rect x="0" y="0" width="240" height="136" rx="24" fill={p.surfaceSoft} />
        <circle cx="78" cy="68" r="34" fill="none" stroke={p.lineSoft} strokeWidth="14" />
        <circle cx="78" cy="68" r="22" fill="none" stroke={p.accent} strokeWidth="8" />
        <circle cx="78" cy="68" r="10" fill={p.accentTwo} />
        <path d="M130 42C154 28 176 30 198 46" fill="none" stroke={p.accent} strokeWidth="5" strokeLinecap="round" />
        <path d="M126 72C152 60 180 62 206 80" fill="none" stroke={p.accentTwo} strokeWidth="5" strokeLinecap="round" />
        <path d="M134 100C158 92 182 94 208 108" fill="none" stroke={p.line} strokeWidth="5" strokeLinecap="round" />
        {[146, 176, 202].map((x, index) => (
          <circle key={x} cx={x} cy={index === 0 ? 42 : index === 1 ? 74 : 104} r="6" fill={p.surface} stroke={p.accent} strokeWidth="3" />
        ))}
      </svg>
    );
  }

  if (kind === "preparation") {
    return (
      <svg className="landing-page__atlas-mini-svg" viewBox="0 0 240 136" aria-hidden="true">
        <rect x="0" y="0" width="240" height="136" rx="24" fill={p.surfaceSoft} />
        <rect x="34" y="24" width="78" height="88" rx="18" fill={p.surface} stroke={p.border} />
        <path d="M52 48H94" stroke={p.lineSoft} strokeWidth="8" strokeLinecap="round" />
        <path d="M52 66H88" stroke={p.lineSoft} strokeWidth="8" strokeLinecap="round" />
        <path d="M52 84H98" stroke={p.lineSoft} strokeWidth="8" strokeLinecap="round" />
        {[48, 78, 104, 128].map((x, index) => (
          <rect
            key={x}
            x={x + 82}
            y={96 - [24, 52, 34, 66][index]}
            width="18"
            height={[24, 52, 34, 66][index]}
            rx="9"
            fill={index % 2 === 0 ? p.accent : p.accentTwo}
            opacity={0.9 - index * 0.08}
          />
        ))}
        <path d="M130 84C146 70 154 72 168 54C178 40 192 42 206 34" fill="none" stroke={p.line} strokeWidth="5" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "communication") {
    return (
      <svg className="landing-page__atlas-mini-svg" viewBox="0 0 240 136" aria-hidden="true">
        <rect x="0" y="0" width="240" height="136" rx="24" fill={p.surfaceSoft} />
        <rect x="24" y="28" width="60" height="38" rx="16" fill={p.surface} stroke={p.border} />
        <circle cx="48" cy="47" r="8" fill={p.accent} opacity="0.92" />
        <path d="M62 42H76" stroke={p.lineSoft} strokeWidth="6" strokeLinecap="round" />
        <path d="M62 54H72" stroke={p.lineSoft} strokeWidth="6" strokeLinecap="round" />

        <rect x="156" y="28" width="60" height="38" rx="16" fill={p.surface} stroke={p.border} />
        <circle cx="180" cy="47" r="8" fill={p.accentTwo} opacity="0.92" />
        <path d="M194 42H208" stroke={p.lineSoft} strokeWidth="6" strokeLinecap="round" />
        <path d="M194 54H204" stroke={p.lineSoft} strokeWidth="6" strokeLinecap="round" />

        <circle cx="120" cy="48" r="12" fill={p.surface} stroke={p.accent} strokeWidth="3" />
        <path d="M114 48H126" stroke={p.accent} strokeWidth="3.5" strokeLinecap="round" />
        <path d="M120 42V54" stroke={p.accentTwo} strokeWidth="3.5" strokeLinecap="round" />

        <path d="M84 47H108" stroke={p.accent} strokeWidth="5" strokeLinecap="round" />
        <path d="M132 47H156" stroke={p.accentTwo} strokeWidth="5" strokeLinecap="round" />

        <rect x="44" y="84" width="152" height="28" rx="14" fill={p.surface} stroke={p.border} />
        <path d="M60 98H92" stroke={p.accent} strokeWidth="6" strokeLinecap="round" />
        <path d="M104 98H138" stroke={p.accentTwo} strokeWidth="6" strokeLinecap="round" />
        <path d="M150 98H180" stroke={p.lineSoft} strokeWidth="6" strokeLinecap="round" />

        <path d="M46 70C56 62 64 62 74 70C84 78 92 78 102 70" fill="none" stroke={p.accentTwo} strokeWidth="4" strokeLinecap="round" />
        <path d="M138 70C148 62 156 62 166 70C176 78 184 78 194 70" fill="none" stroke={p.accent} strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg className="landing-page__atlas-mini-svg" viewBox="0 0 240 136" aria-hidden="true">
      <rect x="0" y="0" width="240" height="136" rx="24" fill={p.surfaceSoft} />
      <rect x="22" y="26" width="196" height="84" rx="20" fill={p.surface} stroke={p.border} />
      <rect x="34" y="38" width="74" height="22" rx="11" fill={p.lineSoft} />
      <rect x="42" y="44" width="18" height="10" rx="5" fill={p.accent} />
      <rect x="66" y="44" width="18" height="10" rx="5" fill={p.accentTwo} />
      <rect x="90" y="44" width="10" height="10" rx="5" fill={p.accent} opacity="0.82" />

      <rect x="34" y="72" width="44" height="26" rx="10" fill={p.surfaceSoft} stroke={p.border} />
      <path d="M44 84H68" stroke={p.accent} strokeWidth="5" strokeLinecap="round" />
      <path d="M44 92H60" stroke={p.lineSoft} strokeWidth="5" strokeLinecap="round" />

      <circle cx="108" cy="85" r="13" fill={p.surfaceSoft} stroke={p.border} />
      <circle cx="104" cy="83" r="4" fill={p.accent} />
      <circle cx="112" cy="89" r="4" fill={p.accentTwo} />

      <path d="M136 46H198" stroke={p.lineSoft} strokeWidth="2" strokeDasharray="4 6" />
      <path d="M136 70H198" stroke={p.lineSoft} strokeWidth="2" strokeDasharray="4 6" />
      <path d="M136 94H198" stroke={p.lineSoft} strokeWidth="2" strokeDasharray="4 6" />

      {[0, 1, 2].map((index) => (
        <rect
          key={index}
          x={144 + index * 18}
          y={92 - [18, 30, 22][index]}
          width="12"
          height={[18, 30, 22][index]}
          rx="6"
          fill={index === 1 ? p.accentTwo : p.accent}
          opacity={0.9 - index * 0.08}
        />
      ))}

      <path d="M184 54L190 60L202 46" fill="none" stroke={p.accentTwo} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function LandingCapabilityAtlas({ copy, theme }) {
  const p = paletteFor(theme);
  const bands = copy.ecosystemBands || [];
  const signals = copy.ecosystemSignals || [];
  const bottomPreviewItems = (copy.moduleMapItems || []).slice(0, 4);
  const summarySignals =
    copy.summaryJourneySignals ||
    (copy.moduleMapSignals || []).slice(0, 3);
  const summaryStages =
    copy.summaryJourneyStages ||
    (copy.journeyStageLabels || []).slice(0, 3);
  const summaryStageWidths = [78, 102, 84, 72, 88];

  const cards = [
    {
      kind: "orientation",
      title: copy.domainOneTitle,
      body: copy.domainOneBody,
      items: copy.domainOneItems || [],
    },
    {
      kind: "preparation",
      title: copy.domainTwoTitle,
      body: copy.domainTwoBody,
      items: copy.domainTwoItems || [],
    },
    {
      kind: "communication",
      title: copy.domainThreeTitle,
      body: copy.domainThreeBody,
      items: copy.domainThreeItems || [],
    },
    {
      kind: "practice",
      title: copy.domainFourTitle,
      body: copy.domainFourBody,
      items: copy.domainFourItems || [],
    },
  ];

  const atlasHeights = [48, 84, 62, 38, 74];

  return (
    <section className="landing-page__section landing-page__atlas">
      <div className="landing-page__section-heading">
        <p className="landing-page__section-eyebrow">{copy.ecosystemEyebrow}</p>
        <h2>{copy.ecosystemTitle}</h2>
        <p>{copy.ecosystemBody}</p>
      </div>

      <div className="landing-page__atlas-grid">
        <div className="landing-page__atlas-column">
          <article className="landing-page__atlas-board">
            <div className="landing-page__atlas-board-copy">
              <p className="landing-page__journey-eyebrow">{copy.ecosystemBoardEyebrow}</p>
              <h3>{copy.ecosystemBoardTitle}</h3>
              <p>{copy.ecosystemBoardBody}</p>
            </div>

          <div className="landing-page__atlas-inline-media landing-page__atlas-inline-media--top">
            <svg className="landing-page__atlas-inline-svg" viewBox="0 0 620 300" aria-hidden="true">
              <defs>
                <linearGradient id="atlas-pill-fill" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={p.surface} />
                  <stop offset="100%" stopColor={p.surfaceSoft} />
                </linearGradient>
                  <linearGradient id="atlas-pill-accent" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={p.accent} />
                    <stop offset="100%" stopColor={p.accentTwo} />
                  </linearGradient>
                </defs>

              <rect x="0" y="0" width="620" height="300" rx="30" fill={p.surfaceSoft} />
              <path d="M70 40H550" stroke={p.lineSoft} strokeDasharray="5 9" />
              <path d="M54 236H566" stroke={p.lineSoft} strokeDasharray="5 9" />

              {signals.slice(0, 5).map((label, index) => {
                const columns = [
                  { x: 30, width: 116, top: 42, height: 154 },
                  { x: 164, width: 116, top: 42, height: 154 },
                  { x: 298, width: 96, top: 42, height: 154 },
                  { x: 412, width: 78, top: 42, height: 154 },
                  { x: 508, width: 82, top: 42, height: 154 },
                ];
                const c = columns[index];
                return (
                  <g key={label}>
                      <rect
                        x={c.x}
                        y={c.top}
                        width={c.width}
                        height={c.height}
                        rx="42"
                        fill="url(#atlas-pill-fill)"
                        stroke={p.border}
                      />

                      {index === 0 ? (
                        <>
                          <path d={`M${c.x + 18} ${c.top + 96}C${c.x + 28} ${c.top + 88} ${c.x + 34} ${c.top + 88} ${c.x + 40} ${c.top + 96}C${c.x + 48} ${c.top + 108} ${c.x + 54} ${c.top + 64} ${c.x + 64} ${c.top + 70}C${c.x + 72} ${c.top + 76} ${c.x + 78} ${c.top + 104} ${c.x + 92} ${c.top + 98}`}
                            fill="none"
                            stroke="url(#atlas-pill-accent)"
                            strokeWidth="6"
                            strokeLinecap="round"
                          />
                          <circle cx={c.x + 34} cy={c.top + 96} r="8" fill={p.surface} stroke={p.accent} strokeWidth="3" />
                          <circle cx={c.x + 64} cy={c.top + 70} r="8" fill={p.surface} stroke={p.accentTwo} strokeWidth="3" />
                          <circle cx={c.x + 92} cy={c.top + 98} r="8" fill={p.surface} stroke={p.accent} strokeWidth="3" />
                        </>
                      ) : null}

                      {index === 1 ? (
                        <>
                          <path d={`M${c.x + 58} ${c.top + 56}V${c.top + 126}`} stroke={p.lineSoft} strokeWidth="6" strokeLinecap="round" />
                          {[0, 1, 2, 3].map((dot) => (
                            <circle
                              key={dot}
                              cx={c.x + 58 + (dot % 2 === 0 ? -12 : 14)}
                              cy={c.top + 60 + dot * 20}
                              r={dot === 1 ? 10 : 7}
                              fill={dot % 2 === 0 ? p.accent : p.accentTwo}
                              opacity={0.88}
                            />
                          ))}
                          <rect x={c.x + 42} y={c.top + 116} width="34" height="22" rx="11" fill={p.lineSoft} />
                        </>
                      ) : null}

                    {index === 2 ? (
                      <>
                          <rect x={c.x + 22} y={c.top + 54} width="52" height="34" rx="14" fill={p.surface} stroke={p.border} />
                          <path d={`M${c.x + 34} ${c.top + 68}H${c.x + 60}`} stroke={p.lineSoft} strokeWidth="6" strokeLinecap="round" />
                          <path d={`M${c.x + 34} ${c.top + 82}H${c.x + 54}`} stroke={p.lineSoft} strokeWidth="6" strokeLinecap="round" />
                          <path d={`M${c.x + 26} ${c.top + 102}H${c.x + 70}`} stroke={p.accent} strokeWidth="8" strokeLinecap="round" />
                          <path d={`M${c.x + 26} ${c.top + 124}H${c.x + 60}`} stroke={p.accentTwo} strokeWidth="8" strokeLinecap="round" />
                          <path d={`M${c.x + 26} ${c.top + 146}H${c.x + 64}`} stroke={p.line} strokeWidth="8" strokeLinecap="round" />
                      </>
                    ) : null}

                    {index === 3 ? (
                      <>
                          <path d={`M${c.x + 18} ${c.top + 108}C${c.x + 28} ${c.top + 90} ${c.x + 36} ${c.top + 126} ${c.x + 44} ${c.top + 108}C${c.x + 52} ${c.top + 90} ${c.x + 60} ${c.top + 126} ${c.x + 68} ${c.top + 108}`}
                            fill="none"
                            stroke="url(#atlas-pill-accent)"
                            strokeWidth="5"
                            strokeLinecap="round"
                          />
                          <circle cx={c.x + 39} cy={c.top + 86} r="10" fill={p.surface} stroke={p.accent} strokeWidth="3" />
                          <circle cx={c.x + 39} cy={c.top + 86} r="3.5" fill={p.accentTwo} />
                          <path d={`M${c.x + 28} ${c.top + 126}H${c.x + 50}`} stroke={p.lineSoft} strokeWidth="7" strokeLinecap="round" />
                        </>
                      ) : null}

                    {index === 4 ? (
                      <>
                          <circle cx={c.x + 42} cy={c.top + 78} r="22" fill="none" stroke={p.lineSoft} strokeWidth="10" />
                          <circle cx={c.x + 42} cy={c.top + 78} r="22" fill="none" stroke={p.accent} strokeWidth="10" strokeDasharray="68 138" strokeLinecap="round" transform={`rotate(-90 ${c.x + 42}  ${c.top + 78})`} />
                          <path d={`M${c.x + 26} ${c.top + 112}H${c.x + 58}`} stroke={p.accentTwo} strokeWidth="8" strokeLinecap="round" />
                          <path d={`M${c.x + 22} ${c.top + 132}H${c.x + 52}`} stroke={p.lineSoft} strokeWidth="8" strokeLinecap="round" />
                          <path d={`M${c.x + 30} ${c.top + 150}H${c.x + 62}`} stroke={p.accent} strokeWidth="8" strokeLinecap="round" />
                        </>
                      ) : null}

                    </g>
                );
              })}

              {signals.slice(0, 5).map((label, index) => {
                const centers = [88, 222, 346, 451, 549];
                return (
                  <text
                    key={`${label}-caption`}
                    x={centers[index]}
                    y="258"
                    textAnchor="middle"
                    fill={p.text}
                    fontSize="12"
                    fontWeight="700"
                  >
                    {label}
                  </text>
                );
              })}
            </svg>
          </div>

            <svg className="landing-page__atlas-board-svg" viewBox="0 0 620 296" aria-hidden="true">
              <defs>
                <linearGradient id="atlas-rail" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={p.line} />
                  <stop offset="55%" stopColor={p.accent} />
                  <stop offset="100%" stopColor={p.accentTwo} />
                </linearGradient>
                <linearGradient id="atlas-bar" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={p.accent} />
                  <stop offset="100%" stopColor={p.accentTwo} />
                </linearGradient>
              </defs>

              <rect x="0" y="0" width="620" height="296" rx="32" fill={p.surfaceSoft} />

              {[52, 110, 168, 226].map((y) => (
                <path key={y} d={`M60 ${y}H560`} stroke={p.lineSoft} strokeDasharray="5 9" />
              ))}

              {bands.slice(0, 5).map((label, index) => {
                const x = 74 + index * 102;
                const height = atlasHeights[index] || 40;
                const y = 220 - height;
                return (
                  <g key={label}>
                    <rect x={x} y={y} width="48" height={height} rx="18" fill="url(#atlas-bar)" opacity={0.9 - index * 0.08} />
                    <text x={x + 24} y="248" textAnchor="middle" fill={p.muted} fontSize="12" fontWeight="700">
                      {label}
                    </text>
                  </g>
                );
              })}

              <path
                d="M98 174C132 140 162 140 196 154C230 168 254 156 296 124C332 98 366 96 402 118C434 136 466 138 524 94"
                fill="none"
                stroke="url(#atlas-rail)"
                strokeWidth="8"
                strokeLinecap="round"
              />

              {[
                [98, 174],
                [196, 154],
                [296, 124],
                [402, 118],
                [524, 94],
              ].map(([x, y]) => (
                <g key={`${x}-${y}`}>
                  <circle cx={x} cy={y} r="11" fill={p.surface} stroke={p.accent} strokeWidth="3" />
                  <circle cx={x} cy={y} r="4.5" fill={p.accentTwo} />
                </g>
              ))}

              <rect x="370" y="30" width="164" height="34" rx="17" fill={p.surface} stroke={p.border} />
              <text x="452" y="51" textAnchor="middle" fill={p.text} fontSize="12" fontWeight="700">
                {copy.brandLine}
              </text>

              <rect x="86" y="32" width="132" height="92" rx="24" fill={p.surface} stroke={p.border} />
              <text x="152" y="60" textAnchor="middle" fill={p.text} fontSize="16" fontWeight="700">
                {copy.visualBridge}
              </text>
              <text x="152" y="82" textAnchor="middle" fill={p.muted} fontSize="11">
                {copy.ecosystemBoardEyebrow}
              </text>
              <rect x="116" y="96" width="72" height="12" rx="6" fill={p.lineSoft} />
              <rect x="116" y="96" width="48" height="12" rx="6" fill={p.accent} />
            </svg>

            <div className="landing-page__atlas-signal-row">
              {signals.map((signal) => (
                <span key={signal} className="landing-page__atlas-signal">
                  {signal}
                </span>
              ))}
            </div>

            <div className="landing-page__atlas-inline-media landing-page__atlas-inline-media--bottom">
              <svg className="landing-page__atlas-inline-svg" viewBox="0 0 620 192" aria-hidden="true">
                <rect x="0" y="0" width="620" height="192" rx="28" fill={p.surfaceSoft} />
                <rect x="40" y="36" width="188" height="100" rx="24" fill={p.surface} stroke={p.border} />
                <circle cx="98" cy="86" r="28" fill="none" stroke={p.lineSoft} strokeWidth="14" />
                <circle cx="98" cy="86" r="28" fill="none" stroke={p.accent} strokeWidth="14" strokeDasharray="90 176" strokeLinecap="round" transform="rotate(-90 98 86)" />
                <circle cx="98" cy="86" r="28" fill="none" stroke={p.accentTwo} strokeWidth="14" strokeDasharray="54 176" strokeDashoffset="-98" strokeLinecap="round" transform="rotate(-90 98 86)" />
                <text x="154" y="76" fill={p.text} fontSize="14" fontWeight="700">
                  {copy.visualBridge}
                </text>
                <text x="154" y="98" fill={p.muted} fontSize="11" fontWeight="600">
                  {copy.ecosystemBoardEyebrow}
                </text>
                <rect x="154" y="108" width="54" height="10" rx="5" fill={p.lineSoft} />
                <rect x="154" y="108" width="34" height="10" rx="5" fill={p.accent} />

                {bottomPreviewItems.map((item, index) => {
                  const x = 286 + index * 72;
                  const barHeight = [38, 62, 44, 76][index] || 34;
                  return (
                    <g key={item}>
                      <rect x={x} y={134 - barHeight} width="40" height={barHeight} rx="16" fill={index % 2 === 0 ? p.accent : p.accentTwo} opacity={0.88 - index * 0.08} />
                      <text x={x + 20} y="170" textAnchor="middle" fill={p.muted} fontSize="10" fontWeight="700">
                        {item}
                      </text>
                    </g>
                  );
                })}

                <path d="M272 48H566" stroke={p.lineSoft} strokeDasharray="4 8" />
                <path d="M272 84H566" stroke={p.lineSoft} strokeDasharray="4 8" />
                <path d="M272 120H566" stroke={p.lineSoft} strokeDasharray="4 8" />
                <path d="M272 150H566" stroke={p.lineSoft} strokeDasharray="4 8" />
              </svg>
            </div>
          </article>

          <article className="landing-page__atlas-summary">
            <div className="landing-page__atlas-summary-copy">
              <p className="landing-page__journey-eyebrow">{copy.metricA}</p>
              <h3>{copy.brandLine}</h3>
              <p>{copy.howOutcome}</p>
            </div>

            <div className="landing-page__atlas-summary-visual" aria-hidden="true">
              <div className="landing-page__atlas-summary-rail" />
              <div className="landing-page__atlas-summary-nodes">
                {summaryStages.map((item, index) => (
                  <div key={item} className="landing-page__atlas-summary-node">
                    <span
                      className={`landing-page__atlas-summary-index${index === summaryStages.length - 1 ? " is-closed" : ""}`}
                    >
                      0{index + 1}
                    </span>
                    <strong>{item}</strong>
                    <i style={{ width: `${summaryStageWidths[index] || 80}px` }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="landing-page__atlas-summary-signals">
              {summarySignals.map((item) => (
                <span key={item} className="landing-page__atlas-summary-pill">
                  {item}
                </span>
              ))}
            </div>
          </article>
        </div>

        <div className="landing-page__atlas-card-grid">
          {cards.map((card) => (
            <article key={card.title} className={`landing-page__atlas-card is-${card.kind}`}>
              <AtlasVisual kind={card.kind} p={p} />
              <div className="landing-page__atlas-card-copy">
                <h3>{card.title}</h3>
                <p>{card.body}</p>
                <ul>
                  {card.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
