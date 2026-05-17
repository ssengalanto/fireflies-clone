# Pattern: Tests By Layer

Four recurring shapes, one per layer of the architecture. Pick the shape that matches what you are testing — schema, store, hook, or component — and adapt the slots.

## 1. Schema Tests

No wrapper, no render. Pure zod logic. Cover at minimum: one rejection per validation rule, plus one happy path.

```ts
// <TESTS_DIR>/schemas/<resource>.schema.test.ts
import { <resource>Schema } from '@/<SCHEMA_PATH>/<resource>.schema'

describe('<resource>Schema', () => {
  it('rejects <invalidCaseDescription>', () => {
    const result = <resource>Schema.safeParse(<invalidInput>)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('<expectedMessage>')
  })

  it('accepts valid input', () => {
    expect(<resource>Schema.safeParse(<validInput>).success).toBe(true)
  })
})
```

## 2. Store Tests

`renderHook` is enough — no provider. Always reset stores in `beforeEach`.

```ts
// <TESTS_DIR>/store/<store>.test.ts
import { renderHook, act } from '@testing-library/react'
import { use<Store> } from '@/<STORE_PATH>/<store>'
import { resetStores } from '../utils/stores'

beforeEach(resetStores)

it('<observableBehaviour>', () => {
  const { result } = renderHook(() => use<Store>())
  act(() => result.current.<action>(<args>))
  expect(result.current.<observedField>).toEqual(<expected>)
})
```

## 3. Hook Tests (SWR)

Wrap in a fresh `SWRConfig` cache (via `createTestWrapper`). Mock the network function the hook calls — never the hook itself.

```tsx
// <TESTS_DIR>/hooks/use<Resource>.test.tsx
import { renderHook, waitFor } from '@testing-library/react'
import { use<Resource> } from '@/<HOOKS_PATH>/use<Resource>'
import { <fetcher> } from '@/<API_PATH>/<resource>'
import { createTestWrapper } from '../utils/wrapper'

jest.mock('@/<API_PATH>/<resource>')
const mock<Fetcher> = <fetcher> as jest.MockedFunction<typeof <fetcher>>

it('exposes data on success', async () => {
  mock<Fetcher>.mockResolvedValue(<successPayload>)
  const { result } = renderHook(() => use<Resource>(<args>), { wrapper: createTestWrapper() })
  await waitFor(() => expect(result.current.data).toEqual(<expectedData>))
  expect(result.current.error).toBeUndefined()
})

it('exposes error state on failure', async () => {
  mock<Fetcher>.mockRejectedValue(new Error('<errorMessage>'))
  const { result } = renderHook(() => use<Resource>(<args>), { wrapper: createTestWrapper() })
  await waitFor(() => expect(result.current.error).toBeDefined())
})
```

SWR doesn't expose a separate `isSuccess` flag — `data !== undefined && error === undefined` is the success signal, and `error !== undefined` is the failure signal. Asserting on the values directly avoids depending on a flag SWR doesn't ship.

## 4. Component Tests

Query by role or label. Use `userEvent` for interactions. If the component consumes a query hook, wrap with `createTestWrapper()` and mock the underlying fetcher, not the hook.

```tsx
// <TESTS_DIR>/components/<area>/<Component>.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { <Component> } from '@/<COMPONENT_PATH>/<Component>'

it('renders <userVisibleThing>', () => {
  render(<<Component> {...<requiredProps>} />)
  expect(screen.getByRole('<role>', { name: <accessibleName> })).toBeInTheDocument()
})

it('calls <handler> on <interaction>', async () => {
  const <handler> = jest.fn()
  render(<<Component> {...<requiredProps>} <handler>={<handler>} />)
  await userEvent.click(screen.getByRole('<role>', { name: <accessibleName> }))
  expect(<handler>).toHaveBeenCalledWith(<expectedArg>)
})
```

## What to adapt

- `<TESTS_DIR>` — match the path used in `setup.md`
- `<resource>` / `<Resource>` — singular noun matching the production module name
- `<invalidInput>` / `<expectedMessage>` — one pair per zod rule the schema enforces
- `<fetcher>` — the network function the hook calls (e.g. `fetchMeetings`, `postSummary`)
- `<role>` / `<accessibleName>` — what the user actually perceives; check with `screen.logTestingPlaygroundURL()` if unsure

## What stays fixed

- Schema tests never render, never wrap — they are unit tests of pure functions
- Store tests always call `resetStores()` in `beforeEach`
- Hook tests always pass `{ wrapper: createTestWrapper() }` and always await `waitFor` for async state
- Component tests always prefer `getByRole` over `getByTestId`; `userEvent` over `fireEvent`
- `jest.mock(...)` is hoisted — declare it at the top of the file, not inside `beforeEach`

## Reach for this when

- **Schema:** any new `*.schema.ts` file
- **Store:** any new Zustand action or derived selector
- **Hook:** any new `useSWR`, `useSWRInfinite`, or `useSWRMutation`
- **Component:** any new presentational or interactive component, written *after* its hooks/schemas are green
