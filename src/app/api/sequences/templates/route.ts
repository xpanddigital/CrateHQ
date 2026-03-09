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
  return { supabase, user, error: null }
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
      return `day_offset must be non-decreasing (step ${step.step_number} has ${step.day_offset}, previous was ${prevDayOffset})`
    }
    prevDayOffset = step.day_offset

    if (!Array.isArray(step.actions) || step.actions.length === 0) {
      return `actions must be a non-empty array at step ${step.step_number}`
    }
    for (const action of step.actions) {
      if (!VALID_ACTION_TYPES.includes(action.type)) {
        return `Invalid action type "${action.type}" at step ${step.step_number}. Valid types: ${VALID_ACTION_TYPES.join(', ')}`
      }
    }
    if (typeof step.label !== 'string' || !step.label.trim()) {
      return `label is required at step ${step.step_number}`
    }
  }
  return null
}

// GET — List all sequence templates
export async function GET() {
  const { supabase, error } = await requireAdmin()
  if (error) return error

  try {
    const { data: templates, error: fetchError } = await supabase
      .from('sequence_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (fetchError) {
      logger.error('[Sequences/Templates] List error:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
    }

    return NextResponse.json({ templates: templates || [] })
  } catch (err) {
    logger.error('[Sequences/Templates] GET unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST — Create a new sequence template
export async function POST(request: NextRequest) {
  const { supabase, user, error } = await requireAdmin()
  if (error) return error

  try {
    const body = await request.json()
    const { name, description, steps } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const stepError = validateSteps(steps)
    if (stepError) {
      return NextResponse.json({ error: stepError }, { status: 400 })
    }

    const { data: template, error: insertError } = await supabase
      .from('sequence_templates')
      .insert({
        name: name.trim(),
        description: description || null,
        steps,
        created_by: user!.id,
      })
      .select('*')
      .single()

    if (insertError) {
      logger.error('[Sequences/Templates] Create error:', insertError)
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
    }

    return NextResponse.json({ template }, { status: 201 })
  } catch (err) {
    logger.error('[Sequences/Templates] POST unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
