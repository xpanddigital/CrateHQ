import Link from 'next/link'
import { MyPhonesClient } from './MyPhonesClient'

export const dynamic = 'force-dynamic'

export default function OperatorPhonesPage() {
  // The (dashboard) layout enforces auth. No admin gate here — operators
  // (scout-role users) are the primary audience.
  return (
    <div className="container mx-auto max-w-6xl py-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Phones</h1>
          <p className="text-muted-foreground mt-1">
            Open a phone to send today&apos;s cold openers. Sessions are logged for the Anchor™
            audit.
          </p>
        </div>
        <Link
          href="/operator/handbook"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Operator handbook →
        </Link>
      </div>
      <MyPhonesClient />
    </div>
  )
}
