/**
 * Shared enrichment logic — runs the pipeline for one artist, applies
 * email quality filters, saves results to the artist record and enrichment logs.
 *
 * Called from:
 *   - POST /api/artists/[id]/enrich (manual, browser-triggered)
 *   - GET  /api/enrichment/process-queue (cron worker, server-side)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { enrichArtist } from './pipeline'
import { checkEmailQuality } from '@/lib/qualification/email-filter'

interface EnrichAndSaveOptions {
  supabase: SupabaseClient
  artist: any
  runBy?: string
}

export async function enrichAndSave({ supabase, artist, runBy }: EnrichAndSaveOptions) {
  console.log(`[Enrich] Starting for: ${artist.name} (${artist.id})`)

  const apiKeys = { anthropic: process.env.ANTHROPIC_API_KEY }
  const result = await enrichArtist(artist, apiKeys)

  console.log(`[Enrich] Complete. Email found:`, result.email_found || 'None')

  // Email quality check
  let emailRejected = false
  let emailRejectionReason: string | null = null

  if (result.email_found) {
    const quality = checkEmailQuality(result.email_found)
    if (!quality.accepted) {
      console.log(`[Enrich] Email rejected: ${result.email_found} — ${quality.reason}`)
      emailRejected = true
      emailRejectionReason = quality.reason
      result.is_contactable = false
    }
  }

  // Build artist update
  const updateData: any = {
    email: emailRejected ? null : result.email_found,
    email_confidence: result.email_confidence,
    email_source: result.email_source,
    all_emails_found: result.all_emails,
    is_enriched: true,
    is_contactable: emailRejected ? false : result.is_contactable,
    last_enriched_at: new Date().toISOString(),
    enrichment_attempts: (artist.enrichment_attempts || 0) + 1,
    updated_at: new Date().toISOString(),
    email_rejected: emailRejected,
    email_rejection_reason: emailRejected ? `${emailRejectionReason} (${result.email_found})` : null,
  }

  // Save discovered social links
  const currentLinks = artist.social_links || {}
  let linksUpdated = false

  if (result.discovered_youtube_url) {
    if (!currentLinks.youtube && !currentLinks.youtube_url) {
      currentLinks.youtube = result.discovered_youtube_url
      linksUpdated = true
    }
  }
  if (result.discovered_linktree_url) {
    if (!currentLinks.linktree && !currentLinks.linktree_url) {
      currentLinks.linktree = result.discovered_linktree_url
      linksUpdated = true
    }
  }
  if (linksUpdated) {
    updateData.social_links = currentLinks
  }

  // Save bonus data
  if (result.discovered_website && !artist.website) {
    updateData.website = result.discovered_website
  }
  if (result.discovered_management) {
    updateData.management_company = result.discovered_management
  }
  if (result.discovered_booking_agent) {
    updateData.booking_agency = result.discovered_booking_agent
  }

  // Update artist
  const { error: updateError } = await supabase
    .from('artists')
    .update(updateData)
    .eq('id', artist.id)

  if (updateError) {
    console.error(`[Enrich] Failed to update artist ${artist.id}:`, updateError.message)
  }

  // Build error details
  let errorDetails = result.error_details || ''
  if (result.all_rejected_emails && result.all_rejected_emails.length > 0) {
    const rejectedSummary = result.all_rejected_emails
      .map((r: any) => `${r.email} (${r.reason})`)
      .join('; ')
    errorDetails = errorDetails
      ? `${errorDetails} | Rejected emails: ${rejectedSummary}`
      : `Rejected emails: ${rejectedSummary}`
  }

  // Save enrichment log
  // run_by is TEXT — pass user UUID for manual runs, 'cron-worker' for server-side
  const { error: logError } = await supabase
    .from('enrichment_logs')
    .insert({
      artist_id: artist.id,
      artist_name: artist.name,
      email_found: emailRejected ? null : result.email_found,
      email_confidence: result.email_confidence,
      email_source: result.email_source || '',
      all_emails: result.all_emails || [],
      steps: result.steps || [],
      total_duration_ms: result.total_duration_ms,
      is_contactable: emailRejected ? false : result.is_contactable,
      run_by: runBy || null,
      error_details: errorDetails || null,
    })

  if (logError) {
    console.error(`[Enrich] Failed to save log:`, logError.message, logError)
  }

  return {
    ...result,
    email_found: emailRejected ? null : result.email_found,
    is_contactable: emailRejected ? false : result.is_contactable,
    emailRejected,
  }
}
