import { Card, CardContent } from '@/components/ui/card'
import { Users } from 'lucide-react'

export default function ScoutsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Scouts</h1>
        <p className="text-muted-foreground">
          Manage team members and performance
        </p>
      </div>

      <Card>
        <CardContent className="p-12 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">
            Scout management coming soon
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
