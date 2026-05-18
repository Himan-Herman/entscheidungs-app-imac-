import {
  hasPracticePermission,
  PERMISSIONS,
} from "../../utils/practicePermissions.js";
import { PATIENT_EXPORT_TYPES, PRACTICE_EXPORT_TYPES } from "./exportConstants.js";

/**
 * @param {'patient' | 'practice'} actorRole
 * @param {string} type
 */
export function isValidExportType(actorRole, type) {
  const t = String(type || "").trim();
  if (actorRole === "patient") return PATIENT_EXPORT_TYPES.has(t);
  if (actorRole === "practice") return PRACTICE_EXPORT_TYPES.has(t);
  return false;
}

/**
 * @param {string} role
 * @param {string} type
 */
export function canPracticeExportType(role, type) {
  if (!PRACTICE_EXPORT_TYPES.has(type)) return false;
  if (!hasPracticePermission(role, PERMISSIONS.PATIENT_LINKS_READ)) return false;

  switch (type) {
    case "documents_list":
      return hasPracticePermission(role, PERMISSIONS.DOCUMENTS_READ);
    case "medication_plan":
      return hasPracticePermission(role, PERMISSIONS.MEDICATION_READ);
    case "data_requests":
      return hasPracticePermission(role, PERMISSIONS.DATA_REQUESTS_MANAGE);
    case "patient_summary":
    case "activity":
      return true;
    default:
      return false;
  }
}
