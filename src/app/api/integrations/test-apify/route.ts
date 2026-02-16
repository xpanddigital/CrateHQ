import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apifyToken = process.env.APIFY_TOKEN
    if (!apifyToken) {
      return NextResponse.json(
        { success: false, error: 'APIFY_TOKEN not configured in environment' },
        { status: 400 }
      )
    }

    // Test connection by listing actors
    const res = await fetch(`https://api.apify.com/v2/acts?token=${apifyToken}&limit=1`, {
      headers: { 'Content-Type': 'application/json' },
    })

    if (!res.ok) {
      return NextResponse.json({
        success: false,
        error: `Apify API error: ${res.status}`,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Connection test failed',
    })
  }
}
