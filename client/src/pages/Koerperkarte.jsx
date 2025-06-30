import React from "react";
import { useNavigate } from "react-router-dom";
import koerperBild from '../assets/img/Koerper_Vorderseite.png';


export default function Koerperkarte() {
  const navigate = useNavigate();

  return (
    <div>
      <h2 style={{ textAlign: "center" }}>Körperkarte – Vorderseite</h2>

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


  {/* Herz */}
  <circle
    cx="150"
    cy="200"
    r="30"
    fill="red"
    stroke="black"
    strokeWidth="2"
    onClick={() => navigate('/?organ=herz')}
    style={{ cursor: 'pointer' }}
  />

  {/* Lunge */}
  <circle
    cx="110"
    cy="160"
    r="25"
    fill="lightblue"
    stroke="black"
    strokeWidth="2"
    onClick={() => navigate('/?organ=lunge')}
    style={{ cursor: 'pointer' }}
  />

  {/* Leber */}
  <ellipse
    cx="180"
    cy="260"
    rx="35"
    ry="20"
    fill="brown"
    stroke="black"
    strokeWidth="2"
    onClick={() => navigate('/?organ=leber')}
    style={{ cursor: 'pointer' }}
  />
  {/* Kopf */}
<circle
  cx="150"
  cy="100"
  r="25"
  fill="peachpuff"
  stroke="black"
  strokeWidth="2"
  onClick={() => navigate('/?organ=kopf')}
  style={{ cursor: 'pointer' }}
/>

{/* Hals */}
<ellipse
  cx="150"
  cy="135"
  rx="12"
  ry="18"
  fill="orange"
  stroke="black"
  strokeWidth="2"
  onClick={() => navigate('/?organ=hals')}
  style={{ cursor: 'pointer' }}
/>

{/* Magen */}
<ellipse
  cx="130"
  cy="300"
  rx="25"
  ry="15"
  fill="gold"
  stroke="black"
  strokeWidth="2"
  onClick={() => navigate('/?organ=magen')}
  style={{ cursor: 'pointer' }}
/>

{/* Darm */}
<rect
  x="115"
  y="330"
  width="70"
  height="50"
  rx="15"
  ry="15"
  fill="#8B4513"
  stroke="black"
  strokeWidth="2"
  onClick={() => navigate('/?organ=darm')}
  style={{ cursor: 'pointer' }}
/>

{/* Leber */}
<ellipse
  cx="180" 
  cy="260"
  rx="35"
  ry="20" 
  fill="brown"
  stroke="black" 
  strokeWidth="2" 
  onClick={() => navigate('/?organ=leber')} 
  style={{ cursor: 'pointer' }}
/>

{/* Gallenblase */}
<ellipse
  cx="200"
  cy="285"
  rx="10"
  ry="6"
  fill="green"
  stroke="black"
  strokeWidth="2"
  onClick={() => navigate('/?organ=gallenblase')}
  style={{ cursor: 'pointer' }}
/>

{/* Bauchspeicheldrüse */}
<rect
  x="135"
  y="310"
  width="40"
  height="12"
  fill="violet"
  stroke="black"
  strokeWidth="2"
  onClick={() => navigate('/?organ=bauchspeicheldrüse')}
  style={{ cursor: 'pointer' }}
/>

{/* Milz */}
<circle
  cx="95"
  cy="290"
  r="10"
  fill="blue"
  stroke="black"
  strokeWidth="2"
  onClick={() => navigate('/?organ=milz')}
  style={{ cursor: 'pointer' }}
/>

{/* Niere links */}
<ellipse
  cx="110"
  cy="340"
  rx="12"
  ry="18"
  fill="crimson"
  stroke="black"
  strokeWidth="2"
  onClick={() => navigate('/?organ=niere_links')}
  style={{ cursor: 'pointer' }}
/>

{/* Niere rechts */}
<ellipse
  cx="190"
  cy="340"
  rx="12"
  ry="18"
  fill="crimson"
  stroke="black"
  strokeWidth="2"
  onClick={() => navigate('/?organ=niere_rechts')}
  style={{ cursor: 'pointer' }}
/>

{/* Blase */}
<circle
  cx="150"
  cy="420"
  r="12"
  fill="gold"
  stroke="black"
  strokeWidth="2"
  onClick={() => navigate('/?organ=blase')}
  style={{ cursor: 'pointer' }}
/>

{/* Uterus/Prostata */}
<rect
  x="140"
  y="445"
  width="20"
  height="12"
  fill="black"
  stroke="white"
  strokeWidth="1"
  onClick={() => navigate('/?organ=uterus_prostata')}
  style={{ cursor: 'pointer' }}
/>

{/* Brustdrüse links */}
<ellipse
  cx="130"
  cy="220"
  rx="10"
  ry="14"
  fill="pink"
  stroke="black"
  strokeWidth="1"
  onClick={() => navigate('/?organ=brust_links')}
  style={{ cursor: 'pointer' }}
/>

{/* Brustdrüse rechts */}
<ellipse
  cx="170"
  cy="220"
  rx="10"
  ry="14"
  fill="pink"
  stroke="black"
  strokeWidth="1"
  onClick={() => navigate('/?organ=brust_rechts')}
  style={{ cursor: 'pointer' }}
/>

{/* Schulter links */}
<circle
  cx="90"
  cy="130"
  r="12"
  fill="orange"
  stroke="black"
  strokeWidth="1"
  onClick={() => navigate('/?organ=schulter_links')}
  style={{ cursor: 'pointer' }}
/>

{/* Schulter rechts */}
<circle
  cx="210"
  cy="130"
  r="12"
  fill="orange"
  stroke="black"
  strokeWidth="1"
  onClick={() => navigate('/?organ=schulter_rechts')}
  style={{ cursor: 'pointer' }}
/>

{/* Ellbogen links */}
<circle
  cx="70"
  cy="200"
  r="8"
  fill="lightgray"
  stroke="black"
  onClick={() => navigate('/?organ=ellenbogen_links')}
  style={{ cursor: 'pointer' }}
/>

{/* Ellbogen rechts */}
<circle
  cx="230"
  cy="200"
  r="8"
  fill="lightgray"
  stroke="black"
  onClick={() => navigate('/?organ=ellenbogen_rechts')}
  style={{ cursor: 'pointer' }}
/>

{/* Hand links */}
<circle
  cx="60"
  cy="300"
  r="10"
  fill="lightgray"
  stroke="black"
  onClick={() => navigate('/?organ=hand_links')}
  style={{ cursor: 'pointer' }}
/>

{/* Hand rechts */}
<circle
  cx="240"
  cy="300"
  r="10"
  fill="lightgray"
  stroke="black"
  onClick={() => navigate('/?organ=hand_rechts')}
  style={{ cursor: 'pointer' }}
/>

{/* Knie links */}
<circle
  cx="120"
  cy="550"
  r="10"
  fill="#808080"
  stroke="black"
  onClick={() => navigate('/?organ=knie_links')}
  style={{ cursor: 'pointer' }}
/>

{/* Knie rechts */}
<circle
  cx="180"
  cy="550"
  r="10"
  fill="#808080"
  stroke="black"
  onClick={() => navigate('/?organ=knie_rechts')}
  style={{ cursor: 'pointer' }}
/>

{/* Fuß links */}
<ellipse
  cx="120"
  cy="620"
  rx="12"
  ry="6"
  fill="#d4af37"
  stroke="black"
  onClick={() => navigate('/?organ=fuss_links')}
  style={{ cursor: 'pointer' }}
/>

{/* Fuß rechts */}
<ellipse
  cx="180"
  cy="620"
  rx="12"
  ry="6"
  fill="#d4af37"
  stroke="black"
  onClick={() => navigate('/?organ=fuss_rechts')}
  style={{ cursor: 'pointer' }}
/>
<ellipse
  cx="150"
  cy="480"
  rx="15"
  ry="10"
  fill="#cc66ff"
  stroke="black"
  strokeWidth="1"
  onClick={() => navigate('/?organ=genitalbereich')}
  style={{ cursor: 'pointer' }}
/>


</svg>

    </div>
  );
}
