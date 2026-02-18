/**
 * Catalog Value Estimator v2 — Recalibrated on Real Run Music Offers
 * 
 * Fitted against 49 real ballpark offers from Run Music deal data.
 * 
 * Model: log-linear regression on streams_last_month
 *   offer = COEFFICIENT * streams_last_month ^ EXPONENT
 *   offer = 98.71 * streams ^ 0.4296
 * 
 * Accuracy on training data:
 *   - Median absolute error: 33%
 *   - Within ±50%: 69% of predictions (34/49)
 *   - Within ±30%: 41% of predictions (20/49)
 * 
 * The sub-linear exponent (0.43) captures real market behavior:
 *   - Doubling streams does NOT double the offer
 *   - Smaller catalogs get relatively higher per-stream valuations
 *   - Larger catalogs face volume discounts (risk concentration, mean reversion)
 * 
 * Usage:
 *   import { estimateCatalogValue } from '@/lib/valuation/estimator'
 *   const result = estimateCatalogValue({ streams_last_month: 500000, track_count: 40 })
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

// ---- MODEL COEFFICIENTS (fitted on 49 real Run Music offers) ----
const COEFFICIENT = 98.71       // intercept in exp space: e^4.592
const EXPONENT = 0.4296         // sub-linear: doubling streams ≈ +35% offer
const RANGE_LOW_MULT = 0.65     // low end of range
const RANGE_HIGH_MULT = 1.55    // high end of range
const MIN_OFFER_THRESHOLD = 10_000

/**
 * Core estimation function.
 * 
 * Model: offer = 98.71 × streams_last_month^0.4296
 * 
 * If streams_last_month is unavailable, falls back to:
 *   streams_last_month ≈ spotify_monthly_listeners × 2.5
 * 
 * Growth and track count adjustments are modest (±15% max)
 * because the real data shows these have weak correlation with offers.
 */
export function estimateCatalogValue(input: EstimateInput): EstimateResult {
  let streams = Math.max(input.streams_last_month || 0, 0)
  const tracks = Math.max(input.track_count || 1, 1)
  const listeners = input.spotify_monthly_listeners || 0
  const growthYoy = input.growth_yoy || 0

  // Fallback: derive streams from monthly listeners if missing
  if (streams <= 0 && listeners > 0) {
    streams = Math.round(listeners * 3.5)
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

  // ---- Core model: power-law fit ----
  let estimate = COEFFICIENT * Math.pow(streams, EXPONENT)

  // ---- Minor adjustments (data shows these have weak but nonzero effects) ----

  // Track count: slight bonus for deep catalogs (r=0.30 in log space)
  if (tracks >= 100) {
    estimate *= 1.10
  } else if (tracks >= 50) {
    estimate *= 1.05
  }

  // Growth: modest premium/discount (capped to prevent wild swings)
  if (growthYoy !== 0) {
    const growthAdj = Math.max(Math.min(growthYoy, 1.0), -0.5) * 0.10
    estimate *= (1 + growthAdj)
  }

  // ---- Round and build range ----
  const pointEstimate = Math.round(estimate / 100) * 100
  const rangeLow = Math.round(pointEstimate * RANGE_LOW_MULT / 100) * 100
  const rangeHigh = Math.round(pointEstimate * RANGE_HIGH_MULT / 100) * 100

  // ---- Confidence scoring ----
  let confidence: 'high' | 'medium' | 'low'
  if (streams > 500_000 && tracks > 20) {
    confidence = 'high'
  } else if (streams > 100_000 && tracks > 5) {
    confidence = 'medium'
  } else {
    confidence = 'low'
  }

  const qualifies = pointEstimate >= MIN_OFFER_THRESHOLD

  return {
    point_estimate: pointEstimate,
    range_low: rangeLow,
    range_high: rangeHigh,
    display_range: `${formatCurrency(rangeLow)} — ${formatCurrency(rangeHigh)}`,
    confidence,
    qualifies,
    display_text: qualifies
      ? `Estimated catalog value: ${formatCurrency(rangeLow)} — ${formatCurrency(rangeHigh)}`
      : 'Below minimum financing threshold ($10K).',
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
