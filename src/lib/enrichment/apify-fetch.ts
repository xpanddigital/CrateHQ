/**
 * Platform-Specific Apify Actors for Enrichment Pipeline
 *
 * Each social platform needs its own dedicated scraper actor because the
 * generic website-content-crawler returns cookie consent walls and login pages.
 *
 * Actors:
 *   YouTube:   streamers~youtube-scraper        (~$0.002/channel)
 *   Instagram: apify~instagram-profile-scraper  (~$0.01/profile)
 *   Web pages: apify~website-content-crawler    (~$0.001/page, for Linktree + artist websites only)
 *
 * Token is ALWAYS passed as ?token= query parameter, never as Authorization header.
 * Actor IDs use tilde (~) separator, never slash (/).
 */

const APIFY_BASE = 'https://api.apify.com/v2'
const MAX_WAIT_MS = 45000
const POLL_INTERVAL_MS = 2000

// ============================================================
// SHARED: Poll an actor run until completion
// ============================================================

async function pollForCompletion(
  runId: string,
  token: string,
  label: string
): Promise<{ datasetId: string; success: boolean; error?: string }> {
  const startTime = Date.now()
  let pollCount = 0

  while (Date.now() - startTime < MAX_WAIT_MS) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
    pollCount++

    const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`)
    if (!res.ok) {
      return { datasetId: '', success: false, error: `Poll HTTP ${res.status}` }
    }

    const data = await res.json()
    const status = data.data.status
    const elapsed = Date.now() - startTime

    console.log(`[${label}] Poll #${pollCount}: status=${status}, elapsed=${elapsed}ms`)

    if (status === 'SUCCEEDED') {
      return { datasetId: data.data.defaultDatasetId, success: true }
    }
    if (status === 'FAILED' || status === 'ABORTED') {
      return { datasetId: '', success: false, error: `Run ${status}: ${data.data.statusMessage || 'unknown'}` }
    }
  }

  return { datasetId: '', success: false, error: `Timeout after ${MAX_WAIT_MS}ms (${pollCount} polls)` }
}

async function fetchDatasetItems(datasetId: string, token: string): Promise<any[]> {
  const res = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items?token=${token}&format=json`)
  if (!res.ok) {
    throw new Error(`Dataset fetch HTTP ${res.status}`)
  }
  return res.json()
}

// ============================================================
// YOUTUBE: streamers~youtube-scraper
// ============================================================

export interface YouTubeResult {
  email: string | null
  description: string
  aboutText: string
  allText: string
  success: boolean
  error?: string
  actorUsed: string
}

export async function apifyFetchYouTube(channelUrl: string): Promise<YouTubeResult> {
  const token = process.env.APIFY_TOKEN
  const actorId = 'streamers~youtube-scraper'
  const label = 'Apify:YouTube'

  if (!token) {
    return { email: null, description: '', aboutText: '', allText: '', success: false, error: 'No APIFY_TOKEN', actorUsed: actorId }
  }

  try {
    console.log(`[${label}] Starting for: ${channelUrl}`)

    const startRes = await fetch(`${APIFY_BASE}/acts/${actorId}/runs?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: [{ url: channelUrl }],
        maxResults: 1,
        channelInfoOnly: true,
      }),
    })

    if (!startRes.ok) {
      const errText = await startRes.text()
      console.error(`[${label}] Start failed: HTTP ${startRes.status} — ${errText.slice(0, 300)}`)
      return { email: null, description: '', aboutText: '', allText: '', success: false, error: `HTTP ${startRes.status}`, actorUsed: actorId }
    }

    const startData = await startRes.json()
    const runId = startData.data.id
    console.log(`[${label}] Run started: ${runId}`)

    const poll = await pollForCompletion(runId, token, label)
    if (!poll.success) {
      return { email: null, description: '', aboutText: '', allText: '', success: false, error: poll.error, actorUsed: actorId }
    }

    const items = await fetchDatasetItems(poll.datasetId, token)
    if (!items || items.length === 0) {
      return { email: null, description: '', aboutText: '', allText: '', success: false, error: 'No results', actorUsed: actorId }
    }

    const data = items[0]

    // Build combined text from all potentially useful fields
    const description = data.channelDescription || data.description || ''
    const aboutText = data.aboutText || data.about || ''
    const allText = [
      description,
      aboutText,
      data.channelEmail || '',
      data.businessEmail || '',
      data.contactInfo || '',
      JSON.stringify(data.links || []),
    ].join('\n')

    // Extract email — check dedicated fields first
    let email: string | null = null
    if (data.channelEmail && data.channelEmail.includes('@')) {
      email = data.channelEmail
    } else if (data.businessEmail && data.businessEmail.includes('@')) {
      email = data.businessEmail
    }

    // If no dedicated field, regex scan all text
    if (!email) {
      const emailMatch = allText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)
      if (emailMatch && emailMatch.length > 0) {
        email = emailMatch[0]
      }
    }

    console.log(`[${label}] Success: email=${email || 'none'}, desc=${description.length} chars`)

    return { email, description, aboutText, allText, success: true, actorUsed: actorId }
  } catch (error: any) {
    console.error(`[${label}] FAILED: ${error.message}`)
    return { email: null, description: '', aboutText: '', allText: '', success: false, error: error.message, actorUsed: actorId }
  }
}

// ============================================================
// INSTAGRAM: apify~instagram-profile-scraper
// ============================================================

export interface InstagramResult {
  email: string | null
  businessEmail: string | null
  biography: string
  externalUrl: string | null
  allText: string
  success: boolean
  error?: string
  actorUsed: string
}

export async function apifyFetchInstagram(handle: string): Promise<InstagramResult> {
  const token = process.env.APIFY_TOKEN
  const actorId = 'apify~instagram-profile-scraper'
  const label = 'Apify:Instagram'

  const empty: InstagramResult = {
    email: null, businessEmail: null, biography: '', externalUrl: null,
    allText: '', success: false, actorUsed: actorId,
  }

  if (!token) {
    return { ...empty, error: 'No APIFY_TOKEN' }
  }

  // Clean handle — remove @ and URL parts
  const cleanHandle = handle
    .replace(/^@/, '')
    .replace(/https?:\/\/(www\.)?instagram\.com\//, '')
    .replace(/\/$/, '')

  if (!cleanHandle) {
    return { ...empty, error: 'Empty handle' }
  }

  try {
    console.log(`[${label}] Starting for: @${cleanHandle}`)

    const startRes = await fetch(`${APIFY_BASE}/acts/${actorId}/runs?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usernames: [cleanHandle],
      }),
    })

    if (!startRes.ok) {
      const errText = await startRes.text()
      console.error(`[${label}] Start failed: HTTP ${startRes.status} — ${errText.slice(0, 300)}`)
      return { ...empty, error: `HTTP ${startRes.status}` }
    }

    const startData = await startRes.json()
    const runId = startData.data.id
    console.log(`[${label}] Run started: ${runId}`)

    const poll = await pollForCompletion(runId, token, label)
    if (!poll.success) {
      return { ...empty, error: poll.error }
    }

    const items = await fetchDatasetItems(poll.datasetId, token)
    if (!items || items.length === 0) {
      return { ...empty, error: 'No results' }
    }

    const data = items[0]

    const biography = data.biography || data.bio || ''
    const businessEmail = data.businessEmail || data.contactEmail || null
    const externalUrl = data.externalUrl || data.website || null

    const allText = [
      biography,
      businessEmail || '',
      externalUrl || '',
      data.businessPhoneNumber || '',
      data.businessCategoryName || '',
    ].join('\n')

    // Extract email — check dedicated field first
    let email: string | null = null
    if (businessEmail && businessEmail.includes('@')) {
      email = businessEmail
    }

    // If no dedicated field, regex scan biography
    if (!email && biography) {
      const emailMatch = biography.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)
      if (emailMatch && emailMatch.length > 0) {
        email = emailMatch[0]
      }
    }

    console.log(`[${label}] Success: email=${email || 'none'}, bio=${biography.length} chars, externalUrl=${externalUrl || 'none'}`)

    return { email, businessEmail, biography, externalUrl, allText, success: true, actorUsed: actorId }
  } catch (error: any) {
    console.error(`[${label}] FAILED: ${error.message}`)
    return { ...empty, error: error.message }
  }
}

// ============================================================
// WEB PAGE: apify~website-content-crawler
// For Linktree, artist websites, and other simple pages ONLY
// ============================================================

export interface WebPageResult {
  text: string
  html: string
  success: boolean
  error?: string
  actorUsed: string
}

export async function apifyFetchWebPage(url: string, maxPages: number = 3): Promise<WebPageResult> {
  const token = process.env.APIFY_TOKEN
  const actorId = 'apify~website-content-crawler'
  const label = 'Apify:WebPage'

  if (!token) {
    return { text: '', html: '', success: false, error: 'No APIFY_TOKEN', actorUsed: actorId }
  }

  try {
    console.log(`[${label}] Starting for: ${url} (maxPages=${maxPages})`)

    const startRes = await fetch(`${APIFY_BASE}/acts/${actorId}/runs?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: [{ url }],
        maxCrawlPages: maxPages,
        crawlerType: 'playwright:firefox',
        maxCrawlDepth: 1,
      }),
    })

    if (!startRes.ok) {
      const errText = await startRes.text()
      console.error(`[${label}] Start failed: HTTP ${startRes.status} — ${errText.slice(0, 300)}`)
      return { text: '', html: '', success: false, error: `HTTP ${startRes.status}`, actorUsed: actorId }
    }

    const startData = await startRes.json()
    const runId = startData.data.id
    console.log(`[${label}] Run started: ${runId}`)

    const poll = await pollForCompletion(runId, token, label)
    if (!poll.success) {
      return { text: '', html: '', success: false, error: poll.error, actorUsed: actorId }
    }

    const items = await fetchDatasetItems(poll.datasetId, token)
    if (!items || items.length === 0) {
      return { text: '', html: '', success: false, error: 'No results', actorUsed: actorId }
    }

    // Combine text from all crawled pages
    const allText = items.map((item: any) => item.text || item.content || '').join('\n\n')
    const allHtml = items.map((item: any) => item.html || '').join('\n\n')

    console.log(`[${label}] Success: ${items.length} pages, ${allText.length} chars text`)

    return { text: allText, html: allHtml, success: true, actorUsed: actorId }
  } catch (error: any) {
    console.error(`[${label}] FAILED: ${error.message}`)
    return { text: '', html: '', success: false, error: error.message, actorUsed: actorId }
  }
}

// ============================================================
// DIRECT FETCH: For pages that don't need Apify
// ============================================================

export async function directFetch(url: string, timeoutMs: number = 8000): Promise<{ html: string; success: boolean }> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      return { html: '', success: false }
    }

    const html = await res.text()
    return { html, success: html.length > 200 }
  } catch {
    return { html: '', success: false }
  }
}

// ============================================================
// HELPERS
// ============================================================

export function isLinktreeDomain(url: string): boolean {
  const linkDomains = [
    'linktr.ee', 'linktree.com', 'beacons.ai', 'stan.store',
    'solo.to', 'lnk.to', 'bio.link', 'linkfire.com', 'ffm.to',
    'linkin.bio', 'fanlink.to', 'smarturl.it',
  ]
  return linkDomains.some(domain => url.includes(domain))
}

export function isTicketingPlatform(url: string): boolean {
  const blocked = [
    'livenation.com', 'axs.com', 'dice.fm', 'gaana.com', 'tvmaze.com',
    'songkick.com', 'bandsintown.com', 'ticketmaster.com', 'eventbrite.com',
    'seetickets.com', 'stubhub.com',
  ]
  return blocked.some(domain => url.includes(domain))
}

export function isBlockedContent(html: string): boolean {
  if (!html || html.length < 300) return true

  const blockSignals = [
    'consent.youtube.com', 'before you continue', 'Sign in to confirm',
    'Login • Instagram', 'Create an account', 'log in to see',
    'You must log in', 'Log Into Facebook',
    'Enhanced Tracking Protection', 'Something went wrong',
  ]

  return blockSignals.some(signal => html.toLowerCase().includes(signal.toLowerCase()))
}

/**
 * Extract Instagram handle from a URL or handle string
 */
export function extractInstagramHandle(input: string): string {
  if (!input) return ''
  return input
    .replace(/^@/, '')
    .replace(/https?:\/\/(www\.)?instagram\.com\//, '')
    .replace(/\/$/, '')
    .split('?')[0]
}

/**
 * Find a YouTube channel URL from social_links
 */
export function findYouTubeUrl(artist: any): string {
  const sl = artist.social_links || {}
  const yt = sl.youtube_url || sl.youtube || (artist as any).youtube_url || ''
  if (yt) return yt

  for (const value of Object.values(sl)) {
    if (typeof value === 'string' && (value.includes('youtube.com') || value.includes('youtu.be'))) {
      return value
    }
  }
  return ''
}

/**
 * Find an Instagram handle from social_links or artist fields
 */
export function findInstagramHandle(artist: any): string {
  const sl = artist.social_links || {}

  // Check for URL first, extract handle from it
  const igUrl = sl.instagram_url || sl.instagram || (artist as any).instagram_url || ''
  if (igUrl) return extractInstagramHandle(igUrl)

  // Check for direct handle field
  if (artist.instagram_handle) return artist.instagram_handle

  // Search all social links
  for (const value of Object.values(sl)) {
    if (typeof value === 'string' && value.includes('instagram.com')) {
      return extractInstagramHandle(value)
    }
  }
  return ''
}

/**
 * Find a website URL from social_links or artist fields
 */
export function findWebsiteUrl(artist: any): string {
  const sl = artist.social_links || {}
  const website = sl.website || artist.website || ''
  if (website) {
    return website.startsWith('http') ? website : `https://${website}`
  }
  return ''
}
