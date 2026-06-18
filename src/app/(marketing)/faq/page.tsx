import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Eyebrow } from '@/components/marketing/Ornament'

// /faq is the biggest single SEO win on the site because of FAQPage
// schema. Google often surfaces FAQ-marked-up pages as expandable
// Q&A boxes directly in search results — capturing high-intent
// research traffic ("how does Praecora work", "what does Praecora do",
// "is Praecora against Meta's ToS", "Praecora pricing", etc.) without
// the user having to click through.
export const metadata: Metadata = {
  // " | Praecora" is appended by the root layout template.
  title: 'Praecora FAQ — Music Industry CRM',
  description:
    'Common questions about Praecora — what it does, pricing, account safety, Meta\'s ToS, results to expect, and how the platform actually runs day to day.',
  alternates: { canonical: 'https://www.praecora.com/faq' },
  openGraph: {
    title: 'Praecora FAQ — Music Industry CRM Questions Answered',
    description:
      'Common questions about Praecora — what it does, pricing, account safety, results to expect, and how it runs day to day.',
    url: 'https://www.praecora.com/faq',
    type: 'website',
    siteName: 'Praecora',
    images: ['https://www.praecora.com/opengraph-image'],
  },
}

const FAQ_GROUPS = [
  {
    title: 'The basics',
    image: '/images/faq/faq-1-basics.jpg',
    items: [
      {
        q: 'What does Praecora actually do?',
        a: 'Praecora is your herald — the platform that carries personalized outreach to every artist worth knowing on your behalf. AI drafts cold openers based on each artist\'s bio, recent posts, and Spotify catalog. We handle delivery across Instagram and email. Replies route into your Praecora inbox, AI-classified and ready for your one-click response. You stay focused on the only thing that compounds: closing.',
      },
      {
        q: 'Why both Instagram and email?',
        a: 'Indie artists live on Instagram. Their managers and labels live in email. Running both in parallel hits the full decision-making graph for each catalog opportunity. Single-channel outreach leaves money on the table.',
      },
      {
        q: 'Who is this for?',
        a: 'Independent, commission-based sales scouts in the music catalog financing industry. You already know how to qualify catalogs and close deals. You don\'t want to spend your nights sending DMs and your weekends writing emails.',
      },
      {
        q: 'Who is this NOT for?',
        a: 'People starting from scratch with no industry relationships. Mass-scale spammers. Scouts targeting artists for anything other than catalog financing. We focus on one niche on purpose.',
      },
    ],
  },
  {
    title: 'Pricing & billing',
    image: '/images/faq/faq-2-pricing.jpg',
    items: [
      {
        q: 'Why is there an onboarding fee?',
        a: 'The first 4 weeks are real work — provisioning your dedicated Instagram presence, setting up email sender domains, configuring your AI voice, preparing your accounts for safe operation, and seeding initial content. The onboarding fee covers that work and keeps both sides committed.',
      },
      {
        q: 'When does the monthly subscription start?',
        a: 'The day your outreach goes live — typically ~4 weeks after onboarding payment. You\'ll get an email confirmation when billing begins, and your card is charged from that date forward. You\'re never paying for service you haven\'t received.',
      },
      {
        q: 'Can I cancel anytime?',
        a: 'Yes. Month-to-month, no long-term contracts. Cancel any time and we hand off the assets we\'ve built for you (your AI voice config, contact data, conversation history).',
      },
      {
        q: 'Can I upgrade or downgrade tiers?',
        a: 'Yes. Upgrading is instant. Downgrading takes effect at your next renewal so you don\'t lose paid-for capacity.',
      },
      {
        q: 'Do you offer refunds?',
        a: 'Onboarding fees are non-refundable since they cover real labor delivered. Monthly subscription is month-to-month — cancel any time. We\'d rather lose a customer than fight over a refund.',
      },
    ],
  },
  {
    title: 'Account safety',
    image: '/images/faq/faq-3-safety.jpg',
    items: [
      {
        q: 'What happens when an Instagram account gets banned?',
        a: 'Account safety is the foundation of our setup process. We invest 4 weeks of preparation per account so they last 12+ months. When bans do happen, they\'re isolated to a single account — your other personas keep running. Replacement accounts are included in your subscription.',
      },
      {
        q: 'How does email deliverability work?',
        a: 'We provision dedicated sending domains, run them through proper warm-up sequences before sending real volume, and monitor reputation continuously. We use proven infrastructure that respects platform standards. No platform on earth guarantees the inbox — but we optimize aggressively.',
      },
      {
        q: 'Is this against Meta\'s ToS?',
        a: 'Catalog scouting via Instagram operates in the same space as every modern outreach service. We design for compliance with platform spirit and longevity over volume. Bans are rare and isolated when they happen.',
      },
    ],
  },
  {
    title: 'Volume & results',
    image: '/images/faq/faq-4-volume.jpg',
    items: [
      {
        q: 'How much outreach goes out per day?',
        a: 'Depends on your tier. Starter: 20 IG DMs + 100 emails/day. Growth: 60 + 250. Pro: 100 + 400. Whale: 140 + 600. We scale safely within platform limits.',
      },
      {
        q: 'What reply rate should I expect?',
        a: 'Industry typical for well-targeted music outreach is 5-15% reply rate on IG and 2-8% on cold email. Of those replies, ~20-25% are actually interested conversations. Your specific numbers depend on your qualification, follow-up speed, and offer quality.',
      },
      {
        q: 'How fast can I expect deals?',
        a: 'Most scouts close their first deal within 60-90 days of going live. Pipeline builds gradually as you accumulate ongoing conversations across both channels.',
      },
      {
        q: 'How fast can I start?',
        a: '~4 weeks from signup to first cold outreach. Account preparation takes time — skipping it is exactly why most outreach services blow up. We\'d rather lose the impatient customer than ship a fragile setup.',
      },
    ],
  },
  {
    title: 'Platform & tech',
    image: '/images/faq/faq-5-platform.jpg',
    items: [
      {
        q: 'Do I have to manage anything?',
        a: 'You manage replies (~30 min/day in Praecora inbox) and your own deal pipeline. Everything else — outreach, account safety, content, infrastructure — we handle.',
      },
      {
        q: 'Can I see the platform before I sign up?',
        a: 'Yes. Book a demo. We\'ll walk through a live (anonymized) scout\'s inbox so you can see what your day-to-day looks like.',
      },
      {
        q: 'Do you integrate with my existing CRM?',
        a: 'Praecora is the CRM — built specifically for music catalog scouts. If you have a separate workflow tool you depend on, talk to us about it on the demo call.',
      },
      {
        q: 'Who actually owns the accounts and data?',
        a: 'You do. We hand off all assets if you cancel — AI voice config, content, contact database, conversation history.',
      },
    ],
  },
]

/**
 * FAQPage schema generated from FAQ_GROUPS above. Every Q&A becomes a
 * Question with an Answer; Google can then render expandable Q&A boxes
 * directly in search results for question-format queries.
 *
 * The Answer text is plain-text (no HTML) — Google strips HTML from
 * schema markup anyway, and our Q&As above are already plain prose.
 */
function FAQJsonLd() {
  const allItems = FAQ_GROUPS.flatMap((group) => group.items)
  const json = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: allItems.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  )
}

export default function FAQPage() {
  return (
    <>
      <FAQJsonLd />
      <section className="marketing-hero-bg px-4 pt-24 pb-16 md:px-6 md:pt-32 md:pb-20">
        <div className="mx-auto w-full max-w-3xl text-center">
          <div className="mb-8 flex justify-center">
            <Eyebrow>FAQ</Eyebrow>
          </div>
          <h1 className="text-balance text-5xl font-bold leading-[1.05] tracking-tight text-[#0f0d08] md:text-7xl">
            Questions, answered.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600">
            The honest answers to what scouts ask us most. If your question isn't here,
            book a demo and we'll talk through it.
          </p>
        </div>
      </section>

      <section className="border-t border-black/5 bg-white px-4 py-16 md:px-6 md:py-24">
        <div className="mx-auto w-full max-w-3xl space-y-24">
          {FAQ_GROUPS.map((group) => (
            <div key={group.title}>
              {/* Category vignette — editorial banner */}
              <div className="relative overflow-hidden rounded-2xl border border-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.04),_0_16px_32px_-12px_rgba(184,83,29,0.08)]">
                <img
                  src={group.image}
                  alt={`Illustration for the “${group.title}” section of the Praecora FAQ`}
                  className="aspect-[16/6] w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/15 to-transparent" />
                <div className="absolute bottom-6 left-6 md:bottom-8 md:left-8">
                  <div className="mb-3 h-px w-12 bg-[#e8ff47]" />
                  <h2 className="text-balance text-3xl font-bold tracking-tight text-white md:text-4xl">
                    {group.title}
                  </h2>
                </div>
              </div>

              <div className="mt-10 space-y-8">
                {group.items.map((item) => (
                  <div key={item.q} className="border-l-2 border-rust pl-6">
                    <p className="text-lg font-semibold text-[#0f0d08]">{item.q}</p>
                    <p className="mt-3 text-base leading-relaxed text-neutral-600">
                      {item.a}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-black/5 px-4 py-24 md:px-6">
        <div className="mx-auto w-full max-w-3xl text-center">
          <h2 className="text-balance text-4xl font-bold tracking-tight text-neutral-950 md:text-5xl">
            Still have questions?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-neutral-600">
            Book a 20-minute call. We'll walk through everything specific to your operation.
          </p>
          <div className="mt-10">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-950 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
            >
              Book a 20-min demo <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
