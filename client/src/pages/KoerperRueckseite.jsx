import React, { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import {
  readBodyMapConsent,
  rememberBodyMapSelection,
} from "../features/bodyMap/bodyMapSession";
import "../styles/BodyMapPages.css";
import rueckenBild from "../assets/img/Koerper_Rueckseite.png";

function regionHitProps(goRegion, organId, ariaLabel) {
  const label = ariaLabel || String(organId).replace(/_/g, " ");
  return {
    tabIndex: 0,
    role: "button",
    "aria-label": label,
    style: { cursor: "pointer" },
    onClick: () => goRegion(organId),
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        goRegion(organId);
      }
    },
  };
}

export default function KoerperRueckseite() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = useMemo(() => {
    const b = getMessages(language);
    return b.bodyMap ?? getMessages("en").bodyMap;
  }, [language]);
  const mb = t.mapBack;

  useEffect(() => {
    if (!readBodyMapConsent()) {
      navigate("/region-start", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    document.title = mb.pageTitle;
  }, [mb.pageTitle]);

  const goRegion = (organId) => {
    rememberBodyMapSelection(organId, "rueckseite");
    navigate(
      `/koerpersymptom?organ=${encodeURIComponent(organId)}&seite=rueckseite`,
      { state: { from: "/rueckseite" } },
    );
  };

  return (
    <main
      className="body-map-view-page"
      aria-labelledby="body-map-back-heading"
    >
      <div className="body-map-view-page__toolbar">
        <button
          type="button"
          className="body-map-view-page__back"
          onClick={() => navigate("/region-start")}
          aria-label={mb.backToHubAria}
        >
          <span className="body-map-view-page__back-chevron" aria-hidden>
            ←
          </span>{" "}
          {mb.backToHub}
        </button>
        <h1 id="body-map-back-heading" className="body-map-view-page__title">
          {mb.heading}
        </h1>
        <p className="body-map-view-page__disclaimer">{mb.inlineDisclaimer}</p>
      </div>
      <div className="body-map-svg-wrap body-map-view-page__svg-ltr">
        <svg
          viewBox="0 0 300 700"
          width="100%"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={mb.diagramAria}
        >
        
        <image
          href={rueckenBild}
          x="0"
          y="0"
          width="300"
          height="700"
          preserveAspectRatio="xMidYMid meet"
        />

        
        
       {/* 1 – Nacken (als Rechteck) */}
<rect
  x="134"
  y="76"
  width="42"
  height="30"
  fill="transparent" 
  stroke="transparent"
  strokeWidth="2"
  {...regionHitProps(goRegion, 'nacken')}
/>



        {/* 2 – Schultern */}
        <circle
          cx="95"
          cy="145"
          r="20"
          fill="transparent" 
  stroke="transparent"
          strokeWidth="2"
          {...regionHitProps(goRegion, 'schulterblatt_links')}
        />
        <circle
          cx="214"
          cy="145"
          r="20"
          fill="transparent" 
  stroke="transparent"
          strokeWidth="2"
          {...regionHitProps(goRegion, 'schulterblatt_rechts')}
        />

        {/* 3 – Rückenmitte (Wirbelsäule) als vertikales Rechteck */}
<rect
  x="147"
  y="107"
  width="16"
  height="172"
  fill="transparent" 
  stroke="transparent"
  strokeWidth="2"
  {...regionHitProps(goRegion, 'wirbelsaeule')}
/>
        

     {/* 4 – Nierenbereich (als Ellipse) */}
<ellipse
  cx="136"
  cy="236"
  rx="9"
  ry="14"
  fill="transparent" 
  stroke="transparent"
  strokeWidth="2"
  {...regionHitProps(goRegion, 'niere_links')}
/>
<ellipse
  cx="172"
  cy="237"
  rx="8"
  ry="14"
  fill="transparent" 
  stroke="transparent"
  strokeWidth="2"
  {...regionHitProps(goRegion, 'niere_rechts')}
/>
       

        {/* 5 – Lende/unterer Rücken */}
        <ellipse
  cx="125"
  cy="315"
  rx="24"
  ry="40"
  fill="transparent" 
  stroke="transparent"
  strokeWidth="2"
  {...regionHitProps(goRegion, 'becken_rechts')}
/>
<ellipse
  cx="180"
  cy="315"
  rx="24"
  ry="40"
  fill="transparent" 
  stroke="transparent"
  strokeWidth="2"
  {...regionHitProps(goRegion, 'becken_links')}
/>
        
        {/* 6 – Hinterkopf */}
<circle
  cx="155"
  cy="46"
  r="30"
  fill="transparent" 
  stroke="transparent"
  strokeWidth="2"
  {...regionHitProps(goRegion, 'hinterkopf')}
/>
<ellipse
  cx="127"
  cy="70"
  rx="4"
  ry="10"
  fill="transparent" 
  stroke="transparent"
  strokeWidth="2"
  {...regionHitProps(goRegion, 'ohr_links')}
/>

<ellipse
  cx="183"
  cy="70"
  rx="4"
  ry="10"
  fill="transparent" 
  stroke="transparent"
  strokeWidth="2"
  {...regionHitProps(goRegion, 'ohr_rechts')}
/>
{/*Linkes Bein}*/}
<ellipse
  cx="115"
  cy="510"
  rx="25"
  ry="150"
  fill="transparent" 
  stroke="transparent"
  {...regionHitProps(goRegion, 'bein_links')}
/>

{/*Rechtes Bein */}
<ellipse
  cx="185"
  cy="510"
  rx="25"
  ry="150"
  fill="transparent" 
  stroke="transparent"
  {...regionHitProps(goRegion, 'bein_rechts')}
/>


        </svg>
      </div>
    </main>
  );
}
