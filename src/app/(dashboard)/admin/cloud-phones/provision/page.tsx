import { createServiceClient } from '@/lib/supabase/service'
import { ProvisionWizard } from './ProvisionWizard'

export const dynamic = 'force-dynamic'

type AccountRow = {
  id: string
  name: string
  scout_id: string | null
  members: { user_id: string; role: string; full_name: string | null; has_subuser: boolean }[]
  phone_count: number
}

export default async function CloudPhonesProvisionPage() {
  // /admin/* layout enforces admin role server-side.
  const svc = createServiceClient()

  const { data: accounts } = await svc
    .from('accounts')
    .select('id, name, scout_id, cloud_phone_subusers')
    .order('created_at', { ascending: false })

  const accountIds = (accounts ?? []).map((a) => a.id)
  const [{ data: members }, { data: phoneCounts }] = await Promise.all([
    accountIds.length
      ? svc
          .from('account_members')
          .select('account_id, user_id, role, profiles!inner(full_name)')
          .in('account_id', accountIds)
      : Promise.resolve({ data: [] }),
    accountIds.length
      ? svc
          .from('ig_accounts')
          .select('account_id')
          .in('account_id', accountIds)
          .not('cloud_phone_profile_id', 'is', null)
      : Promise.resolve({ data: [] }),
  ])

  const phoneCountByAccount = new Map<string, number>()
  for (const p of phoneCounts ?? []) {
    phoneCountByAccount.set(p.account_id, (phoneCountByAccount.get(p.account_id) ?? 0) + 1)
  }

  const membersByAccount = new Map<string, AccountRow['members']>()
  for (const m of (members ?? []) as Array<{
    account_id: string
    user_id: string
    role: string
    profiles: { full_name: string | null } | { full_name: string | null }[] | null
  }>) {
    const list = membersByAccount.get(m.account_id) ?? []
    const profileObj = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
    const subusers = ((accounts ?? []).find((a) => a.id === m.account_id)
      ?.cloud_phone_subusers ?? {}) as Record<string, unknown>
    list.push({
      user_id: m.user_id,
      role: m.role,
      full_name: profileObj?.full_name ?? null,
      has_subuser: Boolean(subusers[m.user_id]),
    })
    membersByAccount.set(m.account_id, list)
  }

  const enriched: AccountRow[] = (accounts ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    scout_id: a.scout_id,
    members: membersByAccount.get(a.id) ?? [],
    phone_count: phoneCountByAccount.get(a.id) ?? 0,
  }))

  return (
    <div className="container mx-auto max-w-5xl py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Cloud Phone Provisioning</h1>
        <p className="text-muted-foreground mt-1">
          Bulk-provision GeeLark cloud phones for an account and assign each one to an operator.
        </p>
      </div>
      <ProvisionWizard accounts={enriched} />
    </div>
  )
}
