/**
 * Auto-detecting CSV import transformer.
 *
 * Detects whether the uploaded file is:
 *   Format A — Raw Spotify Play Counter (Apify) export
 *   Format B — Existing CrateHQ format
 *
 * Transforms Format A into the CrateHQ schema, extracts emails from
 * biographies, and returns a unified array ready for Supabase insert.
 */

import Papa from 'papaparse'
import { checkEmailQuality } from '@/lib/qualification/email-filter'
import { isGhostRow, isValidEmailFormat } from '@/lib/cleanup/data-cleanup'

// ─── Format Detection ────────────────────────────────────────────────

export type ImportFormat = 'spotify_raw' | 'cratehq' | 'unknown'

const SPOTIFY_RAW_MARKERS = ['monthlyListeners', 'externalLinks/0/label', 'topTracks/0/streamCount', 'biography']
const CRATEHQ_MARKERS = ['spotify_monthly_listeners', 'track_count']

export function detectFormat(headers: string[]): ImportFormat {
  const lower = headers.map(h => h.trim())

  const spotifyHits = SPOTIFY_RAW_MARKERS.filter(m => lower.includes(m)).length
  if (spotifyHits >= 2) return 'spotify_raw'

  const crateHits = CRATEHQ_MARKERS.filter(m => lower.includes(m)).length
  if (crateHits >= 1) return 'cratehq'

  // Fallback: if it has 'name' and 'monthly_listeners' or similar, treat as CrateHQ
  if (lower.includes('name') || lower.includes('artist_name')) return 'cratehq'

  return 'unknown'
}

// ─── Smart CSV/TSV Parsing ───────────────────────────────────────────

/**
 * Parses a CSV or TSV string using Papa Parse. Correctly handles
 * quoted multi-line fields (e.g. biography columns with newlines).
 */
export function parseDelimitedText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  })

  const headers = result.meta.fields || []
  const rows = result.data.filter(row => {
    // Skip completely empty rows
    return Object.values(row).some(v => v && v.trim() !== '')
  })

  return { headers, rows }
}

// ─── Biography Email Extraction ──────────────────────────────────────

export interface BioEmail {
  email: string
  type: 'management' | 'booking' | 'press' | 'bio'
  context: string
}

/**
 * Extracts emails from a Spotify biography, categorizes them by type
 * based on surrounding text, and runs quality filters.
 */
export function extractBioEmails(biography: string | null | undefined): {
  emails: BioEmail[]
  managementCompany: string | null
  bookingAgency: string | null
} {
  if (!biography) return { emails: [], managementCompany: null, bookingAgency: null }

  // Decode HTML entities (&#64; → @, etc.)
  let bio = biography
    .replace(/&#64;/g, '@')
    .replace(/&#46;/g, '.')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const rawEmails = bio.match(emailRegex) || []

  if (rawEmails.length === 0) return { emails: [], managementCompany: null, bookingAgency: null }

  const emails: BioEmail[] = []
  let managementCompany: string | null = null
  let bookingAgency: string | null = null

  for (const email of rawEmails) {
    const quality = checkEmailQuality(email)
    if (!quality.accepted) continue

    // Determine type from surrounding text
    const emailIdx = bio.toLowerCase().indexOf(email.toLowerCase())
    const contextStart = Math.max(0, emailIdx - 200)
    const context = bio.slice(contextStart, emailIdx).toLowerCase()

    let type: BioEmail['type'] = 'bio'
    if (/manag(ement|er|ing)/i.test(context)) {
      type = 'management'
    } else if (/book(ing|ed|ings)/i.test(context)) {
      type = 'booking'
    } else if (/press|pr\b|media/i.test(context)) {
      type = 'press'
    }

    emails.push({ email, type, context: context.slice(-80).trim() })
  }

  // Try to extract management company name
  const mgmtMatch = bio.match(/(?:management|mgmt|managed by)[:\s]*([^\n@]+?)(?:\n|$)/i)
  if (mgmtMatch) {
    managementCompany = mgmtMatch[1].trim().replace(/[.,:;]+$/, '').trim()
    if (managementCompany.length > 100 || managementCompany.length < 3) managementCompany = null
  }

  // Try to extract booking agency name
  const bookingMatch = bio.match(/(?:booking|booked by|bookings)[:\s]*([^\n@]+?)(?:\n|$)/i)
  if (bookingMatch) {
    bookingAgency = bookingMatch[1].trim().replace(/[.,:;]+$/, '').trim()
    if (bookingAgency.length > 100 || bookingAgency.length < 3) bookingAgency = null
  }

  return { emails, managementCompany, bookingAgency }
}

// ─── Spotify Raw → CrateHQ Transform ────────────────────────────────

export interface TransformedArtist {
  name: string
  email: string | null
  email_source: string | null
  email_confidence: number
  instagram_handle: string | null
  instagram_url: string | null
  instagram_followers: number
  website: string | null
  spotify_url: string | null
  spotify_id: string | null
  spotify_monthly_listeners: number
  spotify_followers: number
  spotify_verified: boolean
  streams_last_month: number
  streams_estimated: boolean
  total_top_track_streams: number
  track_count: number
  genres: string[]
  country: string | null
  biography: string | null
  bio_emails: BioEmail[] | null
  management_company: string | null
  booking_agency: string | null
  social_links: Record<string, string>
  facebook_url: string | null
  twitter_url: string | null
  tiktok_url: string | null
  youtube_url: string | null
  wikipedia_url: string | null
  world_rank: number
  cover_art_url: string | null
  latest_release_date: string | null
  latest_release_name: string | null
  top_cities: Array<{ city: string; country: string; listeners: number }> | null
  import_format: string
  is_contactable: boolean
}

function parseNum(val: string | undefined | null): number {
  if (!val) return 0
  return parseInt(String(val).replace(/,/g, '').replace(/\s/g, '')) || 0
}

export function transformSpotifyRaw(row: Record<string, string>): TransformedArtist {
  const name = row['name'] || ''

  // External links → social URLs
  const socialLinks: Record<string, string> = {}
  let instagramUrl: string | null = null
  let facebookUrl: string | null = null
  let twitterUrl: string | null = null
  let tiktokUrl: string | null = null
  let wikipediaUrl: string | null = null

  for (let i = 0; i <= 5; i++) {
    const label = (row[`externalLinks/${i}/label`] || '').toLowerCase()
    const url = row[`externalLinks/${i}/url`] || ''
    if (!label || !url) continue

    if (label === 'instagram') { instagramUrl = url; socialLinks.instagram = url }
    if (label === 'facebook') { facebookUrl = url; socialLinks.facebook = url }
    if (label === 'twitter') { twitterUrl = url; socialLinks.twitter = url }
    if (label === 'tiktok') { tiktokUrl = url; socialLinks.tiktok = url }
    if (label === 'wikipedia') { wikipediaUrl = url; socialLinks.wikipedia = url }
  }

  // Spotify URL
  const spotifyUrl = row['_url'] || row['url'] || null
  const spotifyId = row['id'] || null
  if (spotifyUrl) socialLinks.spotify = spotifyUrl

  // Track count (albums + singles)
  let trackCount = 0
  for (let i = 0; i <= 9; i++) {
    if (row[`albums/${i}/id`]) trackCount++
    if (row[`singles/${i}/id`]) trackCount++
  }

  // Total streams from top 10 tracks
  let totalStreams = 0
  for (let i = 0; i <= 9; i++) {
    totalStreams += parseNum(row[`topTracks/${i}/streamCount`])
  }

  const monthlyListenersRaw = parseNum(row['monthlyListeners'])
  let streamsEstimatedRaw = false
  if (totalStreams === 0 && monthlyListenersRaw > 0) {
    totalStreams = Math.round(monthlyListenersRaw * 3.5)
    streamsEstimatedRaw = true
  }

  // Top cities
  const topCities: Array<{ city: string; country: string; listeners: number }> = []
  for (let i = 0; i <= 4; i++) {
    const city = row[`topCities/${i}/city`]
    const country = row[`topCities/${i}/country`]
    const listeners = parseNum(row[`topCities/${i}/numberOfListeners`])
    if (city) topCities.push({ city, country: country || '', listeners })
  }

  // Latest release
  const latestDate = row['latest/releaseDate'] || null
  const latestName = row['latest/name'] || null

  // Cover art (first/largest)
  const coverArt = row['coverArt/0/url'] || null

  // Instagram handle from URL
  let instagramHandle: string | null = null
  if (instagramUrl) {
    const match = instagramUrl.match(/instagram\.com\/([^/?]+)/)
    if (match) instagramHandle = match[1]
  }

  // Biography email extraction
  const biography = row['biography'] || null
  const bioResult = extractBioEmails(biography)

  // Pick best email from bio
  let primaryEmail: string | null = null
  let emailSource: string | null = null
  let emailConfidence = 0

  if (bioResult.emails.length > 0) {
    // Prefer management/booking emails
    const mgmt = bioResult.emails.find(e => e.type === 'management')
    const booking = bioResult.emails.find(e => e.type === 'booking')
    const best = mgmt || booking || bioResult.emails[0]
    primaryEmail = best.email
    emailSource = `spotify_biography_${best.type}`
    emailConfidence = 0.95
  }

  return {
    name,
    email: primaryEmail,
    email_source: emailSource,
    email_confidence: emailConfidence,
    instagram_handle: instagramHandle,
    instagram_url: instagramUrl,
    instagram_followers: 0,
    website: null,
    spotify_url: spotifyUrl,
    spotify_id: spotifyId,
    spotify_monthly_listeners: monthlyListenersRaw,
    spotify_followers: parseNum(row['followers']),
    spotify_verified: row['verified']?.toLowerCase() === 'true',
    streams_last_month: totalStreams,
    streams_estimated: streamsEstimatedRaw,
    total_top_track_streams: totalStreams,
    track_count: trackCount,
    genres: [],
    country: null,
    biography,
    bio_emails: bioResult.emails.length > 0 ? bioResult.emails : null,
    management_company: bioResult.managementCompany,
    booking_agency: bioResult.bookingAgency,
    social_links: socialLinks,
    facebook_url: facebookUrl,
    twitter_url: twitterUrl,
    tiktok_url: tiktokUrl,
    youtube_url: null,
    wikipedia_url: wikipediaUrl,
    world_rank: parseNum(row['worldRank']),
    cover_art_url: coverArt,
    latest_release_date: latestDate,
    latest_release_name: latestName,
    top_cities: topCities.length > 0 ? topCities : null,
    import_format: 'spotify_raw',
    is_contactable: !!primaryEmail,
  }
}

// ─── CrateHQ / ChatGPT-Formatted CSV → Transform ────────────────────

/**
 * Transforms a row from a CrateHQ-format or ChatGPT-reformatted CSV.
 * Handles broad column name aliases and runs bio email extraction.
 */
export function transformCrateHQ(row: Record<string, string>): TransformedArtist {
  // Helper: get first non-empty value from multiple possible column names
  const get = (...keys: string[]): string => {
    for (const k of keys) {
      const val = row[k]?.trim()
      if (val) return val
    }
    return ''
  }

  const name = get('name', 'artist_name', 'artist')

  // Streams: priority order for streams_last_month
  const streamsLastMonth = parseNum(get('streams_last_month', 'streams last month', 'last_month_streams', 'monthly_streams'))
  const streamsGeneric = parseNum(get('streams', 'est_streams_month'))
  const monthlyListeners = parseNum(get('spotify_monthly_listeners', 'monthly_listeners', 'listeners', 'monthly listeners', 'spotify_monthly_listners'))

  // Use best available streams value; fall back to rough estimate from listeners
  let finalStreams = streamsLastMonth || streamsGeneric || 0
  let streamsEstimated = false
  if (finalStreams === 0 && monthlyListeners > 0) {
    finalStreams = Math.round(monthlyListeners * 3.5)
    streamsEstimated = true
  }

  // Track count: sum album_count + single_count if track_count not provided
  const trackCountDirect = parseNum(get('track_count', 'track count', 'tracks', 'number_of_tracks', 'total_tracks'))
  const albumCount = parseNum(get('album_count'))
  const singleCount = parseNum(get('single_count'))
  const trackCount = trackCountDirect || (albumCount + singleCount) || 0

  // Social URLs
  const instagramUrl = get('instagram_url', 'instagram url', 'ig_url') || null
  const facebookUrl = get('facebook_url', 'facebook url', 'facebook') || null
  const twitterUrl = get('twitter_url', 'twitter url', 'twitter', 'x_url') || null
  const tiktokUrl = get('tiktok_url', 'tiktok url', 'tiktok') || null
  const youtubeUrl = get('youtube_url', 'youtube url', 'youtube') || null
  const spotifyUrl = get('spotify_url', 'spotify url', 'spotify_link', 'spotify link') || null
  const website = get('website', 'url') || null

  const socialLinks: Record<string, string> = {}
  if (instagramUrl) socialLinks.instagram = instagramUrl
  if (facebookUrl) socialLinks.facebook = facebookUrl
  if (twitterUrl) socialLinks.twitter = twitterUrl
  if (tiktokUrl) socialLinks.tiktok = tiktokUrl
  if (youtubeUrl) socialLinks.youtube = youtubeUrl
  if (spotifyUrl) socialLinks.spotify = spotifyUrl
  if (website) socialLinks.website = website

  // Instagram handle
  let instagramHandle: string | null = get('instagram_handle', 'instagram', 'ig_handle') || null
  if (instagramHandle) instagramHandle = instagramHandle.replace('@', '')
  if (!instagramHandle && instagramUrl) {
    const match = instagramUrl.match(/instagram\.com\/([^/?]+)/)
    if (match) instagramHandle = match[1]
  }

  // Biography + email extraction
  const biography = get('biography', 'bio', 'description') || null
  const bioResult = extractBioEmails(biography)

  // Email: CSV email first, then bio email
  let csvEmail = get('email') || null
  let primaryEmail: string | null = null
  let emailSource: string | null = null
  let emailConfidence = 0

  if (csvEmail) {
    const quality = checkEmailQuality(csvEmail)
    if (quality.accepted) {
      primaryEmail = csvEmail
      emailSource = 'csv_import'
      emailConfidence = 1.0
    }
  }

  // If no valid CSV email, try bio emails
  if (!primaryEmail && bioResult.emails.length > 0) {
    const mgmt = bioResult.emails.find(e => e.type === 'management')
    const booking = bioResult.emails.find(e => e.type === 'booking')
    const best = mgmt || booking || bioResult.emails[0]
    primaryEmail = best.email
    emailSource = `spotify_biography_${best.type}`
    emailConfidence = 0.95
  }

  const instagramFollowers = parseNum(get('instagram_followers', 'instagram followers', 'ig_followers'))
  const growthYoy = parseFloat(get('growth_yoy')) || 0
  const country = get('country', 'country_name') || null
  const genres = get('genres', 'genre')
  const genreList = genres ? genres.split(/[;,]/).map(g => g.trim()).filter(Boolean) : []

  // Estimated offers (if pre-calculated in CSV)
  const estimatedOffer = parseFloat(get('estimated_offer')) || undefined
  const estimatedOfferLow = parseFloat(get('estimated_offer_low')) || undefined
  const estimatedOfferHigh = parseFloat(get('estimated_offer_high')) || undefined

  return {
    name,
    email: primaryEmail,
    email_source: emailSource,
    email_confidence: emailConfidence,
    instagram_handle: instagramHandle,
    instagram_url: instagramUrl,
    instagram_followers: instagramFollowers,
    website,
    spotify_url: spotifyUrl,
    spotify_id: null,
    spotify_monthly_listeners: monthlyListeners,
    spotify_followers: 0,
    spotify_verified: false,
    streams_last_month: finalStreams,
    streams_estimated: streamsEstimated,
    total_top_track_streams: streamsGeneric || 0,
    track_count: trackCount,
    genres: genreList,
    country: country ? country.toUpperCase() : null,
    biography,
    bio_emails: bioResult.emails.length > 0 ? bioResult.emails : null,
    management_company: bioResult.managementCompany,
    booking_agency: bioResult.bookingAgency,
    social_links: socialLinks,
    facebook_url: facebookUrl,
    twitter_url: twitterUrl,
    tiktok_url: tiktokUrl,
    youtube_url: youtubeUrl,
    wikipedia_url: null,
    world_rank: 0,
    cover_art_url: null,
    latest_release_date: null,
    latest_release_name: null,
    top_cities: null,
    import_format: 'cratehq',
    is_contactable: !!primaryEmail,
    // Pass through pre-calculated offers if present
    ...(estimatedOffer !== undefined ? { estimated_offer: estimatedOffer } : {}),
    ...(estimatedOfferLow !== undefined ? { estimated_offer_low: estimatedOfferLow } : {}),
    ...(estimatedOfferHigh !== undefined ? { estimated_offer_high: estimatedOfferHigh } : {}),
    growth_yoy: growthYoy,
  } as TransformedArtist & { estimated_offer?: number; estimated_offer_low?: number; estimated_offer_high?: number; growth_yoy?: number }
}

// ─── Import Preview Summary ──────────────────────────────────────────

export interface ImportPreviewSummary {
  format: ImportFormat
  formatLabel: string
  totalRows: number
  ghostsFiltered: number
  sampleRows: TransformedArtist[]
  bioEmailsFound: number
  bioEmailArtists: string[]
  hasSpotifyData: number
  hasSocialLinks: number
}

export function generatePreviewSummary(
  format: ImportFormat,
  rows: Record<string, string>[],
  maxPreview: number = 10
): ImportPreviewSummary {
  const formatLabel = format === 'spotify_raw'
    ? 'Raw Spotify Scrape (Apify Play Counter)'
    : format === 'cratehq'
      ? 'CrateHQ Format'
      : 'Unknown Format'

  const transformer = format === 'spotify_raw' ? transformSpotifyRaw : transformCrateHQ
  const allTransformed = rows.map(transformer).filter(a => a.name)

  // Filter ghost rows and validate emails
  let ghostsFiltered = 0
  const cleaned: TransformedArtist[] = []

  for (const artist of allTransformed) {
    const ghostCheck = isGhostRow({
      name: artist.name,
      spotify_monthly_listeners: artist.spotify_monthly_listeners,
      track_count: artist.track_count,
      streams_last_month: artist.streams_last_month,
      instagram_url: artist.instagram_url,
      spotify_url: artist.spotify_url,
      youtube_url: artist.youtube_url,
      facebook_url: artist.facebook_url,
      twitter_url: artist.twitter_url,
      website: artist.website,
    })
    if (ghostCheck.isGhost) {
      ghostsFiltered++
      continue
    }

    // Validate email format
    if (artist.email && !isValidEmailFormat(artist.email)) {
      artist.email = null
      artist.email_source = null
      artist.email_confidence = 0
      artist.is_contactable = false
    }

    cleaned.push(artist)
  }

  const sampleRows = cleaned.slice(0, maxPreview)
  const bioEmailArtists = cleaned.filter(a => a.bio_emails && a.bio_emails.length > 0)
  const bioEmailsFound = cleaned.reduce((sum, a) => sum + (a.bio_emails?.length || 0), 0)

  return {
    format,
    formatLabel,
    totalRows: cleaned.length,
    ghostsFiltered,
    sampleRows,
    bioEmailsFound,
    bioEmailArtists: bioEmailArtists.map(a => a.name),
    hasSpotifyData: cleaned.filter(a => a.spotify_monthly_listeners > 0).length,
    hasSocialLinks: cleaned.filter(a => Object.keys(a.social_links).length > 1).length,
  }
}
