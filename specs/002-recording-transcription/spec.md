# Feature Specification: Automatic Transcription from Recording

**Feature Branch**: `002-recording-transcription`
**Created**: 2026-05-18
**Status**: Draft
**Input**: User description: "in 001-fireflies-clone the auto transcribe is out of scope, now we want to implement the transcription functionality based on the recorded message"

## Context

Feature `001-fireflies-clone` shipped microphone capture but explicitly punted automatic speech-to-text: after the user stopped a recording they were prompted to type or paste the transcript themselves (see `001-fireflies-clone/spec.md` FR-005 and the "Recording vs. transcription" assumption). This feature lifts that limitation by turning the recorded audio into transcript text automatically, so manual paste-in is no longer the default path.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Recording is transcribed automatically when stopped (Priority: P1)

A user records a meeting from the meeting detail page. When they stop the recording, the system automatically produces the transcript from the audio and attaches it to the meeting. The user does not need to type or paste anything to get a usable transcript.

**Why this priority**: This is the entire reason the feature exists. Today every recorded meeting requires the user to manually supply the transcript before any downstream AI value (summary, action items) is reachable. Removing that step turns recording into a one-tap path from speech to saved transcript and unblocks the rest of the product for hands-free use.

**Independent Test**: From a meeting detail page, start a recording, speak (or play sample audio), stop, and confirm that transcript text appears on the meeting without the user typing into a transcript field — and that the saved meeting persists this transcript across a page reload.

**Acceptance Scenarios**:

1. **Given** a meeting with no transcript, **When** the user starts a recording, speaks, and stops it, **Then** the system produces and saves a transcript from the recorded audio and shows it on the meeting detail page within a clearly bounded time.
2. **Given** transcription is in progress after the user stops a recording, **When** the work is still running, **Then** a visible in-progress indicator is shown on the meeting detail page so the user knows the transcript is being produced and has not been forgotten.
3. **Given** a successful transcription has been saved against a meeting, **When** the user reloads the page or revisits the meeting later, **Then** the transcript text is still attached to the meeting and the system does not re-run transcription.
4. **Given** a meeting that already has a transcript, **When** the user starts a new recording on that meeting, **Then** the system makes clear how the new transcription relates to the existing transcript (replace vs. discard) before it commits the change.

---

### User Story 2 — Review and edit the auto-generated transcript before it is final (Priority: P2)

After automatic transcription completes, the user can review the produced text and correct mistakes (mishears, missing punctuation, wrong names) before any downstream AI step runs against it.

**Why this priority**: No speech-to-text is perfect. Names, jargon, and overlapping voices are all common failure modes. Giving the user a review pass before summary/action-item extraction protects the quality of the downstream AI output and preserves the manual-entry path as a corrective tool rather than the default. It is P2 because the feature is useful without it (P1 alone already removes the manual step) but the product feels noticeably worse if the user cannot fix obvious errors.

**Independent Test**: After an auto-transcription completes, edit a single word in the produced text, save, and confirm the edited transcript is what gets persisted and what subsequent summary/action-item generation operates on.

**Acceptance Scenarios**:

1. **Given** auto-transcription has just produced text, **When** the user views the meeting detail page, **Then** the produced transcript is presented in an editable form before it is treated as final.
2. **Given** the user edits the auto-generated transcript and saves, **When** they reload the meeting, **Then** the saved transcript reflects their edits, not the original auto-generated text.
3. **Given** the user discards the auto-generated transcript without saving, **When** they leave the page, **Then** the meeting reverts to having no transcript (auto-generated text is not retained as a side effect).
4. **Given** the user later triggers summary or action-item generation, **When** that AI step runs, **Then** it operates on the user-edited transcript, not the raw auto-generated text.

---

### User Story 3 — Graceful fallback to manual transcript when auto-transcription cannot succeed (Priority: P3)

If automatic transcription fails (network error, audio too long, audio too quiet, provider error), the user is offered a clear recovery path — retry, or fall back to typing/pasting the transcript as they did before this feature existed.

**Why this priority**: P3 because it only fires on the unhappy path, but it is essential: without it the feature regresses the product for any user whose audio cannot be transcribed. The original manual-paste flow remains a valid fallback and must be reachable in one click from the failure state.

**Independent Test**: Force a transcription failure (e.g. by capturing an oversized recording or simulating a provider error), confirm the user sees a recoverable error with both a retry affordance and a manual-entry affordance, and confirm both paths produce a usable, saved transcript on the meeting.

**Acceptance Scenarios**:

1. **Given** automatic transcription fails after the user stops a recording, **When** the failure surfaces, **Then** the user sees a non-fatal error explaining what went wrong and offering both retry and manual-entry options.
2. **Given** the audio exceeds the supported maximum duration or size, **When** the user stops the recording, **Then** the user is told before any transcription attempt is made and is routed straight to the manual-entry or shorten-recording paths.
3. **Given** the user chooses manual entry from the failure state, **When** they submit typed transcript text, **Then** that transcript is saved against the meeting exactly as it would have been in the v1 manual flow.
4. **Given** the recorded audio contains no detectable speech, **When** transcription completes, **Then** the user is shown a clear "no speech detected" state with the same retry / manual-entry choices, not an empty transcript silently saved as if it succeeded.

---

### Edge Cases

- **Browser reload mid-transcription**: The in-flight transcription is lost (it is not resumed in a new tab), the recorded audio is not retained, and the user is returned to a state where they can re-record or enter the transcript manually — no other meeting data is affected.
- **Audio exceeds provider input limits**: The user is warned at recording-stop time and routed to manual entry; the system does not attempt the request and then fail opaquely.
- **No speech detected in audio**: Surfaced as a distinct, non-fatal state (not an empty success). Retry and manual-entry are offered.
- **Mixed-language audio**: Best-effort — the produced transcript may contain language tagging or fall back to the dominant language; the user can correct it during review (US2).
- **User stops recording immediately (effectively silent)**: Treated as "no speech detected" rather than a hard error.
- **Provider quota or rate limit hit**: Surfaced as a recoverable error with retry; manual entry remains reachable. The provider's API key is never exposed to the browser.
- **Transcript-too-long for downstream AI**: After transcription, if the produced transcript exceeds the limits the summary / action-item flows already enforce, the existing "too long" message applies — no new copy needed.

## Requirements *(mandatory)*

### Functional Requirements

**Automatic transcription**

- **FR-001**: The system MUST convert the audio captured during a recording into transcript text automatically when the user stops the recording, without requiring the user to type or paste.
- **FR-002**: The system MUST associate the produced transcript with the meeting that produced the recording and persist it under the same rules as a manually-entered transcript today (survives reloads, available to downstream summary and action-item flows).
- **FR-003**: While transcription is in progress the system MUST surface a visible in-progress indicator on the meeting detail page so the user knows the transcript is being produced.
- **FR-004**: The system MUST NOT re-run transcription for a meeting that already has a saved transcript unless the user explicitly initiates a new recording on that meeting.
- **FR-005**: When the user initiates a new recording on a meeting that already has a transcript, the system MUST make the replace-vs-keep choice explicit before the existing transcript is overwritten.

**Review and edit**

- **FR-006**: The system MUST present the auto-generated transcript in an editable form before it is treated as final input for downstream AI features.
- **FR-007**: The system MUST persist the user-edited transcript, not the raw auto-generated text, once the user confirms.
- **FR-008**: If the user discards the review without confirming, the system MUST NOT silently retain the auto-generated transcript on the meeting.
- **FR-009**: Summary and action-item generation MUST operate on the transcript the user confirmed (edited or accepted as-is), never on an earlier draft.

**Failure handling and fallback**

- **FR-010**: When transcription fails the system MUST surface a non-fatal, user-readable error and offer both a retry and a manual-entry affordance from the same screen.
- **FR-011**: The system MUST detect oversize or over-long recordings before attempting transcription and route the user to the manual-entry or shorten-recording paths instead of failing opaquely afterwards.
- **FR-012**: When transcription produces no detectable speech, the system MUST surface a distinct "no speech detected" state rather than saving an empty transcript as a success.
- **FR-013**: The manual-entry path that existed in v1 MUST remain reachable from the failure state and MUST save the transcript with the same persistence guarantees as the auto path.

**Privacy, security, and operational guardrails**

- **FR-014**: The system MUST NOT expose any credentials used to access an external transcription provider to the browser, in the same way it already protects AI provider credentials.
- **FR-015**: The system MUST NOT retain the recorded audio beyond what is required to produce the transcript. Once the transcript is saved (or the attempt is abandoned), the audio MUST be released.
- **FR-016**: Every transcription attempt that performs network work MUST surface a loading indicator while it is in flight, consistent with the existing reliability/feedback contract from v1.
- **FR-017**: Audio sent for transcription MUST be authenticated as the signed-in user's, so an unauthenticated visitor cannot trigger a transcription request through the same surface.

### Key Entities

- **Recording**: An audio capture session associated with one meeting. Has a start time, a stop time, a duration, and the captured audio payload. Exists only long enough to be transcribed; not persisted as durable state.
- **Auto-generated Transcript Draft**: The transcript text produced by automatic transcription, presented to the user for review. Distinct from a saved Transcript: it is not yet attached to the meeting and is discarded if the user does not confirm it.
- **Transcript** (existing): The textual record attached one-to-one to a meeting. Unchanged in shape from v1 — what changes is the path that produces it.
- **Meeting** (existing): Gains no new persisted fields from this feature; its transcript field is now reachable via the automatic path instead of only via manual entry.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After stopping a recording of typical meeting length (up to 10 minutes), at least 90% of users see a usable transcript appear without needing to type or paste anything.
- **SC-002**: For recordings up to 5 minutes long on a typical broadband connection, the produced transcript becomes visible to the user within 15 seconds of them stopping the recording.
- **SC-003**: For a clean recording of conversational English, the produced transcript matches what was said well enough that the user makes at most light edits (under 10% of words changed) before confirming.
- **SC-004**: 100% of transcription failures — whether caused by oversized audio, no detected speech, or provider error — present the user with both a retry and a manual-entry option on the same screen. No failure terminates in a dead-end state.
- **SC-005**: Re-opening a meeting that already has an auto-transcribed and confirmed transcript shows the saved text instantly and does not trigger a new transcription request.
- **SC-006**: Inspecting network traffic during the full recording → transcription → save flow shows that no transcription-provider credential is present in any request, response, or payload visible to the browser.
- **SC-007**: After the user confirms or discards the auto-generated transcript, the captured audio is no longer retrievable from the client, verifiable by inspecting client-side state.

## Assumptions

- **Server-mediated transcription**: Automatic transcription is produced by a hosted speech-to-text service accessed only through a server-side proxy, in the same key-isolation pattern that v1 already uses for the AI summary/action-item provider. The browser never sees the credential.
- **Batch, not live**: Transcription runs after the user stops the recording, not as a live partial-token stream during capture. Live-streamed partials are out of scope for this feature.
- **Single dominant language**: The auto-transcription target is the dominant language of the audio. Multi-language audio is best-effort, corrected by the user during the review step.
- **Audio is transient**: Recorded audio is sent to the transcription service, then released. The product does not store raw audio against the meeting. Users who need an audio archive must export externally — out of scope here.
- **Maximum recording length**: Recordings beyond the provider's per-request input limit are rejected at stop time with a clear message. The exact cap is the smaller of the provider's hard limit and a product-level cap chosen during planning; this is a planning detail rather than a spec-level constant.
- **Manual entry stays first-class**: The manual-paste path from v1 is not removed. It moves from being the default to being the fallback, reachable from the transcription failure state. Tests that previously exercised the manual flow remain valid.
- **Existing AI features are unchanged downstream**: Summary and action-item generation continue to consume a confirmed transcript exactly as they do today; they do not need to be aware of how that transcript was produced.
- **Authentication continues to gate access**: All transcription-related surfaces sit behind the existing auth gate from v1.
- **TDD remains mandatory**: Every functional requirement above is reachable by a failing test written before its implementation, ordered schema → store → hook → component, consistent with the project's existing discipline.

## Dependencies

- **Hosted speech-to-text service**, accessed exclusively via a server-side proxy. Credential isolation rules from v1 apply unchanged.
- **Existing v1 meeting capture surface** (microphone capture, recording start/stop, meeting detail page). This feature replaces what happens after the stop event; it does not redesign the capture itself.
- **Existing v1 transcript persistence** (the Transcript entity and its attachment to a Meeting). This feature writes into that same shape; downstream AI features remain unaware of how the transcript was produced.
- **Existing v1 authentication gate**. Transcription requests require a signed-in user.
