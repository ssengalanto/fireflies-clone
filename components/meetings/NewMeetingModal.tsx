'use client'

import { Plus, X } from 'lucide-react'
import { useFieldArray } from 'react-hook-form'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useCreateMeetingForm } from '@/lib/hooks/useCreateMeetingForm'
import { useUIStore } from '@/lib/store/uiStore'

export function NewMeetingModal() {
  const activeModal = useUIStore((s) => s.activeModal)
  const closeModal = useUIStore((s) => s.closeModal)
  const { form, onSubmit, isPending } = useCreateMeetingForm()
  const isOpen = activeModal === 'new-meeting'

  const participants = useFieldArray({
    control: form.control,
    name: 'participants' as never,
  })

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? closeModal() : null)}>
      <DialogContent className="max-w-lg rounded-md border border-line bg-card p-0">
        <DialogHeader className="space-y-1 border-b border-line px-6 py-4">
          <DialogTitle className="text-base font-semibold tracking-tight">
            New meeting
          </DialogTitle>
          <p className="text-xs text-fg-3">
            Capture title, participants, and date. Transcript comes later.
          </p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-5 px-6 py-5">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel htmlFor="meeting-title" className="eyebrow">
                    Title
                  </FormLabel>
                  <FormControl>
                    <input
                      id="meeting-title"
                      placeholder="What was this meeting about?"
                      className="h-9 w-full rounded-md border border-line bg-surface-1 px-3 text-sm text-fg placeholder:text-fg-muted focus:border-accent focus:outline-none focus:ring-0"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs text-danger" />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel className="eyebrow">Participants</FormLabel>
              <ul className="space-y-1.5">
                {participants.fields.map((f, index) => (
                  <li key={f.id} className="flex items-center gap-2">
                    <span
                      className="num w-5 text-xs text-fg-muted"
                      aria-hidden="true"
                    >
                      {(index + 1).toString().padStart(2, '0')}
                    </span>
                    <FormField
                      control={form.control}
                      name={`participants.${index}` as const}
                      render={({ field }) => (
                        <FormItem className="flex-1 space-y-1">
                          <FormControl>
                            <input
                              type="email"
                              placeholder="name@example.com"
                              className="h-9 w-full rounded-md border border-line bg-surface-1 px-3 text-sm text-fg placeholder:text-fg-muted focus:border-accent focus:outline-none focus:ring-0"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="text-xs text-danger" />
                        </FormItem>
                      )}
                    />
                    {participants.fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => participants.remove(index)}
                        aria-label={`Remove participant ${index + 1}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-fg-muted transition hover:bg-surface-2 hover:text-fg"
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => participants.append('')}
                className="inline-flex items-center gap-1.5 text-xs text-fg-3 transition-colors hover:text-accent"
              >
                <Plus className="h-3 w-3" strokeWidth={2} />
                Add participant
              </button>
            </div>

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel htmlFor="meeting-date" className="eyebrow">
                    Date &amp; time
                  </FormLabel>
                  <FormControl>
                    <input
                      id="meeting-date"
                      type="datetime-local"
                      className="num h-9 w-full rounded-md border border-line bg-surface-1 px-3 text-sm text-fg focus:border-accent focus:outline-none focus:ring-0"
                      value={
                        field.value
                          ? new Date(field.value).toISOString().slice(0, 16)
                          : ''
                      }
                      onChange={(e) =>
                        field.onChange(
                          e.target.value
                            ? new Date(e.target.value).toISOString()
                            : '',
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage className="text-xs text-danger" />
                </FormItem>
              )}
            />

            <div className="-mx-6 -mb-5 mt-4 flex items-center justify-end gap-2 border-t border-line bg-surface-1 px-6 py-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={isPending}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="btn-primary"
              >
                {isPending ? 'Creating…' : 'Create meeting'}
              </button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
