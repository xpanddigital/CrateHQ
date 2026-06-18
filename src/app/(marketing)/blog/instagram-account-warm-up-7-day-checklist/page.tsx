import type { Metadata } from 'next'
import { BlogPostShell } from '../_components/BlogPostShell'
import { Prose, Callout, Lede, PullQuote } from '../_components/Prose'
import { getPostBySlug } from '../posts'

export const revalidate = 3600

const post = getPostBySlug('instagram-account-warm-up-7-day-checklist')!

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
          Brand-new Instagram Business accounts that immediately send
          DMs get banned within hours. Instagram's anti-abuse model is
          unforgiving toward unwarmed accounts. Here's the daily 7-day
          warm-up sequence we run on every new account in our fleet.
        </Lede>

        <p>
          If you've ever spun up a new Instagram account for outreach
          and watched it get shadowbanned, action-blocked, or banned
          outright within 48 hours, you've experienced what happens
          when an unwarmed account hits Instagram's risk model. The
          pattern of "new account immediately doing outreach behavior"
          is the canonical fingerprint of an abuse operation, and
          Instagram has trained on it for years.
        </p>

        <p>
          The defense is unglamorous: 7 days of looking like a real
          new user before doing anything that looks like outreach.
          This piece is the daily checklist we run across every new
          account in the Praecora-managed fleet. It's boring on
          purpose. Boring is what works.
        </p>

        <h2>Why warm-up matters this much</h2>

        <p>
          Instagram's anti-abuse system weights account age as one of
          the strongest signals. A real user typically signs up,
          spends weeks consuming content casually, occasionally posts
          or messages a friend, and slowly increases activity over
          months. A new account that immediately starts following 100
          accounts, liking hundreds of posts, and sending DMs to
          strangers does not look like any real user — it looks
          exactly like the bots Instagram is trying to suppress.
        </p>

        <p>
          The warm-up isn't optional. Operators who skip it lose
          accounts within days. Operators who run it correctly get
          accounts that last 12+ months under cold outreach load.
          The ROI on 7 days of patience is dramatically positive.
        </p>

        <Callout label="Pre-warm-up: the setup that has to be right first">
          <p>
            The 7-day warm-up assumes the account is provisioned
            correctly. Each account should be on its own dedicated
            cloud phone with a mobile carrier IP, in a Facebook
            Business Portfolio administered by an alias FB that's
            already been warmed for 21 days, with proper profile
            setup. If any of that infrastructure is wrong, no amount
            of warm-up activity saves the account. See{' '}
            <a href="/blog/run-multiple-instagram-accounts-without-bans">
              the multi-account playbook
            </a>
            ,{' '}
            <a href="/blog/cloud-phones-for-instagram-geelark-bitbrowser-multilogin">
              cloud phones for Instagram
            </a>
            , and{' '}
            <a href="/blog/facebook-business-portfolio-multi-account-instagram">
              Facebook Business Portfolio setup
            </a>{' '}
            for the prerequisite architecture.
          </p>
        </Callout>

        <h2>The 7-day daily checklist</h2>

        <h3>Day 1 — Profile completion only</h3>

        <p>
          The account exists but doesn't do anything yet. Today's job:
          make it look real and complete.
        </p>

        <ul>
          <li>Profile photo (high-quality, on-brand)</li>
          <li>Cover photo / first post (single piece of content, branded)</li>
          <li>Complete bio (description, persona, link in bio)</li>
          <li>Highlights covers (at least 2 placeholder highlights)</li>
          <li>Switch to Business account (required for API integration later)</li>
          <li>Link to the Facebook Page in the scout's Business Portfolio</li>
        </ul>

        <p>
          <strong>What NOT to do today:</strong> follow anyone, like
          anything, comment on anything, send any DMs. Just complete
          the profile and close the app.
        </p>

        <p>
          Session length: 15–20 minutes total. Spread across morning
          and evening if possible to look like normal new-user
          behavior.
        </p>

        <h3>Day 2 — First exploration, light following</h3>

        <p>
          Now the account starts looking like a new user discovering
          the platform.
        </p>

        <ul>
          <li>Follow 5–8 accounts adjacent to the persona's stated interest (other indie music accounts, music industry pages, etc.)</li>
          <li>Like 5–10 posts in the feed Instagram surfaces</li>
          <li>Watch 5–10 stories from the followed accounts</li>
          <li>Browse the Reels feed for 3–5 minutes</li>
          <li>Save 1–2 posts to a placeholder collection</li>
        </ul>

        <p>
          <strong>What NOT to do today:</strong> send DMs, comment on
          posts, follow more than 10 accounts.
        </p>

        <p>
          Session length: 15–20 minutes.
        </p>

        <h3>Day 3 — Second post + continued exploration</h3>

        <ul>
          <li>Post a second piece of content (photo or short video)</li>
          <li>Follow another 3–5 accounts</li>
          <li>Like 8–12 posts</li>
          <li>Watch more stories</li>
          <li>Browse Reels for 5+ minutes</li>
        </ul>

        <p>
          <strong>What NOT to do today:</strong> send DMs.
        </p>

        <p>
          Session length: 20–25 minutes.
        </p>

        <h3>Day 4 — First comments + engagement</h3>

        <ul>
          <li>Comment thoughtfully on 1–2 posts (real comments, not emoji-only)</li>
          <li>Continue normal likes (5–10/day) and follows (3–5/day)</li>
          <li>Watch stories from your followed accounts</li>
          <li>Browse Reels and like a few</li>
        </ul>

        <p>
          Session length: 20–30 minutes.
        </p>

        <h3>Day 5 — Story replies (still no DMs)</h3>

        <ul>
          <li>Reply to 1–2 stories from accounts you follow (real, conversational replies)</li>
          <li>Continue likes and follows at the same cadence</li>
          <li>Try a Reel comment</li>
          <li>Save 2–3 posts to your collection</li>
        </ul>

        <p>
          Session length: 20–30 minutes.
        </p>

        <h3>Day 6 — Cross-account engagement</h3>

        <ul>
          <li>Post a third piece of content (story or post)</li>
          <li>Engage actively with accounts in your niche</li>
          <li>Continue likes/follows</li>
          <li>Browse, watch, save normally</li>
        </ul>

        <p>
          Session length: 25–35 minutes.
        </p>

        <h3>Day 7 — First DMs (to existing mutual follows only)</h3>

        <ul>
          <li>Send 1–2 DMs to existing mutual follows — friendly messages, NOT cold outreach</li>
          <li>Continue normal feed activity</li>
        </ul>

        <p>
          Example DMs: "Love your last post — the lighting is wild" to
          an account that engaged with you organically. Conversational,
          short, no business.
        </p>

        <p>
          Session length: 25–35 minutes.
        </p>

        <h2>Day 8 onward — beginning cold outbound</h2>

        <p>
          After day 7, the account has demonstrated the pattern of a
          real user discovering and using Instagram. It can now begin
          cold outreach, but with a careful ramp:
        </p>

        <ul>
          <li>Days 8–10: 2–3 cold DMs per day</li>
          <li>Days 11–14: 5 cold DMs per day</li>
          <li>Days 15–21: 10 cold DMs per day</li>
          <li>Days 22–30: 15 cold DMs per day</li>
          <li>Days 30+: 20 cold DMs per day (steady state)</li>
        </ul>

        <p>
          We covered the per-account daily volume math in detail in our
          piece on{' '}
          <a href="/blog/instagram-dm-limits-2026">
            Instagram DM limits in 2026
          </a>
          . The TL;DR: 20 cold DMs per day is the safe sustainable
          ceiling for a mature account. Scaling fleet volume happens by
          adding accounts, not by pushing per-account volume higher.
        </p>

        <h2>What to keep doing forever (not just during warm-up)</h2>

        <p>
          The warm-up isn't a checkbox you complete and then stop —
          it's the start of a pattern that should continue throughout
          the account's life. Activities that should keep happening
          daily, indefinitely:
        </p>

        <ul>
          <li>
            <strong>Some content consumption</strong> — browse the feed,
            watch stories, like 10–20 posts per day. Pure-outbound
            accounts that consume nothing get downranked over time.
          </li>
          <li>
            <strong>Occasional posting</strong> — 1 post per week
            minimum, plus stories. Active content presence is a real
            trust signal.
          </li>
          <li>
            <strong>Some inbound engagement</strong> — respond to
            comments on your own posts, reply to story replies.
            Builds the "this account has real engagement" signal.
          </li>
          <li>
            <strong>Occasional likes/comments on others' content</strong>{' '}
            beyond your direct outreach — keeps the account's activity
            pattern looking like normal user behavior.
          </li>
        </ul>

        <PullQuote>
          The 7-day warm-up isn't 7 days of work. It's the first 7 days
          of forever. The pattern continues — just at lower intensity —
          for the life of the account.
        </PullQuote>

        <h2>Common warm-up mistakes</h2>

        <h3>Following too many accounts on Day 2</h3>

        <p>
          New users don't follow 50 accounts on their second day. They
          follow 5–10. Operators who try to "speed up" warm-up by
          mass-following on day 2 trigger the same risk signals the
          warm-up was supposed to avoid.
        </p>

        <h3>Bursting activity at the end of each "session"</h3>

        <p>
          Doing 20 likes in 90 seconds, even if it's within the daily
          limit, looks like automation. Spread activity across the
          session — like a post, scroll for a minute, like another,
          watch a story. Mimic real human cadence.
        </p>

        <h3>Skipping the content posting</h3>

        <p>
          Operators sometimes skip posting because the account is for
          outreach, not content. Don't. Empty accounts look fake.
          Even one post a week is meaningfully better than zero.
        </p>

        <h3>Forgetting the Facebook Page connection</h3>

        <p>
          The Instagram Business account must be connected to a
          Facebook Page inside the proper Business Portfolio for the
          API integration to work later. If you skip this on Day 1,
          retroactively connecting it after the account has activity
          is messier.
        </p>

        <h3>Running warm-up identically across all accounts</h3>

        <p>
          If you're warming up 5 accounts simultaneously, vary the
          timing of each one's activity. All 5 accounts liking 10
          posts at 2pm every day is a pattern. Stagger by hour, vary
          the specific actions, treat them as separate human users.
        </p>

        <h2>The bottom line</h2>

        <p>
          Seven days of patient, low-volume, real-user-shaped activity
          is the floor for an Instagram account that's going to do
          serious cold outreach. Skip it and the account dies in days.
          Run it correctly and the account lives for 12+ months.
        </p>

        <p>
          For the broader multi-account architecture (cloud phones,
          alias Facebook, per-scout isolation), see{' '}
          <a href="/blog/run-multiple-instagram-accounts-without-bans">
            the multi-account playbook
          </a>
          . For volume math after warm-up, see{' '}
          <a href="/blog/instagram-dm-limits-2026">
            Instagram DM limits in 2026
          </a>
          . For the infrastructure setup that has to happen first, see{' '}
          <a href="/blog/facebook-business-portfolio-multi-account-instagram">
            Facebook Business Portfolio setup
          </a>
          .
        </p>

        <p>
          Or, if you'd rather have the entire warm-up and account
          infrastructure run as a managed service,{' '}
          <a href="/demo">book a 20-minute Praecora demo</a> — we run
          this exact sequence as part of every new account we
          provision.
        </p>
      </Prose>
    </BlogPostShell>
  )
}
