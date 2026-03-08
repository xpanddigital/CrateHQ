import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { theme_id, caption_style, content_pillars, display_name } = body || {}

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey })
    const pillarsText = Array.isArray(content_pillars) && content_pillars.length
      ? content_pillars.join(', ')
      : 'general music industry'

    const prompt = `
You are designing the voice & tone for an Instagram account identity in a music/creator context.

Account: ${display_name || 'Unnamed account'}
Theme ID: ${theme_id}
Caption style: ${caption_style}
Content pillars: ${pillarsText}

Write a concise but detailed "voice_prompt" that describes:
- Tone (e.g. playful, analytical, mentor-like)
- Perspective (first person / third person, "we" vs "I")
- Pacing and sentence length
- Vocabulary and slang guidelines
- What to avoid (tone, topics, clichés)

Return just the voice prompt text, no bullet labels, no markdown.
    `.trim()

    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const text =
      resp.content[0]?.type === 'text'
        ? resp.content[0].text
        : ''

    return NextResponse.json({ voice_prompt: text.trim() })
  } catch (e: any) {
    console.error('[Admin/Identities/Voice] Error:', e)
    return NextResponse.json(
      { error: e.message || 'Failed to generate voice prompt' },
      { status: 500 }
    )
  }
}

