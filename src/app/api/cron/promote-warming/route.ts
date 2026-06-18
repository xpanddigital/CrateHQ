import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendOpsAlert } from '@/lib/email/resend'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/promote-warming
 *
 * Auto-promotes:
 *   - scouts.fb_status: warming → ready when warming_until <= now()
 *     (21-day Facebook account warm-up before they can spawn a Business
 *      Portfolio + IG accounts; see Alias Generator Phase A in CLAUDE.md)
 *
 *   - account_identities.ig_status: warming → ready when warming_until <= now()
 *     (7-day IG account warm-up before cold DMs can be sent; see Phase B)
 *
 * Runs on Vercel cron every 6 hours. Idempotent — running it twice in a row
 * promotes the same rows once, then no-ops. Sends a Resend ops alert if any
 * rows were promoted so Joel can move scouts to the next step.
 *
 * Auth: CRON_SECRET Bearer (same pattern as the other crons).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date().toISOString()

  // ── Phase A: scouts.fb_status warming → ready
  const { data: promotedScouts, error: scoutsErr } = await supabase
    .from('scouts')
    .update({ fb_status: 'ready', updated_at: now })
    .eq('fb_status', 'warming')
    .lte('warming_until', now)
    .select('id, email, full_name, warming_until')

  if (scoutsErr) {
    logger.error('[Cron/PromoteWarming] scouts promote failed:', scoutsErr)
    return NextResponse.json({ error: scoutsErr.message }, { status: 500 })
  }

  // ── Phase B: account_identities.ig_status warming → ready
  const { data: promotedIdentities, error: identitiesErr } = await supabase
    .from('account_identities')
    .update({ ig_status: 'ready', updated_at: now })
    .eq('ig_status', 'warming')
    .lte('warming_until', now)
    .select('id, display_name, account_id, ig_account_id')

  if (identitiesErr) {
    logger.error('[Cron/PromoteWarming] identities promote failed:', identitiesErr)
    return NextResponse.json({ error: identitiesErr.message }, { status: 500 })
  }

  const scoutCount = promotedScouts?.length ?? 0
  const identityCount = promotedIdentities?.length ?? 0

  if (scoutCount > 0 || identityCount > 0) {
    logger.info('[Cron/PromoteWarming] Promoted', { scoutCount, identityCount })

    // Resolve account names for identities so the alert is readable
    let identitiesWithAccountName: typeof promotedIdentities = promotedIdentities ?? []
    if (identityCount > 0 && promotedIdentities) {
      const accountIds = Array.from(
        new Set(promotedIdentities.map((i: any) => i.account_id).filter(Boolean))
      )
      if (accountIds.length > 0) {
        const { data: accts } = await supabase
          .from('accounts')
          .select('id, name')
          .in('id', accountIds)
        const nameById = new Map<string, string>((accts ?? []).map((a: any) => [a.id, a.name]))
        identitiesWithAccountName = promotedIdentities.map((i: any) => ({
          ...i,
          account_name: i.account_id ? nameById.get(i.account_id) ?? '(unknown)' : null,
        }))
      }
    }

    // Build the alert body. Inline data so Joel sees what got promoted at a glance.
    const scoutsBlock = scoutCount === 0
      ? '<p><em>None.</em></p>'
      : `<ul>${(promotedScouts ?? []).map((s: any) => `
          <li><strong>${escapeHtml(s.full_name ?? s.email)}</strong> (${escapeHtml(s.email)}) — warm-up ended ${s.warming_until}</li>
        `).join('')}</ul>`

    const identitiesBlock = identityCount === 0
      ? '<p><em>None.</em></p>'
      : `<ul>${(identitiesWithAccountName ?? []).map((i: any) => `
          <li><strong>${escapeHtml(i.display_name)}</strong> ${i.account_name ? `(account: ${escapeHtml(i.account_name)})` : ''} — identity id ${i.id}${i.ig_account_id ? `, ig_account_id ${i.ig_account_id}` : ', <strong>not yet linked to an IG account</strong>'}</li>
        `).join('')}</ul>`

    // Fire-and-forget; don't block the cron on email
    sendOpsAlert({
      subject: `Praecora: promoted ${scoutCount} scout${scoutCount === 1 ? '' : 's'} + ${identityCount} alias${identityCount === 1 ? '' : 'es'} to ready`,
      html: `
        <h2>Promotion summary</h2>

        <h3>Scouts whose Facebook warm-up just finished (Phase A → Phase B unlocked)</h3>
        ${scoutsBlock}
        ${scoutCount > 0 ? '<p>Next step for each: run Phase B in <a href="https://praecora.com/admin/aliases/generate">/admin/aliases/generate</a> to spawn their first IG alias.</p>' : ''}

        <h3>IG identities whose 7-day warm-up just finished (cold DMs unlocked)</h3>
        ${identitiesBlock}
        ${identityCount > 0 ? '<p>Cold DMs can now be sent from these identities. Make sure the IG account row in <code>ig_accounts</code> has <code>is_active=true</code>.</p>' : ''}

        <hr/>
        <p style="font-size:11px;color:#888">Sent by /api/cron/promote-warming (runs every 6h).</p>
      `,
    }).catch((e) => logger.error('[Cron/PromoteWarming] ops alert failed:', e))
  }

  return NextResponse.json({
    promoted_scouts: scoutCount,
    promoted_identities: identityCount,
    scouts: promotedScouts ?? [],
    identities: promotedIdentities ?? [],
  })
}

function escapeHtml(input: string | null | undefined): string {
  if (!input) return ''
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
