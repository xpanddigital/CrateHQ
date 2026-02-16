'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Conversation } from '@/types/database'
import { formatRelativeTime } from '@/lib/utils'
import { Mail, Instagram, Phone, FileText, ArrowUp, ArrowDown, MessageSquare } from 'lucide-react'

interface ConversationThreadProps {
  dealId: string
  conversations: Conversation[]
  onMessageAdded: () => void
}

export function ConversationThread({
  dealId,
  conversations,
  onMessageAdded,
}: ConversationThreadProps) {
  const [showForm, setShowForm] = useState(false)
  const [channel, setChannel] = useState<string>('note')
  const [direction, setDirection] = useState<string>('internal')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)

    try {
      const res = await fetch(`/api/deals/${dealId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          direction,
          subject: subject || null,
          body,
        }),
      })

      if (!res.ok) throw new Error('Failed to add message')

      // Reset form
      setSubject('')
      setBody('')
      setShowForm(false)
      onMessageAdded()
    } catch (error) {
      console.error('Error adding message:', error)
    } finally {
      setSending(false)
    }
  }

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return <Mail className="h-4 w-4" />
      case 'instagram':
        return <Instagram className="h-4 w-4" />
      case 'phone':
        return <Phone className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'outbound':
        return <ArrowUp className="h-3 w-3" />
      case 'inbound':
        return <ArrowDown className="h-3 w-3" />
      default:
        return <MessageSquare className="h-3 w-3" />
    }
  }

  const getDirectionColor = (direction: string) => {
    switch (direction) {
      case 'outbound':
        return 'text-blue-500'
      case 'inbound':
        return 'text-green-500'
      default:
        return 'text-muted-foreground'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Conversation</h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add Note'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <Select value={channel} onValueChange={setChannel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="note">Note</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Direction</Label>
                  <Select value={direction} onValueChange={setDirection}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Internal</SelectItem>
                      <SelectItem value="outbound">Outbound</SelectItem>
                      <SelectItem value="inbound">Inbound</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {channel === 'email' && (
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Email subject..."
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  placeholder="Type your message..."
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={sending}>
                  {sending ? 'Adding...' : 'Add Message'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {conversations.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No messages yet. Add a note to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          conversations.map((conversation) => (
            <Card
              key={conversation.id}
              className={
                conversation.direction === 'inbound'
                  ? 'border-green-500/30 bg-green-500/5'
                  : conversation.direction === 'outbound'
                  ? 'border-blue-500/30 bg-blue-500/5'
                  : ''
              }
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1">
                      {getChannelIcon(conversation.channel)}
                      <span className="capitalize">{conversation.channel}</span>
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`gap-1 ${getDirectionColor(conversation.direction)}`}
                    >
                      {getDirectionIcon(conversation.direction)}
                      <span className="capitalize">{conversation.direction}</span>
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(conversation.sent_at)}
                  </span>
                </div>

                {conversation.subject && (
                  <p className="font-semibold text-sm mb-2">
                    {conversation.subject}
                  </p>
                )}

                <p className="text-sm whitespace-pre-wrap">{conversation.body}</p>

                {conversation.ai_classification && (
                  <div className="mt-3 pt-3 border-t">
                    <Badge variant="secondary" className="text-xs">
                      AI: {conversation.ai_classification}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
