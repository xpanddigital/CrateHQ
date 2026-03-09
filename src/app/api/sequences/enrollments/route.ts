import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

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

/**
 * GET /api/sequences/enrollments — List enrollments with filters
 * Query: ?status=active&ig_account_id=xxx&template_id=xxx
 */
export async function GET(request: NextRequest) {
  const { supabase, error } = await requireAdmin()
  if (error) return error

  try {
    const { searchParams } = request.nextUrl
    const status = searchParams.get('status')
    const igAccountId = searchParams.get('ig_account_id')
    const templateId = searchParams.get('template_id')

    let query = supabase
      .from('sequence_enrollments')
      .select(`
        *,
        artist:artists(id, name, instagram_handle, image_url),
        template:sequence_templates(id, name)
      `)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }
    if (igAccountId) {
      query = query.eq('ig_account_id', igAccountId)
    }
    if (templateId) {
      query = query.eq('template_id', templateId)
    }

    const { data: enrollments, error: fetchError } = await query

    if (fetchError) {
      logger.error('[Sequences/Enrollments] List error:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch enrollments' }, { status: 500 })
    }

    return NextResponse.json({ enrollments: enrollments || [] })
  } catch (err) {
    logger.error('[Sequences/Enrollments] GET unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
