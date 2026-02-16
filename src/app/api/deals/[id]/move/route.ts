import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/deals/[id]/move - Move deal to new stage
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { stage } = await request.json()

    if (!stage) {
      return NextResponse.json({ error: 'stage is required' }, { status: 400 })
    }

    // Validate stage
    const validStages = [
      'new', 'enriched', 'outreach_queued', 'contacted', 'replied',
      'interested', 'call_scheduled', 'call_completed', 'qualified',
      'handed_off', 'in_negotiation', 'contract_sent',
      'closed_won', 'closed_lost', 'nurture'
    ]

    if (!validStages.includes(stage)) {
      return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
    }

    const { data: deal, error } = await supabase
      .from('deals')
      .update({
        stage,
        stage_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ deal })
  } catch (error: any) {
    console.error('Error moving deal:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to move deal' },
      { status: 500 }
    )
  }
}
