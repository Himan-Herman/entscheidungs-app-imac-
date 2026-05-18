/**
 * Video provider abstraction — sandbox-first; no API keys in code.
 */

import crypto from "crypto";
import {
  isExternalVideoProviderEnabled,
  isVideoRecordingEnabled,
  isVideoSandboxEnabled,
} from "../../config/featureFlags.js";
import { generateAccessToken, hashAccessToken } from "../../utils/telemedicineTokens.js";

const PROVIDERS = new Set([
  "external_link",
  "sandbox",
  "jitsi",
  "daily",
  "twilio",
  "whereby",
  "zoom",
  "google_meet",
]);

function roomId() {
  return `msx-${crypto.randomBytes(8).toString("hex")}`;
}

function sandboxJitsiUrl(room) {
  return `https://meet.jit.si/MedScoutX-${room}`;
}

/**
 * @param {string} providerType
 */
export function getVideoAdapter(providerType) {
  const type = PROVIDERS.has(providerType) ? providerType : "sandbox";
  return {
    type,
    async createRoom(ctx) {
      if (type !== "external_link" && !isVideoSandboxEnabled() && !isExternalVideoProviderEnabled()) {
        return { ok: false, error: "video_sandbox_disabled" };
      }
      if (isVideoRecordingEnabled()) {
        return { ok: false, error: "recording_not_allowed_mvp" };
      }

      const rid = roomId();
      const joinToken = generateAccessToken();
      const hostToken = generateAccessToken();

      if (type === "external_link") {
        const externalUrl = String(ctx.externalUrl || "").trim();
        if (!externalUrl || !/^https:\/\//i.test(externalUrl)) {
          return { ok: false, error: "external_url_invalid" };
        }
        return {
          ok: true,
          providerRoomId: rid,
          joinUrlHash: hashAccessToken(joinToken),
          hostUrlHash: hashAccessToken(hostToken),
          joinUrl: externalUrl,
          hostUrl: externalUrl,
          joinToken,
          hostToken,
        };
      }

      const meetUrl = sandboxJitsiUrl(rid);
      return {
        ok: true,
        providerRoomId: rid,
        joinUrlHash: hashAccessToken(joinToken),
        hostUrlHash: hashAccessToken(hostToken),
        joinUrl: meetUrl,
        hostUrl: meetUrl,
        joinToken,
        hostToken,
      };
    },
    async getRoom() {
      return { ok: true, status: "planned" };
    },
    async revokeRoom() {
      return { ok: true, revoked: true };
    },
    getJoinUrl(room, token) {
      if (room.joinUrl && token && room.joinToken === token) return room.joinUrl;
      if (room.providerRoomId) return sandboxJitsiUrl(room.providerRoomId);
      return null;
    },
    getHostUrl(room, token) {
      if (room.hostUrl && token && room.hostToken === token) return room.hostUrl;
      if (room.providerRoomId) return sandboxJitsiUrl(room.providerRoomId);
      return null;
    },
    async checkStatus() {
      return { ok: true, status: "ready", recording: false };
    },
  };
}

export function listProviderTypes() {
  return [...PROVIDERS];
}
