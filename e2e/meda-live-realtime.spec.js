/**
 * Meda Live (practice realtime interpreter) — engine regression tests.
 *
 * Drives the REAL page and the REAL useRealtimeSession hook. Only the edges are
 * replaced: a scripted fake RTCPeerConnection/DataChannel (server events are
 * injected exactly as the Realtime API would send them), a synthetic
 * microphone, and stubbed HTTP. No backend, no database, no provider, no cost.
 *
 * Needs only the Vite dev server (baseURL, default http://localhost:5173).
 *
 * Run: npx playwright test e2e/meda-live-realtime.spec.js
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "@playwright/test";

const PAGE = "/practice/meda-realtime?practiceId=e2e-practice";

/** Installed before any app code runs. */
function installFakes() {
  localStorage.setItem("medscout_token", "e2e-fake-token");
  localStorage.setItem("medscout_user_id", "e2e-user");
  localStorage.setItem("medscout_language", "de");
  localStorage.setItem("medscout_language_source", "manual");
  localStorage.setItem("medscout_theme", "light");

  // Synthetic microphone: a quiet tone through a gain node the test can drive.
  navigator.mediaDevices.getUserMedia = async (constraints) => {
    window.__gumConstraints = constraints;
    const ctx = new AudioContext();
    try { await ctx.resume(); } catch { /* not needed for a synthetic source */ }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.002;
    const dest = ctx.createMediaStreamDestination();
    osc.connect(gain).connect(dest);
    osc.start();
    window.__micGain = gain;
    return dest.stream;
  };

  // Scripted peer: records what the client sends, lets the test inject events.
  window.__sent = [];
  class FakePeerConnection {
    constructor() {
      this.iceGatheringState = "complete";
      this.iceConnectionState = "connected";
      this.localDescription = null;
    }
    addTrack() {}
    createDataChannel() {
      const dc = {
        readyState: "open",
        send: (payload) => window.__sent.push(JSON.parse(payload)),
        close() {},
      };
      window.__dc = dc;
      setTimeout(() => dc.onopen && dc.onopen(), 30);
      return dc;
    }
    async createOffer() { return { type: "offer", sdp: "v=0" }; }
    async setLocalDescription(d) { this.localDescription = d; }
    async setRemoteDescription() {}
    addEventListener() {}
    removeEventListener() {}
    close() {}
  }
  window.RTCPeerConnection = FakePeerConnection;
  window.__emit = (ev) => window.__dc?.onmessage?.({ data: JSON.stringify(ev) });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ sessionResponse?: (body: any) => object, onSessionRequest?: (body: any) => void }} [opts]
 */
async function openMeda(page, opts = {}) {
  await page.addInitScript(installFakes);
  // Routes match in reverse registration order: catch-all first. Only real API
  // paths — a glob like **/api/** would also swallow Vite modules (/src/api/…).
  const isApi = (path) => (url) => new URL(url).pathname.startsWith(path);
  await page.route(isApi("/api/"), (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }));
  await page.route(isApi("/api/meda-realtime/session"), async (route) => {
    const body = route.request().postDataJSON();
    opts.onSessionRequest?.(body);
    const extra = opts.sessionResponse ? opts.sessionResponse(body) : {};
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        clientSecret: "e2e-secret",
        model: "gpt-realtime",
        patientLanguage: body.patientLanguage,
        practiceLanguage: body.practiceLanguage,
        ...extra,
      }),
    });
  });
  await page.route("https://api.openai.com/**", (route) =>
    route.fulfill({ status: 201, contentType: "application/sdp", body: "v=0" }));

  await page.goto(PAGE);
  await expect(page.locator(".mrt-page")).toBeVisible({ timeout: 20_000 });
}

async function startSession(page) {
  await page.fill("#mrt-person-name", "Anna Schmidt");
  for (const id of ["mrt-consent-audio", "mrt-consent-context", "mrt-consent-medical", "mrt-consent-patient"]) {
    await page.check(`#${id}`);
  }
  await page.click(".mrt-btn--start");
  await expect(page.locator(".mrt-session-bar")).toBeVisible();
}

/** Speech segment up to its transcript, each event in its own task. */
async function speak(page, itemId, transcript) {
  for (const ev of [
    { type: "input_audio_buffer.speech_started", item_id: itemId, audio_start_ms: 0 },
    { type: "input_audio_buffer.speech_stopped", item_id: itemId, audio_end_ms: 900 },
    { type: "input_audio_buffer.committed", item_id: itemId },
    { type: "conversation.item.input_audio_transcription.completed", item_id: itemId, transcript },
  ]) {
    await page.evaluate((e) => window.__emit(e), ev);
  }
}

/** Several server events delivered in ONE task — before React applies state. */
async function burst(page, events) {
  await page.evaluate((evs) => { for (const e of evs) window.__emit(e); }, events);
}

function turnRows(page) {
  return page.locator(".mrt-conversation .mrt-turn");
}

async function readTurns(page) {
  return turnRows(page).evaluateAll((rows) => rows.map((r) => ({
    role: r.querySelector(".mrt-turn-role")?.textContent?.trim() ?? null,
    original: r.querySelector(".mrt-turn-original .mrt-turn-text")?.textContent?.trim() ?? null,
    translation: r.querySelector(".mrt-turn-text--translation")?.textContent?.trim() ?? null,
    unclear: Boolean(r.querySelector(".mrt-turn-text--unclear")),
  })));
}

const done = (id, transcript) => [
  { type: "response.audio_transcript.done", response_id: id, transcript },
  { type: "response.done", response: { id, status: "completed", output: [{ content: [{ transcript }] }] } },
];

test.describe("Meda Live — response ↔ turn mapping", () => {
  test("normal translation flow: one turn, streamed translation lands on it", async ({ page }) => {
    await openMeda(page);
    await startSession(page);

    await speak(page, "item_a", "Ich habe seit drei Tagen starke Kopfschmerzen");
    await page.evaluate(() => window.__emit({ type: "response.created", response: { id: "resp_a" } }));
    for (const delta of ["I have had ", "a severe headache ", "for three days."]) {
      await page.evaluate((d) => window.__emit({ type: "response.audio_transcript.delta", response_id: "resp_a", delta: d }), delta);
    }
    await burst(page, done("resp_a", "I have had a severe headache for three days."));

    await expect(turnRows(page)).toHaveCount(1);
    await expect.poll(async () => (await readTurns(page))[0]).toMatchObject({
      role: "Patient",
      translation: "I have had a severe headache for three days.",
      unclear: false,
    });
  });

  test("two quick turns, alternating speakers, response.done before React applies state", async ({ page }) => {
    await openMeda(page);
    await startSession(page);

    // A (patient, DE) is transcribed; the server starts A's response and the
    // client renders it — the response is now mapped to A.
    await speak(page, "item_a", "Ich habe auch Fieber seit gestern");
    await page.evaluate(() => window.__emit({ type: "response.created", response: { id: "resp_a" } }));
    await expect(page.locator(".mrt-status-badge")).toBeVisible();

    // B (practice, EN) speaks right after and is transcribed while A's answer is still open.
    await speak(page, "item_b", "How high was the fever and did you measure it?");
    await expect(turnRows(page)).toHaveCount(2);

    // A's transcript and response.done arrive in ONE task — response.done drops the
    // mapping before React has applied the transcript update.
    await burst(page, done("resp_a", "I have also had a fever since yesterday."));

    // B's own response.
    await page.evaluate(() => window.__emit({ type: "response.created", response: { id: "resp_b" } }));
    await burst(page, done("resp_b", "Wie hoch war das Fieber und haben Sie es gemessen?"));

    await expect.poll(async () => (await readTurns(page)).map((t) => t.translation)).toEqual([
      "I have also had a fever since yesterday.",
      "Wie hoch war das Fieber und haben Sie es gemessen?",
    ]);
    const [a, b] = await readTurns(page);
    expect(a.role).toBe("Patient");
    expect(b.role).toBe("Praxis / Arzt");
    expect(a.unclear).toBe(false);
    expect(b.unclear).toBe(false);
  });

  test("whole response in one burst while the next speaker is already committed", async ({ page }) => {
    await openMeda(page);
    await startSession(page);

    await speak(page, "item_a", "Ich nehme Ibuprofen 400 zweimal am Tag");
    // B has started and been committed, its transcript is not there yet.
    for (const ev of [
      { type: "input_audio_buffer.speech_started", item_id: "item_b", audio_start_ms: 0 },
      { type: "input_audio_buffer.speech_stopped", item_id: "item_b", audio_end_ms: 900 },
      { type: "input_audio_buffer.committed", item_id: "item_b" },
    ]) await page.evaluate((e) => window.__emit(e), ev);

    // A's complete response in a single task.
    await burst(page, [
      { type: "response.created", response: { id: "resp_a" } },
      { type: "response.audio_transcript.delta", response_id: "resp_a", delta: "I take ibuprofen 400 twice a day." },
      ...done("resp_a", "I take ibuprofen 400 twice a day."),
    ]);
    await page.evaluate(() => window.__emit({
      type: "conversation.item.input_audio_transcription.completed",
      item_id: "item_b", transcript: "Do you have any allergies to medication?",
    }));
    await page.evaluate(() => window.__emit({ type: "response.created", response: { id: "resp_b" } }));
    await burst(page, done("resp_b", "Haben Sie Allergien gegen Medikamente?"));

    await expect.poll(async () => (await readTurns(page)).map((t) => t.translation)).toEqual([
      "I take ibuprofen 400 twice a day.",
      "Haben Sie Allergien gegen Medikamente?",
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Client-gated responses: the server answered responseGating 'client', so the
// model stays silent until the client has checked each segment and sent
// response.create itself.
// ─────────────────────────────────────────────────────────────────────────────

const GATED = { sessionResponse: () => ({ responseGating: "client" }) };

async function sent(page, type) {
  return page.evaluate((t) => window.__sent.filter((e) => e.type === t), type);
}

async function emit(page, ev) {
  await page.evaluate((e) => window.__emit(e), ev);
}

/** Speech up to the commit — no transcript yet. */
async function speakUntilCommitted(page, itemId) {
  for (const ev of [
    { type: "input_audio_buffer.speech_started", item_id: itemId, audio_start_ms: 0 },
    { type: "input_audio_buffer.speech_stopped", item_id: itemId, audio_end_ms: 900 },
    { type: "input_audio_buffer.committed", item_id: itemId },
  ]) await emit(page, ev);
}

async function transcribe(page, itemId, transcript) {
  await emit(page, { type: "conversation.item.input_audio_transcription.completed", item_id: itemId, transcript });
}

/** The client's response.create for a turn, answered by the scripted server. */
async function answer(page, turnKey, responseId, translation) {
  await expect.poll(async () => (await sent(page, "response.create"))
    .map((e) => e.response?.metadata?.turn_key)).toContain(String(turnKey));
  await emit(page, { type: "response.created", response: { id: responseId, metadata: { turn_key: String(turnKey) } } });
  await emit(page, { type: "response.audio_transcript.delta", response_id: responseId, delta: translation });
  await burst(page, done(responseId, translation));
}

test.describe("Meda Live — client-gated responses", () => {
  test("new client opts in; an old server's answer keeps the server-driven flow", async ({ page }) => {
    let body = null;
    await openMeda(page, { onSessionRequest: (b) => { body = b; } });
    await startSession(page);
    expect(body).toMatchObject({ patientLanguage: "de", practiceLanguage: "en", clientGating: true });

    // No responseGating in the answer (old server) → the client never asks itself.
    await speak(page, "item_a", "Ich habe seit drei Tagen starke Kopfschmerzen");
    expect(await sent(page, "response.create")).toEqual([]);
  });

  test("order: speech → transcript → check → response.create → translation on the right turn", async ({ page }) => {
    await openMeda(page, GATED);
    await startSession(page);

    await speakUntilCommitted(page, "item_a");
    await expect(turnRows(page)).toHaveCount(1);
    // The model must not be asked before the transcript has been checked.
    expect(await sent(page, "response.create")).toEqual([]);

    await transcribe(page, "item_a", "Ich habe seit drei Tagen starke Kopfschmerzen");
    const [create] = await sent(page, "response.create");
    expect(create.response.metadata.turn_key).toBe("1");

    await answer(page, 1, "resp_a", "I have had a severe headache for three days.");
    await expect.poll(async () => (await readTurns(page))[0]).toMatchObject({
      role: "Patient",
      original: "Ich habe seit drei Tagen starke Kopfschmerzen",
      translation: "I have had a severe headache for three days.",
      unclear: false,
    });
    expect(await sent(page, "conversation.item.delete")).toEqual([]);
  });

  test("a clearly third language: no card, no translation, removed from context, no words in debug", async ({ page }) => {
    await openMeda(page, GATED);
    await startSession(page);

    const spanish = "Tengo dolor de cabeza desde hace tres días y también fiebre";
    await speakUntilCommitted(page, "item_x");
    await transcribe(page, "item_x", spanish);

    await expect(turnRows(page)).toHaveCount(0);
    expect(await sent(page, "response.create")).toEqual([]);
    expect((await sent(page, "conversation.item.delete")).map((e) => e.item_id)).toEqual(["item_x"]);
    await expect(page.locator(".mrt-gate-notice")).toContainText("Andere Sprache erkannt");

    // Debug view: the event is there, the words are not.
    await page.click(".mrt-debug-toggle");
    await expect(page.locator(".mrt-debug-log")).toContainText("meda.gate");
    await expect(page.locator("body")).not.toContainText("dolor de cabeza");

    // The conversation goes on normally afterwards.
    await speakUntilCommitted(page, "item_b");
    await transcribe(page, "item_b", "How long have you had the pain?");
    await answer(page, 2, "resp_b", "Wie lange haben Sie die Schmerzen schon?");
    await expect.poll(async () => readTurns(page)).toMatchObject([
      { role: "Praxis / Arzt", translation: "Wie lange haben Sie die Schmerzen schon?" },
    ]);
  });

  test("two quick turns: the second waits for the first, both land on their own turn", async ({ page }) => {
    await openMeda(page, GATED);
    await startSession(page);

    await speakUntilCommitted(page, "item_a");
    await transcribe(page, "item_a", "Ich habe auch Fieber seit gestern");
    await emit(page, { type: "response.created", response: { id: "resp_a", metadata: { turn_key: "1" } } });

    // B is accepted while A's translation is still running → queued, not sent.
    await speakUntilCommitted(page, "item_b");
    await transcribe(page, "item_b", "How high was the fever and did you measure it?");
    expect((await sent(page, "response.create")).map((e) => e.response.metadata.turn_key)).toEqual(["1"]);

    // A finishes in one burst (before React applies state) → B is requested.
    await burst(page, done("resp_a", "I have also had a fever since yesterday."));
    await answer(page, 2, "resp_b", "Wie hoch war das Fieber und haben Sie es gemessen?");

    await expect.poll(async () => (await readTurns(page)).map((t) => [t.role, t.translation])).toEqual([
      ["Patient", "I have also had a fever since yesterday."],
      ["Praxis / Arzt", "Wie hoch war das Fieber und haben Sie es gemessen?"],
    ]);
  });

  test("short answers are kept and translated, without a guessed speaker", async ({ page }) => {
    await openMeda(page, GATED);
    await startSession(page);

    await speakUntilCommitted(page, "item_a");
    await transcribe(page, "item_a", "Paracetamol 500");
    await answer(page, 1, "resp_a", "Paracetamol 500");

    await expect.poll(async () => (await readTurns(page))[0]).toMatchObject({
      original: "Paracetamol 500",
      translation: "Paracetamol 500",
    });
    const [a] = await readTurns(page);
    expect(["Patient", "Praxis / Arzt"]).not.toContain(a.role);
    expect(await sent(page, "conversation.item.delete")).toEqual([]);
  });

  test("an unattributed segment the interpreter refuses is removed again", async ({ page }) => {
    await openMeda(page, GATED);
    await startSession(page);

    await speakUntilCommitted(page, "item_a");
    await transcribe(page, "item_a", "Grazie mille");
    await expect.poll(async () => (await sent(page, "response.create")).length).toBe(1);
    await emit(page, { type: "response.created", response: { id: "resp_a", metadata: { turn_key: "1" } } });
    const refusal = "Bitte wiederholen Sie die Aussage klar in einer der ausgewählten Gesprächssprachen.";
    await page.evaluate((t) => {
      window.__emit({ type: "response.audio_transcript.done", response_id: "resp_a", transcript: t });
      window.__emit({ type: "response.done", response: { id: "resp_a", status: "completed", output: [{ id: "out_a", content: [{ transcript: t }] }] } });
    }, refusal);

    await expect(turnRows(page)).toHaveCount(0);
    expect((await sent(page, "conversation.item.delete")).map((e) => e.item_id)).toEqual(["item_a", "out_a"]);
    await expect(page.locator(".mrt-gate-notice")).toContainText("Andere Sprache erkannt");
  });

  test("a failed bookkeeping call does not end the consultation", async ({ page }) => {
    await openMeda(page, GATED);
    await startSession(page);

    await speakUntilCommitted(page, "item_x");
    await transcribe(page, "item_x", "Tengo dolor de cabeza desde hace tres días y también fiebre");
    const [del] = await sent(page, "conversation.item.delete");
    await emit(page, { type: "error", error: { type: "invalid_request_error", code: "item_not_found", message: "x", event_id: del.event_id } });

    await expect(page.locator(".mrt-session-bar")).toBeVisible();
    await expect(page.locator(".mrt-error")).toHaveCount(0);

    await speakUntilCommitted(page, "item_b");
    await transcribe(page, "item_b", "Ich habe seit drei Tagen starke Kopfschmerzen");
    await answer(page, 2, "resp_b", "I have had a severe headache for three days.");
    await expect.poll(async () => (await readTurns(page))[0]?.translation).toBe("I have had a severe headache for three days.");
  });

  test("a failed response request is retried once", async ({ page }) => {
    await openMeda(page, GATED);
    await startSession(page);

    await speakUntilCommitted(page, "item_a");
    await transcribe(page, "item_a", "Ich habe seit drei Tagen starke Kopfschmerzen");
    const [first] = await sent(page, "response.create");
    await emit(page, { type: "error", error: { type: "invalid_request_error", code: "x", message: "x", event_id: first.event_id } });

    await expect.poll(async () => (await sent(page, "response.create")).length).toBe(2);
    await answer(page, 1, "resp_a", "I have had a severe headache for three days.");
    await expect.poll(async () => (await readTurns(page))[0]?.translation).toBe("I have had a severe headache for three days.");
    await expect(page.locator(".mrt-error")).toHaveCount(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Strict language lock: only the session's languages count; short medical
// utterances are kept; a turn without evidence is never attributed.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Text layer of a generated PDF. The export embeds a font, so the text is not
 * searchable as bytes; the server's existing pdf.js wrapper (unpdf) reads it.
 */
function pdfText(file) {
  const script = `
    import fs from "node:fs";
    import { getDocumentProxy, extractText } from "unpdf";
    const doc = await getDocumentProxy(new Uint8Array(fs.readFileSync(process.argv[1])));
    const { text } = await extractText(doc, { mergePages: true });
    process.stdout.write(text);`;
  return execFileSync(process.execPath, ["--input-type=module", "-e", script, file], {
    cwd: path.resolve("server"),
  }).toString("utf8");
}

test.describe("Meda Live — strict language lock", () => {
  test("\"Nein\" is attributed to the patient and translated", async ({ page }) => {
    await openMeda(page, GATED);
    await startSession(page);

    await speakUntilCommitted(page, "item_a");
    await transcribe(page, "item_a", "Nein");
    await answer(page, 1, "resp_a", "No.");

    await expect.poll(async () => (await readTurns(page))[0]).toMatchObject({
      role: "Patient", original: "Nein", translation: "No.", unclear: false,
    });
  });

  test("a short time statement is kept and marked as not reliably assigned", async ({ page }) => {
    await openMeda(page, GATED);
    await startSession(page);

    // "Mai" is also an Italian word — must not make this German answer foreign.
    await speakUntilCommitted(page, "item_a");
    await transcribe(page, "item_a", "Im Mai");
    await answer(page, 1, "resp_a", "In May.");

    await expect.poll(async () => (await readTurns(page))[0]).toMatchObject({
      role: "Sprecher nicht sicher zugeordnet", original: "Im Mai", translation: "In May.", unclear: false,
    });
    await expect(turnRows(page).first()).toContainText("Eine der Gesprächssprachen");
    expect(await sent(page, "conversation.item.delete")).toEqual([]);
    await expect(page.locator(".mrt-gate-notice")).toHaveCount(0);
  });

  test("an unattributed turn never shows a third-language translation", async ({ page }) => {
    await openMeda(page, GATED);
    await startSession(page);

    await speakUntilCommitted(page, "item_a");
    await transcribe(page, "item_a", "Paracetamol 500");
    await answer(page, 1, "resp_a", "Usted tiene dolor desde hace muchos días");

    await expect.poll(async () => (await readTurns(page))[0]?.unclear).toBe(true);
    await expect(page.locator(".mrt-conversation")).not.toContainText("Usted tiene dolor");
    const [a] = await readTurns(page);
    expect(a.original).toBe("Paracetamol 500");
    expect(a.role).toBe("Sprecher nicht sicher zugeordnet");
  });

  test("local history and its PDF never label an unattributed turn as practice", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("medscoutx_meda_realtime_archive", JSON.stringify([{
        id: "arch-1",
        createdAt: "2026-09-19T10:00:00.000Z",
        sessionStartedAt: "2026-09-19T09:55:00.000Z",
        patientName: "Anna Schmidt",
        practiceName: null, practiceDepartment: null, doctorName: null,
        patientLanguage: "de", practiceLanguage: "en",
        patientInfo: { name: "Anna Schmidt" }, practiceInfo: {},
        turns: [{
          key: 1, speakerRole: null, sourceLanguage: null, targetLanguage: null,
          originalText: "Paracetamol 500", translatedText: "Paracetamol 500",
          isUnclear: false, originalEdited: false, timestamp: "2026-09-19T09:56:00.000Z",
        }],
      }]));
    });
    await openMeda(page, GATED);

    await page.click(".mrt-btn--archive-view");
    const turn = page.locator(".mrt-archive-turn").first();
    await expect(turn.locator(".mrt-archive-turn-role")).toHaveText("Sprecher nicht sicher zugeordnet");
    await expect(turn).toHaveClass(/mrt-archive-turn--uncertain/);
    await expect(turn).not.toContainText("Praxis / Arzt");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click(".mrt-btn--archive-pdf"),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    const text = pdfText(await download.path());
    expect(text).toContain("Sprecher nicht sicher zugeordnet");
    expect(text).toContain("Paracetamol 500");
    expect(text).not.toContain("Praxis / Arzt");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Live transcription: same language on both sides → no translation, no
// response.create, speaker from the selection at speech start, 60-minute
// maximum, silence never ends it.
// ─────────────────────────────────────────────────────────────────────────────

/** Server stub that answers like the real route: mode from the request. */
const MODE_AWARE = {
  sessionResponse: (body) => (body.mode === "transcription"
    ? { mode: "transcription", responseGating: "none" }
    : { mode: "interpretation", responseGating: "client" }),
};

async function startTranscription(page, { doctor = "Dr. Heinrich" } = {}) {
  await page.getByRole("radio", { name: /Live-Transkription/ }).click();
  await expect(page.locator("#mrt-transcription-lang")).toHaveValue("de");
  await page.fill("#mrt-doctor-name-display", doctor);
  await startSession(page);
}

async function readTranscript(page) {
  return page.locator(".mrt-conversation .mrt-tx-turn").evaluateAll((rows) => rows.map((r) => ({
    speaker: r.querySelector(".mrt-tx-speaker")?.textContent?.trim() ?? null,
    text: r.querySelector(".mrt-tx-text")?.textContent?.trim() ?? null,
    time: r.querySelector(".mrt-tx-time")?.textContent?.trim() ?? null,
    unassigned: r.classList.contains("mrt-tx-turn--unassigned"),
  })));
}

test.describe("Meda Live — live transcription (same language)", () => {
  test("DE→DE: transcript with speakers from the form, no translation, no response.create", async ({ page }) => {
    let body = null;
    await openMeda(page, { ...MODE_AWARE, onSessionRequest: (b) => { body = b; } });
    await startTranscription(page);

    expect(body).toMatchObject({ patientLanguage: "de", practiceLanguage: "de", mode: "transcription", clientGating: true });
    await expect(page.locator(".mrt-title")).toHaveText("Live-Transkription");
    await expect(page.locator(".mrt-subtitle")).toHaveText("Keine Übersetzung – Gespräch wird dokumentiert");
    // Interpreting controls are not offered: no auto/manual bar, no language ping-pong.
    await expect(page.locator(".mrt-mode-bar")).toHaveCount(0);
    await expect(page.locator(".mrt-pingpong-bar")).toHaveCount(0);

    await page.getByRole("button", { name: "Dr. Heinrich" }).click();
    await speak(page, "item_a", "Was führt Sie heute zu mir?");
    await page.getByRole("button", { name: "Anna Schmidt" }).click();
    await speak(page, "item_b", "Ich habe seit gestern Fieber");

    await expect.poll(async () => (await readTranscript(page)).map((t) => [t.speaker, t.text])).toEqual([
      ["Dr. Heinrich", "Was führt Sie heute zu mir?"],
      ["Anna Schmidt", "Ich habe seit gestern Fieber"],
    ]);
    const [first] = await readTranscript(page);
    expect(first.time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    await expect(page.locator(".mrt-turn-text--translation, .mrt-turn-translation")).toHaveCount(0);
    expect(await sent(page, "response.create")).toEqual([]);
  });

  test("the speaker is bound at speech start; without a selection it stays unassigned", async ({ page }) => {
    await openMeda(page, MODE_AWARE);
    await startTranscription(page);

    // No selection yet.
    await speak(page, "item_a", "Guten Morgen");
    // Selected practice, speech starts, THEN the selection switches to the patient.
    await page.getByRole("button", { name: "Dr. Heinrich" }).click();
    await emit(page, { type: "input_audio_buffer.speech_started", item_id: "item_b", audio_start_ms: 0 });
    await page.getByRole("button", { name: "Anna Schmidt" }).click();
    for (const ev of [
      { type: "input_audio_buffer.speech_stopped", item_id: "item_b", audio_end_ms: 900 },
      { type: "input_audio_buffer.committed", item_id: "item_b" },
      { type: "conversation.item.input_audio_transcription.completed", item_id: "item_b", transcript: "Bitte legen Sie sich hin" },
    ]) await emit(page, ev);

    await expect.poll(async () => (await readTranscript(page)).map((t) => [t.speaker, t.unassigned])).toEqual([
      ["Nicht zugeordnet", true],
      ["Dr. Heinrich", false],
    ]);
  });

  test("short answers stay; another language is kept out with a notice", async ({ page }) => {
    await openMeda(page, MODE_AWARE);
    await startTranscription(page);
    await page.getByRole("button", { name: "Anna Schmidt" }).click();

    await speak(page, "item_a", "Ja");
    await speak(page, "item_b", "Paracetamol 500");
    await speak(page, "item_x", "How long have you had the pain here?");

    await expect.poll(async () => (await readTranscript(page)).map((t) => t.text)).toEqual(["Ja", "Paracetamol 500"]);
    await expect(page.locator(".mrt-gate-notice")).toContainText("Andere Sprache erkannt");
    await expect(page.locator(".mrt-conversation")).not.toContainText("How long");
    expect(await sent(page, "response.create")).toEqual([]);
  });

  test("silence never ends it: 30 s nothing, a hint after 3 min, speech clears the hint", async ({ page }) => {
    await page.clock.install();
    await openMeda(page, MODE_AWARE);
    await startTranscription(page);

    await page.clock.fastForward("00:31");
    await expect(page.locator(".mrt-session-bar")).toBeVisible();
    await expect(page.locator(".mrt-silence-hint")).toHaveCount(0);

    await page.clock.fastForward("03:00");
    await expect(page.locator(".mrt-silence-hint")).toContainText("Transkription läuft weiter");
    await expect(page.locator(".mrt-session-bar")).toBeVisible();

    await emit(page, { type: "input_audio_buffer.speech_started", item_id: "item_a", audio_start_ms: 0 });
    await expect(page.locator(".mrt-silence-hint")).toHaveCount(0);
  });

  test("switching tabs does not end a transcription", async ({ page }) => {
    await openMeda(page, MODE_AWARE);
    await startTranscription(page);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.locator(".mrt-session-bar")).toBeVisible();
  });

  test("ends at the 60-minute maximum, not before", async ({ page }) => {
    await page.clock.install();
    await openMeda(page, MODE_AWARE);
    await startTranscription(page);
    await expect(page.locator(".mrt-timer")).toHaveText(/^(60:00|59:5\d)$/);

    await page.clock.fastForward("58:00");
    await expect(page.locator(".mrt-session-bar")).toBeVisible();
    await expect(page.locator(".mrt-timeout-warning")).toBeVisible();

    await page.clock.fastForward("02:05");
    await expect(page.locator(".mrt-session-bar")).toHaveCount(0);
    await expect(page.locator(".mrt-end-reason--time_limit")).toBeVisible();
  });

  test("after the session: speaker correction, PDF and local history show the transcript without translation", async ({ page }) => {
    await openMeda(page, MODE_AWARE);
    await startTranscription(page);
    await page.getByRole("button", { name: "Dr. Heinrich" }).click();
    await speak(page, "item_a", "Wo tut es weh?");
    await page.getByRole("button", { name: "Dr. Heinrich" }).click(); // deselect
    await speak(page, "item_b", "Links im Knie");
    await expect.poll(async () => (await readTranscript(page)).length).toBe(2);

    await page.click(".mrt-btn--stop");
    // The unassigned answer is corrected by hand after the session.
    await page.locator(".mrt-tx-turn").nth(1).locator(".mrt-tx-reassign").selectOption("patient");
    await expect.poll(async () => (await readTranscript(page)).map((t) => t.speaker)).toEqual(["Dr. Heinrich", "Anna Schmidt"]);
    await expect(page.locator(".mrt-tx-turn").nth(1)).toContainText("Sprecher manuell zugeordnet");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator(".mrt-localpdf-btn, .mrt-end-actions .mrt-btn--pdf").first().click(),
    ]);
    const text = pdfText(await download.path());
    expect(text).toContain("Live-Transkription");
    expect(text).toContain("Dr. Heinrich");
    expect(text).toContain("Anna Schmidt");
    expect(text).toContain("Links im Knie");
    expect(text).not.toMatch(/Übersetzung für (Praxis|Patient)/);

    await page.locator(".mrt-btn--archive-save").first().click();
    await page.locator(".mrt-btn--archive-view").first().click();
    const archived = page.locator(".mrt-archive-turn");
    await expect(archived).toHaveCount(2);
    await expect(archived.nth(0).locator(".mrt-archive-turn-role")).toHaveText("Dr. Heinrich");
    await expect(archived.nth(1).locator(".mrt-archive-turn-role")).toHaveText("Anna Schmidt");
    await expect(page.locator(".mrt-archive-turn-section--translation")).toHaveCount(0);
  });

  test("interpreting keeps its tab rule: switching tabs still ends the live link", async ({ page }) => {
    await openMeda(page, MODE_AWARE);
    await startSession(page);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.locator(".mrt-session-bar")).toHaveCount(0);
  });

  test("interpreting keeps its limits: 5-minute timer, 30 s of silence ends it", async ({ page }) => {
    await page.clock.install();
    await openMeda(page, MODE_AWARE);
    await startSession(page);
    await expect(page.locator(".mrt-timer")).toHaveText(/^(05:00|04:5\d)$/);

    await page.clock.fastForward("00:31");
    await expect(page.locator(".mrt-session-bar")).toHaveCount(0);
    await expect(page.locator(".mrt-end-reason--inactivity")).toBeVisible();
  });
});

test.describe("Meda Live — turn keys under bursts", () => {
  const burstCommits = (page, a, b) => burst(page, [
    { type: "input_audio_buffer.speech_started", item_id: a, audio_start_ms: 0 },
    { type: "input_audio_buffer.speech_stopped", item_id: a, audio_end_ms: 700 },
    { type: "input_audio_buffer.committed", item_id: a },
    { type: "input_audio_buffer.speech_started", item_id: b, audio_start_ms: 800 },
    { type: "input_audio_buffer.speech_stopped", item_id: b, audio_end_ms: 1500 },
    { type: "input_audio_buffer.committed", item_id: b },
  ]);

  test("transcription: two segments committed before React renders keep their own entries", async ({ page }) => {
    await openMeda(page, MODE_AWARE);
    await startTranscription(page);
    await burstCommits(page, "item_a", "item_b");
    await transcribe(page, "item_a", "Ja");
    await transcribe(page, "item_b", "Paracetamol 500");
    await expect.poll(async () => (await readTranscript(page)).map((t) => t.text)).toEqual(["Ja", "Paracetamol 500"]);
  });

  test("interpreting: two segments committed before React renders keep their own turns", async ({ page }) => {
    await openMeda(page, GATED);
    await startSession(page);
    await burstCommits(page, "item_a", "item_b");
    await transcribe(page, "item_a", "Ich habe seit gestern Fieber");
    await transcribe(page, "item_b", "How high was the fever?");
    await expect.poll(async () => (await readTurns(page)).map((t) => t.original)).toEqual([
      "Ich habe seit gestern Fieber",
      "How high was the fever?",
    ]);
    // Each translation request names its own turn.
    await expect.poll(async () => (await sent(page, "response.create")).map((e) => e.response.metadata.turn_key)).toEqual(["1"]);
  });
});
