import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enrichAndSave } from '@/lib/enrichment/enrich-and-save'

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

    const { data: artist, error: fetchError } = await supabase
      .from('artists')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError || !artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
    }

    const result = await enrichAndSave({ supabase, artist, runBy: user.id })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error enriching artist:', error)
    return NextResponse.json(
      { error: error.message || 'Enrichment failed' },
      { status: 500 }
    )
  }
}
