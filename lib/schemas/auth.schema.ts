import { z } from 'zod'

export const userSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1).max(80),
})
export type User = z.infer<typeof userSchema>

export const loginInputSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(200, 'Password is too long'),
})
export type LoginInput = z.infer<typeof loginInputSchema>
