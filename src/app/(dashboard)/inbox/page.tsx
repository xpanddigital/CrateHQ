'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { InboxItem } from '@/components/inbox/InboxList'
import { Inbox as InboxIcon } from 'lucide-react'
import { Conversation, Deal } from '@/types/database'

interface InboxItemData {
  conversation: Conversation
  deal: Deal
}

export default function InboxPage() {
  const [items, setItems] = useState<InboxItemData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchInbox()
  }, [])

  const fetchInbox = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/inbox')
      const data = await res.json()
      if (data.items) {
        // Sort by priority: interested > question > objection > unclear
        const sorted = data.items.sort((a: InboxItemData, b: InboxItemData) => {
          const priority: Record<string, number> = {
            interested: 1,
            question: 2,
            objection: 3,
            warm_no: 4,
            unclear: 5,
            not_interested: 6,
          }
          const aPriority = priority[a.conversation.ai_classification || 'unclear'] || 99
          const bPriority = priority[b.conversation.ai_classification || 'unclear'] || 99
          return aPriority - bPriority
        })
        setItems(sorted)
      }
    } catch (error) {
      console.error('Error fetching inbox:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
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
          <h1 className="text-3xl font-bold">Inbox</h1>
          <p className="text-muted-foreground">
            Review replies and AI-generated responses
          </p>
        </div>
        {items.length > 0 && (
          <Badge variant="secondary" className="text-lg px-4 py-2">
            {items.length} unread
          </Badge>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title="Inbox is empty"
          description="No replies need your attention right now. Great work!"
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <InboxItem
              key={item.conversation.id}
              conversation={item.conversation}
              deal={item.deal}
              onUpdate={fetchInbox}
            />
          ))}
        </div>
      )}
    </div>
  )
}

