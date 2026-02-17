'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Save, Eye, Code } from 'lucide-react'
import { EmailTemplate } from '@/types/database'
import { TEMPLATE_VARIABLES, replaceVariables } from '@/lib/templates/variables'

interface TemplateEditorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template?: EmailTemplate | null
  onSave: () => void
}

const CATEGORIES = [
  { value: 'initial_outreach', label: 'Initial Outreach' },
  { value: 'follow_up_1', label: 'Follow-Up 1' },
  { value: 'follow_up_2', label: 'Follow-Up 2' },
  { value: 'follow_up_3', label: 'Follow-Up 3' },
  { value: 'breakup', label: 'Breakup' },
  { value: 're_engagement', label: 'Re-Engagement' },
]

export function TemplateEditorModal({
  open,
  onOpenChange,
  template,
  onSave,
}: TemplateEditorModalProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('initial_outreach')
  const [sequencePosition, setSequencePosition] = useState<string>('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [showPreview, setShowPreview] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (template) {
      setName(template.name)
      setCategory(template.category)
      setSequencePosition(template.sequence_position?.toString() || '')
      setSubject(template.subject)
      setBody(template.body)
    } else {
      setName('')
      setCategory('initial_outreach')
      setSequencePosition('')
      setSubject('')
      setBody('')
    }
  }, [template, open])

  const handleSave = async () => {
    setSaving(true)
    try {
      const url = template ? `/api/templates/${template.id}` : '/api/templates'
      const method = template ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category,
          sequence_position: sequencePosition ? parseInt(sequencePosition) : null,
          subject,
          body,
        }),
      })

      if (!res.ok) throw new Error('Failed to save template')

      onSave()
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving template:', error)
      alert('Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  const insertVariable = (variable: string) => {
    const textarea = document.querySelector('textarea[name="body"]') as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = body
    const before = text.substring(0, start)
    const after = text.substring(end)
    const newText = before + `{{${variable}}}` + after

    setBody(newText)

    // Set cursor position after inserted variable
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + variable.length + 4, start + variable.length + 4)
    }, 0)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? 'Edit Template' : 'Create Template'}
          </DialogTitle>
          <DialogDescription>
            Create email templates with dynamic variables for personalized outreach
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          {/* Left Column - Editor */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Initial Outreach - Catalog Financing"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sequence">Sequence Position</Label>
                <Input
                  id="sequence"
                  type="number"
                  value={sequencePosition}
                  onChange={(e) => setSequencePosition(e.target.value)}
                  placeholder="1, 2, 3..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Use {{variables}} for personalization"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="body">Email Body</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? (
                    <>
                      <Code className="h-4 w-4 mr-1" />
                      Edit
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-1" />
                      Preview
                    </>
                  )}
                </Button>
              </div>
              <Textarea
                id="body"
                name="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your email template here. Use {{variable_name}} for dynamic content."
                rows={12}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label>Available Variables</Label>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_VARIABLES.map((variable) => (
                  <Badge
                    key={variable.key}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                    onClick={() => insertVariable(variable.key)}
                    title={variable.description}
                  >
                    {variable.label}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Click a variable to insert it at cursor position
              </p>
            </div>
          </div>

          {/* Right Column - Preview */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Live Preview</Label>
              <Card className="p-4 space-y-4 bg-muted/30">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Subject:</p>
                  <p className="font-semibold">
                    {subject ? replaceVariables(subject) : 'No subject yet'}
                  </p>
                </div>
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground mb-2">Body:</p>
                  <div className="whitespace-pre-wrap text-sm">
                    {body ? replaceVariables(body) : 'No body yet'}
                  </div>
                </div>
              </Card>
            </div>

            <div className="space-y-2">
              <Label>Variable Reference</Label>
              <Card className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
                {TEMPLATE_VARIABLES.map((variable) => (
                  <div key={variable.key} className="text-sm">
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                      {`{{${variable.key}}}`}
                    </code>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {variable.description}
                    </p>
                    <p className="text-xs mt-0.5">
                      Example: <span className="font-medium">{variable.example}</span>
                    </p>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !name || !subject || !body}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
