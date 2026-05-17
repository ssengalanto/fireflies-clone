# Feature Specification: Fireflies Clone

**Feature Branch**: `001-fireflies-clone`
**Created**: 2026-05-17
**Status**: Draft
**Input**: User description: "Build a Fireflies.ai clone with meeting capture, AI-generated summaries, action-item extraction, and a searchable meeting history. Use TDD."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Capture a meeting and view its transcript (Priority: P1)

A user begins a new meeting from the dashboard, records audio while the conversation happens, stops the recording, supplies the transcript text, and then sees the saved meeting (title, date, participants, duration, transcript) in their meeting history.

**Why this priority**: This is the foundational journey of the product. Without the ability to capture a meeting and produce a saved transcript, no downstream feature (summary, action items, search) has any input to operate on. Even with everything else stripped away, this slice alone gives the user a usable place to record and look back at meetings.

**Independent Test**: Open the app, create a new meeting via the new-meeting form, start a recording, stop it, paste a transcript, save, and confirm the meeting appears in the dashboard list and on its own detail page with all the entered fields persisted across a page reload.

**Acceptance Scenarios**:

1. **Given** the dashboard is empty, **When** a user fills the new-meeting form with a valid title, participant list, and date and confirms, **Then** the new meeting appears at the top of the dashboard list immediately and remains after reload.
2. **Given** a user has just created a meeting, **When** they start a recording from the meeting detail page and stop it, **Then** they are prompted to enter a transcript and the transcript is saved against the meeting.
3. **Given** an existing meeting with a saved transcript, **When** the user opens the meeting detail page, **Then** the title, date, participants, duration, and full transcript are visible.
4. **Given** the new-meeting form is open with invalid input (empty title, malformed participant email, no participants), **When** the user attempts to submit, **Then** the form blocks the submit and surfaces a field-level message for each invalid field.

---

### User Story 2 — Generate an AI summary from a transcript (Priority: P2)

From a meeting that already has a transcript, the user triggers AI summarisation and watches a concise prose summary stream into the page token by token, with a clear in-progress indicator.

**Why this priority**: The AI summary is the signature value proposition — it's the reason a user would use this product over plain notes. It's P2 because it depends on Story 1 (a transcript must exist) but unlocks immediately as soon as one does.

**Independent Test**: Open a meeting that has a transcript, click "Generate summary", and confirm prose begins streaming into the page within a few seconds and renders incrementally rather than appearing all at once.

**Acceptance Scenarios**:

1. **Given** a meeting with a non-empty transcript, **When** the user clicks "Generate summary", **Then** a streaming summary begins rendering token by token and a visual indicator shows generation is in progress.
2. **Given** a summary has already been generated for a meeting, **When** the user re-opens that meeting, **Then** the existing summary is shown instantly without triggering a new generation request.
3. **Given** a meeting with no transcript or a transcript below the minimum useful length, **When** the user attempts to generate a summary, **Then** the action is disabled or blocked with a clear message.
4. **Given** the AI request fails mid-stream, **When** the failure occurs, **Then** the user sees a recoverable error state and can retry without losing the rest of the meeting's data.

---

### User Story 3 — Extract action items from a transcript (Priority: P2)

From a meeting with a transcript, the user triggers action-item extraction and sees a structured list of follow-up tasks pulled from the conversation.

**Why this priority**: Action items are the second AI-driven payoff and reinforce the time-saving value. They share a priority with the summary because both feed off the same transcript and together demonstrate the core AI integration; the team may choose to implement either one first.

**Independent Test**: Open a meeting with a transcript, click "Extract action items", and confirm a list of discrete items appears, even when the AI response includes extraneous formatting around the structured payload.

**Acceptance Scenarios**:

1. **Given** a meeting with a non-empty transcript, **When** the user clicks "Extract action items", **Then** a structured list of items appears on the page.
2. **Given** the AI returns a response wrapped in extraneous formatting (e.g. markdown fences around the data), **When** the response is parsed, **Then** the items still render correctly and no error is shown to the user.
3. **Given** the AI returns a malformed response that cannot be parsed at all, **When** parsing fails, **Then** an empty list is shown with a non-blocking notice rather than a crash.
4. **Given** action items have already been extracted for a meeting, **When** the user re-opens it, **Then** the existing list is shown instantly without re-triggering generation.

---

### User Story 4 — Browse, filter, and search meeting history (Priority: P3)

From the dashboard the user scrolls through past meetings, filters them by status (e.g. recorded, summarised, all), and narrows the list with a text search. The filter state persists across page reloads.

**Why this priority**: Once a user has accumulated more than a handful of meetings, the unfiltered list becomes hard to navigate. This story is P3 because the app is still usable with a small number of meetings — the journey is essential for retention rather than first use.

**Independent Test**: With several seeded meetings of mixed status, change a filter and confirm the visible list updates instantly; reload the page and confirm the filter selection is still active.

**Acceptance Scenarios**:

1. **Given** the dashboard contains many meetings spanning multiple statuses, **When** the user selects a status filter and types in the search field, **Then** the list narrows in real time and only matching meetings are shown.
2. **Given** the user has narrowed the list with filters, **When** they reload the page, **Then** the same filters are applied automatically.
3. **Given** the user has reloaded the page, **When** they look at any selection or wizard state from a prior session, **Then** that state is reset to its initial values (only filters and in-progress drafts persist).
4. **Given** the list is long enough to require multiple pages of data, **When** the user scrolls to the end, **Then** the next batch loads without requiring a manual "next page" click.

---

### User Story 5 — Sign in to access personal meetings (Priority: P4)

A user signs in from the login screen, lands on the dashboard, and stays signed in across page reloads until they explicitly sign out.

**Why this priority**: For a single-device local-first build the login experience is a thin gate — meetings are stored locally and only one user is expected at a time. It's still worth shipping because it establishes the surface for future multi-user work and gives the dashboard a clear post-login landing point.

**Independent Test**: Submit valid credentials at the login screen, land on the dashboard, reload the page, and confirm the dashboard still loads without being redirected back to login.

**Acceptance Scenarios**:

1. **Given** the user is not signed in, **When** they visit any protected route, **Then** they are routed to the login screen.
2. **Given** the user enters valid credentials at the login screen, **When** they submit, **Then** they land on the dashboard and remain signed in across reloads.
3. **Given** the user is signed in, **When** they sign out, **Then** their authenticated session is cleared and they are returned to the login screen.

---

### Edge Cases

- **Empty or near-empty transcript**: Summary/action-item generation is disabled or returns a clear "transcript too short" message rather than burning an AI request.
- **AI response cannot be parsed at all**: Action items fall back to an empty list; summary shows a recoverable error so the user can retry without losing other data.
- **Browser reload mid-recording**: The in-progress recording is lost (recording state is intentionally not persisted) but no other meeting data is affected.
- **Modal closed mid-form**: An in-progress new-meeting draft is restored when the user re-opens the modal, but only until they explicitly submit or discard it.
- **Local storage quota exceeded**: The user sees a non-fatal error explaining they need to delete old meetings to save a new one; existing meetings are not corrupted.
- **Multiple browser tabs**: Edits made in one tab eventually become visible in another, even without an explicit refresh.
- **Slow or interrupted network**: AI generation in flight communicates a clear in-progress state and surfaces a retry affordance on failure.
- **Transcript far exceeds AI input limits**: The user is warned before the request is made rather than seeing an opaque server error after waiting.

## Requirements *(mandatory)*

### Functional Requirements

**Meeting capture and persistence**

- **FR-001**: The system MUST let users create a new meeting by providing a title, a list of participant identifiers, and a date.
- **FR-002**: The system MUST validate every meeting creation: title is required and non-empty, participant identifiers are well-formed, and the participant list is non-empty.
- **FR-003**: The system MUST persist meetings across page reloads on the user's device, without requiring an external account.
- **FR-004**: The system MUST capture audio from the user's microphone when a recording is started and let the user stop the recording at any time.
- **FR-005**: After a recording is stopped, the system MUST let the user supply the transcript text for that meeting (typed or pasted).
- **FR-006**: The system MUST associate a saved transcript with the meeting that produced it and expose both on the meeting detail page.

**AI-driven outputs**

- **FR-007**: The system MUST let the user generate a prose summary from a meeting's transcript via a single explicit action.
- **FR-008**: Summary output MUST be rendered progressively as it is produced (token-by-token streaming) so the user perceives immediate feedback.
- **FR-009**: The system MUST let the user generate a structured list of action items from a meeting's transcript via a single explicit action.
- **FR-010**: Action-item extraction MUST tolerate responses that wrap the structured payload in extraneous text or formatting and still produce a usable list.
- **FR-011**: When extraction cannot produce any usable items, the system MUST default to an empty list and surface a non-blocking notice — never a crash.
- **FR-012**: Once a summary or action-item list has been generated for a meeting, the system MUST reuse the cached result on subsequent views rather than re-issuing the AI request.
- **FR-013**: The system MUST never expose the AI provider's API credentials to the user's browser.

**Browsing and filtering**

- **FR-014**: The system MUST display a list of all meetings the user has created, ordered with the most recent first.
- **FR-015**: The system MUST let the user filter the list by meeting status (e.g. all, recorded, summarised) and by a free-text search term.
- **FR-016**: The system MUST persist the user's filter selections across page reloads, but MUST NOT persist transient selection or wizard state.
- **FR-017**: The meeting list MUST support paged or incremental loading so a long history does not block the initial dashboard render.
- **FR-018**: While a new-meeting form is in progress, the system MUST preserve the in-progress draft if the modal is closed and re-opened, until the user submits or explicitly discards it.

**Authentication**

- **FR-019**: The system MUST require a user to be authenticated before viewing or creating meetings.
- **FR-020**: Authenticated sessions MUST survive page reloads until the user explicitly signs out.
- **FR-021**: Unauthenticated visits to a protected route MUST be redirected to the login screen.

**Reliability and feedback**

- **FR-022**: Every action that performs network work (creating a meeting, generating a summary, extracting action items, signing in) MUST surface an explicit loading indicator while it is in flight.
- **FR-023**: Every action that can fail MUST surface a recoverable error state with a retry affordance, without losing unrelated data on the page.
- **FR-024**: When a user creates a meeting, the new item MUST appear in the list immediately and roll back gracefully if the create request fails.

### Key Entities

- **User**: An authenticated individual who creates and owns meetings. Identified by a stable identifier and a display name. A single user instance is active at any time on a given device.
- **Meeting**: A captured conversation owned by a single user. Attributes include title, scheduled date, participant list, duration, recording status, and optional transcript. Has zero or one summary and zero or many action items.
- **Transcript**: The textual record of a meeting, supplied after the recording stops. Attached one-to-one to a meeting.
- **Summary**: A prose AI-generated summary derived from a single transcript. Cached against the meeting once generated; treated as immutable.
- **Action Item**: A discrete follow-up task extracted from a transcript. A meeting has zero or many. The full set is cached against the meeting once extracted.
- **Meeting Draft**: An in-progress, unsaved new-meeting form payload retained while the user is composing it. Persists across modal close/reopen and reload until submitted or explicitly discarded.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can sign in, create a new meeting, and save its transcript in under 2 minutes on first use, without consulting documentation.
- **SC-002**: Streamed AI summaries begin rendering visible text within 3 seconds of the user triggering generation on a typical broadband connection.
- **SC-003**: Re-opening a meeting that already has a summary or action-item list shows the cached output instantly, with no perceived loading state.
- **SC-004**: At least 95% of action-item extractions on real transcripts produce a non-empty, sensibly formatted list — the remaining 5% degrade to an empty list with a notice rather than a crash.
- **SC-005**: The dashboard loads and becomes interactive in under 1 second for a meeting history of up to 200 entries.
- **SC-006**: Filter and search selections made by the user remain in effect after a full page reload in 100% of cases.
- **SC-007**: A user can complete the full happy path (sign in → create meeting → record → paste transcript → generate summary → extract action items) without encountering a dead-end error state — every failure surface offers a retry.
- **SC-008**: The provider API key is never present in any payload, header, or response visible to the browser, verified by inspecting network traffic during the full happy path.

## Assumptions

- **Single user per device**: The product targets one signed-in user per device at a time. Multi-user collaboration on the same meeting is out of scope for v1.
- **Local-first persistence**: Meetings, transcripts, summaries, and action items live on the user's device. There is no cross-device sync. A future iteration may move storage to a server.
- **Authentication is a soft gate**: Login establishes the post-login surface and gates the dashboard, but credentials are not verified against a remote identity provider in v1. The user object and session are stored locally.
- **Recording vs. transcription**: The product captures audio from the microphone but does not perform automatic speech-to-text in v1. The user supplies the transcript by typing or pasting after the recording stops. This is documented to the user.
- **AI provider**: The AI features (summary, action items) are produced by a single hosted AI service whose API key lives only on the server. The user does not configure or provide their own key.
- **No real-time collaboration**: Edits to a meeting are made by one user at a time. Multi-tab consistency is best-effort, not transactional.
- **Browser support**: Latest two versions of Chrome, Safari, Firefox, and Edge on desktop. Mobile browsers are best-effort and not part of v1 acceptance.
- **Test-driven development is mandatory**: Every functional requirement above is reachable by a failing test written before its implementation, ordered schema → store → hook → component.
- **Reasonable transcript size**: Transcripts are expected to fit within a single AI request's input window. Very long transcripts (multi-hour) are out of scope for v1 and surface a clear "too long" message instead of a partial result.

## Dependencies

- **Hosted AI service** for generating summaries and action items, accessed exclusively via a server-side proxy.
- **Browser MediaRecorder API** for capturing audio. The product degrades gracefully (with a clear message) on browsers that do not expose it.
- **Browser local storage** for persisting meetings, drafts, filters, and the auth session. The product surfaces a clear error when the storage quota is exhausted.
