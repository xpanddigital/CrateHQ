import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logger } from '@/lib/logger'

const IMAGEN_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict'

export async function POST(request: NextRequest) {
  try {
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
    const { error: updateError } = await supabase
      .from('content_posts')
      .update({ image_url: publicUrl })
      .eq('id', postId)

    if (updateError) {
      logger.error('[GenerateImage] Update post error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update post with image URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, imageUrl: publicUrl })
  } catch (e: any) {
    logger.error('[GenerateImage] Error:', e)
    return NextResponse.json(
      { error: e.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

