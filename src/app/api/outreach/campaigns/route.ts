import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { InstantlyClient } from '@/lib/instantly/client'

export async function GET(request: NextRequest) {
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
    const campaigns = await client.listCampaigns()

    return NextResponse.json({ campaigns })
  } catch (error: any) {
    console.error('Error fetching campaigns:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch campaigns' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 })
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
    const campaign = await client.createCampaign(name)

    return NextResponse.json({ campaign }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating campaign:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create campaign' },
      { status: 500 }
    )
  }
}
