/**
 * A practice invites a patient — end to end, in a real browser, the way a
 * grandmother would go through it.
 *
 * What these tests pin, because each of them was broken:
 *   - an invitation survives SIGNING IN (the login page used to drop it and
 *     land on /intro);
 *   - an invitation survives CREATING AN ACCOUNT, including the e-mail
 *     confirmation that opens in a brand-new tab with empty storage;
 *   - the page says WHICH account is about to be connected, and switching
 *     accounts keeps the invitation — a family laptop signed in as somebody
 *     else must not silently connect that somebody else;
 *   - after connecting, the practice appears under "Meine Praxen" at once;
 *   - the practice's consent request has its OWN checkboxes, nothing ticked.
 *
 * SANDBOX ONLY. This creates accounts, practice records and invitations, and
 * reads mail from a local catcher. It refuses to run unless:
 *   E2E_INVITE_SANDBOX=1, the app and API are on localhost, and the mail
 *   catcher answers. It can never be pointed at production by accident.
 *
 * Required env (see the sandbox scripts):
 *   E2E_INVITE_OWNER_EMAIL, E2E_INVITE_OWNER_PASSWORD, E2E_INVITE_PRACTICE_ID
 *   MAILCATCHER_URL (default http://localhost:4599)
 *
 * Run: E2E_INVITE_SANDBOX=1 ... npx playwright test e2e/patient-invitation-flow.spec.js
 */
import { test, expect } from "@playwright/test";

const APP = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173";
const API = process.env.E2E_API_BASE || "http://localhost:3000";
const MAIL = process.env.MAILCATCHER_URL || "http://localhost:4599";
const OWNER = {
  email: process.env.E2E_INVITE_OWNER_EMAIL,
  password: process.env.E2E_INVITE_OWNER_PASSWORD,
};
const PRACTICE_ID = process.env.E2E_INVITE_PRACTICE_ID;
const PASSWORD = "Sandbox2026!";
// German, as the people this flow is for would see it. Every context gets it
// explicitly: browser.newContext() does not inherit test.use() options. The
// time zone is pinned too — the first-visit language follows the location.
const DE = { locale: "de-DE", timezoneId: "Europe/Berlin" };

const isLocal = (u) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(String(u));

let run = 0;
// Makes every record of one run distinguishable from earlier runs in the same sandbox.
const TAG = Date.now().toString(36).slice(-5);
const unique = (label) => `${label}.${Date.now().toString(36)}${(run += 1)}@sandbox.test`;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  test.skip(process.env.E2E_INVITE_SANDBOX !== "1", "sandbox-only flow (E2E_INVITE_SANDBOX=1)");
  test.skip(!isLocal(APP) || !isLocal(API) || !isLocal(MAIL), "refusing to run anywhere but localhost");
  test.skip(!OWNER.email || !OWNER.password || !PRACTICE_ID, "sandbox practice owner not configured");
  const probe = await request.get(`${MAIL}/mails`).catch(() => null);
  test.skip(!probe || !probe.ok(), "no local mail catcher — nothing may be sent for real");
});

/* ----------------------------------------------------------------- helpers */

/** The newest mail to `address` whose subject matches, polled briefly. */
async function latestMail(request, address, subjectPattern) {
  for (let i = 0; i < 40; i += 1) {
    const res = await request.get(`${MAIL}/mails`);
    const mails = (await res.json()).filter((m) => {
      const to = Array.isArray(m.to) ? m.to.join(",") : String(m.to);
      return to.includes(address) && subjectPattern.test(String(m.subject || ""));
    });
    if (mails.length) return mails[mails.length - 1];
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no mail to ${address} matching ${subjectPattern}`);
}

function linkIn(mail, pattern) {
  const m = String(mail.text || "").match(pattern);
  if (!m) throw new Error(`link ${pattern} not found in mail`);
  return m[0];
}

async function signIn(page, email, password) {
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: "Einloggen" }).click();
}

/** A verified patient account, made the way a real one is: register + confirm. */
async function createVerifiedPatient(request, email, firstName) {
  const res = await request.post(`${API}/api/auth/register`, {
    data: {
      user: { email, password: PASSWORD, first_name: firstName, last_name: "Beispiel", date_of_birth: "1950-02-03" },
      profile: {},
      consent: { terms_accepted: true, privacy_accepted: true, medical_disclaimer_accepted: true },
    },
  });
  expect(res.ok()).toBeTruthy();
  const mail = await latestMail(request, email, /bestätige|confirm/i);
  const verify = linkIn(mail, /http:\/\/localhost:3000\/api\/auth\/verify-email\?[^\s]+/);
  const done = await request.get(verify, { maxRedirects: 0 });
  expect([301, 302, 303, 307, 308]).toContain(done.status());
}

/** The practice creates an entry and invites it by e-mail, through its own UI. */
async function practiceInvites(browser, request, patient) {
  const ctx = await browser.newContext(DE);
  const page = await ctx.newPage();
  await page.goto(`${APP}/login`);
  await signIn(page, OWNER.email, OWNER.password);
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));

  await page.goto(`${APP}/practice/patient-entries?practiceId=${PRACTICE_ID}`);
  await page.getByRole("button", { name: "Patient hinzufügen" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Vorname/).fill(patient.given);
  await dialog.getByLabel(/^Nachname/).fill(patient.family);
  await dialog.getByLabel(/^Geburtsdatum/).fill(patient.dob);
  await dialog.getByLabel(/^E-Mail/).fill(patient.email);
  await dialog.getByRole("button", { name: "Eintrag anlegen" }).click();
  await expect(dialog).toBeHidden();

  const card = page.locator(".onboarding-card").filter({ hasText: `${patient.given} ${patient.family}` });
  await card.getByRole("button", { name: "Per E-Mail senden" }).click();
  await expect(page.getByText(/Einladung an .+ gesendet/)).toBeVisible();

  const mail = await latestMail(request, patient.email, /Einladung/);
  return { practicePage: page, practiceContext: ctx, mail };
}

/* ------------------------------------------------------------------- tests */

test("the practice cannot create an entry without a date of birth", async ({ browser }) => {
  const ctx = await browser.newContext(DE);
  const page = await ctx.newPage();
  await page.goto(`${APP}/login`);
  await signIn(page, OWNER.email, OWNER.password);
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await page.goto(`${APP}/practice/patient-entries?practiceId=${PRACTICE_ID}`);
  await page.getByRole("button", { name: "Patient hinzufügen" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel(/^Geburtsdatum/)).toHaveAttribute("required", "");
  await dialog.getByLabel(/^Vorname/).fill("Ohne");
  await dialog.getByLabel(/^Nachname/).fill("Datum");
  await dialog.getByRole("button", { name: "Eintrag anlegen" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Bitte geben Sie das Geburtsdatum an.");
  await ctx.close();
});

test("the invitation mail: neutral subject, a button, the address still readable", async ({ browser, request }) => {
  const email = unique("mailcheck");
  const { mail, practiceContext } = await practiceInvites(browser, request, {
    given: "Mail", family: `Prüfung${TAG}`, dob: "1960-01-01", email,
  });
  expect(mail.subject).toBe("Einladung Ihrer Praxis über MedScoutX");
  expect(mail.subject).not.toContain("Sonnenberg");
  expect(mail.html).toContain(">Einladung öffnen</a>");
  expect(mail.html).toMatch(/>http:\/\/localhost:5173\/patient-invitation#token=[^<]+<\/a>/);
  expect(mail.html).not.toMatch(/<img/i);
  await practiceContext.close();
});

test("a new patient: create an account, confirm in a NEW tab, and land back at the invitation", async ({ browser, request }) => {
  const email = unique("erna.neu");
  const { mail, practicePage, practiceContext } = await practiceInvites(browser, request, {
    given: "Erna", family: `Neu${TAG}`, dob: "1948-05-12", email,
  });
  const invite = linkIn(mail, /http:\/\/localhost:5173\/patient-invitation#token=[A-Za-z0-9_-]+/);

  // The tab she opens from the practice's mail.
  const first = await (await browser.newContext(DE)).newPage();
  await first.goto(invite);
  await expect(first.getByRole("heading", { level: 1 })).toContainText("möchte sich mit Ihnen verbinden");
  await expect(first).not.toHaveURL(/token=/); // the credential left the address bar

  await first.getByRole("link", { name: /Konto erstellen/ }).click();
  await expect(first).toHaveURL(/\/register\?next=%2Fpatient-invitation/);
  await expect(first.getByTestId("register-invitation-note")).toBeVisible();

  await first.locator("#email").fill(email);
  await first.locator("#password").fill(PASSWORD);
  await first.locator("#first_name").fill("Erna");
  await first.locator("#last_name").fill("Neu");
  await first.locator("#dob").fill("1948-05-12");
  for (const box of await first.locator("fieldset.consents input[type=checkbox]").all()) await box.check();
  await first.getByRole("button", { name: "Weiter", exact: true }).click();
  await expect(first).toHaveURL(/\/check-email\?next=%2Fpatient-invitation/);
  await expect(first.getByTestId("check-email-invitation-note")).toBeVisible();

  // The confirmation link opens in a BRAND-NEW context: no sessionStorage, no
  // localStorage. Only the link itself can carry the invitation back.
  const confirm = await latestMail(request, email, /bestätige/i);
  const verifyLink = linkIn(confirm, /http:\/\/localhost:3000\/api\/auth\/verify-email\?[^\s]+/);
  expect(verifyLink).toMatch(/#invitation=/);
  expect(verifyLink.split("#")[0]).not.toContain(invite.split("token=")[1]); // never server-visible

  const second = await (await browser.newContext(DE)).newPage();
  await second.goto(verifyLink);
  await expect(second).toHaveURL(/\/login\?verify=ok&next=%2Fpatient-invitation/);
  await expect(second).not.toHaveURL(/invitation=/); // picked up and cleared
  await expect(second.getByTestId("login-invitation-note")).toBeVisible();
  await signIn(second, email, PASSWORD);

  await expect(second).toHaveURL(/\/patient-invitation$/);
  await expect(second.getByTestId("invitation-account")).toContainText(email);
  await second.getByRole("button", { name: "Verbinden", exact: true }).click();
  await expect(second.getByRole("heading", { name: "Sie sind jetzt verbunden" })).toBeVisible();

  await second.getByRole("link", { name: "Meine Praxen" }).click();
  const card = second.getByRole("link", { name: /Hausarztpraxis Sonnenberg/ });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Freigabe ausstehend");

  // …and the practice sees the same thing, from its side.
  await practicePage.reload();
  const entry = practicePage.locator(".onboarding-card").filter({ hasText: `Erna Neu${TAG}` });
  await expect(entry).toContainText("Verbunden – Freigabe steht aus");
  await practiceContext.close();
});

test("an existing patient who is signed out: sign in, come back, one tap", async ({ browser, request }) => {
  const email = unique("karl.da");
  await createVerifiedPatient(request, email, "Karl");
  const { mail, practiceContext } = await practiceInvites(browser, request, {
    given: "Karl", family: `Da${TAG}`, dob: "1944-11-03", email,
  });
  const invite = linkIn(mail, /http:\/\/localhost:5173\/patient-invitation#token=[A-Za-z0-9_-]+/);

  const page = await (await browser.newContext(DE)).newPage();
  await page.goto(invite);
  await page.getByRole("link", { name: /Anmelden/ }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fpatient-invitation/);
  await expect(page.getByTestId("login-invitation-note")).toBeVisible();
  await signIn(page, email, PASSWORD);

  // Straight back — not /intro, which is where it used to end.
  await expect(page).toHaveURL(/\/patient-invitation$/);
  // No "who is this for?" question when there is only one possible answer.
  await expect(page.getByText("Für wen gilt die Verbindung?")).toHaveCount(0);
  await page.getByRole("button", { name: "Verbinden", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sie sind jetzt verbunden" })).toBeVisible();

  // One tap into the new practice, where the next step is waiting.
  await page.getByRole("link", { name: "Zur Praxis", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Noch keine Freigabe" })).toBeVisible();
  await practiceContext.close();
});

test("signed in as the wrong account: the page says so, and switching keeps the invitation", async ({ browser, request }) => {
  const wrong = unique("wrong.account");
  const right = unique("right.account");
  await createVerifiedPatient(request, wrong, "Falsch");
  await createVerifiedPatient(request, right, "Richtig");
  const { mail, practiceContext } = await practiceInvites(browser, request, {
    given: "Richtig", family: `Person${TAG}`, dob: "1955-06-07", email: right,
  });
  const invite = linkIn(mail, /http:\/\/localhost:5173\/patient-invitation#token=[A-Za-z0-9_-]+/);

  const ctx = await browser.newContext(DE);
  const page = await ctx.newPage();
  await page.goto(`${APP}/login`);
  await signIn(page, wrong, PASSWORD);
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));

  await page.goto(invite);
  const strip = page.getByTestId("invitation-account");
  await expect(strip).toContainText(wrong); // it says who would be connected
  await strip.getByRole("button", { name: "Anderes Konto verwenden" }).click();

  await expect(page).toHaveURL(/\/login\?next=%2Fpatient-invitation/);
  // The previous person's session is gone from this browser.
  expect(await page.evaluate(() => localStorage.getItem("medscout_token"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("medscoutx_identity_patient"))).toBeNull();

  await signIn(page, right, PASSWORD);
  await expect(page).toHaveURL(/\/patient-invitation$/);
  await expect(page.getByTestId("invitation-account")).toContainText(right);
  await page.getByRole("button", { name: "Verbinden", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sie sind jetzt verbunden" })).toBeVisible();

  // And the wrong account got nothing.
  const other = await (await browser.newContext(DE)).newPage();
  await other.goto(`${APP}/login`);
  await signIn(other, wrong, PASSWORD);
  await other.waitForURL((u) => !u.pathname.startsWith("/login"));
  await other.goto(`${APP}/patient/practice`);
  await expect(other.getByText("Noch keine verbundene Praxis")).toBeVisible();
  await practiceContext.close();
});

test("the practice's own team account: told before the button, and the invitation survives", async ({ browser, request }) => {
  const email = unique("team.check");
  await createVerifiedPatient(request, email, "Team");
  const { mail, practicePage, practiceContext } = await practiceInvites(browser, request, {
    given: "Team", family: `Probe${TAG}`, dob: "1958-08-09", email,
  });
  const invite = linkIn(mail, /http:\/\/localhost:5173\/patient-invitation#token=[A-Za-z0-9_-]+/);

  // The practice owner opens the invitation in their own, signed-in browser.
  await practicePage.goto(invite);
  const notice = practicePage.getByTestId("invitation-team-account");
  await expect(notice).toContainText("Mit diesem Konto können Sie die Einladung nicht annehmen");
  await expect(notice).toContainText("Die Einladung bleibt gültig");
  await expect(practicePage.getByRole("button", { name: "Verbinden", exact: true })).toHaveCount(0);

  // The practice cannot even mail an invitation to its own login.
  await practicePage.goto(`${APP}/practice/patient-entries?practiceId=${PRACTICE_ID}`);
  await practicePage.getByRole("button", { name: "Patient hinzufügen" }).click();
  const dialog = practicePage.getByRole("dialog");
  await dialog.getByLabel(/^Vorname/).fill("Eigenes");
  await dialog.getByLabel(/^Nachname/).fill(`Konto${TAG}`);
  await dialog.getByLabel(/^Geburtsdatum/).fill("1970-01-01");
  await dialog.getByLabel(/^E-Mail/).fill(OWNER.email.toUpperCase());
  await dialog.getByRole("button", { name: "Eintrag anlegen" }).click();
  await expect(dialog).toBeHidden();
  const own = practicePage.locator(".onboarding-card").filter({ hasText: `Eigenes Konto${TAG}` });
  await own.getByRole("button", { name: "Per E-Mail senden" }).click();
  await expect(practicePage.getByText(/gehört zu einem Konto in Ihrem Praxisteam/)).toBeVisible();
  await expect(own).toContainText("Keine Einladung");

  // The same link still works for the patient it was meant for.
  const ctx = await browser.newContext(DE);
  const page = await ctx.newPage();
  await page.goto(`${APP}/login`);
  await signIn(page, email, PASSWORD);
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await page.goto(invite);
  await page.getByRole("button", { name: "Verbinden", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sie sind jetzt verbunden" })).toBeVisible();
  await ctx.close();
  await practiceContext.close();
});

test("consent: the practice's request has its own checkboxes, nothing ticked, nothing borrowed", async ({ browser, request }) => {
  const email = unique("consent.check");
  await createVerifiedPatient(request, email, "Frei");
  const { mail, practicePage, practiceContext } = await practiceInvites(browser, request, {
    given: "Frei", family: `Gabe${TAG}`, dob: "1952-03-04", email,
  });
  const invite = linkIn(mail, /http:\/\/localhost:5173\/patient-invitation#token=[A-Za-z0-9_-]+/);

  const page = await (await browser.newContext(DE)).newPage();
  await page.goto(invite);
  await page.getByRole("link", { name: /Anmelden/ }).click();
  await signIn(page, email, PASSWORD);
  await page.getByRole("button", { name: "Verbinden", exact: true }).click();
  await page.getByRole("link", { name: "Freigaben festlegen" }).click();

  const request0 = page.locator(".consent-request").first();
  await expect(request0).toBeVisible();
  const boxes = request0.locator("input[type=checkbox]");
  await expect(boxes).toHaveCount(8);
  for (const box of await boxes.all()) await expect(box).not.toBeChecked();
  const grant = request0.getByRole("button", { name: "Freigabe erteilen" });
  await expect(grant).toBeDisabled();

  // Ticking the connect-code section further down must NOT enable this one.
  await page.locator("#connect-code-heading").scrollIntoViewIfNeeded();
  await page.getByRole("checkbox", { name: "Profil (organisatorisch)" }).last().check();
  await expect(grant).toBeDisabled();

  await request0.getByRole("checkbox", { name: /Sichere Nachrichten/ }).check();
  await expect(grant).toBeEnabled();
  await grant.click();
  await expect(page.getByText("Verbindung aktiviert.")).toBeVisible();

  await practicePage.reload();
  const entry = practicePage.locator(".onboarding-card").filter({ hasText: `Frei Gabe${TAG}` });
  await expect(entry).toContainText("Verbunden");
  await expect(entry).not.toContainText("Freigabe steht aus");
  await practiceContext.close();
});

test("data & permissions: both sides, one practice — a request answered by the practice reaches the patient", async ({ browser, request }) => {
  const email = unique("daten.freigaben");
  await createVerifiedPatient(request, email, "Daten");
  const { mail, practicePage, practiceContext } = await practiceInvites(browser, request, {
    given: "Daten", family: `Freigabe${TAG}`, dob: "1961-04-05", email,
  });
  const invite = linkIn(mail, /http:\/\/localhost:5173\/patient-invitation#token=[A-Za-z0-9_-]+/);

  const ctx = await browser.newContext(DE);
  const page = await ctx.newPage();
  await page.goto(invite);
  await page.getByRole("link", { name: /Anmelden/ }).click();
  await signIn(page, email, PASSWORD);
  await page.getByRole("button", { name: "Verbinden", exact: true }).click();
  await page.getByRole("link", { name: "Zur Praxis", exact: true }).click();
  const linkId = new URL(page.url()).pathname.split("/")[3];

  // Patient: the practice's own "Meine Daten & Freigaben" — this practice only.
  await page.getByRole("link", { name: /Meine Daten & Freigaben/ }).click();
  await expect(page).toHaveURL(new RegExp(`/patient/practice/${linkId}/data-control$`));
  await expect(page.getByRole("heading", { name: "Freigaben für diese Praxis" })).toBeVisible();
  await expect(page.getByText("Sie haben dieser Praxis derzeit nichts freigegeben.")).toBeVisible();

  await page.getByRole("button", { name: "Datenexport anfragen" }).click();
  const dialog = page.locator("dialog.patient-data-control__dialog");
  await dialog.getByRole("button", { name: "Weiter" }).click();
  await dialog.getByRole("button", { name: "Export anfragen" }).click();
  await expect(page.locator(".patient-data-control__requests-panel")).toContainText("Eingereicht");

  // Practice: the same request in the patient's record, answered there.
  await practicePage.goto(`${APP}/practice/patients/${linkId}?practiceId=${PRACTICE_ID}&tab=dataConsent`);
  const req = practicePage.locator(".practice-dataconsent__request").first();
  await expect(req).toContainText("Export");
  await req.getByLabel("Neuer Status").selectOption("completed");
  await req.getByLabel("Antwort an die Patientin / den Patienten").fill(`Export liegt bereit ${TAG}.`);
  await req.getByRole("button", { name: "Status und Antwort speichern" }).click();
  await expect(req).toContainText("Status und Antwort sind jetzt im Patientenbereich dieser Praxis sichtbar.");

  // Patient: status and the practice's answer, in that practice's area.
  await page.reload();
  const panel = page.locator(".patient-data-control__requests-panel");
  await expect(panel).toContainText("Abgeschlossen");
  await expect(panel).toContainText("Antwort der Praxis");
  await expect(panel).toContainText(`Export liegt bereit ${TAG}.`);

  // …and in "Meine Aktivität" of this practice, without a practice picker.
  await page.goto(`${APP}/patient/practice/${linkId}`);
  await page.getByRole("link", { name: /Meine Aktivität/ }).click();
  await expect(page).toHaveURL(new RegExp(`/patient/practice/${linkId}/activity$`));
  await expect(page.getByText("Datenanfrage bearbeitet").last()).toBeVisible();
  await expect(page.getByLabel("Praxis", { exact: true })).toHaveCount(0);

  await ctx.close();
  await practiceContext.close();
});
