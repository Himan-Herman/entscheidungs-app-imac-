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
 * @param {{ sessionResponse?: (body: any) => object }} [opts]
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
    const [a] = await readTurns(page);
    expect(a.role).toBe("Patient");
    expect(a.translation).toBe("I have had a severe headache for three days.");
    expect(a.unclear).toBe(false);
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
