'use client'

import { useState, useEffect } from 'react'
import { DragDropContext, Draggable, DropResult } from '@hello-pangea/dnd'
import { StageColumn } from './StageColumn'
import { DealCard } from './DealCard'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Deal, DealStage } from '@/types/database'

// Simplified stages for Kanban view
const KANBAN_STAGES = [
  { value: 'new' as DealStage, label: 'New', color: '#6B7280' },
  { value: 'contacted' as DealStage, label: 'Contacted', color: '#2563EB' },
  { value: 'replied' as DealStage, label: 'Replied', color: '#F59E0B' },
  { value: 'interested' as DealStage, label: 'Interested', color: '#D97706' },
  { value: 'call_scheduled' as DealStage, label: 'Call Scheduled', color: '#10B981' },
  { value: 'qualified' as DealStage, label: 'Qualified', color: '#047857' },
  { value: 'handed_off' as DealStage, label: 'Handed Off', color: '#6366F1' },
  { value: 'closed_won' as DealStage, label: 'Won', color: '#22C55E' },
]

export function KanbanBoard() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDeals()
  }, [])

  const fetchDeals = async () => {
    try {
      const res = await fetch('/api/deals')
      const data = await res.json()
      if (data.deals) {
        setDeals(data.deals)
      }
    } catch (error) {
      console.error('Error fetching deals:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result

    if (!destination) return
    if (destination.droppableId === source.droppableId) return

    const dealId = draggableId
    const newStage = destination.droppableId as DealStage

    // Optimistic update
    setDeals(prevDeals =>
      prevDeals.map(deal =>
        deal.id === dealId
          ? { ...deal, stage: newStage, stage_changed_at: new Date().toISOString() }
          : deal
      )
    )

    // Update on server
    try {
      const res = await fetch(`/api/deals/${dealId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      })

      if (!res.ok) throw new Error('Failed to move deal')
    } catch (error) {
      console.error('Error moving deal:', error)
      // Revert on error
      fetchDeals()
    }
  }

  const getDealsByStage = (stage: DealStage) => {
    return deals.filter(deal => deal.stage === stage)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_STAGES.map((stage) => {
          const stageDeals = getDealsByStage(stage.value)
          return (
            <StageColumn
              key={stage.value}
              stage={stage.value}
              label={stage.label}
              color={stage.color}
              deals={stageDeals}
            >
              {stageDeals.map((deal, index) => (
                <Draggable key={deal.id} draggableId={deal.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={snapshot.isDragging ? 'opacity-50' : ''}
                    >
                      <DealCard deal={deal} />
                    </div>
                  )}
                </Draggable>
              ))}
            </StageColumn>
          )
        })}
      </div>
    </DragDropContext>
  )
}
