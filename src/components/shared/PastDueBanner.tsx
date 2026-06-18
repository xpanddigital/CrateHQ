/**
 * Top-of-dashboard banner shown when scouts.status = 'past_due'.
 *
 * Displays for anyone whose subscription failed payment AND whose Stripe
 * smart-retries are exhausted. They retain read access to their workspace
 * but should resolve billing before the access is fully revoked.
 */
export function PastDueBanner() {
  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-3 text-sm text-amber-200">
      <div className="flex items-center justify-between gap-4">
        <span>
          <strong className="font-semibold">Subscription payment failed.</strong>{' '}
          Please update your card to keep your account active.
        </span>
        <a
          href="/settings"
          className="rounded-md bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-100 hover:bg-amber-500/30"
        >
          Update payment
        </a>
      </div>
    </div>
  )
}
