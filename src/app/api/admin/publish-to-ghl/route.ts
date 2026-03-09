import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireGHLClient, type GHLClient } from '@/lib/ghl/client'
import { logger } from '@/lib/logger'

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { supabase, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') {
    return { supabase, error: NextResponse.json({ error: 'Admin only' }, { status: 403 }) }
  }
  return { supabase, error: null }
}

function combineScheduledDateTime(date: string | null, time: string | null): string | null {
  if (!date) return null
  const t = time && time.length >= 5 ? time : '12:00:00'
  const iso = new Date(`${date}T${t}Z`).toISOString()
  return iso
}

async function uploadMediaToGhl(
  imageUrl: string,
  client: GHLClient
): Promise<string> {
  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) {
    throw new Error(`Failed to download image from ${imageUrl}`)
  }
  const blob = await imgRes.blob()

  const form = new FormData()
  form.append('file', blob, 'flank-content.png')

  const res = await fetch(`${client.baseUrl}/medias/upload-file`, {
    method: 'POST',
    headers: {
      Authorization: client.authHeader,
      Version: client.versionHeader,
    },
    body: form,
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = (json && (json.message || json.error)) || 'GHL media upload failed'
    throw new Error(msg)
  }

  // Try a few common shapes; adjust as needed based on actual API response.
  const url =
    json.fileUrl ||
    json.url ||
    (Array.isArray(json.data) && json.data[0]?.url) ||
    json.data?.url

  if (!url || typeof url !== 'string') {
    throw new Error('GHL media upload response missing URL')
  }

  return url
}

export async function POST(request: NextRequest) {
  const { supabase, error } = await requireAdmin()
  if (error) return error

  try {
    const body = await request.json()
    const { postId } = body || {}
    if (!postId) {
      return NextResponse.json({ error: 'Missing postId' }, { status: 400 })
    }

    const { data: post, error: postError } = await supabase
      .from('content_posts')
      .select(
        'id, ig_account_id, identity_id, post_type, status, title, category, caption, hashtags, nano_prompt, slides, slide_image_urls, image_url, scheduled_date, scheduled_time, ghl_post_id'
      )
      .eq('id', postId)
      .single()

    if (postError || !post) {
      logger.error('[PublishToGHL] Post load error:', postError)
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    let ghl: GHLClient
    try {
      ghl = await requireGHLClient(supabase, post.ig_account_id)
    } catch (e: any) {
      return NextResponse.json(
        { error: e.message || 'GHL not configured for this account' },
        { status: 400 }
      )
    }

    const { config } = ghl

    const scheduledAt = combineScheduledDateTime(post.scheduled_date, post.scheduled_time)
    if (!scheduledAt) {
      return NextResponse.json({ error: 'Post is missing scheduled date/time' }, { status: 400 })
    }

    // Build caption + hashtags
    const hashtags: string[] = (post.hashtags || []).map((h: string) =>
      h?.startsWith('#') ? h : `#${h}`
    )
    const summary = [post.caption, hashtags.join(' ')].filter(Boolean).join('\n\n')

    const mediaUrls: string[] = []

    if (post.post_type === 'single') {
      if (!post.image_url) {
        return NextResponse.json({ error: 'Single-image post has no image_url' }, { status: 400 })
      }
      const mediaUrl = await uploadMediaToGhl(post.image_url, ghl)
      mediaUrls.push(mediaUrl)
    } else if (post.post_type === 'carousel') {
      const slides: string[] = post.slide_image_urls || []
      if (!slides.length) {
        return NextResponse.json(
          { error: 'Carousel post has no slide_image_urls' },
          { status: 400 }
        )
      }
      for (const url of slides) {
        const mediaUrl = await uploadMediaToGhl(url, ghl)
        mediaUrls.push(mediaUrl)
      }
    } else {
      return NextResponse.json({ error: 'Unsupported post_type' }, { status: 400 })
    }

    // Mark as publishing
    await supabase
      .from('content_posts')
      .update({ status: 'publishing' })
      .eq('id', post.id)

    const payload = {
      locationId: config.locationId,
      accountIds: [config.socialAccountId],
      post: summary,
      mediaUrls,
      scheduledAt,
      type: 'post',
    }

    const postRes = await fetch(
      `${ghl.baseUrl}/social-media-posting/oauth/facebook/${config.locationId}/post`,
      {
        method: 'POST',
        headers: {
          Authorization: ghl.authHeader,
          Version: ghl.versionHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    )

    const postJson = await postRes.json().catch(() => ({}))
    if (!postRes.ok) {
      const msg =
        (postJson && (postJson.message || postJson.error)) || 'GHL create post failed'
      logger.error('[PublishToGHL] Create post error:', msg, postJson)
      await supabase
        .from('content_posts')
        .update({ status: 'failed' })
        .eq('id', post.id)
      return NextResponse.json({ error: msg, details: postJson }, { status: 500 })
    }

    const ghlId =
      postJson.id ||
      postJson.postId ||
      postJson.data?.id ||
      postJson.data?.postId ||
      null

    const now = new Date()
    const isFuture = new Date(scheduledAt) > now
    const finalStatus = isFuture ? 'queued' : 'published'

    await supabase
      .from('content_posts')
      .update({
        ghl_post_id: ghlId,
        status: finalStatus,
      })
      .eq('id', post.id)

    return NextResponse.json({
      success: true,
      ghl_post_id: ghlId,
      status: finalStatus,
      raw: postJson,
    })
  } catch (e: any) {
    logger.error('[PublishToGHL] Unhandled error:', e)
    return NextResponse.json(
      { error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

