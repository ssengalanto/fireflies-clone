# API Contract: Meetings

The browser never talks to a database directly. Every read or write of meeting data goes through `app/api/meetings/**/route.ts`, backed by an in-memory `Map` in `lib/server/meetingStore.ts`. These contracts are the **only** way the client side may obtain or mutate meeting data.

All requests and responses are `application/json`. Error responses follow a single envelope:

```json
{ "error": "Human-readable message" }
```

Status codes: `200` success, `201` create-success, `400` validation error, `404` not found, `500` unexpected server error. Validation is performed with the same zod schemas from `lib/schemas/meeting.schema.ts` on both client and server — the server is authoritative.

---

## `GET /api/meetings`

List meetings, paginated (cursor-based). Used by `useMeetings` (`useSWRInfinite`).

### Query parameters

| Name | Type | Required | Default | Notes |
|---|---|---|---|---|
| `search` | string | no | `''` | Free-text match against `title` and joined `participants` |
| `status` | `'all' \| 'recorded' \| 'summarized'` | no | `'all'` | |
| `cursor` | string | no | — | Opaque cursor from a previous `nextCursor`. Omit on first page. |
| `limit` | integer | no | `20` | 1 ≤ limit ≤ 100 |

### Response 200

```json
{
  "items": [ { "id": "mtg_...", "title": "...", "participants": [...], "date": "...", "durationSeconds": 0, "status": "recorded", "transcript": null, "createdAt": "...", "updatedAt": "..." } ],
  "nextCursor": "opaque-string-or-null"
}
```

- `items` is sorted by `createdAt` DESC.
- `nextCursor` is `null` when there are no more pages.
- The server filters by `search` and `status` before paginating; the client does **not** filter locally (that would re-introduce server-state-in-Zustand).

### Acceptance tests

- Returns `items: []` and `nextCursor: null` for an empty store.
- Returns at most `limit` items.
- `nextCursor` round-trips: passing it back as `cursor` returns the next page with no overlap and no gap.
- A new `?search=foo` request misses the previous page's cache (new SWR key); the response only includes meetings whose title or any participant contains `'foo'` case-insensitively.

---

## `POST /api/meetings`

Create a new meeting. Used by `useCreateMeeting` (bound `mutate` + optimistic).

### Request body

```json
{ "title": "Standup", "participants": ["alice@x.com"], "date": "2026-05-17T10:00:00.000Z" }
```

Validated against `createMeetingSchema`. The client never sends `id`, `createdAt`, `status`, or `durationSeconds` — these are server-set.

### Response 201

The full new `Meeting` record:

```json
{
  "id": "mtg_<uuid>",
  "title": "Standup",
  "participants": ["alice@x.com"],
  "date": "2026-05-17T10:00:00.000Z",
  "durationSeconds": 0,
  "status": "draft",
  "transcript": null,
  "createdAt": "2026-05-17T09:00:00.000Z",
  "updatedAt": "2026-05-17T09:00:00.000Z"
}
```

Returning the full record is what enables `populateCache: true, revalidate: false` in the optimistic mutation (per R-009).

### Response 400

```json
{ "error": "Title is required" }
```

Validation failures surface the first issue's message verbatim — the form uses field-level errors from the client schema too, so the server message is the fallback for any check the client missed.

### Acceptance tests

- Valid input returns `201` with the canonical record and a `mtg_<uuid>` id (not a `temp-` id).
- Empty title returns `400` with the title error message.
- Empty participants array returns `400`.
- Malformed participant email returns `400`.
- The newly created meeting is the first item in the next `GET /api/meetings` response.

---

## `GET /api/meetings/[id]`

Read a single meeting. Used by `useMeeting`.

### Response 200

Same shape as the `Meeting` object above.

### Response 404

```json
{ "error": "Meeting not found" }
```

### Acceptance tests

- `id` matching a stored meeting returns 200 with the canonical record.
- Unknown `id` returns 404. The client surfaces this as a recoverable error state with a "go back" affordance.

---

## `PATCH /api/meetings/[id]`

Attach (or replace) the transcript on an existing meeting. Used by `useUpdateTranscript` (`useSWRMutation`).

### Request body

```json
{ "transcript": "Alice: Hi everyone..." }
```

Validated against `updateTranscriptSchema` (non-empty, ≤ 100k chars). The endpoint does not accept any other field — title/participants/date edits are out of scope for v1 to keep the contract minimal.

### Response 200

The updated `Meeting` record (full shape). `status` is recomputed:
- `transcript === null` → `'draft'`
- `transcript` set, no summary cached → `'recorded'`
- summary cached → `'summarized'`

(`status` transitions happen on the server, not the client.)

### Response 400 / 404

Same envelope as above.

### Acceptance tests

- Setting a transcript on a `'draft'` meeting flips `status` to `'recorded'` and bumps `updatedAt`.
- Empty transcript returns 400.
- Unknown id returns 404.

---

## `DELETE /api/meetings/[id]`

Remove a meeting. Out of scope for v1 user flows but included for completeness so the API surface is symmetric and deletions in dev/test setup work.

### Response 204

Empty body.

### Response 404

Same envelope.

### Acceptance tests

- Deleting an existing meeting returns 204; a subsequent `GET` returns 404.
- The summary and action-items cache entries for that id become unreachable (the client doesn't have to clean them up — they age out of SWR's `Map` naturally).

---

## Server-side validation behaviour

All endpoints:

1. Validate the request body with the appropriate zod schema **before** mutating the store. Validation failure short-circuits to 400 with the first issue's message.
2. Operate on a synchronous in-memory `Map`. No async I/O is performed by v1 handlers (the Anthropic SDK is the only async dependency, and it lives behind `/api/claude`).
3. On success, return the canonical full record (or list page) so the client never has to reconstruct state from partial data.
