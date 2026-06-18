export const metadata = {
  // " | Praecora" is appended by the root layout template.
  title: 'Terms of Service',
  description:
    'The terms of service governing use of Praecora — the managed Instagram and email outreach platform for independent music catalog scouts.',
  alternates: { canonical: 'https://www.praecora.com/legal/terms' },
}

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 md:px-6 md:py-24">
      <h1 className="text-balance text-4xl font-bold tracking-tight text-neutral-950 md:text-5xl">
        Terms of Service
      </h1>
      <p className="mt-3 text-sm text-neutral-500">
        Last updated:{' '}
        {new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </p>

      <div className="mt-12 space-y-10 text-neutral-700">
        <section>
          <h2 className="text-xl font-semibold text-neutral-950">The service</h2>
          <p className="mt-3 text-base leading-relaxed">
            Praecora provides done-for-you Instagram and email outreach for music catalog
            scouts, including platform access, AI-drafted outreach, account management,
            and a unified reply inbox. Specific deliverables vary by tier as described on
            the pricing page.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-neutral-950">Billing</h2>
          <p className="mt-3 text-base leading-relaxed">
            Onboarding fees are billed at signup and are non-refundable. Monthly
            subscriptions begin on the day your outreach goes live (typically ~4 weeks
            after onboarding) and are charged monthly thereafter. Annual subscriptions
            are billed yearly with a 2-month discount.
          </p>
          <p className="mt-3 text-base leading-relaxed">
            You may cancel your subscription at any time. Cancellations take effect at
            the end of your current billing period.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-neutral-950">Acceptable use</h2>
          <p className="mt-3 text-base leading-relaxed">
            Praecora is built for legitimate music catalog scouts engaging with artists
            and their representatives in good faith. Misuse — including spam, harassment,
            fraudulent claims, or attempts to circumvent platform safety measures — will
            result in account termination without refund.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-neutral-950">Account safety disclosures</h2>
          <p className="mt-3 text-base leading-relaxed">
            Outreach across Instagram and email involves inherent platform risk. While we
            invest significantly in account longevity and email deliverability, we cannot
            guarantee any specific account will remain in good standing or that any
            specific email will reach the inbox. Replacement accounts in the event of
            bans are included in your subscription, subject to fair use.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-neutral-950">Results</h2>
          <p className="mt-3 text-base leading-relaxed">
            We provide volume estimates based on industry typical performance. We do not
            guarantee specific deal counts, reply rates, or commission outcomes — those
            depend on your qualification, follow-up, and offer quality.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-neutral-950">Data ownership</h2>
          <p className="mt-3 text-base leading-relaxed">
            You own your data. We will export and hand off your AI voice configuration,
            contact database, conversation history, and pipeline data on cancellation
            request.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-neutral-950">Liability</h2>
          <p className="mt-3 text-base leading-relaxed">
            Praecora is provided "as is." Our total liability under any claim is limited
            to fees paid in the prior 12 months. We are not liable for consequential or
            indirect damages including lost commissions, lost accounts, or business
            disruption.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-neutral-950">Changes</h2>
          <p className="mt-3 text-base leading-relaxed">
            We may update these terms. Material changes will be announced via email to
            active customers at least 30 days in advance.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-neutral-950">Contact</h2>
          <p className="mt-3 text-base leading-relaxed">
            Questions:{' '}
            <a
              href="mailto:legal@praecora.com"
              className="font-medium text-neutral-950 underline underline-offset-2 hover:no-underline"
            >
              legal@praecora.com
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}
