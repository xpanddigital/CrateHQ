'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ConversationThread } from '@/components/pipeline/ConversationThread'
import { Conversation, Deal } from '@/types/database'
import { formatRelativeTime } from '@/lib/utils'
import { ChevronDown, ChevronUp, Send, Edit3, X, Sparkles } from 'lucide-react'

interface InboxItemProps {
  conversation: Conversation
  deal: Deal
  onUpdate: () => void
}

export function InboxItem({ conversation, deal, onUpdate }: InboxItemProps) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftText, setDraftText] = useState(conversation.ai_suggested_reply || '')
  const [sending, setSending] = useState(false)

  const getClassificationColor = (classification: string | null) => {
    switch (classification) {
      case 'interested':
        return 'bg-green-500/10 text-green-500 border-green-500'
      case 'question':
        return 'bg-blue-500/10 text-blue-500 border-blue-500'
      case 'objection':
        return 'bg-orange-500/10 text-orange-500 border-orange-500'
      case 'not_interested':
        return 'bg-red-500/10 text-red-500 border-red-500'
      case 'warm_no':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const handleApprove = async () => {
    setSending(true)
    try {
      // Send the AI-generated reply as an outbound message
      const res = await fetch(`/api/deals/${deal.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: conversation.channel,
          direction: 'outbound',
          subject: conversation.subject ? `Re: ${conversation.subject}` : null,
          body: draftText,
        }),
      })

      if (!res.ok) throw new Error('Failed to send message')

      // Mark original as read
      await markAsRead()
      onUpdate()
    } catch (error) {
      console.error('Error sending reply:', error)
    } finally {
      setSending(false)
    }
  }

  const handleDismiss = async () => {
    await markAsRead()
    onUpdate()
  }

  const markAsRead = async () => {
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient()
      await supabase
        .from('conversations')
        .update({ is_read: true, requires_human_review: false })
        .eq('id', conversation.id)
    } catch (error) {
      console.error('Error marking as read:', error)
    }
  }

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="p-4">
        <div
          className="flex items-start justify-between cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <p className="font-semibold">{deal.artist?.name || 'Unknown Artist'}</p>
              {conversation.ai_classification && (
                <Badge
                  variant="outline"
                  className={getClassificationColor(conversation.ai_classification)}
                >
                  {conversation.ai_classification}
                </Badge>
              )}
              {conversation.ai_confidence && (
                <span className="text-xs text-muted-foreground">
                  {(conversation.ai_confidence * 100).toFixed(0)}% confident
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {conversation.body}
            </p>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <span>{formatRelativeTime(conversation.sent_at)}</span>
              <span>•</span>
              <span className="capitalize">{conversation.channel}</span>
            </div>
          </div>
          <Button variant="ghost" size="sm">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t space-y-4">
            {/* Show conversation history */}
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Conversation History</h4>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {deal.conversations
                  ?.filter(c => c.id !== conversation.id)
                  .slice(-3)
                  .map(c => (
                    <div key={c.id} className="text-sm p-2 rounded bg-muted/50">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {c.direction}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(c.sent_at)}
                        </span>
                      </div>
                      <p className="text-muted-foreground">{c.body.slice(0, 200)}</p>
                    </div>
                  ))}
              </div>
            </div>

            {/* AI Draft */}
            {conversation.ai_suggested_reply && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold text-sm">AI-Generated Draft</h4>
                </div>

                {!editing ? (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                    <p className="text-sm whitespace-pre-wrap">{draftText}</p>
                  </div>
                ) : (
                  <Textarea
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    rows={6}
                    className="font-mono text-sm"
                  />
                )}

                <div className="flex gap-2">
                  {!editing ? (
                    <>
                      <Button
                        size="sm"
                        onClick={handleApprove}
                        disabled={sending}
                        className="flex-1"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {sending ? 'Sending...' : 'Approve & Send'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(true)}
                      >
                        <Edit3 className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDismiss}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Dismiss
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        onClick={() => {
                          setEditing(false)
                          handleApprove()
                        }}
                        disabled={sending}
                        className="flex-1"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Send Edited
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(false)
                          setDraftText(conversation.ai_suggested_reply || '')
                        }}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}

            {!conversation.ai_suggested_reply && (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  No AI draft available. Add a manual reply on the deal page.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={handleDismiss}
                >
                  Dismiss
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
