# Phase 1 Data Model: Automatic Transcription from Recording

This feature **adds no persisted entities and no persisted fields**. The shape of `Meeting`, `Transcript`, `Summary`, and `ActionItem` is unchanged from v1. What changes is the path that produces the `Transcript.text` value.

## Server-state vs. UI-state map (updated)

The two-line rule from v1 still holds: SWR owns server state, Zustand owns UI state, the two never share keys.

| Concept | Where it lives | Reason |
|---|---|---|
| `Meeting` (`id`, `title`, `date`, `participants`, `duration`, `recordingStatus`, `transcript`) | SWR cache under `meetingKeys.detail(id)` and `meetingKeys.list(filters)` | Came from the server; remains a network-shaped value (unchanged from v1) |
| `Summary` (prose) | SWR cache under `meetingKeys.summary(id)` (immutable config) | Same as v1 |
| `ActionItem[]` | SWR cache under `meetingKeys.actionItems(id)` (immutable config) | Same as v1 |
| **Recording session** (`status`, `elapsed`, `audioBlob`) | `useRecording` hook local state | Transient UI state; never persisted; not shared between meetings |
| **Auto-transcription run** (`isPending`, `error: TranscriptionError \| null`, `producedText: string \| null`) | `useTranscribeRecording` hook local state, surfaced via `useSWRMutation` return | Transient UI state; one-shot per recording stop |
| **Pending replace-confirm** (open/closed) | `uiStore` slice (no persist) | A modal flag; behaves like the existing UI dialogs |
| `MeetingDraft` (new-meeting wizard) | `meetingStore` slice (persist, partialize) | Same as v1 |
| `filters` (status + search) | `meetingStore` slice (persist, partialize) | Same as v1 |
| `auth session` | `authStore` (persist) | Same as v1 |

Notes:

1. **`audioBlob` is UI-state**, not server-state. It came from `MediaRecorder` (a browser API), not from a network response. SWR does not cache it. The blob is dropped after upload (see R-010).
2. **The produced transcript text is also UI-state until the user saves it.** Once the user clicks Save in `TranscriptEditor`, it transitions to server-state via `useUpdateTranscript` → `PATCH /api/meetings/[id]` → SWR cache update on `meetingKeys.detail(id)`.

## Entities

### Recording (transient, client-only)

| Field | Type | Notes |
|---|---|---|
| `status` | `'idle' \| 'recording' \| 'paused' \| 'stopped'` | Unchanged from v1's `useRecording` |
| `elapsed` | `number` (seconds) | Unchanged |
| `audioBlob` | `Blob \| null` | Already present in v1; previously unused by the transcript flow. Now read by `useTranscribeRecording`. Set to `null` on `clearAudio()`. |

**Lifecycle**: created on `start()`, populated on `stop()`, consumed by upload, cleared on `clearAudio()` (called by `TranscriptionReview` after the upload settles — success or failure with a non-retry path).

**Validation**: none (no shape constraints; consumers handle null).

### Transcription Run (transient, client-only)

| Field | Type | Notes |
|---|---|---|
| `isMutating` | `boolean` | Surfaced by `useSWRMutation` |
| `data` | `string \| undefined` | The produced transcript text, before user review |
| `error` | `TranscriptionError \| undefined` | Typed reason for failure |

**`TranscriptionError`** is a discriminated union:

```ts
type TranscriptionError =
  | { kind: 'NETWORK';   message: string }    // fetch threw or timed out
  | { kind: 'TOO_LARGE'; message: string }    // 413 from server, or pre-flight client check
  | { kind: 'NO_SPEECH'; message: string }    // 422 from server
  | { kind: 'PROVIDER';  message: string }    // 500 from server, or non-2xx other
```

**Why a discriminated union and not a string?** The fallback UI shows different buttons depending on the reason (retry is hidden for `TOO_LARGE` and `NO_SPEECH`). Pattern-matching on `kind` keeps that logic typed and exhaustive.

**Lifecycle**: scoped to one `useTranscribeRecording` instance per `TranscriptionReview` instance. Reset whenever the user starts a new recording or clears the audio.

### Auto-generated Transcript Draft (transient, client-only)

The "draft" is not a separate entity — it is the **value of the `initialValue` prop** passed to `TranscriptEditor` when the auto path produces text. It is held in the local state of `TranscriptionReview` until the editor's `react-hook-form` instance takes ownership.

This is intentional: a separate entity would invite a separate persistence layer, which the spec explicitly forbids (FR-008 — don't silently retain it).

### Transcript (existing, unchanged)

| Field | Type | Notes |
|---|---|---|
| `text` | `string` (min 1 char) | Unchanged shape, unchanged validation, unchanged storage |

The only thing that changes is that `text` can now arrive at `TranscriptEditor` pre-filled. The schema, the mutation, and the server-side meeting store are untouched.

### Meeting / Summary / ActionItem (existing, unchanged)

Refer to `specs/001-fireflies-clone/data-model.md`. This feature does not change them.

## State transitions

The new state machine concerns the auto-transcription run itself, between recording-stop and transcript-save.

```text
                              start()                stop()
            ┌──────────┐    ─────────▶  ┌──────────┐ ─────▶ ┌──────────┐
            │   idle   │                │ recording │       │  stopped  │
            └──────────┘                └──────────┘        └──────────┘
                ▲                                                  │
                │                                                  │ audioBlob ready
                │                                                  ▼
                │                                          ┌──────────────────┐
                │                                          │ transcribing     │
                │                                          │ (isMutating)     │
                │                                          └──────────────────┘
                │                                            │            │
                │                                       success           failure
                │                                            │            │
                │                                            ▼            ▼
                │                                  ┌─────────────┐   ┌──────────────┐
                │                                  │ reviewing    │   │ failed        │
                │                                  │ (initialValue│   │ (kind = …)    │
                │                                  │  populated)  │   └──────────────┘
                │                                  └─────────────┘     │     │     │
                │  Save                                  │              │     │     │
                │  (useUpdateTranscript)                  │           retry  manual re-record
                │                                         ▼              │     │     │
                │                                  ┌─────────────┐       │     │     │
                │                                  │   saved      │       │     │     │
                │                                  │  (server     │       │     │     │
                │                                  │   state)     │       │     │     │
                │                                  └─────────────┘       │     │     │
                │                                                        ▼     ▼     ▼
                │                                                  back to "transcribing"
                │                                                        / "manual entry"
                │                                                        / "idle"
                └──────────────────────────────────────────────────────────────────────
```

(Drawn as a doc-comment, not enforced by a state machine library. The "machine" is implicit in the React render tree of `TranscriptionReview`.)

## Schemas added in this feature

Only one new schema file: `lib/schemas/transcribe.schema.ts`.

```ts
// Request — built by the client, validated server-side
export const transcribeRequestSchema = z.object({
  meetingId: z.string().min(1),
  // `audio` is a File at runtime; zod validates only its presence.
  audio: z.instanceof(File),
});

// Response — validated by the client after fetch
export const transcribeResponseSchema = z.object({
  transcript: z.string().min(1),
  durationSeconds: z.number().nonnegative(),
});

export type TranscribeResponse = z.infer<typeof transcribeResponseSchema>;
```

The `TranscriptionError` union is defined in `lib/fetchers/transcribe.fetcher.ts` alongside the fetcher, because it is a transport-level concern not a domain entity.

## Things that are *not* in the data model

This list exists to make scope explicit:

- No `Recording` entity in any persistent store. `audioBlob` lives only in hook state.
- No audio archive on the server. The route streams the upload through the SDK and returns text.
- No transcript version history. The `Transcript.text` field is overwritten on save, same as v1.
- No "auto-transcribed" flag on the `Meeting`. Whether the transcript was produced by the auto path or manually pasted is not a persisted attribute — downstream consumers (summary, action items) treat all transcripts identically by design (FR-009).
