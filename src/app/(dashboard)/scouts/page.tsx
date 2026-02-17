'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { Users, Plus, Mail, Briefcase, CheckCircle, XCircle, Search } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

interface Scout {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  created_at: string
  total_deals: number
  active_deals: number
}

export default function ScoutsPage() {
  const router = useRouter()
  const [scouts, setScouts] = useState<Scout[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    email: '',
    full_name: '',
    role: 'scout',
  })

  const checkAccess = useCallback(async () => {
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile?.role !== 'admin') {
          router.push('/dashboard')
        }
      }
    } catch (error) {
      console.error('Error checking access:', error)
    }
  }, [router])

  const fetchScouts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/scouts')
      const data = await res.json()
      if (data.scouts) {
        setScouts(data.scouts)
      }
    } catch (error) {
      console.error('Error fetching scouts:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkAccess()
    fetchScouts()
  }, [checkAccess, fetchScouts])

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.full_name) {
      alert('Please fill in all fields')
      return
    }

    setInviting(true)
    try {
      const res = await fetch('/api/scouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to invite scout')
      }

      alert(data.message || 'Scout invited successfully!')
      setShowInviteModal(false)
      setInviteForm({ email: '', full_name: '', role: 'scout' })
      fetchScouts()
    } catch (error: any) {
      console.error('Error inviting scout:', error)
      alert(error.message || 'Failed to invite scout')
    } finally {
      setInviting(false)
    }
  }

  const filteredScouts = scouts.filter((scout) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      scout.full_name.toLowerCase().includes(searchLower) ||
      scout.email.toLowerCase().includes(searchLower)
    )
  })

  if (loading && scouts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scouts</h1>
          <p className="text-muted-foreground">
            Manage team members and track performance
          </p>
        </div>
        <Button onClick={() => setShowInviteModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Invite Scout
        </Button>
      </div>

      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Scout</DialogTitle>
            <DialogDescription>
              Send an invitation email to a new team member
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                placeholder="scout@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={inviteForm.full_name}
                onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                placeholder="John Doe"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowInviteModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleInvite} disabled={inviting}>
                {inviting ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Invite
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search scouts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      {filteredScouts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No scouts yet"
          description="Invite team members to start building your scout team"
          action={{
            label: 'Invite Scout',
            onClick: () => setShowInviteModal(true),
          }}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Total Deals</TableHead>
                <TableHead className="text-right">Active Deals</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredScouts.map((scout) => (
                <TableRow key={scout.id} className="cursor-pointer hover:bg-accent">
                  <TableCell>
                    <Link
                      href={`/scouts/${scout.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {scout.full_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {scout.email}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={scout.role === 'admin' ? 'default' : 'outline'}
                      className="capitalize"
                    >
                      {scout.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {scout.total_deals}
                  </TableCell>
                  <TableCell className="text-right">
                    {scout.active_deals}
                  </TableCell>
                  <TableCell>
                    {scout.is_active ? (
                      <Badge variant="outline" className="gap-1 bg-green-500/10 text-green-500">
                        <CheckCircle className="h-3 w-3" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-muted-foreground">
                        <XCircle className="h-3 w-3" />
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(scout.created_at)}
                  </TableCell>
                  <TableCell>
                    <Link href={`/scouts/${scout.id}`}>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {scouts.length > 0 && (
        <Card className="p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{scouts.length}</p>
              <p className="text-sm text-muted-foreground">Total Scouts</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {scouts.filter((s) => s.is_active).length}
              </p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {scouts.reduce((sum, s) => sum + s.total_deals, 0)}
              </p>
              <p className="text-sm text-muted-foreground">Total Deals</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
