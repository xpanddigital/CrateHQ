/**
 * Generate a complete IG alias brand identity via Claude Sonnet.
 *
 * Takes a niche / target audience / persona hint and returns a fully populated
 * brand identity object: name, tagline, voice, content pillars, colors,
 * hashtags, posting schedule. This is the Phase B core: each new IG account
 * gets a fresh identity that's distinct from the scout's other aliases.
 *
 * Pairs with the Content Engine (account_identities table) — the returned
 * shape matches account_identities columns 1:1 so the caller can insert
 * directly.
 */

import Anthropic from '@anthropic-ai/sdk'
import { CLAUDE_MODELS } from '@/lib/ai/models'
import { recordAnthropicUsage } from '@/lib/ai/usage'
import { logger } from '@/lib/logger'

export interface GenerateBrandInput {
  /** Free-text niche, e.g. "indie hip-hop scout, female persona, NYC vibe" */
  brief: string
  /** Optional: existing brand names in this scout's portfolio so we don't dupe */
  existingNames?: string[]
  /** For usage attribution */
  accountId: string | null
  userId: string | null
}

export interface BrandIdentity {
  display_name: string
  tagline: string
  persona_bio: string
  voice_prompt: string
  caption_style: 'punchy-short' | 'storytelling' | 'analytical' | 'conversational' | 'hype'
  content_pillars: string[]
  /** 12-15 hashtags balancing reach + niche + branded */
  hashtag_pool: string[]
  hashtags_per_post: number
  colors: {
    primary: string   // hex
    secondary: string
    accent: string
    bg: string
    text: string
  }
  font_heading: string
  font_body: string
  image_styles: string[]   // e.g. ['cinematic', 'documentary', 'lo-fi']
  image_subjects: string[] // e.g. ['urban street', 'studio close-up', 'artist portrait']
  /** Times in HH:MM 24h */
  posting_times: string[]
  /** 3-letter day labels — Mon/Tue/etc. */
  posting_days: string[]
  posts_per_day: number
  carousel_ratio: number // 0..1, fraction of posts that should be carousels
}

export async function generateBrandIdentity(input: GenerateBrandInput): Promise<BrandIdentity> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured — cannot generate brand identity')
  }
  const client = new Anthropic({ apiKey })

  const existingNamesLine = input.existingNames && input.existingNames.length > 0
    ? `\nExisting brand names already used in this scout's portfolio (do NOT reuse or echo): ${input.existingNames.join(', ')}`
    : ''

  const prompt = `You are designing a new Instagram alias account for a music industry catalog-financing scout. Each alias is a distinct micro-brand that posts content + sends cold DMs to indie artists.

Scout brief:
"""
${input.brief}
"""${existingNamesLine}

Generate a complete brand identity. Output STRICT JSON matching this exact schema (no markdown fences, no preamble):

{
  "display_name": "<short, memorable, brandable; 2-4 words; no quotes>",
  "tagline": "<one short line; under 60 chars>",
  "persona_bio": "<2-3 sentence IG bio in the persona's voice; ≤150 chars>",
  "voice_prompt": "<3-5 sentences describing tone, vocabulary, pacing, what to avoid — used as system prompt for content generation>",
  "caption_style": "<one of: punchy-short | storytelling | analytical | conversational | hype>",
  "content_pillars": ["<4-6 distinct content themes>"],
  "hashtag_pool": ["<12-15 hashtags, no # prefix, mix of niche/reach/branded>"],
  "hashtags_per_post": <integer 8-12>,
  "colors": {
    "primary": "<#rrggbb>",
    "secondary": "<#rrggbb>",
    "accent": "<#rrggbb>",
    "bg": "<#rrggbb>",
    "text": "<#rrggbb>"
  },
  "font_heading": "<a real Google Font name>",
  "font_body": "<a real Google Font name>",
  "image_styles": ["<3-5 distinct visual aesthetics e.g. 'cinematic', 'lo-fi', 'documentary'>"],
  "image_subjects": ["<3-5 recurring subjects e.g. 'studio close-ups', 'street portraits'>"],
  "posting_times": ["<HH:MM 24h, 2-4 times spread across active hours>"],
  "posting_days": ["<3-letter labels: Mon Tue Wed Thu Fri Sat Sun; pick 4-7 days>"],
  "posts_per_day": <integer 1-3>,
  "carousel_ratio": <decimal 0.0-1.0; fraction of posts that should be carousels>
}

Constraints:
- The display_name MUST feel like a real indie-scene brand, not a generic AI-sounding name. Avoid: "Pulse", "Wave", "Sound", "Beat", "Vibe", "Hub", "Lab". Avoid "Music", "Records", "Studio" as standalone words.
- Colors should form a cohesive palette. Background should contrast with text. Accent should pop.
- No em dashes, semicolons, or AI clichés in voice_prompt or persona_bio.`

  const resp = await client.messages.create({
    model: CLAUDE_MODELS.SONNET,
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  recordAnthropicUsage(resp, {
    accountId: input.accountId,
    userId: input.userId,
    model: CLAUDE_MODELS.SONNET,
    kind: 'generate_brand_identity',
  })

  const text = resp.content[0]?.type === 'text' ? resp.content[0].text : ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) {
    logger.error('[generateBrandIdentity] No JSON in response:', text.slice(0, 500))
    throw new Error('Claude returned no parseable JSON')
  }
  let parsed: any
  try {
    parsed = JSON.parse(match[0])
  } catch (e) {
    logger.error('[generateBrandIdentity] JSON parse error:', e)
    throw new Error('Claude returned malformed JSON')
  }

  // Light validation + defaults so a misbehaving Claude can't crash the orchestrator
  const brand: BrandIdentity = {
    display_name: typeof parsed.display_name === 'string' ? parsed.display_name.trim() : 'Unnamed Alias',
    tagline: typeof parsed.tagline === 'string' ? parsed.tagline.trim() : '',
    persona_bio: typeof parsed.persona_bio === 'string' ? parsed.persona_bio.trim() : '',
    voice_prompt: typeof parsed.voice_prompt === 'string' ? parsed.voice_prompt.trim() : '',
    caption_style: ['punchy-short','storytelling','analytical','conversational','hype'].includes(parsed.caption_style)
      ? parsed.caption_style
      : 'punchy-short',
    content_pillars: Array.isArray(parsed.content_pillars) ? parsed.content_pillars.slice(0, 8) : [],
    hashtag_pool: Array.isArray(parsed.hashtag_pool)
      ? parsed.hashtag_pool.map((h: any) => String(h).replace(/^#/, '').toLowerCase()).slice(0, 20)
      : [],
    hashtags_per_post: Number.isInteger(parsed.hashtags_per_post) ? parsed.hashtags_per_post : 10,
    colors: {
      primary: parsed.colors?.primary || '#000000',
      secondary: parsed.colors?.secondary || '#333333',
      accent: parsed.colors?.accent || '#e8ff47',
      bg: parsed.colors?.bg || '#000000',
      text: parsed.colors?.text || '#ffffff',
    },
    font_heading: parsed.font_heading || 'DM Sans',
    font_body: parsed.font_body || 'DM Sans',
    image_styles: Array.isArray(parsed.image_styles) ? parsed.image_styles.slice(0, 6) : [],
    image_subjects: Array.isArray(parsed.image_subjects) ? parsed.image_subjects.slice(0, 6) : [],
    posting_times: Array.isArray(parsed.posting_times) ? parsed.posting_times.slice(0, 6) : ['10:00','15:00','19:00'],
    posting_days: Array.isArray(parsed.posting_days) ? parsed.posting_days.slice(0, 7) : ['Mon','Tue','Wed','Thu','Fri'],
    posts_per_day: Number.isInteger(parsed.posts_per_day) ? Math.max(1, Math.min(parsed.posts_per_day, 4)) : 2,
    carousel_ratio: typeof parsed.carousel_ratio === 'number' ? Math.max(0, Math.min(parsed.carousel_ratio, 1)) : 0.6,
  }

  return brand
}
