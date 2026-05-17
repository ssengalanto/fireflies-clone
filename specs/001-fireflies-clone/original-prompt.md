# Fireflies Clone — Speckit Specification

> Build a Fireflies.ai clone using the following stack and conventions.
> Follow TDD — write tests before implementation.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14+ (App Router, TypeScript) |
| UI | Tailwind CSS + shadcn/ui |
| Forms | react-hook-form + zod + @hookform/resolvers/zod |
| Server state | SWR 2+ by Vercel |
| Client state | Zustand 4+ |
| Testing | @testing-library/react + jest |

---

## Project Structure

```
app/
  (auth)/login/page.tsx
  (dashboard)/layout.tsx
  (dashboard)/page.tsx                # meeting list
  (dashboard)/meetings/[id]/page.tsx  # meeting detail
  api/
    claude/route.ts                   # proxy to Anthropic API (hides key)
    meetings/route.ts                 # CRUD handlers (reads/writes localStorage)
    meetings/[id]/route.ts

components/
  ui/                       # shadcn primitives only — no business logic
  meetings/                 # MeetingCard, MeetingList, MeetingFilters, NewMeetingModal
  recording/                # RecordingControls, RecordingTimer
  transcript/               # TranscriptView, TranscriptEditor
  summary/                  # SummaryView, ActionItems

lib/
  schemas/                  # zod schemas + inferred types, one file per domain
    meeting.schema.ts
    transcript.schema.ts
    auth.schema.ts
  fetchers/                 # plain async functions — no hooks, no SWR imports
    meetings.fetcher.ts
    claude.fetcher.ts
  hooks/                    # one hook file per feature
    useMeetings.ts
    useMeeting.ts
    useSummary.ts
    useActionItems.ts
    useCreateMeeting.ts
    useUpdateTranscript.ts
    useCreateMeetingForm.ts  # RHF + zod + SWR mutation wired together
    useRecording.ts
  store/                    # Zustand stores — UI state only, never server data
    uiStore.ts
    meetingStore.ts
    authStore.ts
  providers/
    SWRProvider.tsx          # global SWRConfig
    StoreProvider.tsx        # optional hydration boundary for Zustand

__tests__/
  schemas/
  store/
  hooks/
  components/
```

---

## Separation of Concerns

| Concern | Owner | Never mix with |
|---|---|---|
| Remote data (meetings, summary, action items) | SWR | Zustand |
| UI state (modals, sidebar, filters, drafts) | Zustand | SWR |
| Validation rules | zod schemas | RHF internals |
| API calls | `lib/fetchers/` | hooks or components |
| Business logic | hooks | components |

---

## SWR Conventions

**Fetchers** live in `lib/fetchers/` — plain `async (url, options?) => data` functions. Never inline fetch calls inside `useSWR()`. This makes them independently testable.

### Key Format

Strings for static keys, arrays for parameterized keys:

```
'/api/meetings'                           # list
['/api/meetings', id]                     # detail — null-safe: key is null when !id
['/api/meetings', id, 'summary']          # Claude summary
['/api/meetings', id, 'action-items']     # Claude action items
```

> Never use object keys — SWR compares them by serialized value but objects create subtle equality bugs.

### Read Hooks

- `useMeetings` — `useSWRInfinite` with filter params from Zustand `meetingStore`
- `useMeeting(id)` — key is `id ? ['/api/meetings', id] : null`; null key prevents fetch
- `useSummary` / `useActionItems` — immutable config, never revalidate:

```ts
const IMMUTABLE = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  revalidateIfStale: false,
  dedupingInterval: 86_400_000, // 24h
} satisfies SWRConfiguration
```

### Mutation Hooks

Use `useSWRMutation` for all user-triggered writes:

```ts
const { trigger, isMutating } = useSWRMutation('/api/meetings', createMeetingFetcher)
```

### Optimistic Updates

Use bound `mutate` from `useSWR` — not global `mutate`:

```ts
const { data, mutate } = useSWR('/api/meetings', fetcher)

await mutate(
  async () => await createMeetingFetcher(newMeeting),
  {
    optimisticData: (current = []) => [tempMeeting, ...current],
    rollbackOnError: true,
    revalidate: true,
    populateCache: true,
  }
)
```

> Never call `mutate()` inside `useEffect` — only in event handlers or `onSuccess` callbacks.

### Global SWRConfig

```tsx
// lib/providers/SWRProvider.tsx
<SWRConfig value={{
  fetcher: (url: string) => fetch(url).then(r => r.json()),
  revalidateOnFocus: true,
  shouldRetryOnError: false,
}}>
```

---

## Zustand Conventions

Three stores, one domain each — never share state across stores, never store server data.

### uiStore — no persist

```
sidebarOpen: boolean
activeModal: string | null
modalPayload: unknown
```

Actions: `toggleSidebar`, `openModal(modal, payload?)`, `closeModal`

### meetingStore — partial persist

```
selectedIds: string[]
filters: { search: string, status: 'all' | 'recorded' | 'summarized' }
meetingDraft: Partial<CreateMeetingInput> | null
wizardStep: number
```

Actions: `selectMeeting`, `deselectMeeting`, `clearSelection`, `setFilter`, `resetFilters`, `setMeetingDraft`, `clearMeetingDraft`, `nextStep`, `prevStep`, `resetWizard`

### authStore — full persist

```
user: User | null
isAuthenticated: boolean
```

Actions: `setUser`, `clearAuth`

### Persist Rules

| Store | Persist | Partialize |
|---|---|---|
| `uiStore` | ✗ | — |
| `meetingStore` | ✓ | `filters` + `meetingDraft` only |
| `authStore` | ✓ | full |

> Never persist `selectedIds` or `wizardStep` — stale selection and mid-wizard state on reload cause confusing UI.

> Always use granular selectors `(s) => s.field` — never consume the whole store object or it re-renders on every state change.

---

## Form Conventions

The chain is always: **zod schema → zodResolver → RHF hook → SWR mutation**

Every form has:
- Schema in `lib/schemas/` exporting both schema and `z.infer<>` type
- A dedicated hook in `lib/hooks/` combining RHF + zodResolver + useSWRMutation
- A thin component that only renders fields and calls the hook

### Draft Sync Pattern

Survives modal close/reopen:

```ts
// Pre-fill from Zustand draft on mount
useEffect(() => { if (draft) form.reset(draft) }, [])

// Sync to Zustand on every change
useEffect(() => {
  const sub = form.watch((values) => setMeetingDraft(values))
  return () => sub.unsubscribe()
}, [form.watch])
```

### Submit Order

On successful submit, always in this exact order:

1. `form.reset()` — clears RHF state; `watch` fires one last time with empty values
2. `clearMeetingDraft()` — clears Zustand draft after reset, so empty values don't persist
3. `closeModal()` — dismisses modal

---

## Claude Integration

`app/api/claude/route.ts` is the only file that imports the Anthropic SDK. Never call `api.anthropic.com` from the browser — the key would be visible in DevTools.

| Endpoint | Body | Response |
|---|---|---|
| `POST /api/claude` | `{ type: 'summary', transcript }` | `ReadableStream` (streaming) |
| `POST /api/claude` | `{ type: 'action-items', transcript }` | JSON (non-streaming) |

- Summary uses streaming — renders token by token for perceived speed
- Action items are non-streaming — full JSON must arrive before parsing
- Always parse action items with `try/catch`, default to `[]` — the model occasionally wraps JSON in markdown fences

---

## Recording

- `useRecording` manages `MediaRecorder` state locally — not in Zustand
- Recording state is ephemeral and component-scoped
- Transcript entry is simulated: after stop, show a textarea for manual input or paste

---

## Data Persistence

- Meetings live in `localStorage`, read/written through Next.js API routes (`app/api/meetings/`)
- Zustand persist handles only UI preferences (filters, draft) — not meeting data
- Clean boundary: SWR owns meeting data, Zustand owns UI preferences

---

## TDD Order

Always write the failing test first, then minimum implementation to pass:

```
1. Schema tests     → pure zod, no render, no wrapper
2. Store tests      → Zustand logic, reset via store.setState()
3. Hook tests       → wrap in SWRConfig + mock fetchers
4. Component tests  → mock hooks at module level, test render + interaction
```

### Key Tests to Write First

| Test file | What to cover |
|---|---|
| `meeting.schema.test.ts` | Empty title, invalid email, empty participants, valid input |
| `uiStore.test.ts` | `openModal` sets payload, `closeModal` nulls both, `toggleSidebar` flips bool |
| `meetingStore.test.ts` | `setFilter` merges (not replaces), persist partialize excludes `selectedIds` |
| `useMeetings.test.ts` | Loading state, success with data, error state, filter change triggers new key |
| `useCreateMeeting.test.ts` | Optimistic item visible before settle, rollback on error |
| `MeetingCard.test.tsx` | Renders title, formatted date, formatted duration |
| `MeetingFilters.test.tsx` | Input change calls `setFilter` on `meetingStore` |
| `NewMeetingModal.test.tsx` | Renders when `activeModal === 'new-meeting'`, closes on `closeModal` |
| `RecordingControls.test.tsx` | Shows Stop after Start clicked, timer increments |

### Test Wrappers

```tsx
// SWR — fresh cache per test
function createWrapper() {
  return ({ children }) => (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  )
}

// Zustand — reset between tests
beforeEach(() => {
  useUIStore.setState({ sidebarOpen: true, activeModal: null, modalPayload: null })
  useMeetingStore.setState({ selectedIds: [], filters: defaultFilters, meetingDraft: null, wizardStep: 0 })
})
```

> Mock fetchers at module level with `jest.mock()` — never inside individual tests.
> Use `waitFor()` for all async SWR assertions.

---

## README Must Include

- Setup instructions
- Required env vars: `ANTHROPIC_API_KEY`
- How to run tests: `pnpm test`, `pnpm test:watch`
- Architecture decisions and assumptions
- Time spent estimate