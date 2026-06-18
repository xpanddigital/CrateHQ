import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logger } from '@/lib/logger'

/**
 * Marketplace OAuth callback — receives the install redirect after a
 * sub-account authorizes the CrateHQ app.
 *
 * Phase 1 (current): logs the install attempt so we have a record, but does
 * NOT exchange the auth code for tokens. Outbound API calls use Private
 * Integration Tokens (PITs); webhooks fire independently of OAuth tokens, so
 * the install completes successfully without token exchange.
 *
 * Phase 2 (alias generator sprint): exchange code for tokens, store per
 * location, use agency-token-to-location-token flow for sub-account-scoped
 * provisioning calls.
 *
 * Callback querystring contains:
 *   ?code=<auth_code>&locationId=<loc>&companyId=<company>&approvalState=<state>
 */
export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code')
    const locationId = request.nextUrl.searchParams.get('locationId')
    const companyId = request.nextUrl.searchParams.get('companyId')
    const approvalState = request.nextUrl.searchParams.get('approvalState')
    const error = request.nextUrl.searchParams.get('error')

    if (error) {
      logger.warn('[Install OAuth] Install denied or failed', { error, locationId })
      return successPage(`Install was not completed: ${escapeHtml(error)}`, false)
    }

    if (!code) {
      return successPage('Missing auth code in callback URL.', false)
    }

    logger.info('[Install OAuth] Install received', {
      locationId,
      companyId,
      approvalState,
      codePreview: code.slice(0, 8) + '...',
    })

    // Best-effort install audit log; non-fatal if the table is absent.
    try {
      const supabase = createServiceClient()
      await supabase.from('marketplace_installs').insert({
        location_id: locationId,
        company_id: companyId,
        approval_state: approvalState,
        auth_code_preview: code.slice(0, 12),
        installed_at: new Date().toISOString(),
      })
    } catch {
      logger.info('[Install OAuth] marketplace_installs table not present, skipping log')
    }

    return successPage(
      `CrateHQ installed successfully${locationId ? ` for location ${escapeHtml(locationId)}` : ''}. You can close this tab.`,
      true
    )
  } catch (e) {
    logger.error('[Install OAuth] Unhandled error in callback:', e)
    return successPage('Something went wrong, but the install may still have completed.', false)
  }
}

// Some marketplaces POST to the callback; accept both
export const POST = GET

/**
 * Escape user-controlled values before interpolating into the HTML response.
 * Without this, the ?error= query param yields a stored-XSS gadget.
 */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function successPage(message: string, ok: boolean): NextResponse {
  const color = ok ? '#16a34a' : '#dc2626'
  const title = ok ? 'CrateHQ installed' : 'Install issue'
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0a0a0f;
      color: #e5e5e5;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 1rem;
    }
    .card {
      background: #141419;
      border: 1px solid #27272a;
      border-radius: 0.75rem;
      padding: 2.5rem;
      max-width: 28rem;
      text-align: center;
    }
    h1 { color: ${color}; margin: 0 0 1rem 0; font-size: 1.5rem; }
    p { margin: 0; line-height: 1.5; color: #a1a1aa; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`
  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
