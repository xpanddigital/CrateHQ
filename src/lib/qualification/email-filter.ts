/**
 * Email Quality Filter
 *
 * Post-enrichment check that rejects low-quality emails (merch stores,
 * privacy addresses, corporate catch-alls) before marking an artist
 * as contactable.
 */

const REJECTED_LOCAL_PARTS = [
  'privacypolicy', 'privacy', 'customerservice', 'noreply', 'no-reply',
  'donotreply', 'do-not-reply', 'mailer-daemon', 'postmaster',
  'webmaster', 'abuse', 'dmca', 'legal', 'compliance',
  'user', 'test', 'example', 'admin', 'root',
]

const REJECTED_LOCAL_CONTAINS = [
  'merch', 'store', 'shop', 'privacy', 'unsubscribe',
]

const REJECTED_DOMAINS = [
  'wmg.com',
  'umgstores.com',
  'kontrabandstores.com',
  'warnerrecords.com',
  'sonymusic.com',
  'universalmusic.com',
  'merchbar.com',
  'shopify.com',
  'bigcartel.com',
  'bandmerch.com',
]

const REJECTED_DOMAIN_CONTAINS = [
  'merch', 'store', 'shop',
]

export interface EmailQualityResult {
  accepted: boolean
  reason: string | null
}

/**
 * Check if an email passes quality filters.
 * Returns { accepted: true } if the email is good,
 * or { accepted: false, reason: "..." } if it should be rejected.
 */
export function checkEmailQuality(email: string): EmailQualityResult {
  if (!email || !email.includes('@')) {
    return { accepted: false, reason: 'Invalid email format' }
  }

  const lower = email.toLowerCase().trim()
  const [localPart, domain] = lower.split('@')

  if (!localPart || !domain) {
    return { accepted: false, reason: 'Invalid email format' }
  }

  // Check rejected local parts (exact match)
  if (REJECTED_LOCAL_PARTS.includes(localPart)) {
    return { accepted: false, reason: `Rejected local part: ${localPart}@` }
  }

  // Check rejected local part substrings
  for (const pattern of REJECTED_LOCAL_CONTAINS) {
    if (localPart.includes(pattern)) {
      return { accepted: false, reason: `Email contains "${pattern}" — likely not a person` }
    }
  }

  // Check rejected domains (exact match)
  if (REJECTED_DOMAINS.includes(domain)) {
    return { accepted: false, reason: `Rejected domain: ${domain} (corporate/merch)` }
  }

  // Check rejected domain substrings
  for (const pattern of REJECTED_DOMAIN_CONTAINS) {
    if (domain.includes(pattern)) {
      return { accepted: false, reason: `Domain contains "${pattern}" — likely merch/store` }
    }
  }

  // Placeholder emails
  if (lower === 'user@domain.com' || lower === 'email@email.com') {
    return { accepted: false, reason: 'Placeholder email' }
  }

  return { accepted: true, reason: null }
}
