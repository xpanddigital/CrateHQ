'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Sparkles, CheckCircle, XCircle, Clock, Youtube, Share2, Instagram, Globe, Facebook, SkipForward, Search, Radar } from 'lucide-react'
import type { EnrichmentStep as PipelineStep } from '@/lib/enrichment/pipeline'

interface EnrichmentPanelProps {
  artistId: string
  onEnrichmentComplete: () => void
}

export function EnrichmentPanel({ artistId, onEnrichmentComplete }: EnrichmentPanelProps) {
  const [enriching, setEnriching] = useState(false)
  const [steps, setSteps] = useState<PipelineStep[]>([])
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const getStepIcon = (method: string) => {
    switch (method) {
      case 'youtube_discovery':
        return <Search className="h-4 w-4" />
      case 'youtube_about':
        return <Youtube className="h-4 w-4" />
      case 'instagram_bio':
        return <Instagram className="h-4 w-4" />
      case 'link_in_bio':
        return <Share2 className="h-4 w-4" />
      case 'website_contact':
        return <Globe className="h-4 w-4" />
      case 'facebook_about':
        return <Facebook className="h-4 w-4" />
      case 'remaining_socials':
        return <SkipForward className="h-4 w-4" />
      case 'perplexity_yt_deep_dive':
        return <Radar className="h-4 w-4" />
      case 'perplexity_search':
        return <Radar className="h-4 w-4" />
      default:
        return <Sparkles className="h-4 w-4" />
    }
  }

  const handleEnrich = async () => {
    setEnriching(true)
    setError('')
    setResult(null)
    
    // Initialize steps matching the pipeline
    const initialSteps: PipelineStep[] = [
      { method: 'youtube_discovery', label: 'YouTube Discovery (Data API + Haiku)', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
      { method: 'youtube_about', label: 'YouTube Email Extraction (Apify scraper)', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
      { method: 'instagram_bio', label: 'Instagram (apify~instagram-profile-scraper)', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
      { method: 'link_in_bio', label: 'Link-in-Bio (direct fetch / crawler)', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
      { method: 'website_contact', label: 'Artist Website (direct fetch / crawler)', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
      { method: 'facebook_about', label: 'Facebook (skipped)', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
      { method: 'remaining_socials', label: 'Remaining Socials (skipped)', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
      { method: 'perplexity_yt_deep_dive', label: 'Perplexity YouTube Deep Dive', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
      { method: 'perplexity_search', label: 'Perplexity Generic Web Search', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
    ]
    setSteps(initialSteps)

    try {
      const res = await fetch(`/api/artists/${artistId}/enrich`, {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Enrichment failed')
      }

      const data = await res.json()
      setResult(data)

      // Update steps with actual results
      if (data.steps) {
        setSteps(data.steps)
      }

      onEnrichmentComplete()
    } catch (err: any) {
      setError(err.message || 'Enrichment failed')
      setSteps(steps.map(s => s.status === 'running' ? { ...s, status: 'failed' as const } : s))
    } finally {
      setEnriching(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'skipped':
        return <Clock className="h-4 w-4 text-muted-foreground" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Email Enrichment</CardTitle>
          <Button
            onClick={handleEnrich}
            disabled={enriching}
            size="sm"
          >
            {enriching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enriching...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Enrich
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {steps.length > 0 && (
          <div className="space-y-2">
            {steps.map((step, index) => (
              <div
                key={step.method}
                className="flex items-start justify-between p-3 rounded-lg border"
              >
                <div className="flex items-start gap-3 flex-1">
                  <div className="flex items-center gap-2 mt-0.5">
                    {getStepIcon(step.method)}
                    {getStatusIcon(step.status)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{step.label}</p>
                    {step.status === 'success' && step.emails_found.length > 0 && (
                      <div className="mt-1 space-y-1">
                        {step.emails_found.slice(0, 2).map((email, i) => (
                          <p key={i} className="text-xs text-green-600 font-mono">
                            {email}
                          </p>
                        ))}
                        {step.confidence > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {(step.confidence * 100).toFixed(0)}% confidence
                          </p>
                        )}
                      </div>
                    )}
                    {step.apify_actor && step.apify_actor !== 'skipped' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Actor: {step.apify_actor}
                      </p>
                    )}
                    {step.error && (
                      <p className="text-xs text-red-500 mt-1">{step.error}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {step.status === 'success' && (
                    <Badge variant="outline" className="text-green-500 border-green-500">
                      {step.emails_found.length} found
                    </Badge>
                  )}
                  {step.status === 'skipped' && (
                    <Badge variant="outline" className="text-muted-foreground">
                      Skipped
                    </Badge>
                  )}
                  {step.duration_ms && (
                    <span className="text-xs text-muted-foreground">
                      {(step.duration_ms / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {result && result.email_found && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-green-500 mb-1">Email Found!</p>
                <p className="text-sm mb-2">{result.email_found}</p>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span>Source: {result.email_source}</span>
                  <span>•</span>
                  <span>Confidence: {(result.email_confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {result && !result.email_found && (
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <XCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No email found. Try adding more social links or website information.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
