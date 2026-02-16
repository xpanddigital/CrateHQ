/**
 * Instantly.ai API Client
 * 
 * Drop this file into src/lib/instantly/client.ts
 * 
 * Handles: campaign listing, campaign creation, lead pushing,
 * campaign analytics, and lead status checking.
 * 
 * API docs: https://developer.instantly.ai/
 */

const BASE_URL = 'https://api.instantly.ai/api/v1'

export interface InstantlyLead {
  email: string
  first_name: string
  last_name: string
  company_name: string
  variables?: Record<string, string>
}

export interface InstantlyCampaign {
  id: string
  name: string
  status: string
  created_at?: string
}

export interface CampaignSummary {
  campaign_id: string
  total_leads: number
  contacted: number
  emails_sent: number
  opens: number
  replies: number
  bounces: number
}

export class InstantlyClient {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  /**
   * Test the API connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const campaigns = await this.listCampaigns()
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  /**
   * List all campaigns
   */
  async listCampaigns(): Promise<InstantlyCampaign[]> {
    const res = await fetch(`${BASE_URL}/campaign/list?api_key=${this.apiKey}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!res.ok) {
      throw new Error(`Instantly API error: ${res.status} ${res.statusText}`)
    }

    return res.json()
  }

  /**
   * Create a new campaign
   */
  async createCampaign(name: string): Promise<{ id: string; name: string }> {
    const res = await fetch(`${BASE_URL}/campaign/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: this.apiKey,
        name,
      }),
    })

    if (!res.ok) {
      const error = await res.text()
      throw new Error(`Failed to create campaign: ${error}`)
    }

    return res.json()
  }

  /**
   * Add leads to a campaign.
   * Instantly accepts up to 1000 leads per request.
   * This function auto-batches larger arrays.
   */
  async addLeads(campaignId: string, leads: InstantlyLead[]): Promise<{ added: number; skipped: number }> {
    const BATCH_SIZE = 500
    let totalAdded = 0
    let totalSkipped = 0

    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const batch = leads.slice(i, i + BATCH_SIZE)

      const formattedLeads = batch.map(lead => ({
        email: lead.email,
        first_name: lead.first_name,
        last_name: lead.last_name,
        company_name: lead.company_name,
        ...Object.fromEntries(
          Object.entries(lead.variables || {}).map(([k, v]) => [`custom_${k}`, v])
        ),
      }))

      const res = await fetch(`${BASE_URL}/lead/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: this.apiKey,
          campaign_id: campaignId,
          skip_if_in_workspace: true,
          leads: formattedLeads,
        }),
      })

      if (!res.ok) {
        const error = await res.text()
        throw new Error(`Failed to add leads (batch ${Math.floor(i / BATCH_SIZE) + 1}): ${error}`)
      }

      const result = await res.json()
      totalAdded += result?.leads_added || batch.length
      totalSkipped += result?.leads_skipped || 0

      // Rate limit: wait 500ms between batches
      if (i + BATCH_SIZE < leads.length) {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    return { added: totalAdded, skipped: totalSkipped }
  }

  /**
   * Get campaign summary analytics
   */
  async getCampaignSummary(campaignId: string): Promise<CampaignSummary> {
    const res = await fetch(
      `${BASE_URL}/analytics/campaign/summary?api_key=${this.apiKey}&id=${campaignId}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    )

    if (!res.ok) {
      throw new Error(`Failed to get campaign summary: ${res.status}`)
    }

    return res.json()
  }

  /**
   * Get campaign status (active, paused, completed, etc.)
   */
  async getCampaignStatus(campaignId: string): Promise<string> {
    const res = await fetch(
      `${BASE_URL}/campaign/get/status?api_key=${this.apiKey}&id=${campaignId}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    )

    if (!res.ok) {
      throw new Error(`Failed to get campaign status: ${res.status}`)
    }

    const data = await res.json()
    return data?.status || 'unknown'
  }
}

/**
 * Helper: Transform an artist into an Instantly lead
 */
export function artistToInstantlyLead(
  artist: { name: string; email: string; streams_last_month?: number; track_count?: number; genres?: string[]; estimated_offer_low?: number; estimated_offer_high?: number },
  scoutProfile: { full_name?: string; calendly_link?: string }
): InstantlyLead | null {
  if (!artist.email) return null

  const nameParts = artist.name.split(' ')
  const firstName = nameParts[0] || ''
  const lastName = nameParts.slice(1).join(' ') || ''

  const formatK = (n: number) => n >= 1000 ? `${Math.round(n / 1000)}K` : `${n}`

  return {
    email: artist.email,
    first_name: firstName,
    last_name: lastName,
    company_name: artist.name,
    variables: {
      artist_name: artist.name,
      monthly_streams: (artist.streams_last_month || 0).toLocaleString(),
      track_count: String(artist.track_count || ''),
      genres: (artist.genres || []).join(', '),
      estimated_value_low: artist.estimated_offer_low ? `$${formatK(artist.estimated_offer_low)}` : '',
      estimated_value_high: artist.estimated_offer_high ? `$${formatK(artist.estimated_offer_high)}` : '',
      sender_name: scoutProfile.full_name || '',
      booking_link: scoutProfile.calendly_link || '',
    },
  }
}
