import { KanbanBoard } from '@/components/pipeline/KanbanBoard'

export default function PipelinePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pipeline</h1>
        <p className="text-muted-foreground">
          Manage deals through your sales pipeline
        </p>
      </div>

      <KanbanBoard />
    </div>
  )
}
