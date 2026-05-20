/**
 * @typedef {'body_map'|'symptom_check'} PatientChatKind
 * @typedef {'draft'|'active'|'completed'} PatientChatSessionStatus
 *
 * @typedef {object} PatientChatSession
 * @property {string} id
 * @property {PatientChatKind} kind
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string} [title]
 * @property {PatientChatSessionStatus} status
 * @property {string | null} threadId
 * @property {object[]} verlauf
 * @property {object | null} summary
 * @property {'de'|'en'} language
 * @property {string} [organ]
 * @property {string} [organLabel]
 * @property {string} [seite]
 * @property {string | null} [organHint]
 *
 * @typedef {object} PatientChatBucket
 * @property {string | null} activeId
 * @property {PatientChatSession[]} items
 *
 * @typedef {object} PatientChatStore
 * @property {number} version
 * @property {PatientChatBucket} bodyMap
 * @property {PatientChatBucket} symptomCheck
 */

export {};
