/**
 * Encrypt webhook signing secrets at rest (AES-256-GCM).
 * Set PRACTICE_INTEGRATION_MASTER_KEY to 64-char hex (32 bytes).
 * Never log plaintext secrets or decryption output.
 */

import crypto from "crypto";

function getMasterKeyBuf() {
  const hex = process.env.PRACTICE_INTEGRATION_MASTER_KEY;
  if (typeof hex !== "string" || !/^[0-9a-fA-F]{64}$/.test(hex.trim())) {
    return null;
  }
  return Buffer.from(hex.trim(), "hex");
}

export function isIntegrationEncryptionConfigured() {
  return getMasterKeyBuf() !== null;
}

/** SHA-256 fingerprint (hex) — proves a secret was configured; cannot be used for signing. */
export function fingerprintWebhookSecret(plainSecret) {
  return crypto
    .createHash("sha256")
    .update(String(plainSecret || ""), "utf8")
    .digest("hex");
}

/**
 * @param {string} plainSecret
 * @returns {string | null} base64 ciphertext or null if master key missing
 */
export function encryptWebhookSecretForStorage(plainSecret) {
  const key = getMasterKeyBuf();
  if (!key || !plainSecret) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([
    cipher.update(String(plainSecret), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

/**
 * @param {string} b64 from encryptWebhookSecretForStorage
 * @returns {string | null}
 */
export function decryptWebhookSecretFromStorage(b64) {
  const key = getMasterKeyBuf();
  if (!key || !b64) return null;
  try {
    const buf = Buffer.from(String(b64), "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    return null;
  }
}
