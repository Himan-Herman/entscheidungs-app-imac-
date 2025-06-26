import React from "react";
import { useNavigate } from "react-router-dom";

export default function Koerperkarte() {
  const navigate = useNavigate();

  return (
    <div>
      <h2>Körperkarte – Vorderseite</h2>

      <svg
  version="1.1"
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 300 700"
  width="300"
  height="700"
  style={{ maxWidth: "100%" }}
>
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
</svg>

    </div>
  );
}
