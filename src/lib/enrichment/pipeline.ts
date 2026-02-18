/**
 * Email Enrichment Pipeline — PLATFORM-SPECIFIC APIFY ACTORS
 *
 * Each social platform uses a dedicated Apify actor that bypasses anti-bot protections.
 * The generic website-content-crawler only handles Linktree pages and artist websites.
 *
 * Pipeline flow (stops on first validated email):
 *   Step 0: YouTube Discovery (YouTube Data API + Haiku verify)
 *   Step 1: YouTube  (streamers~youtube-scraper)       — ~45% hit rate
 *   Step 2: Instagram (apify~instagram-profile-scraper) — bio + businessEmail
 *   Step 3: Link-in-Bio (direct fetch → apify~website-content-crawler fallback)
 *   Step 4: Artist Website (direct fetch → apify~website-content-crawler fallback)
 *   Step 5: Facebook — SKIPPED (requires login, unreliable)
 *   Step 6: Remaining socials — SKIPPED (Twitter/Spotify/TikTok block scraping)
 *   Step 7: Perplexity YouTube Deep Dive — focused YT channel email extraction
 *   Step 8: Perplexity Instagram Deep Dive — focused IG profile email extraction
 *   Step 9: Perplexity Generic Web Search — last-resort catch-all
 *
 * Cost: ~$0.013 per artist (scraping) + ~$0.019 per Perplexity step
 */

import Anthropic from '@anthropic-ai/sdk'
import * as cheerio from 'cheerio'
import type { Artist } from '@/types/database'
import {
  apifyFetchYouTube,
  apifyFetchInstagram,
  apifyFetchWebPage,
  directFetch,
  isLinktreeDomain,
  isTicketingPlatform,
  isBlockedContent,
  findYouTubeUrl,
  findInstagramHandle,
  findWebsiteUrl,
} from './apify-fetch'
import { discoverYouTubeChannel, fetchYouTubeDescription } from './youtube-api'
import { filterEmails } from '@/lib/qualification/email-filter'

// ============================================================
// TYPES
// ============================================================

export interface EnrichmentStep {
  method: string
  label: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped'
  emails_found: string[]
  rejected_emails?: Array<{ email: string; reason: string }>
  best_email: string
  confidence: number
  error?: string
  error_details?: string
  duration_ms?: number
  url_fetched?: string
  apify_used?: boolean
  apify_actor?: string
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
  all_rejected_emails: Array<{ email: string; source: string; reason: string }>
  steps: EnrichmentStep[]
  total_duration_ms: number
  is_contactable: boolean
  error_details?: string
  discovered_youtube_url?: string
  discovered_website?: string
  discovered_linktree_url?: string
  discovered_management?: string
  discovered_booking_agent?: string
}

export type ProgressCallback = (step: EnrichmentStep, stepIndex: number) => void

// ============================================================
// CONSTANTS
// ============================================================

const BLOCKED_EMAIL_PATTERNS = [
  'support@', 'help@', 'noreply@', 'no-reply@', 'mailer-daemon@',
  'info@youtube', 'info@instagram', 'info@facebook', 'info@twitter',
  'example@example.com', 'test@test.com', 'admin@', 'webmaster@',
  'postmaster@', 'abuse@', 'privacy@', 'legal@', 'dmca@',
]

const JUNK_DOMAINS = [
  'example.com', 'test.com', 'localhost', 'wixpress.com', 'sentry.io',
  'cloudflare.com', 'googleapis.com', 'w3.org', 'schema.org',
  'spotify.com', 'apple.com', 'youtube.com', 'instagram.com',
  'facebook.com', 'twitter.com', 'tiktok.com', 'x.com',
]

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Extract all email addresses from text content using regex
 */
function extractEmailsFromText(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const emails = text.match(emailRegex) || []

  return emails.filter(e => {
    const lower = e.toLowerCase()
    const domain = lower.split('@')[1]

    if (JUNK_DOMAINS.some(junk => domain === junk || domain.endsWith('.' + junk))) {
      return false
    }
    if (BLOCKED_EMAIL_PATTERNS.some(pattern => lower.includes(pattern))) {
      return false
    }
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.gif') ||
        lower.endsWith('.svg') || lower.endsWith('.css') || lower.endsWith('.js')) {
      return false
    }
    return true
  })
}

/**
 * Validate that an email was actually present in the fetched content (anti-hallucination)
 */
function validateEmail(email: string, rawContent: string): boolean {
  if (!email || !email.includes('@')) return false

  if (!rawContent.toLowerCase().includes(email.toLowerCase())) {
    console.log(`[Validation Failed] Email "${email}" not found in raw content`)
    return false
  }

  const lower = email.toLowerCase()
  if (BLOCKED_EMAIL_PATTERNS.some(b => lower.includes(b))) {
    console.log(`[Validation Failed] Email "${email}" matches blocked pattern`)
    return false
  }

  const domain = lower.split('@')[1]
  if (JUNK_DOMAINS.some(junk => domain === junk || domain.endsWith('.' + junk))) {
    console.log(`[Validation Failed] Email "${email}" has junk domain`)
    return false
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    console.log(`[Validation Failed] Email "${email}" failed format check`)
    return false
  }

  return true
}

/**
 * Validate an email without requiring it to appear in raw content.
 * Used when the email comes directly from a structured API field (e.g. businessEmail).
 */
function validateEmailFormat(email: string): boolean {
  if (!email || !email.includes('@')) return false

  const lower = email.toLowerCase()
  if (BLOCKED_EMAIL_PATTERNS.some(b => lower.includes(b))) return false

  const domain = lower.split('@')[1]
  if (JUNK_DOMAINS.some(junk => domain === junk || domain.endsWith('.' + junk))) return false

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
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
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)

    if (match) {
      try {
        return JSON.parse(match[0])
      } catch {
        console.warn(`[AI Extraction] Failed to parse JSON from AI response: ${match[0].slice(0, 200)}`)
        return { email: '', source: 'none' }
      }
    }

    return { email: '', source: 'none' }
  } catch (error) {
    console.error('[AI Extraction Error]', error)
    return { email: '', source: 'none' }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================================
// STEP 0: YouTube Discovery (YouTube Data API + Haiku verify)
// ============================================================

async function step0_YouTubeDiscovery(
  artist: Artist,
  anthropicKey: string
): Promise<{
  emails: string[]; confidence: number; url: string; rawContent: string;
  apifyUsed: boolean; apifyActor: string; wasBlocked: boolean; errorDetails?: string;
  discoveredYouTubeUrl?: string
}> {
  const empty = { emails: [], confidence: 0, url: '', rawContent: '', apifyUsed: false, apifyActor: 'youtube-data-api', wasBlocked: false }

  const youtubeApiKey = process.env.YOUTUBE_API_KEY
  if (!youtubeApiKey) {
    console.log('[Step 0] No YOUTUBE_API_KEY configured, skipping discovery')
    return { ...empty, errorDetails: 'No YOUTUBE_API_KEY configured' }
  }

  const existingUrl = findYouTubeUrl(artist)

  // CASE A: Artist already has a YouTube URL — fetch the description via Data API
  if (existingUrl) {
    console.log(`[Step 0] Artist has YouTube URL: ${existingUrl} — fetching description via Data API`)

    const descResult = await fetchYouTubeDescription(existingUrl, youtubeApiKey)

    if (!descResult.success) {
      console.log(`[Step 0] Failed to fetch description: ${descResult.error}`)
      // Still pass the URL through to Step 1 (Apify can try)
      return { ...empty, url: existingUrl, discoveredYouTubeUrl: existingUrl, apifyActor: 'youtube-data-api (description fetch failed)', errorDetails: descResult.error }
    }

    // Check for emails in the channel description
    if (descResult.emailsFromDescription.length > 0) {
      console.log(`[Step 0] Emails found in YouTube description: ${descResult.emailsFromDescription.join(', ')}`)
      return {
        emails: descResult.emailsFromDescription,
        confidence: 0.9,
        url: existingUrl,
        rawContent: descResult.description,
        apifyUsed: false,
        apifyActor: 'youtube-data-api (description)',
        wasBlocked: false,
        discoveredYouTubeUrl: existingUrl,
      }
    }

    // No email in description — pass to Step 1 for deeper Apify extraction
    console.log(`[Step 0] No email in YouTube description (${descResult.description.length} chars). Passing to Step 1 for Apify extraction.`)
    return {
      ...empty,
      url: existingUrl,
      rawContent: descResult.description,
      apifyActor: 'youtube-data-api (no email in description)',
      discoveredYouTubeUrl: existingUrl,
    }
  }

  // CASE B: No YouTube URL — discover the channel via search + Haiku verification
  console.log(`[Step 0] No YouTube URL in artist data — starting discovery`)

  const result = await discoverYouTubeChannel(artist, {
    youtube: youtubeApiKey,
    anthropic: anthropicKey,
  })

  if (!result.success || !result.channelUrl) {
    console.log(`[Step 0] YouTube discovery failed: ${result.error || 'No match found'}`)
    return { ...empty, errorDetails: result.error || 'No YouTube channel found', apifyActor: result.method }
  }

  console.log(`[Step 0] Discovered YouTube channel: ${result.channelUrl} (confidence: ${result.confidence}, method: ${result.method})`)

  // If the API already found emails in the channel description, return them
  if (result.emailsFromDescription.length > 0) {
    console.log(`[Step 0] Emails found in YouTube description: ${result.emailsFromDescription.join(', ')}`)
    return {
      emails: result.emailsFromDescription,
      confidence: Math.min(result.confidence, 0.85),
      url: result.channelUrl,
      rawContent: result.description,
      apifyUsed: false,
      apifyActor: result.method,
      wasBlocked: false,
      discoveredYouTubeUrl: result.channelUrl,
    }
  }

  // No email in description, but we found the channel — pass URL to Step 1
  return {
    ...empty,
    url: result.channelUrl,
    rawContent: result.description,
    apifyActor: result.method,
    discoveredYouTubeUrl: result.channelUrl,
  }
}

// ============================================================
// STEP 1: YouTube Email Extraction (streamers~youtube-scraper)
// ============================================================

async function step1_YouTube(
  artist: Artist,
  anthropicKey: string,
  discoveredYouTubeUrl?: string
): Promise<{
  emails: string[]; confidence: number; url: string; rawContent: string;
  apifyUsed: boolean; apifyActor: string; wasBlocked: boolean; errorDetails?: string
}> {
  const youtubeUrl = discoveredYouTubeUrl || findYouTubeUrl(artist)
  const empty = { emails: [], confidence: 0, url: '', rawContent: '', apifyUsed: false, apifyActor: '', wasBlocked: false }

  if (!youtubeUrl) {
    console.log('[Step 1] No YouTube URL found (even after discovery), skipping')
    return empty
  }

  console.log(`[Step 1] YouTube URL: ${youtubeUrl}${discoveredYouTubeUrl ? ' (from Step 0 discovery)' : ' (from artist data)'}`)

  const result = await apifyFetchYouTube(youtubeUrl)

  if (!result.success) {
    console.log(`[Step 1] Apify YouTube scraper failed: ${result.error}`)
    return { ...empty, url: youtubeUrl, apifyUsed: false, apifyActor: result.actorUsed, errorDetails: result.errorDetails }
  }

  // Check for direct email from structured fields
  if (result.email && validateEmailFormat(result.email)) {
    console.log(`[Step 1] Direct email from YouTube scraper: ${result.email}`)
    return {
      emails: [result.email], confidence: 0.9, url: youtubeUrl,
      rawContent: result.allText, apifyUsed: true, apifyActor: result.actorUsed, wasBlocked: false,
    }
  }

  // Regex scan all text for emails
  const regexEmails = extractEmailsFromText(result.allText)
  if (regexEmails.length > 0) {
    console.log(`[Step 1] Regex found emails in YouTube data: ${regexEmails.join(', ')}`)
    return {
      emails: regexEmails, confidence: 0.85, url: youtubeUrl,
      rawContent: result.allText, apifyUsed: true, apifyActor: result.actorUsed, wasBlocked: false,
    }
  }

  // AI extraction from description + about text
  if (result.allText.length > 50) {
    const prompt = `You are extracting a real email address from a YouTube channel's data.
Channel: "${artist.name}"
Description: ${result.description.slice(0, 2000)}
About: ${result.aboutText.slice(0, 2000)}

Extract any email address that appears in this content. This must be a real email you can see in the text above.
NEVER guess, infer, or construct an email. Only return what you can literally see.

Return JSON only: {"email": "found@email.com", "source": "YouTube channel description"}
If no email found: {"email": "", "source": "none"}`

    const aiResult = await extractEmailWithAI(result.allText, prompt, 'claude-haiku-4-5-20251001', anthropicKey)
    if (aiResult.email && validateEmail(aiResult.email, result.allText)) {
      return {
        emails: [aiResult.email], confidence: 0.85, url: youtubeUrl,
        rawContent: result.allText, apifyUsed: true, apifyActor: result.actorUsed, wasBlocked: false,
      }
    }
  }

  console.log('[Step 1] No email found in YouTube data')
  return { ...empty, url: youtubeUrl, rawContent: result.allText, apifyUsed: true, apifyActor: result.actorUsed }
}

// ============================================================
// STEP 2: Instagram (apify~instagram-profile-scraper)
// ============================================================

async function step2_Instagram(
  artist: Artist,
  anthropicKey: string
): Promise<{
  emails: string[]; confidence: number; url: string; rawContent: string;
  externalUrl: string | null; apifyUsed: boolean; apifyActor: string; wasBlocked: boolean; errorDetails?: string
}> {
  const handle = findInstagramHandle(artist)
  const empty = { emails: [], confidence: 0, url: '', rawContent: '', externalUrl: null, apifyUsed: false, apifyActor: '', wasBlocked: false }

  if (!handle) {
    console.log('[Step 2] No Instagram handle found, skipping')
    return empty
  }

  const igUrl = `https://www.instagram.com/${handle}/`
  console.log(`[Step 2] Instagram handle: @${handle}`)

  const result = await apifyFetchInstagram(handle)

  if (!result.success) {
    console.log(`[Step 2] Apify Instagram scraper failed: ${result.error}`)
    return { ...empty, url: igUrl, apifyActor: result.actorUsed, errorDetails: result.errorDetails }
  }

  // Check businessEmail field first (structured data, highest confidence)
  if (result.businessEmail && validateEmailFormat(result.businessEmail)) {
    console.log(`[Step 2] Business email from Instagram: ${result.businessEmail}`)
    return {
      emails: [result.businessEmail], confidence: 0.9, url: igUrl,
      rawContent: result.allText, externalUrl: result.externalUrl,
      apifyUsed: true, apifyActor: result.actorUsed, wasBlocked: false,
    }
  }

  // Check email field (may have been extracted by the actor)
  if (result.email && validateEmailFormat(result.email)) {
    console.log(`[Step 2] Email from Instagram scraper: ${result.email}`)
    return {
      emails: [result.email], confidence: 0.85, url: igUrl,
      rawContent: result.allText, externalUrl: result.externalUrl,
      apifyUsed: true, apifyActor: result.actorUsed, wasBlocked: false,
    }
  }

  // Regex scan biography for email patterns
  if (result.biography) {
    const bioEmails = extractEmailsFromText(result.biography)
    if (bioEmails.length > 0) {
      console.log(`[Step 2] Regex found email in bio: ${bioEmails.join(', ')}`)
      return {
        emails: bioEmails, confidence: 0.8, url: igUrl,
        rawContent: result.allText, externalUrl: result.externalUrl,
        apifyUsed: true, apifyActor: result.actorUsed, wasBlocked: false,
      }
    }
  }

  // Regex scan all text
  const allEmails = extractEmailsFromText(result.allText)
  if (allEmails.length > 0) {
    console.log(`[Step 2] Regex found email in IG data: ${allEmails.join(', ')}`)
    return {
      emails: allEmails, confidence: 0.75, url: igUrl,
      rawContent: result.allText, externalUrl: result.externalUrl,
      apifyUsed: true, apifyActor: result.actorUsed, wasBlocked: false,
    }
  }

  console.log(`[Step 2] No email found. externalUrl=${result.externalUrl || 'none'}`)
  return {
    ...empty, url: igUrl, rawContent: result.allText,
    externalUrl: result.externalUrl, apifyUsed: true, apifyActor: result.actorUsed,
  }
}

// ============================================================
// STEP 3: Link-in-Bio (direct fetch → website-content-crawler)
// ============================================================

async function step3_LinkInBio(
  artist: Artist,
  externalUrl: string | null,
  anthropicKey: string
): Promise<{
  emails: string[]; confidence: number; url: string; rawContent: string;
  apifyUsed: boolean; apifyActor: string; wasBlocked: boolean; errorDetails?: string
}> {
  const empty = { emails: [], confidence: 0, url: '', rawContent: '', apifyUsed: false, apifyActor: '', wasBlocked: false }

  // Determine the link-in-bio URL
  const websiteUrl = findWebsiteUrl(artist)
  const linktreeUrl = externalUrl || (websiteUrl && isLinktreeDomain(websiteUrl) ? websiteUrl : null)

  if (!linktreeUrl) {
    console.log('[Step 3] No link-in-bio URL found, skipping')
    return empty
  }

  console.log(`[Step 3] Link-in-bio URL: ${linktreeUrl}`)

  let allContent = ''
  let allEmails: string[] = []
  let apifyUsed = false
  let apifyActor = ''

  try {
    // Try direct fetch first — Linktree pages often work without Apify
    const directResult = await directFetch(linktreeUrl)

    if (directResult.success && !isBlockedContent(directResult.html)) {
      console.log(`[Step 3] Direct fetch success: ${directResult.html.length} chars`)
      allContent = directResult.html
    } else {
      // Fallback to Apify website-content-crawler
      console.log('[Step 3] Direct fetch blocked/empty, using Apify website-content-crawler')
      const apifyResult = await apifyFetchWebPage(linktreeUrl, 3)
      if (apifyResult.success) {
        allContent = apifyResult.text || apifyResult.html
        apifyUsed = true
        apifyActor = apifyResult.actorUsed
        console.log(`[Step 3] Apify success: ${allContent.length} chars`)
      } else {
        console.log(`[Step 3] Apify failed: ${apifyResult.error}`)
        return { ...empty, url: linktreeUrl, apifyActor: apifyResult.actorUsed, errorDetails: apifyResult.errorDetails }
      }
    }

    // Extract emails from content
    const $ = cheerio.load(allContent)
    const pageText = $('body').text() || allContent

    const directEmails = extractEmailsFromText(allContent)
    allEmails.push(...directEmails)

    // Also check for mailto: links
    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href')
      if (href) {
        const email = href.replace('mailto:', '').split('?')[0]
        if (email && email.includes('@')) {
          allEmails.push(email)
        }
      }
    })

    // Follow contact/booking links on the Linktree page
    const contactLinks: string[] = []
    $('a').each((_, el) => {
      const href = $(el).attr('href')
      const text = ($(el).text() || '').toLowerCase()
      if (href && href.startsWith('http') && (
        text.includes('contact') || text.includes('booking') ||
        text.includes('management') || text.includes('email') ||
        text.includes('business')
      )) {
        contactLinks.push(href)
      }
    })

    // Fetch up to 2 contact links
    for (const contactUrl of contactLinks.slice(0, 2)) {
      try {
        await delay(500)
        console.log(`[Step 3] Following contact link: ${contactUrl}`)
        const contactResult = await directFetch(contactUrl)
        if (contactResult.success) {
          allContent += '\n\n' + contactResult.html
          const contactEmails = extractEmailsFromText(contactResult.html)
          allEmails.push(...contactEmails)
        }
      } catch {
        // Continue
      }
    }

    // Deduplicate
    allEmails = Array.from(new Set(allEmails)).filter(e => validateEmailFormat(e))

    if (allEmails.length > 0) {
      console.log(`[Step 3] Found emails: ${allEmails.join(', ')}`)
      return {
        emails: allEmails, confidence: 0.75, url: linktreeUrl,
        rawContent: allContent, apifyUsed, apifyActor, wasBlocked: false,
      }
    }

    // AI extraction as last resort
    if (allContent.length > 100) {
      const prompt = `You are extracting a real email address from a music artist's link-in-bio page.
Artist: "${artist.name}"
Content from their link-in-bio page:

---
${pageText.slice(0, 4000)}
---

Extract any email address visible in this content. Look for:
- Direct email addresses in text
- mailto: links
- Contact/booking page content
NEVER guess or construct an email. Only return what you can literally see.

Return JSON only: {"email": "found@email.com", "source": "Linktree/link-in-bio"}
If no email: {"email": "", "source": "none"}`

      const aiResult = await extractEmailWithAI(allContent, prompt, 'claude-haiku-4-5-20251001', anthropicKey)
      if (aiResult.email && validateEmail(aiResult.email, allContent)) {
        return {
          emails: [aiResult.email], confidence: 0.75, url: linktreeUrl,
          rawContent: allContent, apifyUsed, apifyActor, wasBlocked: false,
        }
      }
    }

    console.log('[Step 3] No email found in link-in-bio')
    return { ...empty, url: linktreeUrl, rawContent: allContent, apifyUsed, apifyActor }
  } catch (error: any) {
    console.error('[Step 3 Error]', error.message)
    return { ...empty, url: linktreeUrl }
  }
}

// ============================================================
// STEP 4: Artist Website (direct fetch → website-content-crawler)
// ============================================================

async function step4_Website(
  artist: Artist,
  anthropicKey: string
): Promise<{
  emails: string[]; confidence: number; url: string; rawContent: string;
  apifyUsed: boolean; apifyActor: string; wasBlocked: boolean; errorDetails?: string
}> {
  const empty = { emails: [], confidence: 0, url: '', rawContent: '', apifyUsed: false, apifyActor: '', wasBlocked: false }

  const websiteUrl = findWebsiteUrl(artist)

  if (!websiteUrl) {
    console.log('[Step 4] No website URL found, skipping')
    return empty
  }

  // Skip if it's a link-in-bio domain (already handled in Step 3)
  if (isLinktreeDomain(websiteUrl)) {
    console.log('[Step 4] Website is a link-in-bio domain, already handled in Step 3')
    return empty
  }

  // Skip ticketing platforms
  if (isTicketingPlatform(websiteUrl)) {
    console.log(`[Step 4] Skipping ticketing platform: ${websiteUrl}`)
    return empty
  }

  console.log(`[Step 4] Website URL: ${websiteUrl}`)

  let allContent = ''
  let allEmails: string[] = []
  let apifyUsed = false
  let apifyActor = ''

  try {
    // Try direct fetch first
    let html = ''
    const directResult = await directFetch(websiteUrl)

    if (directResult.success && !isBlockedContent(directResult.html)) {
      html = directResult.html
      console.log(`[Step 4] Direct fetch success: ${html.length} chars`)
    } else {
      // Fallback to Apify
      console.log('[Step 4] Direct fetch blocked/empty, using Apify website-content-crawler')
      const apifyResult = await apifyFetchWebPage(websiteUrl, 5)
      if (apifyResult.success) {
        html = apifyResult.text || apifyResult.html
        apifyUsed = true
        apifyActor = apifyResult.actorUsed
        console.log(`[Step 4] Apify success: ${html.length} chars`)
      } else {
        console.log(`[Step 4] Apify failed: ${apifyResult.error}`)
        return { ...empty, url: websiteUrl, apifyActor: apifyResult.actorUsed, errorDetails: apifyResult.errorDetails }
      }
    }

    const $ = cheerio.load(html)
    allContent = html

    // Extract emails from homepage
    const homeEmails = extractEmailsFromText(html)
    allEmails.push(...homeEmails)

    // Also check mailto: links
    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href')
      if (href) {
        const email = href.replace('mailto:', '').split('?')[0]
        if (email && email.includes('@')) {
          allEmails.push(email)
        }
      }
    })

    // Find and fetch contact/booking/about subpages
    const subpageUrls: string[] = []
    const base = new URL(websiteUrl)

    $('a').each((_, el) => {
      const href = $(el).attr('href')
      const text = ($(el).text() || '').toLowerCase()

      if (href && (
        text.includes('contact') || text.includes('booking') ||
        text.includes('management') || text.includes('about') ||
        text.includes('press') || href.toLowerCase().includes('/contact') ||
        href.toLowerCase().includes('/booking') || href.toLowerCase().includes('/about')
      )) {
        let fullUrl = href
        if (href.startsWith('/')) {
          fullUrl = `${base.protocol}//${base.host}${href}`
        } else if (!href.startsWith('http')) {
          fullUrl = `${websiteUrl.replace(/\/$/, '')}/${href}`
        }
        if (fullUrl.startsWith('http')) {
          subpageUrls.push(fullUrl)
        }
      }
    })

    // Also try common subpage patterns
    const commonSubpages = ['/contact', '/booking', '/about']
    for (const path of commonSubpages) {
      const subUrl = `${base.protocol}//${base.host}${path}`
      if (!subpageUrls.includes(subUrl)) {
        subpageUrls.push(subUrl)
      }
    }

    // Fetch subpages (max 4)
    for (const subUrl of Array.from(new Set(subpageUrls)).slice(0, 4)) {
      try {
        await delay(500)
        console.log(`[Step 4] Fetching subpage: ${subUrl}`)
        const subResult = await directFetch(subUrl)
        if (subResult.success) {
          allContent += '\n\n' + subResult.html
          const subEmails = extractEmailsFromText(subResult.html)
          allEmails.push(...subEmails)

          // Check mailto: links in subpage
          const sub$ = cheerio.load(subResult.html)
          sub$('a[href^="mailto:"]').each((_, el) => {
            const href = sub$(el).attr('href')
            if (href) {
              const email = href.replace('mailto:', '').split('?')[0]
              if (email && email.includes('@')) {
                allEmails.push(email)
              }
            }
          })
        }
      } catch {
        // Continue
      }
    }

    // Deduplicate and validate
    allEmails = Array.from(new Set(allEmails)).filter(e => validateEmailFormat(e))

    if (allEmails.length > 0) {
      console.log(`[Step 4] Found emails: ${allEmails.join(', ')}`)
      return {
        emails: allEmails, confidence: 0.8, url: websiteUrl,
        rawContent: allContent, apifyUsed, apifyActor, wasBlocked: false,
      }
    }

    // AI extraction
    if (allContent.length > 100) {
      const pageText = $('body').text() || allContent
      const prompt = `You are extracting a real email address from a music artist's website.
Artist: "${artist.name}"
Content from their website and contact/booking pages:

---
${pageText.slice(0, 5000)}
---

Extract any email address visible in this content. Prioritize booking@ or management@ addresses.
NEVER guess or construct an email. Only return what you can literally see.

Return JSON only: {"email": "found@email.com", "source": "Artist website"}
If no email: {"email": "", "source": "none"}`

      const aiResult = await extractEmailWithAI(allContent, prompt, 'claude-haiku-4-5-20251001', anthropicKey)
      if (aiResult.email && validateEmail(aiResult.email, allContent)) {
        return {
          emails: [aiResult.email], confidence: 0.8, url: websiteUrl,
          rawContent: allContent, apifyUsed, apifyActor, wasBlocked: false,
        }
      }
    }

    console.log('[Step 4] No email found on website')
    return { ...empty, url: websiteUrl, rawContent: allContent, apifyUsed, apifyActor }
  } catch (error: any) {
    console.error('[Step 4 Error]', error.message)
    return { ...empty, url: websiteUrl }
  }
}

// ============================================================
// STEP 5: Facebook — SKIPPED
// ============================================================

async function step5_Facebook(
  artist: Artist
): Promise<{
  emails: string[]; confidence: number; url: string; rawContent: string;
  apifyUsed: boolean; apifyActor: string; wasBlocked: boolean
}> {
  console.log('[Step 5] Facebook — skipped (requires login, unreliable)')
  return {
    emails: [], confidence: 0, url: '', rawContent: '',
    apifyUsed: false, apifyActor: 'skipped', wasBlocked: false,
  }
}

// ============================================================
// STEP 6: Remaining Socials — SKIPPED
// ============================================================

async function step6_RemainingSocials(
  artist: Artist
): Promise<{
  emails: string[]; confidence: number; url: string; rawContent: string;
  apifyUsed: boolean; apifyActor: string; wasBlocked: boolean
}> {
  console.log('[Step 6] Remaining socials — skipped (Twitter/Spotify/TikTok block scraping)')
  return {
    emails: [], confidence: 0, url: '', rawContent: '',
    apifyUsed: false, apifyActor: 'skipped', wasBlocked: false,
  }
}

// ============================================================
// STEP 7: Perplexity YouTube Deep Dive (Focused Extraction)
// ============================================================

const YOUTUBE_DEEP_DIVE_SYSTEM_PROMPT = `You are a music industry research assistant. Your job is to extract business contact information from a music artist's YouTube presence.

You will be given a specific YouTube channel URL. Your task:

1. GO TO the YouTube channel URL provided
2. Read the About/Description section — artists often list their booking email, management email, or business inquiries email here
3. Check for any linked websites in the channel description or About page (often labeled "Website", "Business inquiries", or just a raw URL)
4. If you find a linked website, GO TO that website and look for a Contact, Booking, or Management page
5. Check for linked social profiles that might contain email addresses
6. Look for any email addresses mentioned anywhere on the channel — description, banner, pinned comment on recent videos

WHAT TO RETURN:
Return a JSON object with the following fields (and nothing else — no markdown, no backticks, no explanation):

{
  "email": "the best business email found, or null",
  "email_source": "where you found it (e.g. 'YouTube About page', 'linked website contact page', 'channel description')",
  "website": "the artist's website URL if found, or null",
  "additional_emails": ["any other emails found, as an array"],
  "management": "management company name if visible, or null",
  "booking_agent": "booking agent or agency name if visible, or null"
}

PRIORITY ORDER FOR EMAILS:
1. Booking agent email (e.g. agent@caa.com, name@paradigmagency.com)
2. Management email (e.g. name@redlightmanagement.com)
3. Business inquiries email from YouTube About page
4. Email found on linked website contact page
5. Any other email found

RULES:
- Only return emails you actually find on pages you visit — do NOT guess or fabricate
- If you find no email at all, set "email" to null
- Do NOT return fan mail addresses unless absolutely nothing else exists
- Do NOT return emails for a different artist
- If the YouTube channel doesn't exist or returns a 404, return all fields as null`

interface DeepDiveResult {
  email: string | null
  emailSource: string | null
  website: string | null
  additionalEmails: string[]
  management: string | null
  bookingAgent: string | null
}

function parseDeepDiveResponse(content: string): DeepDiveResult {
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  try {
    const parsed = JSON.parse(cleaned)
    return {
      email: parsed.email || null,
      emailSource: parsed.email_source || null,
      website: parsed.website || null,
      additionalEmails: parsed.additional_emails || [],
      management: parsed.management || null,
      bookingAgent: parsed.booking_agent || null,
    }
  } catch {
    const emailMatch = cleaned.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
    return {
      email: emailMatch ? emailMatch[0].toLowerCase() : null,
      emailSource: 'regex_fallback',
      website: null,
      additionalEmails: [],
      management: null,
      bookingAgent: null,
    }
  }
}

async function step7_PerplexityYouTubeDeepDive(
  artist: Artist,
  discoveredYouTubeUrl?: string
): Promise<{
  emails: string[]; confidence: number; url: string; rawContent: string;
  apifyUsed: boolean; apifyActor: string; wasBlocked: boolean; errorDetails?: string;
  deepDiveResult?: DeepDiveResult
}> {
  const empty = { emails: [], confidence: 0, url: '', rawContent: '', apifyUsed: false, apifyActor: 'perplexity-yt-deep-dive', wasBlocked: false }

  const perplexityKey = process.env.PERPLEXITY_API_KEY
  if (!perplexityKey) {
    console.log('[Step 7] No PERPLEXITY_API_KEY configured, skipping YouTube deep dive')
    return { ...empty, errorDetails: 'No PERPLEXITY_API_KEY configured' }
  }

  const youtubeUrl = discoveredYouTubeUrl || findYouTubeUrl(artist)
  if (!youtubeUrl) {
    console.log('[Step 7] No YouTube URL available, skipping deep dive')
    return { ...empty, errorDetails: 'No YouTube URL available for deep dive' }
  }

  console.log(`[Step 7] Perplexity YouTube Deep Dive — "${artist.name}" → ${youtubeUrl}`)

  const userPrompt = `Find business contact information for the music artist "${artist.name}".

YouTube channel: ${youtubeUrl}
${artist.spotify_url ? `Spotify: ${artist.spotify_url}` : ''}

Start by visiting their YouTube channel and extract all available contact information.`

  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: YOUTUBE_DEEP_DIVE_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.1,
        web_search_options: { search_context_size: 'high' },
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      const errorDetail = `Perplexity HTTP ${res.status}: ${errorText.slice(0, 300)}`
      console.error(`[Step 7] API error: ${errorDetail}`)
      return { ...empty, url: youtubeUrl, errorDetails: errorDetail }
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || ''
    const citations: string[] = data.citations || []

    console.log(`[Step 7] Perplexity deep dive response: "${content.slice(0, 300)}"`)
    if (citations.length > 0) {
      console.log(`[Step 7] Citations: ${citations.slice(0, 3).join(', ')}`)
    }

    const deepDive = parseDeepDiveResponse(content)
    console.log(`[Step 7] Parsed: email=${deepDive.email}, source=${deepDive.emailSource}, website=${deepDive.website}, mgmt=${deepDive.management}, agent=${deepDive.bookingAgent}`)

    // Collect all emails from the deep dive
    const allFoundEmails: string[] = []
    if (deepDive.email && validatePerplexityEmail(deepDive.email)) {
      allFoundEmails.push(deepDive.email)
    }
    for (const extra of deepDive.additionalEmails) {
      const cleaned = extra.toLowerCase().trim()
      if (cleaned && validatePerplexityEmail(cleaned) && !allFoundEmails.includes(cleaned)) {
        allFoundEmails.push(cleaned)
      }
    }

    if (allFoundEmails.length > 0) {
      console.log(`[Step 7] YouTube deep dive found emails: ${allFoundEmails.join(', ')}`)
      return {
        emails: allFoundEmails,
        confidence: 0.75,
        url: citations[0] || youtubeUrl,
        rawContent: content,
        apifyUsed: false,
        apifyActor: 'perplexity-yt-deep-dive',
        wasBlocked: false,
        deepDiveResult: deepDive,
      }
    }

    console.log('[Step 7] YouTube deep dive: no valid email found')
    return { ...empty, url: youtubeUrl, rawContent: content, deepDiveResult: deepDive }
  } catch (error: any) {
    console.error(`[Step 7] Perplexity YouTube deep dive error:`, error.message)
    return { ...empty, url: youtubeUrl, errorDetails: error.message }
  }
}

// ============================================================
// STEP 8: Perplexity Instagram Deep Dive (Focused Extraction)
// ============================================================

const INSTAGRAM_DEEP_DIVE_SYSTEM_PROMPT = `You are a music industry research assistant. Your job is to extract business contact information from a music artist's Instagram presence and any linked pages.

You will be given a specific Instagram profile URL. Your task:

1. GO TO the Instagram profile URL provided
2. Read the bio text — artists sometimes put their booking email directly in their bio, or mention their management company
3. Find the link in their bio — this is CRITICAL. Artists almost always have a link-in-bio that leads to:
   - A Linktree, Beacons, Solo.to, or similar link aggregator page
   - Their personal website
   - A Spotify pre-save page (less useful, but check for other links on it)
4. If you find a link-in-bio, GO TO that page:
   - If it's a Linktree/Beacons/link aggregator: read ALL the links listed. Look for "Booking", "Contact", "Management", "Press", "Business" links and follow them
   - If it's a personal website: look for a Contact, Booking, or About page
5. Follow any booking/contact/management links you find and extract email addresses from those pages
6. Also search for "{artist_name} booking email" or "{artist_name} management contact" to catch info from third-party sources

WHAT TO RETURN:
Return a JSON object with the following fields (and nothing else — no markdown, no backticks, no explanation):

{
  "email": "the best business email found, or null",
  "email_source": "where you found it (e.g. 'Linktree booking link', 'Instagram bio', 'personal website contact page', 'management company site')",
  "website": "the artist's website URL if found, or null",
  "linktree_url": "the link-in-bio URL if found, or null",
  "additional_emails": ["any other emails found, as an array"],
  "management": "management company name if visible, or null",
  "booking_agent": "booking agent or agency name if visible, or null"
}

PRIORITY ORDER FOR EMAILS:
1. Booking agent email (e.g. agent@caa.com, name@paradigmagency.com)
2. Management email (e.g. name@redlightmanagement.com)
3. Email from Linktree/link-in-bio booking link
4. Email directly in Instagram bio
5. Email found on linked website contact page
6. Any other email found via web search

RULES:
- Only return emails you actually find — do NOT guess or fabricate
- If you find no email at all, set "email" to null
- Do NOT return fan mail addresses unless absolutely nothing else exists
- Do NOT return emails for a different artist
- Instagram may block or limit access — if you can't read the profile, try searching for the same information via web search instead of giving up
- Many Instagram bios say "For bookings: [email]" or "Mgmt: @managementcompany" — capture these
- If the bio mentions a management company by name but no email, search for that management company's website and find the artist's email on their roster page`

interface InstagramDeepDiveResult {
  email: string | null
  emailSource: string | null
  website: string | null
  linktreeUrl: string | null
  additionalEmails: string[]
  management: string | null
  bookingAgent: string | null
}

function parseInstagramDeepDiveResponse(content: string): InstagramDeepDiveResult {
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  try {
    const parsed = JSON.parse(cleaned)
    return {
      email: parsed.email || null,
      emailSource: parsed.email_source || null,
      website: parsed.website || null,
      linktreeUrl: parsed.linktree_url || null,
      additionalEmails: parsed.additional_emails || [],
      management: parsed.management || null,
      bookingAgent: parsed.booking_agent || null,
    }
  } catch {
    const emailMatch = cleaned.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
    return {
      email: emailMatch ? emailMatch[0].toLowerCase() : null,
      emailSource: 'regex_fallback',
      website: null,
      linktreeUrl: null,
      additionalEmails: [],
      management: null,
      bookingAgent: null,
    }
  }
}

function findInstagramUrl(artist: Artist): string {
  const handle = findInstagramHandle(artist)
  if (handle) return `https://www.instagram.com/${handle}/`

  const sl = artist.social_links || {}
  const igUrl = sl.instagram_url || sl.instagram || ''
  if (igUrl && igUrl.includes('instagram.com')) return igUrl

  return ''
}

async function step8_PerplexityInstagramDeepDive(
  artist: Artist
): Promise<{
  emails: string[]; confidence: number; url: string; rawContent: string;
  apifyUsed: boolean; apifyActor: string; wasBlocked: boolean; errorDetails?: string;
  igDeepDiveResult?: InstagramDeepDiveResult
}> {
  const empty = { emails: [], confidence: 0, url: '', rawContent: '', apifyUsed: false, apifyActor: 'perplexity-ig-deep-dive', wasBlocked: false }

  const perplexityKey = process.env.PERPLEXITY_API_KEY
  if (!perplexityKey) {
    console.log('[Step 8] No PERPLEXITY_API_KEY configured, skipping Instagram deep dive')
    return { ...empty, errorDetails: 'No PERPLEXITY_API_KEY configured' }
  }

  const instagramUrl = findInstagramUrl(artist)
  if (!instagramUrl) {
    console.log('[Step 8] No Instagram URL available, skipping deep dive')
    return { ...empty, errorDetails: 'No Instagram URL available for deep dive' }
  }

  console.log(`[Step 8] Perplexity Instagram Deep Dive — "${artist.name}" → ${instagramUrl}`)

  let userPrompt = `Find business contact information for the music artist "${artist.name}".

Instagram: ${instagramUrl}`

  const ytUrl = findYouTubeUrl(artist)
  if (ytUrl) userPrompt += `\nYouTube: ${ytUrl}`
  if (artist.spotify_url) userPrompt += `\nSpotify: ${artist.spotify_url}`

  userPrompt += `\n\nStart by visiting their Instagram profile. Read their bio, follow their link-in-bio, and extract all available contact information.`

  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: INSTAGRAM_DEEP_DIVE_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.1,
        web_search_options: { search_context_size: 'high' },
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      const errorDetail = `Perplexity HTTP ${res.status}: ${errorText.slice(0, 300)}`
      console.error(`[Step 8] API error: ${errorDetail}`)
      return { ...empty, url: instagramUrl, errorDetails: errorDetail }
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || ''
    const citations: string[] = data.citations || []

    console.log(`[Step 8] Perplexity IG deep dive response: "${content.slice(0, 300)}"`)
    if (citations.length > 0) {
      console.log(`[Step 8] Citations: ${citations.slice(0, 3).join(', ')}`)
    }

    const igResult = parseInstagramDeepDiveResponse(content)
    console.log(`[Step 8] Parsed: email=${igResult.email}, source=${igResult.emailSource}, website=${igResult.website}, linktree=${igResult.linktreeUrl}, mgmt=${igResult.management}, agent=${igResult.bookingAgent}`)

    const allFoundEmails: string[] = []
    if (igResult.email && validatePerplexityEmail(igResult.email)) {
      allFoundEmails.push(igResult.email)
    }
    for (const extra of igResult.additionalEmails) {
      const cleaned = extra.toLowerCase().trim()
      if (cleaned && validatePerplexityEmail(cleaned) && !allFoundEmails.includes(cleaned)) {
        allFoundEmails.push(cleaned)
      }
    }

    if (allFoundEmails.length > 0) {
      console.log(`[Step 8] Instagram deep dive found emails: ${allFoundEmails.join(', ')}`)
      return {
        emails: allFoundEmails,
        confidence: 0.75,
        url: citations[0] || instagramUrl,
        rawContent: content,
        apifyUsed: false,
        apifyActor: 'perplexity-ig-deep-dive',
        wasBlocked: false,
        igDeepDiveResult: igResult,
      }
    }

    console.log('[Step 8] Instagram deep dive: no valid email found')
    return { ...empty, url: instagramUrl, rawContent: content, igDeepDiveResult: igResult }
  } catch (error: any) {
    console.error(`[Step 8] Perplexity Instagram deep dive error:`, error.message)
    return { ...empty, url: instagramUrl, errorDetails: error.message }
  }
}

// ============================================================
// STEP 9: Perplexity Sonar Pro — Last-Resort Generic Web Search
// ============================================================

const PERPLEXITY_SYSTEM_PROMPT = `You are an email research assistant for a music industry catalog fund.

Your task: Find a real, working business/booking/management email address for the given music artist.

WHERE TO LOOK:
- The artist's official website (often has a contact or booking page)
- Their YouTube channel About page
- Booking agency websites (CAA, WME, Paradigm, UTA, ICM, APA, etc.)
- Management company websites
- Their Bandcamp page
- Their Linktree or similar link-in-bio pages
- Press kit pages
- Music industry databases and directories
- Social media bios (Instagram, Twitter, Facebook)

WHAT TO RETURN:
- Return ONLY a valid email address, nothing else
- Prefer booking/management emails over fan/general emails
- Prefer addresses at known agencies or management companies
- Do NOT return fan mail addresses, info@ generic addresses, or support@ addresses unless nothing else exists
- If the email is from a booking agency, that's ideal (e.g. firstname@caa.com, agent@paradigmagency.com)
- If you find multiple emails, return the one most likely to be for business/catalog inquiries

IF YOU CANNOT FIND AN EMAIL:
- Return exactly: NO_EMAIL_FOUND
- Do NOT guess or fabricate email addresses
- Do NOT return emails for a different artist with a similar name
- Do NOT return generic company emails that aren't specific to this artist`

const PERPLEXITY_FAKE_DOMAINS = [
  'example.com', 'test.com', 'email.com', 'mail.com', 'domain.com',
  'sample.com', 'placeholder.com', 'fake.com', 'none.com',
]

function extractPerplexityEmail(text: string): string | null {
  const cleaned = text.trim().replace(/^["'`]+|["'`]+$/g, '').replace(/\*\*/g, '').trim()
  const match = cleaned.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  return match ? match[0].toLowerCase() : null
}

function validatePerplexityEmail(email: string): boolean {
  const parts = email.split('@')
  if (parts.length !== 2) return false
  const [, domain] = parts
  if (!domain.includes('.')) return false
  const tld = domain.split('.').pop() || ''
  if (tld.length < 2) return false
  if (PERPLEXITY_FAKE_DOMAINS.includes(domain.toLowerCase())) return false
  const lower = email.toLowerCase()
  if (BLOCKED_EMAIL_PATTERNS.some(b => lower.includes(b))) return false
  if (JUNK_DOMAINS.some(junk => domain === junk || domain.endsWith('.' + junk))) return false
  return true
}

async function step9_PerplexityGeneric(
  artist: Artist
): Promise<{
  emails: string[]; confidence: number; url: string; rawContent: string;
  apifyUsed: boolean; apifyActor: string; wasBlocked: boolean; errorDetails?: string;
  citations?: string[]
}> {
  const empty = { emails: [], confidence: 0, url: '', rawContent: '', apifyUsed: false, apifyActor: 'perplexity-sonar-pro', wasBlocked: false }

  const perplexityKey = process.env.PERPLEXITY_API_KEY
  if (!perplexityKey) {
    console.log('[Step 9] No PERPLEXITY_API_KEY configured, skipping')
    return { ...empty, errorDetails: 'No PERPLEXITY_API_KEY configured' }
  }

  console.log(`[Step 9] Perplexity Sonar Pro — generic web search for "${artist.name}" email`)

  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: PERPLEXITY_SYSTEM_PROMPT },
          { role: 'user', content: `Find a business/booking/management contact email for the music artist "${artist.name}".` },
        ],
        max_tokens: 300,
        temperature: 0.1,
        web_search_options: { search_context_size: 'high' },
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      const errorDetail = `Perplexity HTTP ${res.status}: ${errorText.slice(0, 300)}`
      console.error(`[Step 9] API error: ${errorDetail}`)
      return { ...empty, errorDetails: errorDetail }
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || ''
    const citations: string[] = data.citations || []

    console.log(`[Step 9] Perplexity response: "${content.slice(0, 200)}"`)
    if (citations.length > 0) {
      console.log(`[Step 9] Citations: ${citations.slice(0, 3).join(', ')}`)
    }

    // Check for NO_EMAIL_FOUND
    if (content.includes('NO_EMAIL_FOUND') || !content.includes('@')) {
      console.log('[Step 9] Perplexity generic: no email found')
      return { ...empty, rawContent: content, citations }
    }

    // Extract and validate email
    const email = extractPerplexityEmail(content)
    if (email && validatePerplexityEmail(email)) {
      console.log(`[Step 9] Perplexity generic found email: ${email}`)
      return {
        emails: [email],
        confidence: 0.65,
        url: citations[0] || 'perplexity-web-search',
        rawContent: content,
        apifyUsed: false,
        apifyActor: 'perplexity-sonar-pro-generic',
        wasBlocked: false,
        citations,
      }
    }

    console.log(`[Step 9] Perplexity returned invalid email: ${email || content.slice(0, 50)}`)
    return { ...empty, rawContent: content, errorDetails: `Invalid email extracted: ${email || 'none'}`, citations }
  } catch (error: any) {
    console.error(`[Step 9] Perplexity error:`, error.message)
    return { ...empty, errorDetails: error.message }
  }
}

// ============================================================
// MAIN PIPELINE
// ============================================================

export async function enrichArtist(
  artist: Artist,
  apiKeys: { anthropic?: string },
  onProgress?: ProgressCallback
): Promise<EnrichmentSummary> {
  const startTime = Date.now()

  if (!apiKeys.anthropic) {
    throw new Error('Anthropic API key is required for enrichment')
  }

  const steps: EnrichmentStep[] = [
    { method: 'youtube_discovery', label: 'YouTube Discovery (Data API + Haiku)', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
    { method: 'youtube_about', label: 'YouTube Email Extraction (streamers~youtube-scraper)', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
    { method: 'instagram_bio', label: 'Instagram (apify~instagram-profile-scraper)', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
    { method: 'link_in_bio', label: 'Link-in-Bio (direct fetch / website-content-crawler)', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
    { method: 'website_contact', label: 'Artist Website (direct fetch / website-content-crawler)', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
    { method: 'facebook_about', label: 'Facebook (skipped — requires login)', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
    { method: 'remaining_socials', label: 'Remaining Socials (skipped — blocked)', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
    { method: 'perplexity_yt_deep_dive', label: 'Perplexity YouTube Deep Dive', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
    { method: 'perplexity_ig_deep_dive', label: 'Perplexity Instagram Deep Dive', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
    { method: 'perplexity_search', label: 'Perplexity Generic Web Search (last resort)', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
  ]

  const allEmails: Array<{ email: string; source: string; confidence: number }> = []
  const allRejectedEmails: Array<{ email: string; source: string; reason: string }> = []
  let bestEmail = ''
  let bestConfidence = 0
  let bestSource = ''
  let instagramExternalUrl: string | null = null
  let discoveredYouTubeUrl: string | undefined = undefined
  let discoveredWebsite: string | undefined = undefined
  let discoveredLinktreeUrl: string | undefined = undefined
  let discoveredManagement: string | undefined = undefined
  let discoveredBookingAgent: string | undefined = undefined

  console.log(`\n[Enrichment Start] Artist: ${artist.name} (${artist.id})`)
  console.log(`[Enrichment] YOUTUBE_API_KEY present: ${!!process.env.YOUTUBE_API_KEY}`)
  console.log(`[Enrichment] APIFY_TOKEN present: ${!!process.env.APIFY_TOKEN}`)
  console.log(`[Enrichment] PERPLEXITY_API_KEY present: ${!!process.env.PERPLEXITY_API_KEY}`)
  console.log(`[Enrichment] Social links:`, JSON.stringify(artist.social_links || {}))

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
        externalUrl?: string | null
        apifyUsed?: boolean
        apifyActor?: string
        wasBlocked?: boolean
        errorDetails?: string
        discoveredYouTubeUrl?: string
        deepDiveResult?: DeepDiveResult
        igDeepDiveResult?: InstagramDeepDiveResult
      }

      switch (step.method) {
        case 'youtube_discovery':
          result = await step0_YouTubeDiscovery(artist, apiKeys.anthropic!)
          discoveredYouTubeUrl = result.discoveredYouTubeUrl
          break
        case 'youtube_about':
          result = await step1_YouTube(artist, apiKeys.anthropic!, discoveredYouTubeUrl)
          break
        case 'instagram_bio':
          result = await step2_Instagram(artist, apiKeys.anthropic!)
          instagramExternalUrl = result.externalUrl || null
          break
        case 'link_in_bio':
          result = await step3_LinkInBio(artist, instagramExternalUrl, apiKeys.anthropic!)
          break
        case 'website_contact':
          result = await step4_Website(artist, apiKeys.anthropic!)
          break
        case 'facebook_about':
          result = await step5_Facebook(artist)
          break
        case 'remaining_socials':
          result = await step6_RemainingSocials(artist)
          break
        case 'perplexity_yt_deep_dive':
          result = await step7_PerplexityYouTubeDeepDive(artist, discoveredYouTubeUrl)
          // Capture bonus data from deep dive
          if (result.deepDiveResult) {
            if (result.deepDiveResult.website) discoveredWebsite = result.deepDiveResult.website
            if (result.deepDiveResult.management) discoveredManagement = result.deepDiveResult.management
            if (result.deepDiveResult.bookingAgent) discoveredBookingAgent = result.deepDiveResult.bookingAgent
          }
          break
        case 'perplexity_ig_deep_dive':
          result = await step8_PerplexityInstagramDeepDive(artist)
          if (result.igDeepDiveResult) {
            if (result.igDeepDiveResult.website && !discoveredWebsite) discoveredWebsite = result.igDeepDiveResult.website
            if (result.igDeepDiveResult.linktreeUrl && !discoveredLinktreeUrl) discoveredLinktreeUrl = result.igDeepDiveResult.linktreeUrl
            if (result.igDeepDiveResult.management && !discoveredManagement) discoveredManagement = result.igDeepDiveResult.management
            if (result.igDeepDiveResult.bookingAgent && !discoveredBookingAgent) discoveredBookingAgent = result.igDeepDiveResult.bookingAgent
          }
          break
        case 'perplexity_search':
          result = await step9_PerplexityGeneric(artist)
          break
        default:
          result = { emails: [], confidence: 0, url: '', rawContent: '' }
      }

      step.duration_ms = Date.now() - stepStart
      step.url_fetched = result.url
      step.emails_found = result.emails
      step.confidence = result.confidence
      step.apify_used = result.apifyUsed || false
      step.apify_actor = result.apifyActor || ''
      step.was_blocked = result.wasBlocked || false
      step.content_length = result.rawContent?.length || 0
      step.error_details = result.errorDetails

      // Steps that are always skipped
      if (step.method === 'facebook_about' || step.method === 'remaining_socials') {
        step.status = 'skipped'
        onProgress?.(step, i)
        continue
      }

      // Step 0 (discovery) is special: if it found emails, great — early terminate.
      // If it didn't find emails but found a URL, that's still a success for discovery (URL passed to Step 1).
      // If it found nothing, mark as failed but continue.
      if (step.method === 'youtube_discovery') {
        if (step.emails_found.length > 0) {
          // Quality filter: separate valid from junk emails
          const { valid, rejected } = filterEmails(step.emails_found)
          step.rejected_emails = rejected

          for (const r of rejected) {
            console.log(`[Step 0] Email REJECTED: ${r.email} — ${r.reason}`)
            allRejectedEmails.push({ email: r.email, source: 'youtube_discovery', reason: r.reason })
          }

          // Replace emails_found with only valid ones
          step.emails_found = valid

          if (valid.length > 0) {
            step.status = 'success'
            step.best_email = valid[0]
            console.log(`[Step 0 Success] Found valid email in YouTube description: ${valid.join(', ')}`)

            for (const email of valid) {
              allEmails.push({ email, source: 'youtube_discovery', confidence: result.confidence })
            }
            if (result.confidence > bestConfidence) {
              bestEmail = valid[0]
              bestConfidence = result.confidence
              bestSource = 'youtube_discovery'
            }

            onProgress?.(step, i)

            // Early termination — valid email found
            console.log('[Early Termination] Valid email found in YouTube description, skipping remaining steps')
            for (let j = i + 1; j < steps.length; j++) {
              steps[j].status = 'skipped'
            }
            break
          } else {
            // All emails were rejected — continue to next step
            step.status = 'failed'
            step.error_details = `Found ${rejected.length} email(s) but all rejected by quality filter`
            console.log(`[Step 0] All ${rejected.length} email(s) rejected — continuing pipeline`)
          }
        } else if (discoveredYouTubeUrl) {
          step.status = 'success'
          console.log(`[Step 0] YouTube channel discovered: ${discoveredYouTubeUrl} — proceeding to Step 1 for deep extraction`)
        } else {
          step.status = 'failed'
          console.log('[Step 0] No YouTube channel discovered')
        }
        onProgress?.(step, i)
        continue
      }

      // For Step 1: if discovery didn't find a YouTube URL and artist has no YouTube URL, skip
      if (step.method === 'youtube_about' && !discoveredYouTubeUrl && !findYouTubeUrl(artist)) {
        step.status = 'skipped'
        step.error_details = 'No YouTube URL available (discovery failed and no URL in artist data)'
        onProgress?.(step, i)
        continue
      }

      if (step.emails_found.length > 0) {
        // Quality filter: separate valid from junk emails
        const { valid, rejected } = filterEmails(step.emails_found)
        step.rejected_emails = rejected

        for (const r of rejected) {
          console.log(`[Step ${i}] Email REJECTED: ${r.email} — ${r.reason}`)
          allRejectedEmails.push({ email: r.email, source: step.method, reason: r.reason })
        }

        // Replace emails_found with only valid ones
        step.emails_found = valid

        if (valid.length > 0) {
          step.status = 'success'
          step.best_email = valid[0]

          console.log(`[Step ${i} Success] Found valid: ${valid.join(', ')} via ${step.apify_actor || 'direct'}`)

          for (const email of valid) {
            allEmails.push({ email, source: step.method, confidence: result.confidence })
          }

          if (result.confidence > bestConfidence) {
            bestEmail = valid[0]
            bestConfidence = result.confidence
            bestSource = step.method
          }

          onProgress?.(step, i)

          // Early termination — valid email found
          console.log('[Early Termination] Valid email found, skipping remaining steps')
          for (let j = i + 1; j < steps.length; j++) {
            steps[j].status = 'skipped'
          }
          break
        } else {
          // All emails were rejected — continue to next step
          step.status = 'failed'
          step.error_details = `Found ${rejected.length} email(s) but all rejected by quality filter`
          console.log(`[Step ${i}] All ${rejected.length} email(s) rejected — continuing pipeline`)
        }
      } else {
        step.status = 'failed'
        console.log(`[Step ${i} Failed] No email found`)
      }
    } catch (error: any) {
      step.status = 'failed'
      step.error = error.message
      step.duration_ms = Date.now() - stepStart
      console.error(`[Step ${i} Error]`, error.message)
    }

    onProgress?.(step, i)

    // Rate limiting between steps (1s to avoid Apify concurrent run limits)
    if (i < steps.length - 1 && steps[i + 1].status !== 'skipped') {
      await delay(1000)
    }
  }

  // Collect all error_details from failed steps into a single string
  const allErrorDetails = steps
    .filter(s => s.error_details)
    .map(s => `[${s.method}] ${s.error_details}`)
    .join('\n')

  const summary: EnrichmentSummary = {
    artist_id: artist.id,
    artist_name: artist.name,
    email_found: bestEmail || null,
    email_confidence: bestConfidence,
    email_source: bestSource,
    all_emails: allEmails,
    all_rejected_emails: allRejectedEmails,
    steps,
    total_duration_ms: Date.now() - startTime,
    is_contactable: !!bestEmail,
    error_details: allErrorDetails || undefined,
    discovered_youtube_url: discoveredYouTubeUrl,
    discovered_website: discoveredWebsite,
    discovered_linktree_url: discoveredLinktreeUrl,
    discovered_management: discoveredManagement,
    discovered_booking_agent: discoveredBookingAgent,
  }

  console.log(`[Enrichment Complete] ${bestEmail ? `Found: ${bestEmail}` : 'No email found'} (${summary.total_duration_ms}ms)\n`)

  return summary
}

// ============================================================
// BATCH ENRICHMENT
// ============================================================

export async function enrichBatch(
  artists: Artist[],
  apiKeys: { anthropic?: string },
  onArtistComplete?: (summary: EnrichmentSummary, index: number, total: number) => void,
  delayMs: number = 3000
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

    // 3s between artists to avoid Apify concurrent run limits
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
