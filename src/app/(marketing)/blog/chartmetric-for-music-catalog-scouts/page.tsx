import type { Metadata } from 'next'
import { BlogPostShell } from '../_components/BlogPostShell'
import { Prose, Callout, Lede, PullQuote } from '../_components/Prose'
import { getPostBySlug } from '../posts'

export const revalidate = 3600

const post = getPostBySlug('chartmetric-for-music-catalog-scouts')!

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
          Chartmetric is the data platform most catalog buyers use to
          underwrite indie deals. For scouts sourcing those deals, it's
          the same data — used for qualification rather than
          underwriting. Here's how scouts should actually read a
          Chartmetric profile to decide whether an artist is worth
          pitching.
        </Lede>

        <p>
          If you're sourcing music catalog finance deals seriously,
          Chartmetric is the tool you'll spend more time in than any
          other. Founded in 2015, it's now the de facto data layer for
          most professional music industry research — covering 8M+
          artists across Spotify, Apple Music, YouTube, TikTok, social
          platforms, and ~250 chart and playlist sources globally. The
          catalog buyers on the other side of your deals (beatBread,
          Symphonic, Xposure, Connect Music) all use Chartmetric in
          their underwriting; the data on it is the data they're
          modeling against.
        </p>

        <p>
          What scouts often miss: Chartmetric has many more useful
          signals than the obvious "monthly listeners" number on the
          front page. The signals that actually predict whether a
          buyer will underwrite an artist's catalog are layered deeper
          — trajectory, audience stickiness, platform mix, regional
          spread, sync history, decay rate. Scouts who learn to read
          those signals quickly can qualify in 30 seconds what would
          take a less-trained scout 30 minutes.
        </p>

        <p>
          This piece walks through what to actually look at on a
          Chartmetric profile when you're deciding whether an artist is
          worth pitching, in the order that matters most.
        </p>

        <h2>The qualification question Chartmetric answers</h2>

        <p>
          When you're scouting, you're trying to answer one specific
          question fast: <em>Is this artist's catalog likely to clear
          the underwriting bar at the buyers I work with?</em>
        </p>

        <p>
          The underwriting bar varies by buyer but the variables don't.
          Every credible buyer looks at roughly the same things:
        </p>

        <ul>
          <li>Current royalty income (estimated from streams)</li>
          <li>Income trajectory over the last 12–24 months</li>
          <li>Catalog depth and revenue concentration</li>
          <li>Audience quality and stickiness</li>
          <li>Decay rate / catalog half-life</li>
          <li>Platform diversification</li>
          <li>Regional revenue distribution</li>
          <li>Sync history and frequency</li>
        </ul>

        <p>
          Chartmetric surfaces each of these. Some are obvious; some are
          buried. The skill is knowing where to look and what threshold
          tells you "this is worth a real conversation" vs. "skip and
          move on."
        </p>

        <h2>The first 30 seconds: top-line filtering</h2>

        <p>
          When a new artist comes up in your sourcing queue, the first
          look is a 30-second scan to decide whether to invest more
          time. Open the Chartmetric profile and check, in order:
        </p>

        <h3>Monthly Listeners (and the 90-day trend)</h3>

        <p>
          The most-visible number, and the one most scouts over-index
          on. Useful as a quick filter, but only with context. Three
          rules:
        </p>

        <ul>
          <li>
            <strong>Under 5,000 monthly listeners:</strong> probably
            too small. The streaming-income math typically doesn't
            support a buyer's minimum deal size. Exceptions: artists
            with strong YoY growth or strong sync income (which won't
            show in monthly listeners).
          </li>
          <li>
            <strong>5,000–50,000 monthly listeners:</strong> the
            indie-finance sweet spot. Most deals at beatBread,
            Symphonic, and RoyFi happen here.
          </li>
          <li>
            <strong>50,000–500,000 monthly listeners:</strong>
            premium indie band. Talk to Xposure, Connect Music,
            Intercept — bigger advances available.
          </li>
          <li>
            <strong>500,000+ monthly listeners:</strong> entering label-
            adjacent territory. Multiple buyer options exist; the
            artist may already have one.
          </li>
        </ul>

        <p>
          Then check the 90-day trend curve right below the headline
          number. Steady or growing is good. Sharp decline is a yellow
          flag — buyers underwrite to the trajectory, not the peak. A
          50K-listener artist trending down toward 30K gets a smaller
          offer than a 30K-listener artist trending up toward 50K.
        </p>

        <h3>Catalog Size (Spotify Tracks)</h3>

        <p>
          The number of tracks in the artist's catalog. Found under the
          Spotify section. The relevance:
        </p>

        <ul>
          <li>
            <strong>Under 10 tracks:</strong> very small catalog. Risky
            for buyers because revenue concentration is high. Single
            viral hit = single point of failure.
          </li>
          <li>
            <strong>10–30 tracks:</strong> typical indie catalog. Most
            buyer math works here.
          </li>
          <li>
            <strong>30+ tracks:</strong> deep catalog, revenue spread
            across more tracks. Better for buyers because portfolio
            effect kicks in.
          </li>
        </ul>

        <h3>Most Popular Tracks</h3>

        <p>
          Look at the top 5 tracks by Spotify stream count. The
          question: how concentrated is income in the top 1–2 tracks?
        </p>

        <p>
          A healthy catalog has revenue distributed: the top track
          might be 25–35% of total streams, with the rest spread.
          Concerning catalogs have 70%+ of streams in one track —
          buyers discount these because if that single track decays
          fast, the whole catalog economics collapse.
        </p>

        <h2>The next 90 seconds: trajectory + audience quality</h2>

        <p>
          If the top-line filter passed, dig into trajectory and
          audience.
        </p>

        <h3>Monthly Listener history chart (1Y, 2Y views)</h3>

        <p>
          Switch the Monthly Listeners chart to 1-year and 2-year
          views. The shape matters more than any specific number.
          Healthy shapes:
        </p>

        <ul>
          <li>
            <strong>Stair-step growth:</strong> sustained increases
            with each release cycle, holding the gains. Best
            possible profile.
          </li>
          <li>
            <strong>Plateau with occasional bumps:</strong> stable
            base audience with growth on releases. Solid.
          </li>
          <li>
            <strong>Slow steady growth:</strong> not exciting but
            financeable. Multiple usually 7x–10x.
          </li>
          <li>
            <strong>Spike-and-decay:</strong> one viral moment, then
            collapse. Concerning. Buyers underwrite to where the
            decay is heading.
          </li>
          <li>
            <strong>Long-term decline:</strong> hard pass. Even at
            decent absolute numbers, a declining trajectory means the
            underwriting math doesn't work.
          </li>
        </ul>

        <h3>Listener-to-Follower ratio</h3>

        <p>
          Found by comparing the Spotify listeners number to the
          Spotify followers number. Healthy ratios are 1:1 to 3:1
          (listeners:followers). Concerning ratios are 10:1 or higher
          — it means most of the audience is passive playlist
          consumption rather than fans, and playlist-driven catalogs
          decay faster than fan-driven ones.
        </p>

        <h3>Genre + Audience demographics</h3>

        <p>
          Chartmetric tags genres and shows audience demographics by
          age, gender, country. Two things to check:
        </p>

        <ul>
          <li>
            <strong>Genre fit for buyers:</strong> indie rock, alt R&B,
            indie folk, ambient electronic, Latin alternative — all
            have active buyer interest. Lo-fi instrumental, meditation,
            children's music — less buyer appetite (lower per-stream
            payouts).
          </li>
          <li>
            <strong>Regional concentration:</strong> 80%+ of listeners
            in one country is concerning. Buyers prefer geographic
            diversification because it spreads royalty platform risk
            (if Spotify cuts US rates, a 100%-US artist gets hammered).
          </li>
        </ul>

        <h2>The deeper 5 minutes: data that buyers actually underwrite to</h2>

        <p>
          If the artist still looks interesting, this is where you
          spend real time before deciding to pitch them. The data here
          is what gets surfaced in beatBread or Xposure underwriting
          memos.
        </p>

        <h3>Streaming projections</h3>

        <p>
          Chartmetric's Pro tier offers projection tools that model
          future streaming income based on historical trajectory. The
          12-month and 36-month projections are useful gut-checks:
          buyers' offers will be roughly anchored to similar
          projections.
        </p>

        <h3>Royalty calculator outputs</h3>

        <p>
          Chartmetric exposes estimated royalty income per platform.
          For US listeners on Spotify, expect ~$3–$4 per 1,000 streams
          gross, $1.50–$2.50 net to the artist after distributor cut.
          Apple Music pays roughly 50% more per stream. YouTube is
          variable but usually lower. The aggregate gives you a
          back-of-envelope annual royalty income — the foundation of
          every advance calculation.
        </p>

        <h3>Playlist mix</h3>

        <p>
          Are the artist's plays coming from editorial Spotify
          playlists (Spotify-curated), algorithmic playlists (Release
          Radar, Discover Weekly), user-generated playlists, or direct
          listens? Higher direct-listen percentages = stickier
          audience. Higher algorithmic percentages = more fragile to
          algorithm changes.
        </p>

        <h3>Social platform integration</h3>

        <p>
          Chartmetric also pulls Instagram, TikTok, YouTube, and other
          social signals. Two things matter:
        </p>

        <ul>
          <li>
            <strong>Engagement, not just follower counts.</strong> An
            artist with 100K Instagram followers and 0.5% engagement is
            less valuable than an artist with 10K followers and 8%
            engagement. The second number is the real audience.
          </li>
          <li>
            <strong>TikTok presence + recent virality.</strong> Streaming
            growth often follows TikTok moments. An artist with a
            recent TikTok hit driving streams is worth underwriting
            differently than an artist with steady-state streams from
            older catalog.
          </li>
        </ul>

        <h3>Sync history</h3>

        <p>
          Chartmetric pulls sync placements (TV, film, ad placements).
          Tracks that have synced before are statistically more likely
          to sync again, and sync income is meaningfully more
          predictable than streaming. Even one or two prior syncs
          materially improve a buyer's underwriting model.
        </p>

        <h2>What to record as you scan</h2>

        <p>
          For each artist you qualify, the data you should capture for
          the buyer pitch:
        </p>

        <ul>
          <li>Monthly listeners (current + 90-day trend direction)</li>
          <li>Estimated annual streaming royalties (USD)</li>
          <li>Catalog size (# tracks)</li>
          <li>Top track + % of total streams</li>
          <li>Genre + listener regional spread</li>
          <li>Listener-to-follower ratio</li>
          <li>Playlist mix (editorial / algorithmic / user)</li>
          <li>Notable sync history</li>
          <li>Distributor (DistroKid, TuneCore, Symphonic, label, etc.)</li>
          <li>Instagram + TikTok engagement signals</li>
        </ul>

        <p>
          With those 10 fields, you can run a credible first pitch to
          a buyer. Without them, you're asking the buyer to do your
          work — which is fine occasionally but doesn't scale.
        </p>

        <PullQuote>
          The buyers use Chartmetric to underwrite the deal. You use
          Chartmetric to know whether the deal is worth pitching.
          Same data, different decision.
        </PullQuote>

        <h2>Chartmetric pricing for scouts</h2>

        <p>
          Chartmetric has a free tier, a Pro tier (around $140/month
          billed annually), and a Business tier with API access. For
          scouts, the Pro tier is usually the right starting point —
          you get the projections, deeper trajectory views, and
          historical data that matter for catalog finance work. The
          Business tier with API access is worth it once you're doing
          enough volume that you want to automate qualification
          (which Praecora handles natively, integrating Chartmetric
          and Spotify data automatically into the artist record).
        </p>

        <h2>Common mistakes scouts make on Chartmetric</h2>

        <h3>Looking only at the front page</h3>

        <p>
          The Monthly Listeners number is one input. Scouts who
          qualify entirely on that number miss most of the signal
          (trajectory, concentration, sync history) and burn time on
          deals that look big but underwrite small.
        </p>

        <h3>Ignoring trajectory</h3>

        <p>
          A 30K-listener artist with steep growth is more valuable
          than a 50K-listener artist with sustained decline.
          Underwriting cares about where the curve is heading, not
          where it currently is. Scouts who don't internalize this
          pitch the wrong artists.
        </p>

        <h3>Skipping the regional check</h3>

        <p>
          A 50K-listener artist with 95% of listeners in one country
          is meaningfully riskier than a 50K-listener artist with
          listeners spread across 20 countries. Buyers know this.
          Scouts who skip the check waste pitches.
        </p>

        <h3>Pitching one-hit catalogs</h3>

        <p>
          80% revenue concentration in one track = limited buyer
          appetite at almost every credible buyer. Don't burn
          relationships pitching these. Note the concentration risk
          and move on (or pitch a different deal structure that's not
          a pure royalty advance).
        </p>

        <h2>The bottom line</h2>

        <p>
          Chartmetric is the qualification engine for serious music
          catalog scouting. The 30-second top-line scan filters
          obvious no-go artists. The 5-minute deeper read produces a
          qualified data set buyers will take seriously. Scouts who
          learn to read Chartmetric efficiently can qualify 50 artists
          in an hour; scouts who don't burn an hour on 5.
        </p>

        <p>
          For the broader sourcing context — how scouts actually find
          artists, what cold outreach looks like, how the buyer
          landscape works — see our pieces on{' '}
          <a href="/blog/music-catalog-financing-broker-playbook">
            the broker playbook
          </a>{' '}
          and the{' '}
          <a href="/blog/music-catalog-buyer-directory-2026">
            buyer directory
          </a>
          . For Spotify-specific data fields that complement
          Chartmetric, see our piece on{' '}
          <a href="/blog/spotify-for-artists-data-catalog-buyers">
            Spotify for Artists data
          </a>
          .
        </p>

        <p>
          Praecora integrates Chartmetric and Spotify data directly
          into the scout's artist record, so qualification happens
          automatically as new artists enter the pipeline — no manual
          tabbing required. <a href="/demo">Book a 20-minute demo</a>{' '}
          to see what the integrated qualification flow actually looks
          like in practice.
        </p>
      </Prose>
    </BlogPostShell>
  )
}
