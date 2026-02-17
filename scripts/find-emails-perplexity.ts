#!/usr/bin/env npx ts-node
/**
 * Perplexity Sonar Email Finder — Last-Resort Enrichment
 *
 * Reads a CSV of artists who still need emails (after YouTube, Instagram,
 * Facebook, Apify, and all other enrichment steps failed), queries
 * Perplexity's Sonar API (which has built-in web search), validates
 * results, and outputs a clean CSV.
 *
 * Usage:
 *   npx ts-node scripts/find-emails-perplexity.ts ./artists_no_email.csv [./output.csv]
 *
 * Environment:
 *   PERPLEXITY_API_KEY — required
 *
 * Cost: ~$0.006/request → ~$1.50 for 250 artists, ~$6 for 1,000
 */

import { createReadStream, writeFileSync, existsSync } from 'fs'
import { parse } from 'csv-parse'
import { stringify } from 'csv-stringify/sync'

// ============================================================
// CONFIG
// ============================================================

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions'
const MODEL = 'sonar'
const DELAY_MS = 500
const RATE_LIMIT_RETRY_DELAY_MS = 5000
const MAX_TOKENS = 300
const TEMPERATURE = 0.1

const SYSTEM_PROMPT = `You are an email research assistant for a music industry catalog fund.

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

const FAKE_DOMAINS = [
  'example.com', 'test.com', 'email.com', 'mail.com', 'domain.com',
  'sample.com', 'placeholder.com', 'fake.com', 'none.com',
]

// ============================================================
// TYPES
// ============================================================

interface ArtistRow {
  name: string
  spotify_url: string
  monthly_listeners: string
  youtube_url: string
}

interface ResultRow {
  name: string
  email: string
  status: 'email_found' | 'no_email' | 'email_invalid' | 'api_error'
  sources: string
  spotify_url: string
  monthly_listeners: string
  youtube_url: string
}

// ============================================================
// HELPERS
// ============================================================

function extractEmail(text: string): string | null {
  const cleaned = text.trim().replace(/^["'`]+|["'`]+$/g, '').replace(/\*\*/g, '').trim()
  const match = cleaned.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  return match ? match[0].toLowerCase() : null
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
            spotify_url: row.spotify_url || row.Spotify || row.spotify || '',
            monthly_listeners: row.monthly_listeners || row['Monthly Listeners'] || row.listeners || '',
            youtube_url: row.youtube_url || row.YouTube || row.youtube || '',
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
  artistName: string,
  apiKey: string
): Promise<{ content: string; citations: string[]; error?: string }> {
  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Find a business/booking/management contact email for the music artist "${artistName}".` },
    ],
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    web_search_options: {
      search_context_size: 'low',
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
  const inputPath = process.argv[2]
  const outputPath = process.argv[3] || './emails_perplexity_found.csv'

  if (!inputPath) {
    console.error('Usage: npx ts-node scripts/find-emails-perplexity.ts <input.csv> [output.csv]')
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
  const artists = await readCSV(inputPath)

  // Deduplicate by name
  const seen = new Set<string>()
  const unique = artists.filter(a => {
    const key = a.name.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  console.log(`📊 ${unique.length} unique artists loaded (${artists.length - unique.length} duplicates removed)`)
  console.log(`💰 Estimated cost: ~$${(unique.length * 0.006).toFixed(2)}`)
  console.log(`⏱  Estimated time: ~${formatTime(unique.length * (DELAY_MS / 1000 + 0.5))}`)
  console.log(`🔍 Starting Perplexity Sonar email search...\n`)

  const results: ResultRow[] = []
  let found = 0
  let noEmail = 0
  let invalid = 0
  let errors = 0
  const startTime = Date.now()

  // Graceful shutdown — write partial results
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

  for (let i = 0; i < unique.length; i++) {
    const artist = unique[i]

    // Progress log every 10 artists
    if (i > 0 && i % 10 === 0) {
      const elapsed = (Date.now() - startTime) / 1000
      const rate = i / elapsed
      const remaining = (unique.length - i) / rate
      console.log(
        `[${i}/${unique.length}] Found: ${found} | No email: ${noEmail} | Invalid: ${invalid} | Errors: ${errors} | ${rate.toFixed(1)}/sec | ETA: ${formatTime(remaining)}`
      )
    }

    const result: ResultRow = {
      name: artist.name,
      email: '',
      status: 'no_email',
      sources: '',
      spotify_url: artist.spotify_url,
      monthly_listeners: artist.monthly_listeners,
      youtube_url: artist.youtube_url,
    }

    const response = await queryPerplexity(artist.name, apiKey)

    if (response.error) {
      result.status = 'api_error'
      errors++
      console.log(`  ❌ [${i + 1}] ${artist.name} — API error: ${response.error}`)
    } else {
      const content = response.content.trim()

      if (content.includes('NO_EMAIL_FOUND') || !content.includes('@')) {
        result.status = 'no_email'
        noEmail++
        console.log(`  ⬜ [${i + 1}] ${artist.name} — no email found`)
      } else {
        const email = extractEmail(content)

        if (email && validateEmail(email)) {
          result.email = email
          result.status = 'email_found'
          found++
          console.log(`  ✅ [${i + 1}] ${artist.name} — ${email}`)
        } else {
          result.status = 'email_invalid'
          invalid++
          console.log(`  ⚠️  [${i + 1}] ${artist.name} — invalid email: ${email || content.slice(0, 50)}`)
        }
      }

      // Capture citation sources
      if (response.citations.length > 0) {
        result.sources = response.citations.slice(0, 3).join('|')
      }
    }

    results.push(result)

    // Delay between calls
    if (i < unique.length - 1) {
      await delay(DELAY_MS)
    }
  }

  // Write final results
  writeResults()

  // Summary
  const totalTime = (Date.now() - startTime) / 1000
  const costEstimate = (unique.length * 0.006).toFixed(2)

  console.log(`
===== PERPLEXITY EMAIL FINDER RESULTS =====
Total artists processed: ${unique.length}
Emails found:            ${found} (${(found / unique.length * 100).toFixed(1)}%)
No email found:          ${noEmail} (${(noEmail / unique.length * 100).toFixed(1)}%)
Invalid emails:          ${invalid} (${(invalid / unique.length * 100).toFixed(1)}%)
API errors:              ${errors} (${(errors / unique.length * 100).toFixed(1)}%)

Time taken:    ${formatTime(totalTime)}
Cost estimate: ~$${costEstimate} (${unique.length} requests × ~$0.006/request)
Output:        ${outputPath}
============================================
`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
