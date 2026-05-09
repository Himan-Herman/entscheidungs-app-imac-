import React, { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import {
  readBodyMapConsent,
  rememberBodyMapSelection,
} from "../features/bodyMap/bodyMapSession";
import "../styles/BodyMapPages.css";
import koerperBild from "../assets/img/Koerper_Vorderseite.png";

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

export default function Koerperkarte() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = useMemo(() => {
    const b = getMessages(language);
    return b.bodyMap ?? getMessages("en").bodyMap;
  }, [language]);
  const mf = t.mapFront;

  useEffect(() => {
    if (!readBodyMapConsent()) {
      navigate("/region-start", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    document.title = mf.pageTitle;
  }, [mf.pageTitle]);

  const goRegion = (organId) => {
    rememberBodyMapSelection(organId, "vorderseite");
    navigate(
      `/koerpersymptom?organ=${encodeURIComponent(organId)}&seite=vorderseite`,
      { state: { from: "/koerperregionen" } },
    );
  };

  return (
    <main
      className="body-map-view-page"
      aria-labelledby="body-map-front-heading"
    >
      <div className="body-map-view-page__toolbar">
        <button
          type="button"
          className="body-map-view-page__back"
          onClick={() => navigate("/region-start")}
          aria-label={mf.backToHubAria}
        >
          ← {mf.backToHub}
        </button>
        <h1 id="body-map-front-heading" className="body-map-view-page__title">
          {mf.heading}
        </h1>
        <p className="body-map-view-page__disclaimer">{mf.inlineDisclaimer}</p>
      </div>
      <div className="body-map-svg-wrap">
        <svg
          viewBox="0 0 300 700"
          width="100%"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={mf.diagramAria}
        >
  <image
    href={koerperBild}
    x="0"
    y="0"
    width="300"
    height="700"
    preserveAspectRatio="xMidYMid meet"
  />

{/* Herz erledit */}
<circle
    cx="161"
    cy="179"
    r="16"
    fill="transparent"
    stroke="transparent"
    strokeWidth="2"
    {...regionHitProps(goRegion, 'herz')}
  />

  {/* Lunge rechts erledigt */}
  <ellipse
    cx="135"
    cy="150"
    rx="10"
    ry="22"
    fill="transparent"
    stroke="transparent"
    strokeWidth="2"
    {...regionHitProps(goRegion, 'rechte Lunge')}
  />
  {/* leber erledigt */}
  <ellipse
    cx="150"
    cy="210"
    rx="28"
    ry="16"
    fill="transparent"
    stroke="transparent"
    strokeWidth="2"
    {...regionHitProps(goRegion, 'Leber')}
  />
   <ellipse
    cx="128"
    cy="225"
    rx="10"
    ry="16"
    fill="transparent"
    stroke="transparent"
    strokeWidth="2"
    {...regionHitProps(goRegion, 'Leber')}
  />
  {/* Lunge links erledigt */}
  <ellipse
    cx="182"
    cy="152"
    rx="11"
    ry="25"
    fill="transparent"
    stroke="transparent"
    strokeWidth="2"
    {...regionHitProps(goRegion, 'linke Lunge')}
  />

  
  {/* Kopf erledigt */}
<circle
  cx="160"
  cy="34"
  r="32"
  fill="transparent"
  stroke="transparent"
  strokeWidth="2"
  {...regionHitProps(goRegion, 'kopf')}
/>

{/* Hals erledigt*/} 
<ellipse
  cx="160"
  cy="92"
  rx="5"
  ry="25"
  fill="transparent"
  stroke="transparent"
  strokeWidth="2"
  {...regionHitProps(goRegion, 'hals')}
/>

{/* Magen erledigt */}
<ellipse
  cx="172"
  cy="243"
  rx="10"
  ry="8"
  fill="transparent"
  stroke="transparent"
  strokeWidth="2"
  {...regionHitProps(goRegion, 'magen')}
/>
<ellipse
  cx="184"
  cy="234"
  rx="8"
  ry="6"
  fill="transparent"
  stroke="transparent"
  strokeWidth="2"
  {...regionHitProps(goRegion, 'magen')}
/>
<ellipse
  cx="191"
  cy="224"
  rx="6"
  ry="5"
  fill="transparent"
  stroke="transparent"
  strokeWidth="2"
  {...regionHitProps(goRegion, 'magen')}
/>
<ellipse
  cx="197"
  cy="215"
  rx="5"
  ry="4"
  fill="transparent"
  stroke="transparent"
  strokeWidth="2"
  {...regionHitProps(goRegion, 'magen')}
/>
<ellipse
  cx="185"
  cy="210"
  rx="5"
  ry="4"
  fill="transparent"
  stroke="transparent"
  strokeWidth="2"
  {...regionHitProps(goRegion, 'magen')}
/>
{/* Darm erledigt*/}
<rect
  x="118"
  y="260"
  width="85"
  height="52"
  rx="15"
  ry="15"
  fill="transparent"
  stroke="transparent"
  strokeWidth="2"
  {...regionHitProps(goRegion, 'darm')}
/>



{/* Gallenblase erledigt */}
<ellipse
  cx="142"
  cy="234"
  rx="6"
  ry="6"
  fill="transparent"
  stroke="transparent"
  strokeWidth="2"
  {...regionHitProps(goRegion, 'gallenblase')}
/>

{/* Bauchspeicheldrüse erledigt */}
<rect
  x="150"
  y="226"
  width="16"
  height="9"
  fill="transparent"
  stroke="transparent"
  strokeWidth="2"
  {...regionHitProps(goRegion, 'bauchspeicheldrüse')}
/>
<rect
  x="166"
  y="224"
  width="10"
  height="9"
  fill="transparent"
  stroke="transparent"
  strokeWidth="2"
  {...regionHitProps(goRegion, 'bauchspeicheldrüse')}
/>
<rect
  x="176"
  y="218"
  width="8"
  height="9"
  fill="transparent"
  stroke="transparent"
  strokeWidth="2"
  {...regionHitProps(goRegion, 'bauchspeicheldrüse')}
/>
<rect
  x="170"
  y="221"
  width="6"
  height="7"
  fill="transparent"
  stroke="transparent"
  strokeWidth="2"
  {...regionHitProps(goRegion, 'bauchspeicheldrüse')}
/>
<rect
  x="149"
  y="235"
  width="13"
  height="10"
  fill="transparent"
  stroke="transparent"
  strokeWidth="2"
  {...regionHitProps(goRegion, 'bauchspeicheldrüse')}
/>



{/* Niere links erledigt */}
<ellipse
  cx="132"
  cy="250"
  rx="8"
  ry="10"
  fill="transparent"
  stroke="transparent"
  strokeWidth="2"
  {...regionHitProps(goRegion, 'niere_links')}
/>

{/* Niere rechts erledigt */}
<ellipse
  cx="190"
  cy="250"
  rx="8"
  ry="10"
  fill="transparent"
  stroke="transparent"
  strokeWidth="2"
  {...regionHitProps(goRegion, 'niere_rechts')}
/>
<ellipse
  cx="194"
  cy="237"
  rx="3"
  ry="6"
  fill="transparent"
  stroke="transparent"
  strokeWidth="2"
  {...regionHitProps(goRegion, 'niere_rechts')}
/>
{/* Blase erledigt */}
<circle
  cx="160"
  cy="325"
  r="13"
  fill="transparent"
  stroke="transparent"
  strokeWidth="2"
  {...regionHitProps(goRegion, 'blase')}
/>

{/* Uterus/Prostata erledigt */}
<rect
  x="155"
  y="338.9"
  width="10"
  height="20"
  fill="transparent"
  stroke="transparent"
  strokeWidth="1"
  {...regionHitProps(goRegion, 'uterus_prostata')}
/>

{/* Brustdrüse rechts erledigt */}
<ellipse
  cx="128"
  cy="187"
  rx="16"
  ry="16"
  fill="transparent"
  stroke="transparent"
  strokeWidth="1"
  {...regionHitProps(goRegion, 'brust_rechts')}
/>

{/* Brustdrüse links erledigt */}
<ellipse
  cx="192"
  cy="187"
  rx="16"
  ry="16"
  fill="transparent"
  stroke="transparent"
  strokeWidth="1"
  {...regionHitProps(goRegion, 'brust_links')}
/>

{/* Schulter rechts erledigt */}
<ellipse
  cx="89"
  cy="160"
  rx="12"
  ry="25"
  fill="transparent"
  stroke="transparent"
  strokeWidth="1"
  {...regionHitProps(goRegion, 'schulter_rechts')}
/>
<ellipse
  cx="109"
  cy="132"
  rx="18"
  ry="9"
  fill="transparent"
  stroke="transparent"
  strokeWidth="1"
  {...regionHitProps(goRegion, 'schulter_rechts')}
/>

{/* Schulter links erledigt */}
<ellipse
  cx="229"
  cy="160"
  rx="12"
  ry="25"
  fill="transparent"
  stroke="transparent"
  strokeWidth="1"
  {...regionHitProps(goRegion, 'schulter_links')}
/>
<ellipse
  cx="209"
  cy="132"
  rx="18"
  ry="9"
  fill="transparent"
  stroke="transparent"
  strokeWidth="1"
  {...regionHitProps(goRegion, 'schulter_links')}
/>

{/* Ellbogen rechts erledigt */}
<circle
  cx="88"
  cy="240"
  r="15"
  fill="transparent"
  stroke="transparent"
  {...regionHitProps(goRegion, 'ellenbogen_rechts')}
/>

{/* Ellbogen links erledigt */}
<circle
  cx="228"
  cy="240"
  r="15"
  fill="transparent"
  stroke="transparent"
  {...regionHitProps(goRegion, 'ellenbogen_links')}
/>

{/* Hand rechts erledigt */}
<ellipse
  cx="75"
  cy="363"
  rx="11"
  ry="33"
  fill="transparent"
  stroke="transparent"
  {...regionHitProps(goRegion, 'hand_rechts')}
/>

{/* Unterarm links */}
<ellipse
  cx="245"
  cy="353"
  rx="1"
  ry="33"
  fill="transparent"
  stroke="transparent"
  {...regionHitProps(goRegion, 'Unterarm_links')}
/>

{/* Unterarm rechts */}
<ellipse
  cx="79"
  cy="292"
  rx="16"
  ry="38"
  fill="transparent"
  stroke="transparent"
  {...regionHitProps(goRegion, 'Unterarm_rechts')}
/>

{/* Hand links erledigt */}
<ellipse
  cx="245"
  cy="363"
  rx="11"
  ry="33"
  fill="transparent"
  stroke="transparent"
  {...regionHitProps(goRegion, 'hand_links')}
/>

{/* Oberarm links erledigt */}
<ellipse
  cx="225"
  cy="205"
  rx="16"
  ry="20"
  fill="transparent"
  stroke="transparent"
  {...regionHitProps(goRegion, 'Oberarm_links')}
/>

{/* Oberarm rechts erledigt */}
<ellipse
  cx="90"
  cy="205"
  rx="16"
  ry="20"
  fill="transparent"
  stroke="transparent"
  {...regionHitProps(goRegion, 'Oberarm_rechts')}
/>

{/* Oberschenkel rechts erledigt */}
<ellipse
  cx="127"
  cy="400"
  rx="29"
  ry="78"
  fill="transparent"
  stroke="transparent"
  {...regionHitProps(goRegion, 'Oberschenkel_rechts')}
/>

{/* Oberschenkel links erledigt */}
<ellipse
  cx="194"
  cy="400"
  rx="29"
  ry="78"
  fill="transparent"
  stroke="transparent"
  {...regionHitProps(goRegion, 'Oberschenkel_rechts')}
/>

{/* Knie rechts erledigt */}
<circle
  cx="130"
  cy="499"
  r="22"
  fill="transparent"
  stroke="transparent"
  {...regionHitProps(goRegion, 'knie_rechts')}
/>

{/* Knie links erledigt */}
<circle
  cx="190"
  cy="499"
  r="22"
  fill="transparent"
  stroke="transparent"
  {...regionHitProps(goRegion, 'knie_links')}
/>

{/* Unterschenkel rechts erledigt */}
<ellipse
  cx="130"
  cy="592"
  rx="22"
  ry="71"
  fill="transparent"
  stroke="transparent"
  {...regionHitProps(goRegion, 'Unteschenkel_rechts')}
/>

{/* Unterschenkel links erledigt */}
<ellipse
  cx="189"
  cy="592"
  rx="22"
  ry="71"
  fill="transparent"
  stroke="transparent"
  {...regionHitProps(goRegion, 'Unterschenkel_links')}
/>

{/* Fuß rechts erledigt */}
<ellipse
  cx="130"
  cy="684"
  rx="19"
  ry="21"
  fill="transparent"
  stroke="transparent"
  {...regionHitProps(goRegion, 'fuss_rechts')}
/>

{/* Fuß links erledigt */}
<ellipse
  cx="185"
  cy="684"
  rx="19"
  ry="21"
  fill="transparent"
  stroke="transparent"
  {...regionHitProps(goRegion, 'fuss_links')}
/>



        </svg>
      </div>
    </main>
  );
}
