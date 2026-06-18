/**
 * Claude-powered SDR functions (replacement for the keyword/template versions
 * in `./sdr.ts`).
 *
 * Drop-in compatible signatures so callers in /api/ai/* can swap by changing
 * one import line. If Anthropic is unavailable or returns an unparseable
 * response, each function falls back to the legacy keyword/template logic in
 * `./sdr.ts` and logs — never throws.
 *
 * Model choices (see lib/ai/models.ts):
 *   - classifyReply  → HAIKU (high frequency, low value-per-call)
 *   - generateReply  → SONNET (quality matters; reply rate is the business)
 *   - generateFollowup → SONNET (same)
 */

import Anthropic from '@anthropic-ai/sdk'
import { CLAUDE_MODELS } from './models'
import { recordAnthropicUsage } from './usage'
import {
  classifyReply as classifyReplyFallback,
  generateReply as generateReplyFallback,
  generateFollowup as generateFollowupFallback,
  SCOUT_PERSONAS,
  type ReplyClassification,
  type ScoutPersona,
} from './sdr'
import { logger } from '@/lib/logger'

export type { ReplyClassification, ScoutPersona }
export { SCOUT_PERSONAS }

/** Pass to any of the AI functions so the call gets billed to the right tenant. */
export interface UsageContext {
  accountId: string | null
  userId: string | null
}

interface ClassifyResult {
  classification: ReplyClassification
  confidence: number
  reasoning: string
}

interface GenerateReplyInput {
  replyText: string
  classification: ReplyClassification
  artistName: string
  artistData: {
    streams_last_month?: number
    spotify_monthly_listeners?: number
    estimated_offer_low?: number
    estimated_offer_high?: number
    genres?: string[]
  }
  conversationHistory: Array<{
    direction: string
    body: string
  }>
  scoutPersona: ScoutPersona
  scoutCalendlyLink?: string | null
  scoutName?: string | null
  /** Optional. Without it the call isn't logged to ai_usage. */
  usage?: UsageContext
}

interface GenerateFollowupInput {
  artistName: string
  daysSinceContact: number
  conversationHistory: Array<{
    direction: string
    body: string
  }>
  artistData: {
    streams_last_month?: number
    spotify_monthly_listeners?: number
    estimated_offer_low?: number
    estimated_offer_high?: number
  }
  scoutPersona: ScoutPersona
  scoutCalendlyLink?: string | null
  scoutName?: string | null
  /** Optional. Without it the call isn't logged to ai_usage. */
  usage?: UsageContext
}

const VALID_CLASSIFICATIONS: ReplyClassification[] = [
  'interested',
  'question',
  'objection',
  'not_interested',
  'warm_no',
  'unclear',
]

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  return new Anthropic({ apiKey })
}

function formatRange(low?: number, high?: number): string {
  if (!low && !high) return 'a competitive amount'
  const l = low ? `$${Math.round(low / 1000)}k` : ''
  const h = high ? `$${Math.round(high / 1000)}k` : ''
  if (l && h) return `${l}–${h}`
  return l || h
}

function formatHistory(history: Array<{ direction: string; body: string }>): string {
  if (!history || history.length === 0) return '(no prior messages)'
  return history
    .slice(-8) // last 8 messages keeps the prompt compact
    .map(m => `[${m.direction}] ${m.body}`)
    .join('\n')
}

// ── classifyReply ───────────────────────────────────────────────────────

/**
 * Classify an artist reply via Claude Haiku. Falls back to keyword
 * classification on any error. Returns within ~500-1500ms typical.
 */
export async function classifyReplyAI(
  replyText: string,
  conversationHistory: Array<{ direction: string; body: string }> = [],
  usage?: UsageContext
): Promise<ClassifyResult> {
  const client = getClient()
  if (!client) {
    logger.warn('[classifyReplyAI] No ANTHROPIC_API_KEY, falling back to keyword classifier')
    return classifyReplyFallback(replyText, conversationHistory)
  }

  const prompt = `Classify this Instagram reply from an independent music artist who was DMed about a catalogue financing offer. Output ONLY valid JSON.

Categories:
- interested:     wants to learn more, asks for next steps, wants to talk
- question:       asks how the deal works, asks about terms, asks who you are
- objection:      raises a concern about ownership, contract, you, the offer
- not_interested: explicit "no", asks to stop, hostile
- warm_no:        not right now, maybe later, doesn't fit current goals
- unclear:        ambiguous, off-topic, single emoji, can't tell

Reply to classify:
"""
${replyText}
"""

Prior conversation (most recent last):
${formatHistory(conversationHistory)}

Output schema:
{"classification": "<one of the categories above>", "confidence": <0.0-1.0>, "reasoning": "<one short sentence>"}`

  try {
    const resp = await client.messages.create({
      model: CLAUDE_MODELS.HAIKU,
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    })
    if (usage) {
      recordAnthropicUsage(resp, {
        accountId: usage.accountId,
        userId: usage.userId,
        model: CLAUDE_MODELS.HAIKU,
        kind: 'classify_reply',
      })
    }
    const text = resp.content[0]?.type === 'text' ? resp.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON found in response')
    const parsed = JSON.parse(match[0])
    const classification = parsed.classification as ReplyClassification
    if (!VALID_CLASSIFICATIONS.includes(classification)) {
      throw new Error(`Invalid classification: ${parsed.classification}`)
    }
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5))
    const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : ''
    return { classification, confidence, reasoning }
  } catch (e) {
    logger.error('[classifyReplyAI] Falling back to keyword classifier:', e)
    return classifyReplyFallback(replyText, conversationHistory)
  }
}

// ── generateReply ───────────────────────────────────────────────────────

/**
 * Generate a personalized reply via Claude Sonnet. Uses artist data,
 * conversation history, and scout persona. Falls back to template on error.
 */
export async function generateReplyAI(input: GenerateReplyInput): Promise<string> {
  const client = getClient()
  if (!client) {
    logger.warn('[generateReplyAI] No ANTHROPIC_API_KEY, falling back to template')
    return generateReplyFallback(input)
  }

  const personaDescription = SCOUT_PERSONAS[input.scoutPersona]
  const offerRange = formatRange(input.artistData.estimated_offer_low, input.artistData.estimated_offer_high)
  const streams = input.artistData.streams_last_month || input.artistData.spotify_monthly_listeners
  const genres = (input.artistData.genres || []).filter(Boolean).join(', ') || 'their genre'

  const calendlyLine = input.scoutCalendlyLink
    ? `If the artist seems ready for a call, include this calendar link verbatim: ${input.scoutCalendlyLink}`
    : 'If the artist seems ready for a call, propose a couple of specific times this week.'

  const prompt = `You are a music industry scout reaching out about a short-term catalog financing deal. You're replying to an artist who just messaged you back on Instagram. Match this persona: ${personaDescription}.

Artist context:
- Name: ${input.artistName}
- Genre(s): ${genres}
- Streams indicator: ${streams ? streams.toLocaleString() + ' monthly' : 'unknown'}
- Offer range you can quote: ${offerRange}

Their classified reply intent: ${input.classification}

Conversation so far:
${formatHistory(input.conversationHistory)}

The artist just said:
"""
${input.replyText}
"""

Write a reply that:
- Speaks DIRECTLY to what they actually said (don't restart the pitch)
- Matches the persona's tone, not a generic template
- Is concise — 2-5 short sentences for IG, up to 2 short paragraphs for email
- Drops the offer range naturally if their intent is interested/question/objection
- ${calendlyLine}
- Does NOT use em dashes, semicolons, or AI clichés ("delve", "thrilled", "exciting opportunity")

Output ONLY the reply text. No subject line, no signature, no preamble.`

  try {
    const resp = await client.messages.create({
      model: CLAUDE_MODELS.SONNET,
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })
    if (input.usage) {
      recordAnthropicUsage(resp, {
        accountId: input.usage.accountId,
        userId: input.usage.userId,
        model: CLAUDE_MODELS.SONNET,
        kind: 'generate_reply',
        metadata: { classification: input.classification },
      })
    }
    const text = resp.content[0]?.type === 'text' ? resp.content[0].text.trim() : ''
    if (!text) throw new Error('Empty response from Claude')
    return text
  } catch (e) {
    logger.error('[generateReplyAI] Falling back to template:', e)
    return generateReplyFallback(input)
  }
}

// ── generateFollowup ────────────────────────────────────────────────────

/**
 * Generate a follow-up message via Claude Sonnet. Strategy varies by days
 * since last contact. Returns { subject, body } so the caller can use it for
 * email or just take the body for IG.
 */
export async function generateFollowupAI(
  input: GenerateFollowupInput
): Promise<{ subject: string; body: string }> {
  const client = getClient()
  if (!client) {
    logger.warn('[generateFollowupAI] No ANTHROPIC_API_KEY, falling back to template')
    return generateFollowupFallback(input)
  }

  const personaDescription = SCOUT_PERSONAS[input.scoutPersona]
  const offerRange = formatRange(input.artistData.estimated_offer_low, input.artistData.estimated_offer_high)
  const streams = input.artistData.streams_last_month || input.artistData.spotify_monthly_listeners

  let strategyHint: string
  if (input.daysSinceContact <= 7) {
    strategyHint = 'Quick bump. Short, no new value, just a gentle nudge. 2-3 sentences max.'
  } else if (input.daysSinceContact <= 14) {
    strategyHint = `Value-add. Reference recent activity in their genre or what other artists are doing with catalog deals (around ${offerRange}). 3-4 sentences.`
  } else if (input.daysSinceContact <= 30) {
    strategyHint = 'Re-engagement. Acknowledge silence directly. Offer to close the file if no interest. Honest, not pushy.'
  } else {
    strategyHint = 'Long-term nurture. Casual check-in. No pressure. Keep the door open.'
  }

  const calendlyLine = input.scoutCalendlyLink
    ? `If proposing a call, include this calendar link verbatim: ${input.scoutCalendlyLink}`
    : 'If proposing a call, suggest a couple of specific times this week.'

  const prompt = `You are a music industry scout following up with an artist about a catalog financing offer. Persona: ${personaDescription}.

Artist context:
- Name: ${input.artistName}
- Streams: ${streams ? streams.toLocaleString() : 'unknown'} monthly
- Offer range: ${offerRange}
- Days since last contact: ${input.daysSinceContact}

Strategy for THIS follow-up: ${strategyHint}

Prior conversation (most recent last):
${formatHistory(input.conversationHistory)}

${calendlyLine}

Output STRICT JSON:
{"subject": "<email subject line — short, casual, not salesy>", "body": "<message body, no signature>"}

Constraints:
- No em dashes, semicolons, or AI clichés.
- No "Hi {artist name}, hope you're well" openings. Get to the point.
- Match the persona's voice.`

  try {
    const resp = await client.messages.create({
      model: CLAUDE_MODELS.SONNET,
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })
    if (input.usage) {
      recordAnthropicUsage(resp, {
        accountId: input.usage.accountId,
        userId: input.usage.userId,
        model: CLAUDE_MODELS.SONNET,
        kind: 'generate_followup',
        metadata: { days_since_contact: input.daysSinceContact },
      })
    }
    const text = resp.content[0]?.type === 'text' ? resp.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON found in response')
    const parsed = JSON.parse(match[0])
    const subject = typeof parsed.subject === 'string' && parsed.subject.trim()
      ? parsed.subject.trim()
      : `Following up — ${input.artistName}`
    const body = typeof parsed.body === 'string' && parsed.body.trim()
      ? parsed.body.trim()
      : ''
    if (!body) throw new Error('Empty body from Claude')
    return { subject, body }
  } catch (e) {
    logger.error('[generateFollowupAI] Falling back to template:', e)
    return generateFollowupFallback(input)
  }
}
