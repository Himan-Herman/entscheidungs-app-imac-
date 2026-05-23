/**
 * @typedef {'draft'|'active'|'ended'} InterpreterSessionStatus
 * @typedef {'draft'|'confirmed'|'translated'|'blocked'|'error'} InterpreterTurnStatus
 * @typedef {'patient'|'doctor'} InterpreterSpeaker
 */

/**
 * @typedef {Object} InterpreterInviteContext
 * @property {string} practiceDisplayName
 * @property {string} linkedAt — ISO timestamp when patient continued from invite
 * @property {'practice_invite'} source
 * @property {boolean} [sharingConsentGranted] — always false until a future consent phase
 */

/**
 * @typedef {Object} InterpreterProfileSnapshot
 * @property {string} [firstName]
 * @property {string} [lastName]
 * @property {string} [dateOfBirth]
 * @property {string} [email]
 * @property {string} [phone]
 */

/**
 * @typedef {Object} InterpreterTurn
 * @property {string} turnId
 * @property {InterpreterSpeaker} speaker
 * @property {string} [speakerLabel]
 * @property {string} sourceLanguage
 * @property {string} targetLanguage
 * @property {string} [timestamp]
 * @property {string} [originalTranscript]
 * @property {string} originalText
 * @property {string} [translatedText]
 * @property {string} [simplifiedText]
 * @property {'high'|'medium'|'low'} [confidence]
 * @property {string} [translationDirection] — e.g. "de->en"
 * @property {boolean} [translationUncertain]
 * @property {boolean} [terminologyWarning]
 * @property {boolean} [unclearSource]
 * @property {string} createdAt
 * @property {string} [editedAt]
 * @property {boolean} [edited]
 * @property {InterpreterTurnStatus} status
 */

/**
 * @typedef {Object} InterpreterSession
 * @property {string} sessionId
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string} [endedAt]
 * @property {InterpreterSessionStatus} status
 * @property {string} patientLanguage
 * @property {string} doctorLanguage
 * @property {string} [patientName]
 * @property {string} [conversationTitle]
 * @property {string} [doctorName]
 * @property {string} [practiceName]
 * @property {string} [specialty]
 * @property {string} [appointmentDateTime]
 * @property {boolean} profileConsentUsed
 * @property {boolean} storageConsent
 * @property {InterpreterProfileSnapshot} [profileSnapshot]
 * @property {import('./constants/cloud.js').InterpreterCloudSyncStatus} [cloudSyncStatus]
 * @property {string} [cloudSyncedAt] — ISO timestamp of last successful cloud save
 * @property {InterpreterTurn[]} turns
 * @property {InterpreterInviteContext} [inviteContext] — practice link metadata only; no token
 */

/**
 * @typedef {Object} InterpreterSessionStore
 * @property {number} version
 * @property {string|null} activeSessionId
 * @property {InterpreterSession[]} sessions
 */

export {};
