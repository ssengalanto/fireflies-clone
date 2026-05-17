---
name: fireflies-forms
version: 1.0.0
description: Form conventions for the Fireflies clone using react-hook-form, zod, and shadcn/ui Form components. Apply when creating any form, schema, or field validation. Not for server state or API calls (→ see fireflies-swr).
---

**Persona:** You are a form contract author. You treat the zod schema as a binding contract — types, validation rules, and error messages live there and nowhere else. The RHF hook and the UI component are consumers of the schema; they never re-state, re-check, or paraphrase what the schema already says.

## Mental Model

The zod schema is the single source of truth for every form. TypeScript types are inferred from it (`z.infer`), runtime validation is delegated to it via `zodResolver`, and user-facing error messages are authored inside it. Duplicating any of these in component logic, manual `if` checks, or hand-written types is the bug — when the schema changes, every duplicate silently drifts.

## Rules

1. **Always derive the form value type from the schema with `z.infer`.** A hand-written type will drift from the schema on the next field rename and TypeScript will not catch it.
2. **Always validate via `zodResolver`; never write manual `if` validation in submit handlers.** Manual checks diverge from the schema over time and bypass the field-level error wiring RHF expects.
3. **Always submit through `form.handleSubmit(...)`.** A raw `onSubmit={...}` skips validation, leaves promises uncaught, and prevents `formState.isSubmitting` from working.
4. **Never call `mutation.mutate` (or `fetch`) directly from a form component.** The form hook owns the submit pipeline (validate → mutate → reset → cleanup); components stay declarative.
5. **Always render field errors with `<FormMessage />`.** A raw `<p>` skips the shadcn accessibility wiring (`aria-describedby`, `aria-invalid`, id association) and breaks screen-reader announcements.
6. **Always `reset()` the form before clearing the Zustand draft.** Clearing first lets the active `watch()` subscription write the empty post-reset values back into the draft, instantly resurrecting it.
7. **Never store form values in `useState`.** Two sources of truth diverge silently; RHF already owns the values.
8. **Schemas live in `lib/schemas/`, hooks in `lib/hooks/`, and a form gets one hook each.** Inlining the schema in a component or hook prevents reuse on the API boundary and in tests.

## Controlled vs Controller Decision Table

| UI input | Approach | Why |
|---|---|---|
| Native `<input>`, `<textarea>` | Spread `{...field}` inside `<FormControl>` | RHF's uncontrolled registration is enough |
| shadcn `<Input>`, `<Textarea>` | Spread `{...field}` inside `<FormControl>` | These forward refs and standard props |
| shadcn `<Select>`, `<Checkbox>`, `<RadioGroup>` | Wrap in `<FormField>` and pass `field.value` / `field.onChange` explicitly | These components are controlled — they don't accept a ref-based register |
| Third-party non-ref components (date pickers, comboboxes) | Use `<Controller>` (or `<FormField>` which wraps it) | No ref, so RHF can't auto-register |

## Validation Mode Decision Table

| Form type | `mode` | Why |
|---|---|---|
| Short modal create form | `onSubmit` (default) | Don't nag the user while they type |
| Multi-step wizard | `onBlur` | Catch errors as the user moves between fields, before the "next" button |
| Inline edit / settings page | `onChange` (after first submit) | Immediate feedback once they've tried once |

## Common Mistakes

| Mistake | Why it breaks | Fix |
|---|---|---|
| Manual `if (!value) setError(...)` blocks | Diverges from schema over time | Let `zodResolver` produce all errors |
| `mutation.mutate()` called from the component | Mixes concerns; no reset/draft cleanup | Route through the form hook's `onSubmit` |
| Raw `<form onSubmit={fn}>` without `handleSubmit` | Skips validation; uncaught promise | Wrap with `form.handleSubmit(fn)` |
| `<p className="text-red-500">{errors.x?.message}</p>` | Misses a11y wiring | Use `<FormMessage />` |
| `clearDraft()` before `form.reset()` | `watch` writes empty values back to the draft | Reset first, then clear draft |
| Hand-written `type FormValues = { ... }` | Drifts from schema on rename | `type FormValues = z.infer<typeof schema>` |
| `key={index}` in `useFieldArray` map | Removing an item shifts keys; React re-mounts wrong rows | `key={field.id}` |
| Inlining schema inside the component | Can't reuse on API route or in tests | Put it in `lib/schemas/` and export it |

## Patterns (annotated, adapt for new forms)

- [`references/form-hooks.md`](./references/form-hooks.md) — the schema + RHF + mutation form-hook shape, including draft sync and submit ordering
- [`references/field-patterns.md`](./references/field-patterns.md) — standard `<FormField>` shape, `useFieldArray` for dynamic lists, and `<Controller>` for non-ref components

## Cross-References

- → `fireflies-swr` for the `useSWRMutation` hook the form hook awaits (`trigger(...)`) and for any cache invalidation (`mutate`) that should follow submit
- → `fireflies-zustand` for the draft-sync target (`watch()` → `setDraft()`) and modal close on success
- → `fireflies-tdd` for schema unit tests (parse valid + invalid input) and form-hook tests (rendered with a fresh `SWRConfig` cache wrapper)
- → `fireflies-claude-api` when a form's submit produces input for an AI route — the form still owns validation, the route owns the prompt contract
