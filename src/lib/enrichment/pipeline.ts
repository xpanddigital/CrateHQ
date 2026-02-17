/**
 * Email Enrichment Pipeline — 3-TIER SYSTEM WITH APIFY FALLBACK
 * 
 * This pipeline uses a 3-tier approach for maximum success:
 * 
 * TIER 1: Direct fetch() - Fast, free, works most of the time
 * TIER 2: Apify fallback - When direct fetch is blocked/empty, use Apify scrapers
 * TIER 3: AI extraction - Pass real content to Claude for email discovery
 * 
 * Architecture per step:
 * 1. Try direct fetch() with browser headers
 * 2. Check if blocked (login wall, <500 chars, consent screens)
 * 3. If blocked → Apify scraper fallback (if configured)
 * 4. Extract emails from HTML with regex
 * 5. If no emails → Ask Claude to find email in content
 * 6. Validate email was actually in the fetched content (anti-hallucination)
 * 7. Early termination on first valid email found
 * 
 * Steps (in order, stopping when email found):
 * 1. YouTube About Tab Email (45% hit rate)
 * 2. Instagram Bio Email
 * 3. Link-in-Bio Pages (Linktree, Beacons, etc.)
 * 4. Artist Website Contact Page
 * 5. Facebook About Section
 * 6. All Remaining Socials Sweep
 */

import Anthropic from '@anthropic-ai/sdk'
import * as cheerio from 'cheerio'
import type { Artist } from '@/types/database'
import { apifyFetch, apifyFetchMultiple, collectArtistUrls, smartFetch } from './apify-fetch'

// ============================================================
// TYPES
// ============================================================

export interface EnrichmentStep {
  method: string
  label: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped'
  emails_found: string[]
  best_email: string
  confidence: number
  error?: string
  duration_ms?: number
  url_fetched?: string
  apify_used?: boolean
  was_blocked?: boolean
  content_length?: number
}

export interface EnrichmentSummary {
  artist_id: string
  artist_name: string
  email_found: string | null
  email_confidence: number
  email_source: string
  all_emails: Array<{ email: string; source: string; confidence: number }>
  steps: EnrichmentStep[]
  total_duration_ms: number
  is_contactable: boolean
}

export type ProgressCallback = (step: EnrichmentStep, stepIndex: number) => void

// ============================================================
// CONSTANTS
// ============================================================

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
}

const FETCH_TIMEOUT = 10000 // 10 seconds

const BLOCKED_EMAIL_PATTERNS = [
  'support@', 'help@', 'noreply@', 'no-reply@', 'mailer-daemon@',
  'info@youtube', 'info@instagram', 'info@facebook', 'info@twitter',
  'example@example.com', 'test@test.com', 'admin@', 'webmaster@',
  'postmaster@', 'abuse@', 'privacy@', 'legal@', 'dmca@'
]

const JUNK_DOMAINS = [
  'example.com', 'test.com', 'localhost', 'wixpress.com', 'sentry.io',
  'cloudflare.com', 'googleapis.com', 'w3.org', 'schema.org',
  'spotify.com', 'apple.com', 'youtube.com', 'instagram.com',
  'facebook.com', 'twitter.com', 'tiktok.com', 'x.com'
]

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Check if fetched content appears to be blocked (login wall, consent screen, etc.)
 */
function isBlockedContent(html: string, platform: string): boolean {
  if (!html || html.length < 500) return true

  const blockSignals: Record<string, string[]> = {
    youtube: [
      'consent.youtube.com', 'accounts.google.com/ServiceLogin',
      'before you continue', 'Sign in to confirm', 'This page requires JavaScript'
    ],
    instagram: [
      'Login • Instagram', 'Create an account', 'log in to see',
      'Sign up to see photos', 'Not Found'
    ],
    facebook: [
      'You must log in', 'Log Into Facebook', 'Create new account',
      'Facebook - Log In', 'Sign Up for Facebook'
    ],
  }

  const signals = blockSignals[platform] || []
  return signals.some(signal => html.toLowerCase().includes(signal.toLowerCase()))
}

/**
 * Fetch a URL with timeout and browser-like headers
 */
async function fetchWithTimeout(url: string, timeout: number = FETCH_TIMEOUT): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.text()
  } catch (error: any) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error('Request timeout')
    }
    throw error
  }
}

/**
 * Extract all email addresses from HTML content using regex
 */
function extractEmailsFromHTML(html: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const emails = html.match(emailRegex) || []

  // Filter out common false positives
  return emails.filter(e => {
    const lower = e.toLowerCase()
    
    // Check against junk domains
    const domain = lower.split('@')[1]
    if (JUNK_DOMAINS.some(junk => domain === junk || domain.endsWith('.' + junk))) {
      return false
    }

    // Check against blocked patterns
    if (BLOCKED_EMAIL_PATTERNS.some(pattern => lower.includes(pattern))) {
      return false
    }

    // Check for file extensions (false positives)
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.gif') || 
        lower.endsWith('.svg') || lower.endsWith('.css') || lower.endsWith('.js')) {
      return false
    }

    return true
  })
}

/**
 * Validate that an email was actually present in the fetched content
 * This prevents AI hallucinations
 */
function validateEmail(email: string, rawContent: string): boolean {
  if (!email || !email.includes('@')) return false

  // Check the email was actually in the fetched content
  if (!rawContent.toLowerCase().includes(email.toLowerCase())) {
    console.log(`[Validation Failed] Email "${email}" not found in raw content`)
    return false
  }

  // Check it's not a blocked pattern
  const lower = email.toLowerCase()
  if (BLOCKED_EMAIL_PATTERNS.some(b => lower.includes(b))) {
    console.log(`[Validation Failed] Email "${email}" matches blocked pattern`)
    return false
  }

  // Check domain is not junk
  const domain = lower.split('@')[1]
  if (JUNK_DOMAINS.some(junk => domain === junk || domain.endsWith('.' + junk))) {
    console.log(`[Validation Failed] Email "${email}" has junk domain`)
    return false
  }

  // Basic format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    console.log(`[Validation Failed] Email "${email}" failed format check`)
    return false
  }

  return true
}

/**
 * Call Claude to extract email from page content
 */
async function extractEmailWithAI(
  content: string,
  prompt: string,
  model: string,
  anthropicKey: string
): Promise<{ email: string; source: string; confidence?: string; linktree_urls?: string[] }> {
  try {
    const client = new Anthropic({ apiKey: anthropicKey })
    const response = await client.messages.create({
      model,
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    
    if (match) {
      const parsed = JSON.parse(match[0])
      return parsed
    }

    return { email: '', source: 'none' }
  } catch (error) {
    console.error('[AI Extraction Error]', error)
    return { email: '', source: 'none' }
  }
}

/**
 * Delay helper for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================================
// ENRICHMENT STEPS
// ============================================================

/**
 * STEP 1: YouTube About Tab Email (highest hit rate — 45%)
 * Uses pre-fetched content from batched Apify run if available
 */
async function step1_YouTubeAbout(
  artist: Artist,
  anthropicKey: string,
  preFetchedContent?: Map<string, string>
): Promise<{ emails: string[]; confidence: number; url: string; rawContent: string; apifyUsed: boolean; wasBlocked: boolean }> {
  const socialLinks = artist.social_links || {}
  
  // Find YouTube URL - check both social_links and direct properties
  let youtubeUrl = socialLinks.youtube_url || socialLinks.youtube || (artist as any).youtube_url || ''
  
  // Also search through all social_links entries for YouTube URLs
  if (!youtubeUrl) {
    for (const [key, value] of Object.entries(socialLinks)) {
      if (typeof value === 'string' && (value.includes('youtube.com') || value.includes('youtu.be'))) {
        youtubeUrl = value
        break
      }
    }
  }

  if (!youtubeUrl) {
    return { emails: [], confidence: 0, url: '', rawContent: '', apifyUsed: false, wasBlocked: false }
  }

  // Ensure we have the channel URL and append /about
  let aboutUrl = youtubeUrl
  if (youtubeUrl.includes('/channel/') || youtubeUrl.includes('/@')) {
    aboutUrl = youtubeUrl.replace(/\/$/, '') + '/about'
  } else if (youtubeUrl.includes('/c/')) {
    aboutUrl = youtubeUrl.replace(/\/$/, '') + '/about'
  }

  console.log(`[Step 1] YouTube URL: ${youtubeUrl}`)
  console.log(`[Step 1] About URL: ${aboutUrl}`)

  let html = ''
  let apifyUsed = false
  let wasBlocked = false

  try {
    // TIER 1: Check pre-fetched content from batched Apify run
    if (preFetchedContent && preFetchedContent.size > 0 && preFetchedContent.has(aboutUrl)) {
      html = preFetchedContent.get(aboutUrl) || ''
      apifyUsed = true
      console.log(`[Step 1] Using pre-fetched Apify content: ${html.length} chars`)
    } else if (preFetchedContent && preFetchedContent.size > 0) {
      // Pre-fetch ran but URL wasn't in results — try partial match
      preFetchedContent.forEach((value, key) => {
        if (!html && (key.includes(youtubeUrl.replace(/\/$/, '')) || youtubeUrl.includes(key.replace(/\/about$/, '')))) {
          html = value
          apifyUsed = true
          console.log(`[Step 1] Using pre-fetched content (partial match ${key}): ${html.length} chars`)
        }
      })
    }

    // TIER 2: Single Apify fetch if no pre-fetched content
    if (!html && process.env.APIFY_TOKEN) {
      console.log(`[Step 1] No pre-fetched content, calling apifyFetch directly...`)
      const apifyResult = await apifyFetch(aboutUrl)
      if (apifyResult.success && apifyResult.html.length > 100) {
        html = apifyResult.html
        apifyUsed = true
        console.log(`[Step 1] Apify single fetch success: ${html.length} chars`)
      } else {
        console.log(`[Step 1] Apify single fetch failed: ${apifyResult.error || 'empty content'}`)
      }
    }

    // TIER 3: Direct fetch as last resort
    if (!html) {
      console.log(`[Step 1] Falling back to direct fetch...`)
      html = await fetchWithTimeout(aboutUrl)
      wasBlocked = isBlockedContent(html, 'youtube')
      console.log(`[Step 1] Direct fetch: ${html.length} chars, blocked=${wasBlocked}`)
    }

    // If blocked and no content, return empty
    if (wasBlocked && html.length < 500) {
      console.log(`[Step 1] Content blocked, no usable content`)
      return { emails: [], confidence: 0, url: aboutUrl, rawContent: html, apifyUsed, wasBlocked: true }
    }

    // TIER 3: Extract emails from HTML
    const $ = cheerio.load(html)
    const pageText = $('body').text()

    const directEmails = extractEmailsFromHTML(html)
    if (directEmails.length > 0) {
      console.log(`[Step 1] Found direct emails: ${directEmails.join(', ')}`)
      return { emails: directEmails, confidence: 0.85, url: aboutUrl, rawContent: html, apifyUsed, wasBlocked }
    }

    // TIER 3b: AI extraction
    const prompt = `You are extracting a real email address from a YouTube channel's About page.
Here is the actual page content from the About tab of "${artist.name}"'s YouTube channel:

---
${pageText.slice(0, 3000)}
---

Extract any email address that appears in this content. This must be a real email you can see in the text above.
If there is no email address visible in the content, return an empty string.
NEVER guess, infer, or construct an email. Only return what you can literally see in the page content.

Return JSON only: {"email": "found@email.com", "source": "YouTube About tab"}
If no email found: {"email": "", "source": "none"}`

    const result = await extractEmailWithAI(html, prompt, 'claude-sonnet-4-5-20250929', anthropicKey)
    
    if (result.email && validateEmail(result.email, html)) {
      return { emails: [result.email], confidence: 0.85, url: aboutUrl, rawContent: html, apifyUsed, wasBlocked }
    }

    return { emails: [], confidence: 0, url: aboutUrl, rawContent: html, apifyUsed, wasBlocked }
  } catch (error: any) {
    console.error('[Step 1 Error]', error.message)
    return { emails: [], confidence: 0, url: aboutUrl, rawContent: '', apifyUsed, wasBlocked }
  }
}

/**
 * STEP 2: Instagram Bio Email
 * Uses pre-fetched content from batched Apify run if available
 */
async function step2_InstagramBio(
  artist: Artist,
  anthropicKey: string,
  preFetchedContent?: Map<string, string>
): Promise<{ emails: string[]; confidence: number; url: string; rawContent: string; linktreeUrls: string[]; apifyUsed: boolean; wasBlocked: boolean }> {
  const socialLinks = artist.social_links || {}
  
  // Find Instagram URL - check both URL and handle formats
  let instagramUrl = socialLinks.instagram_url || socialLinks.instagram || (artist as any).instagram_url || ''
  
  // If we have a handle but no URL, construct the URL
  if (!instagramUrl && artist.instagram_handle) {
    instagramUrl = `https://www.instagram.com/${artist.instagram_handle}/`
  }
  
  // Also search through all social_links entries for Instagram URLs
  if (!instagramUrl) {
    for (const [key, value] of Object.entries(socialLinks)) {
      if (typeof value === 'string' && value.includes('instagram.com')) {
        instagramUrl = value
        break
      }
    }
  }
  
  if (!instagramUrl) {
    return { emails: [], confidence: 0, url: '', rawContent: '', linktreeUrls: [], apifyUsed: false, wasBlocked: false }
  }

  console.log(`[Step 2] Instagram URL: ${instagramUrl}`)

  // Extract handle for logging/AI prompts
  const handle = artist.instagram_handle || instagramUrl.split('instagram.com/')[1]?.replace(/\//g, '') || 'artist'

  let html = ''
  let apifyUsed = false
  let wasBlocked = false
  let linktreeUrls: string[] = []

  try {
    // TIER 1: Check pre-fetched content from batched Apify run
    if (preFetchedContent && preFetchedContent.size > 0 && preFetchedContent.has(instagramUrl)) {
      html = preFetchedContent.get(instagramUrl) || ''
      apifyUsed = true
      console.log(`[Step 2] Using pre-fetched Apify content: ${html.length} chars`)
    }

    // TIER 2: Single Apify fetch if no pre-fetched content
    if (!html && process.env.APIFY_TOKEN) {
      console.log(`[Step 2] No pre-fetched content, calling apifyFetch directly...`)
      const apifyResult = await apifyFetch(instagramUrl)
      if (apifyResult.success && apifyResult.html.length > 100) {
        html = apifyResult.html
        apifyUsed = true
        console.log(`[Step 2] Apify single fetch success: ${html.length} chars`)
      } else {
        console.log(`[Step 2] Apify single fetch failed: ${apifyResult.error || 'empty content'}`)
      }
    }

    // TIER 3: Direct fetch as last resort
    if (!html) {
      console.log(`[Step 2] Falling back to direct fetch...`)
      html = await fetchWithTimeout(instagramUrl)
      wasBlocked = isBlockedContent(html, 'instagram')
      console.log(`[Step 2] Direct fetch: ${html.length} chars, blocked=${wasBlocked}`)
    }

    // If blocked and no content, return empty
    if (wasBlocked && html.length < 500) {
      console.log(`[Step 2] Content blocked, no usable content`)
      return { emails: [], confidence: 0, url: instagramUrl, rawContent: html, linktreeUrls: [], apifyUsed, wasBlocked: true }
    }

    // If still blocked after Apify attempt, return empty
    if (wasBlocked) {
      console.log(`[Step 2] Content blocked and no Apify fallback available`)
      return { emails: [], confidence: 0, url: instagramUrl, rawContent: html, linktreeUrls: [], apifyUsed, wasBlocked: true }
    }

    // TIER 3: Extract emails from HTML
    const $ = cheerio.load(html)
    const ogDescription = $('meta[property="og:description"]').attr('content') || ''
    const pageText = $('body').text()

    // Try to extract emails directly
    const directEmails = extractEmailsFromHTML(html)
    if (directEmails.length > 0) {
      console.log(`[Step 2] Found direct emails: ${directEmails.join(', ')}`)
      return { emails: directEmails, confidence: 0.8, url: instagramUrl, rawContent: html, linktreeUrls, apifyUsed, wasBlocked }
    }

    // Extract link-in-bio URLs if not already found by Apify
    if (linktreeUrls.length === 0) {
      const linktreePatterns = ['linktr.ee', 'beacons.ai', 'stan.store', 'solo.to', 'lnk.to', 'linkin.bio', 'linkfire', 'fanlink', 'smarturl']
      
      $('a').each((i, el) => {
        const href = $(el).attr('href')
        if (href && linktreePatterns.some(pattern => href.includes(pattern))) {
          linktreeUrls.push(href)
        }
      })
    }

    // TIER 3b: AI extraction
    const prompt = `You are extracting a real email address from an Instagram profile page.
Here is the actual page content/meta data from @${handle}'s Instagram:

Bio: ${ogDescription}
Page text: ${pageText.slice(0, 2000)}

Extract any email address that appears in this content.
Also extract any link-in-bio URLs (linktree, beacons, stan.store, solo.to, lnk.to, etc.)
NEVER guess or construct an email. Only return what you can literally see.

Return JSON only: {"email": "found@email.com", "source": "Instagram bio", "linktree_urls": ["url1", "url2"]}
If no email: {"email": "", "source": "none", "linktree_urls": ["any urls found"]}`

    const result = await extractEmailWithAI(html, prompt, 'claude-sonnet-4-5-20250929', anthropicKey)
    
    const foundLinktreeUrls = result.linktree_urls || linktreeUrls

    if (result.email && validateEmail(result.email, html)) {
      return { emails: [result.email], confidence: 0.8, url: instagramUrl, rawContent: html, linktreeUrls: foundLinktreeUrls, apifyUsed, wasBlocked }
    }

    return { emails: [], confidence: 0, url: instagramUrl, rawContent: html, linktreeUrls: foundLinktreeUrls, apifyUsed, wasBlocked }
  } catch (error: any) {
    console.error('[Step 2 Error]', error.message)
    return { emails: [], confidence: 0, url: instagramUrl, rawContent: '', linktreeUrls: [], apifyUsed, wasBlocked }
  }
}

/**
 * STEP 3: Link-in-Bio Pages (Linktree, Beacons, etc.)
 * Uses smart fetch: direct first, Apify fallback for small content
 */
async function step3_LinkInBio(
  artist: Artist,
  linktreeUrls: string[],
  anthropicKey: string
): Promise<{ emails: string[]; confidence: number; url: string; rawContent: string; apifyUsed: boolean; wasBlocked: boolean }> {
  if (linktreeUrls.length === 0) {
    return { emails: [], confidence: 0, url: '', rawContent: '', apifyUsed: false, wasBlocked: false }
  }

  let allContent = ''
  let allEmails: string[] = []
  let lastUrl = ''
  let anyApifyUsed = false

  for (const url of linktreeUrls.slice(0, 3)) { // Max 3 link-in-bio pages
    console.log(`[Step 3] Fetching link-in-bio: ${url}`)
    
    try {
      await delay(1000) // Rate limiting
      
      // Use smart fetch: try direct first, Apify if content too small
      const { html, method } = await smartFetch(url)
      if (method === 'apify') anyApifyUsed = true
      
      const $ = cheerio.load(html)
      
      allContent += html + '\n\n'
      lastUrl = url

      // Extract emails directly
      const directEmails = extractEmailsFromHTML(html)
      allEmails.push(...directEmails)

      // Look for contact/booking page links
      const contactLinks: string[] = []
      $('a').each((i, el) => {
        const href = $(el).attr('href')
        const text = $(el).text().toLowerCase()
        if (href && (text.includes('contact') || text.includes('booking') || text.includes('management'))) {
          if (href.startsWith('http')) {
            contactLinks.push(href)
          }
        }
      })

      // Fetch contact pages (max 3)
      for (const contactUrl of contactLinks.slice(0, 3)) {
        try {
          await delay(1000)
          const { html: contactHtml, method } = await smartFetch(contactUrl)
          if (method === 'apify') anyApifyUsed = true
          allContent += contactHtml + '\n\n'
          const contactEmails = extractEmailsFromHTML(contactHtml)
          allEmails.push(...contactEmails)
        } catch (e) {
          // Continue
        }
      }
    } catch (error: any) {
      console.error(`[Step 3 Error] ${url}:`, error.message)
    }
  }

  // If we found direct emails, return them
  if (allEmails.length > 0) {
    console.log(`[Step 3] Found direct emails: ${allEmails.join(', ')}`)
    return { emails: Array.from(new Set(allEmails)), confidence: 0.75, url: lastUrl, rawContent: allContent, apifyUsed: anyApifyUsed, wasBlocked: false }
  }

  // Use AI to extract
  if (allContent) {
    const prompt = `You are extracting a real email address from a music artist's link-in-bio page.
Artist: "${artist.name}"
Here is the actual content from their link-in-bio page(s):

---
${allContent.slice(0, 4000)}
---

Extract any email address visible in this content. Look for:
- Direct email addresses in text
- mailto: links
- Contact/booking page content
NEVER guess or construct an email. Only return what you can literally see.

Return JSON only: {"email": "found@email.com", "source": "Linktree/link-in-bio"}
If no email: {"email": "", "source": "none"}`

    const result = await extractEmailWithAI(allContent, prompt, 'claude-sonnet-4-5-20250929', anthropicKey)
    
    if (result.email && validateEmail(result.email, allContent)) {
      return { emails: [result.email], confidence: 0.75, url: lastUrl, rawContent: allContent, apifyUsed: anyApifyUsed, wasBlocked: false }
    }
  }

  return { emails: [], confidence: 0, url: lastUrl, rawContent: allContent, apifyUsed: anyApifyUsed, wasBlocked: false }
}

/**
 * STEP 4: Artist Website Contact Page
 * Uses pre-fetched content from batched Apify run if available
 */
async function step4_WebsiteContact(
  artist: Artist,
  anthropicKey: string,
  preFetchedContent?: Map<string, string>
): Promise<{ emails: string[]; confidence: number; url: string; rawContent: string; apifyUsed: boolean; wasBlocked: boolean }> {
  const socialLinks = artist.social_links || {}
  let websiteUrl = artist.website || socialLinks.website || ''

  if (!websiteUrl) {
    return { emails: [], confidence: 0, url: '', rawContent: '', apifyUsed: false, wasBlocked: false }
  }

  // Ensure URL has protocol
  if (!websiteUrl.startsWith('http')) {
    websiteUrl = 'https://' + websiteUrl
  }

  console.log(`[Step 4] Fetching website: ${websiteUrl}`)

  let allContent = ''
  let allEmails: string[] = []
  let apifyUsed = false

  try {
    // Check for pre-fetched homepage
    let html = ''
    if (preFetchedContent && preFetchedContent.has(websiteUrl)) {
      html = preFetchedContent.get(websiteUrl) || ''
      apifyUsed = true
      console.log(`[Step 4] Using pre-fetched homepage: ${html.length} chars`)
    } else {
      html = await fetchWithTimeout(websiteUrl)
    }
    
    const $ = cheerio.load(html)
    allContent += html + '\n\n'

    // Extract direct emails
    const directEmails = extractEmailsFromHTML(html)
    allEmails.push(...directEmails)

    // Find contact/booking/management pages
    const contactLinks: string[] = []
    $('a').each((i, el) => {
      const href = $(el).attr('href')
      const text = $(el).text().toLowerCase()
      
      if (href && (
        text.includes('contact') || text.includes('booking') || 
        text.includes('management') || text.includes('about') || 
        text.includes('press') || href.toLowerCase().includes('contact') ||
        href.toLowerCase().includes('booking')
      )) {
        let fullUrl = href
        if (href.startsWith('/')) {
          const base = new URL(websiteUrl)
          fullUrl = `${base.protocol}//${base.host}${href}`
        } else if (!href.startsWith('http')) {
          fullUrl = `${websiteUrl.replace(/\/$/, '')}/${href}`
        }
        contactLinks.push(fullUrl)
      }
    })

    // Fetch contact pages (max 3)
    for (const contactUrl of contactLinks.slice(0, 3)) {
      try {
        await delay(1000)
        console.log(`[Step 4] Fetching contact page: ${contactUrl}`)
        
        // Check for pre-fetched contact page
        let contactHtml = ''
        if (preFetchedContent && preFetchedContent.has(contactUrl)) {
          contactHtml = preFetchedContent.get(contactUrl) || ''
          apifyUsed = true
          console.log(`[Step 4] Using pre-fetched contact page: ${contactHtml.length} chars`)
        } else {
          contactHtml = await fetchWithTimeout(contactUrl)
        }
        
        allContent += contactHtml + '\n\n'
        const contactEmails = extractEmailsFromHTML(contactHtml)
        allEmails.push(...contactEmails)
      } catch (e) {
        // Continue
      }
    }

    // If we found direct emails, return them
    if (allEmails.length > 0) {
      console.log(`[Step 4] Found direct emails: ${allEmails.join(', ')}`)
      return { emails: Array.from(new Set(allEmails)), confidence: 0.8, url: websiteUrl, rawContent: allContent, apifyUsed, wasBlocked: false }
    }

    // Use AI to extract
    const prompt = `You are extracting a real email address from a music artist's website.
Artist: "${artist.name}"
Here is the actual content from their website and contact/booking pages:

---
${allContent.slice(0, 5000)}
---

Extract any email address visible in this content. Prioritize booking@ or management@ addresses.
NEVER guess or construct an email. Only return what you can literally see.

Return JSON only: {"email": "found@email.com", "source": "Artist website", "email_type": "booking|management|personal|unknown"}
If no email: {"email": "", "source": "none"}`

    const result = await extractEmailWithAI(allContent, prompt, 'claude-sonnet-4-5-20250929', anthropicKey)
    
    if (result.email && validateEmail(result.email, allContent)) {
      return { emails: [result.email], confidence: 0.8, url: websiteUrl, rawContent: allContent, apifyUsed, wasBlocked: false }
    }

    return { emails: [], confidence: 0, url: websiteUrl, rawContent: allContent, apifyUsed, wasBlocked: false }
  } catch (error: any) {
    console.error('[Step 4 Error]', error.message)
    return { emails: [], confidence: 0, url: websiteUrl, rawContent: '', apifyUsed, wasBlocked: false }
  }
}

/**
 * STEP 5: Facebook About Section
 * Uses pre-fetched content from batched Apify run if available
 */
async function step5_FacebookAbout(
  artist: Artist,
  anthropicKey: string,
  preFetchedContent?: Map<string, string>
): Promise<{ emails: string[]; confidence: number; url: string; rawContent: string; apifyUsed: boolean; wasBlocked: boolean }> {
  const socialLinks = artist.social_links || {}
  
  // Find Facebook URL - check both social_links and direct properties
  let facebookUrl = socialLinks.facebook_url || socialLinks.facebook || (artist as any).facebook_url || ''
  
  // Also search through all social_links entries for Facebook URLs
  if (!facebookUrl) {
    for (const [key, value] of Object.entries(socialLinks)) {
      if (typeof value === 'string' && (value.includes('facebook.com') || value.includes('fb.com'))) {
        facebookUrl = value
        break
      }
    }
  }

  if (!facebookUrl) {
    return { emails: [], confidence: 0, url: '', rawContent: '', apifyUsed: false, wasBlocked: false }
  }

  // Ensure we have the about page
  let aboutUrl = facebookUrl.replace(/\/$/, '') + '/about'

  console.log(`[Step 5] Facebook URL: ${facebookUrl}`)
  console.log(`[Step 5] Fetching Facebook About: ${aboutUrl}`)

  let apifyUsed = false
  let wasBlocked = false

  try {
    // Check for pre-fetched content
    let html = ''
    if (preFetchedContent && preFetchedContent.has(aboutUrl)) {
      html = preFetchedContent.get(aboutUrl) || ''
      apifyUsed = true
      console.log(`[Step 5] Using pre-fetched content: ${html.length} chars`)
    } else {
      html = await fetchWithTimeout(aboutUrl)
      wasBlocked = isBlockedContent(html, 'facebook')
    }

    const $ = cheerio.load(html)

    // Extract text content
    const pageText = $('body').text()

    // Try to extract emails directly
    const directEmails = extractEmailsFromHTML(html)
    if (directEmails.length > 0) {
      console.log(`[Step 5] Found direct emails: ${directEmails.join(', ')}`)
      return { emails: directEmails, confidence: 0.7, url: aboutUrl, rawContent: html, apifyUsed, wasBlocked }
    }

    // Use AI (Haiku for cost savings on simpler task)
    const prompt = `Extract any email address from this Facebook page content for artist "${artist.name}":

---
${pageText.slice(0, 2000)}
---

Only return emails you can literally see. Never guess.
Return JSON only: {"email": "found@email.com", "source": "Facebook About"}
If none: {"email": "", "source": "none"}`

    const result = await extractEmailWithAI(html, prompt, 'claude-haiku-4-5-20251001', anthropicKey)
    
    if (result.email && validateEmail(result.email, html)) {
      return { emails: [result.email], confidence: 0.7, url: aboutUrl, rawContent: html, apifyUsed, wasBlocked }
    }

    return { emails: [], confidence: 0, url: aboutUrl, rawContent: html, apifyUsed, wasBlocked }
  } catch (error: any) {
    console.error('[Step 5 Error]', error.message)
    return { emails: [], confidence: 0, url: aboutUrl, rawContent: '', apifyUsed, wasBlocked }
  }
}

/**
 * STEP 6: All Remaining Socials Sweep (last resort)
 * Uses pre-fetched content from batched Apify run if available
 */
async function step6_RemainingSocials(
  artist: Artist,
  anthropicKey: string,
  preFetchedContent?: Map<string, string>
): Promise<{ emails: string[]; confidence: number; url: string; rawContent: string; apifyUsed: boolean; wasBlocked: boolean }> {
  const socialLinks = artist.social_links || {}
  let allContent = ''
  let allEmails: string[] = []
  let lastUrl = ''
  let apifyUsed = false

  const socialUrls: { platform: string; url: string }[] = []

  // Twitter/X - check both social_links and direct properties
  const twitterUrl = socialLinks.twitter_url || socialLinks.twitter || (artist as any).twitter_url
  if (twitterUrl) {
    socialUrls.push({ platform: 'Twitter/X', url: twitterUrl })
  }

  // TikTok
  const tiktokUrl = socialLinks.tiktok_url || socialLinks.tiktok || (artist as any).tiktok_url
  if (tiktokUrl) {
    socialUrls.push({ platform: 'TikTok', url: tiktokUrl })
  }

  // Spotify
  const spotifyUrl = socialLinks.spotify_url || socialLinks.spotify || (artist as any).spotify_url
  if (spotifyUrl) {
    socialUrls.push({ platform: 'Spotify', url: spotifyUrl })
  }

  // Also collect any other social URLs from social_links
  for (const [key, value] of Object.entries(socialLinks)) {
    if (typeof value === 'string' && value.startsWith('http')) {
      if ((value.includes('twitter.com') || value.includes('x.com')) && !twitterUrl) {
        socialUrls.push({ platform: 'Twitter/X', url: value })
      } else if (value.includes('tiktok.com') && !tiktokUrl) {
        socialUrls.push({ platform: 'TikTok', url: value })
      } else if (value.includes('spotify.com') && !spotifyUrl) {
        socialUrls.push({ platform: 'Spotify', url: value })
      }
    }
  }

  if (socialUrls.length === 0) {
    return { emails: [], confidence: 0, url: '', rawContent: '', apifyUsed: false, wasBlocked: false }
  }

  console.log(`[Step 6] Collected social URLs:`, socialUrls.map(s => `${s.platform}: ${s.url}`))

  console.log(`[Step 6] Fetching remaining socials: ${socialUrls.map(s => s.platform).join(', ')}`)

  for (const { platform, url } of socialUrls.slice(0, 3)) {
    try {
      await delay(1000)
      
      // Check for pre-fetched content
      let html = ''
      if (preFetchedContent && preFetchedContent.has(url)) {
        html = preFetchedContent.get(url) || ''
        apifyUsed = true
        console.log(`[Step 6] Using pre-fetched ${platform}: ${html.length} chars`)
      } else {
        html = await fetchWithTimeout(url)
      }
      
      allContent += `\n\n=== ${platform} ===\n${html}\n`
      lastUrl = url

      const directEmails = extractEmailsFromHTML(html)
      allEmails.push(...directEmails)
    } catch (error: any) {
      console.error(`[Step 6 Error] ${platform}:`, error.message)
    }
  }

  // If we found direct emails, return them
  if (allEmails.length > 0) {
    console.log(`[Step 6] Found direct emails: ${allEmails.join(', ')}`)
    return { emails: Array.from(new Set(allEmails)), confidence: 0.6, url: lastUrl, rawContent: allContent, apifyUsed, wasBlocked: false }
  }

  // Use AI for final comprehensive check
  if (allContent) {
    const prompt = `You are doing a final sweep to find a contact email for music artist "${artist.name}".
Here is content collected from their remaining social profiles:

${allContent.slice(0, 4000)}

Extract any email address you can literally see in the content above.
If you cannot find any real email in this content, return empty string.
NEVER guess, infer, construct, or derive an email address.
The email MUST appear as text in the content above.

Return JSON only:
{
  "email": "found@email.com or empty string",
  "source": "where exactly you found it",
  "email_type": "personal|booking|management|label|unknown",
  "confidence": "high|medium|low"
}`

    const result = await extractEmailWithAI(allContent, prompt, 'claude-sonnet-4-5-20250929', anthropicKey)
    
    if (result.email && validateEmail(result.email, allContent)) {
      const confidenceMap: Record<string, number> = { high: 0.7, medium: 0.5, low: 0.3 }
      const confidence = confidenceMap[result.confidence || 'low'] || 0.5
      return { emails: [result.email], confidence, url: lastUrl, rawContent: allContent, apifyUsed, wasBlocked: false }
    }
  }

  return { emails: [], confidence: 0, url: lastUrl, rawContent: allContent, apifyUsed, wasBlocked: false }
}

// ============================================================
// MAIN PIPELINE
// ============================================================

/**
 * Run the full enrichment pipeline on an artist.
 * Stops early when a validated email is found.
 * Calls onProgress after each step for real-time UI updates.
 */
export async function enrichArtist(
  artist: Artist,
  apiKeys: {
    anthropic?: string
  },
  onProgress?: ProgressCallback
): Promise<EnrichmentSummary> {
  const startTime = Date.now()
  
  if (!apiKeys.anthropic) {
    throw new Error('Anthropic API key is required for enrichment')
  }

  const steps: EnrichmentStep[] = [
    { method: 'youtube_about', label: 'YouTube About Tab', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
    { method: 'instagram_bio', label: 'Instagram Bio', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
    { method: 'link_in_bio', label: 'Link-in-Bio Pages', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
    { method: 'website_contact', label: 'Website Contact Page', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
    { method: 'facebook_about', label: 'Facebook About', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
    { method: 'remaining_socials', label: 'Remaining Socials Sweep', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
  ]

  const allEmails: Array<{ email: string; source: string; confidence: number }> = []
  let bestEmail = ''
  let bestConfidence = 0
  let bestSource = ''
  let linktreeUrls: string[] = []

  console.log(`\n[Enrichment Start] Artist: ${artist.name} (${artist.id})`)
  console.log(`[Enrichment] APIFY_TOKEN present: ${!!process.env.APIFY_TOKEN}`)
  console.log(`[Enrichment] Social links:`, JSON.stringify(artist.social_links || {}))

  // OPTIMIZATION: Batch fetch all URLs upfront using Apify
  // This turns 6 separate Apify runs into 1, saving time and cost
  const useApifyBatch = !!process.env.APIFY_TOKEN
  let pageContents = new Map<string, string>()

  if (useApifyBatch) {
    console.log(`[Enrichment] Using batched Apify fetch for all URLs...`)
    const urls = collectArtistUrls(artist)
    console.log(`[Enrichment] Collected ${urls.length} URLs:`, urls)
    if (urls.length > 0) {
      console.log(`[Enrichment] Calling apifyFetchMultiple...`)
      pageContents = await apifyFetchMultiple(urls)
      console.log(`[Enrichment] Batched fetch complete: ${pageContents.size} pages loaded`)
    } else {
      console.log(`[Enrichment] No URLs collected, skipping Apify batch fetch`)
    }
  } else {
    console.log(`[Enrichment] Apify batch fetch disabled (no APIFY_TOKEN)`)
  }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    step.status = 'running'
    onProgress?.(step, i)

    const stepStart = Date.now()

    try {
      let result: { 
        emails: string[]
        confidence: number
        url: string
        rawContent: string
        linktreeUrls?: string[]
        apifyUsed?: boolean
        wasBlocked?: boolean
      }

      switch (step.method) {
        case 'youtube_about':
          result = await step1_YouTubeAbout(artist, apiKeys.anthropic, pageContents)
          break
        case 'instagram_bio':
          result = await step2_InstagramBio(artist, apiKeys.anthropic, pageContents)
          linktreeUrls = result.linktreeUrls || []
          break
        case 'link_in_bio':
          result = await step3_LinkInBio(artist, linktreeUrls, apiKeys.anthropic)
          break
        case 'website_contact':
          result = await step4_WebsiteContact(artist, apiKeys.anthropic, pageContents)
          break
        case 'facebook_about':
          result = await step5_FacebookAbout(artist, apiKeys.anthropic, pageContents)
          break
        case 'remaining_socials':
          result = await step6_RemainingSocials(artist, apiKeys.anthropic, pageContents)
          break
        default:
          result = { emails: [], confidence: 0, url: '', rawContent: '', apifyUsed: false, wasBlocked: false }
      }

      step.duration_ms = Date.now() - stepStart
      step.url_fetched = result.url
      step.emails_found = result.emails
      step.confidence = result.confidence
      step.apify_used = result.apifyUsed || false
      step.was_blocked = result.wasBlocked || false
      step.content_length = result.rawContent?.length || 0

      if (step.emails_found.length > 0) {
        step.status = 'success'
        step.best_email = step.emails_found[0]

        console.log(`[Step ${i + 1} Success] Found: ${step.emails_found.join(', ')}`)

        for (const email of step.emails_found) {
          allEmails.push({ email, source: step.method, confidence: result.confidence })
        }

        // Update best if this is higher confidence
        if (result.confidence > bestConfidence) {
          bestEmail = step.emails_found[0]
          bestConfidence = result.confidence
          bestSource = step.method
        }

        onProgress?.(step, i)

        // Early termination — we found a valid email, skip remaining steps
        console.log(`[Early Termination] Email found, skipping remaining steps`)
        for (let j = i + 1; j < steps.length; j++) {
          steps[j].status = 'skipped'
        }
        break
      } else {
        step.status = 'failed'
        console.log(`[Step ${i + 1} Failed] No email found`)
      }
    } catch (error: any) {
      step.status = 'failed'
      step.error = error.message
      step.duration_ms = Date.now() - stepStart
      console.error(`[Step ${i + 1} Error]`, error.message)
    }

    onProgress?.(step, i)

    // Rate limiting between steps
    if (i < steps.length - 1 && steps[i + 1].status !== 'skipped') {
      await delay(1000)
    }
  }

  const summary: EnrichmentSummary = {
    artist_id: artist.id,
    artist_name: artist.name,
    email_found: bestEmail || null,
    email_confidence: bestConfidence,
    email_source: bestSource,
    all_emails: allEmails,
    steps,
    total_duration_ms: Date.now() - startTime,
    is_contactable: !!bestEmail,
  }

  console.log(`[Enrichment Complete] ${bestEmail ? `✅ Found: ${bestEmail}` : '❌ No email found'} (${summary.total_duration_ms}ms)\n`)

  return summary
}

// ============================================================
// BATCH ENRICHMENT
// ============================================================

/**
 * Enrich multiple artists with delay between each to respect rate limits.
 */
export async function enrichBatch(
  artists: Artist[],
  apiKeys: { anthropic?: string },
  onArtistComplete?: (summary: EnrichmentSummary, index: number, total: number) => void,
  delayMs: number = 2000 // 2 seconds between artists
): Promise<{
  results: EnrichmentSummary[]
  total: number
  found: number
  hit_rate: number
}> {
  const results: EnrichmentSummary[] = []

  for (let i = 0; i < artists.length; i++) {
    console.log(`\n========== Enriching Artist ${i + 1}/${artists.length} ==========`)
    const summary = await enrichArtist(artists[i], apiKeys)
    results.push(summary)
    onArtistComplete?.(summary, i, artists.length)

    // Delay between artists
    if (i < artists.length - 1) {
      console.log(`[Rate Limiting] Waiting ${delayMs}ms before next artist...`)
      await delay(delayMs)
    }
  }

  const found = results.filter(r => r.is_contactable).length

  return {
    results,
    total: artists.length,
    found,
    hit_rate: artists.length > 0 ? found / artists.length : 0,
  }
}
