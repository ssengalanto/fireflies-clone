# API Contract: Transcription Proxy

`app/api/transcribe/route.ts` is the **only** file in the repo allowed to import the `openai` SDK. It reads `process.env.OPENAI_API_KEY` directly, never proxies the key through another module, and never exposes any header or payload that could leak it.

This is the parallel of the existing Anthropic-isolation rule in `app/api/claude/route.ts`. The two routes share the *pattern* (server-only key, one-file SDK import) but not the *code*.

The model is pinned at `whisper-1` via the `MODEL` constant in `app/api/transcribe/route.ts`. Changing models is a one-line change at that constant.

---

## `POST /api/transcribe`

### Request

- `Content-Type: multipart/form-data`
- Form fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| `meetingId` | string | yes | Echoed in the response header `X-Meeting-Id`. Must be a non-empty string. |
| `audio` | `File` (Blob) | yes | The recording. Accepted MIME types: `audio/webm`, `audio/mp4`, `audio/mpeg`, `audio/wav`, `audio/m4a`, `audio/mp3`. Max size **25 MB** (the provider's hard cap). |

The route runs the request through `transcribeRequestSchema` (zod) before calling the SDK. The schema only enforces presence; size and MIME-type checks are explicit in the handler so that the response can be HTTP 413 / 415 rather than a generic 400.

### Response 200

```json
{
  "transcript": "Alice: Let's walk through the redesign. Bob: I think the hero needs more breathing room.",
  "durationSeconds": 137
}
```

- `Content-Type: application/json`
- `X-Meeting-Id: <echoed meetingId>`
- `transcript` is a non-empty string (a whitespace-only / empty result from the provider triggers HTTP 422, not 200 — see below).
- `durationSeconds` is the provider-reported duration of the audio in seconds, used by the client for telemetry / UI only. It is not persisted against the meeting.

### Response 400 — bad request

```json
{ "error": "Missing meetingId" }
{ "error": "Missing audio" }
```

Returned when the multipart payload fails `transcribeRequestSchema` validation. The handler returns synchronously without calling the SDK.

### Response 413 — payload too large

```json
{ "error": "Audio exceeds maximum size" }
```

Returned when the uploaded `audio` field exceeds 25 MB. The handler measures the file size from the multipart entry's `size` and rejects synchronously before the SDK call.

The client also enforces this cap pre-flight (R-002) so well-behaved callers never see this response. It exists for defense-in-depth.

### Response 415 — unsupported audio type

```json
{ "error": "Audio MIME type not supported" }
```

Returned when the `audio` field's MIME type is not in the accept list above.

### Response 422 — no speech detected

```json
{ "error": "No speech detected" }
```

Returned when the SDK returns a transcript whose `.trim()` is empty. See research R-008. The client maps this to `TranscriptionError.kind === 'NO_SPEECH'` and shows the corresponding fallback (re-record + manual entry, no retry).

### Response 500 — provider failure

```json
{ "error": "Transcription failed" }
```

Returned when the SDK call rejects (network error, provider 5xx, auth failure). The error message body is intentionally generic — provider error details never reach the browser.

---

## Acceptance tests

The contract test file is `__tests__/api/transcribe.route.test.ts`. It runs the route handler directly with `jest.mock('openai', ...)` and asserts:

1. **Happy path**: a valid request with a small `audio/webm` blob returns 200, the body matches `transcribeResponseSchema`, and the response header `X-Meeting-Id` echoes the request.
2. **Missing meetingId**: 400 with the documented error envelope. The mock SDK is never called.
3. **Missing audio**: 400 with the documented error envelope. The mock SDK is never called.
4. **Oversize audio**: 413 with the documented envelope. The mock SDK is never called.
5. **Unsupported MIME type**: 415 with the documented envelope. The mock SDK is never called.
6. **Empty transcript from SDK**: the SDK mock resolves with `{ text: '   ' }`; the route returns 422 `{ "error": "No speech detected" }`.
7. **SDK rejection**: the SDK mock rejects; the route returns 500 `{ "error": "Transcription failed" }`.

Two key-isolation assertions live in `__tests__/security/api-key-isolation.test.ts`:

8. `grep -r "from 'openai'"` (and the equivalent default-import grep) returns exactly one file: `app/api/transcribe/route.ts`. (Adapted from the existing Anthropic check.)
9. No `NEXT_PUBLIC_*` env var contains the substring `OPENAI`.

---

## Client-side bindings

The browser calls this route through `lib/fetchers/transcribe.fetcher.ts`, never directly:

```ts
export async function transcribeAudio(input: {
  meetingId: string
  audio: Blob
}): Promise<TranscribeResponse> { /* builds FormData, fetches, validates, throws TranscriptionError */ }
```

The fetcher:

- Builds the `FormData` (the only place in the repo that does so).
- Enforces the **25 MB pre-flight** cap (throws `{ kind: 'TOO_LARGE' }` without making a network call).
- Maps HTTP status to `TranscriptionError.kind`: `413 → TOO_LARGE`, `422 → NO_SPEECH`, `>=500 → PROVIDER`, network errors → `NETWORK`.
- Validates the 200 body with `transcribeResponseSchema` (defense in depth; if the server lies, the client rejects).

The hook `lib/hooks/useTranscribeRecording.ts` is a thin `useSWRMutation` wrapper around the fetcher. It does not cache the result — transcription is one-shot.

---

## Why this contract does not mirror `/api/claude` field-for-field

- `/api/claude` is JSON in / JSON-or-stream out. `/api/transcribe` is multipart in / JSON out. The transport difference is real and we don't paper over it.
- `/api/claude` does not have a "payload too large" failure mode because text fits comfortably in a JSON body. `/api/transcribe` does — and `413` is the semantically correct response for byte-sized rejections.
- `/api/claude` does not need a 422 because Anthropic does not "succeed with empty content"; `/api/transcribe` needs one because Whisper does (silent audio).

The shared properties — server-only SDK, key never echoed, one-file gate, defensive parsing where the provider can misbehave — are the parts of the pattern that are reused. The shape differences are forced by the underlying provider and not worth hiding.
