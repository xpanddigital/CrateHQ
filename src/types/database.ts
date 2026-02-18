export interface Profile {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'scout'
  avatar_url: string | null
  phone: string | null
  calendly_link: string | null
  commission_rate: number
  ai_sdr_persona: string
  ai_sdr_auto_send: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Tag {
  id: string
  name: string
  color: string
  description: string | null
  created_by: string | null
  created_at: string
}

export interface Artist {
  id: string
  name: string
  spotify_url: string | null
  spotify_id: string | null
  spotify_followers: number
  spotify_verified: boolean
  country: string | null
  biography: string | null
  bio_emails: Array<{ email: string; type: string; context: string }> | null
  genres: string[]
  image_url: string | null
  cover_art_url: string | null
  spotify_monthly_listeners: number
  streams_last_month: number
  streams_daily: number
  total_top_track_streams: number
  track_count: number
  growth_mom: number
  growth_qoq: number
  growth_yoy: number
  growth_status: string | null
  artist_level: string | null
  world_rank: number
  instagram_handle: string | null
  instagram_followers: number
  tiktok_handle: string | null
  tiktok_url: string | null
  twitter_handle: string | null
  wikipedia_url: string | null
  website: string | null
  social_links: Record<string, string>
  email: string | null
  email_secondary: string | null
  email_management: string | null
  email_source: string | null
  email_confidence: number
  all_emails_found: Array<{ email: string; source: string; confidence: number }>
  estimated_offer: number | null
  estimated_offer_low: number | null
  estimated_offer_high: number | null
  is_enriched: boolean
  is_contactable: boolean
  enrichment_attempts: number
  last_enriched_at: string | null
  latest_release_date: string | null
  latest_release_name: string | null
  top_cities: Array<{ city: string; country: string; listeners: number }> | null
  qualification_status: 'qualified' | 'not_qualified' | 'review' | 'pending'
  qualification_reason: string | null
  qualification_date: string | null
  qualification_manual_override: boolean
  email_rejected: boolean
  email_rejection_reason: string | null
  import_format: string | null
  source: string
  source_batch: string | null
  created_at: string
  updated_at: string
  tags?: Tag[]
}

export interface Deal {
  id: string
  artist_id: string
  scout_id: string
  stage: DealStage
  stage_changed_at: string
  outreach_channel: string
  emails_sent: number
  emails_opened: number
  last_outreach_at: string | null
  last_reply_at: string | null
  next_followup_at: string | null
  instantly_campaign_id: string | null
  estimated_deal_value: number | null
  actual_deal_value: number | null
  commission_amount: number | null
  notes: string | null
  created_at: string
  updated_at: string
  artist?: Artist
  scout?: Profile
  conversations?: Conversation[]
}

export type DealStage =
  | 'new' | 'enriched' | 'outreach_queued' | 'contacted' | 'replied'
  | 'interested' | 'call_scheduled' | 'call_completed' | 'qualified'
  | 'handed_off' | 'in_negotiation' | 'contract_sent'
  | 'closed_won' | 'closed_lost' | 'nurture'

export const DEAL_STAGES: { value: DealStage; label: string; color: string }[] = [
  { value: 'new', label: 'New', color: '#6B7280' },
  { value: 'enriched', label: 'Enriched', color: '#8B5CF6' },
  { value: 'outreach_queued', label: 'Queued', color: '#3B82F6' },
  { value: 'contacted', label: 'Contacted', color: '#2563EB' },
  { value: 'replied', label: 'Replied', color: '#F59E0B' },
  { value: 'interested', label: 'Interested', color: '#D97706' },
  { value: 'call_scheduled', label: 'Call Scheduled', color: '#10B981' },
  { value: 'call_completed', label: 'Call Done', color: '#059669' },
  { value: 'qualified', label: 'Qualified', color: '#047857' },
  { value: 'handed_off', label: 'Handed Off', color: '#6366F1' },
  { value: 'in_negotiation', label: 'Negotiation', color: '#4F46E5' },
  { value: 'contract_sent', label: 'Contract Sent', color: '#7C3AED' },
  { value: 'closed_won', label: 'Won', color: '#22C55E' },
  { value: 'closed_lost', label: 'Lost', color: '#EF4444' },
  { value: 'nurture', label: 'Nurture', color: '#64748B' },
]

export interface Conversation {
  id: string
  deal_id: string
  artist_id: string
  scout_id: string | null
  channel: 'email' | 'instagram' | 'phone' | 'note' | 'system'
  direction: 'outbound' | 'inbound' | 'internal'
  subject: string | null
  body: string
  ai_classification: string | null
  ai_confidence: number | null
  ai_suggested_reply: string | null
  is_read: boolean
  requires_human_review: boolean
  sent_at: string
  created_at: string
}

export interface EmailTemplate {
  id: string
  name: string
  category: string
  sequence_position: number | null
  subject: string
  body: string
  times_sent: number
  times_replied: number
  is_active: boolean
  created_by: string | null
  created_at: string
}

export interface Integration {
  id: string
  user_id: string
  service: string
  api_key: string | null
  config: Record<string, any>
  is_active: boolean
  created_at: string
}

export interface OutreachLog {
  id: string
  scout_id: string
  campaign_id: string
  campaign_name: string
  leads_pushed: number
  leads_added: number
  leads_skipped: number
  deals_created: number
  artist_ids: string[]
  created_at: string
  scout?: Profile
}
