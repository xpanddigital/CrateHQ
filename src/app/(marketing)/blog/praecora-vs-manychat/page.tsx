import type { Metadata } from 'next'
import { BlogPostShell } from '../_components/BlogPostShell'
import { Prose, Callout, Lede, PullQuote } from '../_components/Prose'
import { getPostBySlug } from '../posts'

const post = getPostBySlug('praecora-vs-manychat')!

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
          ManyChat is one of the best-built tools in the Instagram
          marketing category. It's also the wrong tool for cold outbound
          sourcing in the music catalog space. The reason is
          architectural, not preferential — here's where each tool fits
          and why music scouts should know the difference.
        </Lede>

        <p>
          If you've Googled "Instagram automation for sales," ManyChat is
          one of the first three names you saw. It's well-funded, has a
          generous free tier, integrates with most marketing stacks, and is
          a legitimate Meta Business Partner. For the use case it's
          designed for — conversational marketing triggered by inbound
          engagement — it's genuinely excellent.
        </p>

        <p>
          The problem is that catalog scouts have been told by enough
          listicles that ManyChat is "the Instagram DM tool" that they
          adopt it for sourcing, hit a wall in week two, and end up
          frustrated with software that was never going to fit. This piece
          is a careful walkthrough of where the architectural mismatch
          sits, so you can make the call with eyes open.
        </p>

        <h2>What ManyChat is actually built for</h2>

        <p>
          ManyChat is a conversational marketing platform. Its core flow:
        </p>

        <ol>
          <li>
            A user takes an action that signals engagement intent —
            comments a keyword on your post, replies to your story, taps
            an ad, sends a DM with a specific word.
          </li>
          <li>
            ManyChat detects that trigger and starts a pre-built
            conversation flow — automated DMs, branching logic, a path to
            email capture or product link.
          </li>
          <li>
            The conversation runs inside Meta's "messaging window" rules,
            which allow business accounts to message users who have
            engaged with them in the last 24 hours.
          </li>
        </ol>

        <p>
          That model is built squarely on Meta's permitted automation
          surface. Comment-triggered DMs, story-reply automation,
          ad-to-DM flows — all of it is fully sanctioned by the
          Instagram Graph API, all of it sits inside the 24-hour
          messaging window, and all of it requires the user to have done
          something first. This is why ManyChat accounts don't get banned
          — the platform is built around what Meta allows, by design.
        </p>

        <h2>What music catalog scouting actually requires</h2>

        <p>
          Catalog scouting inverts every one of those assumptions.
        </p>

        <ul>
          <li>
            <strong>You're sending the first message.</strong> The artist
            hasn't commented on your post, replied to your story, or
            tapped an ad. They don't know you exist. You're the one
            initiating contact — which Meta's Direct API explicitly does
            not support.
          </li>
          <li>
            <strong>There's no trigger to react to.</strong> ManyChat's
            entire model assumes there is. With no trigger, there's no
            flow to start. The tool has nothing to do.
          </li>
          <li>
            <strong>The 24-hour window doesn't apply yet.</strong> The
            messaging window opens after the artist messages you back.
            Until then, you're outside the window — which means you
            cannot send anything via the API.
          </li>
          <li>
            <strong>The conversation is one-of-one, not flow-based.</strong>{' '}
            Even if you could get the cold message out, the right
            follow-up depends on what the artist said. Pre-built flows
            can't anticipate "is the snare on a different grid than the
            kick?" as a reply, because that conversation isn't
            scriptable.
          </li>
        </ul>

        <p>
          ManyChat doesn't fail at catalog scouting because it's poorly
          built. It fails because the work isn't conversational marketing
          — it's outbound sales into a relationship that doesn't exist
          yet. Different sport. Different tool needed.
        </p>

        <h2>The architectural difference, drawn out</h2>

        <p>
          Side by side, here's where the two tools land:
        </p>

        <table>
          <thead>
            <tr>
              <th>Capability</th>
              <th>ManyChat</th>
              <th>Praecora</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Cold first-message to artist</td>
              <td>Not supported (Meta API limitation)</td>
              <td>VA-manual on cloud phone, ~30s/artist</td>
            </tr>
            <tr>
              <td>Personalization based on artist's music</td>
              <td>None — flows are templates</td>
              <td>AI reads bio + posts + Spotify catalog before drafting</td>
            </tr>
            <tr>
              <td>Trigger model</td>
              <td>Inbound only (comment, story, ad)</td>
              <td>Outbound-first; replies route through unified inbox</td>
            </tr>
            <tr>
              <td>Reply handling</td>
              <td>Pre-built conversation flows / chatbot</td>
              <td>AI classification + suggested response; human sends</td>
            </tr>
            <tr>
              <td>Email channel</td>
              <td>Limited — adjacent product</td>
              <td>First-class, unified with IG in one inbox</td>
            </tr>
            <tr>
              <td>Multi-account orchestration</td>
              <td>One account per workspace (paid scaling)</td>
              <td>5–10 accounts per scout, designed-in</td>
            </tr>
            <tr>
              <td>Account safety architecture</td>
              <td>Inherits from Meta API permissions</td>
              <td>Cloud phones, alias FB, IP isolation managed</td>
            </tr>
            <tr>
              <td>Deal pipeline</td>
              <td>None — not its purpose</td>
              <td>Catalog-deal stages, commission tracking</td>
            </tr>
            <tr>
              <td>Built for</td>
              <td>Coaches, creators, e-commerce — opt-in audiences</td>
              <td>Music catalog scouts — outbound to qualified artists</td>
            </tr>
          </tbody>
        </table>

        <h2>The "but I'll just use ManyChat anyway" path</h2>

        <p>
          Some operators see this comparison and conclude that they'll
          use ManyChat for the reply-handling side and do the cold opener
          manually. The reasoning sounds right — ManyChat handles the
          chatbot, you handle the cold side. In practice it doesn't hold
          up.
        </p>

        <p>
          Three reasons:
        </p>

        <ol>
          <li>
            <strong>Replies don't fit a chatbot.</strong> A real reply
            from an interested artist looks like "yeah it's actually a
            tuned 808 I'm running through tape sim, why?" There is no
            ManyChat flow that produces a useful response to that. Cold-
            outbound sales conversations are one-of-one and human; bots
            make them feel like marketing.
          </li>
          <li>
            <strong>Two surfaces is worse than one.</strong> You'll have
            ManyChat for IG and something else for email and a sheet for
            deal tracking. Three apps. Three places to lose a
            conversation.
          </li>
          <li>
            <strong>The Meta API restriction is the actual constraint.</strong>{' '}
            Once you're outside the 24-hour window, ManyChat can't send
            anything at all. So when an artist replies on Tuesday and you
            don't catch it until Thursday, ManyChat is locked out and the
            conversation dies. The right tool stays in the window or
            handles re-engagement deliberately.
          </li>
        </ol>

        <Callout label="When ManyChat IS the right tool">
          <p>
            If you're running an Instagram audience as a content creator
            or coach, and your sales motion is "audience engages → DM
            funnel → consultation booking," ManyChat is excellent. The
            tool's strengths play. We'd use it ourselves for that work. The
            argument here is only that catalog scouting is structurally
            different — it isn't a knock on ManyChat as a product.
          </p>
        </Callout>

        <h2>What "outbound-first" actually looks like in practice</h2>

        <p>
          Since the inversion of the model is the whole story, here's
          what Praecora does on the outbound side that ManyChat does not:
        </p>

        <p>
          <strong>Enrichment-first drafting.</strong> Before any message
          goes out, the AI pulls the artist's Instagram bio, recent
          posts, public press, and Spotify catalog (top tracks, monthly
          listeners, genre tags, release cadence). The opener is drafted
          with reference to specific facts — a track name, a lyric, a
          production observation, a trajectory note. The artist receives a
          message that could only have been written after listening.
        </p>

        <p>
          <strong>Manual send on cloud phone.</strong> The cold opener
          itself is sent by a virtual assistant tapping the actual
          Instagram mobile app on a dedicated cloud phone per account.
          Not an API call. Not a browser bot. A human, ~30 seconds per
          send. This is what keeps the accounts alive — and it's why the
          cold side of Praecora can't run on the same infrastructure
          ManyChat uses. We covered the full architecture in{' '}
          <a href="/blog/run-multiple-instagram-accounts-without-bans">
            How to Run 7 Instagram Accounts Without Getting Banned
          </a>
          .
        </p>

        <p>
          <strong>Replies route to a unified inbox.</strong> Once an
          artist replies, the conversation moves into the 24-hour API
          window and Praecora handles it through the official Graph API.
          Every reply lands in one place — across all of a scout's IG
          accounts and their cold email channel — classified by intent
          (interested, manager handoff, not interested, asking a question,
          objection, ghost, etc.). The scout sees a triaged inbox, not a
          chaotic stack of seven Instagram apps.
        </p>

        <p>
          <strong>Suggested responses, not chatbot replies.</strong> The
          AI drafts a suggested reply for each message based on the
          classification and the conversation context. The scout reviews,
          edits, and sends with one click. No flow. No "if user says X
          then bot says Y." Just the operator, faster.
        </p>

        <h2>What's the same</h2>

        <p>
          To be fair to ManyChat: a few things <em>do</em> overlap
          between the two tools, and where they overlap, ManyChat is
          mature and Praecora is not trying to be different for
          difference's sake.
        </p>

        <ul>
          <li>
            Both respect Meta's API rules within the 24-hour messaging
            window
          </li>
          <li>
            Both use official Instagram Graph API integrations (Praecora
            via GHL's marketplace app)
          </li>
          <li>
            Both surface conversations through a web UI rather than the IG
            mobile app
          </li>
          <li>
            Both are built by teams that understand Meta's risk model
          </li>
        </ul>

        <p>
          The difference is what each one chooses to <em>not</em> do.
          ManyChat doesn't do cold outbound, by design — Meta's rules
          don't allow it via the API, so building it would either break
          the tool or violate the platform. Praecora doesn't do
          chatbot-style flows, by design — flows are wrong for one-of-one
          sales conversations, so building them would push operators
          toward sounding robotic in messages that need to sound human.
        </p>

        <PullQuote>
          The difference is what each tool chooses to <em>not</em> do.
        </PullQuote>

        <h2>When to pick which</h2>

        <p>
          Simple decision tree:
        </p>

        <ul>
          <li>
            <strong>You run an audience and your prospects engage with
            you first?</strong> → ManyChat. Use it well.
          </li>
          <li>
            <strong>You're an indie creator monetizing your following via
            DM funnels?</strong> → ManyChat.
          </li>
          <li>
            <strong>You're a coach with a content engine that produces
            inbound interest?</strong> → ManyChat.
          </li>
          <li>
            <strong>You're an e-commerce brand using comment-keyword
            campaigns?</strong> → ManyChat.
          </li>
          <li>
            <strong>You're sourcing music catalog deals by reaching out
            to artists who don't know you?</strong> → Praecora. ManyChat
            cannot do the job here.
          </li>
          <li>
            <strong>You're running any kind of cold B2B Instagram
            outbound at scale?</strong> → Probably not ManyChat. Probably
            Praecora-adjacent — though if you're not in the music catalog
            niche specifically, we'd recommend looking carefully at
            whether the tool fits your sport.
          </li>
        </ul>

        <h2>The bottom line</h2>

        <p>
          ManyChat is great. It's also the wrong tool for sourcing music
          catalog deals. The reason is structural: ManyChat is designed
          for opt-in conversational marketing; catalog scouting is
          outbound sales to people who haven't opted in. Different
          permission model, different message economics, different
          architecture required end-to-end.
        </p>

        <p>
          If you're considering one or the other for catalog scouting
          specifically, the answer is Praecora — and not because
          we're biased (we are), but because ManyChat structurally cannot
          send the cold opener that makes the whole motion possible. If
          you want to see the actual cold-opener-and-reply-loop in
          motion, <a href="/demo">book a 20-minute demo</a> and we'll
          walk you through real conversations from a running scout
          operation.
        </p>

        <p>
          For more on what fits where, see our piece on the{' '}
          <a href="/blog/best-crm-for-music-catalog-scouts">
            best CRM for music catalog scouts and brokers
          </a>
          , which covers the broader category landscape including
          Pipedrive, HubSpot, and the rest.
        </p>
      </Prose>
    </BlogPostShell>
  )
}
