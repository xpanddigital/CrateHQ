import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import type { SequenceActionType } from '@/types/database'

const VALID_ACTION_TYPES: SequenceActionType[] = [
  'visit_profile', 'follow', 'like_posts', 'watch_stories',
  'like_reel', 'comment', 'send_dm',
]

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { supabase: null as any, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') {
    return { supabase: null as any, error: NextResponse.json({ error: 'Admin only' }, { status: 403 }) }
  }
  return { supabase, error: null }
}

function validateSteps(steps: any[]): string | null {
  if (!Array.isArray(steps) || steps.length === 0) {
    return 'steps must be a non-empty array'
  }
  let prevDayOffset = -1
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    if (typeof step.step_number !== 'number' || step.step_number !== i + 1) {
      return `step_number must be sequential starting at 1 (got ${step.step_number} at index ${i})`
    }
    if (typeof step.day_offset !== 'number' || step.day_offset < 0) {
      return `day_offset must be a non-negative number at step ${step.step_number}`
    }
    if (step.day_offset < prevDayOffset) {
      return `day_offset must be non-decreasing at step ${step.step_number}`
    }
    prevDayOffset = step.day_offset
    if (!Array.isArray(step.actions) || step.actions.length === 0) {
      return `actions must be a non-empty array at step ${step.step_number}`
    }
    for (const action of step.actions) {
      if (!VALID_ACTION_TYPES.includes(action.type)) {
        return `Invalid action type "${action.type}" at step ${step.step_number}`
      }
    }
    if (typeof step.label !== 'string' || !step.label.trim()) {
      return `label is required at step ${step.step_number}`
    }
  }
  return null
}

// GET — Fetch single template
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { supabase, error } = await requireAdmin()
  if (error) return error

  try {
    const { data: template, error: fetchError } = await supabase
      .from('sequence_templates')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({ template })
  } catch (err) {
    logger.error('[Sequences/Templates] GET [id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH — Update template
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { supabase, error } = await requireAdmin()
  if (error) return error

  try {
    const body = await request.json()
    const { name, description, steps, is_active } = body

    // If modifying steps, check no active enrollments reference this template
    if (steps !== undefined) {
      const { count, error: countError } = await supabase
        .from('sequence_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('template_id', id)
        .in('status', ['active', 'paused'])

      if (countError) {
        logger.error('[Sequences/Templates] Enrollment count error:', countError)
        return NextResponse.json({ error: 'Failed to check active enrollments' }, { status: 500 })
      }

      if ((count ?? 0) > 0) {
        return NextResponse.json(
          { error: `Cannot modify steps while ${count} active enrollment(s) reference this template. Pause or cancel them first.` },
          { status: 409 }
        )
      }

      const stepError = validateSteps(steps)
      if (stepError) {
        return NextResponse.json({ error: stepError }, { status: 400 })
      }
    }

    const updateData: any = { updated_at: new Date().toISOString() }
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (steps !== undefined) updateData.steps = steps
    if (is_active !== undefined) updateData.is_active = is_active

    const { data: template, error: updateError } = await supabase
      .from('sequence_templates')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (updateError) {
      logger.error('[Sequences/Templates] Update error:', updateError)
      return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
    }

    return NextResponse.json({ template })
  } catch (err) {
    logger.error('[Sequences/Templates] PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE — Soft-delete (set is_active = false)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { supabase, error } = await requireAdmin()
  if (error) return error

  try {
    const { data: template, error: updateError } = await supabase
      .from('sequence_templates')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
      .single()

    if (updateError) {
      logger.error('[Sequences/Templates] Delete error:', updateError)
      return NextResponse.json({ error: 'Failed to deactivate template' }, { status: 500 })
    }

    return NextResponse.json({ deactivated: true, id: template.id })
  } catch (err) {
    logger.error('[Sequences/Templates] DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
