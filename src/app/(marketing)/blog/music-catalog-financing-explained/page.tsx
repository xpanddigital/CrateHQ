import type { Metadata } from 'next'
import { BlogPostShell } from '../_components/BlogPostShell'
import { Prose, Callout, Lede, PullQuote } from '../_components/Prose'
import { getPostBySlug } from '../posts'

const post = getPostBySlug('music-catalog-financing-explained')!

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
          Until very recently, music catalog financing was something only
          Bob Dylan and Bruce Springsteen got to use. In the last five
          years, an entire industry has emerged around bringing it to
          independent artists — and almost no one explains how it
          actually works. This is that explanation, in plain English.
        </Lede>

        <p>
          The basic question this piece answers: <em>what does it mean
          when an indie artist gets "catalog financing," and where does
          the money come from?</em>
        </p>

        <p>
          If you've heard about Bob Dylan selling his catalog to Universal
          for $300M, or Bruce Springsteen selling to Sony for $500M, or
          Stevie Nicks's publishing going to Primary Wave, you've heard
          about the major-label version of this market. The big news is
          that since around 2020, an entirely new industry has emerged
          around the same kind of transactions — but built for
          independent artists at much smaller scales. An artist with
          $5K/month in streaming royalties can now access a real catalog
          financing deal, where five years ago they could not.
        </p>

        <p>
          This piece walks through the four product types that exist in
          this market (they're more different than they sound),
          introduces who the buyers are, and explains how a deal
          actually closes. It's aimed at independent artists, managers,
          curious music-industry people, and anyone considering working
          as a catalog scout. We're going to use real company names and
          real numbers throughout.
        </p>

        <h2>What "catalog financing" actually means</h2>

        <p>
          The phrase covers four distinct financial products that share a
          single underlying logic: the artist receives a meaningful sum of
          money now, in exchange for some claim on the future royalty
          income their catalog will generate.
        </p>

        <p>
          The reason a market exists at all: streaming royalties are
          unusually predictable. A song that's done $1,000/month in
          streams for three years will, with high probability, continue
          doing roughly that for the next three years. Streaming income
          decays slowly and predictably. That predictability lets buyers
          underwrite an upfront payment against the expected income
          stream — the way a bank underwrites a mortgage against future
          paycheck.
        </p>

        <p>
          The four product types are:
        </p>

        <h3>1. Royalty advance (most common)</h3>

        <p>
          <strong>What is a royalty advance?</strong> It's a lump-sum
          payment to the artist now, in exchange for assigning some or
          all of their future royalty income to the financier until the
          advance is "recouped" (paid back from those royalties). After
          recoupment, the royalties revert to the artist. It's the most
          common product in the indie catalog finance market in 2026 and
          the default starting point for most artists exploring this
          path.
        </p>

        <p>
          Crucially: <strong>the artist does not lose ownership of their
          catalog</strong>. They keep their masters, their publishing,
          their copyrights. They are just temporarily redirecting royalty
          payments through the financier until the advance is paid back.
          Then it all comes back to them.
        </p>

        <p>
          Typical structure for a 2026 indie deal: advance is 8x–14x the
          artist's annual streaming income, repayment is a 70/30 split of
          incoming royalties (70% goes to the financier toward
          recoupment, 30% continues to the artist), recoupment is
          expected to complete in 5–8 years. The artist gets cash now and
          still earns through the deal period; the financier earns the
          difference between what they paid and what gets recouped, plus
          a margin for their risk.
        </p>

        <p>
          Major players in this product: beatBread, Sound Royalties,
          Symphonic Advances, RoyFi, Royalty Exchange, Indify, and
          increasingly TuneCore and DistroKid via partnerships.
        </p>

        <h3>2. Catalog buyout (true sale)</h3>

        <p>
          The artist sells some or all of their catalog rights outright.
          The buyer permanently owns the rights and collects all future
          royalties from that catalog. The artist receives a single
          larger payment and gives up future royalty income from the
          sold portion.
        </p>

        <p>
          This is the structure you read about in the headlines (Dylan,
          Springsteen, Nicks). At the indie level, full-catalog buyouts
          are less common because artists are generally unwilling to
          permanently relinquish ownership of music they expect to make
          more money from over the long run. More common: partial
          buyouts — selling a percentage of catalog rights or a specific
          revenue stream (publishing, masters, sync rights) while keeping
          others.
        </p>

        <p>
          Major players: Xposure Music, Royalty Exchange (marketplace
          model), Hipgnosis (now Concord), Primary Wave, Round Hill
          (mostly mid-to-large catalogs).
        </p>

        <h3>3. Term advance / structured deal</h3>

        <p>
          A hybrid between the advance and the buyout. The artist
          receives an upfront payment in exchange for a defined-term
          claim on royalties — usually 7–10 years. After the term, all
          rights revert to the artist, regardless of whether the advance
          has been fully recouped. The financier takes the recoupment
          risk; the artist gets a deadline and a clean reversion.
        </p>

        <p>
          This is structurally friendlier to the artist than a pure
          advance (since the artist isn't on the hook beyond the term)
          but typically comes at smaller advance multiples (5x–10x
          annual income) because the financier is bearing more risk.
        </p>

        <p>
          Major players: Xposure Music (their "term advance" product),
          Connect Music, Symphonic (structured deals), Intercept.
        </p>

        <h3>4. Distribution-attached financing</h3>

        <p>
          The artist signs a distribution deal with a digital
          distributor (TuneCore, DistroKid, CD Baby, United Masters, or a
          label-style indie distributor), and the distributor offers
          financing as part of the relationship. The advance is paid
          against future distribution income; the distribution continues
          for the life of the deal.
        </p>

        <p>
          This is a bundled product. The artist often takes it for the
          financing but is also committing to multi-year distribution
          exclusivity. Worth thinking about whether you want the
          financing badly enough to lock in the distribution.
        </p>

        <p>
          Major players: TuneCore (via RoyFi partnership), Symphonic,
          The Orchard (for label-style deals), Believe Music, Stem.
        </p>

        <Callout label="The honest read on which product to pursue">
          <p>
            For most independent artists, the royalty advance (product
            #1) is the right starting point. It's the cleanest structure
            — you keep ownership, you get cash, you pay it back over
            time. Catalog buyouts make sense only when you genuinely want
            to exit the catalog (retiring, switching careers, in a
            personal financial situation that requires it). Term advances
            are a good middle ground if you want the cash without
            committing your catalog forever. Distribution-attached
            financing is usually the last option to consider — you're
            buying two products at once and the bundling rarely benefits
            the artist.
          </p>
        </Callout>

        <h2>What the buyer is actually buying</h2>

        <p>
          To understand the deal from the buyer side: when a financier
          gives an artist a $200K advance against $24K/year in streaming
          royalties, they're effectively buying a 10-ish-year claim on
          that royalty stream, with some additional margin for risk.
          They're betting that:
        </p>

        <ul>
          <li>
            The catalog's income won't decline significantly over the
            recoupment period
          </li>
          <li>
            The artist won't pull their music from streaming services
            (most deals contractually prevent this)
          </li>
          <li>
            No legal/ownership disputes will arise (clean copyright is a
            diligence requirement)
          </li>
          <li>
            Their underwriting model is roughly right about the catalog's
            long-term value
          </li>
        </ul>

        <p>
          The financier earns the spread between what they paid out and
          what they recoup. They take the risk that the catalog
          underperforms, and the artist's potential upside if the
          catalog overperforms (until recoupment is hit and royalties
          revert).
        </p>

        <p>
          This is why the financier cares so much about catalog
          predictability. A track that hits and fades quickly is a
          worse asset than a track that's done steady moderate streams
          for three years. The latter has demonstrated half-life; the
          former might be Q1 of a decay curve. Buyers underwrite to the
          half-life, not the peak.
        </p>

        <h2>How a deal actually gets done</h2>

        <p>
          A typical indie catalog financing deal in 2026 moves through
          roughly seven stages, taking 4–8 weeks end to end:
        </p>

        <ol>
          <li>
            <strong>First conversation.</strong> The artist learns about
            the product, usually through a scout or directly with the
            buyer's deal-flow team. Initial fit check based on monthly
            streaming income and catalog size.
          </li>
          <li>
            <strong>Initial qualification.</strong> The artist shares
            their last 90 days of streaming data (via Spotify for
            Artists, Apple Music for Artists, or a distributor royalty
            report) so the buyer can pre-qualify the size of an offer.
          </li>
          <li>
            <strong>Indicative offer.</strong> The buyer comes back with
            a non-binding indicative offer: estimated advance range, the
            structure (royalty advance vs. term advance), and the
            recoupment terms. The artist decides whether the conversation
            is worth continuing.
          </li>
          <li>
            <strong>Term sheet.</strong> If the artist wants to proceed,
            the buyer issues a non-binding term sheet with specific
            numbers. Negotiation happens here — advance amount,
            recoupment percentage, royalty split, term length, any
            geographic or platform exclusions.
          </li>
          <li>
            <strong>Diligence.</strong> The buyer's team requests detailed
            royalty statements (typically 12–24 months of distributor
            statements), runs catalog metadata audits (do you actually
            own these tracks?), and confirms no co-writer or label
            disputes exist. Takes 2–4 weeks. This is where most deals
            die — paperwork attrition, undiscovered co-ownership
            complications, or the artist losing momentum.
          </li>
          <li>
            <strong>Definitive agreement.</strong> The actual legally
            binding contract. The artist typically engages a music
            lawyer for this stage (or uses the scout's recommended
            counsel). Negotiation continues on specific contract terms
            even after the term sheet is signed.
          </li>
          <li>
            <strong>Funding.</strong> Wire transfer of the advance to the
            artist. Typically 7–14 days after definitive agreement
            signature. Scout commission is paid by the buyer within 30–60
            days of funding.
          </li>
        </ol>

        <p>
          Realistic timeline: 4 weeks for fast clean deals, 8 weeks for
          typical deals, 12+ weeks when complications arise. Diligence is
          the time sink. We have a dedicated piece on closing-stage
          mechanics coming in the field guide; for now, the rule of
          thumb is that any scout or artist should plan for 6 weeks and
          be pleasantly surprised if it's faster.
        </p>

        <h2>What makes a catalog financeable</h2>

        <p>
          Not every indie artist qualifies for catalog financing. The
          common deal-breakers and qualifiers, gathered from
          underwriting criteria across the major buyers:
        </p>

        <h3>The minimum-streaming floor</h3>

        <p>
          Most buyers require somewhere around $500–$2,000/month in
          monthly streaming royalties as a floor. Some go lower (RoyFi,
          some Symphonic deals) for artists with strong growth
          trajectory; some require higher ($5,000+/month for the
          larger structured deals at Xposure or Connect Music). The floor
          exists because deals smaller than ~$25K advance aren't
          operationally worth the diligence cost on either side.
        </p>

        <h3>The trajectory check</h3>

        <p>
          Income trajectory matters as much as absolute income. A
          catalog doing $3K/month with steady-to-slight-growth over the
          last 12 months is more financeable than a catalog doing
          $5K/month that peaked 18 months ago and is declining. Buyers
          underwrite to expected income over the next 5–8 years, so
          decay rates matter.
        </p>

        <h3>Ownership cleanliness</h3>

        <p>
          The artist needs to own the rights they're financing. This is
          obvious in principle but messy in practice: most indie artists
          have at least some co-writers, some producers with points,
          some label-affiliated tracks, some sync-restricted material,
          and some grey-area collabs from earlier in their career. The
          deal is structured around the cleanly-owned portion of the
          catalog. Tracks with unresolved ownership get excluded.
        </p>

        <h3>Genre and platform considerations</h3>

        <p>
          Some genres have more buyer interest than others. Indie rock,
          alternative R&B, indie folk, ambient electronic, and Latin
          alternative all have multiple buyers actively underwriting.
          Lo-fi hip hop, ambient instrumental, and meditation music are
          more variable — some buyers love them (predictable streams),
          some avoid them (lower per-stream royalty rates due to
          background-music consumption patterns).
        </p>

        <h3>The artist themselves</h3>

        <p>
          Buyers underwrite the catalog more than the artist, but the
          artist matters at the margins. Is the artist still releasing
          new music (catalog growth)? Are they actively touring (which
          drives streaming)? Is there a pending album that might change
          the trajectory? Is there reputational risk in the artist's
          public profile? These adjust the offer at the edges.
        </p>

        <h2>Who the buyers are</h2>

        <p>
          We maintain a more comprehensive working directory in our
          piece on the{' '}
          <a href="/blog/music-catalog-buyer-directory-2026">
            music catalog buyer directory
          </a>
          , but the short version of who's active in the indie market in
          2026:
        </p>

        <ul>
          <li>
            <strong>beatBread</strong> — the largest indie-focused
            advance platform. Deployed $100M+ across 1,700 deals since
            2020. Royalty advance product. Indie-friendly underwriting.
          </li>
          <li>
            <strong>Xposure Music</strong> — Montreal-based, $42M+ in
            recent capital raises. Selective; offers higher multiples on
            premium catalogs. Both advance and buyout products.
          </li>
          <li>
            <strong>Connect Music</strong> — $80M raise in 2026.
            Multi-product. Strong in mid-to-large indie deals.
          </li>
          <li>
            <strong>RoyFi</strong> — partnered with TuneCore. Fast,
            transparent advances for distributor-active artists.
            Indie-friendly minimum sizes.
          </li>
          <li>
            <strong>Symphonic Advances</strong> — distribution-attached
            financing through the Symphonic distribution network.
            Established player.
          </li>
          <li>
            <strong>Sound Royalties</strong> — one of the originals in
            the indie advance space. Royalty-collateralized funding.
          </li>
          <li>
            <strong>Royalty Exchange</strong> — marketplace model.
            Artists list catalog assets; investors bid. Less common path
            but works for some profiles.
          </li>
          <li>
            <strong>Intercept</strong> — $50M raise for indie catalog
            acquisitions. Growing presence.
          </li>
          <li>
            <strong>Futures Music Group</strong> — $6M raise for indie
            label and catalog deals.
          </li>
        </ul>

        <p>
          That's the active core. There are another 10–15 smaller funds,
          family offices, and niche players who place capital in this
          space; we cover them in the buyer directory.
        </p>

        <PullQuote>
          The catalog stays yours. The cash arrives now. The royalties
          pay it back. That's the deal.
        </PullQuote>

        <h2>The valuation math, simplified</h2>

        <p>
          A common question: how much will an artist actually get
          offered? The math, simplified:
        </p>

        <p>
          The base formula is{' '}
          <strong>advance = annual net royalty income × multiple</strong>
          , where the multiple ranges from 5x to 14x for indie deals
          (versus 14x–24x for blue-chip catalogs at major-label scale).
        </p>

        <p>
          Multiples are adjusted up or down based on:
        </p>

        <ul>
          <li>
            <strong>Catalog age + decay rate.</strong> Older catalogs
            with proven slow decay get higher multiples. New tracks
            still on the climb get lower multiples (the buyer is taking
            more uncertainty about the long-term curve).
          </li>
          <li>
            <strong>Catalog size and diversity.</strong> A catalog of
            30 tracks earning across many of them gets a higher multiple
            than a catalog where one track does 90% of the income (single-
            track concentration is risky).
          </li>
          <li>
            <strong>Sync history.</strong> Tracks that have been
            synced (in TV, film, ads) signal long-term licensing
            potential and earn a premium.
          </li>
          <li>
            <strong>Genre.</strong> Genres with platform-favored
            consumption patterns (active listening, full-track plays)
            outperform background-listening genres on per-stream
            royalty.
          </li>
          <li>
            <strong>Artist trajectory.</strong> Steady-growth artists
            get higher multiples than peaked-and-declining ones.
          </li>
        </ul>

        <p>
          Worked example: An indie folk artist with $36K/year in
          streaming royalties ($3K/month), a 4-year catalog of 28
          tracks, two prior sync placements, and steady year-over-year
          growth. Realistic offer range: 10x–12x = $360K–$432K advance,
          recoupment over ~8 years on a 70/30 split.
        </p>

        <p>
          Same artist, but with one track doing 80% of income and the
          rest declining: probably 6x–8x = $216K–$288K, longer
          recoupment, possibly term-limited structure to protect the
          buyer from concentration risk.
        </p>

        <h2>The risks artists should understand</h2>

        <p>
          We've covered why these deals can be attractive to artists.
          Worth being honest about where they can go wrong:
        </p>

        <h3>The advance is a real obligation</h3>

        <p>
          Even though it's not technically a loan (you're not personally
          liable beyond your catalog), the royalty assignment is
          enforceable. If your catalog underperforms badly, recoupment
          will take longer than expected, and you'll be receiving the
          lower-percentage split of your royalties for that whole period.
          Not a disaster, but worth modeling.
        </p>

        <h3>Some structures restrict your behavior</h3>

        <p>
          Most deals contractually prevent you from pulling your music
          from streaming platforms, re-recording the catalog, or
          assigning rights to a competing party. Read these clauses
          carefully — they're enforceable.
        </p>

        <h3>Tax treatment varies</h3>

        <p>
          Whether the advance is treated as ordinary income (taxed now)
          or as proceeds against future income (taxed as royalties come
          in) depends on the deal structure and your jurisdiction. Talk
          to an accountant before signing — surprise tax bills on a $200K
          advance hurt.
        </p>

        <h3>Bad deals exist</h3>

        <p>
          Not every offer is a fair offer. Multiples that look low,
          recoupment splits that look aggressive (90/10 instead of
          70/30), term structures that lock you in for 15 years — all
          exist in the market. The presence of multiple credible buyers
          (which is the case in 2026) is your protection. Get more than
          one quote.
        </p>

        <h2>For scouts and brokers: where you fit</h2>

        <p>
          The role of the catalog scout is to find the artists who would
          benefit from this kind of deal and to route them to the right
          buyer for their catalog profile. Scouts source on commission —
          typically 10% of the closed advance, paid by the buyer. This
          is a real career path with a meaningful income ceiling for the
          right operators; we cover the full economics in our piece on
          the{' '}
          <a href="/blog/music-catalog-financing-broker-playbook">
            music catalog financing broker playbook
          </a>
          .
        </p>

        <h2>The bottom line</h2>

        <p>
          Music catalog financing in 2026 is a mature, well-capitalized,
          and competitive market. For independent artists with
          predictable streaming income, it's a legitimate option for
          accessing meaningful upfront capital without losing ownership.
          The four product types serve different needs; the four-to-
          eight-week deal timeline is real; the buyer landscape is
          diverse enough that fair-market offers are available to most
          qualified catalogs.
        </p>

        <p>
          If you're an artist considering this for yourself, the next
          step is usually to pull your last 12 months of royalty
          statements and reach out to two or three buyers from the list
          above for indicative offers. If you're a scout considering
          this work, see our{' '}
          <a href="/blog/music-catalog-financing-broker-playbook">
            broker playbook
          </a>{' '}
          and the{' '}
          <a href="/blog/music-catalog-buyer-directory-2026">
            buyer directory
          </a>
          .
        </p>

        <p>
          Praecora builds the infrastructure for the scout side of this
          market — the Instagram outreach, the unified inbox, the deal
          pipeline. <a href="/demo">Book a 20-minute demo</a> if you'd
          like to see how the sourcing side actually operates day-to-day.
        </p>
      </Prose>
    </BlogPostShell>
  )
}
