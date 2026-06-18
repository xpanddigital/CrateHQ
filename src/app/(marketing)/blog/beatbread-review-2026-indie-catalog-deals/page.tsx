import type { Metadata } from 'next'
import { BlogPostShell } from '../_components/BlogPostShell'
import { Prose, Callout, Lede, PullQuote } from '../_components/Prose'
import { getPostBySlug } from '../posts'

export const revalidate = 3600

const post = getPostBySlug('beatbread-review-2026-indie-catalog-deals')!

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
          beatBread is the largest indie-focused royalty advance
          platform in the world — $100M+ deployed across 1,700+ deals
          since 2020. If you're an indie artist exploring catalog
          finance, you'll encounter them. This is the honest operator's
          review of how they actually work, who fits their
          underwriting, and how scouts source for them.
        </Lede>

        <p>
          beatBread launched in 2020 and has spent the last six years
          becoming the default first-stop for independent artists
          looking at catalog financing. The company's pitch is
          straightforward: take a streaming-based artist, run their
          public data through an underwriting model, and produce a
          royalty advance offer within minutes. Cleaner and faster than
          most of the alternatives, with deal sizes that work for
          smaller catalogs the bigger players won't underwrite.
        </p>

        <p>
          We've watched beatBread move from "interesting new entrant"
          to "category leader" while running music catalog sourcing
          operations on the other side. This review covers what they're
          good at, where they're not the right fit, what the deal
          experience actually looks like from inside, and how scouts
          and brokers should think about routing deals to them versus
          other buyers in the market.
        </p>

        <h2>What beatBread is, in one paragraph</h2>

        <p>
          beatBread is a royalty advance platform. Indie artists who
          meet their streaming thresholds can apply, receive a model-
          driven funding estimate based on public streaming data,
          accept an advance against future royalty income, and receive
          payment within weeks. The artist retains ownership of their
          catalog throughout — beatBread takes a temporary assignment
          of royalty cash flow until the advance is recouped, then the
          royalties revert. Standard royalty advance structure executed
          unusually well from a product-experience standpoint.
        </p>

        <h2>The deal economics</h2>

        <p>
          Across the deals we've seen close at beatBread in 2026,
          economics typically fall in this range:
        </p>

        <ul>
          <li>
            <strong>Advance multiple:</strong> 6x–12x annual net royalty
            income for typical indie deals. Higher for catalogs with
            strong year-over-year growth and proven multi-year revenue
            history; lower for catalogs concentrated in one or two
            recent hits.
          </li>
          <li>
            <strong>Deal sizes:</strong> typically $25K–$1M. They'll go
            smaller for the right profile and larger for established
            indie acts. Their sweet spot is the $50K–$300K mid-band.
          </li>
          <li>
            <strong>Recoupment terms:</strong> usually a 65/35 to 75/25
            royalty split (split going to beatBread for recoupment,
            artist continues to receive the remainder). Recoupment
            typically lands inside 5–7 years for healthy catalogs.
          </li>
          <li>
            <strong>Term length:</strong> royalty assignment runs until
            recoupment. No fixed end date on a pure royalty advance;
            some structured variants have caps.
          </li>
          <li>
            <strong>Ownership:</strong> the artist always retains
            ownership of masters and publishing. This is a
            non-negotiable feature, not a tradeable variable.
          </li>
        </ul>

        <p>
          The math example we frequently see: an artist doing
          $36K/year ($3K/month) in net streaming royalties with steady
          year-over-year growth typically gets an offer in the
          $250K–$350K range, with a 70/30 split and 5–7 year expected
          recoupment.
        </p>

        <h2>The qualification criteria</h2>

        <p>
          beatBread's underwriting is more flexible than the
          established peers on some dimensions and stricter on others.
          Practical thresholds we've seen in 2026:
        </p>

        <ul>
          <li>
            <strong>Minimum monthly royalties:</strong> roughly
            $1,500–$2,000/month in net streaming income. Lower than
            Symphonic's typical floor, higher than RoyFi's.
          </li>
          <li>
            <strong>Catalog history:</strong> they want to see at
            least 12 months of consistent streaming income.
            Brand-new releases with one viral track don't fit — the
            underwriting model needs a track record to forecast against.
          </li>
          <li>
            <strong>Catalog diversity:</strong> single-track catalogs
            (one track doing 80%+ of royalty income) get lower
            multiples or rejected because concentration risk is too
            high. Multi-track catalogs with spread income do better.
          </li>
          <li>
            <strong>Ownership cleanliness:</strong> standard
            requirement across all buyers. Co-writer splits, label-
            owned tracks, sync-restricted material — these need to be
            disclosed and may be excluded from the deal.
          </li>
          <li>
            <strong>Distribution status:</strong> active distribution
            through any legitimate distributor (TuneCore, DistroKid,
            CD Baby, Symphonic, label, United Masters, etc.) is fine.
            beatBread doesn't require a switch.
          </li>
        </ul>

        <Callout label="Who beatBread is wrong for">
          <p>
            Artists below the $1,500/month floor, catalogs concentrated
            in one viral track, or artists whose primary income is from
            sync placements rather than streaming. For sub-floor artists,
            RoyFi is usually the better starting point. For sync-heavy
            catalogs, publishers like Spirit Music or Songvest are
            better fits. For one-hit catalogs, no buyer is going to
            give a great offer; the underwriting math doesn't support it.
          </p>
        </Callout>

        <h2>What the deal experience looks like from inside</h2>

        <p>
          The unusual thing about beatBread relative to the rest of the
          buyer landscape is how productized the deal experience is.
          Most catalog buyers run on relationship-driven, manually-
          executed deal flow. beatBread runs on something closer to a
          fintech application flow.
        </p>

        <p>
          A typical artist (or scout-sourced) deal moves through:
        </p>

        <ol>
          <li>
            <strong>Initial inquiry / scout introduction.</strong>{' '}
            Artist or scout reaches out, sometimes through beatBread's
            direct application portal, sometimes through scout relationships.
          </li>
          <li>
            <strong>Data linking.</strong> beatBread requests access to
            streaming statements (Spotify for Artists, distributor
            reports, label statements). Either via direct platform
            authorization or document upload.
          </li>
          <li>
            <strong>Indicative offer.</strong> Their model produces a
            non-binding offer range — typically within 48–72 hours of
            data submission. Faster than the rest of the market.
          </li>
          <li>
            <strong>Term sheet.</strong> If the artist wants to proceed,
            beatBread issues a specific term sheet with numbers, splits,
            recoupment estimates, and exclusions. Negotiation happens
            here.
          </li>
          <li>
            <strong>Diligence.</strong> Verification of ownership,
            review of co-writer splits, confirmation of distribution
            arrangements. Typically 2–3 weeks.
          </li>
          <li>
            <strong>Closing.</strong> Definitive agreement, signature,
            funding via wire. Usually within a week of definitive
            agreement.
          </li>
        </ol>

        <p>
          End-to-end timeline for a clean deal: 4–6 weeks. That's the
          fastest in the indie catalog finance market. Symphonic and
          Connect Music run 6–10 weeks; Xposure runs 8–12 weeks on more
          complex structured deals.
        </p>

        <h2>What beatBread does well</h2>

        <p>
          From operator perspective, beatBread's strengths are:
        </p>

        <ul>
          <li>
            <strong>Speed.</strong> Indicative offers in 48–72 hours is
            genuinely fast. For artists who need to know whether the
            number is going to be exciting enough to warrant a full
            diligence process, this filters quickly.
          </li>
          <li>
            <strong>Volume.</strong> 1,700+ closed deals means they've
            seen most variations of indie catalog and have underwriting
            shortcuts that smaller buyers don't.
          </li>
          <li>
            <strong>Clean documentation.</strong> Term sheets are
            standardized and well-written. The contract isn't a maze of
            edge cases that requires a music lawyer to translate
            (though using one is still recommended).
          </li>
          <li>
            <strong>Ownership preservation.</strong> Artist keeps
            ownership, period. There's no path where beatBread ends up
            owning your masters. For artists worried about exit
            scenarios, this matters more than it should.
          </li>
          <li>
            <strong>Indie-friendly underwriting.</strong> They'll go
            smaller than the bigger buyers, which makes them right for
            artists in the $1.5K–$5K/month band who'd be turned away at
            Symphonic or Xposure.
          </li>
        </ul>

        <h2>Where beatBread is less strong</h2>

        <p>
          Honest assessment of weaknesses:
        </p>

        <ul>
          <li>
            <strong>Model-driven offers can feel impersonal.</strong>{' '}
            The fast turnaround comes from running data through a model
            rather than spending time talking through the catalog story.
            For artists with unusual catalogs (sync-heavy, label-mixed
            ownership, international royalty patterns), the model may
            miss value that a relationship-driven buyer would capture.
          </li>
          <li>
            <strong>Multiples are mid-market.</strong> beatBread isn't
            the highest-multiple offer for premium catalogs. Xposure
            Music and the larger institutional players (Concord,
            Influence Media, Round Hill) will pay more for trophy
            catalogs. beatBread's strength is being the right answer in
            the middle.
          </li>
          <li>
            <strong>Limited customization on deal structure.</strong>{' '}
            They have standardized products. If you want unusual deal
            structures (term-limited reversions, sync-only carveouts,
            hybrid ownership arrangements), they're less flexible than
            relationship-driven buyers.
          </li>
          <li>
            <strong>Less negotiable on the recoupment split.</strong>{' '}
            70/30 is their typical baseline and they don't move much
            below it. Some smaller buyers will write 60/40 splits on
            the right catalog.
          </li>
        </ul>

        <h2>How beatBread fits in the broader buyer landscape</h2>

        <p>
          For scouts sourcing deals across multiple buyers, the
          decision rule we use:
        </p>

        <ul>
          <li>
            <strong>$25K–$75K advance, growth trajectory:</strong>{' '}
            beatBread or RoyFi. beatBread tends to pay slightly more;
            RoyFi is faster for distributor-active artists.
          </li>
          <li>
            <strong>$75K–$300K advance, established indie:</strong>{' '}
            beatBread is the strongest default. Symphonic is an
            alternative if the artist is already distributing through
            them or values the bundled distribution.
          </li>
          <li>
            <strong>$300K–$1M advance, premium indie:</strong>{' '}
            beatBread can compete here but Xposure Music or Connect
            Music will often pay more. Worth getting offers from both
            and letting the artist pick.
          </li>
          <li>
            <strong>$1M+ advance, label-tier indie:</strong> beatBread
            isn't usually the strongest offer at this band. Xposure,
            Intercept, Round Hill, Concord are typically better.
          </li>
          <li>
            <strong>Sync-heavy catalogs:</strong> beatBread is set up
            for streaming-driven catalogs primarily. Publishers (Spirit
            Music Group, Primary Wave) or Songvest are usually better
            fits.
          </li>
        </ul>

        <p>
          For the full buyer landscape, see our piece on the{' '}
          <a href="/blog/music-catalog-buyer-directory-2026">
            music catalog buyer directory
          </a>
          .
        </p>

        <PullQuote>
          beatBread is the right first call for most indie deals. Not
          the right last call for premium ones.
        </PullQuote>

        <h2>How scouts source for beatBread</h2>

        <p>
          For scouts and brokers, beatBread has been one of the more
          accessible buyer relationships in the market. The
          characteristics from a sourcing perspective:
        </p>

        <ul>
          <li>
            <strong>Open to scout-introduced deals.</strong> They have
            a deal-flow team that responds to qualified introductions.
            Cold introductions work better when you bring a specific
            artist already pre-qualified (streaming numbers, catalog
            size, contact info) rather than asking for a general
            relationship conversation.
          </li>
          <li>
            <strong>Standard scout commission applies.</strong> 10% of
            the closed advance is typical; specific terms vary by
            relationship and deal size.
          </li>
          <li>
            <strong>Fast deal-flow feedback.</strong> Because their
            underwriting is model-driven, you get a yes/no on
            indicative offers within days. Lets scouts qualify deals
            quickly without burning weeks on dead leads.
          </li>
          <li>
            <strong>Volume capacity.</strong> They're actively writing
            checks. Scouts don't sit on a list of qualified deals
            waiting for beatBread to have appetite.
          </li>
        </ul>

        <p>
          What works well when pitching beatBread:
        </p>

        <ul>
          <li>
            Artists in the $1.5K–$10K/month band with 12+ months of
            steady streaming history
          </li>
          <li>
            Catalogs with multiple meaningful revenue contributors
            (not one hit + filler)
          </li>
          <li>
            Clean ownership (artist owns masters and publishing, no
            label disputes)
          </li>
          <li>
            Growth trajectory ideally — even slight YoY growth makes
            the multiple math meaningfully better
          </li>
        </ul>

        <h2>The honest read for indie artists considering beatBread</h2>

        <p>
          If you're an indie artist trying to decide whether to start
          with beatBread or shop the broader market first:
        </p>

        <ul>
          <li>
            <strong>If your catalog is in their sweet spot
            ($1.5K–$10K/month, multi-year history):</strong> start
            with beatBread. The offer is likely to be in the right
            ballpark, the process is fast, and you can decide whether
            to shop competitors based on the indicative number.
          </li>
          <li>
            <strong>If you're below their floor:</strong> RoyFi or
            Sound Royalties first. beatBread will probably say no and
            you'll have burned time.
          </li>
          <li>
            <strong>If you're well above their typical deal size
            ($500K+):</strong> get a beatBread offer for reference, but
            don't take it without also getting offers from Xposure or
            Connect Music. The bigger players may pay 15–25% more for
            premium catalogs.
          </li>
          <li>
            <strong>If your catalog is sync-heavy or has unusual
            structure:</strong> beatBread's model-driven approach may
            undervalue you. Talk to publishers or relationship-driven
            buyers.
          </li>
        </ul>

        <h2>The bottom line</h2>

        <p>
          beatBread is what they advertise themselves as: the
          indie-focused royalty advance platform with the best product
          experience in the market and the strongest volume. They're
          not the highest-paying buyer for premium catalogs, but
          they're the right default for most indie deals in the
          mid-band, and their speed makes them a good first call even
          when you intend to shop competitors.
        </p>

        <p>
          For artists exploring this market, read our explainer on{' '}
          <a href="/blog/music-catalog-financing-explained">
            music catalog financing
          </a>{' '}
          to understand the broader product landscape, then check the{' '}
          <a href="/blog/music-catalog-buyer-directory-2026">
            buyer directory
          </a>{' '}
          for alternatives. For scouts considering this work, our piece
          on the{' '}
          <a href="/blog/music-catalog-financing-broker-playbook">
            music broker playbook
          </a>{' '}
          covers the role, the economics, and how to source for buyers
          like beatBread.
        </p>

        <p>
          If you're a scout already in motion and need the
          infrastructure to source consistently at volume —{' '}
          <a href="/demo">book a 20-minute demo</a> of how Praecora
          handles the outreach, qualification, and deal-routing side
          of catalog sourcing.
        </p>
      </Prose>
    </BlogPostShell>
  )
}
