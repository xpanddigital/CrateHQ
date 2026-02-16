/**
 * Catalog Value Estimator — Simple Streams-Based Model
 * 
 * Formula: estimated_offer = streams_last_month × 0.076 × 2.8
 * - Base rate: $0.076 per stream
 * - Low estimate: streams_last_month × 0.05 × 2.8
 * - High estimate: streams_last_month × 0.12 × 2.8
 * - Platform multiplier: 2.8x (accounts for non-Spotify streaming revenue)
 * - Minimum threshold: $10,000
 * 
 * If streams_last_month is unavailable, derives from spotify_monthly_listeners × 2.5
 * 
 * Usage:
 *   import { estimateCatalogValue } from '@/lib/valuation/estimator'
 *   const result = estimateCatalogValue({ streams_last_month: 500000 })
 *   // { point_estimate: 106400, range_low: 70000, range_high: 168000, ... }
 */

export interface EstimateInput {
  streams_last_month: number
  streams_daily?: number
  track_count?: number
  spotify_monthly_listeners?: number
  instagram_followers?: number
  growth_yoy?: number
}

export interface EstimateResult {
  point_estimate: number
  range_low: number
  range_high: number
  display_range: string
  confidence: 'high' | 'medium' | 'low'
  qualifies: boolean
  display_text: string
}

const MIN_OFFER_THRESHOLD = 10_000
const RANGE_BUFFER = 0.25

/**
 * Platform multiplier: 2.8x
 * 
 * Spotify typically represents ~35% of total streaming revenue.
 * To estimate total catalog value across all platforms (Spotify, Apple Music, 
 * YouTube Music, Amazon Music, Tidal, etc.), we multiply Spotify-based estimates by ~2.8x.
 * 
 * This gives a more accurate picture of the artist's full catalog value.
 */
const PLATFORM_MULTIPLIER = 2.8

/**
 * Core estimation function.
 * 
 * Simple streams-based model:
 * - Base rate: $0.076 per stream
 * - Platform multiplier: 2.8x (to account for non-Spotify platforms)
 * - Formula: estimated_offer = streams_last_month × 0.076 × 2.8
 * - Low estimate: streams_last_month × 0.05 × 2.8
 * - High estimate: streams_last_month × 0.12 × 2.8
 * - Minimum threshold: $10,000
 */
export function estimateCatalogValue(input: EstimateInput): EstimateResult {
  let streams = input.streams_last_month || 0
  const listeners = input.spotify_monthly_listeners || 0

  // If streams_last_month is not available, derive from monthly listeners
  if (streams <= 0 && listeners > 0) {
    streams = listeners * 2.5
  }

  if (streams <= 0) {
    return {
      point_estimate: 0,
      range_low: 0,
      range_high: 0,
      display_range: 'N/A',
      confidence: 'low',
      qualifies: false,
      display_text: 'Insufficient streaming data for estimation.',
    }
  }

  // Simple streams-based calculation
  const baseRate = 0.076
  const lowRate = 0.05
  const highRate = 0.12

  // Apply platform multiplier to account for all streaming platforms
  const pointEstimate = Math.round(streams * baseRate * PLATFORM_MULTIPLIER / 100) * 100
  const rangeLow = Math.round(streams * lowRate * PLATFORM_MULTIPLIER / 100) * 100
  const rangeHigh = Math.round(streams * highRate * PLATFORM_MULTIPLIER / 100) * 100

  // Confidence scoring based on data quality
  let confidence: 'high' | 'medium' | 'low'
  if (input.streams_last_month > 0 && streams > 500_000) {
    confidence = 'high'
  } else if (input.streams_last_month > 0 && streams > 100_000) {
    confidence = 'medium'
  } else {
    confidence = 'low'
  }

  const qualifies = pointEstimate >= MIN_OFFER_THRESHOLD

  return {
    point_estimate: pointEstimate,
    range_low: rangeLow,
    range_high: rangeHigh,
    display_range: qualifies 
      ? `${formatCurrency(rangeLow)} — ${formatCurrency(rangeHigh)}`
      : 'Below threshold',
    confidence,
    qualifies,
    display_text: qualifies
      ? `Total estimated catalog value across all streaming platforms: ${formatCurrency(rangeLow)} — ${formatCurrency(rangeHigh)}. Artists with your profile typically qualify for catalog financing in this range.`
      : 'Based on current streaming data, this catalog does not meet minimum financing thresholds ($10K+).',
  }
}

/**
 * Batch estimate for multiple artists
 */
export function estimateBatch(artists: EstimateInput[]): EstimateResult[] {
  return artists.map(estimateCatalogValue)
}

/**
 * Filter to only qualified artists
 */
export function filterQualified(artists: EstimateInput[], minOffer?: number): (EstimateInput & EstimateResult)[] {
  const threshold = minOffer || MIN_OFFER_THRESHOLD
  return artists
    .map(a => ({ ...a, ...estimateCatalogValue(a) }))
    .filter(a => a.point_estimate >= threshold)
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`
  } else if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}K`
  }
  return `$${amount}`
}
