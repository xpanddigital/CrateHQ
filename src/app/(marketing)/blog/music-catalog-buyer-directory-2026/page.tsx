import type { Metadata } from 'next'
import { BlogPostShell } from '../_components/BlogPostShell'
import { Prose, Callout, Lede, PullQuote } from '../_components/Prose'
import { getPostBySlug } from '../posts'

const post = getPostBySlug('music-catalog-buyer-directory-2026')!

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
          A working catalog scout needs to know who's actually buying. The
          list shifts every quarter — new funds enter, old ones consolidate,
          and underwriting criteria change with rate environments. This
          directory is what we track ourselves. Twenty-three active buyers,
          with minimum deal sizes, product mix, and how each one likes to
          source.
        </Lede>

        <p>
          The independent music catalog financing market in 2026 is more
          diverse than most artists or scouts realize. The same three or
          four names show up in every article (beatBread, Xposure,
          Royalty Exchange, Symphonic), but the actual buyer landscape is
          more like twenty-three active firms placing capital into indie
          catalogs, plus another dozen niche players, family offices, and
          investor syndicates whose deal flow is more episodic.
        </p>

        <p>
          This directory is what we maintain internally and route deals
          to. It's organized by approximate deal-size sweet spot —
          smallest at the top, largest at the bottom — because that's
          how most scouts qualify. We've grouped each entry the same way:
          who they are, what they buy, the deal size band, the product
          mix, and notes on how they like to be approached.
        </p>

        <p>
          We update this directory roughly every quarter. The publication
          date at the top of this page is the last full review. If you
          spot anything that's gone stale, email us — we'd rather have
          the field guide be accurate than be comprehensive.
        </p>

        <Callout label="What 'active' means here">
          <p>
            We only list buyers that have closed at least one indie deal
            in the trailing 6 months from our observation. Music catalog
            financing has been through a couple of capital cycles, and
            firms that were active in 2022 aren't necessarily writing
            checks now. The headline number "23 active buyers" is the
            real footprint, not the theoretical one.
          </p>
        </Callout>

        <h2>Every active buyer in this directory</h2>

        <p>
          Quick jump-to for the buyers covered below:{' '}
          <a href="#royfi">RoyFi</a>,{' '}
          <a href="#songvest">Songvest</a>,{' '}
          <a href="#royalty-exchange">Royalty Exchange</a>,{' '}
          <a href="#beatbread">beatBread</a>,{' '}
          <a href="#symphonic-advances">Symphonic Advances</a>,{' '}
          <a href="#sound-royalties">Sound Royalties</a>,{' '}
          <a href="#indify">Indify</a>,{' '}
          <a href="#connect-music">Connect Music</a>,{' '}
          <a href="#xposure-music">Xposure Music</a>,{' '}
          <a href="#intercept">Intercept</a>, Futures Music Group,
          Round Hill Music, Concord (Hipgnosis), Primary Wave, Influence
          Media Partners, Iconoclast, HarbourView Equity Partners,
          Spirit Music Group, TuneCore (via RoyFi partnership),
          DistroKid, CD Baby, United Masters, The Orchard / Sony Music
          Entertainment, Believe Music, Stem.
        </p>

        <h2>Small-deal buyers ($10K–$100K advance band)</h2>

        <h3 id="royfi">RoyFi</h3>

        <p>
          <strong>Product:</strong> Royalty advance (their "Royalty Fast
          Forward" product). Fast, transparent process — paste a
          Spotify URL, see a preview offer in minutes.<br />
          <strong>Deal band:</strong> $1K–$75K typical. Will go smaller
          for catalogs with strong trajectory.<br />
          <strong>Minimum streaming:</strong> ~$500/month in net
          royalties. Lower than most.<br />
          <strong>Approach:</strong> Artists can apply directly through
          royfi.com. Scout relationships exist but are more informal
          than at other buyers — the deal flow tooling is built for
          direct artist signups.<br />
          <strong>What stands out:</strong> Their partnership with
          TuneCore opens a built-in distribution channel of indie
          artists already on streaming.
        </p>

        <h3 id="songvest">Songvest</h3>

        <p>
          <strong>Product:</strong> Royalty Exchange-style marketplace
          plus direct advance product.<br />
          <strong>Deal band:</strong> $25K–$200K typical.<br />
          <strong>Minimum streaming:</strong> Variable; they assess on a
          per-deal basis rather than a hard floor.<br />
          <strong>Approach:</strong> Open to scout relationships. Best
          fit for catalogs with sync potential or unusual revenue
          streams.<br />
          <strong>What stands out:</strong> They handle some less-
          common revenue types (mechanical royalties, neighbouring
          rights) that other platforms ignore.
        </p>

        <h3 id="royalty-exchange">Royalty Exchange</h3>

        <p>
          <strong>Product:</strong> Marketplace — artists list catalog
          assets; institutional and individual investors bid.<br />
          <strong>Deal band:</strong> $10K–$2M+ depending on listing.<br />
          <strong>Minimum streaming:</strong> No hard floor; the
          marketplace will list smaller assets if they have a thesis.<br />
          <strong>Approach:</strong> Different structurally — you're not
          pitching a single buyer, you're pitching an entire marketplace
          of investors. Listing fees apply.<br />
          <strong>What stands out:</strong> Sometimes returns higher
          multiples than direct-buyer paths because competitive bidding
          can push prices up. Slower (weeks for an auction to close vs.
          days for direct).
        </p>

        <h2>Mid-deal buyers ($50K–$500K advance band)</h2>

        <h3 id="beatbread">beatBread</h3>

        <p>
          <strong>Product:</strong> Royalty advance — their core product
          is "fan-powered" advances backed by predictive modeling of
          streaming income.<br />
          <strong>Deal band:</strong> $50K–$2M, but the mid-band is
          their sweet spot.<br />
          <strong>Minimum streaming:</strong> Roughly $1,500–$2,000/mo
          in net royalties depending on catalog age.<br />
          <strong>Approach:</strong> Mature scout relationships. Has a
          deal-flow team that responds to qualified introductions.
          Self-serve application path also exists.<br />
          <strong>What stands out:</strong> Volume player — deployed
          $100M+ across 1,700 deals since 2020. Strong indie
          underwriting. The category leader by deal count.
        </p>

        <h3 id="symphonic-advances">Symphonic Advances</h3>

        <p>
          <strong>Product:</strong> Royalty advance plus structured term
          deals. Distribution-attached through Symphonic Distribution
          (their parent).<br />
          <strong>Deal band:</strong> $25K–$1M typical.<br />
          <strong>Minimum streaming:</strong> Varies by structure; lower
          for distribution-bundled deals.<br />
          <strong>Approach:</strong> Existing Symphonic distribution
          clients are the natural fit. Scouts can route artists who
          aren't already distributing through Symphonic, but the
          conversation includes a distribution switch.<br />
          <strong>What stands out:</strong> The bundled distribution +
          financing offer simplifies the artist's stack, which is a
          real benefit for artists who haven't already locked in
          distribution elsewhere.
        </p>

        <h3 id="sound-royalties">Sound Royalties</h3>

        <p>
          <strong>Product:</strong> Royalty-collateralized advances and
          loans. Different structure than most — closer to traditional
          lending against a royalty stream.<br />
          <strong>Deal band:</strong> $25K–$500K typical.<br />
          <strong>Minimum streaming:</strong> Around $1,000/month.<br />
          <strong>Approach:</strong> Direct artist applications more
          common than scout-routed deals. Established relationships
          help but aren't required.<br />
          <strong>What stands out:</strong> One of the originals in the
          indie advance space, founded 2014. More conservative
          underwriting than newer entrants. Good fit for artists who
          want a more bank-like structure.
        </p>

        <h3 id="indify">Indify</h3>

        <p>
          <strong>Product:</strong> Marketplace-style funding for
          independent artists — connects artists with investors who
          fund specific releases or catalog assets.<br />
          <strong>Deal band:</strong> $20K–$300K typical.<br />
          <strong>Minimum streaming:</strong> Variable; they evaluate
          based on growth trajectory more than absolute size.<br />
          <strong>Approach:</strong> Application-driven on the artist
          side; investor side is private.<br />
          <strong>What stands out:</strong> One of the few platforms
          that funds future releases (not just back-catalog), which
          suits artists in active release cycles.
        </p>

        <h3 id="connect-music">Connect Music</h3>

        <p>
          <strong>Product:</strong> Multi-product. Advances, term deals,
          analytics services bundled in.<br />
          <strong>Deal band:</strong> $100K–$2M typical, growing with
          their 2026 $80M raise.<br />
          <strong>Minimum streaming:</strong> ~$3,000/month in
          royalties.<br />
          <strong>Approach:</strong> Active scout relationships. They
          have a dedicated deal-flow team that responds to qualified
          introductions.<br />
          <strong>What stands out:</strong> Founder George Monger came
          from major-label A&R, which gives them a thesis around
          artist development that's more sophisticated than pure
          financial-engineering plays.
        </p>

        <h2>Large-deal buyers ($300K–$5M+ band)</h2>

        <h3 id="xposure-music">Xposure Music</h3>

        <p>
          <strong>Product:</strong> Term advances and partial buyouts.
          Their term-advance structure (rights revert after 7–10 years)
          is well-regarded.<br />
          <strong>Deal band:</strong> $250K–$5M+ typical.<br />
          <strong>Minimum streaming:</strong> ~$5,000–$10,000/month.<br />
          <strong>Approach:</strong> Selective. Strong scout
          relationships matter here — Xposure doesn't take random
          inbound but does respond to introductions from people they
          trust.<br />
          <strong>What stands out:</strong> Montreal-based, $42M+ raised
          in 2026 from Andalusian Credit Partners. Pays higher
          multiples for premium catalogs. Strong reputation among
          mid-tier indie artists who've worked with them.
        </p>

        <h3 id="intercept">Intercept</h3>

        <p>
          <strong>Product:</strong> Catalog acquisitions, primarily
          buyout structures for mid-to-large indie catalogs.<br />
          <strong>Deal band:</strong> $500K–$10M+.<br />
          <strong>Minimum streaming:</strong> ~$8,000+/month in
          royalties.<br />
          <strong>Approach:</strong> Strong industry-insider
          relationships. Cold outreach less effective; warm
          introductions essential.<br />
          <strong>What stands out:</strong> Recent $50M raise targeted
          specifically at indie catalog acquisitions. Growing
          aggressively into the space major labels have historically
          dominated.
        </p>

        <h3>Futures Music Group</h3>

        <p>
          <strong>Product:</strong> Mixed — catalog acquisitions, label
          partnerships, structured deals with indie labels.<br />
          <strong>Deal band:</strong> $200K–$5M.<br />
          <strong>Minimum streaming:</strong> Varies by deal type.<br />
          <strong>Approach:</strong> Often partners with indie labels
          rather than direct artists. Scouts with label relationships
          are well-positioned.<br />
          <strong>What stands out:</strong> $6M raise in 2026 indicates
          smaller deal velocity than the headline names but
          consistently active.
        </p>

        <h3>Round Hill Music</h3>

        <p>
          <strong>Product:</strong> Catalog acquisitions, primarily for
          publishing and master rights of established mid-to-large
          catalogs.<br />
          <strong>Deal band:</strong> $1M–$50M+.<br />
          <strong>Minimum streaming:</strong> Effectively only catalogs
          with proven 5+ year revenue.<br />
          <strong>Approach:</strong> Institutional relationships
          dominate. Scouts who bring them clean indie-label-affiliated
          catalogs with track records can place deals; pure indie deals
          below their floor.<br />
          <strong>What stands out:</strong> Publicly-listed in earlier
          phase; now a more focused acquisition vehicle.
        </p>

        <h2>The major-label and PE consolidators</h2>

        <h3>Concord (formerly Hipgnosis Songs Capital)</h3>

        <p>
          After Hipgnosis Songs Fund consolidated with Concord in
          2024, Concord became one of the largest catalog buyers
          globally. Mostly major-name and label-tier catalogs in the
          $5M–$100M+ band. Indie scouts can occasionally route deals
          here if the catalog is large enough to clear their floor;
          most indie deals are below.
        </p>

        <h3>Primary Wave</h3>

        <p>
          Established catalog acquisition platform. Famous for
          high-profile deals (Stevie Nicks, Whitney Houston). Indie-
          relevance is limited — minimum deal sizes effectively
          exclude most independent artists. Worth knowing they exist
          for the rare large-catalog indie that meets their bar.
        </p>

        <h3>Influence Media Partners</h3>

        <p>
          PE-backed catalog acquirer; partnered with Warner Music for
          some deals. Operates in the $5M+ band almost exclusively.
        </p>

        <h3>Iconoclast / HarbourView Equity Partners</h3>

        <p>
          Two of the newer PE-backed catalog funds. Both selective,
          both operating at the upper end of indie ($10M+). Worth
          knowing about; rarely the right fit for typical indie scout
          deal flow.
        </p>

        <h3>Spirit Music Group</h3>

        <p>
          Established publisher/catalog acquirer with both major and
          indie-adjacent deal flow. Can be a fit for mid-to-large
          indie catalogs with strong publishing rights.
        </p>

        <h2>Distribution-attached financing</h2>

        <h3>TuneCore (via RoyFi partnership)</h3>

        <p>
          Built into the TuneCore distribution product. Eligible artists
          can apply for advances directly through their TuneCore
          account. Smaller deal sizes ($1K–$50K range) with fast
          processing.
        </p>

        <h3>DistroKid (occasional partnerships)</h3>

        <p>
          DistroKid doesn't run their own advance product but has
          occasionally partnered with external advance providers. Worth
          checking current state if your artist is a DistroKid client.
        </p>

        <h3>CD Baby</h3>

        <p>
          Similar to DistroKid — no native advance product, but
          partnership-routed financing has appeared and disappeared
          over the years. Check current state per artist.
        </p>

        <h3>United Masters</h3>

        <p>
          Has run advance programs for select roster artists. Not a
          generally accessible buyer for outside catalogs but worth
          knowing if your artist is already a United Masters partner.
        </p>

        <h3>The Orchard / Sony Music Entertainment</h3>

        <p>
          Orchard does label-style deals that include financing
          components. More of a label conversation than a pure-finance
          buyer relationship, but legitimate path for mid-tier indie
          catalogs.
        </p>

        <h3>Believe Music / TuneCore Believe</h3>

        <p>
          Distribution-and-services platform; financing arms are tied
          to broader label-services packages.
        </p>

        <h3>Stem</h3>

        <p>
          Distribution and royalty management platform; has offered
          advances against Stem-distributed catalog. Smaller-scale,
          fast-moving.
        </p>

        <h2>The niche and emerging players</h2>

        <p>
          A non-exhaustive list of buyers worth knowing about but with
          either narrower focus or less consistent deal flow:
        </p>

        <ul>
          <li>
            <strong>Music Royalty Capital</strong> — boutique fund,
            indie-friendly underwriting on selective deals
          </li>
          <li>
            <strong>Anote Music</strong> — European platform,
            marketplace model for catalog investing
          </li>
          <li>
            <strong>Mavin Records / Maven Music</strong> — vertical
            specialists in specific genres
          </li>
          <li>
            <strong>Family offices via Royalty Exchange</strong> —
            high-net-worth individuals participating in marketplace
            deals
          </li>
          <li>
            <strong>Crowdfunded royalty platforms</strong> (various)
            — usually for smaller deals with creator-fan economics
          </li>
        </ul>

        <h2>How to actually pitch each buyer</h2>

        <p>
          A working catalog scout isn't running one outreach motion to
          buyers — they're running a matching motion. Match the
          catalog profile to the buyer most likely to fund it. A few
          rules of thumb gathered from running this work:
        </p>

        <ul>
          <li>
            <strong>$25K–$100K catalogs with growth trajectory</strong> →
            RoyFi, Symphonic, Sound Royalties first. beatBread for
            slightly larger.
          </li>
          <li>
            <strong>$100K–$500K mid-band</strong> → beatBread, Symphonic,
            Indify, Sound Royalties. Connect Music if there's
            trajectory and the artist is a serious operator.
          </li>
          <li>
            <strong>$500K–$2M with proven multi-year track record</strong>{' '}
            → Xposure, Connect Music, Intercept. Some Futures.
          </li>
          <li>
            <strong>$2M+ with label affiliation or premium catalog</strong>{' '}
            → Round Hill, Concord, Primary Wave (if the catalog name
            is recognizable), Influence Media.
          </li>
          <li>
            <strong>Distribution-attached preference</strong> → match
            to existing distributor (TuneCore→RoyFi, Symphonic→Symphonic
            Advances, etc.)
          </li>
          <li>
            <strong>Marketplace appetite</strong> → Royalty Exchange,
            Songvest if the artist is willing to wait weeks for
            competitive bidding
          </li>
        </ul>

        <h2>What to ask each buyer before pitching</h2>

        <p>
          If you're a scout actively building buyer relationships, the
          most useful questions to ask at the beginning of a buyer
          conversation (not the artist conversation):
        </p>

        <ol>
          <li>
            What's your current preferred deal size range? (Floors and
            ceilings move quarterly.)
          </li>
          <li>
            What genres or catalog profiles are you actively
            underwriting right now?
          </li>
          <li>
            What does your indicative-offer turnaround look like?
            (Variance between buyers is real — 24 hours to 2 weeks.)
          </li>
          <li>
            What's your typical scout commission structure? (10% is
            standard; some buyers pay more, some less, some have
            volume tiers.)
          </li>
          <li>
            Are there genres or structures you're explicitly not
            buying right now?
          </li>
          <li>
            Who's the right person on your team for ongoing deal
            flow?
          </li>
        </ol>

        <p>
          Buyers who answer these questions clearly are easier to
          source for. Buyers who are vague are usually either not
          actively writing checks or trying to keep terms ambiguous —
          either way, worth less of your relationship-building time
          than ones who are direct.
        </p>

        <PullQuote>
          The right deal goes to the right buyer. Routing is the
          scout's job. Buyers compete; artists pick.
        </PullQuote>

        <h2>What's missing from this list (and why)</h2>

        <p>
          You won't find every name in catalog finance here. We
          intentionally exclude:
        </p>

        <ul>
          <li>
            Buyers we haven't seen close an indie deal in the trailing
            6 months
          </li>
          <li>
            Pure-major-label-catalog operations whose indie deal flow
            is effectively zero
          </li>
          <li>
            Family offices and individual investors who don't operate
            as standing buyers (they're real, just not pitchable as a
            standing relationship)
          </li>
          <li>
            Crowdfunding and tokenization plays that haven't
            demonstrated sustained transaction volume
          </li>
        </ul>

        <p>
          If you know a buyer who should be on this list, let us know
          and we'll update on the next quarterly review.
        </p>

        <h2>The bottom line</h2>

        <p>
          The indie catalog financing market in 2026 has more capital
          and more competition than at any prior time. Every artist
          with a financeable catalog should be getting two or three
          indicative offers, not one. Every scout should be routing
          deals to the right buyer for the catalog profile, not just to
          their single favorite relationship. The breadth of the buyer
          landscape is the artist's protection and the scout's
          leverage.
        </p>

        <p>
          For more on how this market works structurally, see{' '}
          <a href="/blog/music-catalog-financing-explained">
            music catalog financing explained
          </a>
          . For the operational side of being a scout in this market,
          see the{' '}
          <a href="/blog/music-catalog-financing-broker-playbook">
            broker playbook
          </a>
          .
        </p>

        <p>
          Praecora is the infrastructure for the sourcing side of this
          work — the Instagram and email outreach, the unified inbox,
          the deal pipeline that speaks catalog-finance. If you're
          actively building a buyer network and need the sourcing
          engine to feed it, <a href="/demo">book a 20-minute demo</a>.
        </p>
      </Prose>
    </BlogPostShell>
  )
}
