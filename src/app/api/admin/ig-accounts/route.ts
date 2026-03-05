import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { supabase, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') {
    return { supabase, error: NextResponse.json({ error: 'Admin only' }, { status: 403 }) }
  }
  return { supabase, error: null }
}

/**
 * POST — Create a new Instagram account (ig_accounts row).
 * Required for Identity Builder: identities link to an ig_account_id;
 * the dropdown only shows accounts that don't yet have an identity.
 * Body: { ig_username: string, webhook_secret?: string }
 * id is generated; webhook_secret defaults to a random value if omitted.
 */
export async function POST(request: NextRequest) {
  const { supabase, error } = await requireAdmin()
  if (error) return error

  try {
    const body = await request.json()
    const ig_username = typeof body.ig_username === 'string' ? body.ig_username.trim() : ''
    const webhook_secret =
      typeof body.webhook_secret === 'string' && body.webhook_secret.trim()
        ? body.webhook_secret.trim()
        : crypto.randomBytes(24).toString('hex')

    if (!ig_username) {
      return NextResponse.json(
        { error: 'ig_username is required' },
        { status: 400 }
      )
    }

    const id = crypto.randomUUID()

    const { data, error: insertError } = await supabase
      .from('ig_accounts')
      .insert({
        id,
        ig_username,
        webhook_secret,
      })
      .select('id, ig_username')
      .single()

    if (insertError) {
      console.error('[Admin/ig-accounts] Insert error:', insertError)
      return NextResponse.json(
        { error: insertError.message || 'Failed to create account' },
        { status: 500 }
      )
    }

    return NextResponse.json({ account: data })
  } catch (e) {
    console.error('[Admin/ig-accounts] Unhandled error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
