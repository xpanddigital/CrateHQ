'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Save, User, Bot, Link as LinkIcon, Mail, CheckCircle, XCircle, Loader2, Download } from 'lucide-react'
import { Profile } from '@/types/database'
import { SCOUT_PERSONAS } from '@/lib/ai/sdr'

export default function SettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    calendly_link: '',
    ai_sdr_persona: 'professional',
  })
  
  // Instantly integration
  const [instantlyKey, setInstantlyKey] = useState('')
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [connectionError, setConnectionError] = useState('')
  
  // Apify integration (read-only, configured via env vars)
  const [apifyConfigured, setApifyConfigured] = useState(false)
  const [testingApify, setTestingApify] = useState(false)
  const [apifyStatus, setApifyStatus] = useState<'idle' | 'success' | 'error'>('idle')

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (data) {
          setProfile(data)
          setFormData({
            full_name: data.full_name || '',
            phone: data.phone || '',
            calendly_link: data.calendly_link || '',
            ai_sdr_persona: data.ai_sdr_persona || 'professional',
          })
        }

        // Fetch Instantly integration
        const { data: integration } = await supabase
          .from('integrations')
          .select('*')
          .eq('user_id', user.id)
          .eq('service', 'instantly')
          .single()

        if (integration?.api_key) {
          setInstantlyKey(integration.api_key)
        }

        // Check if Apify is configured (server-side check)
        const apifyRes = await fetch('/api/integrations/check-apify')
        const apifyData = await apifyRes.json()
        setApifyConfigured(apifyData.configured || false)
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTestApify = async () => {
    setTestingApify(true)
    setApifyStatus('idle')

    try {
      const res = await fetch('/api/integrations/test-apify', {
        method: 'POST',
      })

      const data = await res.json()

      if (data.success) {
        setApifyStatus('success')
        setApifyConfigured(true)
      } else {
        setApifyStatus('error')
      }
    } catch (error) {
      setApifyStatus('error')
    } finally {
      setTestingApify(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          calendly_link: formData.calendly_link,
          ai_sdr_persona: formData.ai_sdr_persona,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) throw error

      router.refresh()
    } catch (error) {
      console.error('Error saving settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveInstantly = async () => {
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('integrations')
        .upsert({
          user_id: user.id,
          service: 'instantly',
          api_key: instantlyKey,
          is_active: true,
        })

      if (error) throw error
      setConnectionStatus('idle')
    } catch (error) {
      console.error('Error saving Instantly key:', error)
    }
  }

  const handleTestConnection = async () => {
    setTestingConnection(true)
    setConnectionStatus('idle')
    setConnectionError('')

    try {
      const res = await fetch('/api/integrations/test-instantly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: instantlyKey }),
      })

      const data = await res.json()

      if (data.success) {
        setConnectionStatus('success')
        await handleSaveInstantly()
      } else {
        setConnectionStatus('error')
        setConnectionError(data.error || 'Connection failed')
      }
    } catch (error: any) {
      setConnectionStatus('error')
      setConnectionError(error.message || 'Connection failed')
    } finally {
      setTestingConnection(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and AI SDR preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <CardTitle>Profile</CardTitle>
          </div>
          <CardDescription>
            Your personal information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={profile?.email || ''}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+1 (555) 123-4567"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            <CardTitle>Booking Link</CardTitle>
          </div>
          <CardDescription>
            Your Calendly or scheduling link for artist calls
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="calendly">Calendly Link</Label>
            <Input
              id="calendly"
              type="url"
              value={formData.calendly_link}
              onChange={(e) => setFormData({ ...formData, calendly_link: e.target.value })}
              placeholder="https://calendly.com/yourname/15min"
            />
            <p className="text-xs text-muted-foreground">
              This link will be included in AI-generated replies when appropriate
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            <CardTitle>AI SDR Persona</CardTitle>
          </div>
          <CardDescription>
            Choose how the AI assistant communicates on your behalf
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="persona">Communication Style</Label>
            <Select
              value={formData.ai_sdr_persona}
              onValueChange={(value) => setFormData({ ...formData, ai_sdr_persona: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SCOUT_PERSONAS).map(([key, description]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex flex-col items-start">
                      <span className="font-medium capitalize">
                        {key.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm font-medium mb-2 capitalize">
              {formData.ai_sdr_persona.replace('_', ' ')}
            </p>
            <p className="text-sm text-muted-foreground">
              {SCOUT_PERSONAS[formData.ai_sdr_persona]}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <CardTitle>Instantly.ai Integration</CardTitle>
          </div>
          <CardDescription>
            Connect your Instantly account for email outreach automation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="instantly">API Key</Label>
            <div className="flex gap-2">
              <Input
                id="instantly"
                type="password"
                value={instantlyKey}
                onChange={(e) => setInstantlyKey(e.target.value)}
                placeholder="Enter your Instantly API key"
                className="flex-1"
              />
              <Button
                onClick={handleTestConnection}
                disabled={!instantlyKey || testingConnection}
                variant="outline"
              >
                {testingConnection ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Test'
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Find your API key in Instantly Settings → API & Webhooks
            </p>
          </div>

          {connectionStatus === 'success' && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <p className="text-sm text-green-500">
                Connection successful! API key saved.
              </p>
            </div>
          )}

          {connectionStatus === 'error' && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">
                {connectionError}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {profile?.role === 'admin' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              <CardTitle>Apify Integration</CardTitle>
            </div>
            <CardDescription>
              Apify token is configured via environment variables (server-side)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm font-medium mb-2">Configuration</p>
              <p className="text-xs text-muted-foreground mb-3">
                Add APIFY_TOKEN to your .env.local file to enable scraping features
              </p>
              
              {apifyConfigured ? (
                <div className="flex items-center gap-2 text-green-500">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">Apify token is configured</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <XCircle className="h-4 w-4" />
                  <span className="text-sm">Apify token not found in environment</span>
                </div>
              )}
            </div>

            <Button
              onClick={handleTestApify}
              disabled={testingApify}
              variant="outline"
              className="w-full"
            >
              {testingApify ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </Button>

            {apifyStatus === 'success' && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <p className="text-sm text-green-500">
                  Apify connection successful!
                </p>
              </div>
            )}

            {apifyStatus === 'error' && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" />
                <p className="text-sm text-destructive">
                  Connection failed. Check your APIFY_TOKEN in .env.local
                </p>
              </div>
            )}

            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Default Actors:</strong></p>
              <p>• Discovery: VCXf9fqUpGHnOdeUV</p>
              <p>• Core Data: YZhD6hYc8daYSWXKs</p>
              <p>• Genres: (optional)</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
