/**
 * Praecora blog — typed post registry.
 *
 * Source of truth for the listing page, sitemap, related-post links,
 * and internal cross-references. Each blog post route under
 * /src/app/(marketing)/blog/<slug>/page.tsx must have a matching
 * entry here.
 */

export type BlogPost = {
  slug: string
  /** Full, descriptive headline — used for the on-page H1 and listing. */
  title: string
  /**
   * Optional concise SERP title used for the HTML <title> only. Keep it
   * ≤49 chars so that, with the " | Praecora" template suffix appended
   * by the root layout, the rendered <title> stays ≤60 chars and avoids
   * SERP truncation. Falls back to `title` when omitted.
   */
  seoTitle?: string
  /** Meta description + OG description. Keep ≤155 chars (≤160 hard cap). */
  description: string
  /** ISO date — used for sitemap lastmod and visible publish date. */
  publishedAt: string
  /** ISO date if the post was substantively revised. */
  updatedAt?: string
  /** Visible byline + JSON-LD author. Single author for now. */
  author: {
    name: string
    role: string
  }
  /** Rounded reading time minutes, manually set for accuracy. */
  readingTime: number
  /** Funnel stage — drives CTA tuning later. */
  funnel: 'TOFU' | 'MOFU' | 'BOFU'
  /** Pillar bucket — used for "more from this pillar" surface. */
  pillar:
    | 'broker-playbook'
    | 'ig-outreach-without-bans'
    | 'closing-catalog-deals'
    | 'tools-and-comparisons'
  /** Tags for filtering + JSON-LD keywords. */
  tags: string[]
  /** Featured = surfaced at top of listing. */
  featured?: boolean
}

const JOEL: BlogPost['author'] = {
  name: 'Joel House',
  role: 'Founder, Praecora',
}

/**
 * Posts are listed newest-first by array position (display order on
 * /blog is driven by array order, not date). Publish dates are
 * staggered across the months before launch so the field guide reads
 * like a steady editorial cadence rather than a single bulk drop.
 */
export const POSTS: BlogPost[] = [
  {
    slug: 'artist-friendly-catalog-buyers',
    title:
      'The Rise of Artist-Friendly Catalog Buyers (And What It Means for Scouts)',
    seoTitle: 'Artist-Friendly Catalog Buyers in 2026',
    description:
      'A new class of catalog buyer competes on fairness and stewardship, not just cheque size. What the artist-friendly shift means for artists, scouts, and the deals in between.',
    publishedAt: '2026-06-19',
    author: JOEL,
    readingTime: 9,
    funnel: 'MOFU',
    pillar: 'closing-catalog-deals',
    tags: [
      'music catalog',
      'catalog buyers',
      'artist-friendly',
      'royalty advance',
      'deal sourcing',
    ],
    featured: true,
  },
  {
    slug: 'best-crm-for-music-catalog-scouts',
    title:
      'The Best CRM for Music Catalog Scouts and Brokers in 2026',
    seoTitle: 'Best CRM for Music Catalog Scouts (2026)',
    description:
      'Generic CRMs were built for B2B SaaS. Catalog scouting is a different sport — here\'s what actually matters in a tool for it, and why most software fails.',
    publishedAt: '2026-05-18',
    author: JOEL,
    readingTime: 11,
    funnel: 'BOFU',
    pillar: 'tools-and-comparisons',
    tags: ['CRM', 'music industry', 'catalog scouts', 'sales pipeline', 'tools'],
    featured: true,
  },
  {
    slug: 'run-multiple-instagram-accounts-without-bans',
    title:
      'How to Run 7 Instagram Accounts Without Getting Banned: The 2026 Playbook',
    seoTitle: 'Run 7 Instagram Accounts Without a Ban',
    description:
      'Most multi-account Instagram setups collapse within 90 days. The four structural fixes that keep an account fleet alive for 12+ months.',
    publishedAt: '2026-05-16',
    author: JOEL,
    readingTime: 14,
    funnel: 'MOFU',
    pillar: 'ig-outreach-without-bans',
    tags: [
      'Instagram',
      'account safety',
      'multi-account',
      'cloud phones',
      'ban prevention',
    ],
    featured: true,
  },
  {
    slug: 'music-catalog-financing-broker-playbook',
    title:
      'The Music Catalog Financing Broker Playbook: Sourcing Indie Deals for 10% Commission',
    seoTitle: 'Music Catalog Financing Broker Playbook',
    description:
      'The indie music industry has $200M+ chasing catalog deals — and barely a job description for who sources them. How the scout role works, and what it pays.',
    publishedAt: '2026-05-14',
    author: JOEL,
    readingTime: 18,
    funnel: 'TOFU',
    pillar: 'broker-playbook',
    tags: [
      'music catalog',
      'royalty advance',
      'A&R',
      'commission sales',
      'career',
    ],
    featured: true,
  },
  {
    slug: 'cold-dm-indie-artists-instagram',
    title:
      'How to Cold DM Indie Artists on Instagram: Templates, Reply Rates, and What Actually Works',
    seoTitle: 'How to Cold DM Indie Artists on Instagram',
    description:
      'Cold DM templates written for SMMA sales fail with indie artists. The opener lines, follow-up cadence, and messages that actually get replies.',
    publishedAt: '2026-05-12',
    author: JOEL,
    readingTime: 13,
    funnel: 'MOFU',
    pillar: 'closing-catalog-deals',
    tags: ['cold DM', 'Instagram', 'templates', 'indie artists', 'outreach'],
  },
  {
    slug: 'praecora-vs-manychat',
    title:
      'Praecora vs ManyChat: Why Music Scouts Need More Than a Chatbot',
    seoTitle: 'Praecora vs ManyChat for Music Scouts',
    description:
      'A ManyChat alternative for cold outbound: why comment-keyword chatbots can\'t source music catalog deals, and what a deal-flow platform does instead.',
    publishedAt: '2026-05-10',
    author: JOEL,
    readingTime: 9,
    funnel: 'BOFU',
    pillar: 'tools-and-comparisons',
    tags: ['ManyChat', 'comparison', 'Instagram automation', 'CRM'],
  },
  {
    slug: 'cloud-phones-for-instagram-geelark-bitbrowser-multilogin',
    title:
      'Cloud Phones for Instagram Outreach: GeeLark vs BitBrowser vs Multilogin (2026)',
    seoTitle: 'Cloud Phones for Instagram Outreach (2026)',
    description:
      'The best antidetect "browser" is now a cloud phone. How GeeLark, BitBrowser, and Multilogin compare for scouts running 5+ Instagram accounts in parallel.',
    publishedAt: '2026-05-08',
    author: JOEL,
    readingTime: 12,
    funnel: 'MOFU',
    pillar: 'ig-outreach-without-bans',
    tags: ['cloud phones', 'GeeLark', 'BitBrowser', 'Multilogin', 'antidetect'],
  },
  {
    slug: 'music-catalog-financing-explained',
    title:
      'Music Catalog Financing, Explained: How Indie Artists Get Funded and Who Sources the Deals',
    seoTitle: 'Music Catalog Financing, Explained',
    description:
      'Royalty advances, catalog buyouts, term advances — the products funding indie music in 2026, who provides them, and where scouts fit in the deal flow.',
    publishedAt: '2026-05-06',
    author: JOEL,
    readingTime: 15,
    funnel: 'TOFU',
    pillar: 'broker-playbook',
    tags: [
      'music catalog',
      'royalty advance',
      'catalog buyout',
      'music finance',
      'explainer',
    ],
  },
  {
    slug: 'music-catalog-buyer-directory-2026',
    title:
      'The Music Catalog Buyer Directory: Every Active Indie Buyer in 2026',
    seoTitle: 'Music Catalog Buyer Directory 2026',
    description:
      'beatBread, Xposure, Symphonic, RoyFi and more — 20+ active buyers placing capital into indie catalogs now, with deal sizes and advance multiples.',
    publishedAt: '2026-05-04',
    author: JOEL,
    readingTime: 16,
    funnel: 'TOFU',
    pillar: 'broker-playbook',
    tags: ['buyer directory', 'beatBread', 'Xposure', 'Symphonic', 'RoyFi'],
  },
  {
    slug: 'instagram-dm-limits-2026',
    title:
      'Instagram DM Limits in 2026: How Scouts Send 140 a Day Without a Ban',
    seoTitle: 'Instagram DM Limits in 2026',
    description:
      'The 200/hour API cap is the floor, not the ceiling. The real limit is what Instagram\'s spam model tolerates by account age — with the volume math.',
    publishedAt: '2026-05-02',
    author: JOEL,
    readingTime: 10,
    funnel: 'MOFU',
    pillar: 'ig-outreach-without-bans',
    tags: ['Instagram', 'DM limits', 'rate limits', 'account warm-up'],
  },
  {
    slug: 'praecora-vs-pipedrive',
    title:
      'Praecora vs Pipedrive: Why Generic CRMs Fail Music Industry Sales',
    seoTitle: 'Praecora vs Pipedrive for Music Sales',
    description:
      'A Pipedrive alternative for music sales: catalog scouting is mostly the conversations before a deal exists, which is where pipeline-first CRMs break.',
    publishedAt: '2026-04-30',
    author: JOEL,
    readingTime: 10,
    funnel: 'BOFU',
    pillar: 'tools-and-comparisons',
    tags: ['Pipedrive', 'comparison', 'CRM', 'music industry'],
  },
  // ───────────────── TIER 2 — additional field-guide articles ─────────────────
  {
    slug: 'cold-email-templates-music-industry-sales',
    title:
      'Cold Email Templates for Music Industry Sales (That Actually Get Replies)',
    seoTitle: 'Cold Email Templates for Music Sales',
    description:
      'Most cold email templates are built for B2B SaaS, and music managers and A&Rs delete them on sight. The structures that actually open doors in music.',
    publishedAt: '2026-05-25',
    author: JOEL,
    readingTime: 12,
    funnel: 'MOFU',
    pillar: 'closing-catalog-deals',
    tags: ['cold email', 'templates', 'music industry', 'outreach'],
  },
  {
    slug: 'antidetect-browsers-explained-cloud-phone-replacement',
    title:
      'Antidetect Browsers Explained (and Why Cloud Phones Replaced Them in 2024)',
    seoTitle: 'Antidetect Browsers, Explained (2024)',
    description:
      'Antidetect browsers used to be enough for multi-account Instagram, until Meta started weighting mobile signals. What they cover, what they don\'t.',
    publishedAt: '2026-06-01',
    author: JOEL,
    readingTime: 13,
    funnel: 'MOFU',
    pillar: 'ig-outreach-without-bans',
    tags: ['antidetect browser', 'cloud phones', 'multi-account', 'Instagram'],
  },
  {
    slug: 'facebook-business-portfolio-multi-account-instagram',
    title:
      'Setting Up a Facebook Business Portfolio for Multi-Account Instagram (Without Risking Your Real Facebook)',
    seoTitle: 'Facebook Business Portfolio for Instagram',
    description:
      'The Facebook Business Portfolio is the hidden layer behind multi-account Instagram. Set it up wrong and one ban cascades — here\'s the operator\'s setup.',
    publishedAt: '2026-06-08',
    author: JOEL,
    readingTime: 11,
    funnel: 'MOFU',
    pillar: 'ig-outreach-without-bans',
    tags: [
      'Facebook Business Portfolio',
      'multi-account',
      'Instagram',
      'account safety',
    ],
  },
  {
    slug: 'beatbread-review-2026-indie-catalog-deals',
    title:
      'beatBread Review 2026: How It Works for Indie Catalog Deals',
    seoTitle: 'beatBread Review 2026',
    description:
      'beatBread is the largest indie royalty-advance platform in 2026 — $100M+ across 1,700+ deals. An operator\'s review of how it works and who qualifies.',
    publishedAt: '2026-06-15',
    author: JOEL,
    readingTime: 12,
    funnel: 'TOFU',
    pillar: 'broker-playbook',
    tags: ['beatBread', 'royalty advance', 'review', 'indie music'],
  },
  {
    slug: 'chartmetric-for-music-catalog-scouts',
    title:
      'Chartmetric for Music Catalog Scouts: What to Look at Before Pitching',
    seoTitle: 'Chartmetric for Music Catalog Scouts',
    description:
      'Chartmetric is the data platform catalog buyers underwrite with. For scouts, it\'s the qualification engine — exactly what to look at, and what most miss.',
    publishedAt: '2026-04-28',
    author: JOEL,
    readingTime: 11,
    funnel: 'MOFU',
    pillar: 'closing-catalog-deals',
    tags: ['Chartmetric', 'qualification', 'streaming data', 'music industry'],
  },
  {
    slug: 'pipedrive-alternatives-for-outreach-teams',
    title:
      'Best Pipedrive Alternatives for Outreach-First Sales Teams (2026)',
    seoTitle: 'Best Pipedrive Alternatives (2026)',
    description:
      'Pipedrive is built for deals you have. For outreach-heavy teams working mostly cold, its pipeline-first design fights the work — the alternatives that fit.',
    publishedAt: '2026-04-25',
    author: JOEL,
    readingTime: 10,
    funnel: 'BOFU',
    pillar: 'tools-and-comparisons',
    tags: ['Pipedrive', 'alternatives', 'CRM', 'sales outreach'],
  },
  {
    slug: 'instagram-dm-bots-why-cold-outbound-avoids-them',
    title:
      'Instagram DM Bots: Why Cold-Outbound Operators Avoid Them',
    seoTitle: 'Instagram DM Bots vs Cold Outbound',
    description:
      'Instagram DM bots shine at warm-trigger marketing: story replies, comment keywords, ad clicks. Why they\'re wrong for cold outbound — and what operators use.',
    publishedAt: '2026-04-21',
    author: JOEL,
    readingTime: 10,
    funnel: 'BOFU',
    pillar: 'tools-and-comparisons',
    tags: ['Instagram DM bot', 'automation', 'cold outbound', 'comparison'],
  },
  {
    slug: 'email-warm-up-explained-sender-domains',
    title:
      'Email Warm-Up Explained: Why New Sender Domains Need It (and How Long It Actually Takes)',
    seoTitle: 'Email Warm-Up Explained',
    description:
      'Cold email deliverability lives or dies on sender reputation. What domain warm-up actually does, how long it takes, and what most warm-up tools get wrong.',
    publishedAt: '2026-04-18',
    author: JOEL,
    readingTime: 11,
    funnel: 'MOFU',
    pillar: 'ig-outreach-without-bans',
    tags: [
      'email warm-up',
      'cold email',
      'deliverability',
      'sender reputation',
    ],
  },
  {
    slug: 'how-to-become-ar-scout-independent-path',
    title:
      'How to Become an A&R Scout in 2026 (The Independent Path, Not the Label Path)',
    seoTitle: 'How to Become an A&R Scout in 2026',
    description:
      'Most A&R guides assume a major label. There\'s a parallel path few write about: the independent commission-based catalog scout. How it works in 2026.',
    publishedAt: '2026-04-14',
    author: JOEL,
    readingTime: 14,
    funnel: 'TOFU',
    pillar: 'broker-playbook',
    tags: ['A&R scout', 'music career', 'independent', 'commission sales'],
  },
  {
    slug: 'music-catalog-valuation-multiples-2026',
    title:
      'Music Catalog Valuation Multiples: 2026 Indie Deal Math',
    seoTitle: 'Music Catalog Valuation Multiples (2026)',
    description:
      'How does $24K/year in streaming become a $288K advance — or $144K for the same income? The valuation-multiple math behind indie catalog deals.',
    publishedAt: '2026-04-11',
    author: JOEL,
    readingTime: 13,
    funnel: 'TOFU',
    pillar: 'broker-playbook',
    tags: ['valuation', 'multiples', 'catalog finance', 'royalty math'],
  },
  {
    slug: 'instagram-automation-tools-2026',
    title:
      'Instagram Automation Tools 2026: The Operator\'s Map',
    seoTitle: 'Instagram Automation Tools 2026',
    description:
      '20+ Instagram automation tools exist for different jobs — scheduling, chatbots, scraping, cold outbound. The working map by job, and where Praecora fits.',
    publishedAt: '2026-04-07',
    author: JOEL,
    readingTime: 12,
    funnel: 'BOFU',
    pillar: 'tools-and-comparisons',
    tags: [
      'Instagram automation',
      'tools',
      'categories',
      'comparison',
    ],
  },
  {
    slug: 'sales-crm-small-business-niche-fit',
    title:
      'Sales CRM for Small Business: When Generic Tools Stop Fitting',
    seoTitle: 'Sales CRM for Small Business',
    description:
      'HubSpot, Pipedrive, Zoho and Salesforce dominate every "best small-business CRM" list — and are wrong-shaped for some businesses. How to tell which you are.',
    publishedAt: '2026-04-04',
    author: JOEL,
    readingTime: 11,
    funnel: 'BOFU',
    pillar: 'tools-and-comparisons',
    tags: ['sales CRM', 'small business', 'niche industries', 'comparison'],
  },
  {
    slug: 'music-promotion-platforms-vs-outreach-tools',
    title:
      'Music Promotion Platforms vs Outreach Tools: A 2026 Map for Indie Operators',
    seoTitle: 'Music Promotion Platforms vs Outreach',
    description:
      'Music promotion platforms (SubmitHub, Groover) and sales outreach tools (Praecora, Instantly) get conflated constantly. They do different jobs — the map.',
    publishedAt: '2026-03-31',
    author: JOEL,
    readingTime: 11,
    funnel: 'BOFU',
    pillar: 'tools-and-comparisons',
    tags: [
      'music promotion',
      'marketing platforms',
      'outreach tools',
      'comparison',
    ],
  },
  {
    slug: 'smartlead-instantly-lemlist-compared-music-industry',
    title:
      'Smartlead vs Instantly vs Lemlist: Honest Comparison for Music Industry Outreach',
    seoTitle: 'Smartlead vs Instantly vs Lemlist',
    description:
      'Smartlead, Instantly, and Lemlist are the serious cold-email tools in 2026. None were built for music outreach, and the differences matter. The comparison.',
    publishedAt: '2026-03-28',
    author: JOEL,
    readingTime: 13,
    funnel: 'BOFU',
    pillar: 'tools-and-comparisons',
    tags: ['Smartlead', 'Instantly', 'Lemlist', 'cold email', 'comparison'],
  },
  {
    slug: 'independent-music-distribution-vs-catalog-buyers',
    title:
      'Independent Music Distribution Companies vs Catalog Buyers: What\'s the Difference?',
    seoTitle: 'Music Distribution vs Catalog Buyers',
    description:
      'TuneCore and DistroKid are distributors; beatBread and Symphonic are catalog buyers. The two overlap confusingly — and the wrong pick costs artists.',
    publishedAt: '2026-03-24',
    author: JOEL,
    readingTime: 12,
    funnel: 'TOFU',
    pillar: 'broker-playbook',
    tags: [
      'music distribution',
      'catalog buyers',
      'TuneCore',
      'DistroKid',
      'comparison',
    ],
  },
  {
    slug: 'instagram-account-warm-up-7-day-checklist',
    title:
      'Instagram Account Warm-Up: The 7-Day Checklist for New Outreach Accounts',
    seoTitle: 'Instagram Account Warm-Up: 7-Day Plan',
    description:
      'Brand-new Instagram Business accounts that DM immediately get banned within hours. The day-by-day warm-up sequence we run on every new account in our fleet.',
    publishedAt: '2026-03-21',
    author: JOEL,
    readingTime: 9,
    funnel: 'MOFU',
    pillar: 'ig-outreach-without-bans',
    tags: ['Instagram warm-up', 'account safety', 'new account', 'checklist'],
  },
  {
    slug: 'royalty-advance-vs-catalog-sale-indie-artists',
    title:
      'Royalty Advance vs Catalog Sale: Which Should Indie Artists Pick?',
    seoTitle: 'Royalty Advance vs Catalog Sale',
    description:
      'A royalty advance and a catalog sale look alike to artists who\'ve done neither, but they\'re structurally different. When each one is the right call.',
    publishedAt: '2026-03-17',
    author: JOEL,
    readingTime: 12,
    funnel: 'TOFU',
    pillar: 'broker-playbook',
    tags: [
      'royalty advance',
      'catalog sale',
      'comparison',
      'indie artists',
    ],
  },
  {
    slug: 'va-workflow-music-catalog-outreach',
    title:
      'The VA Workflow for Music Catalog Outreach: Hiring, Training, and Daily Operations',
    seoTitle: 'The VA Workflow for Catalog Outreach',
    description:
      'A serious scouting operation needs a VA — Instagram\'s manual cold-opener rule makes it non-negotiable past ~50 DMs/day. How to hire, train, and run one.',
    publishedAt: '2026-03-14',
    author: JOEL,
    readingTime: 13,
    funnel: 'MOFU',
    pillar: 'closing-catalog-deals',
    tags: ['virtual assistant', 'operations', 'hiring', 'music outreach'],
  },
  {
    slug: 'instagram-business-vs-creator-account-outreach',
    title:
      'Instagram Business vs Creator Account for Outreach: Which Should Scouts Use?',
    seoTitle: 'Instagram Business vs Creator Account',
    description:
      'Instagram has three account types: Personal, Creator, Business. Cold outreach needs capabilities only some support — what each permits, and which to use.',
    publishedAt: '2026-03-10',
    author: JOEL,
    readingTime: 9,
    funnel: 'MOFU',
    pillar: 'ig-outreach-without-bans',
    tags: ['Instagram business', 'Instagram creator', 'account type', 'API'],
  },
  {
    slug: 'spotify-for-artists-data-catalog-buyers',
    title:
      'Spotify for Artists Data: What Catalog Buyers Look at Before Underwriting',
    seoTitle: 'Spotify for Artists Data for Buyers',
    description:
      'When a buyer underwrites a catalog deal, the first data they want is Spotify for Artists. Which fields matter, what they calculate, and how to pre-qualify.',
    publishedAt: '2026-03-07',
    author: JOEL,
    readingTime: 11,
    funnel: 'MOFU',
    pillar: 'closing-catalog-deals',
    tags: [
      'Spotify for Artists',
      'streaming data',
      'underwriting',
      'qualification',
    ],
  },
]

export const POSTS_BY_SLUG: Record<string, BlogPost> = Object.fromEntries(
  POSTS.map((p) => [p.slug, p]),
)

export function getPostBySlug(slug: string): BlogPost | undefined {
  return POSTS_BY_SLUG[slug]
}

/**
 * Is the post visible to the public yet? Used to gate future-scheduled
 * posts from the listing, related-posts surface, and direct slug routes.
 *
 * Compares UTC dates so the visibility flip happens at 00:00 UTC on
 * publish day — predictable across deployment regions.
 */
export function isPublished(
  post: BlogPost,
  asOf: Date = new Date(),
): boolean {
  return new Date(post.publishedAt + 'T00:00:00Z') <= asOf
}

/**
 * The subset of POSTS that should be visible publicly right now.
 * Always order newest-published-first. Future-scheduled posts are
 * excluded — they flip to visible automatically on their `publishedAt`
 * once ISR revalidates (pages have `revalidate = 3600`).
 */
export function getVisiblePosts(asOf: Date = new Date()): BlogPost[] {
  return POSTS.filter((p) => isPublished(p, asOf))
}

export function getRelatedPosts(
  currentSlug: string,
  limit: number = 3,
  asOf: Date = new Date(),
): BlogPost[] {
  const current = POSTS_BY_SLUG[currentSlug]
  const visible = getVisiblePosts(asOf)
  if (!current) return visible.slice(0, limit)
  // Same-pillar first, then anything else, never include self,
  // and never include posts that aren't published yet.
  const samePillar = visible.filter(
    (p) => p.slug !== currentSlug && p.pillar === current.pillar,
  )
  const others = visible.filter(
    (p) => p.slug !== currentSlug && p.pillar !== current.pillar,
  )
  return [...samePillar, ...others].slice(0, limit)
}

export const PILLAR_LABELS: Record<BlogPost['pillar'], string> = {
  'broker-playbook': 'The Broker Playbook',
  'ig-outreach-without-bans': 'Outreach Without Bans',
  'closing-catalog-deals': 'Closing Catalog Deals',
  'tools-and-comparisons': 'Tools & Comparisons',
}
