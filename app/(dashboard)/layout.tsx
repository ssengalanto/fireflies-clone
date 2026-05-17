'use client'

import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import type { ReactNode } from 'react'

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

  if (!isAuthenticated) return null

  const initials = displayName
    ? displayName
        .split(/\s+|[._-]/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase())
        .join('')
    : null

  return (
    <div className="relative min-h-screen">
      {/* Slim 56-px sidebar — Raycast-style. Just two affordances:
          the wordmark glyph at top, sign out at bottom. */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-14 flex-col items-center justify-between border-r border-line bg-surface-1 py-5 md:flex">
        <div className="flex flex-col items-center gap-4">
          <div
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-md bg-fg text-sm font-semibold tracking-tight text-background"
          >
            F
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          {initials && (
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-[10px] font-medium text-fg-2"
              aria-label="signed in as"
            >
              {initials}
            </div>
          )}
          <button
            type="button"
            aria-label="Sign out"
            onClick={() => {
              clearAuth()
              router.replace('/login')
            }}
            className="flex h-9 w-9 items-center justify-center rounded-md text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-fg text-xs font-semibold text-background">
            F
          </div>
          <span className="text-sm font-medium tracking-tight">Fireflies</span>
        </div>
        <button
          type="button"
          aria-label="Sign out"
          onClick={() => {
            clearAuth()
            router.replace('/login')
          }}
          className="flex h-8 w-8 items-center justify-center rounded-md text-fg-3 hover:bg-surface-2 hover:text-fg"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </header>

      <main className="md:pl-14">{children}</main>
    </div>
  )
}
