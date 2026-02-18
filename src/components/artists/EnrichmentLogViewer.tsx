'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, Clock, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface EnrichmentStep {
  method: string
  label: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped'
  emails_found: string[]
  rejected_emails?: Array<{ email: string; reason: string }>
  best_email: string
  confidence: number
  error?: string
  error_details?: string
  duration_ms?: number
  url_fetched?: string
  apify_used?: boolean
  apify_actor?: string
  was_blocked?: boolean
  content_length?: number
}

interface EnrichmentLog {
  id: string
  artist_id: string
  artist_name: string
  email_found: string | null
  email_confidence: number
  email_source: string
  all_emails: Array<{ email: string; source: string; confidence: number }>
  steps: EnrichmentStep[]
  total_duration_ms: number
  is_contactable: boolean
  error_details?: string
  created_at?: string
}

interface EnrichmentLogViewerProps {
  logs: EnrichmentLog[]
}

export function EnrichmentLogViewer({ logs }: EnrichmentLogViewerProps) {
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())

  const toggleExpand = (logId: string) => {
    const newExpanded = new Set(expandedLogs)
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId)
    } else {
      newExpanded.add(logId)
    }
    setExpandedLogs(newExpanded)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />
      case 'skipped':
        return <Clock className="h-4 w-4 text-muted-foreground" />
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      success: 'bg-green-500/10 text-green-500 border-green-500/20',
      failed: 'bg-destructive/10 text-destructive border-destructive/20',
      skipped: 'bg-muted text-muted-foreground border-muted',
      pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      running: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    }

    return (
      <Badge variant="outline" className={variants[status] || ''}>
        {status}
      </Badge>
    )
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No enrichment logs yet. Run enrichment to see detailed results here.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => {
        const logKey = log.id || log.artist_id
        const isExpanded = expandedLogs.has(logKey)
        const successSteps = (log.steps || []).filter(s => s.status === 'success').length
        const failedSteps = (log.steps || []).filter(s => s.status === 'failed').length

        return (
          <Card key={logKey}>
            <CardHeader 
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => toggleExpand(logKey)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <CardTitle className="text-base">{log.artist_name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      {log.is_contactable ? (
                        <>
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          <span className="text-xs text-green-500 font-medium">
                            Email found: {log.email_found}
                          </span>
                        </>
                      ) : log.error_details?.includes('Rejected emails:') ? (
                        <>
                          <AlertCircle className="h-3 w-3 text-yellow-500" />
                          <span className="text-xs text-yellow-500">
                            Emails found but rejected (junk)
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            No email found
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right mr-2">
                    <p className="text-xs text-muted-foreground">
                      {successSteps} success / {failedSteps} failed
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(log.total_duration_ms / 1000).toFixed(1)}s
                    </p>
                  </div>
                  {log.is_contactable && (
                    <Badge variant="outline" className="bg-green-500/10 text-green-500">
                      {(log.email_confidence * 100).toFixed(0)}% confidence
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="space-y-3 pt-0">
                {/* Summary */}
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-muted-foreground text-xs">Email Found</p>
                      <p className="font-medium">{log.email_found || 'None'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Source</p>
                      <p className="font-medium">{log.email_source || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Confidence</p>
                      <p className="font-medium">{(log.email_confidence * 100).toFixed(0)}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Total Emails</p>
                      <p className="font-medium">{log.all_emails.length}</p>
                    </div>
                  </div>
                </div>

                {/* Error Details (top-level) */}
                {log.error_details && (
                  <details className="text-xs">
                    <summary className="text-destructive cursor-pointer font-medium">
                      Apify Error Details (all steps)
                    </summary>
                    <pre className="mt-1 p-2 bg-destructive/5 border border-destructive/20 rounded text-[10px] leading-tight overflow-x-auto whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                      {log.error_details}
                    </pre>
                  </details>
                )}

                {/* All Emails Found */}
                {(log.all_emails || []).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">All Emails Found:</p>
                    {(log.all_emails || []).map((email, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1.5">
                        <span className="font-mono">{email.email}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{email.source}</span>
                          <Badge variant="outline" className="text-xs">
                            {(email.confidence * 100).toFixed(0)}%
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Step-by-Step Results */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Enrichment Steps:</p>
                  {(log.steps || []).map((step, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "border rounded-lg p-3 space-y-2",
                        step.status === 'success' && "border-green-500/20 bg-green-500/5",
                        step.status === 'failed' && "border-destructive/20 bg-destructive/5",
                        step.status === 'skipped' && "border-muted bg-muted/20"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(step.status)}
                          <span className="text-sm font-medium">{step.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(step.status)}
                          {step.duration_ms && (
                            <span className="text-xs text-muted-foreground">
                              {(step.duration_ms / 1000).toFixed(1)}s
                            </span>
                          )}
                        </div>
                      </div>

                      {step.status === 'success' && step.emails_found.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">
                            Found {step.emails_found.length} email(s):
                          </p>
                          {step.emails_found.map((email, emailIdx) => (
                            <div key={emailIdx} className="flex items-center gap-2">
                              <span className="text-xs font-mono bg-background px-2 py-0.5 rounded">
                                {email}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {(step.confidence * 100).toFixed(0)}% confidence
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Rejected emails */}
                      {step.rejected_emails && step.rejected_emails.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs text-destructive font-medium">
                            Rejected {step.rejected_emails.length} email(s):
                          </p>
                          {step.rejected_emails.map((r, rIdx) => (
                            <div key={rIdx} className="flex items-center gap-2">
                              <span className="text-xs font-mono bg-destructive/10 text-destructive px-2 py-0.5 rounded line-through">
                                {r.email}
                              </span>
                              <span className="text-xs text-destructive/70">{r.reason}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Actor + fetch details */}
                      {(step.apify_actor || step.url_fetched || step.content_length) && (
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {step.apify_actor && step.apify_actor !== 'skipped' && (
                            <span>Actor: <span className="font-mono">{step.apify_actor}</span></span>
                          )}
                          {step.url_fetched && (
                            <span className="truncate max-w-[300px]">URL: {step.url_fetched}</span>
                          )}
                          {step.content_length !== undefined && step.content_length > 0 && (
                            <span>{step.content_length.toLocaleString()} chars</span>
                          )}
                        </div>
                      )}

                      {step.status === 'failed' && (
                        <div className="text-xs text-muted-foreground">
                          {step.error || 'No emails found in this step'}
                        </div>
                      )}

                      {step.error_details && (
                        <details className="text-xs">
                          <summary className="text-destructive cursor-pointer font-medium">
                            Apify Raw Error Details
                          </summary>
                          <pre className="mt-1 p-2 bg-muted rounded text-[10px] leading-tight overflow-x-auto whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                            {step.error_details}
                          </pre>
                        </details>
                      )}

                      {step.status === 'skipped' && (
                        <div className="text-xs text-muted-foreground">
                          {step.method === 'facebook_about' ? 'Skipped — Facebook requires login'
                            : step.method === 'remaining_socials' ? 'Skipped — platforms block scraping'
                            : step.method === 'youtube_about' ? 'Skipped — no YouTube URL available'
                            : step.method === 'perplexity_yt_deep_dive' ? 'Skipped (email already found or no YouTube URL)'
                            : step.method === 'perplexity_ig_deep_dive' ? 'Skipped (email already found or no Instagram URL)'
                            : step.method === 'perplexity_search' ? 'Skipped (email already found)'
                            : 'Skipped (email already found in previous step)'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}
