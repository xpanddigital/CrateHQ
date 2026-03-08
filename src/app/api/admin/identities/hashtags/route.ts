import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

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
    const { content_pillars, display_name } = body || {}

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 400 })
    }

    // Collect all hashtags already in use across identities (optional; table may not exist yet)
    let used = new Set<string>()
    const { data: identities, error: idError } = await supabase
      .from('account_identities')
      .select('hashtag_pool')

    if (!idError && identities) {
      for (const row of identities) {
        ;(row.hashtag_pool || []).forEach((h: string) => {
          const normalized = (h || '').toLowerCase().replace(/^#/, '')
          if (normalized) used.add(normalized)
        })
      }
    }
    // If idError (e.g. account_identities table missing), used stays empty — still generate hashtags

    const usedList = Array.from(used)
    const pillarsText = Array.isArray(content_pillars) && content_pillars.length
      ? content_pillars.join(', ')
      : 'general music business and catalog deals'

    const client = new Anthropic({ apiKey })

    const prompt = `
You are generating a hashtag pool for an Instagram account in the music / catalog investment / artist business niche.

Account: ${display_name || 'Unnamed account'}
Content pillars: ${pillarsText}

Already used hashtags across other accounts (avoid reusing these): ${usedList
      .map((h) => `#${h}`)
      .join(', ')}

Task:
- Generate 30–40 unique, high-quality hashtags.
- Focus on music industry, catalog deals, sync licensing, artist career building, A&R, and the content pillars above.
- Do NOT include any hashtags from the exclusion list above.
- Avoid ultra-generic tags like #music or #instagood.

Return the result as a JSON array of strings, e.g. ["synclicensing", "musiccatalog", ...]
Do not include any explanation, just the JSON array.
    `.trim()

    const resp = await client.messages.create({
export const maxDuration = 60

      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw =
      resp.content[0]?.type === 'text'
        ? resp.content[0].text
        : ''

    let hashtags: string[] = []
    try {
      const match = raw.match(/\[[\s\S]*\]/)
      if (match) {
        const parsed = JSON.parse(match[0])
        if (Array.isArray(parsed)) {
          hashtags = parsed
            .map((h) => (typeof h === 'string' ? h.trim().toLowerCase().replace(/^#/, '') : ''))
            .filter(Boolean)
        }
      }
    } catch (e) {
      console.error('[Admin/Identities/Hashtags] JSON parse error:', e, raw)
    }

    // Fallback: split by commas/whitespace if JSON parse failed
    if (!hashtags.length && raw) {
      hashtags = raw
        .split(/[\s,]+/)
        .map((h) => h.trim().toLowerCase().replace(/^#/, ''))
        .filter((h) => h.length > 1)
    }

    const unique = Array.from(new Set(hashtags))

    return NextResponse.json({ hashtags: unique })
  } catch (e: any) {
    console.error('[Admin/Identities/Hashtags] Error:', e)
    return NextResponse.json(
      { error: e.message || 'Failed to generate hashtags' },
      { status: 500 }
    )
  }
}

