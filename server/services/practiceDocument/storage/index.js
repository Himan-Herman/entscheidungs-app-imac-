/**
 * Practice document blob storage — swap LocalPracticeDocumentStorage for S3/R2 later.
 */
import { LocalPracticeDocumentStorage } from "./localStorage.js";

const backend = new LocalPracticeDocumentStorage();

export function getPracticeDocumentStorage() {
  return backend;
}
