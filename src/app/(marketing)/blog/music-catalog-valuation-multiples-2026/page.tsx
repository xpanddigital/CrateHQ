import type { Metadata } from 'next'
import { BlogPostShell } from '../_components/BlogPostShell'
import { Prose, Callout, Lede, PullQuote } from '../_components/Prose'
import { getPostBySlug } from '../posts'

export const revalidate = 3600

const post = getPostBySlug('music-catalog-valuation-multiples-2026')!

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
          The same artist with $24K/year in streaming income gets a
          $288K offer from one buyer and a $144K offer from another.
          The difference isn't randomness — it's how each buyer reads
          the catalog's underwriting profile. Here's the multiple
          math, transparent.
        </Lede>

        <p>
          Every indie catalog finance deal in 2026 starts with one
          number: the multiple. Take the artist's annual net royalty
          income, multiply by some factor between 5 and 14, and
          you've got the advance offer. The factor — the multiple — is
          where the actual underwriting work happens. Higher multiples
          mean the buyer believes the catalog will generate stable
          income for longer; lower multiples mean the buyer is hedging
          against decay risk.
        </p>

        <p>
          For artists trying to evaluate offers, scouts trying to set
          expectations, and operators trying to qualify catalogs, the
          ability to estimate a fair multiple is critical. This piece
          breaks down what drives the multiple up, what drives it
          down, and the practical math on what indie catalogs are
          worth in 2026.
        </p>

        <h2>The base formula</h2>

        <p>
          The fundamental equation is straightforward:
        </p>

        <p>
          <strong>Advance = (Annual Net Royalty Income) × Multiple</strong>
        </p>

        <p>
          For independent catalogs in 2026, multiples fall in a
          consistent range:
        </p>

        <ul>
          <li>
            <strong>5x–7x:</strong> emerging or risky catalogs.
            Concentrated income, declining trajectory, short history,
            unusual genre exposure.
          </li>
          <li>
            <strong>8x–11x:</strong> typical indie catalog band. Stable
            multi-year streaming income, diverse track contributions,
            reasonable growth or stability.
          </li>
          <li>
            <strong>12x–14x:</strong> premium indie. Strong growth
            trajectory, multi-year proven income, sync history,
            geographic spread, audience stickiness.
          </li>
          <li>
            <strong>14x–18x:</strong> mid-tier label-affiliated or
            high-quality indie with proven 5+ year stability.
          </li>
          <li>
            <strong>18x–24x:</strong> blue-chip legacy catalogs. Bob
            Dylan, Bruce Springsteen tier. Not relevant for typical
            indie scouting.
          </li>
        </ul>

        <p>
          Most indie scout deals close in the 8x–12x band. Premium
          deals at the high end. Concentration-risk deals at the low
          end.
        </p>

        <Callout label="What 'annual net royalty income' actually means">
          <p>
            Not gross streams or gross plays. Net royalty income after
            distributor cuts. For a Spotify-active indie artist with a
            standard distributor, this is roughly the dollar amount
            that arrives in the artist's bank account after the
            distributor takes their share. It's the number on the
            artist's royalty statements, not the platform-side gross.
          </p>
        </Callout>

        <h2>What drives the multiple up</h2>

        <h3>Income trajectory</h3>

        <p>
          The single biggest input. Buyers underwrite to expected
          income over the next 5–8 years; a catalog growing 15% YoY
          gets a meaningfully higher multiple than one declining 10%
          YoY, even if their current annual income is identical.
          Year-over-year growth of +10% to +25% is the sweet spot —
          high enough to suggest staying power, not so high that
          you're paying for a viral spike that will normalize.
        </p>

        <p>
          Typical multiple adjustments:
        </p>

        <ul>
          <li>Strong growth (+25%+ YoY): +1–2x adjustment up</li>
          <li>Steady (-5% to +10% YoY): baseline multiple</li>
          <li>Moderate decline (-15% to -5%): -1x adjustment down</li>
          <li>Sharp decline (-25%+ YoY): -2–3x adjustment down or rejection</li>
        </ul>

        <h3>Catalog depth and revenue diversification</h3>

        <p>
          A 30-track catalog with revenue spread across many tracks
          gets a higher multiple than a 10-track catalog where one
          track does 80% of streams. Single-track concentration is
          treated as concentrated risk — if the dominant track decays
          fast, the catalog's economics collapse.
        </p>

        <p>
          Rule of thumb: top track should be no more than 30–40% of
          catalog income for healthy multiples. Above 60%, expect
          discount.
        </p>

        <h3>Catalog age</h3>

        <p>
          Older catalogs with proven decay rates are easier to
          underwrite than new catalogs. A track that's earned
          $5K/month for 4 years has demonstrated half-life; a track
          that's earned $5K/month for 4 months hasn't. Buyers
          discount the latter because the curve is unknown.
        </p>

        <ul>
          <li>5+ years of catalog history: full multiple</li>
          <li>3–5 years: slight discount on the unproven portion</li>
          <li>1–3 years: meaningful discount; multiple often capped at 8–10x</li>
          <li>Under 1 year: rarely financeable as a pure royalty advance</li>
        </ul>

        <h3>Sync history</h3>

        <p>
          Tracks that have been placed in TV, film, video games, or
          ad campaigns earn a sync premium. Sync income is more
          predictable than streaming and tends to be repeat business
          — once a track has synced, it's more likely to sync again.
          One or two prior placements can move the multiple meaningfully
          up.
        </p>

        <p>
          Typical adjustment: +0.5x to +1.5x multiple for proven sync
          history.
        </p>

        <h3>Geographic and platform diversification</h3>

        <p>
          A catalog whose streams come from 30+ countries gets a
          higher multiple than one concentrated in a single market.
          Similarly, multi-platform exposure (Spotify + Apple Music +
          YouTube + others) beats Spotify-only.
        </p>

        <p>
          Why: platform-specific risk. If a single platform changes
          its royalty model unfavorably (which has happened multiple
          times), a single-platform catalog gets hit hard. Diversified
          catalogs absorb the change better.
        </p>

        <h3>Audience quality (listener-to-follower ratio, engagement)</h3>

        <p>
          A catalog driven by passionate fans (high follower count,
          high engagement, low listener-to-follower ratio) gets a
          higher multiple than one driven by passive playlist
          consumption. Fan-driven catalogs decay more slowly because
          fans return; playlist-driven catalogs decay faster because
          the algorithm moves on.
        </p>

        <h3>Genre</h3>

        <p>
          Some genres earn more per stream and get higher multiples
          accordingly. Active-listening genres (indie rock, alt-R&B,
          indie folk, alternative) earn ~$3–$5 per 1,000 US Spotify
          streams gross. Background/ambient genres (lo-fi instrumental,
          meditation, white noise) earn meaningfully less per stream
          because they get skipped more or aren't full-track plays.
          Same number of streams = different royalty = different
          multiple.
        </p>

        <h2>What drives the multiple down</h2>

        <h3>Income concentration in a viral hit</h3>

        <p>
          The most common reason for a low multiple. A catalog whose
          income is 80%+ one track that hit virally 18 months ago is
          treated as a one-hit-wonder structure. Even if the absolute
          income is large, the decay risk on that single track means
          the multiple drops to 5x–7x or the deal restructures around
          a shorter term.
        </p>

        <h3>Sharp recent decline</h3>

        <p>
          Catalogs trending down 25%+ year-over-year are hard to
          underwrite at any meaningful multiple. The math says: if
          this catalog earns $24K this year, the projection says it
          earns $18K next year, $13K the year after. The multiple
          collapses because the integral of future earnings is small.
          Often the buyer just declines.
        </p>

        <h3>Ownership complications</h3>

        <p>
          Co-writer splits, label-owned masters, sync-restricted
          tracks, sample clearance issues — any complication that
          reduces the artist's clean ownership stake reduces the
          financeable portion of the catalog. The multiple applies
          only to the clean-owned portion, not the gross income.
        </p>

        <h3>Short history with high volatility</h3>

        <p>
          A catalog earning $30K/year that bounced between $5K and
          $80K across the months is harder to underwrite than one
          earning $30K/year stably. Volatility is uncertainty;
          uncertainty depresses the multiple.
        </p>

        <h3>Manager / label conflicts</h3>

        <p>
          Outstanding contracts with managers, label-style
          relationships with unclear terms, or ongoing legal disputes
          all reduce buyer willingness. Some deals close anyway but
          at lower multiples to compensate for the diligence overhead
          and risk.
        </p>

        <h2>Three worked examples</h2>

        <h3>Example 1: Clean indie folk artist</h3>

        <ul>
          <li>Annual net royalty income: $48K</li>
          <li>Catalog: 22 tracks, 4 years old, no single track over 25% of income</li>
          <li>Trajectory: +12% YoY for 3 years</li>
          <li>Sync history: one TV placement, one ad</li>
          <li>Audience: 60K monthly Spotify listeners, healthy engagement</li>
        </ul>

        <p>
          Expected multiple: 11x–13x. Advance: $528K–$624K. Recoupment
          on a 70/30 split: ~6–7 years.
        </p>

        <h3>Example 2: One-hit electronic artist</h3>

        <ul>
          <li>Annual net royalty income: $60K</li>
          <li>Catalog: 15 tracks; one track does 78% of income</li>
          <li>Trajectory: -15% YoY (the hit is fading)</li>
          <li>Sync history: none</li>
          <li>Audience: 200K monthly listeners but algorithm-driven</li>
        </ul>

        <p>
          Expected multiple: 5x–6x. Advance: $300K–$360K. Likely
          structured as a term advance (7-year cap) rather than open-
          ended royalty advance, because of concentration risk.
        </p>

        <h3>Example 3: Established indie-rock band, mid-career</h3>

        <ul>
          <li>Annual net royalty income: $120K</li>
          <li>Catalog: 80 tracks across 6 albums, 10 years old</li>
          <li>Trajectory: +5% YoY, stable</li>
          <li>Sync history: 8 sync placements over 5 years</li>
          <li>Audience: passionate fan base, low listener-to-follower ratio</li>
          <li>Geographic spread: 40+ countries</li>
        </ul>

        <p>
          Expected multiple: 14x–17x. Advance: $1.68M–$2.04M.
          Recoupment: ~7–8 years on a 70/30 split.
        </p>

        <PullQuote>
          The multiple isn't a number buyers pick from a table. It's
          the answer to "how confident am I that this catalog earns
          what it earns today for the next eight years?"
        </PullQuote>

        <h2>Why offers from different buyers vary</h2>

        <p>
          Two reasons:
        </p>

        <h3>1. Different buyers have different cost of capital</h3>

        <p>
          beatBread, RoyFi, Symphonic, Xposure, Connect Music — each
          has different sources of capital with different yield
          expectations. A buyer whose investors expect 8% returns can
          pay a higher multiple than a buyer whose investors expect
          15%. The multiple math passes through to the artist's offer.
        </p>

        <h3>2. Different buyers have different specializations</h3>

        <p>
          Some buyers specialize in growth-trajectory indie catalogs
          and pay premium multiples for them. Some specialize in
          stable mid-tier catalogs. Some prefer sync-heavy structures.
          The same catalog will get different multiples depending on
          how well it fits each buyer's specialty.
        </p>

        <p>
          This is exactly why scouts who shop deals across 2–4 buyers
          systematically beat scouts who route every deal to one
          buyer. The 10–25% variance in offers is real money.
        </p>

        <h2>How to estimate a fair offer before approaching buyers</h2>

        <p>
          For scouts qualifying artists, the rough estimation workflow:
        </p>

        <ol>
          <li>
            <strong>Pull annual net royalty income</strong> from
            Spotify for Artists, distributor statements, or
            Chartmetric estimates.
          </li>
          <li>
            <strong>Start with 10x as baseline.</strong> Typical indie
            mid-band default.
          </li>
          <li>
            <strong>Adjust for trajectory:</strong> +1.5x for strong
            growth, -1x for moderate decline.
          </li>
          <li>
            <strong>Adjust for concentration:</strong> -2x if one track
            is 60%+ of income.
          </li>
          <li>
            <strong>Adjust for catalog age:</strong> +0.5x for 5+
            years, -1x for under 2 years.
          </li>
          <li>
            <strong>Adjust for sync history:</strong> +1x for 3+ prior
            syncs.
          </li>
          <li>
            <strong>Round to nearest half-x.</strong>
          </li>
        </ol>

        <p>
          The result is a working estimate within ~20% of typical
          buyer offers. Useful for setting artist expectations
          honestly and for routing deals to the right buyer.
        </p>

        <h2>Where Chartmetric helps with multiple estimation</h2>

        <p>
          Chartmetric exposes the data points that drive multiple
          adjustments — trajectory, concentration, audience
          composition, sync history, geographic spread. A scout
          fluent in Chartmetric can produce a credible multiple
          estimate in five minutes. See our piece on{' '}
          <a href="/blog/chartmetric-for-music-catalog-scouts">
            Chartmetric for music catalog scouts
          </a>{' '}
          for what specifically to look at.
        </p>

        <h2>The honest read on multiples</h2>

        <p>
          Multiples in 2026 are lower than they were in 2021. The
          pandemic-era capital surge into music catalogs pushed
          multiples to historically high levels; the rate environment
          in 2023–2024 pulled them back. We're now in a more rational
          equilibrium where multiples reflect actual underwriting
          discipline rather than capital-chasing-deals frenzy.
        </p>

        <p>
          For artists: this is fine. The fundamentals of catalog
          finance haven't changed. The multiples are still meaningful
          and the structure still preserves ownership.
        </p>

        <p>
          For scouts: the lower multiples mean diligence and
          buyer-matching matter more. The difference between a 9x
          offer and an 11x offer on a $50K-income catalog is $100K to
          the artist (and an extra $10K commission to the scout).
          Knowing which buyer pays which multiple for which catalog
          profile is the leverage.
        </p>

        <h2>The bottom line</h2>

        <p>
          The multiple math isn't arbitrary. It's a buyer's
          quantitative answer to "how stable do I think this royalty
          stream is over the next 5–8 years." Trajectory matters
          most. Concentration risk matters second. Catalog age, sync
          history, audience quality, and platform diversification fill
          in the rest.
        </p>

        <p>
          For more context, see{' '}
          <a href="/blog/music-catalog-financing-explained">
            music catalog financing explained
          </a>{' '}
          for the broader product landscape, the{' '}
          <a href="/blog/music-catalog-buyer-directory-2026">
            buyer directory
          </a>{' '}
          for which buyer to route which deal to, and{' '}
          <a href="/blog/music-catalog-financing-broker-playbook">
            the broker playbook
          </a>{' '}
          if you're scouting deals.
        </p>

        <p>
          Praecora handles the artist-qualification side of catalog
          scouting end to end — Chartmetric data integrated into the
          artist record, multiple-estimate calculation in the deal
          pipeline, buyer-matching surfaced automatically.{' '}
          <a href="/demo">Book a 20-minute demo</a> to see what
          qualified-and-routed deal flow looks like in practice.
        </p>
      </Prose>
    </BlogPostShell>
  )
}
