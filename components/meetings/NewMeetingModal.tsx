'use client'

import { useFieldArray } from 'react-hook-form'

import { Button } from '@/components/ui/button'
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
import { Input } from '@/components/ui/input'
import { useCreateMeetingForm } from '@/lib/hooks/useCreateMeetingForm'
import { useUIStore } from '@/lib/store/uiStore'

export function NewMeetingModal() {
  const activeModal = useUIStore((s) => s.activeModal)
  const closeModal = useUIStore((s) => s.closeModal)
  const { form, onSubmit, isPending } = useCreateMeetingForm()
  const isOpen = activeModal === 'new-meeting'

  const participants = useFieldArray({
    control: form.control,
    // react-hook-form's useFieldArray requires the array field name
    // typed against the form values shape.
    name: 'participants' as never,
  })

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? closeModal() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New meeting</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Standup" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Participants</FormLabel>
              {participants.fields.map((f, index) => (
                <FormField
                  key={f.id}
                  control={form.control}
                  name={`participants.${index}` as const}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="name@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => participants.append('')}
              >
                Add participant
              </Button>
            </div>

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={closeModal}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Creating…' : 'Create meeting'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
