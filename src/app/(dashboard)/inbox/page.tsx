'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DEAL_STAGES } from '@/types/database'
import { formatCurrency } from '@/lib/utils'
import {
  Instagram,
  Mail,
  Send,
  ArrowLeft,
  Clock,
  CheckCircle,
  ExternalLink,
  Music,
  Globe,
  Youtube,
  User,
  MessageCircle,
  Filter,
  RefreshCw,
} from 'lucide-react'

interface Thread {
  artist_id: string | null
  thread_key: string | null
  sender_name: string | null
  artist: {
    id: string
    name: string
    image_url: string | null
    instagram_handle: string | null
    email: string | null
  } | null
  deal: {
    id: string
    stage: string
    scout_id: string | null
  } | null
  last_message: {
    text: string
    channel: string
    direction: string
    created_at: string
    sender: string | null
  }
  unread_count: number
  channels: string[]
}

interface Message {
  id: string
  artist_id: string | null
  channel: string
  direction: string
  message_text: string
  sender: string | null
  ig_account_id: string | null
  ig_thread_id: string | null
  ig_message_id: string | null
  external_id: string | null
  scout_id: string | null
  metadata: any
  read: boolean
  created_at: string
  _status?: 'sending' | 'pending'
}

interface ArtistDetail {
  id: string
  name: string
  image_url: string | null
  spotify_monthly_listeners: number
  streams_last_month: number
  track_count: number
  instagram_handle: string | null
  website: string | null
  email: string | null
  youtube_url: string | null
  estimated_offer_low: number | null
  estimated_offer_high: number | null
  qualification_status: string | null
  qualification_reason: string | null
  booking_agency: string | null
  management_company: string | null
}

const INBOX_STAGES = [
  { value: 'replied', label: 'New Reply', color: '#F59E0B' },
  { value: 'interested', label: 'In Conversation', color: '#D97706' },
  { value: 'call_scheduled', label: 'Meeting Booked', color: '#10B981' },
  { value: 'in_negotiation', label: 'Deal In Progress', color: '#4F46E5' },
  { value: 'closed_won', label: 'Closed Won', color: '#22C55E' },
  { value: 'closed_lost', label: 'Closed Lost', color: '#EF4444' },
]

function ChannelIcon({ channel, className }: { channel: string; className?: string }) {
  if (channel === 'instagram') return <Instagram className={className || 'h-4 w-4'} />
  return <Mail className={className || 'h-4 w-4'} />
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'now'
  if (diffMin < 60) return `${diffMin}m`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  if (isToday) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function StageBadge({ stage }: { stage: string | null | undefined }) {
  if (!stage) return null
  const stageInfo = DEAL_STAGES.find(s => s.value === stage)
  if (!stageInfo) return null
  return (
    <Badge
      variant="outline"
      className="text-[10px] px-1.5 py-0 whitespace-nowrap"
      style={{ borderColor: stageInfo.color, color: stageInfo.color }}
    >
      {stageInfo.label}
    </Badge>
  )
}

export default function InboxPage() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null)
  const [selectedThreadKey, setSelectedThreadKey] = useState<string | null>(null)
  const [selectedSenderName, setSelectedSenderName] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [artistDetail, setArtistDetail] = useState<ArtistDetail | null>(null)
  const [dealDetail, setDealDetail] = useState<any>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const isThreadOpen = selectedArtistId !== null || selectedThreadKey !== null

  // Filters
  const [channelFilter, setChannelFilter] = useState('all')
  const [stageFilter, setStageFilter] = useState('all')
  const [unreadOnly, setUnreadOnly] = useState(false)

  // Composer
  const [replyText, setReplyText] = useState('')
  const [replyChannel, setReplyChannel] = useState('instagram')
  const [sending, setSending] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const threadEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Fetch threads
  const fetchThreads = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (channelFilter !== 'all') params.set('channel', channelFilter)
      if (unreadOnly) params.set('unread_only', 'true')

      const res = await fetch(`/api/conversations?${params}`)
      const data = await res.json()
      if (data.threads) {
        let filtered = data.threads
        if (stageFilter !== 'all') {
          filtered = filtered.filter((t: Thread) => t.deal?.stage === stageFilter)
        }
        setThreads(filtered)
      }
    } catch (error) {
      console.error('Failed to fetch threads:', error)
    } finally {
      setLoading(false)
    }
  }, [channelFilter, stageFilter, unreadOnly])

  useEffect(() => {
    fetchThreads()
  }, [fetchThreads])

  // Sync emails from Instantly for this artist
  const syncInstantly = useCallback(async (artistId: string | null) => {
    if (!artistId) return
    setSyncing(true)
    try {
      const res = await fetch('/api/conversations/sync-instantly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist_id: artistId }),
      })
      const data = await res.json()
      if (data.synced > 0) {
        // Re-fetch thread to include synced messages
        const threadRes = await fetch(`/api/conversations?artist_id=${artistId}`)
        const threadData = await threadRes.json()
        setMessages(threadData.messages || [])
      }
    } catch (error) {
      console.error('Instantly sync failed:', error)
    } finally {
      setSyncing(false)
    }
  }, [])

  // Fetch single thread
  const openThread = useCallback(async (thread: Thread) => {
    const artistId = thread.artist_id
    const threadKey = thread.thread_key
    setSelectedArtistId(artistId)
    setSelectedThreadKey(threadKey)
    setSelectedSenderName(thread.sender_name || thread.last_message.sender)
    setThreadLoading(true)
    try {
      // Sync Instantly emails in the background (don't block loading)
      if (artistId) {
        syncInstantly(artistId)
      }

      const queryParam = artistId
        ? `artist_id=${artistId}`
        : `thread_key=${threadKey}`
      const res = await fetch(`/api/conversations?${queryParam}`)
      const data = await res.json()
      setMessages(data.messages || [])
      setArtistDetail(data.artist || null)
      setDealDetail(data.deal || null)

      // Default reply channel to most recent inbound channel
      const lastInbound = [...(data.messages || [])].reverse().find((m: Message) => m.direction === 'inbound')
      if (lastInbound) {
        setReplyChannel(lastInbound.channel)
      }

      // Mark as read
      await fetch('/api/conversations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(artistId ? { artist_id: artistId } : { thread_key: threadKey }),
      })

      // Update unread count in thread list
      const matchKey = artistId || threadKey
      setThreads(prev => prev.map(t =>
        (t.artist_id || t.thread_key) === matchKey ? { ...t, unread_count: 0 } : t
      ))
    } catch (error) {
      console.error('Failed to fetch thread:', error)
    } finally {
      setThreadLoading(false)
    }
  }, [syncInstantly])

  // Scroll to bottom when messages change
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const subscription = supabase
      .channel('inbox-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        (payload) => {
          const newMsg = payload.new as Message

          // Update thread list
          fetchThreads()

          // If this message belongs to the open thread, add it
          const matchesThread = (selectedArtistId && newMsg.artist_id === selectedArtistId) ||
            (selectedThreadKey && newMsg.ig_thread_id === selectedThreadKey)
          if (matchesThread) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev
              return [...prev, newMsg]
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [selectedArtistId, selectedThreadKey, fetchThreads])

  // Send reply
  const handleSend = async () => {
    if (!replyText.trim() || !isThreadOpen || sending) return
    setSending(true)

    const optimisticMsg: Message = {
      id: `temp_${Date.now()}`,
      artist_id: selectedArtistId || null,
      channel: replyChannel,
      direction: 'outbound',
      message_text: replyText,
      sender: null,
      ig_account_id: null,
      ig_thread_id: null,
      ig_message_id: null,
      external_id: null,
      scout_id: null,
      metadata: {},
      read: true,
      created_at: new Date().toISOString(),
      _status: 'sending',
    }

    setMessages(prev => [...prev, optimisticMsg])
    setReplyText('')

    try {
      if (!selectedArtistId) {
        setMessages(prev => prev.map(m =>
          m.id === optimisticMsg.id ? { ...m, _status: 'pending' } : m
        ))
        console.error('Cannot send: no matched artist')
        setSending(false)
        return
      }

      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist_id: selectedArtistId,
          channel: replyChannel,
          message_text: replyText,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setMessages(prev => prev.map(m =>
          m.id === optimisticMsg.id ? { ...m, _status: 'pending' } : m
        ))
        console.error('Send failed:', data.error)
      }
    } catch (error) {
      console.error('Send error:', error)
    } finally {
      setSending(false)
    }
  }

  // Update deal stage
  const handleStageChange = async (newStage: string) => {
    if (!dealDetail?.id) return
    try {
      const supabase = createClient()
      await supabase
        .from('deals')
        .update({ stage: newStage, stage_changed_at: new Date().toISOString() })
        .eq('id', dealDetail.id)
      setDealDetail((prev: any) => prev ? { ...prev, stage: newStage } : prev)
    } catch (error) {
      console.error('Stage update error:', error)
    }
  }

  // Keyboard shortcut: Enter to send, Shift+Enter for newline
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const closeThread = () => {
    setSelectedArtistId(null)
    setSelectedThreadKey(null)
    setSelectedSenderName(null)
    setMessages([])
    setArtistDetail(null)
    setDealDetail(null)
    setReplyText('')
  }

  // ── THREAD LIST VIEW ──
  if (!isThreadOpen) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Inbox</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MessageCircle className="h-4 w-4" />
            {threads.length} conversations
          </div>
        </div>

        {/* Filters */}
        <Card className="p-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="all">All Channels</option>
              <option value="instagram">Instagram</option>
              <option value="email">Email</option>
            </select>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="all">All Stages</option>
              {INBOX_STAGES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(e.target.checked)}
                className="rounded border-input"
              />
              Unread only
            </label>
          </div>
        </Card>

        {/* Thread List */}
        <Card className="divide-y">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading conversations...</div>
          ) : threads.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No conversations yet
            </div>
          ) : (
            threads.map((thread) => (
              <button
                key={thread.artist_id || thread.thread_key || thread.last_message.created_at}
                onClick={() => openThread(thread)}
                className="w-full flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors text-left"
              >
                {/* Avatar */}
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {thread.artist?.image_url ? (
                    <img src={thread.artist.image_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <User className="h-5 w-5 text-primary" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">
                      {thread.artist?.name || thread.last_message.sender || 'Unknown'}
                    </span>
                    {thread.unread_count > 0 && (
                      <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 h-4 min-w-[16px] flex items-center justify-center">
                        {thread.unread_count}
                      </Badge>
                    )}
                    <StageBadge stage={thread.deal?.stage} />
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <ChannelIcon channel={thread.last_message.channel} className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground truncate">
                      {thread.last_message.direction === 'outbound' && 'You: '}
                      {thread.last_message.text.slice(0, 60)}
                      {thread.last_message.text.length > 60 ? '...' : ''}
                    </span>
                  </div>
                </div>

                {/* Timestamp */}
                <span className="text-[11px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                  {timeAgo(thread.last_message.created_at)}
                </span>
              </button>
            ))
          )}
        </Card>
      </div>
    )
  }

  // ── CONVERSATION DETAIL VIEW ──
  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      {/* Sidebar - Artist Info (30%) */}
      <Card className="w-[30%] min-w-[280px] flex flex-col overflow-hidden">
        <div className="p-4 border-b flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={closeThread}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="font-semibold truncate">{artistDetail?.name || selectedSenderName || 'Conversation'}</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Avatar & Name */}
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              {artistDetail?.image_url ? (
                <img src={artistDetail.image_url} alt="" className="h-14 w-14 rounded-full object-cover" />
              ) : (
                <User className="h-7 w-7 text-primary" />
              )}
            </div>
            <div>
              <h3 className="font-semibold">{artistDetail?.name || selectedSenderName || 'Unknown'}</h3>
              {artistDetail?.qualification_status && (
                <Badge
                  variant="outline"
                  className={`text-[10px] mt-0.5 ${
                    artistDetail.qualification_status === 'qualified' ? 'text-green-500 border-green-500/30' :
                    artistDetail.qualification_status === 'not_qualified' ? 'text-red-400 border-red-400/30' :
                    artistDetail.qualification_status === 'review' ? 'text-yellow-400 border-yellow-400/30' :
                    'text-muted-foreground'
                  }`}
                >
                  {artistDetail.qualification_status === 'qualified' ? 'Qualified' :
                   artistDetail.qualification_status === 'not_qualified' ? 'Not Qualified' :
                   artistDetail.qualification_status === 'review' ? 'Review' : 'Pending'}
                </Badge>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-2 text-sm">
            {(artistDetail?.spotify_monthly_listeners ?? 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Music className="h-3.5 w-3.5" /> Monthly Listeners
                </span>
                <span className="font-medium">{(artistDetail?.spotify_monthly_listeners || 0).toLocaleString()}</span>
              </div>
            )}
            {(artistDetail?.streams_last_month ?? 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Streams</span>
                <span className="font-medium">{(artistDetail?.streams_last_month || 0).toLocaleString()}</span>
              </div>
            )}
            {(artistDetail?.track_count ?? 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tracks</span>
                <span className="font-medium">{artistDetail?.track_count}</span>
              </div>
            )}
          </div>

          {/* Offer Range */}
          {(artistDetail?.estimated_offer_low || artistDetail?.estimated_offer_high) && (
            <div className="bg-accent/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Estimated Offer</div>
              <div className="font-semibold">
                {formatCurrency(artistDetail?.estimated_offer_low || 0)} – {formatCurrency(artistDetail?.estimated_offer_high || 0)}
              </div>
            </div>
          )}

          {/* Social Links */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Links</div>
            {artistDetail?.instagram_handle && (
              <a
                href={`https://instagram.com/${artistDetail.instagram_handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Instagram className="h-3.5 w-3.5" />
                @{artistDetail.instagram_handle}
                <ExternalLink className="h-3 w-3 ml-auto" />
              </a>
            )}
            {artistDetail?.youtube_url && (
              <a
                href={artistDetail.youtube_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Youtube className="h-3.5 w-3.5" />
                YouTube
                <ExternalLink className="h-3 w-3 ml-auto" />
              </a>
            )}
            {artistDetail?.website && (
              <a
                href={artistDetail.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Globe className="h-3.5 w-3.5" />
                Website
                <ExternalLink className="h-3 w-3 ml-auto" />
              </a>
            )}
            {artistDetail?.email && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                <span className="truncate">{artistDetail.email}</span>
              </div>
            )}
          </div>

          {/* Management / Booking */}
          {(artistDetail?.management_company || artistDetail?.booking_agency) && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contacts</div>
              {artistDetail?.management_company && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Mgmt: </span>
                  {artistDetail.management_company}
                </div>
              )}
              {artistDetail?.booking_agency && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Booking: </span>
                  {artistDetail.booking_agency}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Main Thread Area (70%) */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Thread Header */}
        <Card className="p-3 flex items-center gap-3 mb-3">
          <h2 className="font-semibold">{artistDetail?.name || selectedSenderName || 'Conversation'}</h2>
          {selectedArtistId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => syncInstantly(selectedArtistId)}
              disabled={syncing}
              title="Sync emails from Instantly"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            </Button>
          )}
          <div className="flex-1" />
          {dealDetail && (
            <select
              value={dealDetail.stage || ''}
              onChange={(e) => handleStageChange(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              {INBOX_STAGES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          )}
        </Card>

        {/* Messages */}
        <Card className="flex-1 overflow-y-auto p-4 space-y-3">
          {threadLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No messages yet
            </div>
          ) : (
            <>
              {messages.map((msg) => {
                const isOutbound = msg.direction === 'outbound'
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                        isOutbound
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-accent rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.message_text}</p>
                      <div className={`flex items-center gap-1.5 mt-1 ${
                        isOutbound ? 'justify-end' : 'justify-start'
                      }`}>
                        <ChannelIcon
                          channel={msg.channel}
                          className={`h-3 w-3 ${isOutbound ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}
                        />
                        <span className={`text-[10px] ${
                          isOutbound ? 'text-primary-foreground/60' : 'text-muted-foreground'
                        }`}>
                          {formatTimestamp(msg.created_at)}
                        </span>
                        {msg._status === 'sending' && (
                          <Clock className={`h-3 w-3 ${isOutbound ? 'text-primary-foreground/60' : 'text-muted-foreground'}`} />
                        )}
                        {msg._status === 'pending' && (
                          <Clock className="h-3 w-3 text-yellow-400" />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={threadEndRef} />
            </>
          )}
        </Card>

        {/* Composer */}
        <Card className="mt-3 p-3">
          <div className="flex items-end gap-2">
            <select
              value={replyChannel}
              onChange={(e) => setReplyChannel(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm flex-shrink-0"
            >
              <option value="instagram">Instagram</option>
              <option value="email">Email</option>
            </select>
            <textarea
              ref={textareaRef}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[36px] max-h-[120px] focus:outline-none focus:ring-2 focus:ring-ring"
              style={{ height: 'auto', overflow: 'hidden' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = Math.min(target.scrollHeight, 120) + 'px'
              }}
            />
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!replyText.trim() || sending}
              className="flex-shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Enter to send · Shift+Enter for new line
          </p>
        </Card>
      </div>
    </div>
  )
}
