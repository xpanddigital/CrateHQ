import type { Metadata } from 'next'
import { BlogPostShell } from '../_components/BlogPostShell'
import { Prose, Callout, Lede, PullQuote } from '../_components/Prose'
import { getPostBySlug } from '../posts'

export const revalidate = 3600

const post = getPostBySlug('royalty-advance-vs-catalog-sale-indie-artists')!

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
          A royalty advance and a catalog sale look similar to artists
          who haven't done either — both are big checks now against
          future income. They're structurally very different products.
          Here's the honest breakdown of when each is right (and when
          neither is).
        </Lede>

        <p>
          When an indie artist first encounters music catalog finance,
          the conversation usually starts at "you can get a big check
          today against your future royalty income." That's true. What
          gets less attention: there are two fundamentally different
          financial products inside that sentence, and they have very
          different long-term consequences for the artist.
        </p>

        <p>
          A <strong>royalty advance</strong> is a loan-like product
          where the artist keeps their catalog and just redirects
          royalty cash flow temporarily.
        </p>

        <p>
          A <strong>catalog sale</strong> (also called a catalog
          buyout) is an actual sale of the catalog rights, where the
          buyer permanently owns some or all of the future royalty
          stream.
        </p>

        <p>
          They both deliver cash now. They're not interchangeable.
          This piece is the artist-friendly breakdown of which is
          right when — and when neither is.
        </p>

        <h2>How royalty advances work</h2>

        <p>
          The mechanics:
        </p>

        <ul>
          <li>Artist receives an upfront lump sum (the "advance")</li>
          <li>Artist assigns some percentage of future royalty income to the financier</li>
          <li>The royalties flow to the financier until the advance is "recouped" (paid back)</li>
          <li>Once recouped, royalties revert to the artist</li>
          <li>Artist retains ownership of the catalog throughout</li>
        </ul>

        <p>
          Typical 2026 indie deal: 70/30 royalty split (70% to
          financier toward recoupment, 30% continues to artist),
          recoupment expected in 5–8 years. After recoupment, 100% of
          royalties resume flowing to the artist.
        </p>

        <p>
          The key economic feature: the artist's downside is bounded
          to the lower share of royalties during the recoupment
          period. They never owe additional money out of pocket; the
          catalog itself pays back the advance.
        </p>

        <p>
          The advance is essentially a loan secured by the future
          royalty stream — but with a critical difference from a
          traditional loan: there's no fixed repayment schedule and
          no personal liability. If the catalog underperforms,
          recoupment takes longer; the artist isn't on the hook to
          pay shortfall out of pocket.
        </p>

        <h2>How catalog sales work</h2>

        <p>
          The mechanics:
        </p>

        <ul>
          <li>Artist sells some or all of their catalog rights outright</li>
          <li>Buyer pays a single larger lump sum</li>
          <li>Buyer permanently owns the future royalty stream from the sold portion</li>
          <li>Artist has no claim on royalties from the sold portion ever again</li>
        </ul>

        <p>
          Variations:
        </p>

        <ul>
          <li>
            <strong>Full catalog buyout:</strong> artist sells all
            their rights — masters, publishing, neighbouring rights,
            sync rights — to one buyer. They keep no ownership and
            collect no future royalties from that catalog.
          </li>
          <li>
            <strong>Partial buyout:</strong> artist sells some
            percentage (e.g., 50% of publishing, or 100% of masters
            but retains publishing). More flexible but more complex.
          </li>
          <li>
            <strong>Master rights buyout:</strong> sells the master
            recording royalties but keeps publishing (songwriter
            royalties).
          </li>
          <li>
            <strong>Publishing rights buyout:</strong> sells the
            publishing/songwriter side but keeps master recording
            ownership.
          </li>
        </ul>

        <p>
          The economics: the buyer typically pays a higher multiple
          for outright purchase than they would for an advance,
          because they're getting the full income stream forever, not
          just until recoupment. Common multiples for buyouts:
          12x–24x annual royalty income depending on catalog quality
          (vs. 8x–14x for advances).
        </p>

        <h2>Side-by-side comparison</h2>

        <table>
          <thead>
            <tr>
              <th>Dimension</th>
              <th>Royalty advance</th>
              <th>Catalog sale</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Upfront payment</td>
              <td>Lump sum, 8x–14x annual royalties</td>
              <td>Larger lump sum, 12x–24x annual royalties</td>
            </tr>
            <tr>
              <td>Ownership after deal</td>
              <td>Artist keeps catalog</td>
              <td>Buyer owns catalog (or portion)</td>
            </tr>
            <tr>
              <td>Future royalties to artist</td>
              <td>Reduced during recoupment, then 100%</td>
              <td>Zero (from sold portion)</td>
            </tr>
            <tr>
              <td>Term</td>
              <td>Until recoupment (5–8 years typical)</td>
              <td>Forever</td>
            </tr>
            <tr>
              <td>Downside risk to artist</td>
              <td>Bounded — extended recoupment if catalog declines</td>
              <td>Zero (already paid)</td>
            </tr>
            <tr>
              <td>Upside potential to artist</td>
              <td>100% royalties resume after recoupment</td>
              <td>Zero from sold portion</td>
            </tr>
            <tr>
              <td>Recoverability if regret</td>
              <td>Can sometimes pay off early</td>
              <td>Cannot undo a sale</td>
            </tr>
          </tbody>
        </table>

        <h2>When a royalty advance is right</h2>

        <p>
          Royalty advances fit most indie artists most of the time.
          Specifically:
        </p>

        <ul>
          <li>
            <strong>The artist wants ongoing income from the catalog.</strong>{' '}
            Most active artists do. The advance preserves that.
          </li>
          <li>
            <strong>The catalog has growth potential.</strong> If the
            artist's career is still building, they likely don't want
            to give up the upside from future growth. The advance lets
            them participate in it.
          </li>
          <li>
            <strong>The artist needs significant capital for a specific
            purpose</strong> — recording an album, touring, paying off
            debt, buying a house, family needs — but doesn't want to
            permanently give up future income.
          </li>
          <li>
            <strong>The artist might want to re-record or re-release
            material later.</strong> Buyouts often restrict this;
            advances usually don't.
          </li>
          <li>
            <strong>The catalog is younger.</strong> Newer catalogs
            with unproven decay rates get better terms in advance
            structures than in buyout structures.
          </li>
        </ul>

        <h2>When a catalog sale is right</h2>

        <p>
          Less commonly, but for specific situations:
        </p>

        <ul>
          <li>
            <strong>The artist is exiting the industry.</strong>{' '}
            Retiring, switching careers, leaving music entirely.
            Catalog sales make sense when the ongoing income matters
            less than maximizing today's check.
          </li>
          <li>
            <strong>The artist needs maximum capital and accepts the
            tradeoff.</strong> The lump sum on a buyout is typically
            30–60% higher than on an advance for the same catalog.
            For specific high-need situations (major life expenses,
            settling estate, immigration, etc.), the larger check
            can be worth the permanent loss.
          </li>
          <li>
            <strong>The artist is uncertain about catalog
            trajectory.</strong> If you think the catalog will decline
            faster than the buyer's underwriting model predicts,
            selling at today's valuation may be better than waiting.
            This is rare but happens.
          </li>
          <li>
            <strong>The catalog has reached its plateau.</strong>{' '}
            Long-tail catalogs whose income has stabilized and isn't
            expected to grow further are sometimes good sale
            candidates because the buyer's "future growth" assumption
            doesn't apply.
          </li>
          <li>
            <strong>Estate planning / tax considerations.</strong>{' '}
            Sometimes selling a catalog produces better tax treatment
            (capital gains rather than ordinary income) than receiving
            it as royalties over time. Consult an accountant.
          </li>
        </ul>

        <Callout label="When neither is right">
          <p>
            If your annual royalty income is under ~$5K, the deal
            structures don't math out well in either direction. You'd
            get a small advance ($20K–$50K) or small sale ($30K–$80K)
            for accepting reduced future income (advance) or zero
            future income (sale). Often the right answer for small
            catalogs is to keep your full ongoing royalty stream and
            wait until the catalog grows enough to make either
            structure interesting. Patience is sometimes the answer.
          </p>
        </Callout>

        <h2>The term-advance hybrid: getting some of both</h2>

        <p>
          A third structure has emerged that splits the difference: the
          <strong> term advance</strong>. The mechanics:
        </p>

        <ul>
          <li>Artist receives upfront lump sum (like a regular advance)</li>
          <li>Royalty stream redirects to financier for a defined term (typically 7–10 years)</li>
          <li>At end of term, ALL rights revert to the artist regardless of recoupment status</li>
          <li>Financier bears the recoupment risk; artist gets a fixed-term deal</li>
        </ul>

        <p>
          Advance multiples are typically lower (5x–10x vs 8x–14x for
          open-ended advances) because the financier takes more risk.
          But the artist gets certainty: at year 10, the catalog
          rights are 100% back regardless of how recoupment played
          out.
        </p>

        <p>
          Xposure Music popularized this structure for indie deals.
          For artists who want the upfront capital but also want
          certainty about when their catalog comes back fully, term
          advances are often the best fit.
        </p>

        <h2>The decision framework</h2>

        <p>
          The honest decision tree for an indie artist:
        </p>

        <ol>
          <li>
            <strong>How much do you value future ownership?</strong>{' '}
            If high: advance. If indifferent: explore both. If actively
            want out: sale.
          </li>
          <li>
            <strong>Is your catalog growing, stable, or declining?</strong>{' '}
            Growing: advance. Stable: either. Declining sharply:
            possibly sale (lock in today's value).
          </li>
          <li>
            <strong>Do you need maximum capital today or balanced
            capital + future income?</strong> Maximum today: sale.
            Balanced: advance.
          </li>
          <li>
            <strong>What's the time horizon you care about?</strong>{' '}
            10+ years: advance gets you future ownership. Under 5
            years: sale's permanence matters less.
          </li>
          <li>
            <strong>What's your risk tolerance?</strong> Risk-averse:
            term advance (defined end). Comfortable with extended
            recoupment: open advance. Want certainty: sale.
          </li>
        </ol>

        <PullQuote>
          An advance is a loan against the future. A sale is a
          transfer of the future. The right one depends on what you
          want to own at the end of the deal.
        </PullQuote>

        <h2>What the scout's role is in this conversation</h2>

        <p>
          For scouts sourcing deals, the artist's choice between
          advance and sale shapes which buyer to route them to:
        </p>

        <ul>
          <li>
            <strong>Advance-preferring artist:</strong> route to
            beatBread, Symphonic Advances, RoyFi, Sound Royalties.
          </li>
          <li>
            <strong>Term-advance preferring artist:</strong> route to
            Xposure Music primarily, sometimes Connect Music.
          </li>
          <li>
            <strong>Sale-considering artist:</strong> route to Xposure
            (partial buyouts), Royalty Exchange (marketplace
            auctions), or for larger catalogs, Concord, Primary Wave,
            Round Hill, Influence Media.
          </li>
        </ul>

        <p>
          Different scouts develop different buyer specializations.
          Knowing which structure each artist wants is the first step
          in routing them well.
        </p>

        <h2>The bottom line</h2>

        <p>
          Royalty advance and catalog sale are distinct products.
          Royalty advance is the default for most indie artists —
          preserves ownership, manageable downside, full upside
          returns after recoupment. Catalog sale is right for
          specific situations — career exits, maximum-capital needs,
          stable plateau catalogs — but the permanence matters and
          shouldn't be taken lightly.
        </p>

        <p>
          For more context, see{' '}
          <a href="/blog/music-catalog-financing-explained">
            music catalog financing explained
          </a>{' '}
          for the broader product landscape, or{' '}
          <a href="/blog/music-catalog-valuation-multiples-2026">
            music catalog valuation multiples
          </a>{' '}
          for the math behind both structures. For scouts working
          this market, the{' '}
          <a href="/blog/music-catalog-financing-broker-playbook">
            broker playbook
          </a>{' '}
          covers buyer matching across product types.
        </p>

        <p>
          Praecora supports catalog scouts routing deals across both
          advance-preferring buyers and sale-preferring buyers based
          on each artist's situation.{' '}
          <a href="/demo">Book a 20-minute demo</a> to see what the
          integrated routing flow looks like in practice.
        </p>
      </Prose>
    </BlogPostShell>
  )
}
