import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: tags, error } = await supabase
      .from('tags')
      .select('*')
      .order('name')

    if (error) throw error

    return NextResponse.json({ tags })
  } catch (error: any) {
    console.error('Error fetching tags:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tags' },
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

    const body = await request.json()
    const { name, color, description } = body

    const { data: tag, error } = await supabase
      .from('tags')
      .insert({
        name,
        color: color || '#6C5CE7',
        description,
        created_by: user.id
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ tag }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating tag:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create tag' },
      { status: 500 }
    )
  }
}
