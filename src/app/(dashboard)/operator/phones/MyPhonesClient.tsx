'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Smartphone, ExternalLink, AlertTriangle } from 'lucide-react'

type Phone = {
  ig_account_id: string
  ig_username: string
  display_name: string
  cloud_phone_provider: 'geelark'
  status: 'ready' | 'warming' | 'provisioning' | 'failed'
  warming_until: string | null
  last_opened_at: string | null
  today_dms_sent: number
  today_dms_remaining: number
}

function StatusBadge({ status }: { status: Phone['status'] }) {
  if (status === 'ready') return <Badge className="bg-green-600 hover:bg-green-600">Ready</Badge>
  if (status === 'warming') return <Badge className="bg-amber-600 hover:bg-amber-600">Warming</Badge>
  if (status === 'provisioning')
    return <Badge variant="outline">Provisioning</Badge>
  return <Badge variant="destructive">Failed</Badge>
}

function relativeDate(iso: string | null): string {
  if (!iso) return 'never'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'just now'
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3600_000)}h ago`
  return `${Math.floor(ms / 86_400_000)}d ago`
}

export function MyPhonesClient() {
  const { toast } = useToast()
  const [phones, setPhones] = useState<Phone[] | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/operator/my-phones')
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!alive) return
        if (!ok) {
          setLoadErr(d?.error ?? 'Failed to load phones')
          return
        }
        setPhones(d.phones as Phone[])
      })
      .catch((e) => alive && setLoadErr(e?.message ?? String(e)))
    return () => {
      alive = false
    }
  }, [])

  async function open(phone: Phone) {
    setOpeningId(phone.ig_account_id)
    try {
      const res = await fetch('/api/operator/open-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ig_account_id: phone.ig_account_id }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({
          title: 'Could not open phone',
          description: data.error ?? 'Unknown error',
          variant: 'destructive',
        })
        return
      }
      // Bump last_opened_at locally so the UI reflects the click immediately
      setPhones((prev) =>
        prev
          ? prev.map((p) =>
              p.ig_account_id === phone.ig_account_id
                ? { ...p, last_opened_at: new Date().toISOString() }
                : p
            )
          : prev
      )
      window.open(data.launch_url, '_blank', 'noopener,noreferrer')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast({ title: 'Could not open phone', description: msg, variant: 'destructive' })
    } finally {
      setOpeningId(null)
    }
  }

  if (loadErr) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center gap-2 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4" />
          {loadErr}
        </CardContent>
      </Card>
    )
  }
  if (phones === null) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading phones…
      </div>
    )
  }
  if (phones.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          You don&apos;t have any cloud phones assigned yet. Ask your admin to provision and assign
          phones in the Cloud Phone Provisioning page.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {phones.map((phone) => {
        const progress =
          phone.today_dms_sent + phone.today_dms_remaining > 0
            ? Math.round(
                (phone.today_dms_sent /
                  (phone.today_dms_sent + phone.today_dms_remaining)) *
                  100
              )
            : 0
        return (
          <Card key={phone.ig_account_id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">{phone.display_name}</CardTitle>
                  <CardDescription className="text-xs">@{phone.ig_username}</CardDescription>
                </div>
                <StatusBadge status={phone.status} />
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Today</span>
                  <span className="font-medium">
                    {phone.today_dms_sent} / {phone.today_dms_sent + phone.today_dms_remaining} DMs
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="mt-3 text-xs text-muted-foreground">
                Last opened: {relativeDate(phone.last_opened_at)}
              </div>

              <div className="mt-auto pt-4">
                <Button
                  onClick={() => open(phone)}
                  disabled={openingId !== null || phone.status !== 'ready'}
                  className="w-full"
                >
                  {openingId === phone.ig_account_id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Opening…
                    </>
                  ) : (
                    <>
                      <Smartphone className="mr-2 h-4 w-4" />
                      Open Phone
                      <ExternalLink className="ml-2 h-3 w-3 opacity-60" />
                    </>
                  )}
                </Button>
                {phone.status === 'warming' && phone.warming_until && (
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Warming until{' '}
                    {new Date(phone.warming_until).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
