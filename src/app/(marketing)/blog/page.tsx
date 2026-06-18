import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowRight } from 'lucide-react'
import { Eyebrow } from '@/components/marketing/Ornament'
import { getVisiblePosts, PILLAR_LABELS, type BlogPost } from './posts'

// Revalidate hourly so newly-scheduled posts flip to visible without
// requiring a deploy. Each scheduled post becomes visible at 00:00 UTC
// on its `publishedAt`; the page will pick it up within an hour.
export const revalidate = 3600

export const metadata: Metadata = {
  // " | Praecora" is appended by the root layout template.
  title: 'Praecora Field Guide — Music Catalog Scouting',
  description:
    'Long-form writing on Instagram outreach, music catalog financing, and the operational craft of independent deal flow — by operators who do this for a living.',
  alternates: {
    canonical: 'https://www.praecora.com/blog',
  },
  openGraph: {
    title: 'The Praecora field guide',
    description:
      'Long-form writing on Instagram outreach, music catalog financing, and the operational craft of independent deal flow.',
    url: 'https://www.praecora.com/blog',
    type: 'website',
    siteName: 'Praecora',
    images: ['https://www.praecora.com/opengraph-image'],
  },
}

export default function BlogIndex() {
  const visible = getVisiblePosts()
  const featured = visible.filter((p) => p.featured)
  const rest = visible.filter((p) => !p.featured)

  return (
    <>
      {/* HERO */}
      <section className="marketing-hero-bg border-b border-black/5 px-4 pt-20 pb-16 md:px-6 md:pt-28 md:pb-24">
        <div className="mx-auto w-full max-w-4xl">
          <div className="mb-6 flex justify-center md:justify-start">
            <Eyebrow>The Praecora field guide</Eyebrow>
          </div>
          <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-tight text-[#0f0d08] md:text-6xl lg:text-[4.25rem]">
            Music catalog scouting,{' '}
            <span className="font-[var(--font-heading)] italic font-semibold text-[#b8531d]">
              written down
            </span>
            .
          </h1>
          <p className="mt-8 max-w-2xl text-balance text-lg leading-relaxed text-neutral-600 md:text-xl">
            The operational craft of independent deal flow — Instagram fleets,
            cold-email infrastructure, catalog valuation, broker commission
            models. Written by operators, not editorial freelancers.
          </p>
        </div>
      </section>

      {/* FEATURED */}
      {featured.length > 0 ? (
        <section className="border-b border-black/5 bg-white px-4 py-16 md:px-6 md:py-24">
          <div className="mx-auto w-full max-w-6xl">
            <p className="mb-10 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Start here
            </p>
            <div className="grid gap-8 md:grid-cols-3">
              {featured.map((post) => (
                <FeaturedCard key={post.slug} post={post} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* INDEX */}
      <section className="bg-[#faf8f3] px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto w-full max-w-4xl">
          <p className="mb-10 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
            All articles
          </p>
          <div className="divide-y divide-black/5 border-y border-black/5">
            {rest.map((post) => (
              <IndexRow key={post.slug} post={post} />
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

function FeaturedCard({ post }: { post: BlogPost }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col rounded-2xl border border-black/5 bg-white p-7 transition-all hover:-translate-y-0.5 hover:border-[#b8531d]/30 hover:shadow-md"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#b8531d]">
        {PILLAR_LABELS[post.pillar]}
      </p>
      <h2 className="mt-4 text-balance text-xl font-bold leading-snug tracking-tight text-[#0f0d08] md:text-2xl">
        {post.title}
      </h2>
      <p className="mt-4 line-clamp-4 flex-1 text-sm leading-relaxed text-neutral-600">
        {post.description}
      </p>
      <div className="mt-6 flex items-center justify-between border-t border-black/5 pt-4">
        <p className="text-xs text-neutral-500">{post.readingTime} min read</p>
        <ArrowRight className="h-4 w-4 text-neutral-400 transition-all group-hover:translate-x-1 group-hover:text-[#b8531d]" />
      </div>
    </Link>
  )
}

function IndexRow({ post }: { post: BlogPost }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block py-8 transition-colors"
    >
      <div className="flex items-baseline justify-between gap-6">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#b8531d]">
            {PILLAR_LABELS[post.pillar]}
          </p>
          <h3 className="mt-2 text-balance text-xl font-semibold tracking-tight text-[#0f0d08] group-hover:text-[#7a2a0f] md:text-2xl">
            {post.title}
          </h3>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-600">
            {post.description}
          </p>
        </div>
        <p className="hidden shrink-0 text-xs text-neutral-500 md:block">
          {post.readingTime} min
        </p>
      </div>
    </Link>
  )
}
