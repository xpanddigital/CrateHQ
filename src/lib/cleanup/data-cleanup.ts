/**
 * Data Cleanup & Validation
 *
 * Identifies ghost rows (bio text fragments parsed as artists),
 * validates email format, and provides one-time cleanup utilities.
 */

import { checkEmailQuality } from '@/lib/qualification/email-filter'
import { extractBioEmails } from '@/lib/import/spotify-transformer'

// ─── Ghost Row Detection ─────────────────────────────────────────────

const SENTENCE_STARTERS = [
  'on the', 'in the', 'his ', 'her ', 'the principle', 'through it',
  'after ', 'from his', 'from her', 'success ', 'alongside', 'visit www',
  'he has', 'she has', 'biting', 'they have', 'with a', 'and the',
  'but the', 'for the', 'as a', 'it was', 'this is', 'that is',
  'which is', 'who is', 'where the', 'when the', 'while the',
]

export interface GhostCheckResult {
  isGhost: boolean
  reason: string | null
  confidence: 'high' | 'medium'
}

export function isGhostRow(row: {
  name?: string
  spotify_monthly_listeners?: number
  track_count?: number
  streams_last_month?: number
  instagram_url?: string | null
  spotify_url?: string | null
  youtube_url?: string | null
  facebook_url?: string | null
  twitter_url?: string | null
  website?: string | null
}): GhostCheckResult {
  const name = (row.name || '').trim()
  if (!name) return { isGhost: true, reason: 'Empty name', confidence: 'high' }

  const listeners = row.spotify_monthly_listeners || 0
  const tracks = row.track_count || 0
  const streams = row.streams_last_month || 0
  const hasSocials = !!(row.instagram_url || row.spotify_url || row.youtube_url || row.facebook_url || row.twitter_url || row.website)

  // High confidence: HTML entities in name
  if (/&#\d+;/.test(name)) {
    return { isGhost: true, reason: 'Name contains HTML entities', confidence: 'high' }
  }

  // High confidence: HTML tags in name
  if (/<a[\s>]|<\/a>|<[a-z]+\s/i.test(name)) {
    return { isGhost: true, reason: 'Name contains HTML tags', confidence: 'high' }
  }

  // High confidence: name > 80 chars
  if (name.length > 80) {
    return { isGhost: true, reason: `Name too long (${name.length} chars) — likely bio text`, confidence: 'high' }
  }

  // High confidence: trailing unbalanced quote
  if (name.endsWith('"') && !name.startsWith('"') && name.indexOf('"') === name.length - 1) {
    return { isGhost: true, reason: 'Trailing unbalanced quote — likely CSV parse artifact', confidence: 'high' }
  }

  // High confidence: zero data + no socials
  if (listeners === 0 && tracks === 0 && streams === 0 && !hasSocials) {
    return { isGhost: true, reason: 'No data and no social links — likely bio fragment', confidence: 'high' }
  }

  // Medium confidence: starts lowercase + 0 listeners
  if (/^[a-z]/.test(name) && listeners === 0) {
    return { isGhost: true, reason: 'Name starts lowercase with 0 listeners — likely sentence fragment', confidence: 'medium' }
  }

  // Medium confidence: starts with common sentence words + 0 listeners
  const nameLower = name.toLowerCase()
  if (listeners === 0) {
    for (const starter of SENTENCE_STARTERS) {
      if (nameLower.startsWith(starter)) {
        return { isGhost: true, reason: `Name starts with "${starter}" — likely bio text`, confidence: 'medium' }
      }
    }
  }

  return { isGhost: false, reason: null, confidence: 'high' }
}

// ─── Email Format Validation ─────────────────────────────────────────

const EMAIL_FORMAT_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

export function isValidEmailFormat(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed.includes(' ')) return false
  return EMAIL_FORMAT_REGEX.test(trimmed)
}

/**
 * Reject emails that are too short to be real.
 * e.g. e.b@c.com, n.k@c.com, ot@wm.com
 */
export function isEmailTooShort(email: string): boolean {
  const [local, domain] = email.toLowerCase().split('@')
  if (!local || !domain) return true

  // Local part <= 2 chars AND short domain (<=6 chars before TLD)
  const domainBase = domain.split('.')[0]
  if (local.replace(/\./g, '').length <= 2 && domainBase.length <= 4) return true

  // Total email under 8 chars
  if (email.length < 8) return true

  return false
}

/**
 * Full email validation: format + quality + length.
 * Returns { valid, reason } where reason explains rejection.
 */
export function validateEmail(email: string | null | undefined): { valid: boolean; reason: string | null } {
  if (!email) return { valid: false, reason: 'Empty email' }

  const trimmed = email.trim()

  if (!isValidEmailFormat(trimmed)) {
    return { valid: false, reason: 'Invalid email format (not an email address)' }
  }

  if (isEmailTooShort(trimmed)) {
    return { valid: false, reason: 'Email too short — likely garbage data' }
  }

  const quality = checkEmailQuality(trimmed)
  if (!quality.accepted) {
    return { valid: false, reason: quality.reason }
  }

  return { valid: true, reason: null }
}

// ─── Cleanup Results ─────────────────────────────────────────────────

export interface CleanupResult {
  ghostsDeleted: number
  ghostDetails: Array<{ id: string; name: string; reason: string }>
  invalidEmailsCleaned: number
  invalidEmailDetails: Array<{ id: string; name: string; email: string; reason: string }>
  junkEmailsCleaned: number
  junkEmailDetails: Array<{ id: string; name: string; email: string; reason: string }>
  bioEmailsExtracted: number
  bioEmailDetails: Array<{ id: string; name: string; emails: string[] }>
  totalArtistsScanned: number
}

/**
 * Run full cleanup on a set of artist records.
 * Returns categorized results — the caller is responsible for
 * executing the actual DB operations.
 */
export function analyzeArtistsForCleanup(artists: Array<{
  id: string
  name: string
  email: string | null
  is_contactable: boolean
  spotify_monthly_listeners: number
  track_count: number
  streams_last_month: number
  instagram_url: string | null
  spotify_url: string | null
  youtube_url: string | null
  facebook_url: string | null
  twitter_url: string | null
  website: string | null
  biography: string | null
  bio_emails: any | null
}>): CleanupResult {
  const result: CleanupResult = {
    ghostsDeleted: 0,
    ghostDetails: [],
    invalidEmailsCleaned: 0,
    invalidEmailDetails: [],
    junkEmailsCleaned: 0,
    junkEmailDetails: [],
    bioEmailsExtracted: 0,
    bioEmailDetails: [],
    totalArtistsScanned: artists.length,
  }

  for (const artist of artists) {
    // 1. Ghost row check
    const ghostCheck = isGhostRow(artist)
    if (ghostCheck.isGhost) {
      result.ghostsDeleted++
      result.ghostDetails.push({ id: artist.id, name: artist.name, reason: ghostCheck.reason || 'Unknown' })
      continue // Don't process further — will be deleted
    }

    // 2. Email format validation
    if (artist.email) {
      if (!isValidEmailFormat(artist.email)) {
        result.invalidEmailsCleaned++
        result.invalidEmailDetails.push({
          id: artist.id,
          name: artist.name,
          email: artist.email,
          reason: 'Not a valid email address',
        })
        continue
      }

      // 3. Junk email check (format is valid but email is junk)
      const emailCheck = validateEmail(artist.email)
      if (!emailCheck.valid) {
        result.junkEmailsCleaned++
        result.junkEmailDetails.push({
          id: artist.id,
          name: artist.name,
          email: artist.email,
          reason: emailCheck.reason || 'Failed quality check',
        })
        continue
      }
    }

    // 4. Bio email extraction (only for artists without email)
    if (!artist.email && artist.biography && (!artist.bio_emails || artist.bio_emails.length === 0)) {
      const bioResult = extractBioEmails(artist.biography)
      if (bioResult.emails.length > 0) {
        result.bioEmailsExtracted++
        result.bioEmailDetails.push({
          id: artist.id,
          name: artist.name,
          emails: bioResult.emails.map(e => e.email),
        })
      }
    }
  }

  return result
}
