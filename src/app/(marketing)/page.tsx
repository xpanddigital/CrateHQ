import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Instagram, Mail, Inbox, X, Check } from 'lucide-react'
import { TIERS } from '@/components/marketing/pricing-data'
import { UnifiedInboxMockup } from '@/components/marketing/UnifiedInboxMockup'
import { AiDrafterMockup } from '@/components/marketing/AiDrafterMockup'
import { PipelineMockup } from '@/components/marketing/PipelineMockup'
import { Ornament, Eyebrow } from '@/components/marketing/Ornament'
import { HeroVideoPlayer } from '@/components/marketing/HeroVideoPlayer'

// Primary keyword target for the homepage: "music industry CRM" (and
// adjacent variants — "music industry CRM software", "CRM for music
// catalog scouts"). The title leads with the exact-match phrase
// because Praecora has no existing brand authority for organic search
// to fall back on. The brand name lives at the end of the title for
// brand recall.
export const metadata: Metadata = {
  // The root layout template appends " | Praecora", so the page title
  // must NOT include the brand suffix itself (that produced a doubled
  // "… | Praecora | Praecora"). Rendered: "Music Industry CRM for
  // Catalog Scouts | Praecora" (48 chars).
  title: 'Music Industry CRM for Catalog Scouts',
  description:
    'The music industry CRM built for catalog scouts. AI-drafted Instagram and email outreach, unified inbox, deal pipeline — fully managed.',
  alternates: { canonical: 'https://www.praecora.com' },
  openGraph: {
    title: 'Music Industry CRM for Catalog Scouts | Praecora',
    description:
      'The music industry CRM built for catalog scouts. AI-drafted Instagram and email outreach, unified inbox, deal pipeline — fully managed.',
    url: 'https://www.praecora.com',
    type: 'website',
    siteName: 'Praecora',
    images: ['https://www.praecora.com/opengraph-image'],
  },
}

/**
 * Schema.org JSON-LD for the homepage. Declares Praecora as both an
 * Organization (for entity/knowledge-graph signals) and a
 * SoftwareApplication (for product/offer rich snippets). Both objects
 * live in a single `@graph` array so Google reads them as a connected
 * entity rather than two unrelated declarations.
 */
function HomepageJsonLd() {
  // Organization and SoftwareApplication are emitted as two separate,
  // single-typed nodes in the @graph (not one multi-typed node) — a
  // multi-typed Organization/SoftwareApplication trips strict
  // schema.org validation because offer/app properties aren't valid on
  // Organization and vice-versa. The nodes stay linked via @id
  // (SoftwareApplication.publisher → #organization), so the entity
  // graph is still connected. The founder references the canonical
  // Person @id at JoelHouse.com — the same identifier every Xpand
  // venture site emits, so Google's entity resolver clusters them.
  // `sameAs` points at Joel's per-venture canonical page on JoelHouse.com.
  const json = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://www.praecora.com#organization',
        name: 'Praecora',
        url: 'https://www.praecora.com',
        logo: {
          '@type': 'ImageObject',
          url: 'https://www.praecora.com/opengraph-image',
        },
        description:
          'The music industry CRM and outreach platform built for independent music catalog financing scouts.',
        sameAs: ['https://joelhouse.com/ventures/praecora'],
        founder: {
          '@type': 'Person',
          '@id': 'https://joelhouse.com/#person',
          name: 'Joel House',
          url: 'https://joelhouse.com',
        },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': 'https://www.praecora.com#software',
        name: 'Praecora',
        url: 'https://www.praecora.com',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description:
          'The music industry CRM and outreach platform built for independent music catalog financing scouts.',
        offers: {
          '@type': 'AggregateOffer',
          lowPrice: '700',
          highPrice: '2800',
          priceCurrency: 'USD',
          offerCount: '4',
        },
        publisher: { '@id': 'https://www.praecora.com#organization' },
        creator: { '@id': 'https://joelhouse.com/#person' },
      },
      {
        '@type': 'WebSite',
        '@id': 'https://www.praecora.com#website',
        url: 'https://www.praecora.com',
        name: 'Praecora',
        publisher: { '@id': 'https://www.praecora.com#organization' },
        inLanguage: 'en-US',
      },
    ],
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  )
}

export default function MarketingHome() {
  return (
    <>
      <HomepageJsonLd />

      {/* ────────────────────── HERO ────────────────────── */}
      <section className="marketing-hero-bg relative px-4 pt-16 pb-20 md:px-6 md:pt-20 md:pb-24 lg:pt-24">
        <div className="mx-auto w-full max-w-7xl">
          <div className="grid items-center gap-12 md:grid-cols-2 md:gap-12 lg:gap-16">
            {/* LEFT — text + CTAs */}
            <div className="text-center md:text-left">
              <div className="mb-6 flex justify-center md:justify-start">
                <Eyebrow>For music catalog financing scouts</Eyebrow>
              </div>
              <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-tight text-[#0f0d08] sm:text-5xl md:text-5xl lg:text-6xl xl:text-[4.25rem]">
                Outreach that doesn't feel like outreach.
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-balance text-base leading-relaxed text-neutral-600 md:mx-0 md:mt-8 md:text-lg">
                Praecora carries personalized Instagram and email outreach to every
                artist worth knowing — at a volume no human can match, with the care
                no bot can fake.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center md:mt-10 md:justify-start">
                <Link href="/pricing" className="cta-primary">
                  See pricing <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/demo" className="cta-secondary">
                  Book a 20-min demo
                </Link>
              </div>
            </div>

            {/* RIGHT — video teaser */}
            <div className="mx-auto w-full max-w-xl md:max-w-none">
              <HeroVideoPlayer
                teaserSrc="/videos/anatomy-of-a-deal-teaser.mp4"
                fullSrc="/videos/anatomy-of-a-deal.mp4"
                posterSrc="/videos/anatomy-of-a-deal-poster.jpg"
                caption="Watch — Anatomy of a deal"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────── STATS BAR ────────────────────── */}
      <section className="border-y border-black/5 bg-white px-4 py-16 md:px-6 md:py-20">
        <div className="mx-auto w-full max-w-6xl">
          <div className="grid items-end gap-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
            {/* Lead stat — visually anchors the bar */}
            <div className="text-center md:text-left">
              <p className="font-mono text-7xl font-medium tracking-tight text-[#0f0d08] tabular-nums md:text-8xl">
                ~640
                <span className="text-3xl text-neutral-400 md:text-4xl">/day</span>
              </p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Personalized touches at peak tier
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                ~140 IG DMs + ~500 cold emails, daily.
              </p>
            </div>

            {[
              { value: '~30', unit: 'min', label: 'Of your time per day' },
              { value: '~4', unit: 'wks', label: 'Signed → first DM' },
              { value: '0', unit: '', label: 'Manual sends' },
            ].map((s) => (
              <div key={s.label} className="text-center md:text-left">
                <p className="font-mono text-4xl font-medium tracking-tight text-[#0f0d08] tabular-nums md:text-5xl">
                  {s.value}
                  {s.unit && (
                    <span className="text-xl text-neutral-400 md:text-2xl">{s.unit}</span>
                  )}
                </p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────────── WHAT IT IS ──────────────────────
           Short, editorial framing of the product with the primary
           keyword (music industry CRM) in the H2. Sits between the
           stats bar and the longer "drudgery problem" section so the
           keyword lands high on the page where Google weights it
           heavily. */}
      <section className="border-b border-black/5 bg-white px-4 py-20 md:px-6 md:py-24">
        <div className="mx-auto w-full max-w-3xl">
          <Eyebrow>What it is</Eyebrow>
          <h2 className="mt-6 text-balance text-3xl font-bold leading-[1.15] tracking-tight text-[#0f0d08] md:text-4xl lg:text-5xl">
            The music industry CRM for catalog scouts.
          </h2>
          <p className="mt-8 text-lg leading-relaxed text-neutral-700">
            Praecora is a purpose-built CRM and outreach platform for
            independent music catalog financing scouts. AI-drafted
            Instagram and email outreach goes out at the volume your
            work actually requires. Replies land in one classified
            inbox. Deals progress through a pipeline that speaks
            catalog-finance. ~30 minutes of your time per day. The
            rest runs itself.
          </p>
        </div>
      </section>

      {/* ────────────────────── THE PROBLEM ────────────────────── */}
      <section className="px-4 py-28 md:px-6 md:py-36">
        <div className="mx-auto w-full max-w-3xl">
          <Eyebrow>The drudgery problem</Eyebrow>
          <h2 className="mt-6 text-balance text-4xl font-bold leading-[1.1] tracking-tight text-[#0f0d08] md:text-5xl lg:text-6xl">
            You didn't get into catalog finance to type "hey love your sound" 200 times a day.
          </h2>
          <p className="mt-10 text-lg leading-relaxed text-neutral-600">
            You went into this work because you're good at judgment, relationships, and the
            close. But outreach is math: more conversations = more deals = more commissions.
            So you grind. And the grind grinds you back.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-neutral-600">
            The villain isn't AI. It isn't Instagram. It's{' '}
            <strong className="text-rust">the drudgery</strong> — the
            mechanical work that scales linearly with your effort and burns out everything
            around it.
          </p>

          <div className="mt-16 space-y-12">
            {[
              {
                title: 'My accounts keep getting banned.',
                body: 'Because most outreach tools ship a UI, not infrastructure. We built the 13-Point Sentinel Protocol™ specifically to fix the structural reasons accounts die — identity isolation, dedicated environments per account, geographic anchoring, multi-week trust curves, account-level kill switches. Praecora scouts run their fleets for 12+ months. Without Sentinel, you have a 90-day half-life.',
              },
              {
                title: "I don't have time to send 140 DMs and 500 emails a day.",
                body: "And you shouldn't — that work doesn't need you. It needs a herald who pays attention to each artist before sending. That's a different job entirely.",
              },
              {
                title: 'AI-written outreach sounds robotic and gets me flagged.',
                body: 'Most AI does. The lazy kind that templates "hope this finds you well" across 10,000 contacts. Praecora doesn\'t.',
              },
            ].map((item) => (
              <div key={item.title} className="border-l-2 border-rust pl-6">
                <h3 className="text-xl font-semibold text-[#0f0d08] md:text-2xl">
                  "{item.title}"
                </h3>
                <p className="mt-3 text-base leading-relaxed text-neutral-600">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────────── GUIDE INTRO ────────────────────── */}
      <section className="border-t border-black/5 bg-white px-4 py-28 md:px-6 md:py-36">
        <div className="mx-auto w-full max-w-3xl">
          <Eyebrow>Your herald</Eyebrow>
          <h2 className="mt-6 text-balance text-4xl font-bold leading-[1.1] tracking-tight text-[#0f0d08] md:text-5xl lg:text-6xl">
            We carry your message. With care.
          </h2>
          <p className="mt-10 text-lg leading-relaxed text-neutral-700">
            Praecora was built by operators who'd watched too many scouts burn through
            accounts, burn through nights, and burn out — all while their actual skill
            (closing deals) sat unused.
          </p>
          <p className="mt-5 text-lg leading-relaxed text-neutral-700">
            We named the platform after the Latin{' '}
            <em className="font-[var(--font-heading)] italic text-rust">praeco</em>{' '}
            — the herald who carried important messages on behalf of others — paired with{' '}
            <em className="font-[var(--font-heading)] italic text-rust">cor</em>,
            meaning heart. Because outreach without care is spam. And spam is what got the
            last generation of scouts banned.
          </p>
          <p className="mt-5 text-lg leading-relaxed text-neutral-700">
            Every cold opener Praecora drafts is read against the artist's bio, recent
            posts, and Spotify catalog before it goes out. Every reply is classified,
            suggested, and ready for your one-click response. The volume happens on its
            own. <strong className="text-[#0f0d08]">The closing — still you.</strong>
          </p>
        </div>
      </section>

      {/* ────────────────────── MULTI-CHANNEL FEATURE ────────────────────── */}
      <section className="border-t border-black/5 bg-white px-4 py-28 md:px-6 md:py-36">
        <div className="mx-auto w-full max-w-6xl">
          <div className="grid gap-16 md:grid-cols-2 md:items-center md:gap-16">
            <div>
              <Eyebrow>Multi-channel outreach</Eyebrow>
              <h2 className="mt-6 text-balance text-4xl font-bold leading-[1.1] tracking-tight text-[#0f0d08] md:text-5xl">
                Two channels. One inbox.
              </h2>
              <p className="mt-8 text-lg leading-relaxed text-neutral-600">
                Indie artists live on Instagram. Their managers and labels live in email.
                Praecora carries your message on both, in parallel, on every artist you touch.
              </p>

              <div className="mt-12 space-y-7">
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-pink-100 via-orange-50 to-yellow-50">
                    <Instagram className="h-5 w-5 text-pink-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#0f0d08]">Instagram DMs</p>
                    <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                      Reach the artists themselves. Personalized to their bio, recent posts,
                      and Spotify catalog. Up to 140 cold DMs per day.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50">
                    <Mail className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#0f0d08]">Cold email at scale</p>
                    <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                      Reach managers, labels, and business contacts. Up to 600 personalized
                      emails per day with deliverability built in.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100">
                    <Inbox className="h-5 w-5 text-neutral-700" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#0f0d08]">Unified inbox</p>
                    <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                      Every reply from every channel lands in one place, AI-classified
                      and ready for your one-click response.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="md:order-first">
              <UnifiedInboxMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────── AI DRAFTER FEATURE ────────────────────── */}
      <section className="px-4 py-28 md:px-6 md:py-36">
        <div className="mx-auto w-full max-w-6xl">
          <div className="grid gap-16 md:grid-cols-2 md:items-center md:gap-16">
            <div>
              <Eyebrow>AI cold opener drafter</Eyebrow>
              <h2 className="mt-6 text-balance text-4xl font-bold leading-[1.1] tracking-tight text-[#0f0d08] md:text-5xl">
                Personalized openers that don't sound like a bot.
              </h2>
              <p className="mt-8 text-lg leading-relaxed text-neutral-600">
                Our AI reads each artist's bio, recent posts, follower trajectory, and
                Spotify catalog before drafting. Every opener references something
                specific about them.
              </p>
              <p className="mt-4 text-base leading-relaxed text-neutral-600">
                Then a quality pass before send. Then delivery via the right channel.
                You see what's queued. Nothing goes out without standards.
              </p>
            </div>
            <div>
              <AiDrafterMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────── PIPELINE FEATURE ────────────────────── */}
      <section className="border-t border-black/5 bg-white px-4 py-28 md:px-6 md:py-36">
        <div className="mx-auto w-full max-w-6xl">
          <div className="grid gap-16 md:grid-cols-2 md:items-center md:gap-16">
            <div>
              <Eyebrow>Deal pipeline</Eyebrow>
              <h2 className="mt-6 text-balance text-4xl font-bold leading-[1.1] tracking-tight text-[#0f0d08] md:text-5xl">
                Built for scouts. Not for generic SaaS.
              </h2>
              <p className="mt-8 text-lg leading-relaxed text-neutral-600">
                Every conversation lives next to its deal. Every artist has their full
                catalog data, follower trajectory, and contact graph. Drag-and-drop kanban
                from contacted → replied → call booked → closed.
              </p>
              <p className="mt-4 text-base leading-relaxed text-neutral-600">
                Your commission dashboard updates the moment a deal moves to closed.
              </p>
            </div>
            <div className="md:order-first">
              <PipelineMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────── THE PLAN ────────────────────── */}
      <section className="border-t border-black/5 px-4 py-28 md:px-6 md:py-36">
        <div className="mx-auto w-full max-w-5xl">
          <div className="max-w-3xl">
            <Eyebrow>The plan</Eyebrow>
            <h2 className="mt-6 text-balance text-4xl font-bold leading-[1.1] tracking-tight text-[#0f0d08] md:text-5xl lg:text-6xl">
              Three steps. Four weeks to live.
            </h2>
          </div>

          <div className="mt-20 grid gap-12 md:grid-cols-3 md:gap-10">
            {[
              {
                step: '01',
                title: 'Pick your tier',
                body: "Pay onboarding upfront. Pick your volume. Subscription doesn't start until you're live.",
              },
              {
                step: '02',
                title: 'We build your herald',
                body: "Four weeks of careful account preparation across Instagram and email. You don't lift a finger.",
              },
              {
                step: '03',
                title: 'Close from one inbox',
                body: '~30 min/day in your Praecora inbox. AI classifies replies, suggests responses, queues your next move.',
              },
            ].map((s) => (
              <div key={s.step}>
                <p className="font-mono text-6xl font-medium leading-none text-rust opacity-80 tabular-nums">
                  {s.step}
                </p>
                <h3 className="mt-8 text-xl font-semibold text-[#0f0d08]">{s.title}</h3>
                <p className="mt-3 text-base leading-relaxed text-neutral-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────────── PRICING PREVIEW ────────────────────── */}
      <section className="border-t border-black/5 bg-white px-4 py-28 md:px-6 md:py-36">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <div className="flex justify-center">
              <Eyebrow>Pricing</Eyebrow>
            </div>
            <h2 className="mt-6 text-balance text-4xl font-bold leading-[1.1] tracking-tight text-[#0f0d08] md:text-5xl lg:text-6xl">
              Pick your volume. Grow when ready.
            </h2>
            <p className="mt-8 text-lg text-neutral-600">
              Pay onboarding upfront. Subscription begins when your outreach goes
              live — never before.
            </p>
          </div>

          <div className="mt-20 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((t) => (
              <div
                key={t.id}
                className={`relative rounded-xl border p-6 transition-shadow ${
                  t.highlight
                    ? 'border-[#0f0d08] bg-white ring-2 ring-[#0f0d08] shadow-[0_24px_48px_-24px_rgba(15,13,8,0.2)]'
                    : 'border-black/10 bg-white hover:shadow-[0_12px_24px_-12px_rgba(15,13,8,0.1)]'
                }`}
              >
                {t.badge && (
                  <span
                    className={`absolute -top-3 left-6 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      t.id === 'growth'
                        ? 'bg-[#0f0d08] text-white'
                        : 'bg-[#e8ff47] text-[#0f0d08]'
                    }`}
                  >
                    ★ {t.badge}
                  </span>
                )}
                <p className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                  {t.name}
                </p>
                <p className="mt-1 text-xs text-neutral-500">{t.bestFor}</p>

                <p className="mt-6 font-mono text-4xl font-medium tracking-tight text-[#0f0d08] tabular-nums">
                  ${t.monthly.toLocaleString()}
                  <span className="font-sans text-base font-normal text-neutral-500">
                    /mo
                  </span>
                </p>
                <p className="mt-2 text-xs text-neutral-500">
                  + ${t.onboarding} onboarding{' '}
                  <span className="text-neutral-400 line-through">${t.onboardingOriginal}</span>
                </p>

                <div className="mt-6 space-y-2 border-t border-black/5 pt-6 text-sm text-neutral-700">
                  <p className="font-medium text-[#0f0d08]">
                    ✓ Full 13-Point Sentinel Protocol™
                  </p>
                  <p>
                    <strong className="text-[#0f0d08]">{t.dmsPerDay}</strong>/day IG DMs
                  </p>
                  <p>
                    <strong className="text-[#0f0d08]">{t.emailsPerDay}</strong>/day cold emails
                  </p>
                  <p>
                    <strong className="text-[#0f0d08]">{t.expectedDealsMo}</strong> deals/mo (typical)
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-14 text-center">
            <Link href="/pricing" className="cta-primary">
              See full feature comparison <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ────────────────────── STAKES ────────────────────── */}
      <section className="border-t border-black/5 px-4 py-28 md:px-6 md:py-36">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mx-auto max-w-3xl text-center">
            <div className="flex justify-center">
              <Eyebrow>The stakes</Eyebrow>
            </div>
            <h2 className="mt-6 text-balance text-4xl font-bold leading-[1.1] tracking-tight text-[#0f0d08] md:text-5xl lg:text-6xl">
              Two paths from here.
            </h2>
            <p className="mx-auto mt-8 max-w-2xl text-lg text-neutral-600">
              You're 90 days from a meaningfully different operation. Which version of it
              do you want?
            </p>
          </div>

          <div className="mt-20 grid gap-6 md:grid-cols-2">
            {/* Without */}
            <div className="rounded-xl border border-black/10 bg-white/60 p-10">
              <p className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                Without Praecora
              </p>
              <ul className="mt-8 space-y-5">
                {[
                  '6 hours/day on outreach grind',
                  'Accounts banned every quarter',
                  'Pipeline tied to your typing speed',
                  'Stuck at your current ceiling',
                  'Nights and weekends gone',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-neutral-500">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* With */}
            <div className="rounded-xl border-2 border-[#0f0d08] bg-white p-10 shadow-[0_24px_48px_-24px_rgba(15,13,8,0.2)]">
              <p className="text-sm font-semibold uppercase tracking-wider text-rust">
                With Praecora
              </p>
              <ul className="mt-8 space-y-5">
                {[
                  '~30 minutes/day on closing',
                  'Accounts lasting 12+ months',
                  'Pipeline compounding while you sleep',
                  '5–15 deals/month, predictable',
                  'Your time back where it belongs',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm font-medium text-[#0f0d08]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-rust" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────── DAY IN THE LIFE ────────────────────── */}
      <section className="border-t border-black/5 bg-white px-4 py-28 md:px-6 md:py-36">
        <div className="mx-auto w-full max-w-3xl">
          <Eyebrow>A day in the life</Eyebrow>
          <h2 className="mt-6 text-balance text-4xl font-bold leading-[1.1] tracking-tight text-[#0f0d08] md:text-5xl lg:text-6xl">
            What your day actually looks like.
          </h2>

          <div className="mt-20 space-y-10">
            {[
              {
                time: '6:00',
                meridiem: 'AM',
                title: 'Outreach goes out — without you',
                body: "Today's ~140 IG DMs and ~500 cold emails begin sending across all your active outreach. You're still asleep.",
              },
              {
                time: '9:00',
                meridiem: 'AM',
                title: 'Morning inbox check',
                body: 'You open Praecora. AI has already classified overnight replies into "interested," "needs response," and "noise." 12 minutes to triage.',
              },
              {
                time: '11:00',
                meridiem: 'AM',
                title: 'AI-suggested replies, one-click sends',
                body: 'Three artists asked for the deck. You hit "send suggested reply" on each. Two more want a call — book them straight from the inbox.',
              },
              {
                time: '2:00',
                meridiem: 'PM',
                title: 'Discovery call',
                body: 'Conversation context, recent message thread, and artist enrichment data sit in the deal panel. No tab-switching.',
              },
              {
                time: '4:00',
                meridiem: 'PM',
                title: 'Pipeline review',
                body: "Move two artists to \"proposal sent.\" Notes auto-saved. Tomorrow's outreach is already queued — no lifting required.",
              },
            ].map((entry) => (
              <div
                key={entry.time}
                className="grid grid-cols-[80px_1fr] gap-6 md:grid-cols-[120px_1fr] md:gap-10"
              >
                <div className="font-mono text-sm tabular-nums">
                  <span className="text-rust">{entry.time}</span>
                  <span className="ml-1 text-neutral-500">{entry.meridiem}</span>
                </div>
                <div>
                  <p className="font-semibold text-[#0f0d08]">{entry.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                    {entry.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────────── HONEST READ ────────────────────── */}
      <section className="border-t border-black/5 px-4 py-28 md:px-6 md:py-36">
        <div className="mx-auto w-full max-w-3xl">
          <Eyebrow>Honest read</Eyebrow>
          <h2 className="mt-6 text-balance text-4xl font-bold leading-[1.1] tracking-tight text-[#0f0d08] md:text-5xl lg:text-6xl">
            What can still go wrong.
          </h2>
          <p className="mt-8 text-lg leading-relaxed text-neutral-600">
            We won't pretend outreach at this volume is risk-free. Anyone who tells you
            that is either lying or new. Here's what we know:
          </p>

          <div className="mt-16 space-y-10">
            {[
              {
                q: 'Bans happen.',
                a: "Even with months of careful preparation, Instagram's ML changes weekly. Periodic account loss is a cost of doing business in this category. Our job is to make those losses isolated and replaceable, not to pretend they won't happen. Replacement accounts are included.",
              },
              {
                q: "Email deliverability isn't free.",
                a: "We invest in domain warm-up, sender reputation, and inbox-placement infrastructure. But no email platform on earth guarantees the inbox. We optimize aggressively; we don't over-promise.",
              },
              {
                q: "You won't close every interested reply.",
                a: "AI-drafted openers and reply triage make outreach efficient — they don't replace your closing skill. We're the top of your funnel. You're still the closer.",
              },
            ].map((item) => (
              <div key={item.q} className="border-l-2 border-rust pl-6">
                <p className="text-lg font-semibold text-[#0f0d08]">{item.q}</p>
                <p className="mt-2 text-base leading-relaxed text-neutral-600">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── ORNAMENT — editorial rhythm before founder note ───────────── */}
      <div className="py-12 md:py-16">
        <Ornament />
      </div>

      {/* ────────────────────── FOUNDER NOTE — magazine spread ────────────────────── */}
      <section className="founder-note-bg relative bg-white px-4 py-28 md:px-6 md:py-36">
        {/* Watermark P behind everything */}
        <div className="founder-note-watermark">
          <span>P</span>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-6xl">
          <div className="mb-12 md:mb-16">
            <Eyebrow>Founder note</Eyebrow>
          </div>

          <div className="grid gap-12 md:grid-cols-[auto_1fr] md:items-start md:gap-16 lg:gap-20">
            {/* LEFT — portrait + byline */}
            <div className="mx-auto flex flex-col items-center md:items-start md:mx-0">
              {/* Photo with subtle rust hairline frame accent */}
              <div className="relative">
                {/* Top-left corner accent */}
                <div
                  aria-hidden
                  className="absolute -left-3 -top-3 h-10 w-10 border-l-2 border-t-2 border-rust"
                />
                {/* Bottom-right corner accent */}
                <div
                  aria-hidden
                  className="absolute -bottom-3 -right-3 h-10 w-10 border-b-2 border-r-2 border-rust"
                />
                <img
                  src="/founder/joel-founder.jpg"
                  alt="Joel House, Founder of Praecora"
                  width={320}
                  height={320}
                  className="relative block h-72 w-72 object-cover shadow-[0_24px_48px_-24px_rgba(184,83,29,0.3)] md:h-80 md:w-80"
                  loading="lazy"
                />
              </div>

              {/* Byline below photo */}
              <div className="mt-8 w-full max-w-[320px] text-center md:text-left">
                <div className="mb-3 h-px w-12 bg-rust opacity-60" />
                <p className="font-semibold tracking-tight text-[#0f0d08]">
                  Joel House
                </p>
                <p className="mt-0.5 text-sm text-neutral-500">
                  Founder, Praecora
                </p>
              </div>
            </div>

            {/* RIGHT — italic Cormorant quote */}
            <blockquote className="space-y-6 font-[var(--font-heading)] text-2xl italic leading-[1.45] text-[#0f0d08] md:text-3xl">
              <p>
                <em className="text-rust-deep not-italic font-[var(--font-heading)] italic">"Praecora"</em> comes from the Latin{' '}
                <em className="text-rust">praeco</em> — the herald who carried important
                messages on behalf of others — and{' '}
                <em className="text-rust">cor</em>, meaning heart.
              </p>
              <p>
                I named it that because the music industry doesn't need another generic
                outreach bot. It needs a herald who actually pays attention to the artist
                on the other end. Who reads the bio. Who notices the latest release. Who
                carries your message with the care you'd give it yourself, at a volume
                you never could alone.
              </p>
              <p>
                I built Praecora because I'd watched too many scouts in this industry burn
                through accounts, burn through nights, and burn out — all while their
                actual skill (closing deals) sat unused. The mechanical work was eating
                the meaningful work.
              </p>
              <p>
                Praecora is what I wish had existed when I was inside this playbook myself.
              </p>
            </blockquote>
          </div>
        </div>
      </section>

      {/* ───────────── ORNAMENT — before final CTA ───────────── */}
      <div className="py-12 md:py-16">
        <Ornament />
      </div>

      {/* ────────────────────── FINAL CTA ────────────────────── */}
      <section className="px-4 pb-28 pt-4 md:px-6 md:pb-36 md:pt-8">
        <div className="mx-auto w-full max-w-3xl text-center">
          <h2 className="text-balance text-5xl font-bold leading-[1.05] tracking-tight text-[#0f0d08] md:text-6xl lg:text-7xl">
            Let Praecora carry it for you.
          </h2>
          <p className="mx-auto mt-10 max-w-xl text-lg text-neutral-600">
            Pick a tier. Pay onboarding. We'll have your herald live in ~4 weeks.
            Subscription doesn't bill until you're live.
          </p>
          <div className="mt-14 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/pricing" className="cta-primary">
              See pricing <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/demo" className="cta-secondary">
              Book a 20-min demo
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
