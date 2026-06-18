import type { Metadata } from 'next'
import { BlogPostShell } from '../_components/BlogPostShell'
import { Prose, Callout, Lede, PullQuote } from '../_components/Prose'
import { getPostBySlug } from '../posts'

export const revalidate = 3600

const post = getPostBySlug('independent-music-distribution-vs-catalog-buyers')!

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
          TuneCore, DistroKid, CD Baby — distributors. beatBread,
          Symphonic Advances, Xposure Music — catalog buyers. The two
          categories blur in confusing ways, and indie artists who
          conflate them end up making the wrong decision in both
          directions. Here's the clean breakdown.
        </Lede>

        <p>
          For independent artists trying to navigate the music
          industry's infrastructure layer, two categories of company
          come up over and over: <strong>independent music
          distribution companies</strong> (TuneCore, DistroKid, CD
          Baby, etc.) and <strong>music catalog buyers / financiers</strong>{' '}
          (beatBread, Symphonic Advances, Xposure, etc.). They sound
          like adjacent things; they do different jobs; and the right
          choice for one isn't a substitute for the other.
        </p>

        <p>
          This piece is the clean breakdown — what each category does,
          how they overlap, where the confusion comes from, and what
          indie artists (and the scouts who source for them) should
          actually understand about how the two interact.
        </p>

        <h2>What independent music distribution companies do</h2>

        <p>
          Distributors are the plumbing that gets your music onto
          streaming platforms. Spotify, Apple Music, Amazon Music,
          YouTube Music, TIDAL, Deezer, etc., don't accept music
          directly from independent artists — they accept it via
          approved distributors, who handle the metadata,
          ingestion, royalty collection, and payout to the artist.
        </p>

        <p>
          The job: distribution + royalty collection.
        </p>

        <p>
          Major players:
        </p>

        <ul>
          <li>
            <strong>DistroKid</strong> — $22.99/year unlimited
            releases. Most popular among indie artists.
          </li>
          <li>
            <strong>TuneCore</strong> — $14.99/album/year. Established,
            offers more services beyond pure distribution.
          </li>
          <li>
            <strong>CD Baby</strong> — one-time fee per release, also
            handles physical distribution. Older school.
          </li>
          <li>
            <strong>Symphonic Distribution</strong> — premium-tier
            indie distributor with more bundled services. Often used
            by indie labels.
          </li>
          <li>
            <strong>United Masters</strong> — distribution + brand
            partnership angle.
          </li>
          <li>
            <strong>AWAL (Sony)</strong> — selective distributor
            offering label-style services to invited artists.
          </li>
          <li>
            <strong>The Orchard (Sony)</strong> — label-services
            distributor, more enterprise.
          </li>
          <li>
            <strong>Believe</strong> — TuneCore's parent; runs label-
            services distribution at multiple tiers.
          </li>
          <li>
            <strong>Stem</strong> — distribution + royalty splits
            built in.
          </li>
        </ul>

        <p>
          The business model: artists pay distributors (typically
          $20–$50/year) for distribution. Distributors collect royalties
          from streaming platforms and pay them through to artists,
          sometimes taking a small commission.
        </p>

        <p>
          What artists get: their music on every major streaming
          platform; royalty collection; analytics and reporting tools;
          sometimes additional services (sync licensing,
          publishing administration, marketing tools).
        </p>

        <h2>What catalog buyers / financiers do</h2>

        <p>
          Catalog buyers (and royalty financiers more broadly) are
          investors who pay artists upfront cash in exchange for some
          claim on the artist's future royalty income.
        </p>

        <p>
          The job: provide capital to artists against future earnings.
        </p>

        <p>
          Major players:
        </p>

        <ul>
          <li>
            <strong>beatBread</strong> — royalty advances, indie-
            friendly underwriting
          </li>
          <li>
            <strong>Symphonic Advances</strong> — royalty advances,
            distribution-attached
          </li>
          <li>
            <strong>Xposure Music</strong> — term advances and partial
            buyouts for premium catalogs
          </li>
          <li>
            <strong>Connect Music</strong> — multi-product, mid-to-
            large indie deals
          </li>
          <li>
            <strong>RoyFi</strong> — small-deal advances, TuneCore-
            integrated
          </li>
          <li>
            <strong>Sound Royalties</strong> — established royalty-
            backed financing
          </li>
          <li>
            <strong>Royalty Exchange</strong> — marketplace model
          </li>
          <li>
            <strong>Indify</strong> — release-funding marketplace
          </li>
          <li>
            <strong>Concord, Primary Wave, Round Hill, Intercept</strong>{' '}
            — larger institutional catalog acquirers
          </li>
        </ul>

        <p>
          The business model: artists receive upfront cash. The buyer
          collects royalties (via the artist's distributor) until the
          advance is recouped, then royalties revert to the artist.
          For pure buyouts, the buyer keeps the royalties permanently.
        </p>

        <p>
          What artists get: a meaningful lump-sum payment now, in
          exchange for temporarily redirecting royalty cash flow (or,
          for buyouts, permanently transferring rights).
        </p>

        <p>
          For the full breakdown of the buyer landscape, see our piece
          on the{' '}
          <a href="/blog/music-catalog-buyer-directory-2026">
            music catalog buyer directory
          </a>
          . For the financial product details, see{' '}
          <a href="/blog/music-catalog-financing-explained">
            music catalog financing explained
          </a>
          .
        </p>

        <h2>Where the categories overlap (and confuse people)</h2>

        <p>
          Three overlap zones cause most of the confusion:
        </p>

        <h3>1. Some distributors offer financing</h3>

        <p>
          TuneCore partners with RoyFi to offer advances directly
          inside the TuneCore product. Symphonic's distribution arm
          and their Symphonic Advances financing product are integrated.
          AWAL and The Orchard both offer label-style financing to
          select roster artists.
        </p>

        <p>
          What this means: when an artist signs up for distribution
          through one of these providers, they may be offered an
          advance as part of the same account. The advance is from
          the financing arm; the distribution is from the
          distribution arm. They share branding, but they're separate
          financial products.
        </p>

        <p>
          The confusion: artists assume "I distribute through TuneCore,
          so RoyFi is my only advance option." It's not. Artists
          distributing through TuneCore can still take advances from
          beatBread, Xposure, or anyone else who'll underwrite their
          catalog. The choice isn't locked to your distributor.
        </p>

        <h3>2. Some buyers require distribution switches</h3>

        <p>
          Some catalog financing deals are conditional on switching
          distribution to the buyer's preferred partner. Symphonic
          deals often route through Symphonic Distribution. Some
          larger label-style deals route through The Orchard or AWAL.
        </p>

        <p>
          What this means: taking the advance also commits the artist
          to a multi-year distribution arrangement. The economics need
          to be evaluated together, not separately.
        </p>

        <h3>3. Catalog "buyouts" affect distribution mechanics</h3>

        <p>
          When an artist sells their catalog (or part of it) outright,
          the royalty stream redirects to the buyer permanently. The
          artist's existing distributor may need updated splits, or
          the buyer may transfer distribution to a different provider.
          The two systems have to talk to each other.
        </p>

        <h2>The honest read for indie artists</h2>

        <p>
          For artists thinking about either category, three principles:
        </p>

        <h3>Distribution is operational; financing is strategic</h3>

        <p>
          Distribution is a service you need to release music at all.
          Pick a distributor based on price, services, payout speed,
          and what platforms you need access to. The choice is
          relatively low-stakes — you can switch distributors fairly
          easily.
        </p>

        <p>
          Financing is a multi-year financial commitment that affects
          your income for years. Pick a buyer based on offer quality,
          deal terms, recoupment structure, and ownership preservation.
          The choice has long tail consequences.
        </p>

        <h3>Don't conflate cheap distribution with cheap financing</h3>

        <p>
          DistroKid distribution at $23/year is great. That doesn't
          mean financing options offered through DistroKid (or any
          distributor) are necessarily the best financing terms
          available. They might be. They also might not be. Shop
          financing offers across multiple buyers regardless of who
          your distributor is.
        </p>

        <h3>Bundled offers deserve careful evaluation</h3>

        <p>
          When a deal bundles distribution + financing + marketing
          services + sync representation, the total economics matter,
          not any single line item. Sometimes bundled deals are
          excellent (one operational point of contact, integrated
          royalty tracking). Sometimes they're worse than the
          unbundled version (you're paying premium for services you
          could get cheaper standalone). Calculate the total.
        </p>

        <Callout label="A worked example">
          <p>
            Artist with $36K/year in streaming royalties is offered:
            (A) a $300K royalty advance from beatBread, distribution
            stays with their existing DistroKid account; OR (B) a
            $280K advance bundled with a Symphonic distribution
            switch and additional services. The math: B's services
            might be worth $5K/year (sync rep, marketing tools, etc.),
            which over 5 years is $25K. B's advance is $20K lower than
            A's. Roughly equivalent total — but A preserves more
            flexibility because the distribution stays standalone.
            Honest evaluation says: pick A unless the services are
            specifically valuable to this artist's situation.
          </p>
        </Callout>

        <h2>For scouts: how distribution status affects deal flow</h2>

        <p>
          Scouts sourcing catalog finance deals need to know what
          distributor each prospective artist uses. Reasons:
        </p>

        <ul>
          <li>
            <strong>Some buyers prefer integrated distribution.</strong>{' '}
            Symphonic prefers Symphonic-distributed catalogs. RoyFi
            integrates with TuneCore. Knowing the artist's distributor
            tells you which buyer is the best first call.
          </li>
          <li>
            <strong>Royalty statement access varies by distributor.</strong>{' '}
            Some distributors export clean royalty statements artists
            can share for diligence; others are clunkier. This affects
            deal velocity.
          </li>
          <li>
            <strong>Some artists are locked into label-style
            contracts</strong> through their distributor (AWAL, The
            Orchard). These artists may have less flexibility on
            catalog financing because their label has contractual
            claims.
          </li>
        </ul>

        <PullQuote>
          Distribution is the plumbing. Catalog financing is the
          financing. Don't let one company convince you the two
          choices are linked when they don't have to be.
        </PullQuote>

        <h2>The bottom line</h2>

        <p>
          Independent music distribution companies (TuneCore,
          DistroKid, CD Baby, Symphonic Distribution, AWAL, The
          Orchard, Believe, Stem) handle the operational job of
          getting music onto streaming platforms and collecting
          royalties.
        </p>

        <p>
          Music catalog buyers (beatBread, Symphonic Advances,
          Xposure, Connect Music, RoyFi, Sound Royalties, and others)
          provide capital to artists in exchange for claims on future
          royalty income.
        </p>

        <p>
          The two categories overlap in three places: some
          distributors offer financing, some financing deals require
          distribution switches, and catalog buyouts affect
          distribution mechanics. The right decision in each category
          is independent — pick distribution operationally, pick
          financing strategically, and don't let bundled offers
          obscure the underlying economics.
        </p>

        <p>
          For more on the financing side, see{' '}
          <a href="/blog/music-catalog-financing-explained">
            music catalog financing explained
          </a>{' '}
          and{' '}
          <a href="/blog/music-catalog-buyer-directory-2026">
            the buyer directory
          </a>
          . For the scout's perspective on routing deals, see the{' '}
          <a href="/blog/music-catalog-financing-broker-playbook">
            broker playbook
          </a>
          .
        </p>

        <p>
          Praecora supports catalog scouts sourcing deals across the
          full buyer landscape regardless of which distributor each
          artist uses. <a href="/demo">Book a 20-minute demo</a> to
          see how the integrated qualification + routing flow works
          in practice.
        </p>
      </Prose>
    </BlogPostShell>
  )
}
