/**
 * Realtime output parsing regressions (run with node).
 * node client/src/features/liveMedicalTranslation/scripts/verifyRealtimeEventParsing.js
 */
import { summarizeRealtimeEvent } from "../utils/realtimeDiagnostics.js";
import { extractOriginalText, extractTranslatedText } from "../utils/webrtc.js";

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const responseOutputItemDone = {
  type: "response.output_item.done",
  item: {
    role: "assistant",
    content: [{ type: "text", text: "I have a headache." }],
  },
};

assert(
  extractTranslatedText(responseOutputItemDone) === "I have a headache.",
  "extracts translation from response.output_item.done",
);

const responseDone = {
  type: "response.done",
  response: {
    status: "completed",
    output: [
      {
        role: "assistant",
        content: [{ type: "audio", transcript: "Wie kann ich Ihnen helfen?" }],
      },
    ],
  },
};

assert(
  extractTranslatedText(responseDone) === "Wie kann ich Ihnen helfen?",
  "extracts translation from response.done output content",
);

const conversationItemDone = {
  type: "conversation.item.done",
  item: {
    role: "user",
    content: [
      {
        type: "input_audio",
        input_audio_transcription: {
          transcript: "Ich habe Kopfschmerzen.",
        },
      },
    ],
  },
};

assert(
  extractOriginalText(conversationItemDone) === "Ich habe Kopfschmerzen.",
  "extracts transcript from conversation.item.done",
);

const contentPartDone = {
  type: "response.content_part.done",
  part: {
    type: "text",
    text: "How can I help you?",
  },
};

assert(
  extractTranslatedText(contentPartDone) === "How can I help you?",
  "extracts translation from response.content_part.done part",
);

const summary = summarizeRealtimeEvent(responseDone);
assert(summary.type === "response.done", "summary keeps event type");
assert(summary.hasResponse === true, "summary tracks response presence");
assert(summary.responseStatus === "completed", "summary tracks response status");

console.log("verifyRealtimeEventParsing: OK");
