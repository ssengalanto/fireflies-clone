import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="reveal reveal-1 w-full max-w-sm space-y-8">
        <div className="space-y-4 text-center">
          <div
            aria-hidden="true"
            className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-fg text-sm font-semibold tracking-tight text-background"
          >
            F
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight text-fg">
              Sign in to Fireflies
            </h1>
            <p className="text-sm text-fg-3">
              Any valid email and a six-character password works in this demo.
            </p>
          </div>
        </div>

        <LoginForm />

        <p className="text-center text-xs text-fg-muted">
          The soft gate is a placeholder for a real identity provider.
        </p>
      </div>
    </div>
  )
}
