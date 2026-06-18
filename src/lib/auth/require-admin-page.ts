import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Server-side admin gate for dashboard route groups.
 *
 * Call from a layout.tsx (or directly at the top of a page.tsx server
 * component). Non-admin authenticated users are redirected to /inbox.
 * Unauthenticated users are redirected to /login (matching middleware).
 *
 * Pages that need admin-only access in this codebase:
 *   - /admin/**         (already gated via app/(dashboard)/admin/layout.tsx)
 *   - /analytics        (Sidebar admin-only)
 *   - /scouts           (Sidebar admin-only — distinct from /admin/scouts)
 *   - /scraping         (Sidebar admin-only)
 */
export async function requireAdminPage(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') {
    redirect('/inbox')
  }
}
