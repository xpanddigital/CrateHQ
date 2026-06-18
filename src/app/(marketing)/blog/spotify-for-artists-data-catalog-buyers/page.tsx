import type { Metadata } from 'next'
import { BlogPostShell } from '../_components/BlogPostShell'
import { Prose, Callout, Lede, PullQuote } from '../_components/Prose'
import { getPostBySlug } from '../posts'

export const revalidate = 3600

const post = getPostBySlug('spotify-for-artists-data-catalog-buyers')!

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
          When a catalog buyer underwrites a deal, the first data
          they want is the artist's Spotify for Artists statements.
          Here are the exact fields buyers care about, what they're
          calculating from them, and how scouts can pre-qualify
          deals before pitching.
        </Lede>

        <p>
          Spotify for Artists is the public-facing analytics product
          Spotify provides to artists (and labels/managers with
          access) for their distributed catalog. It exposes streams,
          listeners, demographic data, geographic data, playlist
          attribution, and (for active distribution accounts) royalty
          income data.
        </p>

        <p>
          For catalog buyers underwriting royalty advances and
          catalog purchases, Spotify for Artists data is one of the
          first inputs into the deal math. For scouts sourcing those
          deals, the same data is the qualification engine. Knowing
          which specific fields matter — and what buyers are
          calculating from them — separates scouts who pre-qualify
          well from scouts who burn buyer relationships pitching
          unqualified artists.
        </p>

        <p>
          This piece walks through what to actually look at, what it
          tells you, and how to estimate a fair advance multiple from
          Spotify data alone.
        </p>

        <h2>The data fields buyers care about</h2>

        <h3>Monthly Listeners (current + trend)</h3>

        <p>
          The headline number on the dashboard. Useful as a first-
          pass filter, but only with context. The 28-day rolling
          window matters more than a single point-in-time number.
        </p>

        <p>
          What buyers calculate:
        </p>

        <ul>
          <li>
            <strong>Trajectory</strong> — is the trend over the last
            6/12/24 months growing, stable, or declining? This shapes
            the advance multiple meaningfully.
          </li>
          <li>
            <strong>Audience scale</strong> — how big is the listener
            base in absolute terms? Floors apply differently at
            5K, 50K, 500K monthly listeners.
          </li>
          <li>
            <strong>Seasonal pattern</strong> — is the audience
            consistent year-round, or does it spike around specific
            seasons? Holiday music, for instance, has a steep
            seasonal curve.
          </li>
        </ul>

        <h3>Streams (28-day, 12-month, all-time)</h3>

        <p>
          Total stream count. Buyers use this to back out estimated
          royalty income, since Spotify pays roughly $3–$4 per 1,000
          US streams gross to rights-holders.
        </p>

        <p>
          What buyers calculate:
        </p>

        <ul>
          <li>
            Annual stream count → estimated annual royalty income
            (rough rule: 1M streams ≈ $3,000–$4,000 gross royalties)
          </li>
          <li>
            Per-listener depth — streams divided by listeners shows
            how often each listener plays. High ratio = sticky
            audience, low ratio = passive playlist consumption.
          </li>
        </ul>

        <h3>Top Tracks (last 28 days)</h3>

        <p>
          Which tracks are driving the streams. Buyers want
          diversification, not concentration.
        </p>

        <p>
          What buyers calculate:
        </p>

        <ul>
          <li>
            <strong>Top track concentration</strong> — what % of
            total streams come from track #1? If it's 60%+, the
            catalog has concentration risk that depresses the
            multiple.
          </li>
          <li>
            <strong>Catalog depth</strong> — how many tracks generate
            meaningful streams? A catalog where 15+ tracks each do
            5%+ of total streams is more financeable than one with
            two hit tracks and 30 dormant ones.
          </li>
        </ul>

        <h3>Listener demographics</h3>

        <p>
          Age, gender, location data. Affects:
        </p>

        <ul>
          <li>
            <strong>Geographic concentration</strong> — listeners
            spread across many countries = lower platform-specific
            risk
          </li>
          <li>
            <strong>Demographic stability</strong> — audiences
            concentrated in older age brackets typically have higher
            retention than purely Gen Z audiences (different
            consumption patterns)
          </li>
        </ul>

        <h3>Source of streams</h3>

        <p>
          Where each play comes from — algorithmic playlists,
          editorial playlists, user-generated playlists, listener
          search, listener library, artist profile, other. Buyers
          weight these differently.
        </p>

        <p>
          What buyers calculate:
        </p>

        <ul>
          <li>
            <strong>Algorithmic dependency</strong> — heavy
            Release Radar / Discover Weekly dependency means the
            catalog is fragile to algorithm changes
          </li>
          <li>
            <strong>Editorial dependency</strong> — heavy reliance on
            Spotify editorial playlist placement means the catalog
            depends on Spotify's editorial team continuing to feature
            it
          </li>
          <li>
            <strong>Library/profile percentage</strong> — listens
            that come from a user's own saved library or by going to
            the artist's profile directly = real fans. Higher
            percentage of "owned" listens = stickier audience =
            higher multiple
          </li>
        </ul>

        <h3>Followers</h3>

        <p>
          Spotify follower count. Used alongside monthly listeners.
        </p>

        <p>
          What buyers calculate:
        </p>

        <ul>
          <li>
            <strong>Listener-to-follower ratio</strong> — healthy
            ratio is 1:1 to 3:1. Above 10:1 means most listeners
            haven't committed to following (typical of playlist-
            driven artists). Higher ratios = less sticky audience.
          </li>
        </ul>

        <h3>Royalty data (if accessible)</h3>

        <p>
          For artists who give the buyer access to their distributor
          royalty reports (DistroKid, TuneCore, CD Baby, Symphonic,
          label statements), the actual paid royalty figures are the
          most direct input.
        </p>

        <p>
          What buyers calculate:
        </p>

        <ul>
          <li>
            Actual annual net royalty income (USD) — the ultimate
            input to the multiple formula
          </li>
          <li>
            Royalty stability — month-over-month consistency
          </li>
          <li>
            Distribution platform mix — Spotify vs. Apple Music vs.
            YouTube vs. others
          </li>
          <li>
            Geographic royalty breakdown — same as listener
            geography but expressed in dollars
          </li>
        </ul>

        <h2>The 5-minute Spotify qualification workflow</h2>

        <p>
          For scouts qualifying an artist, the practical workflow is:
        </p>

        <h3>Step 1: Check monthly listeners (10 sec)</h3>

        <p>
          Top-line filter. Under 5K listeners is usually too small
          for typical buyer minimums. 5K–500K is the indie sweet
          spot. Above 500K is premium indie territory.
        </p>

        <h3>Step 2: Check 12-month trend (30 sec)</h3>

        <p>
          Open the trend chart. Steady or growing is good; sharp
          decline is a yellow flag. Buyers will care about this more
          than the absolute number.
        </p>

        <h3>Step 3: Check top tracks concentration (60 sec)</h3>

        <p>
          Look at top 5 tracks. If track #1 is 60%+ of streams, this
          is a concentration risk and the multiple will be lower.
        </p>

        <h3>Step 4: Estimate annual royalty income (90 sec)</h3>

        <p>
          12-month total streams × ~$3.50/1000 streams = rough gross
          royalty estimate. Subtract distributor cut (~15% typically)
          for net royalty estimate. Compare to the buyer's typical
          deal-size floor.
        </p>

        <h3>Step 5: Estimate multiple (60 sec)</h3>

        <p>
          Start with 10x baseline. Adjust:
        </p>

        <ul>
          <li>+1.5x for strong growth, -1x for moderate decline</li>
          <li>-2x for high top-track concentration</li>
          <li>+0.5x for 5+ years of catalog history</li>
          <li>+1x for known sync history</li>
        </ul>

        <p>
          Result × annual net royalties = working advance estimate.
          Within ~20% of typical buyer offers.
        </p>

        <h3>Step 6: Record + decide (30 sec)</h3>

        <p>
          Note the numbers in the CRM, decide whether to pitch the
          artist. Total time per qualification: ~5 minutes.
        </p>

        <Callout label="What scouts can't see in Spotify for Artists">
          <p>
            Spotify for Artists shows streams and listeners but not
            actual royalty payments — that's in the artist's
            distributor account. Scouts typically work from estimated
            royalties until the artist agrees to share statements.
            The estimates are close enough to qualify, but the
            buyer's actual offer is based on the real statements
            during diligence.
          </p>
        </Callout>

        <h2>What Spotify for Artists doesn't tell you</h2>

        <p>
          Important context: Spotify for Artists shows only Spotify
          data. The artist's full income picture also includes:
        </p>

        <ul>
          <li>
            <strong>Apple Music</strong> — typically 30–40% of an
            artist's total streaming income, sometimes more for
            certain genres
          </li>
          <li>
            <strong>YouTube</strong> — variable, often substantial for
            visually-driven genres
          </li>
          <li>
            <strong>Amazon Music, Deezer, Tidal, others</strong> —
            usually 10–15% combined
          </li>
          <li>
            <strong>Sync income</strong> — not in streaming data at
            all
          </li>
          <li>
            <strong>Publishing/songwriter royalties</strong> —
            collected separately
          </li>
          <li>
            <strong>Performance royalties</strong> (ASCAP, BMI, SESAC)
            — separate income
          </li>
          <li>
            <strong>Mechanical royalties</strong> — separate income
          </li>
        </ul>

        <p>
          For pre-qualification, Spotify alone is enough. For final
          underwriting, the buyer wants the full distributor
          statements that show all platforms in dollars.
        </p>

        <h2>How scouts get Spotify for Artists access</h2>

        <p>
          Spotify for Artists is restricted to the artist (and
          parties they grant access to — managers, label staff,
          claimed-and-verified team members). Scouts don't have
          standing access to other artists' Spotify for Artists
          dashboards.
        </p>

        <p>
          What scouts do have:
        </p>

        <ul>
          <li>
            <strong>Public Spotify data</strong> — monthly listeners,
            top tracks (visible without Spotify for Artists access),
            playlist appearances. Visible on every artist's public
            profile.
          </li>
          <li>
            <strong>Chartmetric / Soundcharts</strong> — third-party
            tools that estimate streams, royalty income, and
            trajectory from publicly visible data. Close enough for
            qualification, not the same as the real statements. See
            our piece on{' '}
            <a href="/blog/chartmetric-for-music-catalog-scouts">
              Chartmetric for music catalog scouts
            </a>{' '}
            for the deep dive.
          </li>
          <li>
            <strong>Direct sharing from interested artists</strong> —
            once an artist agrees to explore a deal, they share
            Spotify for Artists access (via the platform's sharing
            feature) or screenshots of their statements.
          </li>
        </ul>

        <p>
          The qualification sequence: estimate from public + third-
          party data → pitch artist → if interested, get Spotify for
          Artists access → finalize numbers → route to buyer.
        </p>

        <PullQuote>
          The buyer wants the real Spotify for Artists data before
          writing a check. The scout uses public proxies (Chartmetric)
          to decide whether the deal is worth chasing in the first
          place.
        </PullQuote>

        <h2>Common qualification mistakes</h2>

        <h3>Looking only at headline monthly listeners</h3>

        <p>
          A 50K-listener artist with high concentration and decline
          is a worse deal than a 30K-listener artist with diversified
          streams and growth. Single-metric qualification misses 80%
          of the signal.
        </p>

        <h3>Ignoring source-of-streams data</h3>

        <p>
          An artist with 100K monthly listeners driven entirely by
          one Spotify editorial playlist placement isn't financeable
          — the moment that playlist drops the track, the audience
          evaporates. Always check where the streams come from.
        </p>

        <h3>Not asking for royalty access early</h3>

        <p>
          Once an artist expresses interest, ask for Spotify for
          Artists access early in the conversation, not at deal-close
          time. It accelerates qualification and signals you're
          serious.
        </p>

        <h3>Forgetting that Spotify is part of the picture</h3>

        <p>
          Estimating advances from Spotify alone usually underestimates
          by 30–50% because Apple Music, YouTube, and others add to
          the total. For final deal sizing, multi-platform data
          matters.
        </p>

        <h2>The bottom line</h2>

        <p>
          Spotify for Artists data is the qualification engine for
          catalog finance deals. Monthly listeners, trajectory, top-
          track concentration, source-of-streams, listener-to-
          follower ratio, and (when accessible) royalty figures are
          the inputs that drive buyer underwriting decisions. Scouts
          fluent in these fields qualify artists in 5 minutes;
          scouts who aren't burn hours and pitch the wrong deals.
        </p>

        <p>
          For the broader qualification workflow including
          Chartmetric and multi-platform data, see{' '}
          <a href="/blog/chartmetric-for-music-catalog-scouts">
            Chartmetric for music catalog scouts
          </a>
          . For the math behind translating qualification data into
          deal valuations, see{' '}
          <a href="/blog/music-catalog-valuation-multiples-2026">
            music catalog valuation multiples
          </a>
          .
        </p>

        <p>
          Praecora integrates Spotify and Chartmetric data directly
          into every artist record, so qualification math is
          surfaced automatically as artists enter the sourcing
          pipeline. <a href="/demo">Book a 20-minute demo</a> to see
          what automated artist qualification looks like in
          practice.
        </p>
      </Prose>
    </BlogPostShell>
  )
}
