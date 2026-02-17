import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    const { data: template, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error || !template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ template })
  } catch (error: any) {
    console.error('Error fetching template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch template' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, category, sequence_position, subject, body: templateBody, is_active } = body

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (category !== undefined) updateData.category = category
    if (sequence_position !== undefined) updateData.sequence_position = sequence_position
    if (subject !== undefined) updateData.subject = subject
    if (templateBody !== undefined) updateData.body = templateBody
    if (is_active !== undefined) updateData.is_active = is_active

    const { data: template, error } = await supabase
      .from('email_templates')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating template:', error)
      return NextResponse.json(
        { error: 'Failed to update template' },
        { status: 500 }
      )
    }

    return NextResponse.json({ template })
  } catch (error: any) {
    console.error('Error updating template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update template' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Error deleting template:', error)
      return NextResponse.json(
        { error: 'Failed to delete template' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete template' },
      { status: 500 }
    )
  }
}
