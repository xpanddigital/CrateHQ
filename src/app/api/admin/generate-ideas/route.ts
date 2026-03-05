import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-6'

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
    const { identity_id, mode } = body || {}
    if (!identity_id || !mode || !['carousel', 'single'].includes(mode)) {
      return NextResponse.json(
        { error: 'Missing or invalid identity_id/mode' },
        { status: 400 }
      )
    }

    const { data: identity, error: idError } = await supabase
      .from('account_identities')
      .select('*, ig_account_id')
      .eq('id', identity_id)
      .single()

    if (idError || !identity) {
      console.error('[GenerateIdeas] Identity error:', idError)
      return NextResponse.json({ error: 'Identity not found' }, { status: 404 })
    }

    // Load knowledge base if linked
    let knowledgeContent = ''
    if (identity.knowledge_base_id) {
      const { data: kb } = await supabase
        .from('knowledge_bases')
        .select('content')
        .eq('id', identity.knowledge_base_id)
        .single()
      knowledgeContent = kb?.content || ''
    }

    // Recent topics (30 days) across all accounts
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const { data: topics } = await supabase
      .from('content_topics')
      .select('title')
      .gte('created_at', thirtyDaysAgo.toISOString())

    const existingTopics = (topics || []).map((t) => t.title)
    const pillars = identity.content_pillars || []

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey })

    const systemPrompt = `
${knowledgeContent}

VOICE & TONE:
${identity.voice_prompt || ''}
`.trim()

    const pillarsText = pillars.length ? pillars.join(', ') : 'GENERAL'
    const excludedText = existingTopics.length
      ? existingTopics.join(' | ')
      : 'NONE'

    const userPrompt =
      mode === 'carousel'
        ? `
Generate 10 high-signal carousel ideas for Instagram, returned as JSON.

Rules:
- Use ONLY these content pillars: [${pillarsText}].
- Avoid overlapping with these existing topics across other accounts: [${excludedText}].
- Each idea should feel distinct and valuable, aimed at music catalog / artist business / A&R audiences.
- Vary slideCount between 5 and 9 based on the story complexity.

Return STRICT JSON:
[
  {
    "id": "string unique id",
    "type": "carousel",
    "title": "short title",
    "hook": "scroll-stopping first-slide hook",
    "category": "pillar or theme",
    "angle": "one-sentence angle description",
    "slideCount": 7
  },
  ...
]
`.trim()
        : `
Generate 10 single-image post ideas for Instagram, returned as JSON.

Rules:
- Use ONLY these content pillars: [${pillarsText}].
- Avoid overlapping with these existing topics across other accounts: [${excludedText}].
- Each idea must specify:
  - imageSubject: chosen from this account's subjects only: [${(identity.image_subjects || []).join(
            ', '
          )}]
  - imageStyle: chosen from this account's image styles only: [${(identity.image_styles || []).join(
            ', '
          )}]
  - captionHook: opening sentence in the account's voice
  - captionAngle: one-sentence angle / takeaway

Return STRICT JSON:
[
  {
    "id": "string unique id",
    "type": "single",
    "title": "short title",
    "category": "pillar or theme",
    "imageSubject": "one of the allowed subjects",
    "imageStyle": "one of the allowed styles",
    "captionHook": "hook line",
    "captionAngle": "angle description"
  },
  ...
]
`.trim()

    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    } as any)

    const text =
      // @ts-ignore
      resp.content?.[0]?.type === 'text'
        ? // @ts-ignore
          resp.content[0].text
        : ''

    let ideas: any[] = []
    try {
      const match = text.match(/\[[\s\S]*\]/)
      if (match) {
        const parsed = JSON.parse(match[0])
        if (Array.isArray(parsed)) {
          ideas = parsed
        }
      }
    } catch (e) {
      console.error('[GenerateIdeas] JSON parse error:', e, text)
    }

    // Stats for selected account
    const { data: posts } = await supabase
      .from('content_posts')
      .select('post_type')
      .eq('identity_id', identity_id)

    let carousels = 0
    let singles = 0
    for (const p of posts || []) {
      if (p.post_type === 'carousel') carousels++
      if (p.post_type === 'single') singles++
    }

    return NextResponse.json({
      ideas,
      stats: { carousels, singles },
    })
  } catch (e: any) {
    console.error('[GenerateIdeas] Error:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}

