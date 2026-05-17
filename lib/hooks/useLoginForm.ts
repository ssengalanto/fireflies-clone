'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { login } from '@/lib/fetchers/auth.fetcher'
import {
  loginInputSchema,
  type LoginInput,
} from '@/lib/schemas/auth.schema'
import { useAuthStore } from '@/lib/store/authStore'

export function useLoginForm() {
  const setUser = useAuthStore((s) => s.setUser)
  const router = useRouter()
  const [error, setError] = useState<Error | null>(null)
  const [isPending, setIsPending] = useState(false)

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginInputSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    setIsPending(true)
    setError(null)
    try {
      const user = await login(data)
      setUser(user)
      router.replace('/')
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsPending(false)
    }
  })

  return { form, onSubmit, isPending, error }
}
