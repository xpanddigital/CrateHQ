'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Download } from 'lucide-react'

export default function AdminLibraryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Content Library</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Export all content for manual use. No Go High Level required.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Download all content (CSV)</CardTitle>
          <p className="text-xs text-muted-foreground">
            One CSV with every content post: Date, Time, Account, Post Type, Title, Category,
            Caption, Nano Banana Prompt, Slide Count, Image URL, Status, and more. Use it to
            upload elsewhere or post manually.
          </p>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => window.open('/api/admin/export-all-content', '_blank')}
          >
            <Download className="h-4 w-4 mr-2" />
            Download all content
          </Button>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        You can also use &quot;Export CSV&quot; on the Content Calendar for a date range, or
        &quot;Download all content&quot; on the Publish page.
      </p>
    </div>
  )
}
