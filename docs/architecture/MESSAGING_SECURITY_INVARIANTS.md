# Security invariants — practice–patient messaging

Engineering reference for `PracticePatientThread` / `PracticePatientMessage`.
Established in Phase 1' (hardening). Enforced by
`server/scripts/verifyMessagingIsolation.test.js`; a failure there is a security
regression, not a flaky test.

This document states what the system actually does. Where a rule is a decision
rather than a technical necessity, it says so.

---

## 1. `PracticePatientLink` is the authorization boundary

Every practice-side access to a conversation is authorized against a
`PracticePatientLink` row — the explicit care relationship between one practice
and one patient. Nothing else grants access:

- not a shared patient (two practices treating the same person hold two
  different links and can never see each other's conversations),
- not practice ownership (`PracticeProfile.userId` is organizational; it grants
  administrative power, not conversation access — it holds `PATIENT_LINKS_READ`
  by explicit allowlist entry, not by being the owner),
- not a role name on its own (see §4),
- not any identifier supplied by the client (see §3).

A thread additionally carries `practicePatientLinkId`, `practiceProfileId` and
`patientUserId`, and is always queried with the link **and** the practice as
filters. There are no anonymous threads and no thread addressable by patient id
alone.

**Patient side:** the boundary is the authenticated user id. Every patient query
filters on `req.user.userId`. A patient never supplies a scoping identifier.

---

## 2. How the practice context is determined server-side

For any route under `/api/practice/patients/:linkId/...`:

```
linkId (path)
  -> prisma.practicePatientLink.findUnique({ where: { id: linkId } })     // no client filter
  -> practiceProfileId := link.practiceProfileId                          // tenant FROM THE LINK
  -> getPracticeAccess(actorUserId, practiceProfileId)                    // membership, from DB
  -> effectivePermissions := owner allowlist ∪ active membership allowlist
                             ∪ clinical subset of an ACTIVE clinical role
  -> all required permissions must be held                                // ALL-of, never any-of
  -> link.status ∈ { invited, active }
  -> all required consents must be held                                   // ALL-of
  -> req.linkAccess = { link, linkId, practiceProfileId, patientUserId, role }
```

Implemented once, in
`server/services/authorization/practicePatientLinkAuthorization.js`
(`requirePracticePatientLinkAccess`). `routes/practicePatientThreads.js` has no
authorization logic of its own — that was finding C-1, and a route-layer test
asserts it stays that way.

Routes must read their scope from `req.linkAccess`, never from `req.params` or
`req.query`.

---

## 3. Why foreign identifiers grant nothing

| Client-supplied value | What the server does with it |
|---|---|
| `practiceId` (query/body) | Never used to select the tenant. Tolerated for backwards compatibility, and must **match** the practice derived from the link; a mismatch is rejected as `link_not_found` — including when the caller is a legitimate member of the practice they named. |
| `linkId` (path) | Used only to load a row. Whether the caller may touch it is decided afterwards, from membership. |
| `threadId` (path) | Every lookup filters on `(threadId, practiceProfileId, practicePatientLinkId)` for a practice, or `(threadId, patientUserId)` for a patient. A thread belonging to someone else simply does not match. |
| `messageId` | There is **no** message-addressable read or write path. Messages are only ever reached through an already-authorized thread. A structural test forbids introducing a `getMessageById`-style export. |
| `patientId` | Never accepted as a scope on patient routes; the session's user id is used. |

**No existence disclosure.** "Does not exist" and "is not yours" return the same
result — `link_not_found` / `thread_not_found`, same status code. A caller
cannot use error codes to probe whether another practice's link or thread
exists. Denials are recorded as security events with the reason and a
`practiceIdMismatch` flag.

---

## 4. Permissions are effective permissions, not role strings

Authorization checks go through `accessHasPermission(access, permission)`, which
consults the precomputed `effectivePermissions` set. Helper functions that take
a bare role string (`canReadPracticePatientLinks(role)` and friends) must not be
used on these routes — they ignore the union with an approved clinical role and
constitute a second, divergent notion of "may". That was finding C-5.

Where a route demands several permissions, **all** are required:

| Operation | Required permissions |
|---|---|
| read threads / thread / acknowledge | `patient_links.read` |
| create thread, send, close, archive | `patient_links.write` **and** `messages.send` |
| restore from archive | `patient_links.write` **and** `settings.manage` |
| AI reply draft | `patient_links.write` **and** `messages.send` |

The write set is deliberately unchanged from before the hardening (owner, admin,
practice_manager, secretary, doctor). Requiring both rights means a future grant
of only one of them cannot hand out send rights by accident.

---

## 5. Consent: read/write rule

The scope `messages` (consent type `secure_messaging`) is the patient's grant to
the **practice**. Enforcement is therefore asymmetric on purpose:

| Actor | Operation | Consent required |
|---|---|---|
| Practice | list, read, acknowledge, close, archive, restore | **yes** |
| Practice | create thread, send message | **yes** |
| Practice | AI draft | **yes**, plus `ai_organizational_assistance` |
| Patient | read own conversation, list own threads | **no** |
| Patient | send message | **yes** |

Rationale for the patient row: the patient is the data subject. Withdrawing a
grant given to someone else must not erase their own view of their own
communication. **Access and retention are separate concerns**; this document
makes no statement about retention obligations, which are a legal question.

Consent is checked in two places on purpose:
- the route guard (`consentType` on `requirePracticePatientLinkAccess`), and
- the service (`assertPracticeConsentedLink` in
  `services/communication/practicePatientThreadService.js`),

so that a future caller that is not an HTTP route — a job, an export, a new
endpoint — cannot reach conversation content by going around the HTTP layer.
Both read the same source of truth (`linkHasConsentType`).

`linkHasConsentType` returns false for links that are not `invited`/`active`, so
a revoked relationship blocks writing on both sides without a separate check.

### Second read paths

Any code that returns message **bodies or subjects** must apply the same consent
gate. A `subject` is user-authored free text (UI label: "Betreff (optional)")
and nothing constrains it to organizational wording — "HIV-Befund" is not
harmless because the body stays hidden. Where a query *matches* on subject, the
query is skipped entirely rather than blanking the label, because returning a
hit would confirm the searched term exists.

Known paths and their status:

| Path | Returns | Tenant-scoped | Consent gate |
|---|---|---|---|
| `/practice/patients/:linkId/threads` | bodies | yes | yes |
| `/practice/inbox/:itemId` (message preview) | bodies | yes | yes — added in Phase 1' (C-6) |
| `practiceV1ApiService.v1ListMessageThreadsMetadata` | ids/status/timestamps | yes | n/a — no content |
| `practicePatientRecordService` | counts, last-activity dates | yes | n/a — no content |
| `practicePatientSearchService` | thread subjects | yes | yes — added in Phase 2A |
| `exportCollectors` (patient_summary) | subjects, counts | yes | yes — added in Phase 2A (subjects only; the neutral count stays) |
| `practiceOverviewService` | unread counts | yes | n/a — no content |
| `patientDataControlService` | counts | patient's own | n/a |

When adding a path that exposes message content, add it to this table and to the
consent test.

---

## 5b. Cardinality: one channel per care relationship (Phase 2A)

A `PracticePatientLink` carries **exactly one** `PracticePatientThread` — the
permanent communication channel between that patient and that practice.

Enforced by the database: `@@unique([practicePatientLinkId])`, migration
`20260817120000_thread_one_channel_per_link`. Not by convention, so no call site
and no concurrent request can produce a second one.

**Creation is idempotent and race-safe.** `ensureCommunicationChannel()` reads
first only as an optimisation; correctness rests on the constraint. A losing
concurrent insert is rejected with `P2002` and resolved by returning the row the
winner created. Patient and practice opening communication in the same moment
therefore yields one channel with two messages, never two channels.

A later opener never retitles an existing channel: the first `subject` stands.
An untitled channel may still be given one.

**Consequence for state:** `closed` and `archived` are *view* states, never
locks, and never free the slot. With one permanent channel, a terminal state
would end the relationship's ability to communicate at all — so new activity
reopens (see §5c). Archiving is not a reset: opening communication again returns
the same channel.

**Topic threads later.** Replacing the single-column unique with a composite one
is a non-destructive migration; every existing row stays valid.

---

## 5b2. Message idempotency (Phase 2A.1)

Channel and message are **separate invariants**:

| Object | Invariant | Enforced by |
|---|---|---|
| channel | one per `PracticePatientLink`, forever | `@@unique([practicePatientLinkId])` |
| message | one per `(channel, clientRequestId)` | `@@unique([threadId, clientRequestId])` |

`PracticePatientMessage.clientRequestId` is an optional caller-supplied id for
ONE logical send action. Repeating that action — a retry after a lost response,
a double tap, a proxy replay — returns the message that was already written
instead of persisting a second one.

Rules that matter:

- **Deduplication is by intent, never by content.** The same text under a new
  key is a new message; a patient repeating themselves is legitimate.
- **Scoped to the thread, never global.** The thread is authorized before any
  insert, so the same key used in two different communication channels produces
  two unrelated rows. A key can never collide across tenants.
- **NULL is distinct in Postgres.** A sender that supplies no key keeps exactly
  the old behaviour — every call appends. No historic message was backfilled
  with an invented key.
- **Correctness rests on the constraint, not on a prior read.** A retry that
  arrives while the first insert is still in flight would defeat any
  check-then-insert. The loser gets `P2002` and receives the winner's message.
- **A deduplicated retry is a true no-op**: it does not bump the channel in
  every list and does not raise a second inbox entry. This also removes a
  notification-spam vector on flaky networks.
- Keys are capped at 64 characters and rejected — never truncated — beyond it,
  so a truncated key cannot be steered into someone else's slot.

Client side: `features/communication/lib/sendRequestId.js` generates a key when
the user triggers a send. It is kept while the outcome is *unknown* (network
loss, 5xx) and dropped as soon as the outcome is known — on success, and on any
4xx, because the server then definitely persisted nothing and the next attempt
is a new action.

---

## 5c. Thread state machine

Derived from the code, not designed on paper. `status` ∈ `open | closed | archived`
with `closedAt` / `archivedAt` as markers.

| From | To | Actor | Authorization | Effect |
|---|---|---|---|---|
| *(none)* | `open` | practice | `patient_links.write` + `messages.send` + messaging consent | Channel created via `ensureCommunicationChannel`; unique index guarantees at most one |
| `open` | `open` | practice / patient | write rights + consent (practice), consent (patient) | Message appended; `updatedAt` bumped |
| `open` | `closed` | practice | `patient_links.write` + `messages.send` + consent | `closedAt` set — organizational "settled" marker |
| `open` \| `closed` | `archived` | practice | `patient_links.write` + `messages.send` + consent | `archivedAt` set; removed from the default list |
| `open` \| `closed` | `archived` | patient | own thread | same row — see the caveat below |
| `archived` | `open` \| `closed` | practice | `patient_links.write` + `settings.manage` + consent | Restores the pre-archive status |
| `archived` | `open` \| `closed` | patient | own thread | Restores the pre-archive status |
| `closed` \| `archived` | `open` | practice / patient | normal send rights | **New activity reopens**: `reopenAndTouch()` clears `closedAt` and `archivedAt` |

**`closed` is organizational, never a lock.** It marks "settled" and nothing
more: either side writing reopens the channel. It must NOT be used to express
"this patient may not send messages" — a practice-level policy of that kind is a
separate setting on the practice, not a thread status, and does not exist yet.

Restore on a thread that is not archived raises `thread_not_archived`. There is
no delete transition; removal happens only through the link's own lifecycle
(`onDelete: Cascade`) or a GDPR request.

### Archive is party-scoped (Phase 2A.2)

Archiving is a **view preference**, and it belongs to exactly one party.

| Column | Owner | Written by |
|---|---|---|
| `patientArchivedAt` | patient | patient archive / restore only |
| `practiceArchivedAt` | practice | practice archive / restore only |
| `status` (`open` \| `closed`) | shared lifecycle | close, and any new message (reopen) |
| `archivedAt` | **legacy, read-only** | nothing — see migration note |

Rules, each enforced by a test:

- A patient action never writes `practiceArchivedAt`, and vice versa.
- The patient list filters **only** on `patientArchivedAt`; the practice list and
  the practice unread counter filter **only** on `practiceArchivedAt`. There is
  no shared archive filter left.
- Archiving does not touch `updatedAt` — a view preference must not re-sort the
  other party's list.
- Restore is rejected (`thread_not_archived`) unless the **acting** party holds
  an archive.
- `status` never takes the value `archived`. "archived" exists only in a
  response, computed for the viewer that archived (`statusFor`), so the API
  contract for clients is unchanged while the storage is party-scoped.
- No archive/restore path may clear both columns; a source-level test asserts
  each of the four functions touches exactly one.

**Reactivation on a new message** clears both columns, but by **two separate
rules**, never as a blanket action:

| Column cleared | Reason |
|---|---|
| recipient's | new content must never stay hidden in a list the recipient archived — that loses a message, and for the practice a work item |
| sender's | engaging with a conversation returns it to your own view; you just acted on it |

**Legacy rows.** Before 2A.2 there was one shared `archivedAt`. It recorded
*that* a conversation was archived, never *by whom*. The migration copies such
rows to **both** parties — so nothing reappears in anyone's list, which would be
a privacy-relevant surprise — and **preserves the original column** as evidence
that the archive was unattributed. Nothing reads or writes `archivedAt` any more;
either party can undo their own half.

---

## 6. Read acknowledgement

**`GET` never changes read state.** Fetching a thread — list or detail, practice
or patient — has no side effects.

Read state changes only through the explicit endpoint:

```
PATCH /api/patient/threads/:threadId/read
PATCH /api/practice/patients/:linkId/threads/:threadId/read
```

Properties:

- **authorized** — same guard as reading the thread;
- **scoped** — marks only messages in that thread, and only those sent by the
  *other* party (a sender never marks their own message read);
- **idempotent** — the update carries `readAt: null` in its `where`, so a repeat
  matches nothing and the first timestamp survives;
- **atomic** — a single conditional `updateMany`, no read-then-write sequence,
  so concurrent acknowledgements converge on one timestamp.

This decoupling exists because of what comes next. A later "edit or withdraw a
message only while it is unread" rule must be expressible as one conditional
statement:

```js
updateMany({ where: { id, readAt: null, revision: n }, data: { ... } })
```

If a `GET` could flip `readAt`, that window would be consumed by a prefetch. And
if the rule were implemented as read → check → write, it would carry a TOCTOU
race between the patient opening a message and the practice editing it. The
current shape has neither. A test asserts that the same conditional update
matches one row before acknowledgement and zero rows after it.

---

## 7. AI is never load-bearing

`COMMUNICATION_AI_DRAFTS` (default **off**) gates the only two routes that send
conversation content to an external AI provider. With it off, sending, reading
and organising messages are unaffected.

AI never participates in an authorization decision. No model output can widen
access, set a context, or change a state. The draft routes are ordinary
authorized reads whose result happens to be passed to a model.

The flag is separate from `COMMUNICATION_V2` because the shared OpenAI client
sets no `baseURL` (US endpoint) and neither EU data residency nor
zero-data-retention is configured or evidenced in this repository — the same
open question that keeps `ENABLE_DOCUMENT_TRANSLATION` off.

---

## 7b. Documents in a practice context (Phase 2E.2)

A document appears under `/patient/practice/:linkId/documents` in exactly two
cases, and the decision is made by the database query — never by filtering a
wider result set afterwards:

| Class | Condition |
|---|---|
| **DIRECT** | `practicePatientLinkId = link.id` **and** `patientUserId = link.patientUserId` **and** `status = "shared"` **and** an active, unexpired `PracticeDocumentShare` to that patient |
| **SHARED** | `patientUserId = link.patientUserId` **and** an effective `PracticeDocumentShareGrant` whose `targetPracticePatientLinkId` is exactly `link.id` |

Everything else is unreachable here: another link's document, a revoked or
expired grant, a draft, a deleted document, another patient's document, and a
`documentId` guessed or replayed from elsewhere. `link_not_found`,
`document_not_found` and `file_not_found` all surface as 404, so none of them
can be used to probe what exists.

**Same patient is not authorization.** The link is the boundary, not the person.
The uniqueness key of `PracticePatientLink` is
`(practiceProfileId, patientUserId, patientProfileId)`, so one account can hold
two links to the *same* practice — for itself and for a dependent it manages.
Those are two contexts, and a document of one must not appear in the other.
This is the case where "scoped by link" and "scoped by practice + patient"
diverge; everywhere else they agree, which is exactly why the weaker reading can
survive review unnoticed. `verifyDocumentContextIsolation.test.js` pins it down.

**Linkless documents (Class D).** Meda Live session PDFs
(`services/meda/medaPdfLinkService.js`) are the only documents created with
`practicePatientLinkId: null`, and they carry `patientUserId: null` too. They are
practice-internal and belong to no patient, so neither branch can match them.
"Linkless" must never be read as "visible to everyone in the practice".

**Tokens are not permissions.** The context download route takes no token at
all: session plus link decide on every single request, so a share revoked a
second ago blocks a download the client is still offering. Where secure bearer
links do exist (`SecureDocumentAccessToken`, for external recipients), redemption
re-derives access rather than trusting the token, and revoking a grant stamps its
tokens revoked inside the same transaction. The two mechanisms fail
independently, because a token outliving the permission it was issued under is
the failure mode that matters.

---

## 7c. Medication plans in a practice context (Phase 2E.3)

`MedicationPlan.practicePatientLinkId` is **NOT NULL**, so every plan already
names exactly one care relationship. The boundary exists in the data; the query
only has to honour it:

```
practicePatientLinkId = link.id  AND  patientUserId = link.patientUserId
                                 AND  status = "published"
```

`patientUserId` is asserted even though link ownership implies it: the two
conditions fail independently, and a plan whose link and patient disagree is a
data fault that must not be readable either way.

**Two readings that must not be confused.** `patientUserId` is wider than the
boundary, because one account holds several relationships. `practiceProfileId`
is *also* wider, because one practice can hold several links to one account
(the uniqueness key is `(practiceProfileId, patientUserId, patientProfileId)`).
Both readings agree with the correct one almost everywhere, which is exactly why
either can survive review. `verifyMedicationContextIsolation.test.js` separates
them.

**Items have no API surface.** `MedicationPlanItem` rows are created and deleted
in bulk inside the practice-side plan update transaction. No route accepts an
item id and no route touches the table directly, so item scope is a structural
property rather than a check that could be dropped. The test asserts that
absence, so adding an item-level route forces the scope question to be answered.

**No "current plan" exists in the model.** Publishing does not archive its
predecessor, and there is no unique constraint per link, so several published
plans can stand side by side. The list is ordered newest publication first and
says so in words; order alone is never presented as validity. Drafts, archived
and deleted plans are not patient-visible in any context.

**What is NOT practice-scoped.** The patient's own medication record
(`features/patientOwnMedication`) lives in `localStorage` on the device, has no
server model and belongs to no practice. It must never be shown inside a
practice context, because doing so would attribute the patient's own entries to
a practice. Visit medications (`VisitMedicationEntry`, scoped to a
`PreVisitSession`) and e-prescriptions (`ErezeptEntry`) are separate models with
their own lifecycles and are not part of this scope.

**Lifecycle.** The link FK is `onDelete: Cascade`: deleting a relationship
deletes its plans. Archiving, declining or revoking a link is a status change,
not a delete, so plans survive and stay readable — reading history is allowed
while writing into an ended relationship is not. That is the existing policy and
Phase 2E.3 did not change it.

---

## 7d. Telling two relationships with one practice apart (Phase 2F.0)

The uniqueness key of `PracticePatientLink` is
`(practiceProfileId, patientUserId, patientProfileId)`, so one account can hold
several links to the same practice. `patientProfileId` is **NULL** when the
relationship is the account holder's own; a `PatientProfile` row exists only for
a family profile, and its `displayName` is the name the patient chose for that
person.

Since Phase 2E.1–2E.3 those links carry separate appointments, documents and
medication plans, but they rendered identically — same practice name, same
specialty, same city. Opening the wrong one shows real, authorized data about
the wrong person. That is not a cross-tenant leak; it is a context-selection
failure, and it is exactly as harmful at the point of care.

**The disambiguating field.** `/api/patient/practice-contexts` returns
`patientProfileName`: the profile's `displayName`, or null for the account
holder's own relationship. Nothing else about the profile travels — not the
relation label, not the date of birth, not the profile id. The name is compared
against the session user before it is returned, so a link pointing at another
account's profile falls silent instead of naming the wrong person.

**Shown in all three places, never inferred from absence.** Chooser card,
context bar and switcher dialog all render the same label through
`patientContextLabel()`: the profile name, or the account-holder wording. The
account-holder case is labelled rather than left blank — identifying a
relationship by a *missing* line is a poor thing to hang a medication plan on.
The label also appears in each element's accessible name, so two cards are
distinguishable by screen reader and not only by sight.

**The label is never an identity.** `PracticePatientLink.id` remains the only
context key: navigation, authorization and every scoped query use it. Two cards
may legitimately show the same practice name; nothing resolves a context by
display text. Ordering falls back to the profile name and then to `linkId`, so
two otherwise identical cards keep a stable order instead of inheriting whatever
the database returned.

---

## 7e. e-Prescriptions in a practice context (Phase 2F.1)

`ErezeptEntry.linkId` is a plain **NOT NULL string with no foreign key** on
`PracticePatientLink`. The database guarantees nothing about it, so the scope is
written as if the value could be anything — because it can:

```
linkId = <authorized link's id>  AND  patientUserId = <that link's patient>
                                 AND  deletedAt = NULL
```

A value naming nothing matches nothing. It is never interpreted as a practice
id, and never falls back to a wider list.

**Both conditions are load-bearing.** The entry carries its own `patientUserId`,
so it can disagree with its link. Such a row must be unreadable from *either*
side: the patient it names cannot reach it (the link is not theirs), and the
link's owner cannot either (the patient id does not match).

**Where the value comes from.** Exactly one write site sets `linkId`:
`routes/practiceErezept.js`, from `req.linkAccess.link.id` — server-derived by
`requirePracticePatientLinkAccess`, never from the request body. Under current
code every stored value is therefore a real link id; that is a property of the
application, not of the schema, which is why the scope does not rely on it.

**Foreign key: deferred, deliberately.** The blocker is lifecycle, not data.
`PracticePatientLink.practiceProfileId` is `onDelete: Cascade`, and a practice
*is* deleted in two real flows (practice deletion and account deletion). So an
FK would have to answer: what happens to a prescription when the issuing
practice disappears? `CASCADE` destroys a medical record as a side effect of a
practice closing; `RESTRICT` starts failing an existing deletion flow;
`SET NULL` needs a nullable column and leaves the row unattributable. Today the
row simply survives with a dangling string — a state reached by absence of a
decision, not by one. `scripts/checkErezeptLinkIntegrity.js` is the read-only
preflight for when that decision is made.

**Practice side.** Already link-scoped before this phase: every read carries
`linkId: link.id`, and all three `PRESCRIPTION_*` permissions sit in
`REQUIRES_VERIFIED_QUALIFICATION`, so no role holds them and no practice can
currently issue or cancel anything.

**Artifacts.** The QR code and the PDF are generated in the browser from the
entry the client already holds. There is no artifact endpoint and no download
token, so an entry that cannot be listed cannot be turned into an artifact
either.

---

## 7f. Inbox notices in a practice context (Phase 2G.1)

`PatientInboxItem` is a PERSISTED notice, not a view over other tables, and its
`practicePatientLinkId` is **nullable**. That makes the inbox different from
every artifact migrated before it: some notices name a care relationship, others
name only a practice.

```
practicePatientLinkId = link.id  AND  patientUserId = link.patientUserId
```

**The nullable half is the point.** Five producers create notices without a link
(appointments, telemedicine, data requests, reminders and the generic notifier).
Those are NOT pulled into a context: a notice shown under the wrong relationship
is worse than one the patient has to find in the cross-practice list. Scoping by
`practiceProfileId` would sweep exactly those in, which is why the guard test
plants one and requires every context to refuse it.

**Destinations are rebuilt, never replayed.** Every notice carries a stored
`targetUrl`, written before practice contexts existed: patient-global paths with
no link in them, and one of them
(`/patient/medication-plans/<id>`) no longer matches any route. The scoped API
therefore derives a `targetPath` from the AUTHORIZED link and the notice's kind,
and the stored value never reaches the client. A notice cannot lead into a
context other than its own, because the id it is built from is the one the
request was authorized against.

**Reading changes nothing.** The list endpoint never marks anything read;
acknowledgement is explicit through the PATCH endpoints. That is the inbox's own
long-standing semantics and was kept rather than replaced by the messaging rule.

**Neutral by construction.** Producers write a neutral title and at most a
neutral summary — never a message body, a dosage, a diagnosis or a document's
contents. The context response drops `patientUserId`, `practiceProfileId`,
`practicePatientLinkId`, `sourceRefId` and the practice branding on top of that.

**The cross-practice inbox stays.** Because link-less notices exist and are
legitimate, removing the transitional tile would make them unreachable. It is
kept deliberately, not by omission.

---

## 7g. Video consultations in a practice context (Phase 2G.2)

`TelemedicineSession.practicePatientLinkId` is **nullable**, and deliberately
so. Both creation paths can produce a session without one:
`ensureTelemedicineForAppointment` copies the appointment's link, which is
itself nullable, and `createPracticeSession` leaves it null when the practice
creates a session that is not tied to a connected patient.

```
practicePatientLinkId = link.id  AND  patientUserId = link.patientUserId
```

A session that names a practice but no relationship therefore stays OUT of every
context and remains reachable through the cross-practice page. Scoping by
`practiceProfileId` would sweep exactly those in.

**Listing is not joining.** Every action re-derives its own authorization at the
moment it happens: link ownership, the session belonging to this link, patient
consent, and the link not being revoked. A stale list on the client cannot
become a join. The existing patient-side service functions are called through
rather than reimplemented, so the consent gate and the audit trail come along.

**The room id is a bearer secret.** For the sandbox provider the meeting URL is
`https://meet.jit.si/MedScoutX-<providerRoomId>` — the room id alone opens the
room. It is therefore absent from the context response entirely: anyone holding
a list would otherwise be able to reconstruct the URL and bypass the join
endpoint, which is where consent and revocation are checked. The list says only
`hasJoinLink`; the URL itself is issued by the join call and nowhere else.

**Every** response was hardened in Phase 2G.3: `sessionToJson`, the serializer
shared by the patient and practice endpoints, no longer carries the field, and
neither does the provider `create-room` route. The room id still reaches the
adapter — that is how a URL gets built — but only from the Prisma row, inside
`patientJoinWaitingRoom()` and `startPracticeSession()`, after their gates.

**Known limitation, not solved here.** `joinToken` and `hostToken` are generated
and stored as hashes, but `getJoinUrl()` falls back to
`sandboxJitsiUrl(providerRoomId)` and never verifies them against the provider.
So the room id is not merely *a* secret — it is the *only* one, and the Jitsi
room itself is unauthenticated: anyone who ever learns the id keeps access, and
`linkRevokedAt` stops MedScoutX from handing the URL out again but cannot close
the room. Withholding the id limits who can learn it; it does not make the room
revocable. A real provider integration has to bind access to a token the
provider itself checks.

**Participants are roles, not people.** The detail response exposes each
participant's role and state; the account behind it is not needed and does not
travel.

---

## 8. Feature gating

`requireCommunicationV2Feature` returns **404**, not 403, when the module is
disabled, so a disabled capability is indistinguishable from one that does not
exist. `requireCommunicationAiDraftsFeature` does the same.

---

## 9. Changing any of this

If you touch messaging, document or medication authorization, consent or read
state:

1. `npm test --prefix server` must stay green (1001 tests).
2. `server/scripts/verifyMessagingIsolation.test.js`,
   `server/scripts/verifyDocumentContextIsolation.test.js` and
   `server/scripts/verifyMedicationContextIsolation.test.js` and
   `server/scripts/verifyPracticeContextDisambiguation.test.js` and
   `server/scripts/verifyErezeptContextIsolation.test.js` and
   `server/scripts/verifyInboxContextIsolation.test.js` and
   `server/scripts/verifyTelemedicineContextIsolation.test.js` and
   `server/scripts/verifyTelemedicineSecretExposure.test.js` must stay green,
   and any new access path needs a matching negative test.
3. Do not repair a failing invariant test by weakening its assertion.
4. Verify the tests still bite: temporarily break the guard you changed and
   confirm a test fails.
