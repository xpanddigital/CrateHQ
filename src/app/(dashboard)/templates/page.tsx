'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { TemplateEditorModal } from '@/components/templates/TemplateEditorModal'
import { Plus, Mail, MoreVertical, Edit, Trash2, Copy, Search, TrendingUp } from 'lucide-react'
import { EmailTemplate } from '@/types/database'

const CATEGORY_LABELS: Record<string, string> = {
  initial_outreach: 'Initial Outreach',
  follow_up_1: 'Follow-Up 1',
  follow_up_2: 'Follow-Up 2',
  follow_up_3: 'Follow-Up 3',
  breakup: 'Breakup',
  re_engagement: 'Re-Engagement',
}

const CATEGORY_COLORS: Record<string, string> = {
  initial_outreach: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  follow_up_1: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  follow_up_2: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  follow_up_3: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  breakup: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  re_engagement: 'bg-green-500/10 text-green-500 border-green-500/20',
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showEditor, setShowEditor] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/templates')
      const data = await res.json()
      if (data.templates) {
        setTemplates(data.templates)
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const handleCreate = () => {
    setEditingTemplate(null)
    setShowEditor(true)
  }

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template)
    setShowEditor(true)
  }

  const handleDuplicate = async (template: EmailTemplate) => {
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${template.name} (Copy)`,
          category: template.category,
          sequence_position: template.sequence_position,
          subject: template.subject,
          body: template.body,
        }),
      })

      if (!res.ok) throw new Error('Failed to duplicate template')

      fetchTemplates()
    } catch (error) {
      console.error('Error duplicating template:', error)
      alert('Failed to duplicate template')
    }
  }

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    setDeleting(templateId)
    try {
      const res = await fetch(`/api/templates/${templateId}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to delete template')

      fetchTemplates()
    } catch (error) {
      console.error('Error deleting template:', error)
      alert('Failed to delete template')
    } finally {
      setDeleting(null)
    }
  }

  const handleToggleActive = async (template: EmailTemplate) => {
    try {
      const res = await fetch(`/api/templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_active: !template.is_active,
        }),
      })

      if (!res.ok) throw new Error('Failed to update template')

      fetchTemplates()
    } catch (error) {
      console.error('Error updating template:', error)
      alert('Failed to update template')
    }
  }

  const filteredTemplates = templates.filter((template) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      template.name.toLowerCase().includes(searchLower) ||
      template.category.toLowerCase().includes(searchLower) ||
      template.subject.toLowerCase().includes(searchLower)
    )
  })

  const calculateReplyRate = (template: EmailTemplate) => {
    if (template.times_sent === 0) return 0
    return ((template.times_replied / template.times_sent) * 100).toFixed(1)
  }

  if (loading && templates.length === 0) {
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
          <h1 className="text-3xl font-bold">Email Templates</h1>
          <p className="text-muted-foreground">
            Create and manage email templates for outreach campaigns
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      <TemplateEditorModal
        open={showEditor}
        onOpenChange={setShowEditor}
        template={editingTemplate}
        onSave={fetchTemplates}
      />

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      {filteredTemplates.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No templates yet"
          description="Create your first email template to get started with automated outreach"
          action={{
            label: 'Create Template',
            onClick: handleCreate,
          }}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Subject Preview</TableHead>
                <TableHead className="text-center">Seq.</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Replied</TableHead>
                <TableHead className="text-right">Reply Rate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell>
                    <div className="font-medium">{template.name}</div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={CATEGORY_COLORS[template.category] || ''}
                    >
                      {CATEGORY_LABELS[template.category] || template.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-muted-foreground truncate max-w-[300px]">
                      {template.subject}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {template.sequence_position ? (
                      <Badge variant="outline">{template.sequence_position}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {template.times_sent.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {template.times_replied.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {template.times_sent > 0 && (
                        <>
                          <TrendingUp className="h-3 w-3 text-green-500" />
                          <span className="font-medium text-green-500">
                            {calculateReplyRate(template)}%
                          </span>
                        </>
                      )}
                      {template.times_sent === 0 && (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={template.is_active ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => handleToggleActive(template)}
                    >
                      {template.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deleting === template.id}
                        >
                          {deleting === template.id ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <MoreVertical className="h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(template)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(template.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {templates.length > 0 && (
        <Card className="p-4">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{templates.length}</p>
              <p className="text-sm text-muted-foreground">Total Templates</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {templates.filter((t) => t.is_active).length}
              </p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {templates.reduce((sum, t) => sum + t.times_sent, 0).toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">Total Sent</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {templates.reduce((sum, t) => sum + t.times_replied, 0).toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">Total Replies</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
