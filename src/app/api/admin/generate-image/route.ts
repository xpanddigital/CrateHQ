import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { recordAiUsage } from '@/lib/ai/usage'
import { checkRateLimit, rateLimitKey, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const IMAGEN_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict'

export async function POST(request: NextRequest) {
  try {
    // Auth: admin only. Burns Gemini quota AND can overwrite any post's image.
    const userSupabase = await createClient()
    const { data: { user } } = await userSupabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: profile } = await userSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const rl = checkRateLimit(rateLimitKey(user.id, 'admin/generate-image'), RATE_LIMITS.ai)
    if (!rl.allowed) return rl.response

    const supabase = createServiceClient()

    const body = await request.json()
    const { prompt, postId, igAccountId } = body || {}

    if (!prompt || !postId || !igAccountId) {
      return NextResponse.json(
        { error: 'Missing prompt, postId, or igAccountId' },
        { status: 400 }
      )
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured' },
        { status: 400 }
      )
    }

    // 1. Call Gemini Imagen HTTP API
    const imagenRes = await fetch(`${IMAGEN_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '1:1',
          safetyFilterLevel: 'BLOCK_MEDIUM_AND_ABOVE',
        },
      }),
    })

    if (!imagenRes.ok) {
      const text = await imagenRes.text()
      logger.error('[GenerateImage] Imagen error:', imagenRes.status, text)
      return NextResponse.json(
        { error: 'Imagen API request failed', status: imagenRes.status },
        { status: 500 }
      )
    }

    const imagenJson: any = await imagenRes.json()
    const base64: string | undefined =
      imagenJson?.predictions?.[0]?.bytesBase64Encoded ||
      imagenJson?.predictions?.[0]?.imageBytes

    if (!base64) {
      logger.error('[GenerateImage] No base64 image in response:', imagenJson)
      return NextResponse.json(
        { error: 'Imagen API returned no image data' },
        { status: 500 }
      )
    }

    const imageBuffer = Buffer.from(base64, 'base64')
    const path = `${igAccountId}/${postId}.png`

    // 2. Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('content-images')
      .upload(path, imageBuffer, {
        contentType: 'image/png',
        upsert: true,
      })

    if (uploadError) {
      logger.error('[GenerateImage] Supabase upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload image to storage' },
        { status: 500 }
      )
    }

    const { data: publicUrlData } = supabase.storage
      .from('content-images')
      .getPublicUrl(path)

    const publicUrl = publicUrlData.publicUrl

    // 3. Update content_posts row
    const { data: updatedPost, error: updateError } = await supabase
      .from('content_posts')
      .update({ image_url: publicUrl })
      .eq('id', postId)
      .select('account_id')
      .single()

    if (updateError) {
      logger.error('[GenerateImage] Update post error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update post with image URL' },
        { status: 500 }
      )
    }

    // Telemetry. Gemini Imagen prices ~$0.04/image at the 'gemini-imagen' pricing
    // entry — record 1 "output token" so the cost calc returns the per-image rate.
    recordAiUsage({
      accountId: updatedPost?.account_id ?? null,
      userId: user.id,
      provider: 'gemini',
      model: 'gemini-imagen',
      kind: 'image_generation',
      inputTokens: 0,
      outputTokens: 1,
      metadata: { post_id: postId, ig_account_id: igAccountId },
    })

    return NextResponse.json({ success: true, imageUrl: publicUrl })
  } catch (e: any) {
    logger.error('[GenerateImage] Error:', e)
    return NextResponse.json(
      { error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

