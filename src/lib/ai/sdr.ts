/**
 * AI SDR — Sales Development Representative
 * 
 * Drop this file into src/lib/ai/sdr.ts
 * 
 * Provides:
 * - classifyReply(): Classify incoming artist replies
 * - generateReply(): Generate contextual responses
 * - generateFollowup(): Create follow-up messages for stale leads
 * 
 * Uses Claude Sonnet for reply generation, Haiku for classification.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { Artist, Profile, Conversation, Deal } from '@/types/database'

// ============================================================
// SYSTEM PROMPTS
// ============================================================

const BASE_SYSTEM_PROMPT = `You are an AI sales development representative for music catalog financing.

WHAT YOU SELL: Catalog financing — artists get upfront capital based on streaming revenue. They keep 100% ownership of their masters and music. Repayment comes from a portion of future royalties over 2-5 years. Process takes 2-4 weeks. Free valuation call. Deal sizes $10K-$500K+.

YOUR JOB: Move conversations toward booking a qualifying call. You set appointments, you do not close deals.

RULES:
1. Never promise specific dollar amounts — use ranges like "artists with your profile typically qualify for $X-$Y"
2. Never pressure — if they say no, respect it gracefully
3. Never make legal claims about contracts or terms
4. If asked directly, acknowledge you are an AI assistant working with the scout
5. Always include the booking link when the conversation is warm
6. Keep replies under 5 sentences
7. Sound like a real person in the music industry, not a corporate bot
8. One clear call-to-action per message

OBJECTION RESPONSES:
- "sell my music" → "This isn't selling. You keep 100% ownership. Think of it as a business loan backed by your streaming revenue."
- "is this legit" → "Fair question. The financing company has worked with hundreds of independent artists. Happy to connect you directly — no pressure."
- "catalog too small" → "You might be surprised — artists with even a few years of consistent streaming often qualify. The valuation call is free and takes 15 minutes."
- "what's the catch" → "No catch — a portion of your future royalties repays the advance over an agreed period. You see all terms upfront before committing."
- "need to think" → "Absolutely, take your time. Mind if I check back in a week or two?"
- "already working with someone" → "Always good to explore options. Market rates change — a quick comparison call couldn't hurt."
- "what percentage" → "Specific terms depend on your catalog — streaming volume, catalog age, ownership all factor in. The valuation call walks through everything transparently."`

const CLASSIFY_SYSTEM_PROMPT = `You classify replies from music artists who were contacted about catalog financing.

CLASSIFICATIONS:
- interested: wants to learn more, open to a call, positive sentiment
- question: asking for information but has not committed
- objection: specific concern or pushback
- not_interested: clearly does not want to continue
- warm_no: not ready now but door is open ("maybe later", "busy right now")
- unclear: cannot determine intent

Reply with ONLY valid JSON, no markdown, no backticks:
{"classification": "interested|question|objection|not_interested|warm_no|unclear", "sentiment": "positive|neutral|negative", "urgency": "high|medium|low", "suggested_action": "send_booking_link|answer_question|handle_objection|schedule_followup|remove_from_sequence|escalate_to_human", "reasoning": "one sentence"}`

// ============================================================
// SCOUT PERSONAS
// ============================================================

export const SCOUT_PERSONAS: Record<string, string> = {
  professional: 'Professional but friendly. Concise, data-aware, respects their time.',
  relationship_builder: 'Warm, patient, genuine interest in their music. Connection first, business second.',
  direct: 'Confident and straightforward. Lead with numbers. Get to the point.',
  educator: 'Knowledgeable, positions as an industry resource. Teaches before pitching.',
  peer: 'Casual, music-industry-native. Talks like someone in the business, not finance.',
}

// ============================================================
// TYPES
// ============================================================

export interface Classification {
  classification: 'interested' | 'question' | 'objection' | 'not_interested' | 'warm_no' | 'unclear'
  sentiment: 'positive' | 'neutral' | 'negative'
  urgency: 'high' | 'medium' | 'low'
  suggested_action: string
  reasoning: string
}

export interface GeneratedReply {
  reply_text: string
  action: 'send' | 'hold_for_review' | 'escalate'
  stage_suggestion: string | null
  booking_link_included: boolean
  confidence: number
}

export interface GeneratedFollowup {
  subject: string
  body: string
  strategy: string
}

// ============================================================
// MAIN FUNCTIONS
// ============================================================

const getClient = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Classify an incoming reply from an artist.
 */
export async function classifyReply(
  replyText: string,
  conversationHistory?: Conversation[]
): Promise<Classification> {
  // Build context from conversation history
  let context = ''
  if (conversationHistory?.length) {
    context = '\n\nConversation history (most recent last):\n'
    for (const msg of conversationHistory.slice(-5)) {
      const who = msg.direction === 'outbound' ? 'SCOUT' : 'ARTIST'
      context += `[${who}]: ${msg.body.slice(0, 300)}\n`
    }
  }

  const userMessage = `${context}\n\nNew reply from artist:\n---\n${replyText}\n---`

  try {
    const client = getClient()
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: CLASSIFY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as Classification
    }
  } catch (error) {
    console.error('Classification API error:', error)
  }

  // Fallback: keyword-based classification
  return keywordClassify(replyText)
}

/**
 * Generate a contextual reply to an artist's message.
 */
export async function generateReply(
  replyText: string,
  artist: Partial<Artist>,
  scoutProfile: Partial<Profile>,
  classification: Classification,
  conversationHistory?: Conversation[]
): Promise<GeneratedReply> {
  const persona = SCOUT_PERSONAS[scoutProfile.ai_sdr_persona || 'professional'] || SCOUT_PERSONAS.professional
  const bookingLink = scoutProfile.calendly_link || '{{booking_link}}'

  const contextParts = [
    `## CONTEXT`,
    `Artist: ${artist.name || 'Unknown'}`,
    `Monthly streams: ${(artist.streams_last_month || 0).toLocaleString()}`,
    `Tracks: ${artist.track_count || 'N/A'}`,
    `Genres: ${Array.isArray(artist.genres) ? artist.genres.join(', ') : 'N/A'}`,
    `Estimated offer range: $${(artist.estimated_offer_low || 0).toLocaleString()} — $${(artist.estimated_offer_high || 0).toLocaleString()}`,
    ``,
    `Reply classified as: ${classification.classification}`,
    `Sentiment: ${classification.sentiment}`,
    `Suggested action: ${classification.suggested_action}`,
  ]

  if (conversationHistory?.length) {
    contextParts.push('', '## CONVERSATION HISTORY')
    for (const msg of conversationHistory.slice(-6)) {
      const who = msg.direction === 'outbound' ? 'YOU' : 'ARTIST'
      contextParts.push(`[${who}]: ${msg.body.slice(0, 500)}`)
    }
  }

  const systemPrompt = `${BASE_SYSTEM_PROMPT}\n\n## YOUR PERSONA\nName: ${scoutProfile.full_name || 'Scout'}\nStyle: ${persona}\nBooking link: ${bookingLink}`

  const userMessage = `${contextParts.join('\n')}

The artist just replied:
---
${replyText}
---

Write a reply that addresses what they said, moves toward booking a call if appropriate, stays under 5 sentences, and sounds human.

Reply with JSON only, no markdown:
{"reply_text": "your reply", "action": "send|hold_for_review|escalate", "stage_suggestion": "stage_name_or_null", "booking_link_included": true_or_false, "confidence": 0.0_to_1.0}`

  try {
    const client = getClient()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as GeneratedReply
      // Safety: hold for review if low confidence
      if (parsed.confidence < 0.7) {
        parsed.action = 'hold_for_review'
      }
      return parsed
    }
  } catch (error) {
    console.error('Reply generation error:', error)
  }

  return {
    reply_text: '',
    action: 'escalate',
    stage_suggestion: null,
    booking_link_included: false,
    confidence: 0,
  }
}

/**
 * Generate a follow-up for a lead that has gone quiet.
 */
export async function generateFollowup(
  artist: Partial<Artist>,
  daysSinceLastContact: number,
  scoutProfile: Partial<Profile>,
  conversationHistory?: Conversation[]
): Promise<GeneratedFollowup> {
  // Determine strategy based on time elapsed
  let strategy: string
  let instruction: string

  if (daysSinceLastContact <= 5) {
    strategy = 'gentle_nudge'
    instruction = 'Brief friendly follow-up. Do not repeat the pitch. 2-3 sentences.'
  } else if (daysSinceLastContact <= 10) {
    strategy = 'value_add'
    instruction = 'Share something useful about catalog financing or their streaming growth. Not salesy.'
  } else if (daysSinceLastContact <= 20) {
    strategy = 'direct_question'
    instruction = 'Ask a direct yes/no question. "Is this something you want to explore, or should I stop reaching out?" 2 sentences max.'
  } else if (daysSinceLastContact <= 30) {
    strategy = 'breakup'
    instruction = 'Graceful breakup email. Closing their file, door is always open. These get the highest reply rates.'
  } else {
    strategy = 're_engagement'
    instruction = 'Re-engagement after a long gap. Fresh angle, reference that it has been a while.'
  }

  const bookingLink = scoutProfile.calendly_link || '{{booking_link}}'
  const persona = SCOUT_PERSONAS[scoutProfile.ai_sdr_persona || 'professional'] || SCOUT_PERSONAS.professional

  try {
    const client = getClient()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      system: `${BASE_SYSTEM_PROMPT}\n\nYour persona: ${persona}\nBooking link: ${bookingLink}`,
      messages: [{
        role: 'user',
        content: `Artist: ${artist.name}
Monthly streams: ${(artist.streams_last_month || 0).toLocaleString()}
Genres: ${Array.isArray(artist.genres) ? artist.genres.join(', ') : 'N/A'}
Days since last contact: ${daysSinceLastContact}
Strategy: ${strategy}

${instruction}

Reply with JSON only, no markdown:
{"subject": "email subject", "body": "the message", "strategy": "${strategy}"}`
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as GeneratedFollowup
    }
  } catch (error) {
    console.error('Followup generation error:', error)
  }

  // Fallback templates
  return fallbackFollowup(artist, daysSinceLastContact, scoutProfile)
}

// ============================================================
// FALLBACKS (work without API)
// ============================================================

function keywordClassify(text: string): Classification {
  const t = text.toLowerCase()

  if (['not interested', 'unsubscribe', 'remove', 'stop', 'no thanks', "don't contact"].some(w => t.includes(w))) {
    return { classification: 'not_interested', sentiment: 'negative', urgency: 'low', suggested_action: 'remove_from_sequence', reasoning: 'Explicit opt-out' }
  }
  if (['maybe later', 'not right now', 'busy right now', 'not a good time'].some(w => t.includes(w))) {
    return { classification: 'warm_no', sentiment: 'neutral', urgency: 'low', suggested_action: 'schedule_followup', reasoning: 'Soft no, door open' }
  }
  if (['interested', 'tell me more', 'sounds good', "let's talk", 'schedule', 'book', "let's do it", 'down for', 'i\'m down'].some(w => t.includes(w))) {
    return { classification: 'interested', sentiment: 'positive', urgency: 'high', suggested_action: 'send_booking_link', reasoning: 'Positive signals' }
  }
  if (t.includes('?') || ['how much', 'how does', "what's the", 'do i keep', 'how long', 'what percentage'].some(w => t.includes(w))) {
    return { classification: 'question', sentiment: 'neutral', urgency: 'medium', suggested_action: 'answer_question', reasoning: 'Asking questions' }
  }
  if (["don't want to sell", 'scam', 'catch', 'too good', 'skeptical'].some(w => t.includes(w))) {
    return { classification: 'objection', sentiment: 'negative', urgency: 'medium', suggested_action: 'handle_objection', reasoning: 'Expressing concern' }
  }

  return { classification: 'unclear', sentiment: 'neutral', urgency: 'low', suggested_action: 'escalate_to_human', reasoning: 'Cannot determine intent' }
}

function fallbackFollowup(artist: Partial<Artist>, days: number, scout: Partial<Profile>): GeneratedFollowup {
  const name = artist.name?.split(' ')[0] || 'there'
  const link = scout.calendly_link || '{{booking_link}}'

  if (days <= 5) {
    return {
      subject: `Quick follow up, ${name}`,
      body: `Hi ${name}, just floating this back to the top of your inbox. Would love to chat about what your catalog could unlock for you. Any interest in a quick 15-min call? ${link}`,
      strategy: 'gentle_nudge',
    }
  } else if (days <= 20) {
    return {
      subject: `Still open to chatting, ${name}?`,
      body: `Hi ${name}, wanted to check — is catalog financing something you'd want to explore? If so, I'd love to set up a quick call. If not, no worries at all. ${link}`,
      strategy: 'direct_question',
    }
  } else {
    return {
      subject: `Closing your file, ${name}`,
      body: `Hi ${name}, I've reached out a few times and want to respect your time. I'll close your file for now, but if you ever want to explore what your catalog could be worth, I'm just an email away. Keep making great music.`,
      strategy: 'breakup',
    }
  }
}
