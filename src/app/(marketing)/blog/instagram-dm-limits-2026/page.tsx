import type { Metadata } from 'next'
import { BlogPostShell } from '../_components/BlogPostShell'
import { Prose, Callout, Lede, PullQuote } from '../_components/Prose'
import { getPostBySlug } from '../posts'

const post = getPostBySlug('instagram-dm-limits-2026')!

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
          The "200 DMs per hour" API rate limit is the ceiling. The
          actual ceiling — the one that gets accounts shut down — is
          much lower, varies by account age, and isn't published anywhere.
          Here's the working operator's math.
        </Lede>

        <p>
          Operators new to multi-account Instagram outreach almost always
          ask the same question: "what's the safe daily DM volume?" And
          they almost always get the same wrong answer: "200 per hour
          per account per Meta's API rate limit." That number is real —
          it's the technical ceiling — but it's not the answer.
        </p>

        <p>
          The actual safe volume depends on three things: how old the
          account is, how it was set up, and what the spam-classification
          model has learned about your messaging pattern. Hit any one of
          those wrong and accounts get throttled or banned at volumes
          well below the 200/hour technical limit. Get them all right
          and a 30+ day old account can safely send 20 DMs/day —
          which, at 7 accounts, becomes 140/day fleet-wide. That's the
          Praecora Whale-tier number. Here's how it gets there.
        </p>

        <h2>The two limits — what's published vs what actually matters</h2>

        <h3>The published technical limit</h3>

        <p>
          Meta's Instagram Graph API documentation lists a rate limit of
          approximately 200 messages per hour per Business account. This
          is the technical ceiling — exceeding it returns API errors.
          For an established, well-aged Business account in good standing,
          you can technically send up to 200 outbound messages in a 60-
          minute window.
        </p>

        <p>
          This is the number every Instagram automation tool talks
          about. It's also wildly misleading for cold outbound use cases.
        </p>

        <h3>The actual spam-classification limit</h3>

        <p>
          Underneath the API rate limit sits Instagram's spam-
          classification model. This model evaluates every outbound DM
          for likelihood of being abuse, and downranks or blocks
          accounts that cross thresholds. The thresholds are not
          published, but from operating fleets through them, the
          shape looks roughly like this:
        </p>

        <ul>
          <li>
            <strong>Days 0–7 of an account's life:</strong> 0 cold
            DMs/day. The account should be doing only consumption
            activity (scrolling, liking, watching stories) during
            warm-up.
          </li>
          <li>
            <strong>Days 8–14:</strong> 2–5 cold DMs/day max. The
            account is post-warm-up but still on probation. The model
            is establishing baseline behavior.
          </li>
          <li>
            <strong>Days 15–30:</strong> 10–15 cold DMs/day. Account
            is being treated as a low-risk new user.
          </li>
          <li>
            <strong>Days 31–60:</strong> 15–20 cold DMs/day. Comfortable
            steady state for a healthy account.
          </li>
          <li>
            <strong>Days 60+:</strong> 20–30 cold DMs/day sustainable
            indefinitely, with caveats around message quality and reply
            rate.
          </li>
        </ul>

        <Callout label="Why 20-30, not 200">
          <p>
            The technical limit (200/hour) was designed for inbound-
            customer-service workflows — a business account replying to
            many customers who messaged first. Cold outbound activates
            a different scoring path. The same account can reply to
            200 inbound messages in an hour without consequence, and
            get throttled for sending 50 cold first-messages in a day.
            The model isn't counting messages; it's counting cold-
            outbound messages, weighted by signals like recipient
            engagement, message similarity, and link density.
          </p>
        </Callout>

        <h2>Why account age matters this much</h2>

        <p>
          Instagram's anti-abuse system uses account age as one of the
          most heavily-weighted features. The logic, from the platform's
          perspective: real users on Instagram tend to be on the
          platform for months or years before they start messaging
          strangers. A brand-new account immediately sending DMs to 50
          people it doesn't follow is the canonical fingerprint of an
          abuse account.
        </p>

        <p>
          The system also doesn't grade leniently when you "warm up"
          incorrectly. Following 500 accounts in 24 hours doesn't make
          the account look old — it makes it look like a fresh abuse
          account doing acquisition. The warm-up has to look like
          normal user behavior over time, which is why the standard
          7-day IG warm-up sequence emphasizes consumption over
          activity.
        </p>

        <h2>The standard 7-day account warm-up</h2>

        <p>
          Before any cold outbound, a new account should run roughly
          this sequence. This is what we do across the Praecora-managed
          fleet:
        </p>

        <ul>
          <li>
            <strong>Day 1:</strong> Profile setup only. Photo, bio,
            highlights, one post. No follows, no DMs, no likes.
          </li>
          <li>
            <strong>Day 2:</strong> Follow 5–8 accounts adjacent to the
            persona's stated interest. Like 5–10 posts in the feed
            Instagram surfaces. Watch a few stories. Total session
            time: 10–15 minutes.
          </li>
          <li>
            <strong>Day 3:</strong> Post a second photo or story. Follow
            another 3–5 accounts. Like 5–10 posts. Watch stories.
          </li>
          <li>
            <strong>Day 4:</strong> Comment on 1–2 posts thoughtfully
            (not just emojis). Continue likes and follows at the same
            rate. Watch stories.
          </li>
          <li>
            <strong>Day 5:</strong> Reply to 1–2 stories. Browse
            Reels for a few minutes. Continue likes, follows, story
            views.
          </li>
          <li>
            <strong>Day 6:</strong> Save 2–3 posts to a collection.
            Continue likes, follows, story views. Try one Reels
            comment.
          </li>
          <li>
            <strong>Day 7:</strong> Send one or two DMs to existing
            mutual follows — friendly messages, not pitch. Continue
            normal activity.
          </li>
        </ul>

        <p>
          On day 8, cold outbound can begin — at the 2–5 DM/day floor.
          Don't jump straight to 20. Ramp slowly:
        </p>

        <ul>
          <li>Days 8–10: 2–3 cold DMs/day</li>
          <li>Days 11–14: 5 cold DMs/day</li>
          <li>Days 15–21: 10 cold DMs/day</li>
          <li>Days 22–30: 15 cold DMs/day</li>
          <li>Days 30+: 20 cold DMs/day steady state</li>
        </ul>

        <p>
          This sequence takes 30 days to reach Whale-tier per-account
          volume. The temptation to skip the ramp is high. Operators
          who skip the ramp lose the account, retry, and discover the
          ramp was actually faster end-to-end. Resist the temptation.
        </p>

        <h2>What gets you throttled before the volume ceiling</h2>

        <p>
          Even an old, well-aged account can get throttled or banned at
          well below 20 DMs/day if it triggers any of the secondary
          signals. The ones to watch:
        </p>

        <h3>Message similarity</h3>

        <p>
          Sending the same template across multiple recipients is the
          single fastest way to get classified as spam. Instagram's
          model computes message similarity across recent outbound
          history; accounts that send 50 copies of the same "hey love
          your sound!" get downranked fast. The defense: real
          personalization, message by message. We covered the
          tactical side in{' '}
          <a href="/blog/cold-dm-indie-artists-instagram">
            How to Cold DM Indie Artists on Instagram
          </a>
          .
        </p>

        <h3>Link density</h3>

        <p>
          Cold DMs containing links get flagged at much higher rates
          than text-only messages. Particularly URLs to Linktree,
          Calendly, generic landing pages, or any URL that looks like
          marketing infrastructure. Cold openers should not contain
          links. Links come later in the conversation, after the
          recipient has asked for something.
        </p>

        <h3>Recipient mismatch</h3>

        <p>
          If the accounts you message tend to be much larger than your
          own (your 200-follower account messaging 100K-follower
          artists), the model interprets this as outreach-asymmetry —
          a strong abuse signal. The defense: your sending account
          should be a real-looking persona with reasonable engagement
          for its size, not a barely-populated shell.
        </p>

        <h3>Report rate</h3>

        <p>
          Recipients can report messages. Even one report among 100
          sends materially affects how Instagram views the sending
          account. If your messages are getting reported (usually
          because they're being received as obvious spam), the volume
          you can sustain drops fast regardless of account age.
        </p>

        <h3>Low engagement on the sending account</h3>

        <p>
          A Business account that's posting actively, getting likes
          and saves, and being engaged with regularly gets a higher
          allowance than a Business account that's purely outbound. The
          model uses your inbound activity as a counter-signal to
          outbound volume.
        </p>

        <h2>The Praecora-tier math</h2>

        <p>
          Putting this all together: a healthy mature Instagram Business
          account (60+ days old, well-warmed, regularly posting, no
          reports against it) can sustain about 20 cold DMs/day
          indefinitely. The math on Praecora's tier ceilings:
        </p>

        <table>
          <thead>
            <tr>
              <th>Tier</th>
              <th>IG accounts</th>
              <th>DMs/account/day</th>
              <th>Fleet DMs/day</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Starter</td>
              <td>1</td>
              <td>20</td>
              <td>20</td>
            </tr>
            <tr>
              <td>Growth</td>
              <td>3</td>
              <td>20</td>
              <td>60</td>
            </tr>
            <tr>
              <td>Pro</td>
              <td>5</td>
              <td>20</td>
              <td>100</td>
            </tr>
            <tr>
              <td>Whale</td>
              <td>7</td>
              <td>20</td>
              <td>140</td>
            </tr>
          </tbody>
        </table>

        <p>
          Notice the per-account number stays at 20. The scaling
          happens by adding accounts, not by increasing per-account
          volume. This is the correct way to scale — every account
          stays well within its safe ceiling, and the fleet capacity
          scales linearly with account count rather than dangerously
          with per-account volume.
        </p>

        <p>
          The temptation, again, is to push per-account higher to save
          on the infrastructure cost of running additional accounts.
          Resist it. The marginal cost of one more cloud phone ($40/
          month) is less than the cost of one account ban. The
          per-account ceiling is real and not worth testing.
        </p>

        <h2>The reply-side math</h2>

        <p>
          Cold outbound is only half the volume story. Once artists
          start replying, the inbound and follow-up volume scales fast.
          At 140 cold DMs/day with a 15% reply rate, you get ~21
          replies/day. Each of those needs a follow-up. Many of those
          need a third and fourth message. Within a few weeks of
          steady cold outreach, the inbound conversation volume can
          exceed the outbound cold volume.
        </p>

        <p>
          The reply-side messages run on a different surface — Meta's
          24-hour messaging window. As long as you respond within 24
          hours of the recipient's last message, the API permits
          outbound. Most operators worry about cold-DM limits; the
          actual operational bottleneck is the reply turnaround. Miss
          the 24-hour window on a hot conversation and the deal goes
          cold.
        </p>

        <p>
          This is one of the reasons Praecora unifies all IG accounts
          plus email into one classified inbox — at 140 DMs/day across
          7 accounts, the only way to never miss a 24-hour window is
          to have all replies surfaced in one place, sorted by intent
          and urgency. We cover the architecture in our piece on the{' '}
          <a href="/blog/best-crm-for-music-catalog-scouts">
            best CRM for music catalog scouts
          </a>
          .
        </p>

        <PullQuote>
          Scaling happens by adding accounts, not by pushing per-account
          volume. The ceiling stays at 20. The fleet grows around it.
        </PullQuote>

        <h2>The signals operators ignore (and shouldn't)</h2>

        <p>
          Three signals that an account is approaching trouble, often
          ignored until it's too late:
        </p>

        <h3>Drop in reply rate</h3>

        <p>
          If your reply rate suddenly drops from 15% to 5% with no
          change in messaging, your messages are likely being soft-
          shadowbanned — delivered but suppressed in the recipient's
          inbox. This precedes hard action by days to weeks. Pull back
          volume immediately when you see this.
        </p>

        <h3>"Action blocked" prompts</h3>

        <p>
          The cold opener attempt that returns "We limit how often you
          can do certain things" is a direct signal the account is
          flagged. Stop all outbound on that account for 48–72 hours,
          let the flag clear, and resume at half-volume.
        </p>

        <h3>Delivery receipts going missing</h3>

        <p>
          When DMs no longer show the small read/delivered receipt
          changes that real conversations have, something has changed
          in how Instagram is routing your messages. Treat as a soft-
          ban warning.
        </p>

        <h2>The bottom line</h2>

        <p>
          The 200/hour API limit is the technical ceiling. The actual
          sustainable cold-DM volume per Instagram Business account is
          about 20 per day for mature, well-aged, properly-warmed
          accounts. Scaling above that happens by adding accounts, not
          by pushing per-account volume. A 7-account fleet sending 20
          each is the architecture Praecora targets at the Whale tier
          and it sustains 140 DMs/day fleet-wide indefinitely when run
          correctly.
        </p>

        <p>
          For the infrastructure that keeps accounts alive at those
          volumes, see{' '}
          <a href="/blog/run-multiple-instagram-accounts-without-bans">
            How to Run 7 Instagram Accounts Without Getting Banned
          </a>
          . For the cloud phone vendor comparison that makes
          per-account isolation possible, see{' '}
          <a href="/blog/cloud-phones-for-instagram-geelark-bitbrowser-multilogin">
            Cloud Phones for Instagram Outreach
          </a>
          .
        </p>

        <p>
          If you'd rather not assemble and tune all of this yourself,
          Praecora runs the full stack — managed account fleet, daily
          volume tuned to the account-age curve, unified inbox for the
          reply side, classification and suggested-response layer for
          the 24-hour-window math.{' '}
          <a href="/demo">Book a 20-minute demo</a> and we'll walk you
          through the daily volume actually being sent from a live
          Whale-tier scout fleet.
        </p>
      </Prose>
    </BlogPostShell>
  )
}
