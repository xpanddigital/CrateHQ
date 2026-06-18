import type { Metadata } from 'next'
import { BlogPostShell } from '../_components/BlogPostShell'
import { Prose, Callout, Lede, PullQuote } from '../_components/Prose'
import { getPostBySlug } from '../posts'

export const revalidate = 3600

const post = getPostBySlug('email-warm-up-explained-sender-domains')!

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
          Cold email at scale lives or dies on sender reputation. New
          sending domains start with zero reputation and earn it
          through controlled warm-up. Most operators either skip warm-
          up entirely (and watch their emails go to spam from day one)
          or run it incorrectly. Here's how warm-up actually works.
        </Lede>

        <p>
          If you've ever set up a new email sending domain for cold
          outbound, you've encountered the warm-up requirement. Every
          serious cold email tool — Instantly, Smartlead, Lemlist,
          Apollo — has a "warm-up" feature, and every credible cold
          email guide tells you to use it. Most operators set it up
          once, leave it running for a few weeks, and assume the work
          is done. The reality is more nuanced, and getting it wrong
          is one of the more common causes of "my cold emails aren't
          landing in inboxes anymore."
        </p>

        <p>
          This piece is the operator's explanation of what email warm-
          up actually does, how long it really takes, what the major
          warm-up tools get wrong, and the right operating pattern for
          a serious cold outreach domain in 2026.
        </p>

        <h2>What email warm-up actually is</h2>

        <p>
          Email warm-up is the practice of gradually increasing the
          volume of email sent from a new domain (and the engagement
          on those emails) over a period of weeks, in a way that
          builds the domain's sender reputation with mailbox providers
          (Gmail, Outlook, Yahoo, ProtonMail, etc.) before any cold
          outreach goes out.
        </p>

        <p>
          The reason it's needed: every mailbox provider scores each
          sending domain on reputation. A brand-new domain with zero
          send history is treated as zero-reputation by default, which
          means anything it sends has a much higher chance of landing
          in spam or being filtered entirely. Once a domain has built
          reputation through consistent good-faith email behavior,
          mailbox providers extend more trust — and emails from that
          domain start landing in the inbox.
        </p>

        <p>
          Reputation isn't a single number that lives at one mailbox
          provider. Each provider scores you separately, and they
          score on different criteria. The signals that build positive
          reputation:
        </p>

        <ul>
          <li>
            <strong>Authentication.</strong> Properly configured SPF,
            DKIM, and DMARC records on the domain. Non-negotiable.
          </li>
          <li>
            <strong>Engagement.</strong> Recipients opening, reading,
            replying to, and not marking-as-spam your emails. This is
            the heaviest single signal.
          </li>
          <li>
            <strong>Consistency.</strong> Sending at a stable cadence
            over time, not in bursts.
          </li>
          <li>
            <strong>Recipient quality.</strong> Sending to active
            inboxes (not catch-all addresses, not parked domains, not
            high-bounce lists).
          </li>
          <li>
            <strong>Domain age.</strong> Older domains accumulate more
            credibility than brand-new ones, all else equal.
          </li>
          <li>
            <strong>Low bounce rate.</strong> Below 2% bounce rate is
            healthy; above 5% is a red flag.
          </li>
          <li>
            <strong>Low spam complaint rate.</strong> Below 0.1% is
            healthy; above 0.3% can lead to suspension.
          </li>
        </ul>

        <h2>What warm-up tools do</h2>

        <p>
          Warm-up tools (Lemwarm, Mailwarm, Warmup Inbox, the built-in
          warm-up features inside Instantly, Smartlead, Lemlist, etc.)
          simulate engagement signals by connecting your sending
          mailbox to a network of other mailboxes that all email each
          other.
        </p>

        <p>
          The pattern: your tool sends a few low-volume, plausible-
          looking emails per day to other mailboxes in the network.
          Those mailboxes open the emails, reply to them, sometimes
          mark-as-important, and sometimes move them out of spam back
          to the inbox if they end up there. Over weeks, this builds
          a track record of "this domain sends emails that get good
          engagement."
        </p>

        <p>
          The mailbox provider sees: domain X sends ~10 emails a day,
          they get opened, they get replied to, the recipients seem to
          care about them. That's the canonical pattern of a real
          person using email for real conversations. Reputation builds
          accordingly.
        </p>

        <Callout label="What warm-up doesn't do">
          <p>
            Warm-up doesn't grant immunity. It builds baseline
            reputation. Once you start cold outreach, your reputation
            stays good or degrades based on how your cold emails
            actually perform with real recipients — open rates, reply
            rates, spam complaint rates, bounce rates. Warm-up is the
            necessary first step; reputation maintenance is the
            ongoing job.
          </p>
        </Callout>

        <h2>How long warm-up actually takes</h2>

        <p>
          The tools tell you 2–3 weeks. The reality is more like 4–6
          weeks for a domain that's going to send serious cold volume.
          The difference matters because operators who launch cold
          campaigns at week 3 hit the deliverability cliff they
          thought warm-up would prevent.
        </p>

        <p>
          The phased timeline that actually works in 2026:
        </p>

        <h3>Week 1: Authentication + minimal warm-up</h3>

        <p>
          Set up SPF, DKIM, and DMARC records on the new domain.
          Connect the sending mailbox to your warm-up tool at the
          lowest volume (typically 3–5 warm-up emails per day). Send
          zero cold emails. Domain is establishing baseline existence
          to mailbox providers.
        </p>

        <h3>Week 2: Ramp warm-up volume</h3>

        <p>
          Increase warm-up tool's daily volume to 10–15 emails per
          day. Still no cold outreach. The mailbox is now generating
          two-way conversations with the warm-up network, which is
          the engagement pattern reputation systems reward.
        </p>

        <h3>Week 3: Peak warm-up + reality check</h3>

        <p>
          Increase warm-up volume to 20–30 emails per day. Run a test:
          send 5–10 manually-written emails to real recipients you know
          (friends, alternate accounts on Gmail, Outlook, Yahoo).
          Confirm they land in the inbox, not spam. If they're landing
          in spam, do not start cold outreach — warm-up is not
          complete. Continue another week.
        </p>

        <h3>Week 4: Begin cold outreach at very low volume</h3>

        <p>
          If the deliverability test passed, start cold campaigns at
          ~10 cold emails per day. Keep warm-up running at the same
          time. The mailbox is now doing a mix of warm-up traffic +
          real cold sends.
        </p>

        <h3>Weeks 5–6: Gradual cold volume increase</h3>

        <p>
          Increase cold sends by ~10 per day per week. By week 6, the
          mailbox should be doing 40–60 cold sends per day with
          ongoing warm-up traffic.
        </p>

        <h3>Week 7+: Steady-state</h3>

        <p>
          The mailbox is now at full operating volume. Keep warm-up
          running indefinitely at low background level (5–10/day) to
          maintain the engagement signal that supports reputation.
        </p>

        <h2>Why "just use the warm-up tool" isn't enough</h2>

        <p>
          Warm-up tools are necessary but not sufficient. Three
          common failure modes:
        </p>

        <h3>1. Skipping authentication</h3>

        <p>
          SPF, DKIM, and DMARC are the foundation. Without them, no
          amount of warm-up will produce inbox placement at Google
          Workspace or Outlook. Setup is a 30-minute DNS configuration
          job per domain. Operators who skip it because "the warm-up
          tool said I was ready" hit a hard ceiling.
        </p>

        <h3>2. Ignoring the recipient quality signal</h3>

        <p>
          Even with great warm-up, if your first cold campaign goes
          out to a list of 5,000 emails with a 15% bounce rate (dead
          addresses, parked domains, catch-all addresses), your
          reputation tanks fast. Verify your list with a tool like
          NeverBounce, Hunter Verify, or ZeroBounce before sending.
          Aim for under 2% predicted bounce rate.
        </p>

        <h3>3. Treating warm-up as a one-time event</h3>

        <p>
          Warm-up isn't a checkbox you complete and forget about. The
          engagement signal that built your reputation needs to keep
          existing in some form. Most domains should run low-level
          warm-up indefinitely (5–10 warm-up emails per day in the
          background) even while running cold campaigns. Stopping
          warm-up entirely and shifting 100% to cold outreach is a
          pattern reputation systems can read.
        </p>

        <h3>4. Volume jumps that look like attack patterns</h3>

        <p>
          Going from 20 cold sends per day to 200 cold sends per day
          overnight is a pattern almost every mailbox provider has
          trained on. Increase volume gradually — 10–20% week over
          week is the safe rate. Faster ramps trigger deliverability
          drops that take weeks to recover from.
        </p>

        <h2>The math on multiple sending domains</h2>

        <p>
          For serious cold outreach volume, single-domain sending hits
          a ceiling quickly. Most providers (Google Workspace,
          Microsoft 365) cap their sending rates somewhere in the
          200–500 emails per day range per mailbox. Combine that with
          the principle that you don't want to be heavily concentrated
          on one mailbox (single point of failure if that account gets
          flagged), and the math points toward multiple sending
          domains.
        </p>

        <p>
          The pattern serious cold operators use:
        </p>

        <ul>
          <li>
            <strong>Primary brand domain</strong> stays separate —
            never used for cold outreach. Protects the brand's
            deliverability for legitimate transactional and customer
            email.
          </li>
          <li>
            <strong>3–5 secondary sending domains</strong> — close
            variants of the brand domain (yourcompany.co,
            yourcompanyhq.com, get-yourcompany.com, etc.). Each one
            warmed up independently. Each one carries part of the
            outreach load.
          </li>
          <li>
            <strong>2–3 mailboxes per domain</strong> — different
            sender personas, each warmed up independently.
          </li>
          <li>
            <strong>Daily volume per mailbox: 30–50 cold sends max</strong>{' '}
            even at peak. Below the technical platform limits to
            preserve headroom.
          </li>
        </ul>

        <p>
          For a Praecora Whale-tier scout sending 600 emails per day,
          that math typically lands at 4 secondary domains × 3
          mailboxes × ~50 sends/day = 600. Each component well within
          safe limits, no single domain or mailbox bearing concentrated
          risk.
        </p>

        <PullQuote>
          Warm-up isn't a one-time chore. It's the bottom 10% of
          ongoing email send activity, kept running indefinitely so
          the engagement signal never disappears.
        </PullQuote>

        <h2>What goes wrong without proper warm-up</h2>

        <p>
          Operators who launch cold campaigns from cold domains
          (without warm-up) hit one or more of:
        </p>

        <ul>
          <li>
            <strong>Inbox placement under 30%.</strong> Most emails
            land in spam or are filtered before delivery. Open rates
            crater. Even legitimately interested recipients never see
            the message.
          </li>
          <li>
            <strong>Domain blacklisting.</strong> Some reputation
            services (Spamhaus, SORBS, Barracuda) list domains based
            on early send patterns. Once listed, removal takes weeks
            or months.
          </li>
          <li>
            <strong>Mailbox suspension.</strong> Google Workspace and
            Microsoft 365 both suspend mailboxes that hit certain
            spam-complaint thresholds. Re-enabling is possible but
            time-consuming.
          </li>
          <li>
            <strong>Permanent reputation damage to the brand
            domain.</strong> If you used your primary domain for the
            failed cold campaign, recovering its deliverability for
            legitimate uses can take months.
          </li>
        </ul>

        <p>
          The cost of skipping warm-up is the cost of a months-long
          deliverability recovery. The cost of doing warm-up
          correctly is 4–6 weeks of patience.
        </p>

        <h2>Tool recommendations</h2>

        <p>
          Warm-up doesn't need to be a separate tool — most
          serious cold email platforms include it. The reasonable
          choices:
        </p>

        <ul>
          <li>
            <strong>Instantly</strong> — popular, includes warm-up
            as part of the platform. Strong network effect (more
            warm-up nodes = better signal quality).
          </li>
          <li>
            <strong>Smartlead</strong> — direct Instantly competitor.
            Slightly more deliverability-focused tooling, slightly
            smaller warm-up network.
          </li>
          <li>
            <strong>Lemwarm</strong> — Lemlist's standalone warm-up
            product. Mature, well-known. Works with any sending stack.
          </li>
          <li>
            <strong>Warmup Inbox</strong> — independent warm-up
            specialist. Good if you're running a non-standard sending
            stack and need warm-up as a separate layer.
          </li>
        </ul>

        <p>
          For Praecora customers, this layer is managed for you — we
          provision sending domains, run warm-up, and handle the
          deliverability infrastructure as part of the onboarding
          process. The 4-week onboarding period covers warm-up almost
          exactly.
        </p>

        <h2>The bottom line</h2>

        <p>
          Email warm-up is the unglamorous infrastructure that makes
          everything downstream of it work. Skip it and your cold
          emails go to spam. Do it wrong (too fast, no
          authentication, no ongoing maintenance) and you hit a
          deliverability cliff three months in. Do it right and you
          have a domain that sustains real cold-outreach volume for
          years.
        </p>

        <p>
          For more on the broader cold email side of music industry
          outreach, see our piece on{' '}
          <a href="/blog/cold-email-templates-music-industry-sales">
            cold email templates for music industry sales
          </a>
          . For the Instagram side of the multi-channel outreach
          stack (which has its own warm-up rules), see{' '}
          <a href="/blog/instagram-account-warm-up-7-day-checklist">
            Instagram account warm-up
          </a>{' '}
          and{' '}
          <a href="/blog/run-multiple-instagram-accounts-without-bans">
            running multiple Instagram accounts without bans
          </a>
          .
        </p>

        <p>
          If you'd rather have the entire deliverability layer managed
          rather than assembling and maintaining it yourself,{' '}
          <a href="/demo">book a 20-minute demo</a> and we'll walk you
          through the warm-up and domain infrastructure Praecora runs
          for scouts at scale.
        </p>
      </Prose>
    </BlogPostShell>
  )
}
