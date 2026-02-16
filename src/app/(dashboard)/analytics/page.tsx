import { Card, CardContent } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">
          Track performance metrics and insights
        </p>
      </div>

      <Card>
        <CardContent className="p-12 text-center">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">
            Analytics coming soon
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
