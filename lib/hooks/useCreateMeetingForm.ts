'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'

import {
  createMeetingSchema,
  type CreateMeetingInput,
} from '@/lib/schemas/meeting.schema'
import { useMeetingStore } from '@/lib/store/meetingStore'
import { useUIStore } from '@/lib/store/uiStore'

import { useCreateMeeting } from './useCreateMeeting'

function buildDefaultValues(): CreateMeetingInput {
  return {
    title: '',
    participants: [''],
    date: new Date().toISOString(),
  }
}

export function useCreateMeetingForm() {
  const { create, isCreating } = useCreateMeeting()
  const meetingDraft = useMeetingStore((s) => s.meetingDraft)
  const setMeetingDraft = useMeetingStore((s) => s.setMeetingDraft)
  const clearMeetingDraft = useMeetingStore((s) => s.clearMeetingDraft)
  const closeModal = useUIStore((s) => s.closeModal)

  const form = useForm<CreateMeetingInput>({
    resolver: zodResolver(createMeetingSchema),
    defaultValues: {
      ...buildDefaultValues(),
      ...meetingDraft,
    },
    mode: 'onSubmit',
  })

  // Hydrate the form from the persisted draft, exactly once on mount.
  // The deps array stays empty intentionally — we only want this on mount.
  useEffect(() => {
    if (meetingDraft) {
      form.reset({ ...buildDefaultValues(), ...meetingDraft })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mirror every keystroke into the persisted draft. Cleanup on unmount.
  useEffect(() => {
    const sub = form.watch((values) => {
      setMeetingDraft(values as Partial<CreateMeetingInput>)
    })
    return () => sub.unsubscribe()
  }, [form, setMeetingDraft])

  const onSubmit = form.handleSubmit(async (data) => {
    await create(data)
    // Order matters — see fireflies-forms/references/form-hooks.md.
    // reset() first so RHF state lands on defaults; then clear the Zustand
    // draft so the watch-triggered write of defaults doesn't survive.
    form.reset(buildDefaultValues())
    clearMeetingDraft()
    closeModal()
  })

  return {
    form,
    onSubmit,
    isPending: isCreating,
  }
}
