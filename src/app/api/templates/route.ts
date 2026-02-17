import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_TEMPLATES } from '@/lib/templates/defaults'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch templates
    const { data: templates, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('sequence_position', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching templates:', error)
      return NextResponse.json(
        { error: 'Failed to fetch templates' },
        { status: 500 }
      )
    }

    // If no templates exist, seed defaults
    if (!templates || templates.length === 0) {
      const defaultTemplates = DEFAULT_TEMPLATES.map(template => ({
        ...template,
        created_by: user.id,
        is_active: true,
      }))

      const { data: seededTemplates, error: seedError } = await supabase
        .from('email_templates')
        .insert(defaultTemplates)
        .select()

      if (seedError) {
        console.error('Error seeding templates:', seedError)
        return NextResponse.json({ templates: [] })
      }

      return NextResponse.json({ templates: seededTemplates || [] })
    }

    return NextResponse.json({ templates })
  } catch (error: any) {
    console.error('Error in templates route:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch templates' },
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
    const { name, category, sequence_position, subject, body: templateBody } = body

    if (!name || !category || !subject || !templateBody) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const { data: template, error } = await supabase
      .from('email_templates')
      .insert({
        name,
        category,
        sequence_position: sequence_position || null,
        subject,
        body: templateBody,
        created_by: user.id,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating template:', error)
      return NextResponse.json(
        { error: 'Failed to create template' },
        { status: 500 }
      )
    }

    return NextResponse.json({ template }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create template' },
      { status: 500 }
    )
  }
}
