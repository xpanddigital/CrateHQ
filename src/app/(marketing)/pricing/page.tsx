import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { PricingTable, TIERS } from '@/components/marketing/PricingTable'
import { Eyebrow } from '@/components/marketing/Ornament'

// /pricing supports the homepage's primary keyword (music industry CRM)
// with a pricing-intent variant. Most pricing-page organic traffic comes
// from brand-aware searchers — but the Product/Offer schema below also
// lets Google render price-range rich snippets in regular search results,
// which is the real SEO win on this page.
export const metadata: Metadata = {
  // Brand suffix " | Praecora" is appended by the root layout template —
  // don't repeat it here.
  title: 'Pricing — Music Industry CRM for Scouts',
  description:
    'Four tiers of done-for-you Instagram and email outreach for music catalog scouts, $700–$2,800/month. Onboarding covers setup; billing starts at go-live.',
  alternates: { canonical: 'https://www.praecora.com/pricing' },
  openGraph: {
    title: 'Praecora pricing — Music industry CRM for catalog scouts',
    description:
      'Four tiers of done-for-you Instagram and email outreach. $700–$2,800/month for music catalog scouts.',
    url: 'https://www.praecora.com/pricing',
    type: 'website',
    siteName: 'Praecora',
    images: ['https://www.praecora.com/opengraph-image'],
  },
}

/**
 * Product + Offer schema for the pricing page. Each of the four tiers
 * is a separate Offer so Google can render the full price range, plus
 * an AggregateOffer summary. Distinct from the homepage's
 * SoftwareApplication schema — this page is the canonical Product page.
 */
function PricingJsonLd() {
  const offers = TIERS.map((tier) => ({
    '@type': 'Offer',
    name: `Praecora ${tier.name}`,
    description: tier.bestFor,
    price: tier.monthly.toString(),
    priceCurrency: 'USD',
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: tier.monthly,
      priceCurrency: 'USD',
      unitText: 'MONTH',
    },
    availability: 'https://schema.org/InStock',
    url: `https://www.praecora.com${tier.ctaHref}`,
  }))

  const json = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': 'https://www.praecora.com/pricing#product',
    name: 'Praecora',
    description:
      'A music industry CRM and managed outreach platform for independent music catalog financing scouts.',
    brand: {
      '@type': 'Brand',
      name: 'Praecora',
    },
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: '700',
      highPrice: '2800',
      priceCurrency: 'USD',
      offerCount: TIERS.length.toString(),
      offers,
    },
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  )
}

export default function PricingPage() {
  return (
    <>
      <PricingJsonLd />
      {/* HERO */}
      <section className="marketing-hero-bg px-4 pt-24 pb-16 md:px-6 md:pt-32 md:pb-20">
        <div className="mx-auto w-full max-w-4xl text-center">
          <div className="mb-8 flex justify-center">
            <Eyebrow>Pricing</Eyebrow>
          </div>
          <h1 className="text-balance text-5xl font-bold leading-[1.05] tracking-tight text-[#0f0d08] md:text-7xl">
            Pick your volume.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600">
            Four tiers, scaled by outreach volume across Instagram and email. Same
            Praecora platform, same AI, same care in delivery — just more of it as
            you grow.
          </p>

          <div className="mx-auto mt-10 flex max-w-2xl flex-col gap-4 rounded-xl border border-black/10 bg-white p-6 text-left sm:flex-row sm:items-start">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#e8ff47]">
              <Check className="h-5 w-5 text-neutral-950" />
            </div>
            <div>
              <p className="font-semibold text-neutral-950">
                Onboarding now, subscription later.
              </p>
              <p className="mt-1 text-sm text-neutral-600">
                Pay your one-time onboarding fee at signup. Your monthly subscription
                doesn't begin billing until your outreach is live (~4 weeks). You're never
                paying for service you haven't received.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING TABLE */}
      <section className="border-t border-black/5 bg-white px-4 py-16 md:px-6 md:py-24">
        <div className="mx-auto w-full max-w-7xl">
          <PricingTable />
        </div>
      </section>

      {/* ANNUAL ANCHOR */}
      <section
        id="annual"
        className="border-t border-black/5 px-4 py-20 md:px-6 md:py-24"
      >
        <div className="mx-auto w-full max-w-5xl">
          <div className="text-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
              Annual prepay
            </p>
            <h2 className="text-balance text-4xl font-bold tracking-tight text-neutral-950 md:text-5xl">
              Pay yearly, save 2 months.
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600">
              Same product, same volume, same support — billed yearly with a meaningful
              discount.
            </p>
          </div>

          <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((t) => {
              const monthlyTotal = t.monthly * 12
              const savings = monthlyTotal - t.annual
              return (
                <div
                  key={t.id}
                  className={`rounded-xl border p-6 ${
                    t.highlight
                      ? 'border-neutral-950 bg-white ring-2 ring-neutral-950'
                      : 'border-black/10 bg-white'
                  }`}
                >
                  <p className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                    {t.name}
                  </p>
                  <p className="mt-4 font-mono text-3xl font-medium tracking-tight text-neutral-950">
                    ${t.annual.toLocaleString()}
                    <span className="font-sans text-sm font-normal text-neutral-500">
                      /yr
                    </span>
                  </p>
                  <p className="mt-2 text-xs text-neutral-500">
                    vs ${monthlyTotal.toLocaleString()} billed monthly
                  </p>
                  <p className="mt-4 inline-flex items-center rounded-full bg-[#e8ff47] px-2.5 py-1 text-xs font-semibold text-neutral-950">
                    Save ${savings.toLocaleString()}/yr
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-black/5 bg-white px-4 py-20 md:px-6 md:py-24">
        <div className="mx-auto w-full max-w-3xl">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-neutral-950 md:text-4xl">
            Common pricing questions
          </h2>

          <div className="mt-12 space-y-8">
            {[
              {
                q: 'Why is there an onboarding fee?',
                a: 'The first 4 weeks are real work — provisioning your dedicated outreach presence, setting up email sender domains, configuring your AI voice, preparing your accounts for safe operation, and seeding initial content. The onboarding fee covers that work. Charging it upfront also keeps both sides committed.',
              },
              {
                q: 'When does the monthly subscription start?',
                a: 'The day your outreach goes live — typically ~4 weeks after onboarding payment. You\'ll get an email confirmation when billing begins, and your card is charged from that date forward.',
              },
              {
                q: 'Can I cancel anytime?',
                a: 'Yes. Month-to-month, no long-term contracts. Cancel any time and we hand off the assets we\'ve built for you.',
              },
              {
                q: 'Can I upgrade or downgrade tiers?',
                a: 'Yes. Upgrading is instant — you pick up additional capacity at next billing cycle. Downgrading takes effect at your next renewal so you don\'t lose paid-for capacity.',
              },
              {
                q: 'Do you offer refunds?',
                a: 'The onboarding fee is non-refundable since it covers real labor delivered. Monthly subscription is month-to-month — cancel any time. We\'d rather lose a customer than fight over a refund.',
              },
              {
                q: 'How do I pick the right tier?',
                a: 'If you\'re testing whether outreach at this volume works for you, start with Starter. If you\'re already producing deals and want to scale, Growth or Pro is right. Whale is for scouts running serious volume with team support. You can upgrade as you grow.',
              },
            ].map((item) => (
              <div key={item.q} className="border-l-2 border-neutral-300 pl-6">
                <p className="text-lg font-semibold text-neutral-950">{item.q}</p>
                <p className="mt-2 text-base leading-relaxed text-neutral-600">{item.a}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/faq"
              className="inline-flex items-center gap-2 text-sm font-medium text-neutral-950 hover:underline"
            >
              See all FAQs <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-black/5 px-4 py-24 md:px-6">
        <div className="mx-auto w-full max-w-3xl text-center">
          <h2 className="text-balance text-4xl font-bold tracking-tight text-neutral-950 md:text-5xl">
            Still deciding?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-neutral-600">
            Book a 20-minute call. We'll walk through the platform with a real
            (anonymized) scout's inbox so you can see what your day looks like.
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
