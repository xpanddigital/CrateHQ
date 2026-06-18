import type { Metadata } from 'next'
import { BlogPostShell } from '../_components/BlogPostShell'
import { Prose, Callout, Lede, PullQuote } from '../_components/Prose'
import { getPostBySlug } from '../posts'

const post = getPostBySlug('music-catalog-financing-broker-playbook')!

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
          There's a job in the music industry that almost no one applies
          for, because almost no one knows it exists. The pay is
          commission-only, the hours are yours, and the top operators in
          the niche earn between $200K and $1M a year sourcing deals from
          their phone. Here's how the work actually breaks down.
        </Lede>

        <p>
          In April 2026, three things happened in the same week. Xposure
          Music secured $42.5 million in fresh capital for independent
          catalog acquisitions. Connect Music raised $80 million for the
          same purpose. Futures Music Group closed $6 million for
          independent label and catalog deals. That's $128M of new capital,
          in one week, looking for indie music to buy.
        </p>

        <p>
          beatBread has deployed over $100M across 1,700 funding agreements
          since 2020. Symphonic, Sound Royalties, RoyFi, Royalty Exchange,
          Intercept, and another dozen smaller funds are all writing checks
          into the same market. Together, somewhere between $300M and $500M
          per year is flowing into independent music catalogs from a few
          dozen active buyers, and growing.
        </p>

        <p>
          Here's the part of that story almost no journalist writes:{' '}
          <strong>none of those firms have a sales team.</strong> They have
          underwriters and capital. They don't have people whose job it is
          to find the next 300 artists worth funding. That work — the
          sourcing, the qualifying, the first conversation — gets done by
          a loosely organized network of independent operators called{' '}
          <em>scouts</em>, or sometimes <em>brokers</em>, who source on
          commission and get paid when a deal closes.
        </p>

        <p>
          A typical commission on a closed catalog financing deal is 10% of
          the advance value, paid as a one-time finder's fee by the buyer.
          For an indie deal in the $50K–$500K range, that's $5K–$50K per
          closed deal, paid 30–60 days after signature. Top scouts close
          two to four deals a month. The math gets interesting fast.
        </p>

        <p>
          This piece is a working operator's playbook for the role: what
          the job actually is, how the economics break down, what skills
          matter, how to break in, and where the work is hardest. We'll
          name real buyers and use real numbers. If by the end you think
          this might be your work, the path forward is at the bottom.
        </p>

        <h2>What is a music broker, exactly?</h2>

        <p>
          Quick clarification, because the term gets used loosely. A{' '}
          <strong>music broker</strong>, in the sense this piece means,
          is not a booking agent (who books gigs), not a talent agent
          (who represents artists for management), and not a music
          publisher (who licenses songs). A music broker — also called a
          music catalog scout — sources catalog financing deals between
          independent artists and the funds that buy or finance their
          royalty streams. The broker earns commission (typically 10%
          of the closed advance) from the buyer when a deal funds.
        </p>

        <p>
          If you searched for "music broker" looking for booking-agent
          information, you probably want a different article. If you're
          curious about the people who source catalog finance deals on
          commission, you're in the right place. The rest of this piece
          is the operator's playbook for that role.
        </p>

        <h2>What a music catalog scout actually does</h2>

        <p>
          The role exists because there's a mismatch in the market. On one
          side, you have capital — funds that want to acquire ownership or
          revenue rights to streaming-music catalogs because they produce
          predictable royalty cash flow. On the other side, you have
          independent artists who own their masters and publishing, who
          would benefit from getting paid a multi-year advance against
          their future royalties, but who have no idea this market exists
          and wouldn't know how to access it if they did.
        </p>

        <p>
          The scout's job is to close that gap. Specifically:
        </p>

        <ol>
          <li>
            <strong>Identify qualified artists.</strong> Most independent
            artists are too small to be financeable. The buyer is looking
            for streaming income above some floor (varies by buyer — usually
            $1K–$10K/month in net royalties), an established back catalog,
            and a credible trajectory. The scout has to know what qualified
            looks like before reaching out.
          </li>
          <li>
            <strong>Reach the artist.</strong> Indie artists live on
            Instagram. They don't have agents, lawyers, or industry
            relationships. You can't get to them through the front door of
            the music business because they're not standing at it. You have
            to message them where they actually are.
          </li>
          <li>
            <strong>Frame the opportunity.</strong> Most artists have never
            heard of catalog financing. The first conversation is half
            education ("here's what royalty advances actually are, here's
            why buyers want your masters") and half qualification ("can you
            share your last 90 days of streaming numbers?").
          </li>
          <li>
            <strong>Match to the right buyer.</strong> beatBread is good for
            certain catalog profiles. Symphonic is better for others. RoyFi
            handles the smaller deals. Xposure is selective and pays more
            per dollar of royalty. A scout who routes every deal to one
            buyer leaves money on the table. A scout who knows the buyer
            landscape can quote two or three offers and let the artist pick.
          </li>
          <li>
            <strong>Manage diligence and closing.</strong> The buyer will
            request royalty statements (DistroKid, TuneCore, CD Baby,
            United Masters, or label statements), verify catalog ownership,
            and run their own valuation. The scout's job during diligence
            is keeping the artist responsive and unblocking paperwork,
            because deal velocity dies in the diligence phase if no one
            shepherds it.
          </li>
          <li>
            <strong>Collect commission.</strong> Once the deal funds, the
            buyer issues the scout's commission. Direct deposit, usually
            within 60 days of close. The contract you have with the buyer
            determines the percentage and the payment terms.
          </li>
        </ol>

        <Callout label="What the scout is NOT">
          <p>
            The scout is not the financier. The scout doesn't have a
            balance sheet, doesn't deploy their own capital, and doesn't
            take on the risk of the deal. The scout is also not the
            artist's agent or manager — there's no fiduciary relationship,
            no contract with the artist, and no ongoing role after the
            deal closes. The scout is, structurally, a sourcing partner to
            the buyer. The capital risk is the buyer's; the relationship
            with the artist ends at the closing table unless the scout
            chooses to maintain it.
          </p>
        </Callout>

        <h2>The economics, with real numbers</h2>

        <p>
          The headline number — "10% commission on closed deals" — hides a
          lot of variance. Here's how the math actually breaks down across
          deal size and scout productivity.
        </p>

        <h3>Per-deal commission</h3>

        <p>
          A typical independent catalog financing deal in 2026 falls in one
          of three bands:
        </p>

        <ul>
          <li>
            <strong>Small ($25K–$75K advance).</strong> Artists with $1K–$3K
            monthly streaming income. Common for emerging acts with one
            breakout track. Scout commission: $2.5K–$7.5K.
          </li>
          <li>
            <strong>Mid ($75K–$300K advance).</strong> Artists with
            $3K–$10K monthly. Established indie acts with multi-album
            catalogs. Most common deal size. Scout commission: $7.5K–$30K.
          </li>
          <li>
            <strong>Large ($300K–$2M+ advance).</strong> Artists with
            $10K+ monthly, multi-year track record, often label-affiliated
            indie. Scout commission: $30K–$200K+.
          </li>
        </ul>

        <p>
          Most independent scouts spend most of their time in the
          mid-band. The small deals are too operationally expensive to be
          worth the commission unless the scout has dialed in a high-
          throughput process. The large deals exist but require relationships
          and reputation that take years to build.
        </p>

        <h3>Deal frequency at different operating tiers</h3>

        <p>
          The other variable is how many deals the scout actually closes
          per month. From our data running outreach operations, the
          breakdown by operator effort and skill looks roughly like this:
        </p>

        <table>
          <thead>
            <tr>
              <th>Operator profile</th>
              <th>DMs/emails per day</th>
              <th>Replies/month</th>
              <th>Calls booked/month</th>
              <th>Deals closed/month</th>
              <th>Monthly commission (mid-band $15K avg)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Beginner, manual outreach, 1–2 hrs/day</td>
              <td>20–50</td>
              <td>30–80</td>
              <td>3–8</td>
              <td>0–1</td>
              <td>$0–$15K</td>
            </tr>
            <tr>
              <td>Established, single-account, focused niche</td>
              <td>60–100</td>
              <td>100–200</td>
              <td>10–20</td>
              <td>1–3</td>
              <td>$15K–$45K</td>
            </tr>
            <tr>
              <td>Multi-account, dialed-in, mid-tier infra</td>
              <td>200–400</td>
              <td>300–500</td>
              <td>25–45</td>
              <td>3–8</td>
              <td>$45K–$120K</td>
            </tr>
            <tr>
              <td>Whale tier — top of market</td>
              <td>500–700</td>
              <td>500–800</td>
              <td>40–110</td>
              <td>8–20</td>
              <td>$120K–$300K</td>
            </tr>
          </tbody>
        </table>

        <p>
          A couple of honest notes on this table. First, the "deals closed"
          numbers assume the scout has a deal-routing relationship with at
          least one credible buyer and isn't trying to broker every deal
          themselves. Second, "monthly commission" is averaged across a
          year — deal close timing is lumpy, and any given month a strong
          scout might close zero or four. Third, the tail beyond Whale tier
          exists but isn't a market we know well; the operators clearing
          $500K+ a year are typically working in-house at a buyer rather
          than as independents.
        </p>

        <h3>The cost side</h3>

        <p>
          Independent scouting has real operating costs, especially at
          scale. The infrastructure to send 200–600 personalized touches a
          day across Instagram and email isn't free. We broke this down
          fully in our piece on{' '}
          <a href="/blog/run-multiple-instagram-accounts-without-bans">
            running 7 Instagram accounts without bans
          </a>
          , but the rough order of magnitude for a serious operator:
        </p>

        <ul>
          <li>Cloud phones (5–7 IG accounts × $40/mo) — $200–$280/mo</li>
          <li>VA labor for cold-opener sends — $150–$400/mo shared</li>
          <li>Email infrastructure (domains, warming) — $50–$150/mo</li>
          <li>
            Tools, software, enrichment — $200–$1,500/mo depending on stack
          </li>
        </ul>

        <p>
          Total: $600–$2,300/month for the infrastructure to run a real
          mid-band-to-Whale operation. At a $15K average commission, one
          deal a month covers six months of infra. Most operators we know
          at the Pro and Whale tiers run on 5–15% all-in cost-of-revenue,
          which is unusual margin for any kind of sales work.
        </p>

        <h2>The skills that actually matter</h2>

        <p>
          Music industry knowledge matters less than people assume. What
          matters more, in order:
        </p>

        <h3>1. Judgment about which artists are worth pursuing</h3>

        <p>
          You will see thousands of artists. The scout's edge is in
          recognizing the ones who are actually financeable — and who would
          actually take a deal — within seconds of seeing the profile. This
          skill is part data fluency (knowing what to look for on Spotify
          for Artists, Chartmetric, or via API enrichment) and part
          pattern-matching from having qualified hundreds before.
        </p>

        <h3>2. Writing the opener</h3>

        <p>
          Indie artists have notification fatigue. Their DMs are full of
          spam — fake managers, sketchy promo offers, AI-templated outreach
          from a hundred different "music distribution" services. The
          opener that breaks through demonstrates real attention to the
          artist's actual music. "I just listened to your last EP — the
          drum production on track 3 is doing something interesting" gets a
          reply. "Hey love your sound" does not.
        </p>

        <p>
          The trick: this kind of personalized opener takes 5–10 minutes
          of listening per artist. At 100 artists a day that's a full-time
          job. Either you do that work (low ceiling, real authenticity) or
          you have an AI do most of it (higher ceiling, requires careful
          tuning to not sound like AI). We have strong opinions about how
          this should work; see our piece on{' '}
          <a href="/blog/cold-dm-indie-artists-instagram">
            cold DMing indie artists on Instagram
          </a>{' '}
          for the templates and tactical breakdown.
        </p>

        <h3>3. Handling the "what is this?" conversation</h3>

        <p>
          Most artists you DM have never heard of catalog financing. The
          conversation moves through education before it moves to
          qualification. You need to be able to explain, plainly:
        </p>

        <ul>
          <li>What a royalty advance is (an upfront payment against future royalties, not a loan)</li>
          <li>That they don't lose ownership of their catalog</li>
          <li>What recoupment means (royalties pay back the advance, then revert to them)</li>
          <li>Typical advance multiples (8x–14x annual streaming income for indie deals)</li>
          <li>Who the buyers are and why this market exists</li>
        </ul>

        <p>
          You don't need to be a securities lawyer. You do need to be able
          to demystify this in a 90-second DM exchange without being
          condescending and without overselling.
        </p>

        <h3>4. Relationships with at least one buyer</h3>

        <p>
          This is the hard one. Buyers don't broadly publish "we accept
          incoming scouts" — they work with specific people they trust to
          send qualified deals. Breaking in usually looks like one of
          three paths:
        </p>

        <ul>
          <li>
            Personal introduction from someone the buyer already works with
          </li>
          <li>
            Cold outreach to the buyer's deal-flow lead with a specific
            artist already qualified (so the first interaction is "here's a
            deal" not "let's talk")
          </li>
          <li>
            Working in-house at a buyer for 6–18 months, then leaving to
            scout independently with that relationship intact
          </li>
        </ul>

        <p>
          Most successful independent scouts maintain active relationships
          with 2–4 buyers, so they can route deals based on what each buyer
          actually wants. The breadth of that buyer relationship list is
          one of the strongest indicators of how much money a scout will
          make in a given year.
        </p>

        <h3>5. Closing — but in the catalog sense</h3>

        <p>
          "Closing" doesn't mean what it means in B2B sales. It means
          shepherding a hesitant artist through a 4–8 week diligence
          process without losing them. The artist will ghost. The buyer
          will request a document the artist doesn't have. A competing
          offer will appear. The artist's manager will get involved and
          slow everything down. Real closing skill in this niche is keeping
          the deal moving without being pushy. Empathy + persistence + a
          clear understanding of what's blocked at each step.
        </p>

        <h2>How to break into the work</h2>

        <p>
          If you're considering this as a career or a side income source,
          here's the realistic path from zero to first commission check.
          We're going to be honest about the time horizons because nobody
          else seems willing to be.
        </p>

        <h3>Step 1: Learn the buyer landscape (1–2 weeks)</h3>

        <p>
          Read everything published by Music Business Worldwide,
          Billboard's Pro section, and Hypebot about catalog acquisitions
          in the last 18 months. Read each major buyer's website end-to-
          end: beatBread, Sound Royalties, Symphonic Advances, RoyFi,
          Xposure Music, Connect Music, Intercept, Royalty Exchange,
          Songvest. Notice the differences. Build a private spreadsheet of
          what each one wants and what their typical deal range is. We
          maintain a more comprehensive version of this list in our piece
          on the{' '}
          <a href="/blog/music-catalog-buyer-directory-2026">
            music catalog buyer directory
          </a>
          , but doing the research yourself is worth it.
        </p>

        <h3>Step 2: Reach the buyers (2–4 weeks)</h3>

        <p>
          Identify the head of acquisitions or head of deal flow at each
          target buyer. LinkedIn for the contact, the buyer's website for
          the company narrative, recent interviews or podcasts they've
          done for tone-matching. Reach out via email — not the generic
          "info@" address, but the named person — with a specific
          proposition: "I source independent catalogs in [genre niche]. I
          have three artists currently in conversation who match your
          stated underwriting criteria. Would it be useful if I sent them
          your way?"
        </p>

        <p>
          You won't have three artists yet. You'll have to do step 3
          concurrently. But the question is the right question and it gets
          a reply from buyers who don't reply to "can we talk."
        </p>

        <h3>Step 3: Pick a niche and start sourcing (ongoing)</h3>

        <p>
          Don't try to scout every genre. Pick one. Indie rock, lo-fi hip
          hop, ambient electronic, indie folk, alt R&B, K-indie, Latin
          alternative — narrow enough that you can develop pattern-matching
          for what a financeable artist in that niche looks like. The
          deeper you go, the better your reply rates will be (because your
          openers will be more credible) and the better your qualification
          will be (because you'll spot deal-breakers in seconds).
        </p>

        <p>
          For sourcing, the standard playbook is Instagram + Spotify. Find
          artists in your niche through Spotify's "fans also like" graph,
          editorial playlists, and genre tags. Cross-reference with
          Chartmetric or Soundcharts for income estimates. Pull the artist's
          Instagram from their Spotify bio. Send a personalized DM. Track
          replies. Qualify the interested ones. Pitch the buyer.
        </p>

        <h3>Step 4: The first deal (3–9 months from start)</h3>

        <p>
          Your first deal will take longer than you expect. The artist will
          ghost, come back, ghost again, ask their manager, get cold feet,
          come back with new questions. The buyer will request documents
          the artist doesn't have organized. Diligence will take eight
          weeks instead of four.
        </p>

        <p>
          And then it will close, and you'll get a wire for $10K–$30K, and
          the work suddenly makes a different kind of sense than it did
          when you started. Most scouts we know in the productive tier hit
          their first close within 6 months of starting. Some take 9. A
          few get one in 3. Plan for 6.
        </p>

        <h3>Step 5: Scale (12+ months in)</h3>

        <p>
          Once you've closed your first deal and established the buyer
          relationship, the rate-limiting factor is throughput. You can't
          send 500 personalized touches a day yourself. Most scouts hit
          this ceiling around month 6–12 and start looking for tools, VAs,
          and infrastructure. This is where a purpose-built{' '}
          <a href="/blog/best-crm-for-music-catalog-scouts">
            music industry CRM
          </a>{' '}
          stops being optional. Generic pipeline tools fail this work for
          structural reasons we cover in that piece — for now, the
          short version is: catalog scouting is a conversation-routing
          problem first, a pipeline problem second, and generic CRMs
          only handle the second half.
        </p>

        <Callout label="The honest read on getting in">
          <p>
            This is a viable independent career, not a get-rich-quick
            scheme. The work is real. The economics are real. The 12-month
            runway from "decided to do this" to "earning $5K–$20K per
            month consistently" is real. If you don't have 6 months of
            runway to support yourself while building the buyer
            relationships and the first deal, this isn't the path. If you
            do, it's one of the most autonomous and least-saturated
            commission opportunities in any industry we've found.
          </p>
        </Callout>

        <h2>The market context: why this exists now</h2>

        <p>
          Catalog financing as an asset class wasn't really accessible to
          independent artists before 2018. The market was dominated by
          deals with major labels — Bob Dylan selling his catalog to UMG
          for $300M, Bruce Springsteen selling to Sony for $500M, Stevie
          Nicks's publishing to Primary Wave. Indie artists with $5K/month
          in streaming income had no path to a multi-year advance.
        </p>

        <p>
          Three things changed that. First, streaming economics matured to
          the point where indie catalog revenue became predictable enough
          to underwrite. Spotify, Apple Music, and Amazon collectively paid
          out over $11B in royalties in 2024 alone, and the curve is well-
          established. Second, a generation of music-industry insiders and
          fintech founders saw the gap and built the new platforms —
          beatBread (2020), Connect Music (2020), RoyFi, Xposure, Intercept.
          Third, institutional capital noticed: PE firms, family offices,
          and music-IP-focused funds wanted exposure to the asset class and
          underwrote the new platforms.
        </p>

        <p>
          The result is a market that didn't exist five years ago,
          designed structurally to absorb indie catalogs, with hundreds of
          millions of dollars looking for sourcing. The role of the scout
          exists because the buyers grew faster than their sourcing
          capacity. There will likely be more formal "indie A&R scout"
          job titles within five years; right now, the work is still
          almost entirely on the independent commission model. That window
          is the opportunity.
        </p>

        <PullQuote>
          The buyers grew faster than their sourcing capacity. The work of
          the scout exists in that gap.
        </PullQuote>

        <h2>Continue the broker playbook field guide</h2>

        <p>
          This piece is the overview of the role. For the deeper
          operational and financial pieces of the broker playbook, the
          following articles in the field guide go deeper on specific
          dimensions:
        </p>

        <ul>
          <li>
            <strong>
              <a href="/blog/music-catalog-financing-explained">
                Music catalog financing explained
              </a>
            </strong>{' '}
            — the four product types (royalty advance, catalog
            buyout, term advance, distribution-attached) and how each
            one works structurally
          </li>
          <li>
            <strong>
              <a href="/blog/music-catalog-buyer-directory-2026">
                The music catalog buyer directory
              </a>
            </strong>{' '}
            — every active indie catalog buyer in 2026, their deal
            sizes, what they're underwriting, and how to approach them
          </li>
          <li>
            <strong>
              <a href="/blog/how-to-become-ar-scout-independent-path">
                How to become an A&R scout (the independent path)
              </a>
            </strong>{' '}
            — the independent commission-based path vs. the
            traditional label-employee path
          </li>
          <li>
            <strong>
              <a href="/blog/beatbread-review-2026-indie-catalog-deals">
                beatBread review 2026
              </a>
            </strong>{' '}
            — operator's-perspective deep dive on the largest
            indie-focused buyer
          </li>
          <li>
            <strong>
              <a href="/blog/music-catalog-valuation-multiples-2026">
                Music catalog valuation multiples
              </a>
            </strong>{' '}
            — the math behind what catalogs are actually worth and
            how multiples are calculated
          </li>
          <li>
            <strong>
              <a href="/blog/royalty-advance-vs-catalog-sale-indie-artists">
                Royalty advance vs catalog sale
              </a>
            </strong>{' '}
            — when each structure is right and the long-term
            consequences for the artist
          </li>
          <li>
            <strong>
              <a href="/blog/independent-music-distribution-vs-catalog-buyers">
                Independent music distribution companies vs catalog
                buyers
              </a>
            </strong>{' '}
            — clean breakdown of two categories that get conflated
            constantly
          </li>
        </ul>

        <p>
          For the operational infrastructure side of running a scout
          operation (Instagram fleets, cold email, deal pipeline), see
          the other field guide pillars:{' '}
          <a href="/blog/run-multiple-instagram-accounts-without-bans">
            multiple Instagram accounts
          </a>
          ,{' '}
          <a href="/blog/cold-dm-indie-artists-instagram">
            cold DM indie artists on Instagram
          </a>
          , and{' '}
          <a href="/blog/best-crm-for-music-catalog-scouts">
            the music industry CRM
          </a>{' '}
          piece.
        </p>

        <h2>The closing question</h2>

        <p>
          The question we get from people considering this work is some
          version of: "is it real, or is it a hustle?"
        </p>

        <p>
          The honest answer: it's real, but it's not for everyone. It
          requires patience for a 6-month runway, comfort with rejection
          (most DMs go unanswered, most replies don't convert, most
          conversations don't close), and the ability to operate without a
          manager telling you what to do. The people who do well in it
          tend to share a few traits: independent, comfortable with sales,
          genuinely interested in music, organized enough to keep dozens of
          conversations straight, and willing to do the unsexy
          infrastructure work to keep their Instagram accounts alive.
        </p>

        <p>
          If those traits describe you and the numbers above look
          interesting, we'd suggest doing two things. Read our piece on{' '}
          <a href="/blog/music-catalog-financing-explained">
            music catalog financing explained
          </a>{' '}
          to get fluency in the products you'd be sourcing. Then look at
          the{' '}
          <a href="/blog/music-catalog-buyer-directory-2026">
            buyer directory
          </a>{' '}
          and pick three buyers to study deeply.
        </p>

        <p>
          When you're ready to actually start sourcing, Praecora handles
          the infrastructure side — the Instagram fleet, the AI-drafted
          personalized DMs, the unified inbox where replies land, the deal
          pipeline. <a href="/demo">Book a 20-minute demo</a> and we'll
          show you what a scout's daily workflow actually looks like with
          the tooling in place. If you decide to build the whole stack
          yourself instead, all the better — we'd rather the market be
          full of good operators than under-served.
        </p>
      </Prose>
    </BlogPostShell>
  )
}
