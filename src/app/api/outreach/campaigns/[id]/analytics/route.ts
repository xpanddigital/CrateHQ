import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { InstantlyClient } from '@/lib/instantly/client'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get Instantly API key
    const { data: integration } = await supabase
      .from('integrations')
      .select('api_key')
      .eq('user_id', user.id)
      .eq('service', 'instantly')
      .single()

    if (!integration?.api_key) {
      return NextResponse.json(
        { error: 'Instantly not configured' },
        { status: 400 }
      )
    }

    const client = new InstantlyClient(integration.api_key)
    const summary = await client.getCampaignSummary(params.id)

    return NextResponse.json({ summary })
  } catch (error: any) {
    console.error('Error fetching campaign analytics:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
