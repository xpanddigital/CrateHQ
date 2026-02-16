import { Droppable } from '@hello-pangea/dnd'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Deal } from '@/types/database'

interface StageColumnProps {
  stage: string
  label: string
  color: string
  deals: Deal[]
  children: React.ReactNode
}

export function StageColumn({ stage, label, color, deals, children }: StageColumnProps) {
  return (
    <div className="flex-shrink-0 w-80">
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              {label}
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {deals.length}
            </Badge>
          </div>
        </CardHeader>
        <Droppable droppableId={stage}>
          {(provided, snapshot) => (
            <CardContent
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`flex-1 space-y-2 min-h-[200px] ${
                snapshot.isDraggingOver ? 'bg-accent/50' : ''
              }`}
            >
              {children}
              {provided.placeholder}
            </CardContent>
          )}
        </Droppable>
      </Card>
    </div>
  )
}
