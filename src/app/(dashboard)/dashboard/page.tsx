import { createClient } from '@/lib/supabase/server'
import { StatsCard } from '@/components/shared/StatsCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Briefcase, Mail, DollarSign } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  // Fetch stats
  const { count: artistCount } = await supabase
    .from('artists')
    .select('*', { count: 'exact', head: true })

  const { count: dealCount } = await supabase
    .from('deals')
    .select('*', { count: 'exact', head: true })
    .eq('scout_id', user!.id)

  const { data: deals } = await supabase
    .from('deals')
    .select('estimated_deal_value')
    .eq('scout_id', user!.id)

  const totalPipelineValue = deals?.reduce((sum, deal) => sum + (deal.estimated_deal_value || 0), 0) || 0

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {profile?.full_name}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Artists"
          value={artistCount || 0}
          icon={Users}
        />
        <StatsCard
          title="Active Deals"
          value={dealCount || 0}
          icon={Briefcase}
        />
        <StatsCard
          title="Pipeline Value"
          value={`$${(totalPipelineValue / 1000).toFixed(0)}K`}
          icon={DollarSign}
        />
        <StatsCard
          title="Emails Sent"
          value="0"
          icon={Mail}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No recent activity to display
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href="/artists"
              className="block p-3 rounded-lg border hover:bg-accent transition-colors"
            >
              <p className="font-medium">View Artists</p>
              <p className="text-sm text-muted-foreground">
                Browse and manage your artist database
              </p>
            </a>
            <a
              href="/pipeline"
              className="block p-3 rounded-lg border hover:bg-accent transition-colors"
            >
              <p className="font-medium">Pipeline</p>
              <p className="text-sm text-muted-foreground">
                Track deals through your sales pipeline
              </p>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
