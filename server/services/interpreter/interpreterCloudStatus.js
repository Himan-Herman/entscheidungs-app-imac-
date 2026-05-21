import {
  INTERPRETER_CLOUD_CONSENT_VERSION,
  INTERPRETER_CLOUD_SCHEMA_VERSION,
} from "../../config/interpreterCloudEnv.js";
import { isInterpreterCloudEncryptionConfigured } from "../../utils/interpreterCloudCrypto.js";

export function getCloudStorageStatus() {
  const ready = isInterpreterCloudEncryptionConfigured();
  return {
    cloudAvailable: ready,
    encryptionReady: ready,
    consentVersion: INTERPRETER_CLOUD_CONSENT_VERSION,
    schemaVersion: INTERPRETER_CLOUD_SCHEMA_VERSION,
  };
}
