'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, AlertTriangle, CheckCircle2, Smartphone } from 'lucide-react'

type Member = {
  user_id: string
  role: string
  full_name: string | null
  has_subuser: boolean
}

type Account = {
  id: string
  name: string
  scout_id: string | null
  members: Member[]
  phone_count: number
}

type ProvisionResult = {
  ig_account_id: string
  cloud_phone_profile_id: string
  operator_user_id: string | null
  needs_manual_assignment: boolean
  error?: string
}

type Assignment = { label: string; operator_user_id: string | '' }

export function ProvisionWizard({ accounts }: { accounts: Account[] }) {
  const { toast } = useToast()
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts[0]?.id ?? ''
  )
  const [count, setCount] = useState(3)
  const [labelPrefix, setLabelPrefix] = useState('')
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<ProvisionResult[] | null>(null)

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId]
  )

  function buildAssignments(n: number, prefix: string): Assignment[] {
    return Array.from({ length: n }, (_, i) => ({
      label: prefix ? `${prefix}-${i + 1}` : '',
      operator_user_id: '',
    }))
  }

  function regen() {
    setAssignments(buildAssignments(count, labelPrefix))
    setResults(null)
  }

  async function provision() {
    if (!selectedAccount) return
    setBusy(true)
    setResults(null)
    try {
      const res = await fetch('/api/admin/cloud-phones/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: selectedAccount.id,
          count: assignments.length || count,
          assignments: (assignments.length ? assignments : buildAssignments(count, labelPrefix))
            .map((a) => ({
              label: a.label || undefined,
              operator_user_id: a.operator_user_id || undefined,
            })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({
          title: 'Provisioning failed',
          description: data.error ?? 'Unknown error',
          variant: 'destructive',
        })
        return
      }
      setResults(data.phones as ProvisionResult[])
      toast({
        title: `Provisioned ${data.provisioned} of ${data.requested}`,
        description:
          data.provisioned === data.requested
            ? 'All phones live in GeeLark.'
            : 'Some phones failed — check the result list below.',
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast({ title: 'Provisioning failed', description: msg, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          No accounts found. Create a scout via the Billing page first.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Step 1: account + count */}
      <Card>
        <CardHeader>
          <CardTitle>1. Scope</CardTitle>
          <CardDescription>Pick the tenant and how many phones to provision.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Account</Label>
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              disabled={busy}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} — {a.members.length} member{a.members.length === 1 ? '' : 's'},{' '}
                  {a.phone_count} phone{a.phone_count === 1 ? '' : 's'} already
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="count">Number of phones</Label>
              <Input
                id="count"
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(e) =>
                  setCount(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))
                }
                disabled={busy}
              />
            </div>
            <div>
              <Label htmlFor="prefix">Label prefix (optional)</Label>
              <Input
                id="prefix"
                value={labelPrefix}
                placeholder="e.g. acme-march"
                onChange={(e) => setLabelPrefix(e.target.value)}
                disabled={busy}
              />
            </div>
          </div>
          <Button onClick={regen} disabled={busy} variant="outline" type="button">
            Build assignment list →
          </Button>
        </CardContent>
      </Card>

      {/* Step 2: per-phone operator assignment */}
      {assignments.length > 0 && selectedAccount && (
        <Card>
          <CardHeader>
            <CardTitle>2. Operator assignments</CardTitle>
            <CardDescription>
              Optionally assign each phone to a specific operator. Operators without a GeeLark
              sub-user will be flagged for manual assignment after provisioning.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {assignments.map((a, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-1 text-xs text-muted-foreground">#{i + 1}</div>
                <Input
                  className="col-span-5"
                  value={a.label}
                  placeholder={`auto: ${selectedAccount.name}-phone-...`}
                  onChange={(e) =>
                    setAssignments((prev) =>
                      prev.map((row, idx) =>
                        idx === i ? { ...row, label: e.target.value } : row
                      )
                    )
                  }
                  disabled={busy}
                />
                <select
                  className="col-span-6 rounded-md border bg-background px-3 py-2 text-sm"
                  value={a.operator_user_id}
                  onChange={(e) =>
                    setAssignments((prev) =>
                      prev.map((row, idx) =>
                        idx === i ? { ...row, operator_user_id: e.target.value } : row
                      )
                    )
                  }
                  disabled={busy}
                >
                  <option value="">— unassigned —</option>
                  {selectedAccount.members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.full_name ?? m.user_id.slice(0, 8)} ({m.role})
                      {m.has_subuser ? '' : ' • no sub-user yet'}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <div className="pt-4">
              <Button onClick={provision} disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Provisioning {assignments.length}…
                  </>
                ) : (
                  <>
                    <Smartphone className="mr-2 h-4 w-4" />
                    Provision {assignments.length} phone{assignments.length === 1 ? '' : 's'}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: results */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle>3. Results</CardTitle>
            <CardDescription>
              {results.filter((r) => r.ig_account_id).length} of {results.length} provisioned. Phones
              flagged below need a GeeLark sub-user before the operator can open them.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {results.map((r, i) => (
              <div key={i} className="flex items-center justify-between border-b py-2">
                <div className="flex items-center gap-2">
                  {r.error ? (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                  <span className="font-mono text-xs">
                    {r.cloud_phone_profile_id || '(no profile)'} → {r.ig_account_id || '(failed)'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {r.error && (
                    <Badge variant="destructive" className="text-[10px]">
                      {r.error.slice(0, 60)}
                    </Badge>
                  )}
                  {!r.error && r.needs_manual_assignment && (
                    <Badge variant="outline" className="text-[10px]">
                      needs sub-user
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
