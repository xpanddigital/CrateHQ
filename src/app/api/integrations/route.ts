import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: integrations, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ integrations })
  } catch (error: any) {
    console.error('Error fetching integrations:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch integrations' },
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

    const { service, api_key, config } = await request.json()

    const { data: integration, error } = await supabase
      .from('integrations')
      .upsert({
        user_id: user.id,
        service,
        api_key,
        config: config || {},
        is_active: true,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ integration }, { status: 201 })
  } catch (error: any) {
    console.error('Error saving integration:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save integration' },
      { status: 500 }
    )
  }
}
