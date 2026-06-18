import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logger } from '@/lib/logger'

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
    logger.error('Error fetching scouts:', error)
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

    const { email, full_name } = await request.json()

    if (!email || !full_name) {
      return NextResponse.json(
        { error: 'Email and full name are required' },
        { status: 400 }
      )
    }

    // Admin user creation requires service role. We've already verified the
    // caller is admin above via the cookie session — now switch clients.
    const adminSupabase = createServiceClient()

    const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { full_name },
    })

    if (createError) {
      logger.error('Error creating user:', createError)
      return NextResponse.json(
        { error: createError.message || 'Failed to create user' },
        { status: 500 }
      )
    }

    // Send invite email
    const { error: resetError } = await adminSupabase.auth.admin.generateLink({
      type: 'invite',
      email,
    })

    if (resetError) {
      logger.error('Error sending invite:', resetError)
      // Don't fail the request, user is created
    }

    // If a paid scouts (billing) row already exists for this email, link it
    // to the newly-created profile. This is the Stripe → invite → profile glue.
    if (newUser?.user?.id) {
      const { error: linkError } = await adminSupabase
        .from('scouts')
        .update({ profile_id: newUser.user.id })
        .eq('email', email)
        .is('profile_id', null)
      if (linkError) {
        logger.warn('Scout billing row link skipped (no matching row or already linked):', linkError.message)
      }
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
    logger.error('Error inviting scout:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to invite scout' },
      { status: 500 }
    )
  }
}
