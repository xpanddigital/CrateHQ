/**
 * Apify Fallback for Enrichment Pipeline
 * 
 * When direct fetch() fails or returns blocked content, this class
 * automatically falls back to Apify scraper actors for that platform.
 * 
 * Requires Apify token and actor IDs configured in settings.
 */

import { startActorRun, getRunStatus, getDatasetItems } from '@/lib/apify/client'

export interface ApifyFallbackResult {
  content: string
  emails: string[]
  bioText: string
  links: string[]
  success: boolean
  error?: string
}

export interface ApifyConfig {
  token: string
  youtubeActorId?: string
  instagramActorId?: string
  websiteActorId?: string
  facebookActorId?: string
}

export class ApifyEnrichmentFallback {
  private config: ApifyConfig

  constructor(config: ApifyConfig) {
    this.config = config
  }

  /**
   * Check if content appears to be blocked or empty
   */
  static isBlockedContent(html: string, platform: string): boolean {
    if (!html || html.length < 500) return true

    const blockSignals: Record<string, string[]> = {
      youtube: [
        'consent.youtube.com',
        'accounts.google.com/ServiceLogin',
        'before you continue',
        'Sign in to confirm',
        'This page requires JavaScript'
      ],
      instagram: [
        'Login • Instagram',
        'Create an account',
        'log in to see',
        'Sign up to see photos',
        'Not Found'
      ],
      facebook: [
        'You must log in',
        'Log Into Facebook',
        'Create new account',
        'Facebook - Log In',
        'Sign Up for Facebook'
      ],
      twitter: [
        'Sign in to Twitter',
        'Sign up for Twitter',
        'Log in to Twitter'
      ],
    }

    const signals = blockSignals[platform] || []
    return signals.some(signal => html.toLowerCase().includes(signal.toLowerCase()))
  }

  /**
   * Wait for Apify actor run to complete
   */
  private async waitForRun(runId: string, maxWaitMs: number = 120000): Promise<any> {
    const startTime = Date.now()
    const pollInterval = 3000 // 3 seconds

    while (Date.now() - startTime < maxWaitMs) {
      const status = await getRunStatus(this.config.token, runId)
      
      if (status.data.status === 'SUCCEEDED') {
        return status.data
      } else if (status.data.status === 'FAILED' || status.data.status === 'ABORTED') {
        throw new Error(`Actor run ${status.data.status}: ${status.data.statusMessage || 'Unknown error'}`)
      }

      // Still running, wait and poll again
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    throw new Error('Actor run timeout')
  }

  /**
   * Extract emails from text content
   */
  private extractEmails(text: string): string[] {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
    const emails = text.match(emailRegex) || []
    return Array.from(new Set(emails))
  }

  /**
   * Scrape YouTube channel About page
   */
  async scrapeYouTube(channelUrl: string): Promise<ApifyFallbackResult> {
    if (!this.config.youtubeActorId) {
      return {
        content: '',
        emails: [],
        bioText: '',
        links: [],
        success: false,
        error: 'YouTube actor not configured'
      }
    }

    try {
      console.log(`[Apify Fallback] Scraping YouTube: ${channelUrl}`)

      // Start the actor
      const run = await startActorRun(this.config.token, this.config.youtubeActorId, {
        startUrls: [{ url: channelUrl + '/about' }],
        maxItems: 1,
      })

      // Wait for completion
      const completedRun = await this.waitForRun(run.data.id)

      // Get results
      const items = await getDatasetItems(this.config.token, completedRun.defaultDatasetId)

      if (!items || items.length === 0) {
        return {
          content: '',
          emails: [],
          bioText: '',
          links: [],
          success: false,
          error: 'No data returned from YouTube scraper'
        }
      }

      const data = items[0]
      const content = [
        data.description || '',
        data.aboutText || '',
        data.businessEmail || '',
        data.contactInfo || '',
      ].join('\n\n')

      const emails = this.extractEmails(content)
      if (data.businessEmail) {
        emails.unshift(data.businessEmail)
      }

      const links = data.links || []

      console.log(`[Apify Fallback] YouTube scrape success: ${emails.length} emails found`)

      return {
        content,
        emails: Array.from(new Set(emails)),
        bioText: data.description || '',
        links,
        success: true
      }
    } catch (error: any) {
      console.error('[Apify Fallback] YouTube scrape error:', error.message)
      return {
        content: '',
        emails: [],
        bioText: '',
        links: [],
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Scrape Instagram profile
   */
  async scrapeInstagram(handle: string): Promise<ApifyFallbackResult> {
    if (!this.config.instagramActorId) {
      return {
        content: '',
        emails: [],
        bioText: '',
        links: [],
        success: false,
        error: 'Instagram actor not configured'
      }
    }

    try {
      console.log(`[Apify Fallback] Scraping Instagram: @${handle}`)

      const run = await startActorRun(this.config.token, this.config.instagramActorId, {
        usernames: [handle],
        resultsLimit: 1,
      })

      const completedRun = await this.waitForRun(run.data.id)
      const items = await getDatasetItems(this.config.token, completedRun.defaultDatasetId)

      if (!items || items.length === 0) {
        return {
          content: '',
          emails: [],
          bioText: '',
          links: [],
          success: false,
          error: 'No data returned from Instagram scraper'
        }
      }

      const data = items[0]
      const content = [
        data.biography || '',
        data.bio || '',
        data.businessEmail || '',
        data.externalUrl || '',
      ].join('\n\n')

      const emails = this.extractEmails(content)
      if (data.businessEmail) {
        emails.unshift(data.businessEmail)
      }

      const links = []
      if (data.externalUrl) links.push(data.externalUrl)
      if (data.bioLinks) links.push(...data.bioLinks)

      console.log(`[Apify Fallback] Instagram scrape success: ${emails.length} emails found`)

      return {
        content,
        emails: Array.from(new Set(emails)),
        bioText: data.biography || data.bio || '',
        links,
        success: true
      }
    } catch (error: any) {
      console.error('[Apify Fallback] Instagram scrape error:', error.message)
      return {
        content: '',
        emails: [],
        bioText: '',
        links: [],
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Scrape website content including contact/booking pages
   */
  async scrapeWebsite(url: string): Promise<ApifyFallbackResult> {
    if (!this.config.websiteActorId) {
      return {
        content: '',
        emails: [],
        bioText: '',
        links: [],
        success: false,
        error: 'Website crawler actor not configured'
      }
    }

    try {
      console.log(`[Apify Fallback] Scraping website: ${url}`)

      // Parse base URL
      const baseUrl = new URL(url)
      const domain = `${baseUrl.protocol}//${baseUrl.host}`

      const run = await startActorRun(this.config.token, this.config.websiteActorId, {
        startUrls: [
          { url },
          { url: `${domain}/contact` },
          { url: `${domain}/booking` },
          { url: `${domain}/about` },
        ],
        maxCrawlDepth: 1,
        maxCrawlPages: 10,
      })

      const completedRun = await this.waitForRun(run.data.id)
      const items = await getDatasetItems(this.config.token, completedRun.defaultDatasetId)

      if (!items || items.length === 0) {
        return {
          content: '',
          emails: [],
          bioText: '',
          links: [],
          success: false,
          error: 'No data returned from website crawler'
        }
      }

      // Combine all page content
      const allContent = items.map((item: any) => item.text || item.content || '').join('\n\n')
      const allLinks = items.flatMap((item: any) => item.links || [])
      const emails = this.extractEmails(allContent)

      console.log(`[Apify Fallback] Website scrape success: ${emails.length} emails found from ${items.length} pages`)

      return {
        content: allContent,
        emails: Array.from(new Set(emails)),
        bioText: allContent.slice(0, 1000),
        links: Array.from(new Set(allLinks)),
        success: true
      }
    } catch (error: any) {
      console.error('[Apify Fallback] Website scrape error:', error.message)
      return {
        content: '',
        emails: [],
        bioText: '',
        links: [],
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Scrape Facebook page About section
   */
  async scrapeFacebook(pageUrl: string): Promise<ApifyFallbackResult> {
    if (!this.config.facebookActorId) {
      return {
        content: '',
        emails: [],
        bioText: '',
        links: [],
        success: false,
        error: 'Facebook actor not configured'
      }
    }

    try {
      console.log(`[Apify Fallback] Scraping Facebook: ${pageUrl}`)

      const run = await startActorRun(this.config.token, this.config.facebookActorId, {
        startUrls: [{ url: pageUrl + '/about' }],
        maxItems: 1,
      })

      const completedRun = await this.waitForRun(run.data.id)
      const items = await getDatasetItems(this.config.token, completedRun.defaultDatasetId)

      if (!items || items.length === 0) {
        return {
          content: '',
          emails: [],
          bioText: '',
          links: [],
          success: false,
          error: 'No data returned from Facebook scraper'
        }
      }

      const data = items[0]
      const content = [
        data.about || '',
        data.description || '',
        data.contactEmail || '',
        data.pageInfo || '',
      ].join('\n\n')

      const emails = this.extractEmails(content)
      if (data.contactEmail) {
        emails.unshift(data.contactEmail)
      }

      console.log(`[Apify Fallback] Facebook scrape success: ${emails.length} emails found`)

      return {
        content,
        emails: Array.from(new Set(emails)),
        bioText: data.about || data.description || '',
        links: data.links || [],
        success: true
      }
    } catch (error: any) {
      console.error('[Apify Fallback] Facebook scrape error:', error.message)
      return {
        content: '',
        emails: [],
        bioText: '',
        links: [],
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Scrape Linktree or similar link-in-bio pages
   */
  async scrapeLinktree(url: string): Promise<ApifyFallbackResult> {
    // Use website crawler for linktree pages
    return this.scrapeWebsite(url)
  }
}
