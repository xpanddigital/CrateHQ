import { NextRequest, NextResponse } from 'next/server'
import { InstantlyClient } from '@/lib/instantly/client'

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json()

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 })
    }

    const client = new InstantlyClient(apiKey)
    const result = await client.testConnection()

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error testing Instantly connection:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Connection test failed' },
      { status: 500 }
    )
  }
}
