import { createServiceClient } from '@/lib/supabase/service'
import { AliasGeneratorClient } from './AliasGeneratorClient'

export const dynamic = 'force-dynamic'

type ScoutRow = {
  id: string
  email: string
  full_name: string | null
  subscription_tier: string
  status: string
  fb_status: 'onboarding' | 'warming' | 'ready' | 'failed' | null
  warming_until: string | null
  fb_persona_json: any
  identity_count: number
}

export default async function AliasGeneratePage() {
  // /admin/* layout already enforces admin role server-side
  const supabase = createServiceClient()

  const { data: scouts } = await supabase
    .from('scouts')
    .select('id, email, full_name, subscription_tier, status, fb_status, warming_until, fb_persona_json')
    .in('status', ['onboarding', 'live'])
    .order('onboarding_paid_at', { ascending: false })

  // Count identities per scout's account so we can show "3 of 5 aliases generated"
  const scoutIds = (scouts ?? []).map((s: any) => s.id)
  const counts = new Map<string, number>()

  if (scoutIds.length > 0) {
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, scout_id')
      .in('scout_id', scoutIds)

    const accountIdToScout = new Map<string, string>(
      (accounts ?? []).map((a: any) => [a.id, a.scout_id])
    )

    if (accountIdToScout.size > 0) {
      const { data: ids } = await supabase
        .from('account_identities')
        .select('id, account_id')
        .in('account_id', Array.from(accountIdToScout.keys()))

      for (const id of ids ?? []) {
        const scoutId = accountIdToScout.get((id as any).account_id)
        if (scoutId) counts.set(scoutId, (counts.get(scoutId) ?? 0) + 1)
      }
    }
  }

  const rows: ScoutRow[] = (scouts ?? []).map((s: any) => ({
    ...s,
    identity_count: counts.get(s.id) ?? 0,
  }))

  return <AliasGeneratorClient initialScouts={rows} />
}
