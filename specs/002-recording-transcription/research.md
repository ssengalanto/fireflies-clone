# Phase 0 Research: Automatic Transcription from Recording

This document resolves the open technical questions that the spec deliberately deferred to planning. Each entry follows the format **Decision / Rationale / Alternatives considered**, and each decision is testable against the artifacts that follow in Phase 1.

---

## R-001 — Choice of speech-to-text provider

**Decision**: Use **OpenAI's `whisper-1` model**, accessed via the official `openai` Node SDK from a single server route (`app/api/transcribe/route.ts`).

**Rationale**:
- The existing AI flow (summary, action items) uses Anthropic. Anthropic does not currently offer a hosted speech-to-text API, so the transcription provider has to be a separate vendor. Bringing in a second vendor is unavoidable.
- Whisper is the lowest-friction option: a single SDK call, accepts the `Blob` produced by `MediaRecorder` directly (as a `File`), no streaming setup required, and predictable per-minute pricing.
- A 25 MB hard input cap is documented and easy to enforce client-side before upload, which means the user gets the "too long" message before any bytes leave their browser.
- The project's existing key-isolation gate (one file owns `@anthropic-ai/sdk`) generalises: we add a parallel gate ("exactly one file owns `openai`"). No new gate *category* is needed, just a second instance.

**Alternatives considered**:
- **Deepgram**: faster and cheaper per minute, with streaming support. Rejected for v1 because we already chose batch (R-004) and the savings don't justify a second vendor relationship for a single-user local-first product.
- **AssemblyAI**: similar to Deepgram on price/features; same rejection.
- **Google / Azure STT**: cloud-account friction (service-account JSON, project IDs, region selection) is heavier than an `OPENAI_API_KEY` env var. Rejected.
- **Browser-native `SpeechRecognition` API**: would avoid the server hop entirely, but it is Chrome-only, ships words on-the-fly without sentence-level punctuation, and gives no quality knobs. Rejected — it would push the "graceful fallback" path from "occasional" to "everyday" for non-Chrome users.
- **Fold into `/api/claude`**: rejected (covered separately in R-005).

---

## R-002 — Maximum recording size and duration cap

**Decision**: Reject uploads larger than **25 MB** at the client before the request is built. Surface a clear "recording is too long" message and route the user to the manual-entry path (FR-011).

**Rationale**:
- 25 MB is the provider's hard input cap; sending anything larger is wasted bytes.
- `MediaRecorder` with the default Chrome/Firefox `audio/webm; codecs=opus` settings produces roughly 24 kbps — so 25 MB is approximately **140 minutes** of audio. That is well beyond the "typical meeting" target in the spec (SC-001 cites 10 minutes), so the cap will only fire on outliers.
- A second, product-level cap on duration is **not** added. The byte cap is sufficient and avoids redundant guard logic. If a future provider has a different cap, the constant lives in one place: `lib/fetchers/transcribe.fetcher.ts`.
- The check is enforced client-side **before** building the request so the user sees the rejection synchronously. The server still verifies the size as a defense-in-depth check (the route returns HTTP `413` if the multipart body exceeds the cap).

**Alternatives considered**:
- **Time-based cap (e.g. 20 minutes)**: rejected because it requires reading audio duration metadata before upload, which `MediaRecorder` does not give us cleanly. Byte size is reliable and immediate.
- **No client-side cap, trust the server**: rejected because the user wastes upload bandwidth before seeing the rejection, and on slow networks that is a real cost.

---

## R-003 — Audio format and codec

**Decision**: Send the `Blob` produced by `MediaRecorder` **as-is**, using its native MIME type, as the `audio` field of a multipart/form-data request. No client-side transcoding.

**Rationale**:
- Chrome and Firefox produce `audio/webm; codecs=opus` by default. Safari produces `audio/mp4`. Both formats are accepted by `whisper-1` directly (the provider's documentation lists `webm`, `mp4`, `mpga`, `wav`, `m4a`, `mp3` among others). No transcoding is necessary.
- Transcoding in the browser would require pulling in `lamejs`, `ffmpeg.wasm`, or similar — a multi-megabyte runtime cost for zero quality gain.
- The server route forwards the file to the SDK with `File(blob, 'recording.webm', { type: blob.type })`. The filename is cosmetic; the provider routes on MIME type.

**Alternatives considered**:
- **Transcode everything to wav on the server**: would give a uniform format end-to-end. Rejected because it adds server CPU cost for no accuracy gain.
- **Force `audio/webm` on Safari by switching to `MediaRecorder` with an explicit `mimeType`**: rejected — Safari's `MediaRecorder` does not support opus, and forcing the mime type silently fails. Sending the native format is simpler.

---

## R-004 — Streaming vs. batch transcription

**Decision**: **Batch** — the audio is sent after the user stops the recording, and the produced transcript is returned in a single response.

**Rationale**:
- Live-streamed partials would require either a WebSocket-based provider (Deepgram, AssemblyAI) or `Whisper`-running-locally — both are out of scope. Whisper's hosted API is request/response.
- The spec's measurable outcomes (SC-002: "transcript visible within 15 s for recordings up to 5 min") are reachable with batch. Streaming would only matter for live captioning, which is not in scope.
- Batch keeps the server route a normal `POST` returning JSON, which is much simpler to test than a chunked-stream response and reuses no infrastructure from `/api/claude` (which streams text).

**Alternatives considered**:
- **Streaming via Whisper's word-level timestamps + chunked decoding on the server**: rejected — the provider's hosted API does not stream tokens to the caller, only word-level timestamps in the final response.

---

## R-005 — Endpoint design: new route vs. extend `/api/claude`

**Decision**: A **new** route, `POST /api/transcribe`, separate from `/api/claude`.

**Rationale**:
- Different vendor SDK (`openai` vs `@anthropic-ai/sdk`).
- Different transport: multipart/form-data carrying a `Blob` vs. JSON carrying a `transcript` string.
- Different response shape: a JSON object (`{ transcript, durationSeconds }`) vs. a streamed text body.
- The "exactly one file imports vendor SDK X" gate is the strongest guarantee we have against accidental key leaks. Folding both vendors into one route would force that file to import both SDKs and would dilute the gate.
- The two routes share the *pattern* (server-only key, defensive parser server-side, security test in `__tests__/security/api-key-isolation.test.ts`), but not the *code*. That is the right unit of reuse for this codebase: the convention is shared, the implementations are sibling files.

**Alternatives considered**:
- **Fold transcription into `/api/claude` with a `type: 'transcribe'` discriminator**: rejected (above).
- **Build a generic `/api/ai/[provider]/[op]` route**: rejected as premature abstraction — there are only two AI endpoints in the entire product.

---

## R-006 — Client-side review pattern after auto-transcription

**Decision**: The auto-generated text becomes the **`initialValue`** of the existing `TranscriptEditor`. The user confirms via the existing **Save transcript** button, which already runs `useUpdateTranscript`. If the user navigates away without saving, the produced text is discarded.

**Rationale**:
- This is the smallest behavioural change consistent with FR-006 to FR-009. The persistence path is unchanged; what changes is who supplies the initial text.
- It preserves the existing test coverage of `TranscriptEditor` and `useUpdateTranscript` without modification.
- "Discard if the user navigates away" falls out for free because the produced text lives in component-local state, not in a store. No explicit discard logic is needed.
- It removes any ambiguity about "what does the AI step run on" (FR-009) — the answer is "whatever the user last saved", same as today.

**Alternatives considered**:
- **Auto-save the produced text immediately, then let the user edit**: rejected — the spec is explicit that auto-generated text must not be saved without confirmation (FR-007, FR-008, AC-3 of US2).
- **Build a dedicated review screen with separate "Accept" / "Edit" / "Discard" buttons**: rejected — the existing editor already supports exactly this flow (the user can edit before they click Save). One extra button surface would be redundant.

---

## R-007 — Failure and fallback handling

**Decision**: A single new component, `TranscriptionFallback`, renders the failure state. It exposes three buttons:

1. **Retry** — re-trigger the auto-transcription with the same `Blob` (if still in memory).
2. **Enter manually** — clear the blob, show the existing `TranscriptEditor` with an empty initial value.
3. **Re-record** — clear the blob and switch the recording controls back to `idle`.

A typed `TranscriptionError` union (`NETWORK | TOO_LARGE | NO_SPEECH | PROVIDER`) drives the message and which buttons render. `NO_SPEECH` and `TOO_LARGE` do not show **Retry** (retrying would fail the same way); they show **Re-record** and **Enter manually**. Other failures show all three.

**Rationale**:
- Centralises every failure surface in one component, satisfying SC-004 ("100 % of failures present retry and manual-entry on the same screen") with a single test target.
- Typed reasons let the test enumerate every case without conditional branches in component code.
- The blob is held in `useRecording`'s state, so retry is cheap (no re-record). After the user picks Re-record or Enter-manually, we explicitly clear the blob to release memory (FR-015).

**Alternatives considered**:
- **One unified error state with "Try again" as the only affordance, and a separate "Enter manually" link**: rejected — SC-004 requires both affordances on the same screen.
- **Inline error rendering inside `TranscriptEditor`**: rejected — confuses two responsibilities (the editor renders fields, the fallback renders recoveries).

---

## R-008 — Detecting "no speech detected"

**Decision**: The server returns HTTP `422 { "error": "No speech detected" }` when either:

1. The Whisper response's `text` trims to empty, **or**
2. Every segment in the `verbose_json` response has `no_speech_prob > 0.6`.

The client maps `422` to `TranscriptionError.NO_SPEECH`.

**Rationale**:
- Whisper rarely returns an empty `text` on silent audio. Instead it **hallucinates** a small set of stock phrases — "Bye.", "Thanks for watching!", "you", "Thank you.", "[Music]" — that are clearly not what the user said. The empty-string check alone would let those through and silently save a fake transcript.
- The `no_speech_prob` field is emitted on every segment when we request `response_format: 'verbose_json'` (which we already do). It is the model's own probability that the segment is silent. `> 0.6` is OpenAI's documented threshold and matches WhisperX's default.
- We check "every segment > 0.6" rather than "any segment > 0.6" so that a recording with some silence at the start and real speech in the middle still produces a transcript. Only when the *entire* recording is classified as silence do we reject.
- `422 Unprocessable Entity` is the closest semantic match — the request was valid, but no transcript could be produced. `200 + empty transcript` is rejected because it would force the client to recognise the empty-string case at every callsite, and `4xx` makes it impossible to confuse with success.

**Alternatives considered**:
- **Use 204 No Content**: rejected — `204` is for "success, no body", which is not what happened.
- **Use 400**: rejected — `400` suggests the client did something wrong. The client did everything right; the audio was unprocessable.
- **Blocklist of known hallucination phrases**: rejected as brittle (the list drifts with model updates and varies by language). `no_speech_prob` is the model's own signal and degrades gracefully.
- **Combine `no_speech_prob` with `avg_logprob`**: considered. Adding a second threshold made the rule harder to reason about without catching cases the simpler rule missed. Defer until we have evidence the simpler rule is insufficient.

---

## R-009 — Replacing an existing transcript when recording over a meeting

**Decision**: Before the new recording's audio is sent for transcription, the orchestrating component (`TranscriptionReview`) checks whether the meeting already has a saved transcript. If it does, a **confirm dialog** is shown ("This meeting already has a transcript. Replace it with the new recording?"). If the user cancels, the new blob is discarded and the existing transcript is left untouched. If the user confirms, the auto path runs and overwrites on save (just like the v1 manual replace).

**Rationale**:
- FR-005 requires the replace-vs-keep choice to be explicit. A confirm dialog is the simplest implementation, and shadcn's `AlertDialog` primitive is already in the components/ui/ folder.
- The check is on the meeting's *saved* transcript, not on the in-progress draft, because the draft is what we are about to replace anyway.
- The actual overwrite happens through the existing `useUpdateTranscript` mutation. No new persistence path.

**Alternatives considered**:
- **Two side-by-side editors (old and new)**: rejected — too heavy for v1 and inconsistent with the rest of the UI.
- **Automatic replace with an "undo" toast**: rejected — undo across an irreversible delete of meaningful user data is a worse UX than a confirm.

---

## R-010 — Audio retention and memory release

**Decision**: The audio `Blob` lives only in `useRecording`'s state. Once the upload completes (success **or** failure), the orchestrating component calls a new `clearAudio()` method on `useRecording` to drop the reference. The hook itself stops tracking the `MediaStream` tracks on `stop()` (existing v1 behaviour, verified to be already implemented).

**Rationale**:
- SC-007 requires the audio to be unreachable after the user confirms or discards. Dropping the Blob reference is what makes the browser garbage-collect the underlying memory.
- On the server, the `File` constructed from the multipart payload is consumed by the SDK call and then goes out of scope when the route handler returns. No disk write, no cache.
- This is also why `useTranscribeRecording` does **not** cache its result — caching the produced text in SWR would extend the audio's effective lifetime by keeping a reference to the inputs.

**Alternatives considered**:
- **Keep the blob around in case the user wants to re-transcribe**: rejected — re-transcribing the same audio is an edge case, and "redo" is achievable by re-recording. The cost of a longer-lived blob (memory pressure, privacy) is not worth the niche.

---

## R-011 — Test-doubles for the speech-to-text provider

**Decision**: At unit-test scope, `useTranscribeRecording.test.tsx` mocks the **fetcher** (the same pattern v1 uses for `useSummary` and `useActionItems`), not the SDK. The route-handler tests mock `openai`'s `audio.transcriptions.create` directly via `jest.mock('openai', ...)`.

**Rationale**:
- The fetcher-mock pattern is already proven in v1; keeping it consistent reduces the cognitive load of writing new tests.
- Mocking the SDK in the route test is the only place we touch the SDK module, so a `jest.mock` there is well-scoped.

**Alternatives considered**:
- **A nock-style HTTP recording of a real Whisper response**: rejected — it would couple the tests to provider response shapes that aren't part of our contract. The provider can change its internal shape any time; our contract is what we promise our own client.
