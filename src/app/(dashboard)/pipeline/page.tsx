'use client'

import { useState, useEffect, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Search, Filter } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

interface Deal {
  id: string
  stage: string
  estimated_deal_value: number | null
  stage_changed_at: string
  artist: {
    id: string
    name: string
    image_url: string | null
    estimated_offer_low: number | null
    estimated_offer_high: number | null
  }
  scout: {
    id: string
    full_name: string
    avatar_url: string | null
  }
}

const STAGES = [
  { id: 'new', label: 'New', color: 'bg-gray-100' },
  { id: 'contacted', label: 'Contacted', color: 'bg-blue-100' },
  { id: 'replied', label: 'Replied', color: 'bg-purple-100' },
  { id: 'interested', label: 'Interested', color: 'bg-yellow-100' },
  { id: 'call_scheduled', label: 'Call Scheduled', color: 'bg-orange-100' },
  { id: 'qualified', label: 'Qualified', color: 'bg-green-100' },
  { id: 'handed_off', label: 'Handed Off', color: 'bg-teal-100' },
  { id: 'closed_won', label: 'Won', color: 'bg-emerald-100' },
  { id: 'closed_lost', label: 'Lost', color: 'bg-red-100' },
]

export default function PipelinePage() {
  const [deals, setDeals] = useState<Record<string, Deal[]>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [scoutFilter, setScoutFilter] = useState<string | null>(null)

  const fetchDeals = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (scoutFilter) params.set('scout_id', scoutFilter)

      const res = await fetch(`/api/deals?${params}`)
      const data = await res.json()

      // Group deals by stage
      const grouped: Record<string, Deal[]> = {}
      STAGES.forEach(stage => {
        grouped[stage.id] = []
      })

      data.deals?.forEach((deal: Deal) => {
        if (grouped[deal.stage]) {
          grouped[deal.stage].push(deal)
        }
      })

      setDeals(grouped)
    } catch (error) {
      console.error('Error fetching deals:', error)
    } finally {
      setLoading(false)
    }
  }, [search, scoutFilter])

  useEffect(() => {
    fetchDeals()
  }, [fetchDeals])

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result

    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    const sourceStage = source.droppableId
    const destStage = destination.droppableId

    // Optimistically update UI
    const newDeals = { ...deals }
    const [movedDeal] = newDeals[sourceStage].splice(source.index, 1)
    movedDeal.stage = destStage
    movedDeal.stage_changed_at = new Date().toISOString()
    newDeals[destStage].splice(destination.index, 0, movedDeal)
    setDeals(newDeals)

    // Update on server
    try {
      const res = await fetch(`/api/deals/${draggableId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: destStage }),
      })

      if (!res.ok) {
        throw new Error('Failed to move deal')
      }
    } catch (error) {
      console.error('Error moving deal:', error)
      // Revert on error
      fetchDeals()
    }
  }

  const getDaysInStage = (stageChangedAt: string) => {
    const days = Math.floor((Date.now() - new Date(stageChangedAt).getTime()) / (1000 * 60 * 60 * 24))
    return days
  }

  const getColumnTotal = (stageDeals: Deal[]) => {
    return stageDeals.reduce((sum, deal) => sum + (deal.estimated_deal_value || 0), 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading pipeline...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pipeline</h1>
          <p className="text-muted-foreground">Manage your deal flow</p>
        </div>
        <Button asChild>
          <Link href="/artists">Add Artists</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by artist name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchDeals()}
                className="pl-10"
              />
            </div>
            <Button onClick={fetchDeals}>
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => (
            <div key={stage.id} className="flex-shrink-0 w-80">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      {stage.label}
                      <Badge variant="secondary" className="ml-2">
                        {deals[stage.id]?.length || 0}
                      </Badge>
                    </CardTitle>
                  </div>
                  {deals[stage.id]?.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(getColumnTotal(deals[stage.id]))}
                    </div>
                  )}
                </CardHeader>
                <Droppable droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <CardContent
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`space-y-2 min-h-[200px] ${
                        snapshot.isDraggingOver ? 'bg-accent/50' : ''
                      }`}
                    >
                      {deals[stage.id]?.map((deal, index) => (
                        <Draggable key={deal.id} draggableId={deal.id} index={index}>
                          {(provided, snapshot) => (
                            <Link href={`/pipeline/${deal.id}`}>
                              <Card
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`cursor-pointer hover:shadow-md transition-shadow ${
                                  snapshot.isDragging ? 'shadow-lg' : ''
                                }`}
                              >
                                <CardContent className="p-4">
                                  <div className="space-y-2">
                                    <div className="font-medium text-sm">
                                      {deal.artist.name}
                                    </div>
                                    {deal.artist.estimated_offer_low && deal.artist.estimated_offer_high && (
                                      <div className="text-xs text-muted-foreground">
                                        {formatCurrency(deal.artist.estimated_offer_low)} —{' '}
                                        {formatCurrency(deal.artist.estimated_offer_high)}
                                      </div>
                                    )}
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6">
                                          <AvatarImage src={deal.scout.avatar_url || undefined} />
                                          <AvatarFallback className="text-xs">
                                            {deal.scout.full_name.substring(0, 2).toUpperCase()}
                                          </AvatarFallback>
                                        </Avatar>
                                      </div>
                                      <Badge variant="outline" className="text-xs">
                                        {getDaysInStage(deal.stage_changed_at)}d
                                      </Badge>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </Link>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </CardContent>
                  )}
                </Droppable>
              </Card>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  )
}
