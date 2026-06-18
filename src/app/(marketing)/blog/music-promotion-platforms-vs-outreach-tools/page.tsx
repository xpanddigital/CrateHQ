import type { Metadata } from 'next'
import { BlogPostShell } from '../_components/BlogPostShell'
import { Prose, Callout, Lede, PullQuote } from '../_components/Prose'
import { getPostBySlug } from '../posts'

export const revalidate = 3600

const post = getPostBySlug('music-promotion-platforms-vs-outreach-tools')!

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
          "Music promotion platforms" and "music sales outreach tools"
          get talked about as if they're the same category. They're
          not. They serve different audiences, do different jobs, and
          cost very different things. Here's the working map for
          indie operators who keep confusing them.
        </Lede>

        <p>
          We get the question often: "I see Praecora, but how does it
          compare to SubmitHub / Groover / Playlist Push?" The honest
          answer: it doesn't, because they do entirely different jobs.
          Both fall under "music marketing platforms" if you squint,
          but the customer, the action, and the outcome are
          completely different.
        </p>

        <p>
          This piece is the clean map of music marketing tooling — by
          job, by audience, by what each one actually delivers. It's
          useful for indie operators (artists, scouts, managers,
          labels) who keep getting recommended tools that don't fit
          their work.
        </p>

        <h2>The two distinct categories</h2>

        <h3>Music promotion platforms</h3>

        <p>
          Tools that help artists get their music in front of more
          listeners. The customer is the artist (or their label/team).
          The action is submitting tracks to curators, playlisters,
          press, or directly to listening audiences. The outcome is
          increased streams, plays, or visibility.
        </p>

        <p>
          Major examples: SubmitHub, Groover, Playlist Push, Daimoon
          Media, MusoSoup, Soundplate Clicks, IndieMono, Boost
          Collective.
        </p>

        <p>
          The business model: artists pay to submit tracks. Curators
          either listen for free or get a small share of submission
          fees. Some tools also offer add-ons (TikTok promotion,
          radio promotion, blog placement).
        </p>

        <p>
          Typical cost: $5–$50 per track submission, or $100–$500 for
          campaign-style packages.
        </p>

        <p>
          What it produces (when it works well): increased streams,
          potentially playlist placements, occasional press mentions.
        </p>

        <h3>Music sales outreach tools</h3>

        <p>
          Tools that help operators in the music industry sell things
          to people in the music industry. The customer is a scout,
          broker, agency, label, or B2B sales operator. The action is
          outreach to artists, managers, A&Rs, publishers, or buyers
          to close a transaction. The outcome is closed deals (catalog
          finance, sync placements, distribution, services, etc.).
        </p>

        <p>
          Major examples: Praecora (music catalog scouting outreach),
          plus general B2B outreach tools (Instantly, Apollo,
          Smartlead) adapted to music industry use cases by their
          users.
        </p>

        <p>
          The business model: SaaS subscription, usually with managed
          infrastructure components.
        </p>

        <p>
          Typical cost: $200–$3,000/month per operator.
        </p>

        <p>
          What it produces: qualified conversations, booked meetings,
          closed deals.
        </p>

        <Callout label="The honest fork">
          <p>
            If you're an artist trying to grow streams, you want a
            promotion platform. If you're a scout, broker, agency, or
            anyone selling into the music industry, you want an
            outreach tool. The two don't substitute for each other.
          </p>
        </Callout>

        <h2>Where the categories get confused</h2>

        <p>
          Three common confusions:
        </p>

        <h3>1. Artists assuming outreach tools will boost their streams</h3>

        <p>
          They won't. Outreach tools send messages to other people in
          the industry on your behalf. They don't put your music in
          front of listeners. An artist who buys Apollo to "promote
          my music" has bought the wrong tool entirely.
        </p>

        <h3>2. Scouts assuming promotion platforms will source deals</h3>

        <p>
          They won't. SubmitHub gets your track to curators; it doesn't
          get you a catalog finance deal. A scout who buys SubmitHub
          to source for buyers has also bought the wrong tool.
        </p>

        <h3>3. Both sides assuming the same listicles apply</h3>

        <p>
          Generic "music marketing tools" listicles tend to mix the
          two categories, which is fine for visibility but produces
          confused buyers. We're trying to break the categories apart
          here because the buying decisions are completely different.
        </p>

        <h2>Music promotion platforms — what indie artists should know</h2>

        <p>
          Quick overview of the major options for artists trying to
          grow streams (not exhaustive, but representative):
        </p>

        <h3>SubmitHub</h3>

        <p>
          The most established submission marketplace. Artists pay
          credits to send tracks to curators (Spotify playlisters,
          music blogs, YouTube channels). Curators either listen and
          decide, or pass. Standard option for artists wanting playlist
          and press placement.
        </p>

        <h3>Groover</h3>

        <p>
          European-leaning competitor to SubmitHub. Strong in indie
          rock, electronic, French/European markets. Direct artist-to-
          curator submission model.
        </p>

        <h3>Playlist Push</h3>

        <p>
          Spotify playlist promotion specifically. Pay-to-pitch
          tracks to a network of playlist curators. More focused than
          SubmitHub's broad submission model.
        </p>

        <h3>Daimoon Media</h3>

        <p>
          TikTok-focused promotion. Pay to have your track promoted by
          TikTok creators. Different mechanic than playlist
          promotion, can drive streaming spikes when it works.
        </p>

        <h3>MusoSoup</h3>

        <p>
          Indie-friendly submission tool. Smaller curator network than
          SubmitHub but generally cheaper per submission.
        </p>

        <h3>Boost Collective, IndieMono, Soundplate Clicks</h3>

        <p>
          Smaller submission/promotion platforms with varied focus —
          some genre-specific, some general indie.
        </p>

        <p>
          Honest read for artists: these tools work for what they're
          for. They don't guarantee placement or stream growth; they
          give your music a shot at being heard by curators. Returns
          are inconsistent. Most working indie artists use 1–2 of
          these per release cycle as part of a broader marketing
          plan, not as their entire strategy.
        </p>

        <h2>Music sales outreach tools — what operators should know</h2>

        <p>
          Quick overview for the other side of the market: people
          selling into the music industry.
        </p>

        <h3>Praecora (catalog scouting specifically)</h3>

        <p>
          Built specifically for music catalog scouts sourcing
          artists for royalty advance and catalog buyout deals. AI-
          drafted Instagram and email outreach, unified inbox, deal
          pipeline. We're the only tool we know of in this exact
          niche.
        </p>

        <h3>Instantly / Smartlead / Lemlist</h3>

        <p>
          Generic cold email tools used heavily by music industry
          operators for manager and label outreach. Not music-specific,
          but the cold email infrastructure (sender domains, warm-up,
          deliverability) is what matters and these tools are mature
          at it. We covered the comparison in{' '}
          <a href="/blog/smartlead-instantly-lemlist-compared-music-industry">
            Smartlead vs Instantly vs Lemlist for music industry
          </a>
          .
        </p>

        <h3>Apollo</h3>

        <p>
          Lead database + outbound sequencing. Used heavily by B2B
          music industry sales (sync agencies pitching brands,
          distributors pitching artists, etc.). Not music-specific but
          has the music industry contacts in its database.
        </p>

        <h3>Outreach / Salesloft</h3>

        <p>
          Enterprise-grade sales engagement. Overkill for indie
          operators; relevant for larger music tech companies running
          structured outbound sales.
        </p>

        <p>
          Honest read for operators: these tools handle the volume +
          deliverability side of B2B music industry outreach. Most
          serious operators use one of the cold email tools (Instantly
          or Smartlead) plus a vertical-specific tool (Praecora for
          catalog scouting) and call it done.
        </p>

        <h2>The combined stack: when both categories matter</h2>

        <p>
          Some operators legitimately use both:
        </p>

        <ul>
          <li>
            <strong>An indie label</strong> might run music promotion
            (SubmitHub, Groover) for their roster's releases AND music
            sales outreach (Instantly, Apollo) for their B2B work
            (sync pitches, sub-publishing deals, distribution
            partnerships). Different tools for different jobs.
          </li>
          <li>
            <strong>An artist-manager hybrid</strong> might run
            promotion tools for the artists they manage AND outreach
            tools for the industry contacts they're building. Different
            stacks for different functions.
          </li>
          <li>
            <strong>A music tech company</strong> might run promotion
            tools for the artists who use their platform AND outreach
            tools for the labels/distributors they're selling into.
          </li>
        </ul>

        <p>
          For these hybrid operators, the right move is two specialized
          tools, not one generic tool that tries to do both badly.
        </p>

        <PullQuote>
          Promotion platforms get artists heard by listeners. Outreach
          tools get operators heard by artists. Don't confuse the two
          — the buying decision is different in every dimension.
        </PullQuote>

        <h2>The bottom line</h2>

        <p>
          Music promotion platforms and music sales outreach tools are
          two distinct categories with different audiences, different
          jobs, and different economics. Mixing them up is the source
          of most "this tool didn't do what I thought it would" pain
          in the music industry tooling market.
        </p>

        <p>
          For artists growing streams: pick from the promotion
          platforms above. For scouts and operators selling into the
          industry: pick from the outreach tools.
        </p>

        <p>
          For music catalog scouting specifically, Praecora is the
          purpose-built option. <a href="/demo">Book a 20-minute demo</a>{' '}
          to see what music-industry-specific outreach tooling looks
          like, or read our piece on{' '}
          <a href="/blog/best-crm-for-music-catalog-scouts">
            best CRM for music catalog scouts
          </a>{' '}
          for the broader landscape.
        </p>
      </Prose>
    </BlogPostShell>
  )
}
