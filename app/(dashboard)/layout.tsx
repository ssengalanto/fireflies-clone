'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/store/authStore'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const displayName = useAuthStore((s) => s.user?.displayName ?? null)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login')
    }
  }, [isAuthenticated, router])

  // Render nothing while the redirect is in flight. Without this guard the
  // dashboard's content would briefly leak before navigation completes.
  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col justify-between border-r bg-muted/40 p-4 md:flex">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground">
            Fireflies
          </h2>
          {displayName && (
            <p className="mt-1 text-xs text-muted-foreground/80">
              {displayName}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            clearAuth()
            router.replace('/login')
          }}
        >
          Sign out
        </Button>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
