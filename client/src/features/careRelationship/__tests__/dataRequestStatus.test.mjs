import test from "node:test";
import assert from "node:assert/strict";
import { getMessages } from "../../../i18n/translations/index.js";
import { displayStatus, statusLabel, TERMINAL_STATUSES } from "../lib/dataRequestStatus.js";

const LANGS = ["de", "en", "fr", "it", "es", "ru"];

// Words that would claim an outcome the status cannot know: deletion,
// removal, a delivered export, success or a granted request.
const OUTCOME_CLAIM =
  /gelöscht|lösch|entfernt|erfolgreich|erfüllt|bereitgestellt|delet|remov|success|fulfil|granted|delivered|supprim|effac|réussi|cancell|elimina|rimoss|riuscit|borrad|suprim|elimin|éxito|удал|успеш|выполн/i;

test("every closed status — new and legacy — reads as 'answered'", () => {
  for (const s of ["answered", "completed", "rejected"]) assert.equal(displayStatus(s), "answered");
  assert.equal(displayStatus("submitted"), "submitted");
  assert.equal(displayStatus("in_review"), "in_review");
  assert.deepEqual([...TERMINAL_STATUSES].sort(), ["answered", "completed", "rejected"]);
});

test("patient and practice see Beantwortet for every closed request, in every language", () => {
  for (const lang of LANGS) {
    const m = getMessages(lang);
    for (const s of TERMINAL_STATUSES) {
      assert.equal(statusLabel(s, m.patientDataControl), m.patientDataControl.statusAnswered, `${lang} patient ${s}`);
      assert.equal(statusLabel(s, m.practiceDataRequests), m.practiceDataRequests.statusAnswered, `${lang} practice ${s}`);
    }
  }
  assert.equal(getMessages("de").patientDataControl.statusAnswered, "Beantwortet");
  assert.equal(getMessages("de").practiceDataRequests.statusAnswered, "Beantwortet");
  assert.equal(getMessages("de").practiceDataRequests.statusSubmitted, "Neu");
  assert.equal(getMessages("de").patientDataControl.statusSubmitted, "Eingereicht");
});

test("no status text, button or note claims deletion, a delivered export or success", () => {
  for (const lang of LANGS) {
    const m = getMessages(lang);
    const texts = {
      "patient.statusAnswered": m.patientDataControl.statusAnswered,
      "patient.answeredOn": m.patientDataControl.answeredOn,
      "patient.answeredRightsNote": m.patientDataControl.answeredRightsNote,
      "practice.statusAnswered": m.practiceDataRequests.statusAnswered,
      "practice.sendAnswer": m.practicePatients.dataRequestSendAnswer,
      "practice.answered": m.practicePatients.dataRequestAnswered,
      "practice.markInReview": m.practicePatients.dataRequestMarkInReview,
    };
    for (const [key, value] of Object.entries(texts)) {
      assert.ok(typeof value === "string" && value.trim(), `${lang} ${key} missing`);
      assert.doesNotMatch(value, OUTCOME_CLAIM, `${lang} ${key} claims an outcome: "${value}"`);
    }
  }
});

test("the rights note names no authority, region or country", () => {
  for (const lang of LANGS) {
    const note = getMessages(lang).patientDataControl.answeredRightsNote;
    assert.doesNotMatch(note, /BfDI|LfD|Bundes|Landes|CNIL|Garante|AEPD|Roskomnadzor|Deutschland|Germany|Bayern|Berlin/i, `${lang}: ${note}`);
  }
});
