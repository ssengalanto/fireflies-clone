# Pattern: Prompt Builder Functions

Prompts are pure functions that take input + context and return a string. They live in `lib/api/prompts.ts`, separate from routing and transport. This lets you iterate on wording, snapshot-test the output, and version prompts without touching the SDK call site.

## Prose prompt (free-form output)

```ts
// lib/api/prompts.ts

export function build<Task>Prompt(
  <inputField>: string,
  <optionalContext>?: string,
): string {
  return `<role-and-task-statement>
${<optionalContext> ? `<context-label>: ${<optionalContext>}\n` : ''}
<input-label>:
${<inputField>}

<output-instructions-bullet-list>

<style-constraints>`
}
```

## Structured-output prompt (JSON contract)

```ts
export function build<StructuredTask>Prompt(<inputField>: string): string {
  return `<role-and-task-statement>

<input-label>:
${<inputField>}

Return ONLY a JSON array. No explanation, no markdown fences. Format:
[
  {
    "<field-a>": "<type-or-description>",
    "<field-b>": "<type-or-null>",
    "<field-c>": "<format-or-null>"
  }
]

If there are no <items>, return: []`
}
```

## JSON Contract

The structured prompt enforces three rules in the wording itself:

1. **"Return ONLY a JSON array"** — pre-empts a preamble sentence ("Here are the items:")
2. **"No explanation, no markdown fences"** — explicitly forbids the default ```json ``` wrapper
3. **Explicit empty case** — `If there are no <items>, return: []` prevents the model from refusing or apologizing

Even with these instructions, the client MUST parse defensively. The model will occasionally fence anyway:

```ts
const clean = data.result.replace(/```json|```/g, '').trim()
try {
  const parsed = JSON.parse(clean)
  return Array.isArray(parsed) ? parsed : <safeDefault>
} catch {
  return <safeDefault>
}
```

## What to adapt

- `<Task>` / `<StructuredTask>` — `Summary`, `ActionItems`, `Tags`, etc.
- `<inputField>` — the primary content variable (`transcript`, `document`, `query`)
- `<optionalContext>` — additional grounding the prompt should use when present (`title`, `participants`)
- `<role-and-task-statement>` — one sentence: "You are summarizing a meeting transcript." Keep it concrete.
- `<output-instructions-bullet-list>` — what to cover, in order. Bullets work better than prose for the model.
- `<style-constraints>` — terseness, tone, forbidden phrasing
- Field schema in the structured prompt — match it to the Zod schema in `lib/schemas/`

## What stays fixed

- All prompt-builder functions are pure (no I/O, no SDK calls)
- Live in `lib/api/prompts.ts` — one file, easy to scan and diff
- Take input as plain arguments; never read globals or env
- Return a string — the SDK call site wraps it in the `{ role: 'user', content }` shape
- Structured prompts always include the "No explanation, no markdown fences" instruction AND the explicit empty case

## Reach for this when

- Adding a new Claude-backed feature — write the prompt builder first; the route just plumbs it
- Iterating on output quality — change the prompt here, snapshot the output, never edit `route.ts`
- A new structured output is needed — copy the structured shape and define the field schema to match Zod
