'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { TagBadge } from '@/components/shared/TagBadge'
import { ArrowLeft, Mail, Music, DollarSign, Calendar, Send, ArrowUpRight, ArrowDownLeft, Phone, Instagram, StickyNote, Clock, Sparkles, Check, X, Edit } from 'lucide-react'
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils'

interface Conversation {
  id: string
  channel: 'email' | 'instagram' | 'phone' | 'note' | 'system'
  direction: 'outbound' | 'inbound' | 'internal'
  subject: string | null
  body: string
  ai_classification: string | null
  sent_at: string
}

interface Deal {
  id: string
  stage: string
  estimated_deal_value: number | null
  actual_deal_value: number | null
  commission_amount: number | null
  notes: string | null
  next_followup_at: string | null
  stage_changed_at: string
  created_at: string
  conversations: Conversation[]
  artist: {
    id: string
    name: string
    image_url: string | null
    spotify_url: string | null
    spotify_monthly_listeners: number
    streams_last_month: number
    estimated_offer_low: number | null
    estimated_offer_high: number | null
    email: string | null
    instagram_handle: string | null
    tags?: Array<{ id: string; name: string; color: string }>
  }
  scout: {
    id: string
    full_name: string
    email: string
    avatar_url: string | null
  }
}

const STAGES = [
  { value: 'new', label: 'New' },
  { value: 'enriched', label: 'Enriched' },
  { value: 'outreach_queued', label: 'Outreach Queued' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'replied', label: 'Replied' },
  { value: 'interested', label: 'Interested' },
  { value: 'call_scheduled', label: 'Call Scheduled' },
  { value: 'call_completed', label: 'Call Completed' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'handed_off', label: 'Handed Off' },
  { value: 'in_negotiation', label: 'In Negotiation' },
  { value: 'contract_sent', label: 'Contract Sent' },
  { value: 'closed_won', label: 'Closed Won' },
  { value: 'closed_lost', label: 'Closed Lost' },
  { value: 'nurture', label: 'Nurture' },
]

export default function DealDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [deal, setDeal] = useState<Deal | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState('')
  const [nextFollowup, setNextFollowup] = useState('')
  const [messageBody, setMessageBody] = useState('')
  const [messageChannel, setMessageChannel] = useState<'email' | 'instagram' | 'phone' | 'note'>('email')
  const [messageDirection, setMessageDirection] = useState<'outbound' | 'inbound'>('outbound')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [aiDraft, setAiDraft] = useState('')
  const [showAiDraft, setShowAiDraft] = useState(false)
  const [generatingAi, setGeneratingAi] = useState(false)
  const [editingAiDraft, setEditingAiDraft] = useState(false)
  const [showFollowupDraft, setShowFollowupDraft] = useState(false)
  const [followupDraft, setFollowupDraft] = useState({ subject: '', body: '' })
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const fetchDeal = useCallback(async () => {
    try {
      const res = await fetch(`/api/deals/${params.id}`)
      const data = await res.json()
      if (data.deal) {
        setDeal(data.deal)
        setNotes(data.deal.notes || '')
        setNextFollowup(data.deal.next_followup_at ? data.deal.next_followup_at.split('T')[0] : '')
      }
    } catch (error) {
      console.error('Error fetching deal:', error)
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    fetchDeal()
  }, [fetchDeal])

  useEffect(() => {
    // Scroll to bottom when conversations update
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [deal?.conversations])

  const handleStageChange = async (newStage: string) => {
    if (!deal) return

    try {
      const res = await fetch(`/api/deals/${deal.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      })

      if (!res.ok) throw new Error('Failed to update stage')

      fetchDeal()
    } catch (error) {
      console.error('Error updating stage:', error)
      alert('Failed to update stage')
    }
  }

  const handleSave = async () => {
    if (!deal) return

    setSaving(true)
    try {
      const updates: any = { notes }
      
      if (nextFollowup) {
        updates.next_followup_at = new Date(nextFollowup).toISOString()
      }

      const res = await fetch(`/api/deals/${deal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!res.ok) throw new Error('Failed to save')

      alert('Deal updated successfully')
      fetchDeal()
    } catch (error) {
      console.error('Error saving deal:', error)
      alert('Failed to save deal')
    } finally {
      setSaving(false)
    }
  }

  const handleSendMessage = async () => {
    if (!deal || !messageBody.trim()) return

    setSendingMessage(true)
    try {
      const res = await fetch(`/api/deals/${deal.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: messageChannel,
          direction: messageDirection,
          body: messageBody,
        }),
      })

      if (!res.ok) throw new Error('Failed to send message')

      setMessageBody('')
      fetchDeal()
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message')
    } finally {
      setSendingMessage(false)
    }
  }

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return <Mail className="h-4 w-4" />
      case 'instagram': return <Instagram className="h-4 w-4" />
      case 'phone': return <Phone className="h-4 w-4" />
      case 'note': return <StickyNote className="h-4 w-4" />
      default: return null
    }
  }

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'outbound': return <ArrowUpRight className="h-4 w-4" />
      case 'inbound': return <ArrowDownLeft className="h-4 w-4" />
      default: return null
    }
  }

  const getDaysInStage = () => {
    if (!deal) return 0
    const days = Math.floor((Date.now() - new Date(deal.stage_changed_at).getTime()) / (1000 * 60 * 60 * 24))
    return days
  }

  const getLatestInboundMessage = () => {
    if (!deal?.conversations) return null
    const inbound = deal.conversations
      .filter(c => c.direction === 'inbound')
      .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
    return inbound[0] || null
  }

  const handleGenerateAiReply = async () => {
    const latestInbound = getLatestInboundMessage()
    if (!latestInbound || !deal) return

    setGeneratingAi(true)
    try {
      const res = await fetch('/api/ai/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          replyText: latestInbound.body,
          dealId: deal.id,
          artistId: deal.artist.id,
          classification: latestInbound.ai_classification,
        }),
      })

      if (!res.ok) throw new Error('Failed to generate reply')

      const data = await res.json()
      setAiDraft(data.draft)
      setShowAiDraft(true)
      setEditingAiDraft(false)
    } catch (error) {
      console.error('Error generating AI reply:', error)
      alert('Failed to generate AI reply')
    } finally {
      setGeneratingAi(false)
    }
  }

  const handleApproveAiDraft = async () => {
    if (!aiDraft.trim()) return

    setSendingMessage(true)
    try {
      const res = await fetch(`/api/deals/${deal?.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'email',
          direction: 'outbound',
          body: aiDraft,
        }),
      })

      if (!res.ok) throw new Error('Failed to send message')

      setAiDraft('')
      setShowAiDraft(false)
      fetchDeal()
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message')
    } finally {
      setSendingMessage(false)
    }
  }

  const handleGenerateFollowup = async () => {
    if (!deal) return

    setGeneratingAi(true)
    try {
      const res = await fetch('/api/ai/generate-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id }),
      })

      if (!res.ok) throw new Error('Failed to generate followup')

      const data = await res.json()
      setFollowupDraft({ subject: data.subject, body: data.body })
      setShowFollowupDraft(true)
    } catch (error) {
      console.error('Error generating followup:', error)
      alert('Failed to generate followup')
    } finally {
      setGeneratingAi(false)
    }
  }

  const handleApproveFollowup = async () => {
    if (!followupDraft.body.trim()) return

    setSendingMessage(true)
    try {
      const res = await fetch(`/api/deals/${deal?.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'email',
          direction: 'outbound',
          subject: followupDraft.subject,
          body: followupDraft.body,
        }),
      })

      if (!res.ok) throw new Error('Failed to send message')

      setFollowupDraft({ subject: '', body: '' })
      setShowFollowupDraft(false)
      fetchDeal()
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message')
    } finally {
      setSendingMessage(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!deal) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Deal not found</h2>
          <Button onClick={() => router.push('/pipeline')}>Back to Pipeline</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/pipeline')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{deal.artist.name}</h1>
            <p className="text-muted-foreground">
              <Badge variant="outline" className="mr-2">{STAGES.find(s => s.value === deal.stage)?.label}</Badge>
              {getDaysInStage()} days in stage
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column - Conversation Thread */}
        <div className="md:col-span-2">
          <Card className="h-[calc(100vh-250px)] flex flex-col">
            <CardHeader>
              <CardTitle>Conversation</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-hidden">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                {deal.conversations && deal.conversations.length > 0 ? (
                  deal.conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={`flex ${conv.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-4 ${
                          conv.direction === 'outbound'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {getDirectionIcon(conv.direction)}
                          <Badge variant={conv.direction === 'outbound' ? 'secondary' : 'outline'} className="gap-1">
                            {getChannelIcon(conv.channel)}
                            {conv.channel}
                          </Badge>
                          {conv.ai_classification && (
                            <Badge variant="outline" className="text-xs">
                              {conv.ai_classification}
                            </Badge>
                          )}
                        </div>
                        {conv.subject && (
                          <p className="font-semibold mb-1">{conv.subject}</p>
                        )}
                        <p className="whitespace-pre-wrap">{conv.body}</p>
                        <p className="text-xs opacity-70 mt-2">
                          {new Date(conv.sent_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No messages yet. Start the conversation below.
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="border-t pt-4 space-y-3">
                <div className="flex gap-2">
                  <Select value={messageDirection} onValueChange={(v: any) => setMessageDirection(v)}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="outbound">I sent this</SelectItem>
                      <SelectItem value="inbound">They replied</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={messageChannel} onValueChange={(v: any) => setMessageChannel(v)}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="note">Note</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Type your message..."
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        handleSendMessage()
                      }
                    }}
                    rows={3}
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleSendMessage} 
                    disabled={sendingMessage || !messageBody.trim()}
                    size="icon"
                    className="h-auto"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Press Cmd/Ctrl + Enter to send
                </p>
              </div>
            </CardContent>
          </Card>

          {/* AI Draft Panel */}
          {getLatestInboundMessage() && !showAiDraft && (
            <Card className="border-primary/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">AI Assistant Ready</p>
                      {getLatestInboundMessage()?.ai_classification && (
                        <p className="text-sm text-muted-foreground">
                          Detected: <Badge variant="outline" className="ml-1">
                            {getLatestInboundMessage()?.ai_classification}
                          </Badge>
                        </p>
                      )}
                    </div>
                  </div>
                  <Button onClick={handleGenerateAiReply} disabled={generatingAi}>
                    {generatingAi ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate AI Reply
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Draft Display */}
          {showAiDraft && (
            <Card className="border-primary">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    AI Generated Reply
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAiDraft(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={aiDraft}
                  onChange={(e) => setAiDraft(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                  disabled={!editingAiDraft}
                />
                <div className="flex gap-2">
                  {!editingAiDraft ? (
                    <>
                      <Button
                        onClick={handleApproveAiDraft}
                        disabled={sendingMessage}
                        className="flex-1"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Approve & Send
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setEditingAiDraft(true)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowAiDraft(false)}
                      >
                        Dismiss
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        onClick={handleApproveAiDraft}
                        disabled={sendingMessage}
                        className="flex-1"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Send Edited Version
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setEditingAiDraft(false)}
                      >
                        Cancel Edit
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Follow-up Draft Display */}
          {showFollowupDraft && (
            <Card className="border-primary">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    AI Generated Follow-up
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFollowupDraft(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs">Subject</Label>
                  <Input
                    value={followupDraft.subject}
                    onChange={(e) => setFollowupDraft({ ...followupDraft, subject: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Body</Label>
                  <Textarea
                    value={followupDraft.body}
                    onChange={(e) => setFollowupDraft({ ...followupDraft, body: e.target.value })}
                    rows={12}
                    className="font-mono text-sm mt-1"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleApproveFollowup}
                    disabled={sendingMessage}
                    className="flex-1"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Approve & Send
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowFollowupDraft(false)}
                  >
                    Dismiss
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Sidebar - Artist Info & Deal Controls */}
        <div className="space-y-4">
          {/* Artist Info Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Artist</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/artists/${deal.artist.id}`}>
                    <Music className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                {deal.artist.image_url && (
                  <div className="relative h-16 w-16 rounded-lg overflow-hidden flex-shrink-0">
                    <Image
                      src={deal.artist.image_url}
                      alt={deal.artist.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{deal.artist.name}</h3>
                  {deal.artist.email && (
                    <p className="text-sm text-muted-foreground truncate">{deal.artist.email}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Listeners</span>
                  <span className="font-medium">{formatNumber(deal.artist.spotify_monthly_listeners)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Streams/Mo</span>
                  <span className="font-medium">{formatNumber(deal.artist.streams_last_month)}</span>
                </div>
              </div>

              {deal.artist.estimated_offer_low && deal.artist.estimated_offer_high && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Estimated Value</p>
                  <p className="font-semibold">
                    {formatCurrency(deal.artist.estimated_offer_low)} — {formatCurrency(deal.artist.estimated_offer_high)}
                  </p>
                </div>
              )}

              {deal.artist.tags && deal.artist.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {deal.artist.tags.map((tag) => (
                    <TagBadge key={tag.id} tag={tag} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deal Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Deal Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">Stage</Label>
                <Select value={deal.stage} onValueChange={handleStageChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((stage) => (
                      <SelectItem key={stage.value} value={stage.value}>
                        {stage.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Days in Stage
                </Label>
                <p className="text-2xl font-bold mt-1">{getDaysInStage()}</p>
              </div>

              <div>
                <Label className="text-xs">Next Follow-up</Label>
                <Input
                  type="date"
                  value={nextFollowup}
                  onChange={(e) => setNextFollowup(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea
                  placeholder="Deal notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="mt-1"
                />
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleGenerateFollowup}
                disabled={generatingAi}
              >
                {generatingAi ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Follow-up
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
