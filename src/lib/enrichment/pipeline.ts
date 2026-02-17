/**
 * Email Enrichment Pipeline — PLATFORM-SPECIFIC APIFY ACTORS
 *
 * Each social platform uses a dedicated Apify actor that bypasses anti-bot protections.
 * The generic website-content-crawler only handles Linktree pages and artist websites.
 *
 * Pipeline flow (stops on first validated email):
 *   Step 1: YouTube  (streamers~youtube-scraper)       — ~45% hit rate
 *   Step 2: Instagram (apify~instagram-profile-scraper) — bio + businessEmail
 *   Step 3: Link-in-Bio (direct fetch → apify~website-content-crawler fallback)
 *   Step 4: Artist Website (direct fetch → apify~website-content-crawler fallback)
 *   Step 5: Facebook — SKIPPED (requires login, unreliable)
 *   Step 6: Remaining socials — SKIPPED (Twitter/Spotify/TikTok block scraping)
 *
 * Cost: ~$0.013 per artist (~$13 per 1,000 artists)
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
  steps: EnrichmentStep[]
  total_duration_ms: number
  is_contactable: boolean
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
// STEP 1: YouTube (streamers~youtube-scraper)
// ============================================================

async function step1_YouTube(
  artist: Artist,
  anthropicKey: string
): Promise<{
  emails: string[]; confidence: number; url: string; rawContent: string;
  apifyUsed: boolean; apifyActor: string; wasBlocked: boolean
}> {
  const youtubeUrl = findYouTubeUrl(artist)
  const empty = { emails: [], confidence: 0, url: '', rawContent: '', apifyUsed: false, apifyActor: '', wasBlocked: false }

  if (!youtubeUrl) {
    console.log('[Step 1] No YouTube URL found, skipping')
    return empty
  }

  console.log(`[Step 1] YouTube URL: ${youtubeUrl}`)

  const result = await apifyFetchYouTube(youtubeUrl)

  if (!result.success) {
    console.log(`[Step 1] Apify YouTube scraper failed: ${result.error}`)
    return { ...empty, url: youtubeUrl, apifyUsed: false, apifyActor: result.actorUsed }
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
  externalUrl: string | null; apifyUsed: boolean; apifyActor: string; wasBlocked: boolean
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
    return { ...empty, url: igUrl, apifyActor: result.actorUsed }
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
  apifyUsed: boolean; apifyActor: string; wasBlocked: boolean
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
        return { ...empty, url: linktreeUrl, apifyActor: apifyResult.actorUsed }
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
  apifyUsed: boolean; apifyActor: string; wasBlocked: boolean
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
        return { ...empty, url: websiteUrl, apifyActor: apifyResult.actorUsed }
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
    { method: 'youtube_about', label: 'YouTube (streamers~youtube-scraper)', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
    { method: 'instagram_bio', label: 'Instagram (apify~instagram-profile-scraper)', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
    { method: 'link_in_bio', label: 'Link-in-Bio (direct fetch / website-content-crawler)', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
    { method: 'website_contact', label: 'Artist Website (direct fetch / website-content-crawler)', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
    { method: 'facebook_about', label: 'Facebook (skipped — requires login)', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
    { method: 'remaining_socials', label: 'Remaining Socials (skipped — blocked)', status: 'pending', emails_found: [], best_email: '', confidence: 0 },
  ]

  const allEmails: Array<{ email: string; source: string; confidence: number }> = []
  let bestEmail = ''
  let bestConfidence = 0
  let bestSource = ''
  let instagramExternalUrl: string | null = null

  console.log(`\n[Enrichment Start] Artist: ${artist.name} (${artist.id})`)
  console.log(`[Enrichment] APIFY_TOKEN present: ${!!process.env.APIFY_TOKEN}`)
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
      }

      switch (step.method) {
        case 'youtube_about':
          result = await step1_YouTube(artist, apiKeys.anthropic)
          break
        case 'instagram_bio':
          result = await step2_Instagram(artist, apiKeys.anthropic)
          instagramExternalUrl = result.externalUrl || null
          break
        case 'link_in_bio':
          result = await step3_LinkInBio(artist, instagramExternalUrl, apiKeys.anthropic)
          break
        case 'website_contact':
          result = await step4_Website(artist, apiKeys.anthropic)
          break
        case 'facebook_about':
          result = await step5_Facebook(artist)
          break
        case 'remaining_socials':
          result = await step6_RemainingSocials(artist)
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

      // Steps 5 and 6 are always skipped
      if (step.method === 'facebook_about' || step.method === 'remaining_socials') {
        step.status = 'skipped'
        onProgress?.(step, i)
        continue
      }

      if (step.emails_found.length > 0) {
        step.status = 'success'
        step.best_email = step.emails_found[0]

        console.log(`[Step ${i + 1} Success] Found: ${step.emails_found.join(', ')} via ${step.apify_actor || 'direct'}`)

        for (const email of step.emails_found) {
          allEmails.push({ email, source: step.method, confidence: result.confidence })
        }

        if (result.confidence > bestConfidence) {
          bestEmail = step.emails_found[0]
          bestConfidence = result.confidence
          bestSource = step.method
        }

        onProgress?.(step, i)

        // Early termination
        console.log('[Early Termination] Email found, skipping remaining steps')
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

    // Rate limiting between steps (1s to avoid Apify concurrent run limits)
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
