import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch all scouts with their stats
    const { data: scouts } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (!scouts) {
      return NextResponse.json({ scouts: [] })
    }

    // Enrich with deal counts
    const scoutsWithStats = await Promise.all(
      scouts.map(async (scout) => {
        const { count: totalDeals } = await supabase
          .from('deals')
          .select('*', { count: 'exact', head: true })
          .eq('scout_id', scout.id)

        const { count: activeDeals } = await supabase
          .from('deals')
          .select('*', { count: 'exact', head: true })
          .eq('scout_id', scout.id)
          .not('stage', 'in', '(closed_won,closed_lost)')

        return {
          ...scout,
          total_deals: totalDeals || 0,
          active_deals: activeDeals || 0,
        }
      })
    )

    return NextResponse.json({ scouts: scoutsWithStats })
  } catch (error: any) {
    console.error('Error fetching scouts:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch scouts' },
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

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { email, full_name, role = 'scout' } = await request.json()

    if (!email || !full_name) {
      return NextResponse.json(
        { error: 'Email and full name are required' },
        { status: 400 }
      )
    }

    // Use Supabase Admin API to create user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: {
        full_name,
        role,
      },
    })

    if (createError) {
      console.error('Error creating user:', createError)
      return NextResponse.json(
        { error: createError.message || 'Failed to create user' },
        { status: 500 }
      )
    }

    // Send password reset email (acts as invite)
    const { error: resetError } = await supabase.auth.admin.generateLink({
      type: 'invite',
      email,
    })

    if (resetError) {
      console.error('Error sending invite:', resetError)
      // Don't fail the request, user is created
    }

    return NextResponse.json(
      {
        success: true,
        user: newUser,
        message: 'Scout invited successfully. They will receive an email to set their password.',
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error inviting scout:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to invite scout' },
      { status: 500 }
    )
  }
}
