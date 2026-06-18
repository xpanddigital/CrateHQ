import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ExternalLink } from 'lucide-react'
import { Eyebrow } from '@/components/marketing/Ornament'
import {
  getVisiblePosts,
  PILLAR_LABELS,
  type BlogPost,
} from '@/app/(marketing)/blog/posts'
import {
  JOEL_HOUSE_AUTHOR_URL,
  JOEL_HOUSE_BIO_LONG,
  JOEL_HOUSE_HEADSHOT_URL,
  JOEL_HOUSE_SAME_AS,
  getJoelHousePersonJsonLd,
} from '@/lib/joel-house-person'

// Revalidate hourly so the post list picks up newly-scheduled articles
// as they go live. Matches the blog index cadence.
export const revalidate = 3600

export const metadata: Metadata = {
  // " | Praecora" is appended by the root layout template.
  title: 'Joel House — Founder of Praecora',
  description:
    'Founder of Joel House Search Media and Xpand Digital, Forbes Agency Council member, and author of AI for Revenue. Writes on catalog scouting and AI search.',
  alternates: { canonical: 'https://www.praecora.com/author/joel-house' },
  // Author page is indexable on purpose — it's a signal hub, not an
  // admin page. The canonical rel=author still points off-site to
  // JoelHouse.com so Google reads JoelHouse.com as the primary profile.
  authors: [{ name: 'Joel House', url: JOEL_HOUSE_AUTHOR_URL }],
  openGraph: {
    title: 'Joel House — Founder of Praecora and Joel House Search Media',
    description:
      'Founder of Joel House Search Media and Xpand Digital. Forbes Agency Council. Author of AI for Revenue. Writes about music catalog scouting and AI search.',
    url: 'https://www.praecora.com/author/joel-house',
    type: 'profile',
    siteName: 'Praecora',
    images: [JOEL_HOUSE_HEADSHOT_URL],
  },
}

/**
 * Author-page JSON-LD. Emits the canonical Person plus a ProfilePage
 * that owns it. The Person @id is the cross-site identifier; ProfilePage
 * is the page-type for an author profile per Google's guidelines.
 */
function AuthorJsonLd({ postCount }: { postCount: number }) {
  const json = {
    '@context': 'https://schema.org',
    '@graph': [
      getJoelHousePersonJsonLd(),
      {
        '@type': 'ProfilePage',
        '@id': 'https://www.praecora.com/author/joel-house#profile',
        url: 'https://www.praecora.com/author/joel-house',
        name: 'Joel House — Author profile on Praecora',
        about: { '@id': 'https://joelhouse.com/#person' },
        mainEntity: { '@id': 'https://joelhouse.com/#person' },
        publisher: {
          '@type': 'Organization',
          name: 'Praecora',
          url: 'https://www.praecora.com',
        },
        // Indicates this author profile lists the posts on this site
        // — useful additional context for Google's understanding.
        description: `Author profile listing ${postCount} field-guide articles written by Joel House for Praecora.`,
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

export default function JoelHouseAuthorPage() {
  const posts = getVisiblePosts()
  const visibleCount = posts.length

  return (
    <>
      <AuthorJsonLd postCount={visibleCount} />

      {/* HERO */}
      <section className="marketing-hero-bg border-b border-black/5 px-4 pt-20 pb-16 md:px-6 md:pt-28 md:pb-20">
        <div className="mx-auto w-full max-w-4xl">
          <div className="flex flex-col items-start gap-10 md:flex-row md:items-center md:gap-16">
            {/* Headshot — hot-linked from JoelHouse.com so the image
                URL is identical across every Xpand property. Per the
                Author Authority Hub brief, never re-host. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={JOEL_HOUSE_HEADSHOT_URL}
              alt="Joel House"
              width={180}
              height={180}
              className="h-44 w-44 shrink-0 rounded-full border border-black/10 object-cover shadow-sm md:h-48 md:w-48"
            />
            <div>
              <Eyebrow>Author</Eyebrow>
              <h1 className="mt-4 text-balance text-4xl font-bold leading-[1.05] tracking-tight text-[#0f0d08] md:text-5xl lg:text-6xl">
                Joel House
              </h1>
              <p className="mt-4 text-lg leading-relaxed text-neutral-600 md:text-xl">
                Founder of Praecora. Founder of Joel House Search Media
                and Xpand Digital. Forbes Agency Council member. Author
                of <em className="font-[var(--font-heading)] italic">AI for Revenue</em>.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a
                  href="https://joelhouse.com"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#b8531d] underline-offset-4 hover:underline"
                >
                  JoelHouse.com <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <span className="text-neutral-300">·</span>
                <a
                  href="https://www.linkedin.com/in/joelhouse"
                  className="text-sm font-medium text-neutral-600 hover:text-[#0f0d08]"
                >
                  LinkedIn
                </a>
                <span className="text-neutral-300">·</span>
                <a
                  href="https://councils.forbes.com/profile/Joel-House-Founder-Joel-House-Search-Media"
                  className="text-sm font-medium text-neutral-600 hover:text-[#0f0d08]"
                >
                  Forbes
                </a>
                <span className="text-neutral-300">·</span>
                <a
                  href="https://www.amazon.com/author/joelhouse"
                  className="text-sm font-medium text-neutral-600 hover:text-[#0f0d08]"
                >
                  Amazon Author
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BIO */}
      <section className="bg-white px-4 py-20 md:px-6 md:py-24">
        <div className="mx-auto w-full max-w-3xl">
          <Eyebrow>About Joel</Eyebrow>
          <p className="mt-8 text-lg leading-relaxed text-neutral-700 md:text-xl">
            {JOEL_HOUSE_BIO_LONG}
          </p>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-black/5 bg-[#faf8f3] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                Credentials
              </p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-700">
                <li>Forbes Agency Council member</li>
                <li>Author, <em>AI for Revenue</em></li>
                <li>Founder, Joel House Search Media</li>
                <li>Founder, Xpand Digital</li>
                <li>Built MentionLayer (GEO platform)</li>
              </ul>
            </div>
            <div className="rounded-lg border border-black/5 bg-[#faf8f3] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                Topics
              </p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-700">
                <li>Music catalog scouting</li>
                <li>Generative Engine Optimization</li>
                <li>AI visibility &amp; entity SEO</li>
                <li>Instagram outreach at scale</li>
                <li>AI-driven search</li>
              </ul>
            </div>
          </div>

          <p className="mt-10 text-base leading-relaxed text-neutral-600">
            Learn more about Joel at{' '}
            <a
              href="https://joelhouse.com"
              className="font-medium text-[#b8531d] underline-offset-4 hover:underline"
            >
              JoelHouse.com
            </a>
            .
          </p>
        </div>
      </section>

      {/* POSTS BY JOEL */}
      <section className="border-t border-black/5 bg-[#faf8f3] px-4 py-20 md:px-6 md:py-24">
        <div className="mx-auto w-full max-w-4xl">
          <Eyebrow>Articles by Joel House on Praecora</Eyebrow>
          <h2 className="mt-6 text-balance text-3xl font-bold leading-[1.15] tracking-tight text-[#0f0d08] md:text-4xl">
            {visibleCount} articles in the Praecora field guide
          </h2>

          <div className="mt-12 divide-y divide-black/5 border-y border-black/5">
            {posts.map((post) => (
              <AuthorPostRow key={post.slug} post={post} />
            ))}
          </div>

          <div className="mt-10 text-center md:text-left">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-sm font-medium text-neutral-600 transition-colors hover:text-[#0f0d08]"
            >
              Browse the full field guide
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* sameAs surface — visible to humans, also a redundant signal
          for crawlers that don't read JSON-LD */}
      <section className="border-t border-black/5 bg-white px-4 py-16 md:px-6 md:py-20">
        <div className="mx-auto w-full max-w-3xl">
          <Eyebrow>Joel elsewhere</Eyebrow>
          <ul className="mt-8 space-y-3 text-sm">
            {JOEL_HOUSE_SAME_AS.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  className="inline-flex items-center gap-1.5 text-neutral-700 underline-offset-4 hover:text-[#0f0d08] hover:underline"
                >
                  {url.replace(/^https?:\/\/(www\.)?/, '')}
                  <ExternalLink className="h-3.5 w-3.5 text-neutral-400" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}

function AuthorPostRow({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group block py-8">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#b8531d]">
        {PILLAR_LABELS[post.pillar]}
      </p>
      <h3 className="mt-2 text-balance text-xl font-semibold tracking-tight text-[#0f0d08] group-hover:text-[#7a2a0f] md:text-2xl">
        {post.title}
      </h3>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-600">
        {post.description}
      </p>
      <p className="mt-3 text-xs text-neutral-500">
        {post.readingTime} min read
      </p>
    </Link>
  )
}
