import type { ReactNode } from 'react'

// Basic shell — sidebar slot + main. No auth redirect yet; US5 (T117) wires
// `useAuthStore.isAuthenticated` into this layout to gate the dashboard.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r bg-muted/40 p-4 md:block">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Fireflies
        </h2>
        {/* Nav and sign-out land in US5. */}
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
