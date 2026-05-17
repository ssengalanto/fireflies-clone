import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center p-6">
      <div className="w-full space-y-6">
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Any valid email and a 6-character password works in this demo.
          </p>
        </header>
        <LoginForm />
      </div>
    </div>
  )
}
