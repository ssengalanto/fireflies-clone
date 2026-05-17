'use client'

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useLoginForm } from '@/lib/hooks/useLoginForm'

export function LoginForm() {
  const { form, onSubmit, isPending, error } = useLoginForm()

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel htmlFor="login-email" className="eyebrow">
                Email
              </FormLabel>
              <FormControl>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="alice@example.com"
                  className="h-10 w-full rounded-md border border-line bg-surface-1 px-3 text-sm text-fg placeholder:text-fg-muted focus:border-accent focus:outline-none focus:ring-0"
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-xs text-danger" />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel htmlFor="login-password" className="eyebrow">
                Password
              </FormLabel>
              <FormControl>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••"
                  className="h-10 w-full rounded-md border border-line bg-surface-1 px-3 text-sm text-fg placeholder:text-fg-muted focus:border-accent focus:outline-none focus:ring-0"
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-xs text-danger" />
            </FormItem>
          )}
        />

        {error && (
          <p
            role="alert"
            className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-fg"
          >
            {error.message}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="btn-primary !w-full !justify-center !py-2.5"
        >
          {isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </Form>
  )
}
