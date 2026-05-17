# Phase 1 Data Model: Fireflies Clone

Defines the entities, their fields, validation rules, and relationships. Every entity here is either owned by SWR (server data) or by Zustand (UI state) — never both. The right-hand column tags the owner so the gate is auditable at a glance.

The schema definitions in `lib/schemas/` are the single source of truth at runtime; the tables below summarise them for spec-level review.

---

## SWR-owned entities (server data)

### User

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `string` | Required, stable, opaque | Generated server-side on login (e.g. `usr_<uuid>`) |
| `email` | `string` | Required, valid email format | Used as the login identity |
| `displayName` | `string` | Required, 1–80 chars | Shown in the header |

**Validation** (`lib/schemas/auth.schema.ts`):

```ts
export const userSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1).max(80),
})
export type User = z.infer<typeof userSchema>
```

**Relationships**: Implicit — every `Meeting` is owned by the currently signed-in user. v1 is single-user-per-device so no `ownerId` field is stored on the `Meeting` itself.

**State transitions**: anonymous → authenticated (on `POST /api/auth/login`) → anonymous (on explicit sign-out).

---

### Meeting

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `string` | Required; `temp-<uuid>` while optimistic, `mtg_<uuid>` after server confirmation | Temp prefix is the UI's pending-state marker |
| `title` | `string` | Required, 1–120 chars | |
| `participants` | `string[]` | Required, length ≥ 1, each item a valid email | The first participant is implicitly the host |
| `date` | `string` (ISO 8601) | Required | Scheduled / recorded date |
| `durationSeconds` | `number` | Required, integer, ≥ 0 | 0 until a recording stops |
| `status` | `'recorded' \| 'summarized' \| 'draft'` | Required | Derived server-side based on what's attached (see state transitions) |
| `transcript` | `string \| null` | Optional, length ≤ 100k chars when present | Populated after recording stops |
| `createdAt` | `string` (ISO 8601) | Required, set server-side | Used for default sort (newest first) |
| `updatedAt` | `string` (ISO 8601) | Required, set server-side on every PATCH | |

**Validation** (`lib/schemas/meeting.schema.ts`):

```ts
export const meetingSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, 'Title is required').max(120, 'Title is too long'),
  participants: z.array(z.string().email('Invalid participant email'))
    .min(1, 'At least one participant is required'),
  date: z.string().datetime(),
  durationSeconds: z.number().int().nonnegative(),
  status: z.enum(['recorded', 'summarized', 'draft']),
  transcript: z.string().max(100_000).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type Meeting = z.infer<typeof meetingSchema>

export const createMeetingSchema = meetingSchema.pick({
  title: true,
  participants: true,
  date: true,
})
export type CreateMeetingInput = z.infer<typeof createMeetingSchema>
```

**Relationships**:
- One `Meeting` has at most one `Transcript` (denormalised onto `Meeting.transcript` to avoid a join).
- One `Meeting` has zero or one `Summary`.
- One `Meeting` has zero or many `ActionItem`s, but exposed as a single immutable array.

**State transitions**:

```
draft (no transcript) ──[PATCH /api/meetings/[id] with transcript]──▶ recorded
recorded ──[POST /api/claude with type=summary]──▶ summarized
recorded ──[POST /api/claude with type=action-items]──▶ summarized
summarized ──(terminal in v1; re-running AI re-uses cache)
```

Server-side, `status` is recomputed on every read so the field is always consistent with what's attached.

---

### Transcript (denormalised on Meeting)

In v1 the transcript is stored directly on the `Meeting.transcript` field rather than as a separate entity. A separate `transcriptSchema` is exported for the PATCH body so the route handler can validate it independently:

```ts
// lib/schemas/transcript.schema.ts
export const updateTranscriptSchema = z.object({
  transcript: z.string().min(1, 'Transcript cannot be empty').max(100_000),
})
export type UpdateTranscriptInput = z.infer<typeof updateTranscriptSchema>
```

**Why denormalised**: Transcripts are 1:1 with meetings, are never queried independently, and adding a separate `Transcript` table would force a join on every meeting fetch. If v2 needs versioning or large blob storage, promote it to its own entity then.

---

### Summary

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `meetingId` | `string` | Required | The key SWR caches under (`['/api/meetings', id, 'summary']`) |
| `text` | `string` | Required, non-empty | Full concatenated streaming output |
| `generatedAt` | `string` (ISO 8601) | Required, set when the AI call completes | |

The summary is returned by `POST /api/claude` (type=`summary`) as a `ReadableStream` of UTF-8 bytes. The browser concatenates the stream chunks into `text`; SWR caches the final concatenated string. The `meetingId` and `generatedAt` are surfaced separately by the route headers / fetcher so the client doesn't have to reparse the body.

**Treated as immutable**: Once generated, a summary is never edited. Regenerating writes a new summary at the same cache key (via explicit `mutate(key)` call from a "Regenerate" affordance — out of scope for v1, but the cache shape supports it).

---

### ActionItem

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `string` | Required (synthesised client-side after parsing if missing from model output) | |
| `text` | `string` | Required, non-empty | The action sentence as extracted |
| `owner` | `string \| null` | Optional | Email or display name if the model identified one |
| `dueDate` | `string \| null` | Optional, ISO 8601 if present | Best-effort extraction; often `null` |

```ts
// lib/schemas/meeting.schema.ts (continued)
export const actionItemSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  owner: z.string().nullable(),
  dueDate: z.string().datetime().nullable(),
})
export type ActionItem = z.infer<typeof actionItemSchema>
```

A meeting has zero or many `ActionItem`s. The parser in `lib/fetchers/claude.fetcher.ts` defaults to `[]` on parse failure (per R-004). The list is treated as immutable once extracted — same caching pattern as the summary, same immutable SWR config bundle.

---

## Zustand-owned entities (UI state)

### MeetingDraft (in `meetingStore`)

| Field | Type | Notes |
|---|---|---|
| `meetingDraft` | `Partial<CreateMeetingInput> \| null` | The in-progress new-meeting form payload; synced via `form.watch()` on every keystroke |

**Lifecycle**: created when the user starts typing in the new-meeting modal, persisted (via `partialize`) across reloads and modal close/reopen, cleared by `clearMeetingDraft()` **after** `form.reset()` on successful submit (the order matters — see `fireflies-forms/references/form-hooks.md`).

**Never** holds a server-generated `id`, `createdAt`, or `updatedAt` — those come back from the API when the create completes.

---

### Filters (in `meetingStore`)

| Field | Type | Default | Notes |
|---|---|---|---|
| `filters.search` | `string` | `''` | Free-text search applied to title + participants |
| `filters.status` | `'all' \| 'recorded' \| 'summarized'` | `'all'` | Status filter |

Persisted via `partialize`. Flows into the `useMeetings` cache key as part of the tuple; changing it auto-refetches.

---

### Selection + wizard (in `meetingStore`, NOT persisted)

| Field | Type | Default | Notes |
|---|---|---|---|
| `selectedIds` | `string[]` | `[]` | Multi-select state on the dashboard (bulk actions) |
| `wizardStep` | `number` | `0` | Step index inside the new-meeting wizard if multi-step |

Explicitly excluded from `partialize` — stale selections on reload create confusing UI.

---

### UI shell (in `uiStore`, not persisted)

| Field | Type | Default | Notes |
|---|---|---|---|
| `sidebarOpen` | `boolean` | `true` | Dashboard sidebar |
| `activeModal` | `string \| null` | `null` | Single-slot modal stack (e.g. `'new-meeting'`) |
| `modalPayload` | `unknown` | `null` | Arbitrary payload for the active modal |

Closed by `closeModal()` which nulls **both** `activeModal` and `modalPayload` atomically — never leaves a stale payload behind.

---

### Auth session (in `authStore`, fully persisted)

| Field | Type | Default | Notes |
|---|---|---|---|
| `user` | `User \| null` | `null` | The signed-in user, or null if anonymous |
| `isAuthenticated` | `boolean` | `false` | Derived but stored for cheap reads |

Cleared by `clearAuth()` on explicit sign-out. The protected layout reads `isAuthenticated` to gate routes.

---

## Relationships at a glance

```
User
  └── (implicit ownership, single-user-per-device)
       Meeting
        ├── transcript (denormalised string)
        ├── 0..1 Summary    (cache key: ['/api/meetings', id, 'summary'])
        └── 0..* ActionItem (cache key: ['/api/meetings', id, 'action-items'])

MeetingDraft  (Zustand)  — exists only while a meeting is being composed
Filters       (Zustand)  — applied to the meeting list
selectedIds, wizardStep, uiStore.*  — ephemeral UI state
authStore.{user, isAuthenticated}   — fully persisted session
```

**Audit**: no entity above appears in both columns. `MeetingDraft` looks similar to a partial `Meeting` but they intentionally do not share a type (`Partial<CreateMeetingInput>` vs `Meeting`) — the draft never has a server-generated id or timestamps. This is the gate that keeps SWR and Zustand honest.

---

## Cache key factory (the file written first for the resource)

Per `fireflies-swr/references/cache-keys.md`, the cache keys live in `lib/api/cacheKeys.ts` and are the very first file authored:

```ts
export const meetingKeys = {
  all: ['meeting'] as const,
  lists: () => [...meetingKeys.all, 'list'] as const,
  list: (filters: MeetingFilters) => [...meetingKeys.lists(), filters] as const,
  detail: (id: string) => [...meetingKeys.all, 'detail', id] as const,
  summary: (id: string) => [...meetingKeys.detail(id), 'summary'] as const,
  actionItems: (id: string) => [...meetingKeys.detail(id), 'action-items'] as const,
}
```

This shape lets a "regenerate everything for one meeting" affordance work via a single predicate `mutate((key) => Array.isArray(key) && key[0] === 'meeting' && key[2] === id, undefined, { revalidate: true })`.

For paginated list keys, `useSWRInfinite` appends the `pageIndex` to the tuple (`[...meetingKeys.list(filters), pageIndex]`); the page index is not part of the canonical factory because it isn't valid as a standalone invalidation target.
