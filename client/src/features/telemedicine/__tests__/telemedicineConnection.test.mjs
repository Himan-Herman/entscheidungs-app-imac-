/**
 * Integration / contract tests for the Praxis ↔ Patient telemedicine connection.
 *
 * Practice and patient share ONE TelemedicineSession (server: telemedicineService.js).
 * These tests assert the cross-boundary contract that makes that link work:
 *
 *   1. Shared status vocabulary: every session status is rendered by BOTH the
 *      practice and the patient UI, in all 5 supported languages.
 *   2. Shared session shape: the fields each side reads off the session object
 *      drive the same derived state, so doctor and patient never disagree about
 *      whether a session is joinable / closed.
 *   3. Waiting-room handover: a patient who joins becomes visible to the doctor
 *      via the participants array.
 *
 * Run: node --test client/src/features/telemedicine/__tests__/telemedicineConnection.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { getMessages } from "../../../i18n/translations/index.js";
import {
  SESSION_STATUSES,
  PRESENT_PARTICIPANT_STATUSES,
  canPatientJoin,
  isTerminalStatus,
  statusLabelKey,
  participantLabelKey,
  waitingPatients,
} from "../telemedicineSessionUtils.js";

const LANGS = ["en", "de", "it", "fr", "es"];

test("every session status is translated for BOTH practice and patient in all 5 languages", () => {
  for (const lang of LANGS) {
    const m = getMessages(lang);
    for (const status of SESSION_STATUSES) {
      const key = statusLabelKey(status);
      assert.ok(
        m.practiceTelemedicine?.[key],
        `practiceTelemedicine.${key} missing for "${lang}"`,
      );
      assert.ok(
        m.patientTelemedicine?.[key],
        `patientTelemedicine.${key} missing for "${lang}"`,
      );
    }
  }
});

test("participant status labels exist for the doctor's waiting-room view in all 5 languages", () => {
  for (const lang of LANGS) {
    const m = getMessages(lang);
    for (const status of [...PRESENT_PARTICIPANT_STATUSES, "left", "invited"]) {
      const key = participantLabelKey(status);
      assert.ok(m.practiceTelemedicine?.[key], `practiceTelemedicine.${key} missing for "${lang}"`);
    }
  }
});

test("the practice hub card label exists in all 5 languages", () => {
  for (const lang of LANGS) {
    assert.ok(
      getMessages(lang).practiceOverview?.cardTelemedicine,
      `practiceOverview.cardTelemedicine missing for "${lang}"`,
    );
  }
});

test("doctor and patient derive the same joinable/closed state from one shared session", () => {
  const now = new Date("2026-06-23T12:00:00Z").getTime();

  // An active, consented session with a live link: patient can join, doctor sees it open.
  const live = {
    status: "active",
    linkRevoked: false,
    consentGranted: true,
    hasJoinLink: true,
    scheduledEndAt: null,
  };
  assert.equal(canPatientJoin(live, now), true);
  assert.equal(isTerminalStatus(live.status), false, "doctor side: still open");

  // Once the doctor completes the session, BOTH sides treat it as closed.
  const completed = { ...live, status: "completed" };
  assert.equal(canPatientJoin(completed, now), false);
  assert.equal(isTerminalStatus(completed.status), true);

  // If the doctor revokes the link, the patient can no longer join.
  const revoked = { ...live, linkRevoked: true };
  assert.equal(canPatientJoin(revoked, now), false);
});

test("waiting-room handover: a patient who joins is surfaced to the doctor", () => {
  // Server creates a TelemedicineParticipant(role:patient) when the patient joins.
  const sessionAfterPatientJoined = {
    status: "waiting",
    participants: [
      { id: "p1", role: "patient", status: "waiting", userId: "u-patient" },
      { id: "d1", role: "practice", status: "joined", userId: "u-doctor" },
    ],
  };
  const visibleToDoctor = waitingPatients(sessionAfterPatientJoined.participants);
  assert.equal(visibleToDoctor.length, 1);
  assert.equal(visibleToDoctor[0].userId, "u-patient");

  // Before the patient acts, the doctor's waiting list is empty.
  assert.deepEqual(waitingPatients([{ id: "d1", role: "practice", status: "joined" }]), []);
});
