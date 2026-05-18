import crypto from "crypto";

export function generateAccessToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashAccessToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

export function verifyAccessToken(token, hash) {
  if (!token || !hash) return false;
  const a = hashAccessToken(token);
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}
