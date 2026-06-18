import type { Metadata } from 'next'
import { BlogPostShell } from '../_components/BlogPostShell'
import { Prose, Callout, Lede, PullQuote } from '../_components/Prose'
import { getPostBySlug } from '../posts'

const post = getPostBySlug('cold-dm-indie-artists-instagram')!

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
          Most "cold DM template" advice is written for B2B SMMA sales —
          plug the lead's name into a paint-by-numbers script and send it
          to a thousand prospects. Indie artists eat that for breakfast.
          They've seen every version of it. This piece is the operator's
          guide to writing openers that actually get replies from artists
          worth a catalog deal.
        </Lede>

        <p>
          The first thing to understand about cold-DMing indie artists is
          that they have aggressively well-trained spam filters. Not the
          software kind — the human kind. A working indie musician with
          5,000–50,000 monthly Spotify listeners gets between 30 and 200
          DMs a week from strangers offering services, distribution deals,
          playlist placements, video editing, AI mastering, sync licensing,
          and "exclusive opportunities." They've learned to scan the first
          two words and delete in under a second.
        </p>

        <p>
          You're competing for those two words.
        </p>

        <p>
          This piece breaks down what actually works at the opener, what
          fails reliably, how follow-up cadence affects reply rates, and
          gives you fifteen openers that have produced real replies — with
          enough variation that you can adapt the structure rather than
          copy-paste it. Copy-pasting is what gets you classified as the
          spam you're trying not to be.
        </p>

        <h2>The two-word filter</h2>

        <p>
          An artist scrolling their DMs sees a message preview in their
          notification tray. iOS shows roughly 35 characters of preview.
          Android, slightly more. That preview is the gate. If the first
          two-to-five words don't earn the artist's curiosity, the message
          never gets opened.
        </p>

        <p>
          What instantly fails the two-word filter:
        </p>

        <ul>
          <li>"Hey, love your"</li>
          <li>"Hi, I came"</li>
          <li>"Quick question about"</li>
          <li>"Are you the"</li>
          <li>"Loved your latest"</li>
          <li>"Hope this finds"</li>
          <li>"My team and"</li>
          <li>"I work with"</li>
        </ul>

        <p>
          These all share something: they're <em>opening moves you've seen
          before</em>. The artist's brain has a cached response for every one
          of them: spam. Delete.
        </p>

        <p>
          What earns the next sentence is the opposite — language that
          places the message somewhere outside the cached spam category.
          Specifics. References. Surprise. A line from a song. An odd
          observation about the production. A factual statement that could
          only have been written after listening, not after scraping.
        </p>

        <h3>Two openings that work for the same reason</h3>

        <p>
          Strong:
        </p>
        <blockquote>
          The harp loop on "Vespers" — is that you on the harp or a
          sample? It's the strangest, most beautiful texture I've heard in
          ambient indie this year.
        </blockquote>
        <p>
          Strong:
        </p>
        <blockquote>
          Re: your last EP — track 4's hook is doing something rhythmically
          that I don't have a word for. Is the kick on a different grid
          than the snare?
        </blockquote>
        <p>
          Both of these are obviously not spam. Both pass the two-word
          filter because the artist sees "The harp loop" or "Re: your last"
          — language a marketer would never use — and curiosity overrides
          the cached delete reflex. Both are also genuine questions,
          which earns a reply because answering it costs the artist
          nothing.
        </p>

        <h2>The structure of an opener that gets a reply</h2>

        <p>
          Across the openers that consistently work in our data, a
          structure emerges. Three pieces, in this order:
        </p>

        <ol>
          <li>
            <strong>A specific, true observation about the artist's
            music.</strong> Not their bio. Their music. Something a stranger
            could only have noticed by listening.
          </li>
          <li>
            <strong>A reason that observation matters to you.</strong> Not
            a sales pitch. A reason — even an emotional one — for why you
            paused on it.
          </li>
          <li>
            <strong>A small, easy ask.</strong> The opening message should
            not ask for a 30-minute call. It should ask for one specific
            thing the artist can answer in a sentence. The relationship
            graduates from there.
          </li>
        </ol>

        <p>
          Critically: <strong>no business proposition in the opener</strong>.
          You are not selling catalog financing in the first message. You
          are earning the second message. The pitch lives in messages 3–6,
          after the artist has decided you're worth talking to.
        </p>

        <PullQuote>
          You are not selling catalog financing in the first message. You
          are earning the second message.
        </PullQuote>

        <h2>Fifteen openers that produce real replies</h2>

        <p>
          Here are fifteen tested opener structures. Don't copy these
          verbatim — artists are in tight enough community in their niches
          that pattern-spotting happens fast. Use them as scaffolding and
          customize the specifics from the actual artist you're writing to.
        </p>

        <h4>Production-detail openers</h4>

        <ol>
          <li>
            "The reverb tail on [TRACK] is doing something weird and lovely.
            Long pre-delay? Or is that just the room?"
          </li>
          <li>
            "I keep coming back to the bass on [TRACK]. Sounds like it's
            sitting just behind the kick on purpose. Is that mix
            intentional?"
          </li>
          <li>
            "Listened to [EP/ALBUM] end to end this morning. The decision
            to put [TRACK A] before [TRACK B] is genius — feels like a
            paragraph break."
          </li>
        </ol>

        <h4>Lyric-pause openers</h4>

        <ol start={4}>
          <li>
            "The line in [TRACK] — '[QUOTE LYRIC]' — I haven't been able to
            stop thinking about that all week."
          </li>
          <li>
            "[TRACK] caught me off-guard with the [SPECIFIC LYRIC OR
            IMAGE]. Was that drawn from something specific?"
          </li>
        </ol>

        <h4>Genre-context openers</h4>

        <ol start={6}>
          <li>
            "Genuine question: who else is doing what you're doing in
            [GENRE]? I've been hunting for adjacent artists and your
            catalog stands alone."
          </li>
          <li>
            "If [ESTABLISHED ARTIST IN ADJACENT GENRE] had stayed weirder,
            they'd sound like [TRACK]. Whether you take that as a
            compliment is up to you."
          </li>
        </ol>

        <h4>Trajectory-aware openers</h4>

        <ol start={8}>
          <li>
            "Saw your monthly listeners cracked [X] this week. The trend
            since [PRIOR PERIOD] is steeper than most indie acts I track."
          </li>
          <li>
            "[TRACK] is doing real numbers on [PLATFORM/PLAYLIST] — is the
            growth all organic, or did something hit?"
          </li>
        </ol>

        <h4>Ownership-curious openers (sets up the eventual pitch)</h4>

        <ol start={10}>
          <li>
            "Out of curiosity — is your catalog still 100% yours, or have
            you partnered with anyone on the publishing side? Asking
            because of the way you've structured [SPECIFIC THING]."
          </li>
          <li>
            "Random question: did [TRACK] release independently or through
            a label? The sound design feels intentionally
            non-commercial."
          </li>
        </ol>

        <h4>Live-show openers</h4>

        <ol start={12}>
          <li>
            "Have you played [TRACK] live yet? I'd be curious how the
            arrangement holds up without the [SPECIFIC ELEMENT]."
          </li>
          <li>
            "[TRACK] feels built to be performed. Are you touring this
            year?"
          </li>
        </ol>

        <h4>Visual-aesthetic openers</h4>

        <ol start={14}>
          <li>
            "Whoever did the artwork for [EP/ALBUM] understood the
            assignment. Did you commission it or DIY it?"
          </li>
          <li>
            "The video for [TRACK] is doing a really specific kind of
            staring-into-middle-distance thing. Who directed?"
          </li>
        </ol>

        <Callout label="What none of these openers do">
          <p>
            Notice that none of these mention catalog financing, royalty
            advances, Praecora, your services, or the word "opportunity."
            That's intentional. The opener earns a reply. The reply earns
            you the right to introduce what you're actually about — usually
            three or four messages later, when the artist has asked some
            version of "wait, what do you do?"
          </p>
        </Callout>

        <h2>Reply rates: what's realistic</h2>

        <p>
          Across the operations we run, reply rates on personalized cold
          DMs to indie artists land in a fairly consistent band:
        </p>

        <ul>
          <li>
            <strong>3–5% reply rate</strong> on generic templated openers
            that don't reference the artist's specific music
          </li>
          <li>
            <strong>8–12% reply rate</strong> on personalized openers that
            reference the artist's bio or a recent post (but not their
            music specifically)
          </li>
          <li>
            <strong>15–25% reply rate</strong> on openers that demonstrate
            real attention to the music itself — specific track references,
            production observations, lyrical pauses
          </li>
          <li>
            <strong>30%+ reply rate</strong> on openers that ALSO arrive in
            a moment of trajectory (right after a release, right after a
            playlist add, right after a viral TikTok) — but these are
            episodic and not scalable
          </li>
        </ul>

        <p>
          A note on the math: even at a 20% reply rate, only ~25% of
          replies are real conversations (the rest are short, vague, or
          dismissive). And only ~20% of real conversations qualify for a
          catalog conversation. And only ~30% of qualified conversations
          ultimately close a deal. The funnel from cold DM to closed deal
          runs at roughly 0.2% × 0.25 × 0.20 × 0.30 ≈ 0.03% — three
          closed deals per 10,000 personalized DMs sent. That sounds bad
          until you do the math on a $15K average commission: 3 deals ×
          $15K = $45K per 10,000 DMs. At 140 DMs/day, that's about 70
          days of outreach per $45K closed.
        </p>

        <p>
          We get into more detail on the volume side in our piece on{' '}
          <a href="/blog/instagram-dm-limits-2026">
            Instagram DM limits and safe daily volume
          </a>
          . The TL;DR is that 140 DMs/day per scout is achievable, and the
          economics work even at a 0.03% close rate provided you don't
          torch your accounts to send the volume.
        </p>

        <h2>Follow-up cadence: when to nudge, when to walk</h2>

        <p>
          A surprising amount of catalog deal value lives in messages 2,
          3, and 4 — the gentle re-engagements after an artist has read
          your opener and not replied. Most operators give up too early.
          The right cadence:
        </p>

        <ul>
          <li>
            <strong>Message 1 (Day 0):</strong> The personalized opener.
          </li>
          <li>
            <strong>Message 2 (Day 4):</strong> A new, unrelated reference
            to their music. Not "just bumping this up" — a fresh
            observation. "Also — [DIFFERENT TRACK] does this thing where
            [...]"
          </li>
          <li>
            <strong>Message 3 (Day 11):</strong> A piece of useful
            industry context that doesn't ask for anything. "Saw that
            [SIMILAR ARTIST] signed a sync deal with [BUYER]. Thought of
            you given [SPECIFIC REASON]." Pure value, no pitch.
          </li>
          <li>
            <strong>Message 4 (Day 21):</strong> One direct, low-pressure
            mention of what you do. "Quick context on me, since I keep
            showing up in your DMs: I source catalog financing deals
            for [BUYER TYPE]. Not pitching anything — just want you to know
            where I come from in case any of the above is relevant."
          </li>
          <li>
            <strong>Walk away.</strong> Four messages over three weeks is
            the line. After that, you're noise. If the artist hasn't
            replied to four genuine attempts, they're not going to.
          </li>
        </ul>

        <p>
          The honest read on follow-up: 40–60% of total replies we get
          come on messages 2–4, not message 1. Operators who only send the
          opener and walk away if no reply are leaving half the pipeline on
          the floor.
        </p>

        <h2>What the conversation looks like after the reply</h2>

        <p>
          Let's say the opener worked. The artist replies "thanks, that's
          the snare on the kick grid intentionally yeah". You now have
          permission for two more messages before they decide whether to
          keep engaging. Use them well.
        </p>

        <p>
          A good second message has three jobs: (1) honor the artist's
          reply with a real follow-up to what they said, (2) ask one
          more genuine question that demonstrates ongoing attention, (3)
          set up a credible transition to who you are. Example:
        </p>

        <blockquote>
          That's such a small thing that totally changes the feel — I
          knew something was off-grid but couldn't name it. Quick
          question while I have your ear: are you releasing the next thing
          through the same channel? I scout for a few catalog financing
          partners in the indie-electronic space and I keep ending up on
          your account thinking about whether your trajectory fits a deal
          we're seeing more of lately.
        </blockquote>

        <p>
          Note what's happening: the message honors the reply (specific
          callback), keeps the conversation real (the off-grid observation
          continues), and introduces the catalog-financing context as a
          natural aside rather than a pivot. The artist now knows what you
          do without having been pitched. If they're interested, they'll
          ask. If they're not, you've burned no goodwill.
        </p>

        <p>
          From there, the conversation usually goes one of three ways:
        </p>

        <ul>
          <li>
            <strong>"What's a catalog financing deal?"</strong> — They're
            curious. You're now in education mode. See our piece on{' '}
            <a href="/blog/music-catalog-financing-explained">
              music catalog financing explained
            </a>{' '}
            for the language to use.
          </li>
          <li>
            <strong>"I already have a manager / I'm signed to X / I'm
            not interested."</strong> — Fair. Acknowledge it, thank them
            for the music, and disengage cleanly. The good ones often
            come back six months later when the situation changes. Don't
            close the door.
          </li>
          <li>
            <strong>"Cool, who do you work with / what kinds of deals?"
            </strong> — They're qualifying you. This is the strongest
            possible response. Now is when your buyer relationships
            matter. Name names. Describe deal sizes. Be specific. Vague
            scouts get filtered out at this point; concrete scouts get
            the next conversation.
          </li>
        </ul>

        <h2>Mistakes that destroy reply rates</h2>

        <p>
          Three things, in our data, reliably tank reply rates regardless
          of how good the opener is.
        </p>

        <h3>1. Sending a link in the first message</h3>

        <p>
          Links in cold DMs do two bad things: they trigger Instagram's
          spam-classification model (links are a high-signal feature) and
          they signal to the artist that this is a marketing message.
          Reply rates on opener messages containing a link are about a
          third of opener messages without one. Don't include links until
          the artist has asked for something.
        </p>

        <h3>2. Asking for a call as the first ask</h3>

        <p>
          "Would love to hop on a quick call" is the canonical SMMA tell.
          It also asks for a 30-minute commitment from someone who doesn't
          yet know you're worth 30 seconds. The right first ask is a
          one-sentence answer to a specific question. Calls come in
          messages 5+, after both sides have agreed the conversation is
          worth a phone.
        </p>

        <h3>3. Using AI in a way that's detectable</h3>

        <p>
          Indie artists pattern-match on AI-generated text faster than
          most audiences. The specific tells: starting with "I hope this
          message finds you well," over-use of adjectives ("absolutely
          stunning"), three-clause sentences with all clauses balanced,
          "I particularly enjoyed" constructions, and the obligatory "I'd
          love to learn more about your journey."
        </p>

        <p>
          AI is fine — we use it heavily — but the AI has to write
          differently than how AI usually writes. The way to get there is
          to feed the AI specific input from the artist's actual bio,
          their last few posts, and their Spotify catalog, and prompt it
          to write in a register that doesn't sound like a marketing
          email. We covered our internal approach to this in the{' '}
          <a href="/blog/best-crm-for-music-catalog-scouts">
            CRM piece
          </a>
          ; the short version is that personalization-at-source is what
          makes AI invisible.
        </p>

        <h2>The 24-hour rule and what it means for you</h2>

        <p>
          One last technical note: Instagram's Direct API enforces a
          24-hour reply window for businesses. Once an artist messages you
          back, you have 24 hours to send your next reply before the
          conversation goes into a more limited "messaging window" mode
          where outbound messages are restricted to specific message types.
        </p>

        <p>
          Practically, this means: when a reply comes in,{' '}
          <strong>you need to respond within 24 hours</strong>. Faster is
          better — same-day responses produce noticeably higher follow-up
          rates than next-day ones. But 24 hours is the hard floor.
        </p>

        <p>
          This is one of the reasons unified inboxes matter so much for
          this work. If you're managing 100+ open conversations across
          seven Instagram accounts plus email, the only way you respond to
          every reply within 24 hours is if every reply lands in one
          surface, classified by intent, with your response options
          pre-drafted. Trying to do this by tabbing through seven separate
          Instagram apps on a phone is how you miss the deals that matter.
        </p>

        <h2>Continue the closing-side field guide</h2>

        <p>
          This piece covers the Instagram DM side of opening
          conversations with artists. The closing side of catalog
          deals — qualification, the email channel, operational
          workflow — lives in these adjacent pieces:
        </p>

        <ul>
          <li>
            <strong>
              <a href="/blog/cold-email-templates-music-industry-sales">
                Cold email templates for music industry sales
              </a>
            </strong>{' '}
            — the email half of the multi-channel outreach stack, with
            12 tested template structures for managers and labels
          </li>
          <li>
            <strong>
              <a href="/blog/chartmetric-for-music-catalog-scouts">
                Chartmetric for music catalog scouts
              </a>
            </strong>{' '}
            — the qualification engine. What to look at on Chartmetric
            to know whether an artist is worth pitching
          </li>
          <li>
            <strong>
              <a href="/blog/spotify-for-artists-data-catalog-buyers">
                Spotify for Artists data for catalog buyers
              </a>
            </strong>{' '}
            — the specific data fields buyers care about when
            underwriting deals
          </li>
          <li>
            <strong>
              <a href="/blog/va-workflow-music-catalog-outreach">
                The VA workflow for music catalog outreach
              </a>
            </strong>{' '}
            — hiring, training, and running a VA to handle the
            mechanical layer of outreach
          </li>
        </ul>

        <p>
          For the infrastructure that makes high-volume cold DM
          possible without bans, see{' '}
          <a href="/blog/run-multiple-instagram-accounts-without-bans">
            multiple Instagram accounts: the 2026 playbook
          </a>
          . For the broader role and economics, see{' '}
          <a href="/blog/music-catalog-financing-broker-playbook">
            the music broker playbook
          </a>
          .
        </p>

        <h2>The bottom line</h2>

        <p>
          Cold DMing indie artists at the scale catalog scouting requires
          isn't about writing one good template and sending it widely.
          It's about a process that lets you write a small,
          genuinely-specific message to every artist, follow up well, and
          respond fast when replies come in. Three things, executed
          consistently, beat any "templates that convert!" playbook on the
          internet.
        </p>

        <p>
          If you want to see what this looks like with the personalization
          and follow-up loop fully tooled, <a href="/demo">book a
          20-minute demo</a> and we'll show you the AI-drafted opener
          system and the unified inbox in action with real data. If you'd
          rather keep writing your own openers by hand, we'd suggest one
          adjustment: spend more time listening to the artist than you
          spend writing the message. Every reply rate metric we track says
          that's where the leverage is.
        </p>
      </Prose>
    </BlogPostShell>
  )
}
