import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  isGhostRow,
  validateEmail,
  isValidEmailFormat,
} from '@/lib/cleanup/data-cleanup'
import { extractBioEmails } from '@/lib/import/spotify-transformer'

/**
 * GET  — Dry-run: scan all artists and return what WOULD be cleaned.
 * POST — Execute cleanup: delete ghosts, clear bad emails, extract bio emails.
 */

const BATCH_SIZE = 1000

async function fetchAllArtists(supabase: any) {
  const allArtists: any[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('artists')
      .select('id, name, email, is_contactable, spotify_monthly_listeners, track_count, streams_last_month, instagram_url, spotify_url, youtube_url, facebook_url, twitter_url, website, biography, bio_emails, email_rejected, email_rejection_reason')
      .range(from, from + BATCH_SIZE - 1)

    if (error) throw error
    if (!data || data.length === 0) break
    allArtists.push(...data)
    if (data.length < BATCH_SIZE) break
    from += BATCH_SIZE
  }
  return allArtists
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const artists = await fetchAllArtists(supabase)

    const ghosts: Array<{ id: string; name: string; reason: string }> = []
    const invalidEmails: Array<{ id: string; name: string; email: string; reason: string }> = []
    const junkEmails: Array<{ id: string; name: string; email: string; reason: string }> = []
    const bioEmailCandidates: Array<{ id: string; name: string; emails: string[] }> = []

    for (const artist of artists) {
      const ghostCheck = isGhostRow(artist)
      if (ghostCheck.isGhost) {
        ghosts.push({ id: artist.id, name: artist.name, reason: ghostCheck.reason || 'Unknown' })
        continue
      }

      if (artist.email) {
        if (!isValidEmailFormat(artist.email)) {
          invalidEmails.push({ id: artist.id, name: artist.name, email: artist.email, reason: 'Not a valid email address' })
          continue
        }
        const emailCheck = validateEmail(artist.email)
        if (!emailCheck.valid) {
          junkEmails.push({ id: artist.id, name: artist.name, email: artist.email, reason: emailCheck.reason || 'Failed quality check' })
          continue
        }
      }

      if (!artist.email && artist.biography && (!artist.bio_emails || (Array.isArray(artist.bio_emails) && artist.bio_emails.length === 0))) {
        const bioResult = extractBioEmails(artist.biography)
        if (bioResult.emails.length > 0) {
          bioEmailCandidates.push({ id: artist.id, name: artist.name, emails: bioResult.emails.map(e => e.email) })
        }
      }
    }

    return NextResponse.json({
      dryRun: true,
      totalScanned: artists.length,
      ghosts: { count: ghosts.length, details: ghosts },
      invalidEmails: { count: invalidEmails.length, details: invalidEmails },
      junkEmails: { count: junkEmails.length, details: junkEmails },
      bioEmailCandidates: { count: bioEmailCandidates.length, details: bioEmailCandidates },
    })
  } catch (error: any) {
    console.error('[Cleanup] GET error:', error)
    return NextResponse.json({ error: error.message || 'Cleanup scan failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const skipGhosts = body.skipGhosts || false
    const skipEmails = body.skipEmails || false
    const skipBioExtraction = body.skipBioExtraction || false

    const artists = await fetchAllArtists(supabase)

    let ghostsDeleted = 0
    const ghostDetails: Array<{ id: string; name: string; reason: string }> = []
    let invalidEmailsCleaned = 0
    let junkEmailsCleaned = 0
    const emailCleanDetails: Array<{ id: string; name: string; email: string; reason: string }> = []
    let bioEmailsExtracted = 0
    const bioEmailDetails: Array<{ id: string; name: string; emails: string[] }> = []

    // Step 1: Delete ghost rows
    if (!skipGhosts) {
      const ghostIds: string[] = []
      for (const artist of artists) {
        const ghostCheck = isGhostRow(artist)
        if (ghostCheck.isGhost) {
          ghostIds.push(artist.id)
          ghostDetails.push({ id: artist.id, name: artist.name, reason: ghostCheck.reason || 'Unknown' })
        }
      }

      if (ghostIds.length > 0) {
        for (let i = 0; i < ghostIds.length; i += 100) {
          const chunk = ghostIds.slice(i, i + 100)
          const { error } = await supabase.from('artists').delete().in('id', chunk)
          if (error) console.error('[Cleanup] Ghost delete error:', error.message)
          else ghostsDeleted += chunk.length
        }
      }
    }

    // Build set of deleted IDs to skip in subsequent steps
    const deletedIds = new Set(ghostDetails.map(g => g.id))

    // Step 2 & 3: Clean invalid + junk emails
    if (!skipEmails) {
      for (const artist of artists) {
        if (deletedIds.has(artist.id)) continue
        if (!artist.email) continue

        let reason: string | null = null
        let isInvalid = false

        if (!isValidEmailFormat(artist.email)) {
          reason = 'Not a valid email address'
          isInvalid = true
          invalidEmailsCleaned++
        } else {
          const emailCheck = validateEmail(artist.email)
          if (!emailCheck.valid) {
            reason = emailCheck.reason
            isInvalid = false
            junkEmailsCleaned++
          }
        }

        if (reason) {
          emailCleanDetails.push({ id: artist.id, name: artist.name, email: artist.email, reason })

          const rejectedEmails = artist.email_rejected
            ? [{ email: artist.email, reason, cleaned_at: new Date().toISOString() }]
            : [{ email: artist.email, reason, cleaned_at: new Date().toISOString() }]

          await supabase.from('artists').update({
            email: null,
            email_source: null,
            email_confidence: 0,
            is_contactable: false,
            email_rejected: true,
            email_rejection_reason: reason,
            updated_at: new Date().toISOString(),
          }).eq('id', artist.id)
        }
      }
    }

    // Step 4: Extract bio emails for artists without email
    if (!skipBioExtraction) {
      for (const artist of artists) {
        if (deletedIds.has(artist.id)) continue
        // Skip artists who already have a valid email (unless it was just cleaned)
        const wasCleaned = emailCleanDetails.some(d => d.id === artist.id)
        if (artist.email && !wasCleaned) continue
        if (!artist.biography) continue

        const bioResult = extractBioEmails(artist.biography)
        if (bioResult.emails.length === 0) continue

        bioEmailsExtracted++
        bioEmailDetails.push({ id: artist.id, name: artist.name, emails: bioResult.emails.map(e => e.email) })

        const mgmt = bioResult.emails.find(e => e.type === 'management')
        const booking = bioResult.emails.find(e => e.type === 'booking')
        const best = mgmt || booking || bioResult.emails[0]

        const updateData: Record<string, any> = {
          bio_emails: bioResult.emails,
          updated_at: new Date().toISOString(),
        }

        // Set as primary email if artist has none
        updateData.email = best.email
        updateData.email_source = `spotify_biography_${best.type}`
        updateData.email_confidence = 0.95
        updateData.is_contactable = true
        updateData.email_rejected = false
        updateData.email_rejection_reason = null

        if (bioResult.managementCompany) updateData.management_company = bioResult.managementCompany
        if (bioResult.bookingAgency) updateData.booking_agency = bioResult.bookingAgency

        await supabase.from('artists').update(updateData).eq('id', artist.id)
      }
    }

    return NextResponse.json({
      success: true,
      totalScanned: artists.length,
      ghostsDeleted,
      ghostDetails,
      invalidEmailsCleaned,
      junkEmailsCleaned,
      emailCleanDetails,
      bioEmailsExtracted,
      bioEmailDetails,
    })
  } catch (error: any) {
    console.error('[Cleanup] POST error:', error)
    return NextResponse.json({ error: error.message || 'Cleanup failed' }, { status: 500 })
  }
}
