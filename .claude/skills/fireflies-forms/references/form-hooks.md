# Pattern: Form Hook

Every form is encapsulated in a dedicated hook that wires the zod schema, RHF's `useForm`, optional draft sync, and the SWR mutation (`useSWRMutation`) into one submit pipeline. The component that consumes the hook stays declarative — it renders fields and a submit button, nothing more.

## Schema (lives in `lib/schemas/<resource>.schema.ts`)

```ts
import { z } from 'zod'

export const <action><Resource>Schema = z.object({
  <fieldName>: z.string().min(1, '<user-facing required message>').max(<MAX_LEN>, '<too-long message>'),
  <listField>: z.array(z.string().email('<invalid item message>')).min(1, '<at-least-one message>'),
  <optionalField>: z.string().max(<MAX_LEN>).optional(),
})

export type <Action><Resource>Input = z.infer<typeof <action><Resource>Schema>
```

## Hook (lives in `lib/hooks/use<Action><Resource>Form.ts`)

```ts
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import {
  <action><Resource>Schema,
  type <Action><Resource>Input,
} from '@/lib/schemas/<resource>.schema'
import { use<Action><Resource> } from './use<Resource>s'      // useSWRMutation hook from fireflies-swr
import { use<Resource>Store } from '@/lib/store/<resource>Store'
import { useUIStore } from '@/lib/store/uiStore'

export function use<Action><Resource>Form() {
  const { trigger, isMutating, error } = use<Action><Resource>()    // useSWRMutation under the hood
  const draft = use<Resource>Store((s) => s.<resource>Draft)
  const { set<Resource>Draft, clear<Resource>Draft } = use<Resource>Store()
  const closeModal = useUIStore((s) => s.closeModal)

  const form = useForm<<Action><Resource>Input>({
    resolver: zodResolver(<action><Resource>Schema),
    defaultValues: <DEFAULT_VALUES>,         // must match the schema shape exactly
    mode: '<VALIDATION_MODE>',               // 'onSubmit' | 'onBlur' | 'onChange' — see SKILL.md decision table
  })

  // 1. Hydrate from the persisted draft on mount, once
  useEffect(() => {
    if (draft) form.reset(draft)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 2. Sync every keystroke back to the draft store
  useEffect(() => {
    const sub = form.watch((values) => set<Resource>Draft(values))
    return () => sub.unsubscribe()
  }, [form.watch])

  // 3. Submit pipeline — order matters, see "What stays fixed" below
  const onSubmit = form.handleSubmit(async (data) => {
    await trigger(data)                      // useSWRMutation's trigger throws on failure, like mutateAsync
    form.reset()
    clear<Resource>Draft()
    closeModal()
  })

  return {
    form,
    onSubmit,
    isPending: isMutating,                   // expose a stable name to components; SWR uses isMutating internally
    error,
  }
}
```

## Component usage (thin)

```tsx
export function <Resource>Form() {
  const { form, onSubmit, isPending } = use<Action><Resource>Form()

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        {/* fields — see field-patterns.md */}
        <Button type="submit" disabled={isPending}>
          {isPending ? '<pending label>' : '<submit label>'}
        </Button>
      </form>
    </Form>
  )
}
```

## What to adapt

- `<Action>` / `<Resource>` — e.g. `Create` × `Meeting`, `Update` × `Profile`
- `<DEFAULT_VALUES>` — every field in the schema needs a default (empty string, empty array, `undefined` for optional). Must satisfy `<Action><Resource>Input`.
- `<VALIDATION_MODE>` — see the decision table in `SKILL.md`
- Draft-sync block — omit entirely if the form doesn't need persistence across modal close
- Mutation hook — sourced from `fireflies-swr` (a `useSWRMutation` wrapper); the form hook never builds a `fetch` itself

## What stays fixed

- `zodResolver(<schema>)` — the only validator; no manual `if` checks anywhere in the file
- The submit order is `trigger → reset → clearDraft → closeModal`. Reset before clearing the draft, or `watch` writes the empty values back.
- `await trigger(...)` from `useSWRMutation` — `trigger` throws on failure, which is what `handleSubmit` needs to keep `isSubmitting` accurate and prevent the reset/close steps from running on error.
- The component never imports the mutation directly; it only sees the hook's return.
- The mount-time `form.reset(draft)` runs once — deps stay empty intentionally.

## Reach for this when

Any user-editable form that submits to a mutation. Even a one-field form gets its own hook so the schema, validation, and submit pipeline stay collocated and testable.
