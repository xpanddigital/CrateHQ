#!/usr/bin/env npx ts-node
/**
 * Perplexity YouTube Deep Dive — Focused Email Extraction
 *
 * For artists who have a YouTube URL but no email yet. Hands Perplexity
 * the specific YouTube channel URL and asks it to deep-dive the About
 * page, linked websites, and any visible contact info.
 *
 * This is higher-leverage than the generic search because you're pointing
 * Perplexity at a known, high-value page rather than searching blindly.
 *
 * Usage:
 *   npx ts-node scripts/perplexity-youtube-deep-dive.ts ./artists_with_youtube.csv [./output.csv] [--limit N]
 *
 * Environment:
 *   PERPLEXITY_API_KEY — required
 *
 * Cost: ~$0.019/request → ~$9.50 for 500 artists
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

const SYSTEM_PROMPT = `You are a music industry research assistant. Your job is to extract business contact information from a music artist's YouTube presence.

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

const FAKE_DOMAINS = [
  'example.com', 'test.com', 'email.com', 'mail.com', 'domain.com',
  'sample.com', 'placeholder.com', 'fake.com', 'none.com',
]

// ============================================================
// TYPES
// ============================================================

interface ArtistRow {
  name: string
  youtube_url: string
  spotify_url: string
  monthly_listeners: string
}

interface DeepDiveResult {
  email: string | null
  emailSource: string | null
  website: string | null
  additionalEmails: string[]
  management: string | null
  bookingAgent: string | null
}

interface ResultRow {
  name: string
  email: string
  email_source: string
  website: string
  management: string
  booking_agent: string
  additional_emails: string
  status: 'email_found' | 'no_email' | 'email_invalid' | 'api_error' | 'no_youtube'
  sources: string
  youtube_url: string
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
  return `Find business contact information for the music artist "${artist.name}".

YouTube channel: ${artist.youtube_url}
${artist.spotify_url ? `Spotify: ${artist.spotify_url}` : ''}

Start by visiting their YouTube channel and extract all available contact information.`
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
  const outputPath = outputArg || './emails_youtube_deep_dive.csv'

  const limitFlag = args.find(a => a.startsWith('--limit'))
  const limit = limitFlag ? parseInt(limitFlag.split('=')[1] || args[args.indexOf(limitFlag) + 1] || '0', 10) : 0

  if (!inputPath) {
    console.error('Usage: npx ts-node scripts/perplexity-youtube-deep-dive.ts <input.csv> [output.csv] [--limit N]')
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

  // Filter to only artists with YouTube URLs
  const withYoutube = artists.filter(a => a.youtube_url)
  const withoutYoutube = artists.length - withYoutube.length
  artists = withYoutube

  // Deduplicate by name
  const seen = new Set<string>()
  const unique = artists.filter(a => {
    const key = a.name.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const toProcess = limit > 0 ? unique.slice(0, limit) : unique

  console.log(`📊 ${unique.length} unique artists with YouTube URLs (${withoutYoutube} skipped — no YouTube URL)`)
  if (limit > 0) console.log(`🔢 Processing first ${toProcess.length} (--limit ${limit})`)
  console.log(`💰 Estimated cost: ~$${(toProcess.length * 0.019).toFixed(2)}`)
  console.log(`⏱  Estimated time: ~${formatTime(toProcess.length * (DELAY_MS / 1000 + 1.5))}`)
  console.log(`🔍 Starting Perplexity YouTube Deep Dive...\n`)

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
      management: '',
      booking_agent: '',
      additional_emails: '',
      status: 'no_email',
      sources: '',
      youtube_url: artist.youtube_url,
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
      result.management = deepDive.management || ''
      result.booking_agent = deepDive.bookingAgent || ''
      result.additional_emails = deepDive.additionalEmails.join(', ')
      result.email_source = deepDive.emailSource || ''

      if (deepDive.email && validateEmail(deepDive.email)) {
        result.email = deepDive.email
        result.status = 'email_found'
        found++
        console.log(`  ✅ [${i + 1}] ${artist.name} — ${deepDive.email} (via ${deepDive.emailSource})${deepDive.management ? ` [Mgmt: ${deepDive.management}]` : ''}`)
      } else if (deepDive.email) {
        result.status = 'email_invalid'
        invalid++
        console.log(`  ⚠️  [${i + 1}] ${artist.name} — invalid email: ${deepDive.email}`)
      } else {
        result.status = 'no_email'
        noEmail++
        const extras = [
          deepDive.website ? `website: ${deepDive.website}` : '',
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
===== PERPLEXITY YOUTUBE DEEP DIVE RESULTS =====
Total artists processed: ${toProcess.length}
Emails found:            ${found} (${(found / toProcess.length * 100).toFixed(1)}%)
No email found:          ${noEmail} (${(noEmail / toProcess.length * 100).toFixed(1)}%)
Invalid emails:          ${invalid} (${(invalid / toProcess.length * 100).toFixed(1)}%)
API errors:              ${errors} (${(errors / toProcess.length * 100).toFixed(1)}%)

Time taken:    ${formatTime(totalTime)}
Cost estimate: ~$${costEstimate} (${toProcess.length} requests × ~$0.019/request)
Output:        ${outputPath}
=================================================
`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
