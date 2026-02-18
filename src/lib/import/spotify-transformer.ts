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

import { checkEmailQuality } from '@/lib/qualification/email-filter'

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
 * Detects delimiter (tab vs comma) and parses a CSV/TSV string into
 * an array of header→value objects. Handles quoted fields with embedded
 * delimiters and newlines.
 */
export function parseDelimitedText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // Detect delimiter from first line
  const firstLine = text.split('\n')[0] || ''
  const tabCount = (firstLine.match(/\t/g) || []).length
  const commaCount = (firstLine.match(/,/g) || []).length
  const delimiter = tabCount > commaCount ? '\t' : ','

  const rows: Record<string, string>[] = []
  const lines = splitCSVLines(text, delimiter)

  if (lines.length < 2) return { headers: [], rows: [] }

  const headers = parseCSVLine(lines[0], delimiter)

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = parseCSVLine(line, delimiter)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || '').trim()
    })
    rows.push(row)
  }

  return { headers, rows }
}

function splitCSVLines(text: string, _delimiter: string): string[] {
  const lines: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++
      lines.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) lines.push(current)
  return lines
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === delimiter && !inQuotes) {
      values.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  values.push(current)
  return values
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
    spotify_monthly_listeners: parseNum(row['monthlyListeners']),
    spotify_followers: parseNum(row['followers']),
    spotify_verified: row['verified']?.toLowerCase() === 'true',
    streams_last_month: 0,
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

// ─── Import Preview Summary ──────────────────────────────────────────

export interface ImportPreviewSummary {
  format: ImportFormat
  formatLabel: string
  totalRows: number
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

  if (format === 'spotify_raw') {
    const allTransformed = rows.map(transformSpotifyRaw)
    const sampleRows = allTransformed.slice(0, maxPreview)
    const bioEmailArtists = allTransformed.filter(a => a.bio_emails && a.bio_emails.length > 0)
    const bioEmailsFound = allTransformed.reduce((sum, a) => sum + (a.bio_emails?.length || 0), 0)

    return {
      format,
      formatLabel,
      totalRows: rows.length,
      sampleRows,
      bioEmailsFound,
      bioEmailArtists: bioEmailArtists.map(a => a.name),
      hasSpotifyData: allTransformed.filter(a => a.spotify_monthly_listeners > 0).length,
      hasSocialLinks: allTransformed.filter(a => Object.keys(a.social_links).length > 1).length,
    }
  }

  // CrateHQ format — return empty summary (existing flow handles preview)
  return {
    format,
    formatLabel,
    totalRows: rows.length,
    sampleRows: [],
    bioEmailsFound: 0,
    bioEmailArtists: [],
    hasSpotifyData: 0,
    hasSocialLinks: 0,
  }
}
