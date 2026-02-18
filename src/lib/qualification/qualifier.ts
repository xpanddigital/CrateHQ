/**
 * Pre-Enrichment Qualification Filter
 *
 * Evaluates artists against deal qualification criteria BEFORE spending
 * money on enrichment API calls. Runs after valuation, before enrichment.
 *
 * Statuses:
 *   qualified     — ready for enrichment pipeline
 *   not_qualified — filtered out (too small, bad data, thin catalog)
 *   review        — needs manual check (very high value, valuation bug)
 *   pending       — not yet evaluated
 */

import { estimateCatalogValue } from '@/lib/valuation/estimator'

export type QualificationStatus = 'qualified' | 'not_qualified' | 'review' | 'pending'

export interface QualificationResult {
  status: QualificationStatus
  reason: string
}

export interface QualifiableArtist {
  id: string
  name: string
  estimated_offer: number | null
  estimated_offer_low: number | null
  estimated_offer_high: number | null
  spotify_monthly_listeners: number
  streams_last_month: number
  track_count: number
  qualification_manual_override?: boolean
}

const INVALID_NAMES = [
  'indie', 'various artists', 'unknown', 'test', 'n/a', 'na', 'none',
  'artist', 'unknown artist', 'va', 'tba', 'tbd',
]

/**
 * Evaluate a single artist's qualification status.
 * Returns the status and a human-readable reason.
 */
export function qualifyArtist(artist: QualifiableArtist): QualificationResult {
  const offer = artist.estimated_offer || 0
  const listeners = artist.spotify_monthly_listeners || 0
  const streams = artist.streams_last_month || 0
  const tracks = artist.track_count || 0
  const nameLower = (artist.name || '').trim().toLowerCase()

  // Rule 1: Invalid artist name
  if (INVALID_NAMES.includes(nameLower) || nameLower.length <= 1) {
    return { status: 'not_qualified', reason: 'Invalid artist name' }
  }

  // Rule 2: No data at all — likely a Spotify data artifact
  if (offer === 0 && listeners === 0 && streams === 0) {
    return { status: 'not_qualified', reason: 'No data - likely invalid artist' }
  }

  // Rule 3: Has real Spotify data but $0 offer — valuation bug
  if (offer === 0 && (listeners > 0 || streams > 0)) {
    return { status: 'review', reason: 'Valuation calculation failed - has real data' }
  }

  // Rule 4: Thin catalog
  if (tracks > 0 && tracks < 5) {
    return { status: 'not_qualified', reason: 'Insufficient catalog (fewer than 5 tracks)' }
  }

  // Rule 5: Below minimum threshold
  if (offer > 0 && offer < 10_000) {
    return { status: 'not_qualified', reason: 'Offer below $10K minimum' }
  }

  // Rule 6: Very high value — likely major artist
  if (offer > 1_000_000) {
    return { status: 'review', reason: 'Very high value - likely major artist, verify independently' }
  }

  // Rule 7: High value — needs verification
  if (offer > 500_000) {
    return { status: 'review', reason: 'High value - verify artist is reachable' }
  }

  // Rule 8: Sweet spot — auto-qualify
  if (offer >= 10_000 && offer <= 500_000 && tracks >= 5) {
    return { status: 'qualified', reason: 'Meets all qualification criteria' }
  }

  // Rule 9: Has offer but unknown track count (track_count = 0 means unknown, not zero)
  if (offer >= 10_000 && offer <= 500_000 && tracks === 0) {
    return { status: 'qualified', reason: 'Meets criteria (track count unknown)' }
  }

  // Fallback
  return { status: 'review', reason: 'Could not auto-classify - needs manual review' }
}

/**
 * Run valuation + qualification on a single artist, returning
 * the full set of fields to update in the database.
 */
export function valuateAndQualify(artist: QualifiableArtist): {
  estimated_offer: number
  estimated_offer_low: number
  estimated_offer_high: number
  qualification_status: QualificationStatus
  qualification_reason: string
  qualification_date: string
} {
  const valuation = estimateCatalogValue({
    streams_last_month: artist.streams_last_month || 0,
    track_count: artist.track_count || 0,
    spotify_monthly_listeners: artist.spotify_monthly_listeners || 0,
  })

  const artistWithOffer = {
    ...artist,
    estimated_offer: valuation.point_estimate,
    estimated_offer_low: valuation.range_low,
    estimated_offer_high: valuation.range_high,
  }

  const qualification = qualifyArtist(artistWithOffer)

  return {
    estimated_offer: valuation.point_estimate,
    estimated_offer_low: valuation.range_low,
    estimated_offer_high: valuation.range_high,
    qualification_status: qualification.status,
    qualification_reason: qualification.reason,
    qualification_date: new Date().toISOString(),
  }
}

/**
 * Batch qualify artists. Returns a summary of changes.
 */
export function qualifyBatch(artists: QualifiableArtist[]): {
  results: Array<{ id: string; status: QualificationStatus; reason: string }>
  summary: {
    qualified: number
    not_qualified: number
    review: number
    total: number
  }
} {
  const results = artists.map(artist => {
    const q = qualifyArtist(artist)
    return { id: artist.id, status: q.status, reason: q.reason }
  })

  return {
    results,
    summary: {
      qualified: results.filter(r => r.status === 'qualified').length,
      not_qualified: results.filter(r => r.status === 'not_qualified').length,
      review: results.filter(r => r.status === 'review').length,
      total: results.length,
    },
  }
}
