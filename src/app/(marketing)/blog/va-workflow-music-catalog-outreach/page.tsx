import type { Metadata } from 'next'
import { BlogPostShell } from '../_components/BlogPostShell'
import { Prose, Callout, Lede, PullQuote } from '../_components/Prose'
import { getPostBySlug } from '../posts'

export const revalidate = 3600

const post = getPostBySlug('va-workflow-music-catalog-outreach')!

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
          A serious music catalog scouting operation needs a virtual
          assistant. Instagram's cold-opener manual-send requirement
          makes this non-negotiable above ~50 DMs per day. Here's how
          to hire, train, and run a VA for this work — from someone
          who's done it across multiple operations.
        </Lede>

        <p>
          The most-common mistake operators make when they first try
          to scale music catalog outreach: trying to do all the
          mechanical work themselves. Instagram cold opener at 50+
          DMs per day, plus email outreach, plus reply triage, plus
          deal qualification, plus the actual closing conversations —
          one person can't sustain all of it. The closing skills (the
          part that compounds and earns commission) get squeezed out
          by the mechanical work (the part anyone can do).
        </p>

        <p>
          The solution that working scouts converge on is some version
          of a virtual assistant who handles the mechanical layer. We
          run this across every Praecora-managed fleet and have seen
          the pattern enough times to have strong opinions about what
          works.
        </p>

        <p>
          This piece is the operator's guide to hiring, training, and
          running a VA for music catalog outreach. It's tactical
          rather than theoretical — specific workflows, specific
          training materials, specific tools.
        </p>

        <h2>What the VA actually does (and doesn't)</h2>

        <p>
          The VA handles the volume-and-mechanical layer of outreach.
          Specifically:
        </p>

        <ul>
          <li>
            <strong>Cold DM sending on Instagram</strong> from cloud
            phones. The single most-important task. ~30 seconds per
            DM × 100–140 DMs per day = ~70 minutes of focused work
            daily.
          </li>
          <li>
            <strong>Cold email scheduling</strong> via the email
            outreach platform (Instantly, Smartlead, or Praecora
            depending on stack).
          </li>
          <li>
            <strong>Inbox monitoring</strong> across Instagram and
            email — flagging interesting replies, removing obvious
            spam/non-fits, queuing the rest for scout review.
          </li>
          <li>
            <strong>Reply categorization</strong> — sorting incoming
            messages into "scout should respond personally" vs.
            "templated response is fine."
          </li>
          <li>
            <strong>Light data entry</strong> — adding new artists to
            the CRM, marking deal stage advancements, updating contact
            info as needed.
          </li>
          <li>
            <strong>Cloud phone maintenance</strong> — checking each
            account's status daily, refreshing sessions, performing
            warm-up activity (likes, follows, story views) per the
            daily checklist.
          </li>
        </ul>

        <p>
          What the VA does <strong>not</strong> do:
        </p>

        <ul>
          <li>
            Personal closing conversations with qualified artists —
            scout handles these
          </li>
          <li>
            Buyer relationships and routing decisions — scout handles
          </li>
          <li>
            Deal qualification judgment calls — scout handles
          </li>
          <li>
            Anything requiring music industry domain knowledge that
            takes years to build
          </li>
        </ul>

        <p>
          The split: the VA handles repeatable mechanical work; the
          scout handles judgment, relationships, and closing. The VA
          is force-multiplication, not delegation of the work that
          earns commission.
        </p>

        <h2>Where to hire</h2>

        <p>
          Filipino VAs are the standard for music catalog outreach
          operations. The combination of English fluency, work ethic,
          time zone (overlaps US evening hours which is when most
          scouts work), and cost ($400–$800/month full-time) is hard
          to beat.
        </p>

        <p>
          Where to find them:
        </p>

        <ul>
          <li>
            <strong>Onlinejobs.ph</strong> — the largest Filipino VA
            marketplace. Most working VAs in this space have profiles
            here.
          </li>
          <li>
            <strong>Upwork</strong> — broader but more expensive.
            Quality VAs charge $8–$15/hour vs. $4–$6/hour through
            direct Filipino hiring channels.
          </li>
          <li>
            <strong>Direct referrals</strong> from other scouts or
            operators. The best VAs come through warm introductions —
            they've already proven themselves elsewhere.
          </li>
          <li>
            <strong>VA agencies</strong> (Magic, Vasudio, etc.) —
            higher cost but handle hiring, training, and replacement.
            Good if you don't want to manage hiring yourself.
          </li>
        </ul>

        <p>
          Cost expectations:
        </p>

        <ul>
          <li>
            <strong>Direct hire from onlinejobs.ph:</strong> $400–$800/
            month for full-time, $200–$400/month for part-time.
          </li>
          <li>
            <strong>Upwork hire:</strong> $1,200–$2,400/month for
            full-time equivalent.
          </li>
          <li>
            <strong>Agency:</strong> $1,500–$3,000/month for full-time.
          </li>
        </ul>

        <p>
          For most independent scouts, direct hire through
          onlinejobs.ph at $500–$700/month is the right balance of
          cost and quality.
        </p>

        <h2>What to look for in a candidate</h2>

        <p>
          Skills that matter (in order):
        </p>

        <h3>1. Written English</h3>

        <p>
          The VA will read incoming messages and (in the cold opener
          phase) copy-paste AI-drafted personalized messages. They
          don't need to write originally — they need to read English
          accurately and understand context. Filipino English is
          typically strong enough.
        </p>

        <p>
          Test: in the hiring interview, ask them to describe a
          recent music release they enjoyed. Their ability to discuss
          music coherently signals both English and genre fluency.
        </p>

        <h3>2. Attention to detail</h3>

        <p>
          The work is repetitive. Sending 140 DMs per day requires
          consistent execution — copying the right message to the
          right account, recording the send, moving on. Sloppy VAs
          confuse accounts, miss steps, and cost the operation in
          mistakes.
        </p>

        <p>
          Test: give them a 50-line data entry task during the trial
          period. See how accurate the output is.
        </p>

        <h3>3. Reliability + communication</h3>

        <p>
          They'll be working independently most of the time. You
          need someone who shows up on time, finishes assigned work,
          and proactively flags problems. Communication style matters
          — VAs who go silent for days when something is unclear
          create operational drag.
        </p>

        <h3>4. Comfort with technology</h3>

        <p>
          They'll be using cloud phone web UIs, Instagram, email
          platforms, the CRM, Slack/Discord for communication.
          Comfortable-with-tech is a baseline, not optional.
        </p>

        <h3>5. Discretion</h3>

        <p>
          They'll be operating on accounts that aren't theirs and
          shouldn't be discussed publicly. The work doesn't require
          confidentiality on legal grounds, but it does require
          professional discretion.
        </p>

        <p>
          What you can teach: the music industry specifics, the tool
          workflows, what artists in the niche look like. What you
          can't teach: reliability, attention to detail,
          communication culture. Hire for those; train the rest.
        </p>

        <h2>The 30-day onboarding sequence</h2>

        <h3>Days 1–7: Tools and infrastructure</h3>

        <p>
          The VA needs to learn the technical stack before touching
          live accounts:
        </p>

        <ul>
          <li>How the cloud phone web UI works (GeeLark, BitBrowser, or whichever vendor)</li>
          <li>How to operate Instagram from the cloud phone</li>
          <li>How to access the CRM, mark sends, update records</li>
          <li>How to access the email outreach platform</li>
          <li>How Praecora's worklist surface works (which artists to message today, with what copy)</li>
          <li>Communication norms — Slack/Discord, daily reports, escalation paths</li>
        </ul>

        <p>
          Record screen-recorded walkthroughs of every workflow. VAs
          can rewatch them; you don't have to repeat yourself across
          hires.
        </p>

        <h3>Days 7–14: Test runs on warm-up accounts</h3>

        <p>
          New Instagram accounts (still in their 7-day warm-up phase)
          are perfect for VA training. The activity is the same as
          real outreach but the volume is lower and the stakes are
          smaller. Have them:
        </p>

        <ul>
          <li>Run the daily warm-up activity (likes, follows, story views) for new accounts</li>
          <li>Practice the Instagram mobile app workflow until it's smooth</li>
          <li>Test the CRM logging workflow</li>
          <li>Get familiar with what real outreach activity looks like before doing it live</li>
        </ul>

        <h3>Days 14–21: Supervised live outreach</h3>

        <p>
          The VA starts sending live cold openers on real accounts,
          but under close supervision:
        </p>

        <ul>
          <li>Start at low volume (10–20 DMs/day per account, ramping)</li>
          <li>Scout reviews EVERY message before send for the first week</li>
          <li>Daily debrief on what went well, what was confusing</li>
          <li>Build up to full volume over 7–10 days</li>
        </ul>

        <h3>Days 21–30: Independent operation</h3>

        <p>
          The VA is now running daily outreach independently. You
          shift to:
        </p>

        <ul>
          <li>Daily quick-check on numbers (sends, replies, completion rate)</li>
          <li>Weekly 30-minute sync to discuss problems or improvements</li>
          <li>Monthly review of metrics and any process changes</li>
        </ul>

        <p>
          By day 30, the VA should be operating mostly independently
          with light supervision. If they're not, the hire isn't
          working — better to recognize this at month 1 than month 6.
        </p>

        <h2>Daily operational rhythm</h2>

        <p>
          A typical day for a VA on a Praecora-tier outreach
          operation:
        </p>

        <ul>
          <li>
            <strong>Start of day (30 min):</strong> Check each cloud
            phone for status. Quick warm-up activity (a few likes,
            follows, story views per account) to maintain "real user"
            signal.
          </li>
          <li>
            <strong>Mid-morning (~70 min):</strong> Cold opener send
            shift. Work through the day's worklist of 100–140
            personalized cold DMs. ~30 seconds per send.
          </li>
          <li>
            <strong>Late morning (~30 min):</strong> Email scheduling.
            Queue up the day's cold email batch. Review any flagged
            deliverability issues.
          </li>
          <li>
            <strong>Afternoon (~45 min):</strong> Reply triage. Read
            incoming messages, categorize, queue for scout review or
            send templated responses where appropriate.
          </li>
          <li>
            <strong>End of day (~15 min):</strong> CRM updates, daily
            report to scout, prep for tomorrow.
          </li>
        </ul>

        <p>
          Total: ~3.5–4 hours of focused work daily. For a part-time
          VA, this fits in a half-day shift. Full-time VAs typically
          cover this work for 1–2 scouts simultaneously.
        </p>

        <h2>Mistakes operators make running VAs</h2>

        <h3>Hiring too late</h3>

        <p>
          Scouts often try to do everything themselves until they're
          burned out, then panic-hire a VA. The right time to hire is
          when daily outreach volume hits ~30–40 DMs/day — before
          burnout, while you can train carefully.
        </p>

        <h3>Treating the VA as fully outsourced sales</h3>

        <p>
          The VA handles mechanics, not closing. Scouts who try to
          delegate qualification or buyer routing to the VA get worse
          results than scouts who keep judgment in-house.
        </p>

        <h3>Underspending on the VA</h3>

        <p>
          The temptation to hire the cheapest VA ($300/month) creates
          quality problems. The $500–$700/month band is where you
          find VAs with the reliability and attention-to-detail this
          work needs. Saving $200/month and losing accounts to sloppy
          execution is a bad trade.
        </p>

        <h3>Not documenting workflows</h3>

        <p>
          If the VA quits, gets sick, or you need to scale to two
          VAs, undocumented workflows force you to retrain from
          scratch. Screen recordings and written SOPs from day 1.
        </p>

        <h3>Sharing credentials with the VA's personal devices</h3>

        <p>
          The VA accesses cloud phones through the vendor's web UI on
          their own workstation. They never log into Instagram from
          their personal phone or browser — that breaks the per-
          account IP isolation we built carefully. Enforce this.
        </p>

        <PullQuote>
          The VA isn't an outsourced version of you. They're the
          mechanical layer that lets you spend your hours on the work
          that earns commission. Hire accordingly.
        </PullQuote>

        <h2>The cost-benefit math</h2>

        <p>
          A part-time VA at $500/month vs. scout self-execution:
        </p>

        <ul>
          <li>
            <strong>Without VA:</strong> Scout spends ~3 hours/day on
            mechanical work. That's ~15 hours/week — 60 hours/month.
          </li>
          <li>
            <strong>With VA at $500/month:</strong> Scout's 60 hours/
            month freed up. At a closing rate where the scout earns
            $30K–$120K/month, the marginal hour of closing time is
            worth $500–$2,000.
          </li>
        </ul>

        <p>
          ROI: even at the low end, freeing up one hour/week pays
          back the VA cost. At the high end, it's hundreds of times
          ROI. Independent scouts who don't hire a VA typically have
          a self-imposed income ceiling.
        </p>

        <h2>The bottom line</h2>

        <p>
          A virtual assistant is the force-multiplier that lets a
          single scout operate at Pro or Whale-tier volumes. The
          hiring process is straightforward (onlinejobs.ph, $500–
          $700/month band, Filipino VA market). The training takes
          30 days. The ongoing management is light. The ROI is
          almost always positive once you're past ~30 DMs/day in
          volume.
        </p>

        <p>
          For Praecora customers, the VA setup is part of the managed
          service — we provision, train, and operate the VA team for
          you as part of onboarding. For operators building the stack
          themselves, the workflows above are the playbook.
        </p>

        <p>
          For more on the architecture the VA operates within, see{' '}
          <a href="/blog/run-multiple-instagram-accounts-without-bans">
            the multi-account playbook
          </a>{' '}
          and{' '}
          <a href="/blog/cloud-phones-for-instagram-geelark-bitbrowser-multilogin">
            cloud phones for Instagram
          </a>
          . For the broader sourcing role context, see{' '}
          <a href="/blog/music-catalog-financing-broker-playbook">
            the broker playbook
          </a>
          . Or <a href="/demo">book a 20-minute Praecora demo</a> to
          see what a fully-staffed scout operation looks like in
          production.
        </p>
      </Prose>
    </BlogPostShell>
  )
}
