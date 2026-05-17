'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
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
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField
          control={form.control}
          name="transcript"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Transcript</FormLabel>
              <FormControl>
                <Textarea
                  rows={10}
                  placeholder="Paste or type the meeting transcript…"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={isMutating}>
            {isMutating ? 'Saving…' : 'Save transcript'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
