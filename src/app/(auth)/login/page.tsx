'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const supabase = createClient()
      
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      })

      if (signInError) {
        console.error('Supabase error:', signInError)
        setError(signInError.message)
        setLoading(false)
        return
      }

      if (data.user) {
        // Success - redirect
        window.location.href = '/dashboard'
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'Login failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="text-5xl md:text-6xl text-white font-[var(--font-heading)] italic tracking-tight">
            flank
          </div>
          <p className="text-[14px] text-[rgba(255,255,255,0.42)] font-[var(--font-body)]">
            Outreach infrastructure for the social era
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md text-sm">
              <p className="font-semibold mb-1">Error:</p>
              <p>{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-[rgba(255,255,255,0.42)]">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
                className="bg-transparent border border-[rgba(255,255,255,0.10)] text-white font-[var(--font-body)] font-light placeholder:text-[rgba(255,255,255,0.18)] focus-visible:ring-0 focus-visible:border-[#e8ff47]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs text-[rgba(255,255,255,0.42)]">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="current-password"
                className="bg-transparent border border-[rgba(255,255,255,0.10)] text-white font-[var(--font-body)] font-light placeholder:text-[rgba(255,255,255,0.18)] focus-visible:ring-0 focus-visible:border-[#e8ff47]"
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-white text-black hover:bg-[#e8ff47] hover:text-black rounded-md py-2.5 text-[12px] tracking-[0.12em] uppercase font-[var(--font-body)] font-normal"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>

          <p className="text-sm text-[rgba(255,255,255,0.42)] text-center">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-white hover:text-[#e8ff47] underline-offset-4 hover:underline">
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
