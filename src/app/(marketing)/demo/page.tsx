import Link from 'next/link'
import { ArrowRight, Calendar } from 'lucide-react'
import { Eyebrow } from '@/components/marketing/Ornament'

export const metadata = {
  // " | Praecora" is appended by the root layout template.
  title: 'Book a demo',
  description:
    'See Praecora with a real (anonymized) scout\'s inbox — AI-drafted outreach, a unified reply inbox, and the deal pipeline. 20 minutes, no slides.',
  // Self-canonical collapses query-string variants (e.g. the ?tier=whale
  // link from /pricing) into a single indexable URL so they aren't
  // flagged as duplicate pages.
  alternates: { canonical: 'https://www.praecora.com/demo' },
  openGraph: {
    title: 'Book a Praecora demo',
    description:
      'See Praecora with a real (anonymized) scout\'s inbox — AI-drafted outreach, unified inbox, and deal pipeline. 20 minutes, no slides.',
    url: 'https://www.praecora.com/demo',
    type: 'website',
    siteName: 'Praecora',
    images: ['https://www.praecora.com/opengraph-image'],
  },
}

const AGENDA = [
  {
    n: '01',
    title: 'Live inbox tour',
    body: 'A real (anonymized) scout\'s Praecora inbox — see AI-classified replies, suggested responses, and one-click reply flow.',
  },
  {
    n: '02',
    title: 'Your numbers',
    body: 'Bring your current pipeline and volume. We\'ll walk through which tier fits and what your first 90 days could look like.',
  },
  {
    n: '03',
    title: 'Q&A + next steps',
    body: 'No slides. No pitch deck. No follow-up sequences. You decide on the call or email when you\'re ready.',
  },
]

export default function DemoPage() {
  return (
    <>
      {/* HERO — split layout: text + CTA left, agenda panel right */}
      <section className="marketing-hero-bg px-4 pt-16 pb-20 md:px-6 md:pt-20 md:pb-24 lg:pt-24">
        <div className="mx-auto w-full max-w-7xl">
          <div className="grid items-start gap-12 md:grid-cols-[1fr_1.05fr] md:gap-12 lg:gap-16">
            {/* LEFT — text + CTAs */}
            <div className="text-center md:pt-6 md:text-left">
              <div className="mb-6 flex justify-center md:justify-start">
                <Eyebrow>Demo</Eyebrow>
              </div>
              <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-tight text-[#0f0d08] sm:text-5xl md:text-5xl lg:text-6xl">
                See it live. 20 minutes. No slides.
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-balance text-base leading-relaxed text-neutral-600 md:mx-0 md:mt-8 md:text-lg">
                A real, working walkthrough of Praecora on your operation. Bring your
                numbers — leave with a clear answer on which tier fits and what your
                first 90 days look like.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center md:mt-10 md:justify-start">
                <a
                  href="mailto:demo@praecora.com?subject=Praecora%20Demo%20Request"
                  className="cta-primary"
                >
                  Email to schedule <ArrowRight className="h-4 w-4" />
                </a>
                <Link href="/pricing" className="cta-secondary">
                  See pricing first
                </Link>
              </div>
            </div>

            {/* RIGHT — Demo agenda panel (replaces video) */}
            <div className="mx-auto w-full max-w-xl md:max-w-none">
              <div className="marketing-mock-panel p-8 md:p-10">
                {/* Panel header */}
                <div className="mb-8 flex items-center justify-between border-b border-black/10 pb-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                    20-min walkthrough
                  </p>
                  <p className="inline-flex items-center gap-2 text-xs font-medium text-[#0f0d08]">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                    Booking now
                  </p>
                </div>

                {/* Agenda items */}
                <div className="space-y-7">
                  {AGENDA.map((item, i) => (
                    <div key={item.n} className="flex gap-5">
                      <div className="shrink-0">
                        <div className="font-mono text-2xl font-medium text-rust opacity-80">
                          {item.n}
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-[#0f0d08] md:text-lg">
                          {item.title}
                        </h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-neutral-600 md:text-[15px]">
                          {item.body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom strip — reinforces the no-pressure promise */}
                <div className="mt-8 border-t border-black/10 pt-5">
                  <div className="flex items-center gap-3 text-xs text-neutral-500">
                    <span className="h-px w-8 bg-rust" />
                    <span>
                      No slides. No pressure. No follow-up sequences.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CALENDAR PLACEHOLDER */}
      <section className="border-t border-black/5 bg-white px-4 py-16 md:px-6 md:py-20">
        <div className="mx-auto w-full max-w-3xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-[#0f0d08] md:text-4xl">
            Pick a time
          </h2>
          <p className="mt-4 text-sm text-neutral-500">
            Calendar embed loads here once configured. For now, email gets you on the
            same call within 24 hours.
          </p>

          <div className="mx-auto mt-10 max-w-md rounded-xl border border-dashed border-neutral-300 bg-white p-12">
            <Calendar className="mx-auto h-10 w-10 text-neutral-400" />
            <p className="mt-4 text-sm font-medium text-[#0f0d08]">
              Demo booking integration coming soon.
            </p>
            <p className="mt-2 text-xs text-neutral-500">
              In the meantime, email us directly to schedule.
            </p>
            <a
              href="mailto:demo@praecora.com?subject=Praecora%20Demo%20Request"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#0f0d08] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
            >
              Email to schedule <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <section className="border-t border-black/5 px-4 py-16 md:px-6">
        <div className="mx-auto w-full max-w-3xl text-center">
          <p className="text-sm text-neutral-500">Already know what you need?</p>
          <Link
            href="/pricing"
            className="mt-4 inline-flex items-center gap-2 text-base font-medium text-[#0f0d08] hover:underline"
          >
            Skip the call and pick a tier <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  )
}
