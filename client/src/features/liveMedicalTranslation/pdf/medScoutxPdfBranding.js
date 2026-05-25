/** MedScoutX PDF branding — logo load with text wordmark fallback. */

import medscoutLogo6Url from "../../../assets/img/medscout-logo6.png";

export const MEDSCOUT_PDF_LOGO_FILENAME = "medscout-logo6.png";

const LOGO_CANDIDATE_URLS = [
  medscoutLogo6Url,
  "/medscout-logo6.png",
  "/medscoutx-logo.png",
  "/medscoutx-logo.webp",
  "/medscoutx-logo.jpg",
];

/**
 * @param {string} src
 * @returns {Promise<{ dataUrl: string; naturalWidth: number; naturalHeight: number; source: string }>}
 */
function loadImageAsDataUrl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas_unavailable"));
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve({
          dataUrl: canvas.toDataURL("image/png"),
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          source: src,
        });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error(`image_load_failed:${src}`));
    img.src = src;
  });
}

/**
 * Resolve MedScoutX logo for PDF embedding. Returns null when no asset is available.
 * @returns {Promise<{ dataUrl: string; naturalWidth: number; naturalHeight: number; source: string } | null>}
 */
export async function resolveMedScoutxPdfLogo() {
  if (typeof document === "undefined" || typeof Image === "undefined") {
    return null;
  }

  for (const url of LOGO_CANDIDATE_URLS) {
    try {
      const loaded = await loadImageAsDataUrl(url);
      if (loaded?.dataUrl && loaded.naturalWidth > 0 && loaded.naturalHeight > 0) {
        return loaded;
      }
    } catch {
      /* try next candidate */
    }
  }

  return null;
}

/** @returns {string[]} */
export function getMedScoutxPdfLogoCandidateUrls() {
  return [...LOGO_CANDIDATE_URLS];
}

/**
 * Compute logo draw size in mm preserving aspect ratio.
 * @param {{ naturalWidth: number; naturalHeight: number }} logo
 * @param {{ maxWidthMm?: number; maxHeightMm?: number }} limits
 */
export function computePdfLogoSizeMm(logo, limits = {}) {
  const maxWidthMm = limits.maxWidthMm ?? 18;
  const maxHeightMm = limits.maxHeightMm ?? 18;
  const aspect = logo.naturalWidth / logo.naturalHeight;

  let widthMm = maxWidthMm;
  let heightMm = widthMm / aspect;

  if (heightMm > maxHeightMm) {
    heightMm = maxHeightMm;
    widthMm = heightMm * aspect;
  }

  return { widthMm, heightMm };
}

/**
 * @param {import("jspdf").jsPDF} doc
 * @param {{ pageWidth: number; margin: number; y: number; logo: { dataUrl: string; naturalWidth: number; naturalHeight: number } | null }} opts
 * @returns {{ usedFallback: boolean; logoHeightMm: number; logoWidthMm: number }}
 */
export function drawMedScoutxPdfBrandMark(doc, opts) {
  const { pageWidth, margin, y, logo } = opts;
  const rightX = pageWidth - margin;

  if (logo?.dataUrl) {
    const { widthMm, heightMm } = computePdfLogoSizeMm(logo, {
      maxWidthMm: 18,
      maxHeightMm: 18,
    });
    doc.addImage(
      logo.dataUrl,
      "PNG",
      rightX - widthMm,
      y,
      widthMm,
      heightMm,
      undefined,
      "SLOW",
    );
    return { usedFallback: false, logoHeightMm: heightMm, logoWidthMm: widthMm };
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(14, 116, 144);
  doc.text("MedScoutX", rightX, y + 5.5, { align: "right" });
  doc.setTextColor(15, 23, 42);

  return { usedFallback: true, logoHeightMm: 8, logoWidthMm: 32 };
}
