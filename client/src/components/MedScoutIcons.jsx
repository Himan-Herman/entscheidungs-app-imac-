// src/components/MedScoutIcons.jsx
import React from "react";

const baseProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function IconSymptomChat() {
  return (
    <svg {...baseProps} aria-hidden="true">
      <path d="M5 5h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-5l-3 3-3-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
      <path d="M8 10h8" />
      <path d="M8 13h4" />
    </svg>
  );
}

export function IconBodyMap() {
  return (
    <svg {...baseProps} aria-hidden="true">
      {/* Kopf */}
      <circle cx="12" cy="6.5" r="2.2" />
      {/* Schultern / Brust */}
      <path d="M8.5 10.5c1.1.9 2.2 1.3 3.5 1.3s2.4-.4 3.5-1.3" />
      {/* Rumpf */}
      <path d="M9 10.5v3.2c0 1.2-.5 2.1-1.2 3l-0.6.8" />
      <path d="M15 10.5v3.2c0 1.2.5 2.1 1.2 3l0.6.8" />
      {/* Beine angedeutet */}
      <path d="M10.2 20l1-3.2h1.6l1 3.2" />
    </svg>
  );
}

export function IconImageAnalysis() {
  return (
    <svg {...baseProps} aria-hidden="true">
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="M10 9l-2 3 2 2 3-3 3 4" />
      <circle cx="9" cy="9" r="1.1" />
    </svg>
  );
}

export function IconAbo() {
  return (
    <svg {...baseProps} aria-hidden="true">
      {/* Schild */}
      <path d="M12 4l6 2v5c0 3.1-1.9 5.9-4.8 7.2L12 19l-1.2-.8C7.9 16.9 6 14.1 6 11V6l6-2z" />
      {/* kleiner Stern im Schild */}
      <path d="M12 9.2l0.8 1.2 1.4.2-1 .9.2 1.4-1.4-.7-1.4.7.2-1.4-1-.9 1.4-.2L12 9.2z" />
    </svg>
  );
}
