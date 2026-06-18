import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { InstantlyClient } from '@/lib/instantly/client'
import { checkRateLimit, rateLimitKey, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    // Auth: any logged-in user (settings page calls this with the key
    // they're about to save). Rate-limited so this can't be used as an
    // oracle to validate stolen Instantly keys.
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rl = checkRateLimit(rateLimitKey(user.id, 'integrations/test-instantly'), RATE_LIMITS.auth)
    if (!rl.allowed) return rl.response

    const { apiKey } = await request.json()

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 })
    }

    const client = new InstantlyClient(apiKey)
    const result = await client.testConnection()

    return NextResponse.json(result)
  } catch (error: any) {
    logger.error('Error testing Instantly connection:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Connection test failed' },
      { status: 500 }
    )
  }
}
