/**
 * Medical Interpreter cloud payload encryption (AES-256-GCM).
 *
 * Production: set INTERPRETER_CLOUD_MASTER_KEY to 64-char hex (32 bytes).
 * Without a valid key, cloud session writes fail closed (503).
 *
 * Pattern aligned with server/utils/integrationCrypto.js — separate key namespace.
 */

import crypto from "crypto";

const ENC_VERSION = 1;

function getMasterKeyBuf() {
  const hex = process.env.INTERPRETER_CLOUD_MASTER_KEY;
  if (typeof hex !== "string" || !/^[0-9a-fA-F]{64}$/.test(hex.trim())) {
    return null;
  }
  return Buffer.from(hex.trim(), "hex");
}

export function isInterpreterCloudEncryptionConfigured() {
  return getMasterKeyBuf() !== null;
}

/**
 * SHA-256 of canonical JSON (integrity check; not a secret).
 * @param {string} canonicalJson
 */
export function checksumInterpreterPayload(canonicalJson) {
  return crypto
    .createHash("sha256")
    .update(String(canonicalJson || ""), "utf8")
    .digest("hex");
}

/**
 * @param {string} plaintextUtf8
 * @param {{ userId: string, sessionId: string }} context AAD binding
 * @returns {{ payloadEnc: string, checksumSha256: string } | null}
 */
export function encryptInterpreterCloudPayload(plaintextUtf8, context) {
  const key = getMasterKeyBuf();
  if (!key || !plaintextUtf8 || !context?.userId || !context?.sessionId) {
    return null;
  }

  const checksumSha256 = checksumInterpreterPayload(plaintextUtf8);
  const iv = crypto.randomBytes(12);
  const aad = Buffer.from(
    `${ENC_VERSION}:${context.userId}:${context.sessionId}`,
    "utf8",
  );
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad);
  const enc = Buffer.concat([
    cipher.update(String(plaintextUtf8), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const blob = Buffer.concat([
    Buffer.from([ENC_VERSION]),
    iv,
    tag,
    enc,
  ]);
  return {
    payloadEnc: blob.toString("base64"),
    checksumSha256,
  };
}

/**
 * @param {string} payloadEncB64
 * @param {{ userId: string, sessionId: string }} context
 * @returns {string | null} plaintext UTF-8
 */
export function decryptInterpreterCloudPayload(payloadEncB64, context) {
  const key = getMasterKeyBuf();
  if (!key || !payloadEncB64 || !context?.userId || !context?.sessionId) {
    return null;
  }
  try {
    const buf = Buffer.from(String(payloadEncB64), "base64");
    const version = buf[0];
    if (version !== ENC_VERSION) return null;
    const iv = buf.subarray(1, 13);
    const tag = buf.subarray(13, 29);
    const data = buf.subarray(29);
    const aad = Buffer.from(
      `${version}:${context.userId}:${context.sessionId}`,
      "utf8",
    );
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    return null;
  }
}
