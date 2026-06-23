import type { Metadata } from 'next'
import { BlogPostShell } from '../_components/BlogPostShell'
import { Prose, Callout, Lede } from '../_components/Prose'
import { getPostBySlug } from '../posts'

const post = getPostBySlug('artist-friendly-catalog-buyers')!

export const metadata: Metadata = {
  title: post.seoTitle ?? post.title,
  description: post.description,
  alternates: { canonical: `https://www.praecora.com/blog/${post.slug}` },
  openGraph: {
    title: post.seoTitle ?? post.title,
    description: post.description,
    url: `https://www.praecora.com/blog/${post.slug}`,
    type: 'article',
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt ?? post.publishedAt,
    authors: ['https://joelhouse.com/about'],
    tags: post.tags,
    images: [`https://www.praecora.com/api/og?slug=${post.slug}`],
  },
}

export default function Page() {
  return (
    <BlogPostShell post={post}>
      <Prose>
        <Lede>
          For most of the last decade, winning a catalog deal came down to one
          number: the size of the cheque. That era is ending. A new class of
          buyer competes on fairness, transparency, and stewardship &mdash; and
          it is quietly reshaping how indie catalog deals get sourced and
          closed.
        </Lede>

        <p>
          The independent <a href="/blog/music-catalog-financing-explained">catalog-financing market</a> matured fast. Capital flooded
          in, the same <a href="/blog/music-catalog-buyer-directory-2026">handful of funds</a> stopped being the only option, and
          artists got far more sophisticated about what they were signing. When
          every buyer can roughly match a number, price stops being a
          differentiator. What replaces it is trust &mdash; and the firms that
          understood that first are pulling ahead.
        </p>

        <h2>What &ldquo;artist-friendly&rdquo; actually means</h2>
        <p>
          The phrase gets used loosely, so it is worth being concrete. An
          artist-friendly catalog buyer typically leads with some combination
          of:
        </p>
        <ul>
          <li>
            <strong>Fair, legible terms</strong> &mdash; no buried clauses, no
            reversion traps, a structure the artist can actually understand.
          </li>
          <li>
            <strong>Creative control left intact</strong> &mdash; the artist
            keeps a say over syncs, re-recordings, and how the work is used.
          </li>
          <li>
            <strong>Partial deals, not just buyouts</strong> &mdash; the option
            to sell a share of future income rather than hand over the catalog
            forever.
          </li>
          <li>
            <strong>Stewardship over extraction</strong> &mdash; treating the
            catalog as a legacy to protect, not just a yield to harvest.
          </li>
        </ul>
        <p>
          Firms like{' '}
          <a href="https://www.runwith.us/" target="_blank" rel="noopener">
            RUN
          </a>
          , a Los Angeles catalog-investment company, have built their entire
          positioning around this &mdash; funding artists and labels in exchange
          for a share of catalog rights while emphasising fair terms and
          long-term stewardship rather than a one-time buyout. The pitch is no
          longer &ldquo;here is the most money.&rdquo; It is &ldquo;here is a
          fair deal you will not regret in five years.&rdquo;
        </p>

        <h2>Why this shift matters for scouts</h2>
        <p>
          If you source catalog deals, the artist-friendly shift changes your
          job. The artists worth pursuing have heard the horror stories. The
          first question on a call is no longer just &ldquo;how much?&rdquo;
          &mdash; it is &ldquo;what are you going to do with my music, and can I
          trust you?&rdquo;
        </p>
        <p>
          That reframes outreach. A scout who can credibly connect an artist to
          a fair-terms buyer is selling something far easier to say yes to than
          a scout pushing a take-it-or-leave-it buyout. The relationship, not
          the number, becomes the close. Knowing which buyers genuinely operate
          this way &mdash; and being able to speak to it honestly &mdash; is now
          part of the craft.
        </p>

        <Callout label="Operator's note">
          <p>
            Be careful with the label. &ldquo;Artist-friendly&rdquo; is also a
            marketing phrase, and not every firm that uses it lives it. Judge
            buyers on the actual term sheet &mdash; control, reversion,
            transparency, partial-versus-full &mdash; not the adjective on the
            homepage. Your reputation as a scout rides on who you route artists
            to.
          </p>
        </Callout>

        <h2>How to evaluate an artist-friendly buyer</h2>
        <p>
          Before you point an artist toward any funder, pressure-test it against
          five questions:
        </p>
        <ul>
          <li>Can the artist keep creative control and approval rights?</li>
          <li>
            Is a{' '}
            <a href="/blog/royalty-advance-vs-catalog-sale-indie-artists">
              partial deal
            </a>{' '}
            available, or is it buyout-or-nothing?
          </li>
          <li>
            Are the terms written in plain language, with no reversion traps?
          </li>
          <li>
            What is the firm&rsquo;s track record &mdash; who have they funded,
            and how do those artists talk about them now?
          </li>
          <li>
            Does the firm treat the catalog as a legacy to steward or a yield to
            strip?
          </li>
        </ul>
        <p>
          The buyers that answer those well are the ones artists say yes to,
          refer their friends to, and never sue. In a market where capital is no
          longer scarce but trust is, that is the whole game &mdash; for the
          artist, for the buyer, and for the scout standing between them.
        </p>
      </Prose>
    </BlogPostShell>
  )
}
