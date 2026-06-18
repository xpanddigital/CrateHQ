import type { Metadata } from 'next'
import { BlogPostShell } from '../_components/BlogPostShell'
import { Prose, Callout, Lede, PullQuote } from '../_components/Prose'
import { getPostBySlug } from '../posts'

export const revalidate = 3600

const post = getPostBySlug('facebook-business-portfolio-multi-account-instagram')!

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
          Every multi-account Instagram operation that survives at scale
          has one piece of infrastructure most operators set up wrong:
          the Facebook Business Portfolio. Get it right and one ban
          stops at one account. Get it wrong and one ban cascades to
          your whole identity graph. Here's the operator's setup guide.
        </Lede>

        <p>
          The <strong>Facebook Business Portfolio</strong> (formerly
          known as Business Manager) is the administrative container
          that owns your Facebook Pages and Instagram Business
          accounts. Every Instagram account connected to an outreach
          operation needs to be linked to a Facebook Page, which lives
          inside a Business Portfolio, which is administered by a
          Facebook personal account. If you've ever set up an Instagram
          Business account, you walked through this chain — whether
          you knew it or not.
        </p>

        <p>
          The reason this matters: Meta's risk model reads the entire
          administrative graph. When Meta decides an Instagram account
          is suspicious, the consequences ladder up the graph —
          potentially affecting the Page that owns the IG, the
          Business Portfolio that contains the Page, and the personal
          Facebook account that administers the Portfolio. Architect
          this graph wrong and one bad incident kills everything.
          Architect it right and the blast radius is contained.
        </p>

        <p>
          This piece is the operator's guide. We'll cover what a
          Business Portfolio actually is, how the cascade-risk works,
          the safe architecture for multi-account operations, and the
          step-by-step setup. We'll also be explicit about where this
          enters the gray-zone of Meta's terms and how to think about
          that honestly.
        </p>

        <h2>What a Facebook Business Portfolio actually is</h2>

        <p>
          A Facebook Business Portfolio is a top-level administrative
          structure that lets one administrator manage multiple
          Facebook Pages, ad accounts, Instagram Business accounts,
          and pixels in one place. It exists at{' '}
          <code>business.facebook.com</code> (now also rebranded as
          Meta Business Suite for some UI surfaces).
        </p>

        <p>
          The hierarchy:
        </p>

        <ul>
          <li>
            <strong>Personal Facebook account</strong> — owns and
            administers Business Portfolios. One person can own
            multiple portfolios.
          </li>
          <li>
            <strong>Business Portfolio</strong> — the container. Owns
            Pages, ad accounts, and Instagram Business connections.
          </li>
          <li>
            <strong>Facebook Pages</strong> — the public-facing brand
            entities. Each Page can connect to one Instagram Business
            account via Instagram's "Connect to Facebook" flow.
          </li>
          <li>
            <strong>Instagram Business accounts</strong> — the public-
            facing IG entities. Each one is connected 1:1 to a Page.
          </li>
        </ul>

        <p>
          For Meta to allow an Instagram Business account to send
          messages via the official Graph API (which is what GHL and
          tools like Praecora use), the IG account must be connected
          to a Facebook Page inside a Business Portfolio. There's no
          API access path that bypasses this. The portfolio is
          required infrastructure.
        </p>

        <h2>Why most setups are wrong (and what gets banned together)</h2>

        <p>
          The mistake we see operators make over and over: one personal
          Facebook account (theirs) administers one Business Portfolio
          that contains all of their Instagram accounts' Pages.
        </p>

        <p>
          This setup is convenient — one login, one dashboard, one
          place to manage everything. It's also a single point of
          failure that takes down the entire operation when Meta
          decides something looks suspicious.
        </p>

        <p>
          The cascade we've seen happen (and personally lived through
          before architecting around it):
        </p>

        <ol>
          <li>
            One Instagram account gets reported by a recipient — could
            be for any reason, often unrelated to anything that account
            actually did wrong.
          </li>
          <li>
            Meta's risk system flags the IG account for review.
          </li>
          <li>
            The flag escalates up the administrative graph. The Page
            that owns the IG gets reviewed.
          </li>
          <li>
            The Business Portfolio that contains the Page gets reviewed.
          </li>
          <li>
            The personal Facebook account that administers the
            Portfolio gets reviewed.
          </li>
          <li>
            If any link in that chain fails review, every entity
            beneath it gets restricted or banned.
          </li>
        </ol>

        <p>
          When this happens, you don't just lose one Instagram account.
          You lose every Instagram account in that portfolio, every
          Page in that portfolio, the portfolio itself, the ad accounts
          attached to it, and — most painfully — the personal Facebook
          account that owned it. That last one matters because your
          personal Facebook may also be tied to legitimate things you
          care about (your real life, your real contacts, your real
          professional history).
        </p>

        <PullQuote>
          One bad incident in a single Instagram account shouldn't be
          able to take out your personal Facebook. That's the entire
          architectural problem.
        </PullQuote>

        <h2>The safe architecture: per-scout alias portfolio</h2>

        <p>
          The architecture we run across Praecora-managed fleets, and
          recommend to any operator running this work seriously:
        </p>

        <ul>
          <li>
            <strong>One alias Facebook personal account per scout.</strong>{' '}
            Not the scout's real Facebook. A separate alias that exists
            specifically to administer their outreach portfolio.
          </li>
          <li>
            <strong>The alias administers one Business Portfolio.</strong>{' '}
            That portfolio contains 5–10 Facebook Pages, each connected
            to one Instagram Business account.
          </li>
          <li>
            <strong>Joel (or the operator) is added as a Partner with
            limited admin access.</strong> Not as the owner. As a
            secondary admin, so if the alias gets compromised, the
            operator can recover.
          </li>
          <li>
            <strong>The scout's real Facebook is never involved in this
            graph.</strong> Not as admin, not as Partner, not as
            anything. Their real identity stays untouched.
          </li>
          <li>
            <strong>Each Page-and-IG pair runs on its own cloud phone.</strong>{' '}
            See our piece on{' '}
            <a href="/blog/cloud-phones-for-instagram-geelark-bitbrowser-multilogin">
              cloud phones for Instagram
            </a>
            for the device-isolation half of the architecture.
          </li>
        </ul>

        <p>
          What this buys you:
        </p>

        <ul>
          <li>
            <strong>Cascade containment per scout.</strong> If
            something goes wrong inside one scout's portfolio, the
            damage is bounded to that scout's 5–10 accounts. It
            doesn't touch other scouts, doesn't touch Joel's identity
            graph, doesn't touch the company's main Facebook presence.
          </li>
          <li>
            <strong>Scout identity protection.</strong> The scout's
            real Facebook, real reputation, and real personal network
            are completely separate from the outreach operation. Even
            if the alias gets banned, the scout's career is untouched.
          </li>
          <li>
            <strong>Recoverability.</strong> Operator-as-Partner means
            if the alias FB gets compromised (forgotten password,
            locked out, etc.), there's a secondary admin who can
            re-establish access without going through Meta's frustrating
            account-recovery flow.
          </li>
        </ul>

        <h2>The 21-day alias Facebook warm-up</h2>

        <p>
          The single most-skipped step in this whole architecture is
          the alias Facebook warm-up. Brand-new Facebook accounts that
          immediately spawn a Business Portfolio and connect five
          Instagram Business accounts get banned within hours. Meta's
          risk system knows what a freshly-created-and-immediately-
          business-active account looks like — it's the canonical
          fingerprint of an abuse operation.
        </p>

        <p>
          The defense: 21 days of looking like a real new Facebook user
          before doing anything business-related.
        </p>

        <p>
          What "looking like a real new user" means, daily:
        </p>

        <ul>
          <li>
            Friend a handful of accounts each week. Aim for plausible
            people in the alias's stated city and demographic. Not
            high-profile accounts. Not obvious bots.
          </li>
          <li>
            Post 1–2 personal posts per week. Photo of food, a sunset,
            a meme. Boring is the goal. Don't post anything
            business-related.
          </li>
          <li>
            Like content from the new friends' feeds at the cadence a
            casual user would.
          </li>
          <li>
            Join 2–3 groups related to the alias's stated interests.
            Comment in them occasionally.
          </li>
          <li>
            Watch some videos, share an article occasionally.
          </li>
          <li>
            Don't message anyone. Don't create a Page. Don't open
            Business Manager. Don't connect Instagram. Just exist as a
            normal new Facebook user for three weeks.
          </li>
        </ul>

        <p>
          On day 22, the alias creates the Business Portfolio. On day
          23, the first Facebook Page goes up. On day 24, the first
          Instagram Business account gets created on its own cloud
          phone and linked to the Page. Then a standard 7-day IG warm-
          up before any DM goes out.
        </p>

        <Callout label="The honest read on the ToS gray zone">
          <p>
            Creating an alias Facebook account technically violates
            Meta's "one account per person, real name" policy. This is
            the same gray zone every multi-account outreach operation
            lives in — agencies, marketing teams, lead-gen shops, and
            cold outreach operators all rely on the same architectural
            patterns. Mitigation isn't pretending you're inside the ToS;
            it's keeping the per-scout isolation tight enough that no
            single revocation kills the business. Plan for periodic
            account losses as a cost of doing business.
          </p>
        </Callout>

        <h2>The setup, step by step</h2>

        <p>
          Once the alias FB has warmed for 21 days, the technical setup
          of the Business Portfolio takes about 30 minutes per scout.
          Here's the sequence:
        </p>

        <h3>Step 1 — Create the Business Portfolio</h3>

        <p>
          From the alias FB, go to <code>business.facebook.com/create</code>{' '}
          and create a new Business Portfolio. Use a generic-sounding
          business name (not the scout's real name). Provide a business
          email — use a Gmail or workspace email that's been active for
          months, not one created last week. Add a phone number that
          matches the alias's stated geography.
        </p>

        <h3>Step 2 — Add the operator as a Partner</h3>

        <p>
          Inside the new Business Portfolio, go to Settings → Users →
          Partners → Add. Use the operator's Business Portfolio ID
          (which they'll provide). Grant the operator's portfolio
          Admin access to this scout's portfolio, but configure
          permissions carefully — Admin is broad, but limit which
          specific assets the operator can touch.
        </p>

        <p>
          This pairing means that if the alias FB gets compromised, the
          operator's portfolio still has admin access to everything in
          the scout's portfolio and can restore access.
        </p>

        <h3>Step 3 — Create the first Facebook Page</h3>

        <p>
          From the Business Portfolio dashboard, Add Assets → Pages →
          Create a new Page. Use a brand name that matches the alias
          persona's Instagram brand (e.g., the alias's curated music
          discovery brand). Add a profile photo, a cover photo, a
          short description. Don't connect any apps yet.
        </p>

        <h3>Step 4 — Create the first Instagram Business account on its dedicated cloud phone</h3>

        <p>
          On the dedicated cloud phone for this account, install
          Instagram, create a new account with the brand identity
          (matching the FB Page), and switch it to a Business account.
          Instagram will prompt you to connect to a Facebook Page —
          choose the one you just created. The connection is now
          live.
        </p>

        <h3>Step 5 — Connect via GHL or Meta Marketplace App</h3>

        <p>
          For Praecora's stack (and any GHL-based stack), this is where
          you install the marketplace app onto the scout's GHL
          sub-account, then complete the Instagram OAuth flow from
          inside GHL. The OAuth flow walks through Facebook permissions
          to grant the marketplace app access to the Instagram Business
          account. Once complete, the API integration is live.
        </p>

        <h3>Step 6 — Repeat for accounts 2 through 5–10</h3>

        <p>
          Each additional Instagram account gets its own dedicated
          cloud phone, its own Page inside the same portfolio, and
          goes through the same connection flow. Spaced out over a
          week or so to avoid creating five Pages in one day, which
          is itself a slightly suspicious pattern.
        </p>

        <h2>Common mistakes to avoid</h2>

        <h3>Don't use your real Facebook to administer</h3>

        <p>
          The single biggest cause of operator pain we've seen. Your
          real Facebook is connected to your real life, your real
          professional network, your real ad accounts for legitimate
          uses, your real ad spend history. Don't let one Instagram
          report ladder up the graph and destroy any of that. Use an
          alias.
        </p>

        <h3>Don't put multiple scouts under one portfolio</h3>

        <p>
          Same logic as above, but at the team level. If Scout A's
          portfolio includes Scout B's Pages and IG accounts, then a
          ban on one of Scout A's IGs can take out Scout B's accounts
          too. Each scout gets their own portfolio. Operationally
          slightly more overhead, structurally much safer.
        </p>

        <h3>Don't skip the alias FB warm-up</h3>

        <p>
          Brand-new Facebook accounts that immediately create Business
          Portfolios get banned within hours. The 21-day warm-up isn't
          optional. We've tested shortcuts (sometimes paid in lost
          accounts to test them). Three weeks is the floor.
        </p>

        <h3>Don't reuse the same address or phone number across portfolios</h3>

        <p>
          Each alias FB and Business Portfolio should have a unique
          email and phone number. Recycling means Meta sees the
          relationship between portfolios at the contact-info level —
          which defeats the per-scout isolation we just built.
        </p>

        <h3>Don't enable two-factor with the same phone number across multiple aliases</h3>

        <p>
          2FA is good. 2FA with shared phone numbers is identity-graph
          leakage. Use a different number for each alias's 2FA, or use
          authenticator apps (which don't share the phone-number
          association).
        </p>

        <h2>What happens when Meta does flag something</h2>

        <p>
          With the alias-portfolio architecture in place, the typical
          incident looks like:
        </p>

        <ul>
          <li>One Instagram account gets banned (per the standard ~1/quarter base rate we see)</li>
          <li>The other 4–9 IG accounts in the same portfolio keep running normally</li>
          <li>The Page connected to the banned IG may or may not be restricted</li>
          <li>The Business Portfolio is unaffected</li>
          <li>The alias Facebook is unaffected</li>
          <li>The scout's real Facebook is completely untouched</li>
        </ul>

        <p>
          Recovery: provision a new cloud phone, create a new IG
          Business account on it, link to a new Page in the existing
          portfolio. ~10 days from incident to back online. The
          operation as a whole doesn't notice — the other accounts
          keep producing, and one slot rotates back in.
        </p>

        <h2>The bottom line</h2>

        <p>
          The Facebook Business Portfolio is the most-overlooked piece
          of multi-account Instagram infrastructure. Operators who set
          it up correctly — alias FB per scout, dedicated portfolio
          per scout, operator-as-Partner for recoverability, 21-day
          warm-up before going live — survive at scale. Operators who
          let their real Facebook be the admin watch one bad incident
          destroy years of work.
        </p>

        <p>
          For the broader multi-account architecture (cloud phones, IP
          isolation, the four-layer fix), see{' '}
          <a href="/blog/run-multiple-instagram-accounts-without-bans">
            multiple Instagram accounts: the 2026 playbook
          </a>
          . For volume math (how many DMs per account per day, why
          fleet-level scaling is the answer to per-account ceilings),
          see{' '}
          <a href="/blog/instagram-dm-limits-2026">
            Instagram DM limits in 2026
          </a>
          . Or, if you'd rather not set up the alias-FB-and-portfolio
          architecture yourself, Praecora handles it end-to-end as part
          of onboarding — <a href="/demo">book a 20-minute demo</a> and
          we'll walk you through what a managed fleet's portfolio
          structure looks like.
        </p>
      </Prose>
    </BlogPostShell>
  )
}
