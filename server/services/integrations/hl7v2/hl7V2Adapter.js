/**
 * HL7 v2 adapter — parse/build metadata only; no OBX interpretation or clinical scoring.
 */

const SEGMENT_SEP = /\r\n|\r|\n/;

/**
 * @param {string} raw
 */
export function parseHl7V2Message(raw) {
  const text = String(raw || "").trim();
  if (!text) return { ok: false, error: "empty_message" };
  const segments = text.split(SEGMENT_SEP).filter(Boolean);
  if (!segments.length) return { ok: false, error: "no_segments" };
  const msh = segments.find((s) => s.startsWith("MSH|"));
  if (!msh) return { ok: false, error: "missing_msh" };
  const fields = msh.split("|");
  const messageType = detectMessageType(msh);
  return {
    ok: true,
    segmentCount: segments.length,
    messageType,
    sendingApplication: String(fields[3] || "").slice(0, 80),
    sendingFacility: String(fields[4] || "").slice(0, 80),
    messageControlId: String(fields[10] || "").slice(0, 64),
    patientMetadata: extractPatientMetadata(segments),
    documentMetadata: extractDocumentMetadata(segments),
  };
}

/**
 * @param {string} mshSegment
 */
export function detectMessageType(mshSegment) {
  const fields = String(mshSegment || "").split("|");
  const typeField = fields[9] || "";
  const [msg, trigger] = typeField.split("^");
  return {
    raw: String(typeField).slice(0, 32),
    message: String(msg || "").slice(0, 16),
    trigger: String(trigger || "").slice(0, 16),
  };
}

/**
 * @param {string[]} segments
 */
export function extractPatientMetadata(segments) {
  const pid = segments.find((s) => s.startsWith("PID|"));
  if (!pid) return null;
  const f = pid.split("|");
  return {
    patientId: String(f[3] || "").split("^")[0].slice(0, 64),
    patientName: String(f[5] || "").slice(0, 120),
    birthDate: String(f[7] || "").slice(0, 16),
    administrativeSex: String(f[8] || "").slice(0, 8),
  };
}

/**
 * @param {string[]} segments
 */
export function extractDocumentMetadata(segments) {
  const obx = segments.filter((s) => s.startsWith("OBX|"));
  const txa = segments.find((s) => s.startsWith("TXA|"));
  if (!obx.length && !txa) return null;
  return {
    obxCount: obx.length,
    hasDocumentSegment: Boolean(txa),
    note: "OBX values are not interpreted — metadata counts only",
  };
}

/**
 * @param {{ messageType?: string, ackCode?: string }} opts
 */
export function buildBasicAck(opts = {}) {
  const now = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const msgType = opts.messageType || "ACK";
  const code = opts.ackCode || "AA";
  return [
    `MSH|^~\\&|MedScoutX|Sandbox|External|PVS|${now}||${msgType}^A01|${Date.now()}|P|2.5`,
    `MSA|${code}|${opts.messageControlId || "1"}`,
  ].join("\r");
}
