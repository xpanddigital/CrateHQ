import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { classifyReplyAI } from '@/lib/ai/sdr-claude'
import { resolveAccountIdForUser } from '@/lib/auth/account'
import { checkRateLimit, rateLimitKey, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

// POST /api/ai/classify - Classify artist reply via Claude Haiku
// (falls back to keyword classifier if ANTHROPIC_API_KEY is missing or the
// API call fails)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rl = checkRateLimit(rateLimitKey(user.id, 'ai/classify'), RATE_LIMITS.ai)
    if (!rl.allowed) return rl.response

    const { replyText, conversationHistory } = await request.json()

    if (!replyText) {
      return NextResponse.json({ error: 'replyText is required' }, { status: 400 })
    }

    const accountId = await resolveAccountIdForUser(supabase, user.id)
    const result = await classifyReplyAI(replyText, conversationHistory || [], {
      accountId,
      userId: user.id,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    logger.error('Error classifying reply:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to classify reply' },
      { status: 500 }
    )
  }
}
