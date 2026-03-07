'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Trash2, CheckCircle, SendIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface QueueMessage {
  id: string
  ig_account_id: string
  target_username: string
  message_text: string
  scheduled_for: string
  artists: { name: string } | null
}

export default function OutreachQueuePage() {
  const [messages, setMessages] = useState<QueueMessage[]>([])
  const [igAccounts, setIgAccounts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [bulkApproving, setBulkApproving] = useState(false)
  
  const { toast } = useToast()
  const supabase = createClient()

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch accounts for mapping
      const { data: accountsData } = await supabase.from('ig_accounts').select('id, ig_username')
      const accountMap: Record<string, string> = {}
      if (accountsData) {
        accountsData.forEach(acc => {
          accountMap[acc.id] = acc.ig_username
        })
      }
      setIgAccounts(accountMap)

      // Fetch pending unapproved messages
      const { data, error } = await supabase
        .from('pending_outbound_messages')
        .select(`
          id,
          ig_account_id,
          target_username,
          message_text,
          scheduled_for,
          artists (
            name
          )
        `)
        .eq('status', 'pending')
        .eq('is_approved', false)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      // Map correctly handles the array response for artists from some Supabase versions or single object
      const formattedData = (data || []).map((msg: any) => ({
        ...msg,
        artists: Array.isArray(msg.artists) ? msg.artists[0] : msg.artists
      }))
      
      setMessages(formattedData)
      setSelectedIds(new Set())
    } catch (error: any) {
      console.error('Error fetching queue:', error)
      toast({ title: 'Error', description: 'Failed to load outreach queue', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleMessageChange = (id: string, newText: string) => {
    setMessages(msgs => msgs.map(m => m.id === id ? { ...m, message_text: newText } : m))
  }

  const handleDateChange = (id: string, newDate: string) => {
    if (!newDate) return
    const isoDate = new Date(newDate).toISOString()
    setMessages(msgs => msgs.map(m => m.id === id ? { ...m, scheduled_for: isoDate } : m))
  }

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  const toggleAll = () => {
    if (selectedIds.size === messages.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(messages.map(m => m.id)))
    }
  }

  const formatForDatetimeLocal = (isoString: string) => {
    if (!isoString) return ''
    const date = new Date(isoString)
    // Adjust for local timezone offset to display correctly in datetime-local input
    const offset = date.getTimezoneOffset() * 60000
    const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 16)
    return localISOTime
  }

  const handleApprove = async (message: QueueMessage) => {
    setApprovingIds(prev => new Set(prev).add(message.id))
    try {
      const { error } = await supabase
        .from('pending_outbound_messages')
        .update({
          message_text: message.message_text,
          scheduled_for: message.scheduled_for,
          is_approved: true
        })
        .eq('id', message.id)

      if (error) throw error

      toast({ title: 'Approved', description: 'Message has been approved and queued.' })
      setMessages(msgs => msgs.filter(m => m.id !== message.id))
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(message.id)
        return next
      })
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to approve message', variant: 'destructive' })
    } finally {
      setApprovingIds(prev => {
        const next = new Set(prev)
        next.delete(message.id)
        return next
      })
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingIds(prev => new Set(prev).add(id))
    try {
      const { error } = await supabase
        .from('pending_outbound_messages')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast({ title: 'Deleted', description: 'Draft message has been removed.' })
      setMessages(msgs => msgs.filter(m => m.id !== id))
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to delete message', variant: 'destructive' })
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return
    setBulkApproving(true)
    try {
      const messagesToApprove = messages.filter(m => selectedIds.has(m.id))
      
      // Since Supabase RPC or bulk update might be complex with individual text/date changes,
      // we'll run them in parallel via promises
      const promises = messagesToApprove.map(msg => 
        supabase
          .from('pending_outbound_messages')
          .update({
            message_text: msg.message_text,
            scheduled_for: msg.scheduled_for,
            is_approved: true
          })
          .eq('id', msg.id)
      )

      await Promise.all(promises)

      toast({ title: 'Success', description: `Approved ${selectedIds.size} messages.` })
      setMessages(msgs => msgs.filter(m => !selectedIds.has(m.id)))
      setSelectedIds(new Set())
    } catch (error: any) {
      console.error('Bulk approve error:', error)
      toast({ title: 'Error', description: 'Failed to approve some messages. Try individually.', variant: 'destructive' })
      // Refresh to get actual state
      fetchData()
    } finally {
      setBulkApproving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-[var(--font-heading)]">Outreach Queue</h1>
          <p className="text-muted-foreground mt-1">
            Review, edit, and approve AI-generated cold DMs before they are dispatched.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            onClick={fetchData} 
            variant="outline" 
            disabled={loading}
          >
            Refresh
          </Button>
          <Button 
            onClick={handleBulkApprove} 
            disabled={selectedIds.size === 0 || bulkApproving}
            className="min-w-[160px]"
          >
            {bulkApproving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Approve Selected ({selectedIds.size})
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Approval</CardTitle>
          <CardDescription>
            {messages.length} message{messages.length !== 1 ? 's' : ''} awaiting review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <SendIcon className="h-8 w-8 mx-auto text-muted-foreground mb-3 opacity-50" />
              <h3 className="font-medium text-lg">Queue is empty</h3>
              <p className="text-muted-foreground text-sm mt-1">
                No cold DMs are currently pending approval.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox 
                        checked={selectedIds.size === messages.length && messages.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead className="w-[200px]">Artist / Target</TableHead>
                    <TableHead className="w-[150px]">IG Account</TableHead>
                    <TableHead className="min-w-[300px]">Message Text</TableHead>
                    <TableHead className="w-[220px]">Scheduled Date</TableHead>
                    <TableHead className="w-[120px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map((msg) => (
                    <TableRow key={msg.id}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedIds.has(msg.id)}
                          onCheckedChange={() => toggleSelection(msg.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{msg.artists?.name || 'Unknown Artist'}</div>
                        <div className="text-xs text-muted-foreground">@{msg.target_username}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          @{igAccounts[msg.ig_account_id] || 'Unknown'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Textarea 
                          value={msg.message_text}
                          onChange={(e) => handleMessageChange(msg.id, e.target.value)}
                          className="min-h-[80px] text-sm resize-y"
                        />
                      </TableCell>
                      <TableCell>
                        <Input 
                          type="datetime-local" 
                          value={formatForDatetimeLocal(msg.scheduled_for)}
                          onChange={(e) => handleDateChange(msg.id, e.target.value)}
                          className="text-sm"
                        />
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDelete(msg.id)}
                          disabled={deletingIds.has(msg.id) || approvingIds.has(msg.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          {deletingIds.has(msg.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                        <Button 
                          size="sm"
                          onClick={() => handleApprove(msg)}
                          disabled={approvingIds.has(msg.id) || deletingIds.has(msg.id)}
                        >
                          {approvingIds.has(msg.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
