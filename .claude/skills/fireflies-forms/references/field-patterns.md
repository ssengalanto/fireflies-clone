# Pattern: Fields

Three recurring shapes: a standard scalar field, a dynamic array via `useFieldArray`, and a controlled non-ref component via `<Controller>` (which `<FormField>` already wraps). All three rely on `<FormField>` + `<FormMessage>` so shadcn's accessibility wiring stays intact.

## Standard scalar field

```tsx
<FormField
  control={form.control}
  name="<fieldName>"
  render={({ field }) => (
    <FormItem>
      <FormLabel><Field Label></FormLabel>
      <FormControl>
        <<InputComponent> placeholder="<placeholder>" {...field} />
      </FormControl>
      <FormDescription><optional helper copy></FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

## Dynamic array (`useFieldArray`)

```tsx
const { fields, append, remove } = useFieldArray({
  control: form.control,
  name: '<arrayFieldName>',
})

{fields.map((field, index) => (
  <FormField
    key={field.id}                                  // field.id, never index — see "What stays fixed"
    control={form.control}
    name={`<arrayFieldName>.${index}`}
    render={({ field }) => (
      <FormItem>
        <FormControl>
          <div className="flex gap-2">
            <Input placeholder="<item placeholder>" {...field} />
            <Button type="button" variant="ghost" onClick={() => remove(index)}>
              <remove glyph>
            </Button>
          </div>
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
))}

<Button type="button" variant="outline" onClick={() => append(<emptyItemValue>)}>
  <add label>
</Button>
```

## Controlled / non-ref component

For components that don't forward a ref (most shadcn `<Select>`, third-party date pickers, comboboxes), drive them through `field.value` / `field.onChange` rather than spreading `{...field}`.

```tsx
<FormField
  control={form.control}
  name="<fieldName>"
  render={({ field }) => (
    <FormItem>
      <FormLabel><Field Label></FormLabel>
      <<ControlledComponent>
        value={field.value}
        onValueChange={field.onChange}                  // or onChange, per the component's API
        onBlur={field.onBlur}
      />
      <FormMessage />
    </FormItem>
  )}
/>
```

## What to adapt

- `<fieldName>` / `<arrayFieldName>` — must match a key in the zod schema; TypeScript will surface typos via `Path<FormValues>`
- `<InputComponent>` / `<ControlledComponent>` — `Input`, `Textarea`, `Select`, `DatePicker`, etc.
- `<emptyItemValue>` — what `append(...)` inserts. For a `z.string()` array, pass `''`; for a `z.object({...})` array, pass the matching empty object.
- Buttons inside arrays must use `type="button"` — without it they trigger form submit.

## What stays fixed

- `<FormField>` + `<FormMessage>` for every input — never raw `<input>` + hand-rolled error `<p>`
- Array keys are `field.id`, not `index` — `useFieldArray` mints a stable id on append; using `index` causes React to re-mount surviving rows on every `remove`
- `name={\`<arrayFieldName>.${index}\`}` — bracket and template-literal syntax matters; zod paths and RHF paths must align
- Non-ref components route through `field.value` / `field.onChange`, not `{...field}` — spreading a ref onto a non-forwarding component is a runtime warning at best, a crash at worst

## Reach for this when

- **Standard scalar:** every plain string, number, or boolean field
- **Dynamic array:** lists the user grows or shrinks at runtime (emails, tags, attendees, line items)
- **Controlled:** any input that doesn't accept a `ref` — selects, switches, custom pickers
