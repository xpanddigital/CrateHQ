import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const identityId = request.nextUrl.searchParams.get('identity_id')
    if (!identityId) {
      return NextResponse.json({ error: 'Missing identity_id' }, { status: 400 })
    }

    const { data: posts, error } = await supabase
      .from('content_posts')
      .select('id, nano_prompt, alt_prompts, image_url')
      .eq('identity_id', identityId)
      .eq('post_type', 'single')
      .is('image_url', null)

    if (error) {
      logger.error('[Admin/StudioSinglePosts] Query error:', error)
      return NextResponse.json({ error: 'Failed to load posts' }, { status: 500 })
    }

    return NextResponse.json({ posts: posts || [] })
  } catch (e: any) {
    logger.error('[Admin/StudioSinglePosts] Error:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}

