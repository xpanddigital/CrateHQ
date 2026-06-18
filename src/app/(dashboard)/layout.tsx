import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/shared/Sidebar'
import { TopBar } from '@/components/shared/TopBar'
import { PastDueBanner } from '@/components/shared/PastDueBanner'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  // Subscription health gate. Admins (Joel) always pass. Otherwise:
  //   - cancelled / refunded → kick to /login with an error message
  //   - past_due             → allow access but display a top banner
  //   - onboarding / live    → normal access
  //   - no scouts row (e.g. fresh admin-invited team member with no
  //     billing record) → allow; their account_members entry grants access
  let subscriptionState: 'ok' | 'past_due' = 'ok'
  if (profile.role !== 'admin') {
    const { data: scout } = await supabase
      .from('scouts')
      .select('status')
      .eq('profile_id', user.id)
      .maybeSingle()
    if (scout?.status === 'cancelled' || scout?.status === 'refunded') {
      const url = new URL('/login', 'https://placeholder.invalid')
      url.searchParams.set('error', 'subscription_inactive')
      redirect(url.pathname + url.search)
    }
    if (scout?.status === 'past_due') {
      subscriptionState = 'past_due'
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar profile={profile} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        {subscriptionState === 'past_due' && <PastDueBanner />}
        <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6 pt-20 md:pt-6">
          {children}
        </main>
      </div>
    </div>
  )
}
