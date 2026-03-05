import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import crypto from 'crypto'

const MODEL = 'claude-sonnet-4-6'

function sampleHashtags(pool: string[], count: number): string[] {
  const normalized = pool
    .map((h) => (h || '').toLowerCase().replace(/^#/, ''))
    .filter(Boolean)
  const shuffled = Array.from(new Set(normalized))
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, Math.max(0, Math.min(count, shuffled.length)))
}

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
    const { identity_id, mode, idea } = body || {}
    if (!identity_id || !mode || !idea) {
      return NextResponse.json({ error: 'Missing identity_id/mode/idea' }, { status: 400 })
    }

    const { data: identity, error: idError } = await supabase
      .from('account_identities')
      .select('*')
      .eq('id', identity_id)
      .single()

    if (idError || !identity) {
      console.error('[GeneratePost] Identity error:', idError)
      return NextResponse.json({ error: 'Identity not found' }, { status: 404 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey })

    const systemPrompt = identity.voice_prompt || ''
    const hashtagPool: string[] = identity.hashtag_pool || []
    const hashtagsPerPost = identity.hashtags_per_post || 10

    const sampled = sampleHashtags(hashtagPool, hashtagsPerPost)

    if (mode === 'carousel') {
      const userPrompt = `
You are writing an Instagram carousel in the account's voice.

Idea:
${JSON.stringify(idea, null, 2)}

Write:
- "slides": an array where each item has:
  - "type": "headline" | "body" | "cta"
  - "headline": short text for that slide
- "caption": a full caption in this account's voice.

Return STRICT JSON:
{
  "slides": [
    { "type": "headline", "headline": "..." }
  ],
  "caption": "..."
}
      `.trim()

      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 900,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      } as any)

      const text =
        // @ts-ignore
        resp.content?.[0]?.type === 'text'
          ? // @ts-ignore
            resp.content[0].text
          : ''

      let parsed: any = {}
      try {
        const match = text.match(/\{[\s\S]*\}/)
        if (match) {
          parsed = JSON.parse(match[0])
        }
      } catch (e) {
        console.error('[GeneratePost] Carousel JSON parse error:', e, text)
      }

      const slides = parsed.slides || []
      const caption = parsed.caption || ''

      const { data: post, error: insertError } = await supabase
        .from('content_posts')
        .insert({
          ig_account_id: identity.ig_account_id,
          identity_id,
          post_type: 'carousel',
          status: 'draft',
          title: idea.title,
          category: idea.category,
          caption,
          hashtags: sampled,
          slides,
        })
        .select('*')
        .single()

      if (insertError) {
        console.error('[GeneratePost] Carousel insert error:', insertError)
        return NextResponse.json({ error: 'Failed to save post' }, { status: 500 })
      }

      // Insert topic for dedup
      const topic_hash = crypto
        .createHash('sha256')
        .update(String(idea.title || ''))
        .digest('hex')

      await supabase.from('content_topics').insert({
        topic_hash,
        title: idea.title,
        ig_account_id: identity.ig_account_id,
      })

      return NextResponse.json({ post })
    }

    // Single-image mode
    const singleIdea = idea
    const nanoTemplate = `
You are generating a Nano Banana style image prompt for an AI image model.

Style: ${singleIdea.imageStyle}
Subject: ${singleIdea.imageSubject}

Primary:
- One rich, visually specific prompt for this style and subject.

Alternates:
- Three alternative prompts, same style/subject but different compositions.

Return STRICT JSON:
{
  "primary": "prompt text...",
  "alternates": ["alt1", "alt2", "alt3"]
}
`.trim()

    const captionPrompt = `
Write an Instagram caption in this account's voice for a single-image post.

Idea:
${JSON.stringify(singleIdea, null, 2)}

The caption should:
- Open with this hook or improve it: "${singleIdea.captionHook}"
- Follow this angle: "${singleIdea.captionAngle}"
- Be 1–3 short paragraphs.

Return only the caption text.
`.trim()

    const [nanoResp, captionResp] = await Promise.all([
      client.messages.create({
        model: MODEL,
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: nanoTemplate }],
      } as any),
      client.messages.create({
        model: MODEL,
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: captionPrompt }],
      } as any),
    ])

    const nanoText =
      // @ts-ignore
      nanoResp.content?.[0]?.type === 'text'
        ? // @ts-ignore
          nanoResp.content[0].text
        : ''
    const captionText =
      // @ts-ignore
      captionResp.content?.[0]?.type === 'text'
        ? // @ts-ignore
          captionResp.content[0].text
        : ''

    let nanoParsed: any = {}
    try {
      const match = nanoText.match(/\{[\s\S]*\}/)
      if (match) {
        nanoParsed = JSON.parse(match[0])
      }
    } catch (e) {
      console.error('[GeneratePost] Nano JSON parse error:', e, nanoText)
    }

    const nano_prompt = nanoParsed.primary || ''
    const alt_prompts = nanoParsed.alternates || []

    const { data: post, error: insertError } = await supabase
      .from('content_posts')
      .insert({
        ig_account_id: identity.ig_account_id,
        identity_id,
        post_type: 'single',
        status: 'draft',
        title: singleIdea.title,
        category: singleIdea.category,
        caption: captionText.trim(),
        hashtags: sampled,
        nano_prompt,
        alt_prompts,
      })
      .select('*')
      .single()

    if (insertError) {
      console.error('[GeneratePost] Single insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save post' }, { status: 500 })
    }

    const topic_hash = crypto
      .createHash('sha256')
      .update(String(singleIdea.title || ''))
      .digest('hex')

    await supabase.from('content_topics').insert({
      topic_hash,
      title: singleIdea.title,
      ig_account_id: identity.ig_account_id,
    })

    return NextResponse.json({ post })
  } catch (e: any) {
    console.error('[GeneratePost] Error:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}

