/**
 * Apify Fetch for Enrichment Pipeline
 * 
 * Replaces direct fetch() calls with Apify's JavaScript-rendering crawler.
 * This solves blocking issues with YouTube, Instagram, Facebook, etc.
 * 
 * Uses Apify's Website Content Crawler with Chromium rendering to get
 * fully rendered HTML from pages that require JavaScript.
 */

const APIFY_BASE = 'https://api.apify.com/v2'
// CRITICAL: Apify REST API uses tilde (~) as separator, NOT slash (/)
// Slash gets interpreted as a URL path segment and causes 404
const WEBSITE_CRAWLER_ACTOR = 'apify~website-content-crawler'
const MAX_WAIT_MS = 45000 // 45 seconds (leave headroom for Vercel timeout)
const POLL_INTERVAL_MS = 2000 // 2 seconds

/**
 * Fetch a single URL using Apify's JavaScript-rendering crawler
 */
export async function apifyFetch(url: string): Promise<{ html: string; success: boolean; error?: string }> {
  const token = process.env.APIFY_TOKEN

  if (!token) {
    console.warn('[Apify Fetch] No APIFY_TOKEN configured, cannot render JavaScript')
    return { html: '', success: false, error: 'No APIFY_TOKEN configured' }
  }

  try {
    const apiUrl = `${APIFY_BASE}/acts/${WEBSITE_CRAWLER_ACTOR}/runs?token=${token}`
    console.log(`[Apify Fetch] Starting actor run for: ${url}`)
    console.log(`[Apify Fetch] API URL: ${APIFY_BASE}/acts/${WEBSITE_CRAWLER_ACTOR}/runs?token=***`)

    // 1. Start the actor
    const startRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: [{ url }],
        maxCrawlPages: 1,
        crawlerType: 'cheerio',
        maxCrawlDepth: 0,
      }),
    })

    if (!startRes.ok) {
      const errorText = await startRes.text()
      console.error(`[Apify Fetch] Actor start FAILED: HTTP ${startRes.status}`)
      console.error(`[Apify Fetch] Response: ${errorText.slice(0, 500)}`)
      throw new Error(`Failed to start Apify actor: ${startRes.status} ${errorText.slice(0, 200)}`)
    }

    const startData = await startRes.json()
    const runId = startData.data.id
    const datasetId = startData.data.defaultDatasetId

    console.log(`[Apify Fetch] Run started: ${runId}, dataset: ${datasetId}`)

    // 2. Poll for completion
    const startTime = Date.now()
    let status = 'RUNNING'

    while (Date.now() - startTime < MAX_WAIT_MS) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))

      const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`)
      if (!statusRes.ok) {
        throw new Error(`Failed to check run status: ${statusRes.status}`)
      }

      const statusData = await statusRes.json()
      status = statusData.data.status
      console.log(`[Apify Fetch] Poll: status=${status}, elapsed=${Date.now() - startTime}ms`)

      if (status === 'SUCCEEDED') {
        console.log(`[Apify Fetch] Run completed successfully in ${Date.now() - startTime}ms`)
        break
      } else if (status === 'FAILED' || status === 'ABORTED') {
        throw new Error(`Actor run ${status}: ${statusData.data.statusMessage || 'Unknown error'}`)
      }
    }

    if (status !== 'SUCCEEDED') {
      throw new Error(`Actor run timeout after ${MAX_WAIT_MS}ms`)
    }

    // 3. Fetch the dataset results
    const resultsRes = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items?token=${token}&format=json`)
    if (!resultsRes.ok) {
      throw new Error(`Failed to fetch results: ${resultsRes.status}`)
    }

    const results = await resultsRes.json()

    if (!results || results.length === 0) {
      throw new Error('No results returned from crawler')
    }

    // 4. Extract HTML content
    const html = results[0].html || results[0].text || ''

    console.log(`[Apify Fetch] Success: ${html.length} characters from ${url}`)

    return { html, success: true }
  } catch (error: any) {
    console.error(`[Apify Fetch] FAILED for ${url}: ${error.message}`)
    return { html: '', success: false, error: error.message }
  }
}

/**
 * Batch fetch multiple URLs in a single Apify crawler run
 * This is much more efficient than fetching each URL separately
 */
export async function apifyFetchMultiple(urls: string[]): Promise<Map<string, string>> {
  const token = process.env.APIFY_TOKEN
  const resultMap = new Map<string, string>()

  if (!token) {
    console.error('[Apify Batch] APIFY_TOKEN is not set — cannot fetch URLs')
    return resultMap
  }

  if (urls.length === 0) {
    console.warn('[Apify Batch] No URLs to fetch')
    return resultMap
  }

  const apiUrl = `${APIFY_BASE}/acts/${WEBSITE_CRAWLER_ACTOR}/runs?token=${token}`

  try {
    console.log(`[Apify Batch] Starting batch fetch for ${urls.length} URLs`)
    console.log(`[Apify Batch] Actor: ${WEBSITE_CRAWLER_ACTOR}`)
    console.log(`[Apify Batch] URLs:`, urls)

    // 1. Start the actor with all URLs
    const body = {
      startUrls: urls.map(url => ({ url })),
      maxCrawlPages: urls.length,
      crawlerType: 'cheerio',
      maxCrawlDepth: 0,
    }

    console.log(`[Apify Batch] POST ${APIFY_BASE}/acts/${WEBSITE_CRAWLER_ACTOR}/runs?token=***`)

    const startRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!startRes.ok) {
      const errorText = await startRes.text()
      console.error(`[Apify Batch] Actor start FAILED: HTTP ${startRes.status}`)
      console.error(`[Apify Batch] Response body: ${errorText.slice(0, 500)}`)
      throw new Error(`Apify actor start failed: HTTP ${startRes.status} - ${errorText.slice(0, 200)}`)
    }

    const startData = await startRes.json()
    const runId = startData.data.id
    const datasetId = startData.data.defaultDatasetId

    console.log(`[Apify Batch] Run started! runId=${runId}, datasetId=${datasetId}`)

    // 2. Poll for completion
    const startTime = Date.now()
    let status = 'RUNNING'
    let pollCount = 0

    while (Date.now() - startTime < MAX_WAIT_MS) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
      pollCount++

      const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`)
      if (!statusRes.ok) {
        console.error(`[Apify Batch] Poll failed: HTTP ${statusRes.status}`)
        throw new Error(`Failed to check run status: ${statusRes.status}`)
      }

      const statusData = await statusRes.json()
      status = statusData.data.status
      const elapsed = Date.now() - startTime

      console.log(`[Apify Batch] Poll #${pollCount}: status=${status}, elapsed=${elapsed}ms`)

      if (status === 'SUCCEEDED') {
        console.log(`[Apify Batch] Run SUCCEEDED in ${elapsed}ms after ${pollCount} polls`)
        break
      } else if (status === 'FAILED' || status === 'ABORTED') {
        const msg = statusData.data.statusMessage || 'Unknown error'
        console.error(`[Apify Batch] Run ${status}: ${msg}`)
        throw new Error(`Actor run ${status}: ${msg}`)
      }
    }

    if (status !== 'SUCCEEDED') {
      console.error(`[Apify Batch] TIMEOUT after ${MAX_WAIT_MS}ms (${pollCount} polls)`)
      throw new Error(`Actor run timeout after ${MAX_WAIT_MS}ms`)
    }

    // 3. Fetch the dataset results
    console.log(`[Apify Batch] Fetching dataset results: ${datasetId}`)
    const resultsRes = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items?token=${token}&format=json`)
    if (!resultsRes.ok) {
      throw new Error(`Failed to fetch results: ${resultsRes.status}`)
    }

    const results = await resultsRes.json()
    console.log(`[Apify Batch] Dataset returned ${results.length} items`)

    // 4. Build map of URL -> HTML
    for (const result of results) {
      const pageUrl = result.url
      const html = result.html || result.text || ''
      if (pageUrl && html) {
        resultMap.set(pageUrl, html)
        console.log(`[Apify Batch] ✅ ${pageUrl}: ${html.length} chars`)
      } else {
        console.warn(`[Apify Batch] ⚠️ Empty result for: ${pageUrl || 'unknown URL'}`)
      }
    }

    console.log(`[Apify Batch] Complete: ${resultMap.size}/${urls.length} pages fetched successfully`)

    return resultMap
  } catch (error: any) {
    console.error(`[Apify Batch] ❌ FAILED: ${error.message}`)
    console.error(`[Apify Batch] Stack: ${error.stack?.slice(0, 300)}`)
    // Return whatever we have (could be empty)
    return resultMap
  }
}

/**
 * Collect all URLs for an artist that need to be fetched
 */
export function collectArtistUrls(artist: any): string[] {
  const urls: string[] = []
  const socialLinks = artist.social_links || {}

  // YouTube - check both social_links and direct properties
  const youtubeUrl = socialLinks.youtube_url || socialLinks.youtube || artist.youtube_url
  if (youtubeUrl) {
    let aboutUrl = youtubeUrl
    if (youtubeUrl.includes('/channel/') || youtubeUrl.includes('/@')) {
      aboutUrl = youtubeUrl.replace(/\/$/, '') + '/about'
    } else if (youtubeUrl.includes('/c/')) {
      aboutUrl = youtubeUrl.replace(/\/$/, '') + '/about'
    }
    urls.push(aboutUrl)
  }

  // Instagram - check both handle and URL formats
  const instagramUrl = socialLinks.instagram_url || socialLinks.instagram || artist.instagram_url
  if (instagramUrl) {
    urls.push(instagramUrl)
  } else if (artist.instagram_handle) {
    urls.push(`https://www.instagram.com/${artist.instagram_handle}/`)
  }

  // Facebook
  const facebookUrl = socialLinks.facebook_url || socialLinks.facebook || artist.facebook_url
  if (facebookUrl) {
    urls.push(facebookUrl.replace(/\/$/, '') + '/about')
  }

  // Website (homepage + common contact pages)
  const website = socialLinks.website || artist.website
  if (website) {
    let fullWebsite = website
    if (!fullWebsite.startsWith('http')) {
      fullWebsite = 'https://' + fullWebsite
    }
    urls.push(fullWebsite)
    
    // Also try common contact pages
    try {
      const baseUrl = new URL(fullWebsite)
      const domain = `${baseUrl.protocol}//${baseUrl.host}`
      urls.push(`${domain}/contact`)
      urls.push(`${domain}/booking`)
    } catch (e) {
      // Invalid URL, skip
    }
  }

  // Twitter/X
  const twitterUrl = socialLinks.twitter_url || socialLinks.twitter || artist.twitter_url
  if (twitterUrl) {
    urls.push(twitterUrl)
  }

  // TikTok
  const tiktokUrl = socialLinks.tiktok_url || socialLinks.tiktok || artist.tiktok_url
  if (tiktokUrl) {
    urls.push(tiktokUrl)
  }

  // Spotify
  const spotifyUrl = socialLinks.spotify_url || socialLinks.spotify || artist.spotify_url
  if (spotifyUrl) {
    urls.push(spotifyUrl)
  }

  console.log(`[collectArtistUrls] Collected ${urls.length} URLs for ${artist.name}:`, urls)

  return urls
}

/**
 * Check if a URL is a simple link-in-bio page that doesn't need JavaScript rendering
 */
export function isSimpleLinkInBio(url: string): boolean {
  const simpleDomains = ['linktr.ee', 'beacons.ai', 'stan.store', 'lnk.to', 'solo.to', 'linkin.bio']
  return simpleDomains.some(domain => url.includes(domain))
}

/**
 * Try direct fetch first, fall back to Apify if content is too small
 */
export async function smartFetch(url: string): Promise<{ html: string; success: boolean; method: 'direct' | 'apify' }> {
  // For simple link-in-bio pages, try direct fetch first
  if (isSimpleLinkInBio(url)) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      })

      if (response.ok) {
        const html = await response.text()
        if (html.length >= 500) {
          console.log(`[Smart Fetch] Direct fetch success for ${url}`)
          return { html, success: true, method: 'direct' }
        }
      }
    } catch (e) {
      // Fall through to Apify
    }
  }

  // Fall back to Apify for JavaScript rendering
  const result = await apifyFetch(url)
  return { ...result, method: 'apify' }
}
