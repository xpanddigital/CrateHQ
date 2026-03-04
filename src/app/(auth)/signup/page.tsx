'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SignupPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const supabase = createClient()
      
      // First, try to sign up
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            full_name: fullName,
            role: 'admin',
          },
        },
      })

      if (signUpError) {
        throw signUpError
      }

      if (!signUpData.user) {
        throw new Error('No user returned from signup')
      }

      // Check if we got a session (auto-login)
      if (signUpData.session) {
        setSuccess('Account created successfully! Redirecting...')
        setTimeout(() => {
          window.location.href = '/dashboard'
        }, 1000)
      } else {
        // Email confirmation required
        setSuccess('Account created! Check your email to confirm, then login.')
        setTimeout(() => {
          window.location.href = '/login'
        }, 3000)
      }
    } catch (err: any) {
      console.error('Signup error:', err)
      setError(err.message || 'Signup failed')
    } finally {
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

        <form onSubmit={handleSignup} className="space-y-6">
          {error && (
            <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md text-sm">
              <p className="font-semibold">Error:</p>
              <p>{error}</p>
              <p className="text-xs mt-2">Try using a different email or check Supabase settings.</p>
            </div>
          )}
          {success && (
            <div className="bg-green-500/15 text-green-500 px-4 py-3 rounded-md text-sm">
              <p className="font-semibold">Success!</p>
              <p>{success}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="text-xs text-[rgba(255,255,255,0.42)]">
                Full Name
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={loading}
                className="bg-transparent border border-[rgba(255,255,255,0.10)] text-white font-[var(--font-body)] font-light placeholder:text-[rgba(255,255,255,0.18)] focus-visible:ring-0 focus-visible:border-[#e8ff47]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-[rgba(255,255,255,0.42)]">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@test.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
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
                minLength={6}
                className="bg-transparent border border-[rgba(255,255,255,0.10)] text-white font-[var(--font-body)] font-light placeholder:text-[rgba(255,255,255,0.18)] focus-visible:ring-0 focus-visible:border-[#e8ff47]"
              />
              <p className="text-xs text-[rgba(255,255,255,0.42)]">
                At least 6 characters
              </p>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-white text-black hover:bg-[#e8ff47] hover:text-black rounded-md py-2.5 text-[12px] tracking-[0.12em] uppercase font-[var(--font-body)] font-normal"
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Create account'}
          </Button>

          <p className="text-sm text-[rgba(255,255,255,0.42)] text-center">
            Already have an account?{' '}
            <Link href="/login" className="text-white hover:text-[#e8ff47] underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
