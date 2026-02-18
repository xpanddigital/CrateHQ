/**
 * Email Quality Filter
 *
 * Rejects low-quality emails (merch stores, privacy inboxes, corporate
 * catch-alls, placeholders) before marking an artist as contactable.
 *
 * Runs INSIDE the enrichment pipeline so that a rejected email in Step 3
 * doesn't prevent Steps 7-9 from finding a better one.
 *
 * Patterns sourced from real enrichment data — 17% of found emails were junk.
 */

// ---- EXACT MATCHES ----
const REJECTED_EXACT = [
  'user@domain.com',
  'email@email.com',
  'privacypolicy@wmg.com',
]

// ---- DOMAIN-LEVEL (reject ANY email @these domains) ----
const REJECTED_DOMAINS = [
  'wmg.com',
  'umgstores.com',
  'kontrabandstores.com',
  'sonymusic.com',
  'umusic.com',
  'universalmusic.com',
  'warnerrecords.com',
  'merchbar.com',
  'shopify.com',
  'bigcartel.com',
  'bandmerch.com',
  'example.com',
  'test.com',
  'domain.com',
  'email.com',
  'placeholder.com',
  'fake.com',
  'none.com',
]

// ---- PREFIX-LEVEL (reject emails starting with these) ----
const REJECTED_PREFIXES = [
  'privacypolicy@',
  'privacy@',
  'customerservice@',
  'customer.service@',
  'noreply@',
  'no-reply@',
  'no.reply@',
  'donotreply@',
  'do-not-reply@',
  'do.not.reply@',
  'mailer-daemon@',
  'postmaster@',
  'webmaster@',
  'abuse@',
  'dmca@',
  'legal@',
  'compliance@',
  'test@',
  'example@',
  'root@',
]

// ---- EXACT LOCAL PART MATCHES ----
const REJECTED_LOCAL_EXACT = [
  'sales',
  'billing',
  'accounts',
  'webmaster',
  'postmaster',
  'admin',
  'user',
  'test',
  'example',
  'root',
  'support',
  'noreply',
  'no-reply',
  'donotreply',
  'privacypolicy',
  'privacy',
  'customerservice',
  'info',
]

// ---- KEYWORD IN DOMAIN (reject if domain contains these) ----
const REJECTED_DOMAIN_KEYWORDS = [
  'merch',
  'store',
  'shop',
  'apparel',
  'fulfillment',
]

// ---- KEYWORD IN LOCAL PART (reject if local part contains these) ----
const REJECTED_LOCAL_KEYWORDS = [
  'merch',
  'store',
  'shop',
  'privacy',
  'unsubscribe',
]

// Domains where generic prefixes like info@, support@, admin@ are OK
// (artist's own domain — these are often legitimate)
// We only reject info@/support@/admin@ when combined with corporate/label domains
const CORPORATE_DOMAINS_FOR_PREFIX_CHECK = [
  'wmg.com', 'umusic.com', 'sonymusic.com', 'universalmusic.com',
  'warnerrecords.com', 'umgstores.com', 'kontrabandstores.com',
  'livenation.com', 'ticketmaster.com', 'bandsintown.com',
]

export interface EmailQualityResult {
  accepted: boolean
  reason: string | null
}

/**
 * Check if an email passes quality filters.
 * All comparisons are case-insensitive.
 */
export function checkEmailQuality(email: string): EmailQualityResult {
  if (!email || !email.includes('@')) {
    return { accepted: false, reason: 'Invalid email format' }
  }

  const lower = email.toLowerCase().trim()

  // Spaces in email = invalid
  if (lower.includes(' ')) {
    return { accepted: false, reason: 'Email contains spaces' }
  }

  const atIndex = lower.indexOf('@')
  const localPart = lower.slice(0, atIndex)
  const domain = lower.slice(atIndex + 1)

  if (!localPart || !domain || !domain.includes('.')) {
    return { accepted: false, reason: 'Invalid email format' }
  }

  // 1. Exact match
  if (REJECTED_EXACT.includes(lower)) {
    return { accepted: false, reason: 'Known junk email (exact match)' }
  }

  // 2. Domain-level rejection
  if (REJECTED_DOMAINS.includes(domain)) {
    return { accepted: false, reason: `Rejected domain: @${domain}` }
  }

  // 3. Prefix-level rejection
  for (const prefix of REJECTED_PREFIXES) {
    if (lower.startsWith(prefix)) {
      return { accepted: false, reason: `Rejected prefix: ${prefix}` }
    }
  }

  // 4. Exact local part match — but only reject info@/support@/admin@ on corporate domains
  const alwaysRejectLocals = REJECTED_LOCAL_EXACT.filter(l => !['info', 'support', 'admin'].includes(l))
  if (alwaysRejectLocals.includes(localPart)) {
    return { accepted: false, reason: `Rejected local part: ${localPart}@` }
  }

  // info@, support@, admin@ — only reject on corporate/label domains
  if (['info', 'support', 'admin'].includes(localPart)) {
    if (CORPORATE_DOMAINS_FOR_PREFIX_CHECK.includes(domain)) {
      return { accepted: false, reason: `${localPart}@ on corporate domain @${domain}` }
    }
  }

  // 5. Domain keyword check
  for (const keyword of REJECTED_DOMAIN_KEYWORDS) {
    if (domain.includes(keyword)) {
      return { accepted: false, reason: `Domain contains "${keyword}"` }
    }
  }

  // 6. Local part keyword check
  for (const keyword of REJECTED_LOCAL_KEYWORDS) {
    if (localPart.includes(keyword)) {
      return { accepted: false, reason: `Local part contains "${keyword}"` }
    }
  }

  return { accepted: true, reason: null }
}

/**
 * Filter an array of emails, returning only valid ones.
 * Also returns the rejected emails with reasons.
 */
export function filterEmails(emails: string[]): {
  valid: string[]
  rejected: Array<{ email: string; reason: string }>
} {
  const valid: string[] = []
  const rejected: Array<{ email: string; reason: string }> = []

  for (const email of emails) {
    const result = checkEmailQuality(email)
    if (result.accepted) {
      valid.push(email)
    } else {
      rejected.push({ email, reason: result.reason || 'Unknown' })
    }
  }

  return { valid, rejected }
}
