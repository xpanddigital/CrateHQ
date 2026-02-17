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
const RATE_LIMIT_RETRY_MS = 10000

// ============================================================
// SAFE JSON PARSING — Apify sometimes returns plain text errors
// ============================================================

function safeJsonParse(text: string): { data: any; error: string | null } {
  try {
    return { data: JSON.parse(text), error: null }
  } catch {
    return { data: null, error: `Invalid JSON response: ${text.slice(0, 200)}` }
  }
}

/**
 * Check if an HTTP status code indicates we should skip immediately
 */
function isSkippableStatus(status: number): string | null {
  if (status === 402) return 'Apify payment required (insufficient credits)'
  if (status === 429) return 'Apify rate limit exceeded'
  if (status >= 500) return `Apify server error (HTTP ${status})`
  return null
}

// ============================================================
// SHARED: Start an actor run with retry on 429
// ============================================================

async function startActorRun(
  actorId: string,
  token: string,
  input: object,
  label: string
): Promise<{ runId: string; success: boolean; error?: string; errorDetails?: string }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const url = `${APIFY_BASE}/acts/${actorId}/runs?token=${token}`
    console.log(`[${label}] POST ${url.replace(token, '***')} (attempt ${attempt + 1})`)

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })

    const bodyText = await res.text()
    console.log(`[Apify Raw Response] startActorRun Status: ${res.status}, Body: ${bodyText.slice(0, 500)}`)

    if (res.status === 429 && attempt === 0) {
      console.warn(`[${label}] Rate limited (429), waiting ${RATE_LIMIT_RETRY_MS}ms and retrying...`)
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_RETRY_MS))
      continue
    }

    const errorDetail = `startActorRun(${actorId}) Status: ${res.status}, Body: ${bodyText.slice(0, 500)}`

    const skipReason = isSkippableStatus(res.status)
    if (skipReason) {
      console.error(`[${label}] ${skipReason}`)
      return { runId: '', success: false, error: skipReason, errorDetails: errorDetail }
    }

    if (!res.ok) {
      console.error(`[${label}] Start failed: HTTP ${res.status} — ${bodyText.slice(0, 300)}`)
      return { runId: '', success: false, error: `HTTP ${res.status}: ${bodyText.slice(0, 100)}`, errorDetails: errorDetail }
    }

    const parsed = safeJsonParse(bodyText)
    if (parsed.error) {
      console.error(`[${label}] Start response not JSON: ${parsed.error}`)
      return { runId: '', success: false, error: parsed.error, errorDetails: errorDetail }
    }

    const runId = parsed.data?.data?.id
    if (!runId) {
      console.error(`[${label}] No run ID in response: ${bodyText.slice(0, 200)}`)
      return { runId: '', success: false, error: 'No run ID in response', errorDetails: errorDetail }
    }

    return { runId, success: true }
  }

  return { runId: '', success: false, error: 'Rate limited after retry', errorDetails: 'startActorRun: 429 after retry' }
}

// ============================================================
// SHARED: Poll an actor run until completion
// ============================================================

async function pollForCompletion(
  runId: string,
  token: string,
  label: string
): Promise<{ datasetId: string; success: boolean; error?: string; errorDetails?: string }> {
  const startTime = Date.now()
  let pollCount = 0
  let lastBody = ''

  while (Date.now() - startTime < MAX_WAIT_MS) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
    pollCount++

    const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`)
    const bodyText = await res.text()
    lastBody = bodyText
    console.log(`[Apify Raw Response] pollForCompletion #${pollCount} Status: ${res.status}, Body: ${bodyText.slice(0, 500)}`)

    if (!res.ok) {
      const errorDetail = `pollForCompletion(${runId}) #${pollCount} Status: ${res.status}, Body: ${bodyText.slice(0, 500)}`
      const skipReason = isSkippableStatus(res.status)
      if (skipReason) {
        return { datasetId: '', success: false, error: skipReason, errorDetails: errorDetail }
      }
      return { datasetId: '', success: false, error: `Poll HTTP ${res.status}`, errorDetails: errorDetail }
    }

    const parsed = safeJsonParse(bodyText)
    if (parsed.error) {
      console.warn(`[${label}] Poll #${pollCount}: non-JSON response, retrying...`)
      continue
    }

    const status = parsed.data?.data?.status
    const elapsed = Date.now() - startTime

    console.log(`[${label}] Poll #${pollCount}: status=${status}, elapsed=${elapsed}ms`)

    if (status === 'SUCCEEDED') {
      return { datasetId: parsed.data.data.defaultDatasetId, success: true }
    }
    if (status === 'FAILED' || status === 'ABORTED') {
      const msg = parsed.data.data.statusMessage || 'unknown'
      return {
        datasetId: '', success: false,
        error: `Run ${status}: ${msg}`,
        errorDetails: `pollForCompletion(${runId}) Run ${status}: ${msg}. Last body: ${bodyText.slice(0, 500)}`,
      }
    }
  }

  return {
    datasetId: '', success: false,
    error: `Timeout after ${MAX_WAIT_MS}ms (${pollCount} polls)`,
    errorDetails: `pollForCompletion(${runId}) Timeout. Last body: ${lastBody.slice(0, 500)}`,
  }
}

async function fetchDatasetItems(datasetId: string, token: string): Promise<any[]> {
  const res = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items?token=${token}&format=json`)
  const bodyText = await res.text()
  console.log(`[Apify Raw Response] fetchDatasetItems Status: ${res.status}, Body: ${bodyText.slice(0, 500)}`)

  if (!res.ok) {
    const skipReason = isSkippableStatus(res.status)
    if (skipReason) {
      console.error(`[Dataset] ${skipReason}`)
      return []
    }
    console.error(`[Dataset] HTTP ${res.status}`)
    return []
  }

  const parsed = safeJsonParse(bodyText)
  if (parsed.error) {
    console.error(`[Dataset] ${parsed.error}`)
    return []
  }

  return Array.isArray(parsed.data) ? parsed.data : []
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
  errorDetails?: string
  actorUsed: string
}

export async function apifyFetchYouTube(channelUrl: string): Promise<YouTubeResult> {
  const token = process.env.APIFY_TOKEN
  const actorId = 'streamers~youtube-scraper'
  const label = 'Apify:YouTube'
  const empty: YouTubeResult = { email: null, description: '', aboutText: '', allText: '', success: false, actorUsed: actorId }

  if (!token) {
    return { ...empty, error: 'No APIFY_TOKEN' }
  }

  try {
    console.log(`[${label}] Starting for: ${channelUrl}`)

    const start = await startActorRun(actorId, token, {
      startUrls: [{ url: channelUrl }],
      maxResults: 1,
      channelInfoOnly: true,
    }, label)

    if (!start.success) {
      return { ...empty, error: start.error, errorDetails: start.errorDetails }
    }

    console.log(`[${label}] Run started: ${start.runId}`)

    const poll = await pollForCompletion(start.runId, token, label)
    if (!poll.success) {
      return { ...empty, error: poll.error, errorDetails: poll.errorDetails }
    }

    const items = await fetchDatasetItems(poll.datasetId, token)
    if (!items || items.length === 0) {
      return { ...empty, error: 'No results' }
    }

    const data = items[0]

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

    let email: string | null = null
    if (data.channelEmail && data.channelEmail.includes('@')) {
      email = data.channelEmail
    } else if (data.businessEmail && data.businessEmail.includes('@')) {
      email = data.businessEmail
    }

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
    return { ...empty, error: error.message }
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
  errorDetails?: string
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

  const cleanHandle = handle
    .replace(/^@/, '')
    .replace(/https?:\/\/(www\.)?instagram\.com\//, '')
    .replace(/\/$/, '')

  if (!cleanHandle) {
    return { ...empty, error: 'Empty handle' }
  }

  try {
    console.log(`[${label}] Starting for: @${cleanHandle}`)

    const start = await startActorRun(actorId, token, {
      usernames: [cleanHandle],
    }, label)

    if (!start.success) {
      return { ...empty, error: start.error, errorDetails: start.errorDetails }
    }

    console.log(`[${label}] Run started: ${start.runId}`)

    const poll = await pollForCompletion(start.runId, token, label)
    if (!poll.success) {
      return { ...empty, error: poll.error, errorDetails: poll.errorDetails }
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

    let email: string | null = null
    if (businessEmail && businessEmail.includes('@')) {
      email = businessEmail
    }

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
  errorDetails?: string
  actorUsed: string
}

export async function apifyFetchWebPage(url: string, maxPages: number = 3): Promise<WebPageResult> {
  const token = process.env.APIFY_TOKEN
  const actorId = 'apify~website-content-crawler'
  const label = 'Apify:WebPage'
  const empty: WebPageResult = { text: '', html: '', success: false, actorUsed: actorId }

  if (!token) {
    return { ...empty, error: 'No APIFY_TOKEN' }
  }

  try {
    console.log(`[${label}] Starting for: ${url} (maxPages=${maxPages})`)

    const start = await startActorRun(actorId, token, {
      startUrls: [{ url }],
      maxCrawlPages: maxPages,
      crawlerType: 'playwright:firefox',
      maxCrawlDepth: 1,
    }, label)

    if (!start.success) {
      return { ...empty, error: start.error, errorDetails: start.errorDetails }
    }

    console.log(`[${label}] Run started: ${start.runId}`)

    const poll = await pollForCompletion(start.runId, token, label)
    if (!poll.success) {
      return { ...empty, error: poll.error, errorDetails: poll.errorDetails }
    }

    const items = await fetchDatasetItems(poll.datasetId, token)
    if (!items || items.length === 0) {
      return { ...empty, error: 'No results' }
    }

    const allText = items.map((item: any) => item.text || item.content || '').join('\n\n')
    const allHtml = items.map((item: any) => item.html || '').join('\n\n')

    console.log(`[${label}] Success: ${items.length} pages, ${allText.length} chars text`)

    return { text: allText, html: allHtml, success: true, actorUsed: actorId }
  } catch (error: any) {
    console.error(`[${label}] FAILED: ${error.message}`)
    return { ...empty, error: error.message }
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

export function extractInstagramHandle(input: string): string {
  if (!input) return ''
  return input
    .replace(/^@/, '')
    .replace(/https?:\/\/(www\.)?instagram\.com\//, '')
    .replace(/\/$/, '')
    .split('?')[0]
}

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

export function findInstagramHandle(artist: any): string {
  const sl = artist.social_links || {}

  const igUrl = sl.instagram_url || sl.instagram || (artist as any).instagram_url || ''
  if (igUrl) return extractInstagramHandle(igUrl)

  if (artist.instagram_handle) return artist.instagram_handle

  for (const value of Object.values(sl)) {
    if (typeof value === 'string' && value.includes('instagram.com')) {
      return extractInstagramHandle(value)
    }
  }
  return ''
}

export function findWebsiteUrl(artist: any): string {
  const sl = artist.social_links || {}
  const website = sl.website || artist.website || ''
  if (website) {
    return website.startsWith('http') ? website : `https://${website}`
  }
  return ''
}
