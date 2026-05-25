/**
 * ASR transcription event helpers (run with node).
 * node client/src/features/liveMedicalTranslation/scripts/verifyAsrTranscription.js
 */
import {
  isInputTranscriptionCompletedEvent,
  isInputTranscriptionFailedEvent,
  LIVE_TRANSLATION_ORIGINAL_BUFFER_MS,
  summarizeTranscriptionEvent,
} from "../utils/asrTranscription.js";
import { extractOriginalText } from "../utils/webrtc.js";

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

assert(
  isInputTranscriptionCompletedEvent({
    type: "conversation.item.input_audio_transcription.completed",
  }),
  "recognizes completed event",
);

assert(
  isInputTranscriptionFailedEvent({
    type: "conversation.item.input_audio_transcription.failed",
  }),
  "recognizes failed event",
);

const completed = extractOriginalText({
  type: "conversation.item.input_audio_transcription.completed",
  transcript: "Ich habe Kopfschmerzen.",
});

assert(completed === "Ich habe Kopfschmerzen.", "extracts input transcript from completed event");

const meta = summarizeTranscriptionEvent({
  type: "conversation.item.input_audio_transcription.completed",
  transcript: "How can I help you?",
  language: "en",
});

assert(meta.hasTranscript === true, "meta hasTranscript");
assert(meta.transcriptLength === completed.length || meta.transcriptLength > 0, "meta length");
assert(meta.type === "conversation.item.input_audio_transcription.completed", "meta type");
assert(!("transcript" in meta), "meta does not include transcript text");

assert(
  LIVE_TRANSLATION_ORIGINAL_BUFFER_MS >= 1000 && LIVE_TRANSLATION_ORIGINAL_BUFFER_MS <= 2500,
  "buffer window in expected conservative range",
);

console.log("verifyAsrTranscription: OK");
