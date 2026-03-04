import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function escapeCsvField(value: any): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Export all content_posts as CSV (no date filter).
 * Use for manual upload elsewhere; does not depend on GHL.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return new NextResponse('Admin only', { status: 403 })
    }

    const params = request.nextUrl.searchParams
    const accountId = params.get('account_id') || null

    let postsQuery = supabase
      .from('content_posts')
      .select(
        'id, ig_account_id, identity_id, post_type, status, title, category, caption, nano_prompt, slides, slide_image_urls, image_url, scheduled_date, scheduled_time, ghl_post_id, created_at'
      )
      .order('created_at', { ascending: false })

    if (accountId && accountId !== 'all') {
      postsQuery = postsQuery.eq('ig_account_id', accountId)
    }

    const { data: posts, error: postsError } = await postsQuery

    if (postsError) {
      console.error('[ExportAllContent] Posts error:', postsError)
      return new NextResponse('Failed to load posts', { status: 500 })
    }

    const identityIds = Array.from(
      new Set((posts || []).map((p: any) => p.identity_id).filter(Boolean))
    )

    let identitiesMap: Record<string, { display_name: string }> = {}

    if (identityIds.length > 0) {
      const { data: identities, error: idError } = await supabase
        .from('account_identities')
        .select('id, display_name')
        .in('id', identityIds)

      if (!idError && identities) {
        for (const row of identities) {
          identitiesMap[row.id] = { display_name: row.display_name }
        }
      }
    }

    const header = [
      'Date',
      'Day',
      'Time',
      'Account',
      'Post Type',
      'Title',
      'Category',
      'Caption',
      'Nano Banana Prompt',
      'Slide Count',
      'Image URL',
      'Status',
      'GHL Post ID',
      'Created At',
    ]

    const rows: string[] = [header.join(',')]

    for (const p of posts || []) {
      const dateStr = p.scheduled_date ?? ''
      const day = dateStr ? new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' }) : ''
      const timeStr = p.scheduled_time ?? ''
      const idMeta = identitiesMap[p.identity_id] || { display_name: p.ig_account_id || '' }
      const accountName = idMeta.display_name
      const slideCount =
        p.post_type === 'carousel' && Array.isArray(p.slides) ? p.slides.length : ''
      const imageUrl = p.image_url ?? ''

      const row = [
        escapeCsvField(dateStr),
        escapeCsvField(day),
        escapeCsvField(timeStr),
        escapeCsvField(accountName),
        escapeCsvField(p.post_type),
        escapeCsvField(p.title),
        escapeCsvField(p.category),
        escapeCsvField(p.caption),
        escapeCsvField(p.nano_prompt),
        escapeCsvField(slideCount),
        escapeCsvField(imageUrl),
        escapeCsvField(p.status),
        escapeCsvField(p.ghl_post_id),
        escapeCsvField(p.created_at),
      ]

      rows.push(row.join(','))
    }

    const csv = rows.join('\n')
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="flank-content-all.csv"',
      },
    })
  } catch (e: any) {
    console.error('[ExportAllContent] Error:', e)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
