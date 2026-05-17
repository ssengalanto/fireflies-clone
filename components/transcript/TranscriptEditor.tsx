'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useUpdateTranscript } from '@/lib/hooks/useUpdateTranscript'
import {
  updateTranscriptSchema,
  type UpdateTranscriptInput,
} from '@/lib/schemas/transcript.schema'

export interface TranscriptEditorProps {
  meetingId: string
  initialValue?: string
  onSaved?: () => void
}

export function TranscriptEditor({
  meetingId,
  initialValue = '',
  onSaved,
}: TranscriptEditorProps) {
  const { trigger, isMutating } = useUpdateTranscript(meetingId)
  const form = useForm<UpdateTranscriptInput>({
    resolver: zodResolver(updateTranscriptSchema),
    defaultValues: { transcript: initialValue },
  })

  const onSubmit = form.handleSubmit(async ({ transcript }) => {
    await trigger(transcript)
    onSaved?.()
  })

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <p className="eyebrow">Step 2</p>
          <h3 className="text-lg font-semibold tracking-tight text-fg">
            Supply the transcript
          </h3>
          <p className="text-sm text-fg-3">
            Paste, type, or correct. Whatever lands here is what the model
            distills into a summary and action items.
          </p>
        </div>

        <FormField
          control={form.control}
          name="transcript"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel htmlFor="transcript-input" className="eyebrow">
                Transcript
              </FormLabel>
              <FormControl>
                <textarea
                  id="transcript-input"
                  rows={12}
                  placeholder="Alice: Let's walk through the redesign."
                  className="w-full resize-y rounded-md border border-line bg-surface-1 px-4 py-3 text-sm leading-relaxed text-fg placeholder:text-fg-muted focus:border-accent focus:outline-none focus:ring-0"
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-xs text-danger" />
            </FormItem>
          )}
        />
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-fg-muted">
            Plain text · paragraphs separated by blank lines.
          </p>
          <button
            type="submit"
            disabled={isMutating}
            className="btn-primary"
          >
            {isMutating ? 'Saving…' : 'Save transcript'}
          </button>
        </div>
      </form>
    </Form>
  )
}
