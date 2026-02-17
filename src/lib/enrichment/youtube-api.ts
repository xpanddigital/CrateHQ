/**
 * YouTube Data API v3 — Channel Discovery
 *
 * Two-pass approach:
 *   Pass 1: YouTube Data API search → find channel by artist name + context
 *   Pass 2: Haiku verification → confirm the match is correct
 *
 * The API returns channel descriptions which often contain booking emails.
 * This replaces blind URL guessing with real search results.
 *
 * Quota: search.list = 100 units, channels.list = 1 unit
 * Free tier: 10,000 units/day (~100 searches/day)
 */

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3'

// ============================================================
// TYPES
// ============================================================

export interface YouTubeChannel {
  channelId: string
  title: string
  description: string
  customUrl: string
  thumbnailUrl: string
  subscriberCount: number
  videoCount: number
  viewCount: number
  country: string
  publishedAt: string
}

export interface YouTubeDiscoveryResult {
  success: boolean
  channel: YouTubeChannel | null
  channelUrl: string
  confidence: number
  method: 'youtube_data_api' | 'youtube_data_api+haiku_verify'
  searchQuery: string
  candidatesFound: number
  error?: string
  emailsFromDescription: string[]
  description: string
}

// ============================================================
// BLOCKED EMAIL / DOMAIN PATTERNS (shared with pipeline)
// ============================================================

const JUNK_DOMAINS = [
  'example.com', 'test.com', 'localhost', 'wixpress.com', 'sentry.io',
  'cloudflare.com', 'googleapis.com', 'w3.org', 'schema.org',
  'spotify.com', 'apple.com', 'youtube.com', 'instagram.com',
  'facebook.com', 'twitter.com', 'tiktok.com', 'x.com',
]

const BLOCKED_EMAIL_PATTERNS = [
  'support@', 'help@', 'noreply@', 'no-reply@', 'mailer-daemon@',
  'info@youtube', 'info@instagram', 'info@facebook', 'info@twitter',
  'example@example.com', 'test@test.com', 'admin@', 'webmaster@',
  'postmaster@', 'abuse@', 'privacy@', 'legal@', 'dmca@',
]

function extractEmailsFromText(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const emails = text.match(emailRegex) || []

  return emails.filter(e => {
    const lower = e.toLowerCase()
    const domain = lower.split('@')[1]
    if (JUNK_DOMAINS.some(junk => domain === junk || domain.endsWith('.' + junk))) return false
    if (BLOCKED_EMAIL_PATTERNS.some(pattern => lower.includes(pattern))) return false
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.gif') ||
        lower.endsWith('.svg') || lower.endsWith('.css') || lower.endsWith('.js')) return false
    return true
  })
}

// ============================================================
// YOUTUBE DATA API: Search for channels
// ============================================================

interface SearchResult {
  channelId: string
  title: string
  description: string
  thumbnailUrl: string
}

async function searchYouTubeChannels(
  query: string,
  apiKey: string,
  maxResults: number = 5
): Promise<{ results: SearchResult[]; error?: string }> {
  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'channel',
    maxResults: String(maxResults),
    key: apiKey,
  })

  const url = `${YT_API_BASE}/search?${params}`
  console.log(`[YouTube API] Search: "${query}" (max ${maxResults})`)

  try {
    const res = await fetch(url)
    const bodyText = await res.text()

    if (!res.ok) {
      console.error(`[YouTube API] Search failed: HTTP ${res.status}, Body: ${bodyText.slice(0, 300)}`)
      return { results: [], error: `YouTube API HTTP ${res.status}: ${bodyText.slice(0, 200)}` }
    }

    let data: any
    try {
      data = JSON.parse(bodyText)
    } catch {
      return { results: [], error: `YouTube API returned non-JSON: ${bodyText.slice(0, 200)}` }
    }

    const items = data.items || []
    console.log(`[YouTube API] Found ${items.length} channels for "${query}"`)

    return {
      results: items.map((item: any) => ({
        channelId: item.snippet?.channelId || item.id?.channelId || '',
        title: item.snippet?.title || '',
        description: item.snippet?.description || '',
        thumbnailUrl: item.snippet?.thumbnails?.default?.url || '',
      })),
    }
  } catch (error: any) {
    console.error(`[YouTube API] Search error:`, error.message)
    return { results: [], error: error.message }
  }
}

// ============================================================
// YOUTUBE DATA API: Get channel details
// ============================================================

async function getChannelDetails(
  channelId: string,
  apiKey: string
): Promise<YouTubeChannel | null> {
  const params = new URLSearchParams({
    part: 'snippet,statistics,brandingSettings',
    id: channelId,
    key: apiKey,
  })

  const url = `${YT_API_BASE}/channels?${params}`
  console.log(`[YouTube API] Getting channel details for: ${channelId}`)

  try {
    const res = await fetch(url)
    const bodyText = await res.text()

    if (!res.ok) {
      console.error(`[YouTube API] Channel details failed: HTTP ${res.status}`)
      return null
    }

    let data: any
    try {
      data = JSON.parse(bodyText)
    } catch {
      return null
    }

    const item = data.items?.[0]
    if (!item) return null

    return {
      channelId: item.id,
      title: item.snippet?.title || '',
      description: item.snippet?.description || '',
      customUrl: item.snippet?.customUrl || '',
      thumbnailUrl: item.snippet?.thumbnails?.default?.url || '',
      subscriberCount: parseInt(item.statistics?.subscriberCount || '0', 10),
      videoCount: parseInt(item.statistics?.videoCount || '0', 10),
      viewCount: parseInt(item.statistics?.viewCount || '0', 10),
      country: item.snippet?.country || '',
      publishedAt: item.snippet?.publishedAt || '',
    }
  } catch (error: any) {
    console.error(`[YouTube API] Channel details error:`, error.message)
    return null
  }
}

// ============================================================
// HAIKU VERIFICATION — Confirm the match is correct
// ============================================================

async function verifyWithHaiku(
  artist: { name: string; spotify_url?: string | null; instagram_handle?: string | null; genres?: string[]; spotify_monthly_listeners?: number },
  candidates: Array<{ channel: YouTubeChannel; searchRank: number }>,
  anthropicKey: string
): Promise<{ channelId: string; confidence: number; reasoning: string } | null> {
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey: anthropicKey })

    const candidateDescriptions = candidates.map((c, i) => {
      const ch = c.channel
      return `Candidate ${i + 1}:
  - Channel name: "${ch.title}"
  - Subscribers: ${ch.subscriberCount.toLocaleString()}
  - Videos: ${ch.videoCount}
  - Total views: ${ch.viewCount.toLocaleString()}
  - Country: ${ch.country || 'unknown'}
  - Custom URL: ${ch.customUrl || 'none'}
  - Description: ${ch.description.slice(0, 500)}
  - Channel ID: ${ch.channelId}`
    }).join('\n\n')

    const prompt = `You are verifying which YouTube channel belongs to a specific music artist.

ARTIST INFO:
- Name: "${artist.name}"
- Spotify URL: ${artist.spotify_url || 'none'}
- Instagram: ${artist.instagram_handle || 'none'}
- Genres: ${(artist.genres || []).join(', ') || 'unknown'}
- Spotify monthly listeners: ${artist.spotify_monthly_listeners?.toLocaleString() || 'unknown'}

YOUTUBE CHANNEL CANDIDATES:
${candidateDescriptions}

RULES:
1. Match based on: name similarity, content type (music), subscriber count relative to Spotify listeners, description mentioning the artist's other socials or music
2. A channel with 100 subscribers is unlikely to be an artist with 1M Spotify listeners
3. Look for mentions of Spotify, Instagram, or the artist name in the channel description
4. If the channel name is an exact or very close match to the artist name AND it's a music channel, that's a strong signal
5. If NO candidate is a good match, say so — don't force a match

Return JSON only:
{"channelId": "the_channel_id", "confidence": 0.0-1.0, "reasoning": "brief explanation"}
If no good match: {"channelId": "", "confidence": 0, "reasoning": "No matching channel found"}`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)

    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        console.log(`[Haiku Verify] Result: channelId=${parsed.channelId}, confidence=${parsed.confidence}, reason="${parsed.reasoning}"`)
        return parsed
      } catch {
        console.warn(`[Haiku Verify] Failed to parse JSON: ${match[0].slice(0, 200)}`)
        return null
      }
    }

    return null
  } catch (error: any) {
    console.error(`[Haiku Verify] Error:`, error.message)
    return null
  }
}

// ============================================================
// RESOLVE: Extract channel ID from a YouTube URL
// ============================================================

async function resolveChannelId(
  youtubeUrl: string,
  apiKey: string
): Promise<string | null> {
  // Format: youtube.com/channel/UCxxxxxx
  const channelMatch = youtubeUrl.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/)
  if (channelMatch) return channelMatch[1]

  // Format: youtube.com/@handle or youtube.com/c/name or youtube.com/user/name
  const handleMatch = youtubeUrl.match(/youtube\.com\/(@[a-zA-Z0-9._-]+|c\/[a-zA-Z0-9._-]+|user\/[a-zA-Z0-9._-]+)/)
  if (handleMatch) {
    const handle = handleMatch[1]
    console.log(`[YouTube API] Resolving handle "${handle}" to channel ID`)

    // Use search to resolve handle → channel ID
    const query = handle.startsWith('@') ? handle.slice(1) : handle.replace(/^(c|user)\//, '')
    const params = new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'channel',
      maxResults: '1',
      key: apiKey,
    })

    try {
      const res = await fetch(`${YT_API_BASE}/search?${params}`)
      if (!res.ok) return null

      const data = JSON.parse(await res.text())
      const channelId = data.items?.[0]?.snippet?.channelId || data.items?.[0]?.id?.channelId
      if (channelId) {
        console.log(`[YouTube API] Resolved "${handle}" → ${channelId}`)
        return channelId
      }
    } catch {
      // Fall through
    }
  }

  // Last resort: try the URL as a search query
  const urlParts = youtubeUrl.replace(/https?:\/\/(www\.)?youtube\.com\/?/, '').replace(/\//g, ' ').trim()
  if (urlParts) {
    const params = new URLSearchParams({
      part: 'snippet',
      q: urlParts,
      type: 'channel',
      maxResults: '1',
      key: apiKey,
    })

    try {
      const res = await fetch(`${YT_API_BASE}/search?${params}`)
      if (!res.ok) return null

      const data = JSON.parse(await res.text())
      return data.items?.[0]?.snippet?.channelId || data.items?.[0]?.id?.channelId || null
    } catch {
      return null
    }
  }

  return null
}

// ============================================================
// FETCH: Get description/about from an existing YouTube URL
// ============================================================

export async function fetchYouTubeDescription(
  youtubeUrl: string,
  apiKey: string
): Promise<{
  success: boolean
  channel: YouTubeChannel | null
  description: string
  emailsFromDescription: string[]
  error?: string
}> {
  const empty = { success: false, channel: null, description: '', emailsFromDescription: [] }

  if (!apiKey) {
    return { ...empty, error: 'No YouTube API key configured' }
  }

  console.log(`[YouTube API] Fetching description for existing URL: ${youtubeUrl}`)

  const channelId = await resolveChannelId(youtubeUrl, apiKey)

  if (!channelId) {
    console.log(`[YouTube API] Could not resolve channel ID from URL: ${youtubeUrl}`)
    return { ...empty, error: `Could not resolve channel ID from URL: ${youtubeUrl}` }
  }

  const channel = await getChannelDetails(channelId, apiKey)

  if (!channel) {
    return { ...empty, error: `Could not fetch channel details for ID: ${channelId}` }
  }

  const emails = extractEmailsFromText(channel.description)
  console.log(`[YouTube API] Channel: "${channel.title}", Description: ${channel.description.length} chars, Emails found: ${emails.length}`)

  return {
    success: true,
    channel,
    description: channel.description,
    emailsFromDescription: emails,
  }
}

// ============================================================
// MAIN: Discover YouTube channel for an artist
// ============================================================

export async function discoverYouTubeChannel(
  artist: {
    name: string
    spotify_url?: string | null
    instagram_handle?: string | null
    genres?: string[]
    spotify_monthly_listeners?: number
    social_links?: Record<string, string>
  },
  apiKeys: { youtube: string; anthropic: string }
): Promise<YouTubeDiscoveryResult> {
  const empty: YouTubeDiscoveryResult = {
    success: false,
    channel: null,
    channelUrl: '',
    confidence: 0,
    method: 'youtube_data_api',
    searchQuery: '',
    candidatesFound: 0,
    emailsFromDescription: [],
    description: '',
  }

  if (!apiKeys.youtube) {
    return { ...empty, error: 'No YouTube API key configured' }
  }

  // Build search query — artist name is primary, add "music" for disambiguation
  const searchQuery = `${artist.name} music artist`
  console.log(`\n[YouTube Discovery] Starting for: "${artist.name}"`)

  // Pass 1: YouTube Data API search
  const searchResult = await searchYouTubeChannels(searchQuery, apiKeys.youtube, 5)

  if (searchResult.error) {
    return { ...empty, searchQuery, error: searchResult.error }
  }

  if (searchResult.results.length === 0) {
    console.log(`[YouTube Discovery] No channels found for "${artist.name}"`)
    return { ...empty, searchQuery, error: 'No YouTube channels found' }
  }

  // Get full details for top candidates (up to 3)
  const topCandidates = searchResult.results.slice(0, 3)
  const detailedCandidates: Array<{ channel: YouTubeChannel; searchRank: number }> = []

  for (const candidate of topCandidates) {
    if (!candidate.channelId) continue
    const details = await getChannelDetails(candidate.channelId, apiKeys.youtube)
    if (details) {
      detailedCandidates.push({ channel: details, searchRank: detailedCandidates.length + 1 })
    }
  }

  if (detailedCandidates.length === 0) {
    return { ...empty, searchQuery, candidatesFound: searchResult.results.length, error: 'Could not fetch channel details' }
  }

  console.log(`[YouTube Discovery] Got details for ${detailedCandidates.length} candidates`)

  // Quick check: if the #1 result is an exact name match, high confidence without Haiku
  const topChannel = detailedCandidates[0].channel
  const nameMatch = topChannel.title.toLowerCase().trim() === artist.name.toLowerCase().trim()
  const isMusic = topChannel.description.toLowerCase().includes('music') ||
                  topChannel.description.toLowerCase().includes('artist') ||
                  topChannel.description.toLowerCase().includes('booking') ||
                  topChannel.description.toLowerCase().includes('spotify') ||
                  topChannel.videoCount > 0

  if (nameMatch && isMusic && detailedCandidates.length === 1) {
    // Exact match, only one candidate — high confidence, skip Haiku
    const channelUrl = topChannel.customUrl
      ? `https://www.youtube.com/${topChannel.customUrl}`
      : `https://www.youtube.com/channel/${topChannel.channelId}`

    const emails = extractEmailsFromText(topChannel.description)

    console.log(`[YouTube Discovery] Exact name match: "${topChannel.title}" → ${channelUrl}`)
    return {
      success: true,
      channel: topChannel,
      channelUrl,
      confidence: 0.95,
      method: 'youtube_data_api',
      searchQuery,
      candidatesFound: detailedCandidates.length,
      emailsFromDescription: emails,
      description: topChannel.description,
    }
  }

  // Pass 2: Haiku verification for ambiguous cases
  console.log(`[YouTube Discovery] Multiple/ambiguous candidates — calling Haiku for verification`)

  const haikuResult = await verifyWithHaiku(artist, detailedCandidates, apiKeys.anthropic)

  if (haikuResult && haikuResult.channelId && haikuResult.confidence >= 0.5) {
    const matchedCandidate = detailedCandidates.find(c => c.channel.channelId === haikuResult.channelId)

    if (matchedCandidate) {
      const ch = matchedCandidate.channel
      const channelUrl = ch.customUrl
        ? `https://www.youtube.com/${ch.customUrl}`
        : `https://www.youtube.com/channel/${ch.channelId}`

      const emails = extractEmailsFromText(ch.description)

      console.log(`[YouTube Discovery] Haiku verified: "${ch.title}" (confidence: ${haikuResult.confidence}) → ${channelUrl}`)
      return {
        success: true,
        channel: ch,
        channelUrl,
        confidence: haikuResult.confidence,
        method: 'youtube_data_api+haiku_verify',
        searchQuery,
        candidatesFound: detailedCandidates.length,
        emailsFromDescription: emails,
        description: ch.description,
      }
    }
  }

  // Haiku didn't confirm any match — fall back to top result if name is close
  const topNameLower = topChannel.title.toLowerCase().replace(/[^a-z0-9]/g, '')
  const artistNameLower = artist.name.toLowerCase().replace(/[^a-z0-9]/g, '')
  const isFuzzyMatch = topNameLower.includes(artistNameLower) || artistNameLower.includes(topNameLower)

  if (isFuzzyMatch) {
    const channelUrl = topChannel.customUrl
      ? `https://www.youtube.com/${topChannel.customUrl}`
      : `https://www.youtube.com/channel/${topChannel.channelId}`

    const emails = extractEmailsFromText(topChannel.description)

    console.log(`[YouTube Discovery] Fuzzy name match (Haiku uncertain): "${topChannel.title}" → ${channelUrl} (confidence: 0.6)`)
    return {
      success: true,
      channel: topChannel,
      channelUrl,
      confidence: 0.6,
      method: 'youtube_data_api+haiku_verify',
      searchQuery,
      candidatesFound: detailedCandidates.length,
      emailsFromDescription: emails,
      description: topChannel.description,
    }
  }

  console.log(`[YouTube Discovery] No confident match found for "${artist.name}"`)
  return {
    ...empty,
    searchQuery,
    candidatesFound: detailedCandidates.length,
    error: `Haiku could not verify any of ${detailedCandidates.length} candidates. ${haikuResult?.reasoning || ''}`,
  }
}
