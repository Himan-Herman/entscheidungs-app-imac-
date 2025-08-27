import React from "react";
import { useNavigate } from "react-router-dom";
import koerperBild from '../assets/img/Koerper_Vorderseite.png';


export default function Koerperkarte() {
  const navigate = useNavigate();
 

const openChat = (organId) => {
  navigate(`/koerpersymptom?organ=${organId}&seite=vorderseite`, {
    state: { from: "/koerperkarte/vorderseite" },
  });
};

  return (
    <div>
      <h2 style={{ textAlign: "center" }}>Körperkarte_Vorderseite</h2>

      <svg
  viewBox="0 0 300 700"
  width="100%"
  height="700"
  preserveAspectRatio="xMidYMid meet"
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
    onClick={() => navigate("/koerpersymptom?organ=herz")}

    style={{ cursor: 'pointer' }}
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
    onClick={() => navigate('/koerpersymptom?organ=rechte Lunge')}
    style={{ cursor: 'pointer' }}
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
    onClick={() => openChat("Leber")}
    style={{ cursor: 'pointer' }}
  />
   <ellipse
    cx="128"
    cy="225"
    rx="10"
    ry="16"
    fill="transparent"
    stroke="transparent"
    strokeWidth="2"
    onClick={() => navigate('/koerpersymptom?organ=Leber')}
    style={{ cursor: 'pointer' }}
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
    onClick={() => navigate('/koerpersymptom?organ=linke Lunge')}
    style={{ cursor: 'pointer' }}
  />

  
  {/* Kopf erledigt */}
<circle
  cx="160"
  cy="34"
  r="32"
  fill="transparent"
  stroke="transparent"
  strokeWidth="2"
  onClick={() => navigate('/koerpersymptom?organ=kopf')}
  style={{ cursor: 'pointer' }}
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
  onClick={() => navigate('/koerpersymptom?organ=hals')}
  style={{ cursor: 'pointer' }}
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
  onClick={() => navigate('/koerpersymptom?organ=magen')}
  style={{ cursor: 'pointer' }}
/>
<ellipse
  cx="184"
  cy="234"
  rx="8"
  ry="6"
  fill="transparent"
  stroke="transparent"
  strokeWidth="2"
  onClick={() => navigate('/koerpersymptom?organ=magen')}
  style={{ cursor: 'pointer' }}
/>
<ellipse
  cx="191"
  cy="224"
  rx="6"
  ry="5"
  fill="transparent"
  stroke="transparent"
  strokeWidth="2"
  onClick={() => navigate('/koerpersymptom?organ=magen')}
  style={{ cursor: 'pointer' }}
/>
<ellipse
  cx="197"
  cy="215"
  rx="5"
  ry="4"
  fill="transparent"
  stroke="transparent"
  strokeWidth="2"
  onClick={() => navigate('/koerpersymptom?organ=magen')}
  style={{ cursor: 'pointer' }}
/>
<ellipse
  cx="185"
  cy="210"
  rx="5"
  ry="4"
  fill="transparent"
  stroke="transparent"
  strokeWidth="2"
  onClick={() => navigate('/koerpersymptom?organ=magen')}
  style={{ cursor: 'pointer' }}
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
  onClick={() => navigate('/koerpersymptom?organ=darm')}
  style={{ cursor: 'pointer' }}
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
  onClick={() => navigate('/koerpersymptom?organ=gallenblase')}
  style={{ cursor: 'pointer' }}
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
  onClick={() => navigate('/koerpersymptom?organ=bauchspeicheldrüse')}
  style={{ cursor: 'pointer' }}
/>
<rect
  x="166"
  y="224"
  width="10"
  height="9"
  fill="transparent"
  stroke="transparent"
  strokeWidth="2"
  onClick={() => navigate('/koerpersymptom?organ=bauchspeicheldrüse')}
  style={{ cursor: 'pointer' }}
/>
<rect
  x="176"
  y="218"
  width="8"
  height="9"
  fill="transparent"
  stroke="transparent"
  strokeWidth="2"
  onClick={() => navigate('/koerpersymptom?organ=bauchspeicheldrüse')}
  style={{ cursor: 'pointer' }}
/>
<rect
  x="170"
  y="221"
  width="6"
  height="7"
  fill="transparent"
  stroke="transparent"
  strokeWidth="2"
  onClick={() => navigate('/koerpersymptom?organ=bauchspeicheldrüse')}
  style={{ cursor: 'pointer' }}
/>
<rect
  x="149"
  y="235"
  width="13"
  height="10"
  fill="transparent"
  stroke="transparent"
  strokeWidth="2"
  onClick={() => navigate('/koerpersymptom?organ=bauchspeicheldrüse')}
  style={{ cursor: 'pointer' }}
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
  onClick={() => navigate('/koerpersymptom?organ=niere_links')}
  style={{ cursor: 'pointer' }}
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
  onClick={() => navigate('/koerpersymptom?organ=iere_rechts')}
  style={{ cursor: 'pointer' }}
/>
<ellipse
  cx="194"
  cy="237"
  rx="3"
  ry="6"
  fill="transparent"
  stroke="transparent"
  strokeWidth="2"
  onClick={() => navigate('/koerpersymptom?organ=niere_rechts')}
  style={{ cursor: 'pointer' }}
/>
{/* Blase erledigt */}
<circle
  cx="160"
  cy="325"
  r="13"
  fill="transparent"
  stroke="transparent"
  strokeWidth="2"
  onClick={() => navigate('/koerpersymptom?organ=blase')}
  style={{ cursor: 'pointer' }}
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
  onClick={() => navigate('/koerpersymptom?organ=uterus_prostata')}
  style={{ cursor: 'pointer' }}
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
  onClick={() => navigate('/koerpersymptom?organ=brust_rechts')}
  style={{ cursor: 'pointer' }}
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
  onClick={() => navigate('/koerpersymptom?organ=brust_links')}
  style={{ cursor: 'pointer' }}
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
  onClick={() => navigate('/koerpersymptom?organ=schulter_rechts')}
  style={{ cursor: 'pointer' }}
/>
<ellipse
  cx="109"
  cy="132"
  rx="18"
  ry="9"
  fill="transparent"
  stroke="transparent"
  strokeWidth="1"
  onClick={() => navigate('/koerpersymptom?organ=schulter_rechts')}
  style={{ cursor: 'pointer' }}
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
  onClick={() => navigate('/koerpersymptom?organ=schulter_links')}
  style={{ cursor: 'pointer' }}
/>
<ellipse
  cx="209"
  cy="132"
  rx="18"
  ry="9"
  fill="transparent"
  stroke="transparent"
  strokeWidth="1"
  onClick={() => navigate('/koerpersymptom?organ=schulter_links')}
  style={{ cursor: 'pointer' }}
/>

{/* Ellbogen rechts erledigt */}
<circle
  cx="88"
  cy="240"
  r="15"
  fill="transparent"
  stroke="transparent"
  onClick={() => navigate('/koerpersymptom?organ=ellenbogen_rechts')}
  style={{ cursor: 'pointer' }}
/>

{/* Ellbogen links erledigt */}
<circle
  cx="228"
  cy="240"
  r="15"
  fill="transparent"
  stroke="transparent"
  onClick={() => navigate('/koerpersymptom?organ=ellenbogen_links')}
  style={{ cursor: 'pointer' }}
/>

{/* Hand rechts erledigt */}
<ellipse
  cx="75"
  cy="363"
  rx="11"
  ry="33"
  fill="transparent"
  stroke="transparent"
  onClick={() => navigate('/koerpersymptom?organ=hand_rechts')}
  style={{ cursor: 'pointer' }}
/>

{/* Unterarm links */}
<ellipse
  cx="245"
  cy="353"
  rx="1"
  ry="33"
  fill="transparent"
  stroke="transparent"
  onClick={() => navigate('/koerpersymptom?organ=Unterarm_links')}
  style={{ cursor: 'pointer' }}
/>

{/* Unterarm rechts */}
<ellipse
  cx="79"
  cy="292"
  rx="16"
  ry="38"
  fill="transparent"
  stroke="transparent"
  onClick={() => navigate('/koerpersymptom?organ=Unterarm_rechts')}
  style={{ cursor: 'pointer' }}
/>

{/* Hand links erledigt */}
<ellipse
  cx="245"
  cy="363"
  rx="11"
  ry="33"
  fill="transparent"
  stroke="transparent"
  onClick={() => navigate('/koerpersymptom?organ=hand_links')}
  style={{ cursor: 'pointer' }}
/>

{/* Oberarm links erledigt */}
<ellipse
  cx="225"
  cy="205"
  rx="16"
  ry="20"
  fill="transparent"
  stroke="transparent"
  onClick={() => navigate('/koerpersymptom?organ=Oberarm_links')}
  style={{ cursor: 'pointer' }}
/>

{/* Oberarm rechts erledigt */}
<ellipse
  cx="90"
  cy="205"
  rx="16"
  ry="20"
  fill="transparent"
  stroke="transparent"
  onClick={() => navigate('/koerpersymptom?organ=Oberarm_rechts')}
  style={{ cursor: 'pointer' }}
/>

{/* Oberschenkel rechts erledigt */}
<ellipse
  cx="127"
  cy="400"
  rx="29"
  ry="78"
  fill="transparent"
  stroke="transparent"
  onClick={() => navigate('/koerpersymptom?organ=Oberschenkel_rechts')}
  style={{ cursor: 'pointer' }}
/>

{/* Oberschenkel links erledigt */}
<ellipse
  cx="194"
  cy="400"
  rx="29"
  ry="78"
  fill="transparent"
  stroke="transparent"
  onClick={() => navigate('/koerpersymptom?organ=Oberschenkel_rechts')}
  style={{ cursor: 'pointer' }}
/>

{/* Knie rechts erledigt */}
<circle
  cx="130"
  cy="499"
  r="22"
  fill="transparent"
  stroke="transparent"
  onClick={() => navigate('/koerpersymptom?organ=knie_rechts')}
  style={{ cursor: 'pointer' }}
/>

{/* Knie links erledigt */}
<circle
  cx="190"
  cy="499"
  r="22"
  fill="transparent"
  stroke="transparent"
  onClick={() => navigate('/koerpersymptom?organ=knie_links')}
  style={{ cursor: 'pointer' }}
/>

{/* Unterschenkel rechts erledigt */}
<ellipse
  cx="130"
  cy="592"
  rx="22"
  ry="71"
  fill="transparent"
  stroke="transparent"
  onClick={() => navigate('/koerpersymptom?organ=Unteschenkel_rechts')}
  style={{ cursor: 'pointer' }}
/>

{/* Unterschenkel links erledigt */}
<ellipse
  cx="189"
  cy="592"
  rx="22"
  ry="71"
  fill="transparent"
  stroke="transparent"
  onClick={() => navigate('/koerpersymptom?organ=Unterschenkel_links')}
  style={{ cursor: 'pointer' }}
/>

{/* Fuß rechts erledigt */}
<ellipse
  cx="130"
  cy="684"
  rx="19"
  ry="21"
  fill="transparent"
  stroke="transparent"
  onClick={() => navigate('/koerpersymptom?organ=fuss_rechts')}
  style={{ cursor: 'pointer' }}
/>

{/* Fuß links erledigt */}
<ellipse
  cx="185"
  cy="684"
  rx="19"
  ry="21"
  fill="transparent"
  stroke="transparent"
  onClick={() => navigate('/koerpersymptom?organ=fuss_links')}
  style={{ cursor: 'pointer' }}
/>



</svg>

    </div>
  );
}
