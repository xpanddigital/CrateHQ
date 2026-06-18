import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

export default function OperatorHandbookPage() {
  return (
    <div className="container mx-auto max-w-3xl py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Operator Handbook</h1>
        <p className="text-muted-foreground mt-1">
          The five rules that keep our Instagram accounts alive. Read once. Re-read whenever an
          account behaves oddly.
        </p>
      </div>

      <Card>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none pt-6 space-y-6">
          <section>
            <h2 className="text-lg font-semibold">1. The Anchor™ rule — one operator per phone</h2>
            <p>
              Every cloud phone is bound to <strong>one operator</strong> and <strong>one
              workstation IP</strong>. Meta&apos;s risk system flags accounts that suddenly appear
              from a new location or device. If you change network — VPN, coffee shop, mobile
              tether — <em>do not</em> open the phone until you&apos;re back on your usual
              connection.
            </p>
            <p>
              If you genuinely need to move (new apartment, new office), tell your admin first so
              they can re-anchor the account over a 30-day gradual transition. Sudden jumps get
              the account banned.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">2. Never share credentials</h2>
            <p>
              Your GeeLark sub-user login is yours alone. Don&apos;t paste it into chat. Don&apos;t
              save it in a shared password manager vault. Don&apos;t let a teammate &quot;just open
              one DM&quot; from your machine. Cross-operator sessions on the same phone produce
              exactly the multi-IP fingerprint pattern that gets the account flagged.
            </p>
            <p>
              If you lost the password, ask your admin to rotate it. Don&apos;t guess.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">3. If Instagram shows a security challenge</h2>
            <p>
              If you log into the phone and see a &quot;Suspicious login attempt&quot; banner, a
              SMS verification request, or a forced password reset:
            </p>
            <ol className="list-decimal pl-5">
              <li>
                <strong>Do not</strong> complete the challenge with a personal phone number or
                personal email.
              </li>
              <li>
                <strong>Do not</strong> reset the password to one you use elsewhere.
              </li>
              <li>
                Stop, screenshot the screen, and message your admin in the operations channel.
                They&apos;ll guide the recovery from the cloud phone&apos;s SIM-based number.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold">4. Respect the daily DM ceiling</h2>
            <p>
              Each phone has a <strong>daily DM limit</strong> (visible on the My Phones card).
              That cap is calibrated for the account&apos;s warm-up stage. Exceeding it is the
              single fastest way to get the account silenced or banned.
            </p>
            <p>
              If the queue runs out, do <em>not</em> top it up by sending follow-ups beyond the
              limit. Move to another assigned phone, or take a break — the next day&apos;s queue
              will be ready.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">5. How to log a problem</h2>
            <p>
              If a phone won&apos;t open, a DM fails to send, the inbox isn&apos;t routing
              replies, or anything else looks off:
            </p>
            <ol className="list-decimal pl-5">
              <li>Screenshot what you see in GeeLark and in Praecora.</li>
              <li>
                Note the <strong>phone display name</strong> and the <strong>time</strong> (UTC if
                you know it).
              </li>
              <li>
                Send it to the operations channel. <em>Don&apos;t</em> retry the action multiple
                times — repeated failed sends look like bot behaviour to Meta.
              </li>
            </ol>
          </section>

          <p className="text-xs text-muted-foreground pt-4 border-t">
            Questions? Reply in the operations channel or email your admin. Back to{' '}
            <Link href="/operator/phones" className="underline">
              My Phones
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
