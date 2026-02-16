import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const configured = !!process.env.APIFY_TOKEN

    return NextResponse.json({ configured })
  } catch (error: any) {
    return NextResponse.json({ configured: false })
  }
}
