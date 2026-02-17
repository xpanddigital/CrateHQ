/**
 * AI SDR Module
 * 
 * Provides AI-powered sales development functions:
 * - classifyReply: Classify artist replies
 * - generateReply: Generate contextual responses
 * - generateFollowup: Create follow-up messages
 * 
 * Uses keyword-based fallbacks that work without API calls
 */

export type ReplyClassification = 
  | 'interested'
  | 'question'
  | 'objection'
  | 'not_interested'
  | 'warm_no'
  | 'unclear'

export type ScoutPersona = 
  | 'professional'
  | 'relationship_builder'
  | 'direct'
  | 'educator'
  | 'peer'

export const SCOUT_PERSONAS: Record<ScoutPersona, string> = {
  professional: 'Formal, structured communication with clear next steps',
  relationship_builder: 'Warm, personal approach focused on building trust',
  direct: 'Concise, to-the-point messaging without fluff',
  educator: 'Informative style that explains concepts clearly',
  peer: 'Casual, friendly tone like talking to a colleague',
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
}

/**
 * Classify an artist's reply using keyword-based analysis
 */
export function classifyReply(
  replyText: string,
  conversationHistory: Array<{ direction: string; body: string }> = []
): ClassifyResult {
  const text = replyText.toLowerCase()

  // Interested signals
  const interestedKeywords = [
    'yes', 'interested', 'sounds good', 'tell me more', 'let\'s talk',
    'when can we', 'i\'d like to', 'sounds interesting', 'i\'m in',
    'let\'s do it', 'count me in', 'definitely', 'absolutely'
  ]

  // Question signals
  const questionKeywords = [
    'how does', 'what is', 'can you explain', 'tell me about',
    'what are the', 'how much', 'when would', 'who', 'why',
    'could you', 'would you', '?'
  ]

  // Objection signals
  const objectionKeywords = [
    'but', 'however', 'concern', 'worried', 'not sure',
    'hesitant', 'problem', 'issue', 'don\'t understand'
  ]

  // Not interested signals
  const notInterestedKeywords = [
    'not interested', 'no thanks', 'not right now', 'pass',
    'not for me', 'don\'t want', 'unsubscribe', 'stop'
  ]

  // Warm no signals
  const warmNoKeywords = [
    'maybe later', 'not at this time', 'check back', 'in the future',
    'not ready', 'timing isn\'t right', 'revisit', 'keep in touch'
  ]

  // Count matches
  let interestedScore = 0
  let questionScore = 0
  let objectionScore = 0
  let notInterestedScore = 0
  let warmNoScore = 0

  interestedKeywords.forEach(kw => {
    if (text.includes(kw)) interestedScore++
  })

  questionKeywords.forEach(kw => {
    if (text.includes(kw)) questionScore++
  })

  objectionKeywords.forEach(kw => {
    if (text.includes(kw)) objectionScore++
  })

  notInterestedKeywords.forEach(kw => {
    if (text.includes(kw)) notInterestedScore++
  })

  warmNoKeywords.forEach(kw => {
    if (text.includes(kw)) warmNoScore++
  })

  // Determine classification
  const scores = {
    interested: interestedScore,
    question: questionScore,
    objection: objectionScore,
    not_interested: notInterestedScore,
    warm_no: warmNoScore,
  }

  const maxScore = Math.max(...Object.values(scores))
  
  if (maxScore === 0) {
    return {
      classification: 'unclear',
      confidence: 0.3,
      reasoning: 'No clear signals detected in the message'
    }
  }

  const classification = Object.entries(scores).find(
    ([_, score]) => score === maxScore
  )?.[0] as ReplyClassification

  const confidence = Math.min(0.5 + (maxScore * 0.15), 0.95)

  return {
    classification,
    confidence,
    reasoning: `Detected ${maxScore} keyword match(es) for ${classification}`
  }
}

/**
 * Generate a contextual reply based on classification and artist data
 */
export function generateReply(input: GenerateReplyInput): string {
  const { classification, artistName, artistData, scoutPersona } = input

  const personaStyles = {
    professional: {
      greeting: `Hi ${artistName},`,
      tone: 'formal and structured',
      closing: 'Best regards'
    },
    relationship_builder: {
      greeting: `Hey ${artistName}!`,
      tone: 'warm and personal',
      closing: 'Looking forward to connecting'
    },
    direct: {
      greeting: `${artistName},`,
      tone: 'concise and to-the-point',
      closing: 'Thanks'
    },
    educator: {
      greeting: `Hi ${artistName},`,
      tone: 'informative and helpful',
      closing: 'Happy to help'
    },
    peer: {
      greeting: `Hey ${artistName},`,
      tone: 'casual and friendly',
      closing: 'Cheers'
    }
  }

  const style = personaStyles[scoutPersona]
  const estimateRange = artistData.estimated_offer_low && artistData.estimated_offer_high
    ? `$${Math.round(artistData.estimated_offer_low / 1000)}K - $${Math.round(artistData.estimated_offer_high / 1000)}K`
    : null

  switch (classification) {
    case 'interested':
      return `${style.greeting}

Great to hear you're interested! Based on your streaming numbers, we're looking at a potential catalog financing offer in the ${estimateRange || '$50K - $150K'} range.

Here's what happens next:
1. Quick 15-min call to discuss your goals
2. We'll prepare a detailed offer
3. If it works for both of us, we can move forward

When would be a good time for a brief call this week?

${style.closing}`

    case 'question':
      return `${style.greeting}

Great question! Let me clarify:

Catalog financing means we provide upfront capital in exchange for a share of your future streaming royalties. You keep 100% ownership of your music and creative control.

Key benefits:
• Immediate cash to invest in your career
• No debt or monthly payments
• We succeed when you succeed

Would you like to hop on a quick call to discuss how this could work for your catalog specifically?

${style.closing}`

    case 'objection':
      return `${style.greeting}

I completely understand your concerns. Let me address that:

Many artists initially have questions about catalog financing. The key difference from a traditional deal is that you maintain full ownership and creative control. We're simply investing in your existing catalog's future earnings.

Think of it like this: you get capital now to grow your career, and we share in the upside of that growth. No debt, no monthly payments, no giving up rights.

Would it help to see some case studies of artists we've worked with? Or we could schedule a quick call to walk through exactly how it works?

${style.closing}`

    case 'not_interested':
      return `${style.greeting}

No problem at all - I appreciate you letting me know!

If your situation changes or you'd like to revisit this down the line, feel free to reach out. I'll keep you on my radar for future opportunities that might be a better fit.

Wishing you all the best with your music!

${style.closing}`

    case 'warm_no':
      return `${style.greeting}

Totally understand - timing is everything!

I'll make a note to circle back in a few months. In the meantime, if anything changes or you have questions, my door is always open.

Keep crushing it with your music!

${style.closing}`

    case 'unclear':
    default:
      return `${style.greeting}

Thanks for getting back to me! I want to make sure I'm addressing what matters most to you.

Could you share a bit more about:
• What your goals are for the next 6-12 months?
• Whether you're looking for capital to invest in your career?
• Any specific questions about how catalog financing works?

Looking forward to hearing from you!

${style.closing}`
  }
}

/**
 * Generate a follow-up message based on days since last contact
 */
export function generateFollowup(input: GenerateFollowupInput): { subject: string; body: string } {
  const { artistName, daysSinceContact, artistData, scoutPersona } = input

  const personaStyles = {
    professional: { greeting: `Hi ${artistName},`, closing: 'Best regards' },
    relationship_builder: { greeting: `Hey ${artistName}!`, closing: 'Hope to hear from you soon' },
    direct: { greeting: `${artistName},`, closing: 'Thanks' },
    educator: { greeting: `Hi ${artistName},`, closing: 'Happy to help' },
    peer: { greeting: `Hey ${artistName},`, closing: 'Cheers' }
  }

  const style = personaStyles[scoutPersona]

  // Strategy based on days elapsed
  if (daysSinceContact <= 7) {
    // Quick follow-up
    return {
      subject: `Quick follow-up - ${artistName}`,
      body: `${style.greeting}

Just wanted to follow up on my previous message about catalog financing for your music.

I know you're busy, so I'll keep this brief: we're seeing strong potential with your streaming numbers and would love to explore how we could help you invest in your career growth.

Got 15 minutes this week for a quick call?

${style.closing}`
    }
  } else if (daysSinceContact <= 14) {
    // Value-add follow-up
    return {
      subject: `Thought this might interest you - ${artistName}`,
      body: `${style.greeting}

I've been following your recent releases and wanted to reach back out.

We're currently working with several artists in your genre who are using catalog financing to:
• Fund new recording projects
• Invest in marketing and promotion
• Tour without going into debt

Based on your streaming numbers, you'd likely qualify for ${artistData.estimated_offer_low ? `$${Math.round(artistData.estimated_offer_low / 1000)}K+` : 'significant funding'}.

Would it be worth a quick conversation to see if this could accelerate your growth?

${style.closing}`
    }
  } else if (daysSinceContact <= 30) {
    // Re-engagement follow-up
    return {
      subject: `Still interested? - ${artistName}`,
      body: `${style.greeting}

I wanted to reach out one more time before I close out your file.

I noticed you haven't responded to my previous messages, which is totally fine! But I wanted to make sure you didn't miss the opportunity.

We're offering catalog financing to artists with your streaming profile, and the terms are quite favorable right now.

If you're not interested, no worries - just let me know and I'll stop reaching out. But if you'd like to learn more, I'm here.

${style.closing}`
    }
  } else {
    // Long-term nurture
    return {
      subject: `Checking in - ${artistName}`,
      body: `${style.greeting}

It's been a while since we last connected, and I wanted to see how things are going with your music.

A lot has changed in the catalog financing space recently, and we're seeing more artists take advantage of these opportunities to fund their growth without giving up ownership.

If you're open to it, I'd love to catch up and see if there's a way we could work together.

No pressure - just wanted to keep the door open!

${style.closing}`
    }
  }
}
