#!/usr/bin/env npx ts-node
/**
 * Perplexity Instagram Deep Dive — Focused Email Extraction
 *
 * For artists who have an Instagram URL but no email yet. Hands Perplexity
 * the specific Instagram profile URL and asks it to deep-dive the bio,
 * follow link-in-bio (Linktree, Beacons, etc.), and extract contact info.
 *
 * This mirrors the Clay Claygent approach — platform-specific, focused
 * extraction massively outperforms generic wide-net searches.
 *
 * Usage:
 *   npx ts-node scripts/perplexity-instagram-deep-dive.ts ./artists_with_instagram.csv [./output.csv] [--limit N]
 *
 * Environment:
 *   PERPLEXITY_API_KEY — required
 *
 * Cost: ~$0.019/request → ~$11.40 for 600 artists
 */

import { createReadStream, writeFileSync, existsSync } from 'fs'
import { parse } from 'csv-parse'
import { stringify } from 'csv-stringify/sync'

// ============================================================
// CONFIG
// ============================================================

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions'
const MODEL = 'sonar-pro'
const DELAY_MS = 500
const RATE_LIMIT_RETRY_DELAY_MS = 5000
const MAX_TOKENS = 500
const TEMPERATURE = 0.1

const SYSTEM_PROMPT = `You are a music industry research assistant. Your job is to extract business contact information from a music artist's Instagram presence and any linked pages.

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

const FAKE_DOMAINS = [
  'example.com', 'test.com', 'email.com', 'mail.com', 'domain.com',
  'sample.com', 'placeholder.com', 'fake.com', 'none.com',
]

// ============================================================
// TYPES
// ============================================================

interface ArtistRow {
  name: string
  instagram_url: string
  youtube_url: string
  spotify_url: string
  monthly_listeners: string
}

interface DeepDiveResult {
  email: string | null
  emailSource: string | null
  website: string | null
  linktreeUrl: string | null
  additionalEmails: string[]
  management: string | null
  bookingAgent: string | null
}

interface ResultRow {
  name: string
  email: string
  email_source: string
  website: string
  linktree_url: string
  management: string
  booking_agent: string
  additional_emails: string
  status: 'email_found' | 'no_email' | 'email_invalid' | 'api_error' | 'no_instagram' | 'profile_inaccessible'
  sources: string
  instagram_url: string
  spotify_url: string
  monthly_listeners: string
}

// ============================================================
// HELPERS
// ============================================================

function parseResponse(content: string): DeepDiveResult {
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

function validateEmail(email: string): boolean {
  const parts = email.split('@')
  if (parts.length !== 2) return false
  const [, domain] = parts
  if (!domain.includes('.')) return false
  const tld = domain.split('.').pop() || ''
  if (tld.length < 2) return false
  if (FAKE_DOMAINS.includes(domain.toLowerCase())) return false
  return true
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  return `${(seconds / 60).toFixed(1)}min`
}

function buildUserPrompt(artist: ArtistRow): string {
  let prompt = `Find business contact information for the music artist "${artist.name}".

Instagram: ${artist.instagram_url}`

  if (artist.youtube_url) {
    prompt += `\nYouTube: ${artist.youtube_url}`
  }
  if (artist.spotify_url) {
    prompt += `\nSpotify: ${artist.spotify_url}`
  }

  prompt += `\n\nStart by visiting their Instagram profile. Read their bio, follow their link-in-bio, and extract all available contact information.`

  return prompt
}

// ============================================================
// CSV READING
// ============================================================

async function readCSV(filePath: string): Promise<ArtistRow[]> {
  return new Promise((resolve, reject) => {
    const rows: ArtistRow[] = []

    createReadStream(filePath)
      .pipe(parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      }))
      .on('data', (row: any) => {
        const name = (row.name || row.Name || row.artist_name || row['Artist Name'] || '').trim()
        if (name) {
          rows.push({
            name,
            instagram_url: row.instagram_url || row.Instagram || row.instagram || '',
            youtube_url: row.youtube_url || row.YouTube || row.youtube || '',
            spotify_url: row.spotify_url || row.Spotify || row.spotify || '',
            monthly_listeners: row.monthly_listeners || row['Monthly Listeners'] || row.listeners || '',
          })
        }
      })
      .on('error', reject)
      .on('end', () => resolve(rows))
  })
}

// ============================================================
// PERPLEXITY API
// ============================================================

async function queryPerplexity(
  artist: ArtistRow,
  apiKey: string
): Promise<{ content: string; citations: string[]; error?: string }> {
  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(artist) },
    ],
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    web_search_options: {
      search_context_size: 'high',
    },
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(PERPLEXITY_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (res.status === 429 && attempt === 0) {
        console.warn(`  ⚠ Rate limited (429), waiting ${RATE_LIMIT_RETRY_DELAY_MS}ms and retrying...`)
        await delay(RATE_LIMIT_RETRY_DELAY_MS)
        continue
      }

      if (!res.ok) {
        const errorText = await res.text()
        return { content: '', citations: [], error: `HTTP ${res.status}: ${errorText.slice(0, 200)}` }
      }

      const data = await res.json()
      const content = data.choices?.[0]?.message?.content || ''
      const citations: string[] = data.citations || []

      return { content, citations }
    } catch (err: any) {
      if (attempt === 0) {
        console.warn(`  ⚠ Network error, retrying: ${err.message}`)
        await delay(2000)
        continue
      }
      return { content: '', citations: [], error: err.message }
    }
  }

  return { content: '', citations: [], error: 'Max retries exceeded' }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  const args = process.argv.slice(2)
  const inputPath = args.find(a => !a.startsWith('--'))
  const outputArg = args.filter(a => !a.startsWith('--'))[1]
  const outputPath = outputArg || './emails_instagram_deep_dive.csv'

  const limitFlag = args.find(a => a.startsWith('--limit'))
  const limit = limitFlag ? parseInt(limitFlag.split('=')[1] || args[args.indexOf(limitFlag) + 1] || '0', 10) : 0

  if (!inputPath) {
    console.error('Usage: npx ts-node scripts/perplexity-instagram-deep-dive.ts <input.csv> [output.csv] [--limit N]')
    process.exit(1)
  }

  if (!existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`)
    process.exit(1)
  }

  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) {
    console.error('Missing PERPLEXITY_API_KEY environment variable')
    process.exit(1)
  }

  console.log(`\n📂 Reading: ${inputPath}`)
  let artists = await readCSV(inputPath)

  const withInstagram = artists.filter(a => a.instagram_url)
  const withoutInstagram = artists.length - withInstagram.length
  artists = withInstagram

  const seen = new Set<string>()
  const unique = artists.filter(a => {
    const key = a.name.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const toProcess = limit > 0 ? unique.slice(0, limit) : unique

  console.log(`📊 ${unique.length} unique artists with Instagram URLs (${withoutInstagram} skipped — no Instagram URL)`)
  if (limit > 0) console.log(`🔢 Processing first ${toProcess.length} (--limit ${limit})`)
  console.log(`💰 Estimated cost: ~$${(toProcess.length * 0.019).toFixed(2)}`)
  console.log(`⏱  Estimated time: ~${formatTime(toProcess.length * (DELAY_MS / 1000 + 1.5))}`)
  console.log(`🔍 Starting Perplexity Instagram Deep Dive...\n`)

  const results: ResultRow[] = []
  let found = 0
  let noEmail = 0
  let invalid = 0
  let errors = 0
  const startTime = Date.now()

  const writeResults = () => {
    if (results.length === 0) return
    const csv = stringify(results, { header: true })
    writeFileSync(outputPath, csv)
  }

  process.on('SIGINT', () => {
    console.log('\n\n⚠ Interrupted! Writing partial results...')
    writeResults()
    console.log(`📄 Partial results saved to: ${outputPath} (${results.length} rows)`)
    process.exit(0)
  })

  process.on('uncaughtException', (err) => {
    console.error('\n\n❌ Uncaught exception:', err.message)
    writeResults()
    console.log(`📄 Partial results saved to: ${outputPath} (${results.length} rows)`)
    process.exit(1)
  })

  for (let i = 0; i < toProcess.length; i++) {
    const artist = toProcess[i]

    if (i > 0 && i % 10 === 0) {
      const elapsed = (Date.now() - startTime) / 1000
      const rate = i / elapsed
      const remaining = (toProcess.length - i) / rate
      console.log(
        `[${i}/${toProcess.length}] Found: ${found} | No email: ${noEmail} | Invalid: ${invalid} | Errors: ${errors} | ${rate.toFixed(1)}/sec | ETA: ${formatTime(remaining)}`
      )
    }

    const result: ResultRow = {
      name: artist.name,
      email: '',
      email_source: '',
      website: '',
      linktree_url: '',
      management: '',
      booking_agent: '',
      additional_emails: '',
      status: 'no_email',
      sources: '',
      instagram_url: artist.instagram_url,
      spotify_url: artist.spotify_url,
      monthly_listeners: artist.monthly_listeners,
    }

    const response = await queryPerplexity(artist, apiKey)

    if (response.error) {
      result.status = 'api_error'
      errors++
      console.log(`  ❌ [${i + 1}] ${artist.name} — API error: ${response.error}`)
    } else {
      const deepDive = parseResponse(response.content)

      result.website = deepDive.website || ''
      result.linktree_url = deepDive.linktreeUrl || ''
      result.management = deepDive.management || ''
      result.booking_agent = deepDive.bookingAgent || ''
      result.additional_emails = deepDive.additionalEmails.join(', ')
      result.email_source = deepDive.emailSource || ''

      if (deepDive.email && validateEmail(deepDive.email)) {
        result.email = deepDive.email
        result.status = 'email_found'
        found++
        console.log(`  ✅ [${i + 1}] ${artist.name} — ${deepDive.email} (via ${deepDive.emailSource})${deepDive.management ? ` [Mgmt: ${deepDive.management}]` : ''}${deepDive.linktreeUrl ? ` [Linktree: ${deepDive.linktreeUrl}]` : ''}`)
      } else if (deepDive.email) {
        result.status = 'email_invalid'
        invalid++
        console.log(`  ⚠️  [${i + 1}] ${artist.name} — invalid email: ${deepDive.email}`)
      } else {
        result.status = 'no_email'
        noEmail++
        const extras = [
          deepDive.website ? `website: ${deepDive.website}` : '',
          deepDive.linktreeUrl ? `linktree: ${deepDive.linktreeUrl}` : '',
          deepDive.management ? `mgmt: ${deepDive.management}` : '',
          deepDive.bookingAgent ? `agent: ${deepDive.bookingAgent}` : '',
        ].filter(Boolean).join(', ')
        console.log(`  ⬜ [${i + 1}] ${artist.name} — no email${extras ? ` (but found: ${extras})` : ''}`)
      }

      if (response.citations.length > 0) {
        result.sources = response.citations.slice(0, 3).join('|')
      }
    }

    results.push(result)

    if (i < toProcess.length - 1) {
      await delay(DELAY_MS)
    }
  }

  writeResults()

  const totalTime = (Date.now() - startTime) / 1000
  const costEstimate = (toProcess.length * 0.019).toFixed(2)

  console.log(`
===== PERPLEXITY INSTAGRAM DEEP DIVE RESULTS =====
Total artists processed: ${toProcess.length}
Emails found:            ${found} (${(found / toProcess.length * 100).toFixed(1)}%)
No email found:          ${noEmail} (${(noEmail / toProcess.length * 100).toFixed(1)}%)
Invalid emails:          ${invalid} (${(invalid / toProcess.length * 100).toFixed(1)}%)
API errors:              ${errors} (${(errors / toProcess.length * 100).toFixed(1)}%)

Time taken:    ${formatTime(totalTime)}
Cost estimate: ~$${costEstimate} (${toProcess.length} requests × ~$0.019/request)
Output:        ${outputPath}
====================================================
`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
