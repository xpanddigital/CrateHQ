'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function TestAuthPage() {
  const [status, setStatus] = useState<any>({})

  useEffect(() => {
    const supabase = createClient()
    
    setStatus({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET',
      anonKeyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0,
      clientExists: !!supabase,
    })
  }, [])

  const testSignup = async () => {
    const supabase = createClient()
    const result = await supabase.auth.signUp({
      email: 'test' + Date.now() + '@test.com',
      password: 'test123456',
      options: {
        data: { full_name: 'Test User', role: 'admin' }
      }
    })
    console.log('Signup result:', result)
    alert(JSON.stringify(result, null, 2))
  }

  const testLogin = async () => {
    const supabase = createClient()
    const result = await supabase.auth.signInWithPassword({
      email: 'admin@test.com',
      password: 'admin123',
    })
    console.log('Login result:', result)
    alert(JSON.stringify(result, null, 2))
  }

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Auth Debug Page</h1>
      
      <div className="bg-muted p-4 rounded">
        <pre>{JSON.stringify(status, null, 2)}</pre>
      </div>

      <div className="space-x-2">
        <button onClick={testSignup} className="px-4 py-2 bg-blue-500 text-white rounded">
          Test Signup
        </button>
        <button onClick={testLogin} className="px-4 py-2 bg-green-500 text-white rounded">
          Test Login (admin@test.com)
        </button>
      </div>
    </div>
  )
}
