import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Eyebrow } from '@/components/marketing/Ornament'
import { HeroVideoPlayer } from '@/components/marketing/HeroVideoPlayer'

// Targets process-oriented searches ("how Praecora works", "music
// industry CRM setup", "Instagram outreach onboarding for music").
// Low direct volume but supports the homepage's primary keyword
// and answers buyer-stage research questions.
export const metadata: Metadata = {
  // " | Praecora" is appended by the root layout template.
  title: 'How Praecora Works: Setup, Step by Step',
  description:
    'From onboarding to your first cold DM — the 4-week setup, the daily rhythm after, and exactly what you own versus what we manage.',
  alternates: { canonical: 'https://www.praecora.com/how-it-works' },
  openGraph: {
    title: 'How Praecora Works: Music Industry CRM Setup, Step by Step',
    description:
      'From the day you pay onboarding to the day your first cold DM goes out. The 4-week setup, the daily rhythm after.',
    url: 'https://www.praecora.com/how-it-works',
    type: 'website',
    siteName: 'Praecora',
    images: ['https://www.praecora.com/opengraph-image'],
  },
}

const TIMELINE = [
  {
    week: 'Day 0',
    title: 'You pay onboarding',
    body: 'Pick your tier, complete the brief intake, pay onboarding fee. We confirm receipt within minutes and your build slot is reserved.',
  },
  {
    week: 'Week 1',
    title: 'Account preparation begins',
    body: 'We provision your dedicated outreach presence across both Instagram and email, configure your AI voice from your inputs, and begin the 21-day account preparation that protects your accounts long-term.',
  },
  {
    week: 'Week 2',
    title: 'Brand identity + content seed',
    body: 'Your AI voice is tuned. Your initial content is generated and queued. Your email sender domains are warming up. The infrastructure that supports your outreach is built and tested.',
  },
  {
    week: 'Week 3',
    title: 'Onboarding wrap-up',
    body: 'Final account warm-up. Quality checks across IG and email. Your Praecora inbox is set up and ready. You receive credentials + a recorded walkthrough of your dashboard.',
  },
  {
    week: 'Week 4',
    title: 'Outreach goes live',
    body: 'Your first cold DMs and emails go out. Your monthly subscription begins billing today. Replies start landing in your Praecora inbox within hours.',
  },
  {
    week: 'Week 5+',
    title: 'Your daily rhythm',
    body: '~30 min/day in Praecora — review AI-classified replies, send AI-suggested responses, book calls. The outreach engine runs on its own.',
  },
]

export default function HowItWorksPage() {
  return (
    <>
      {/* HERO — split layout: text left, video right */}
      <section className="marketing-hero-bg px-4 pt-16 pb-20 md:px-6 md:pt-20 md:pb-24 lg:pt-24">
        <div className="mx-auto w-full max-w-7xl">
          <div className="grid items-center gap-12 md:grid-cols-2 md:gap-12 lg:gap-16">
            {/* LEFT — text */}
            <div className="text-center md:text-left">
              <div className="mb-6 flex justify-center md:justify-start">
                <Eyebrow>How it works</Eyebrow>
              </div>
              <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-tight text-[#0f0d08] sm:text-5xl md:text-5xl lg:text-6xl">
                What happens after you sign up.
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-balance text-base leading-relaxed text-neutral-600 md:mx-0 md:mt-8 md:text-lg">
                From the day you pay onboarding to the day your first deal closes —
                here's exactly what you can expect, and on what timeline.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center md:mt-10 md:justify-start">
                <Link href="/pricing" className="cta-primary">
                  See pricing <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/demo" className="cta-secondary">
                  Book a 20-min demo
                </Link>
              </div>
            </div>

            {/* RIGHT — Four Weeks of Preparation video teaser */}
            <div className="mx-auto w-full max-w-xl md:max-w-none">
              <HeroVideoPlayer
                teaserSrc="/videos/four-weeks-prep-teaser.mp4"
                fullSrc="/videos/four-weeks-prep.mp4"
                posterSrc="/videos/four-weeks-prep-poster.jpg"
                caption="Watch — Four weeks of preparation"
              />
            </div>
          </div>
        </div>
      </section>

      {/* TIMELINE */}
      <section className="border-t border-black/5 bg-white px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto w-full max-w-3xl">
          <div className="space-y-12">
            {TIMELINE.map((step) => (
              <div
                key={step.week}
                className="grid grid-cols-[100px_1fr] gap-6 md:grid-cols-[140px_1fr] md:gap-12"
              >
                <div className="font-mono text-sm uppercase tracking-wider text-neutral-500">
                  {step.week}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-neutral-950">{step.title}</h3>
                  <p className="mt-3 text-base leading-relaxed text-neutral-600">
                    {step.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* OWNERSHIP */}
      <section className="border-t border-black/5 px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto w-full max-w-4xl">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Ownership
          </p>
          <h2 className="text-balance text-4xl font-bold tracking-tight text-neutral-950 md:text-5xl">
            What you own. What we manage.
          </h2>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-neutral-950 bg-white p-8">
              <p className="text-sm font-semibold uppercase tracking-wider text-neutral-950">
                You own
              </p>
              <ul className="mt-6 space-y-3 text-sm text-neutral-700">
                {[
                  'Your AI voice configuration',
                  'Your contact database',
                  'Your conversation history',
                  'Your deal pipeline data',
                  'All content generated for your personas',
                  'Full export rights at any time',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-neutral-950" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-black/10 bg-white p-8">
              <p className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                We manage
              </p>
              <ul className="mt-6 space-y-3 text-sm text-neutral-700">
                {[
                  'Account preparation + safety',
                  'Email sender domains + warm-up',
                  'AI prompting + tuning',
                  'Outreach delivery infrastructure',
                  'Daily account hygiene',
                  'Reply routing into your inbox',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-black/5 bg-white px-4 py-24 md:px-6">
        <div className="mx-auto w-full max-w-3xl text-center">
          <h2 className="text-balance text-4xl font-bold tracking-tight text-neutral-950 md:text-5xl">
            Ready to start?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-neutral-600">
            Pick a tier or book a demo. Your outreach goes live in ~4 weeks either way.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-950 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
            >
              See pricing <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-6 py-3 text-sm font-medium text-neutral-950 transition-colors hover:bg-neutral-50"
            >
              Book a 20-min demo
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
