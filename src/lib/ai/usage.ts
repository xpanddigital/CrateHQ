/**
 * AI usage ledger — record every Anthropic / Gemini call to `ai_usage` so
 * admins can see per-scout AI spend.
 *
 * Server-side only. Uses createServiceClient because the ledger must be
 * writable regardless of which user (or cron) triggered the call.
 *
 * Pricing table is hand-maintained from Anthropic / Gemini public pricing.
 * Re-check periodically — drift won't break anything, it just makes the
 * dashboard wrong.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { logger } from '@/lib/logger'
import { CLAUDE_MODELS, type ClaudeModel } from './models'

export type UsageProvider = 'anthropic' | 'gemini' | 'openai' | 'perplexity'

/** Per-million-token cost in USD cents (input, output). */
const PRICING_CENTS_PER_MTOK: Record<string, { input: number; output: number }> = {
  // Anthropic — May 2026 public rates. Verify against
  // https://www.anthropic.com/pricing periodically.
  [CLAUDE_MODELS.HAIKU]:  { input: 80,    output: 400 },
  [CLAUDE_MODELS.SONNET]: { input: 300,   output: 1500 },
  [CLAUDE_MODELS.OPUS]:   { input: 1500,  output: 7500 },
  // Generic fallbacks for unknown model strings (overestimate slightly so
  // we don't under-report).
  'anthropic-default':    { input: 500,   output: 2500 },
  'gemini-imagen':        { input: 0,     output: 4000 }, // ~$0.04 per image; logged as 1 output token
}

function pricingFor(model: string): { input: number; output: number } {
  return PRICING_CENTS_PER_MTOK[model] ?? PRICING_CENTS_PER_MTOK['anthropic-default']
}

function estimateCostCents(model: string, inputTokens: number, outputTokens: number): number {
  const p = pricingFor(model)
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000
}

export interface RecordUsageInput {
  accountId: string | null
  userId?: string | null
  provider: UsageProvider
  model: string
  /** Which feature triggered this call (e.g. 'cold_dm', 'classify_reply'). */
  kind: string
  inputTokens: number
  outputTokens: number
  metadata?: Record<string, unknown>
}

/**
 * Insert a single usage row. Fire-and-forget — failures are logged but never
 * thrown, so a transient DB issue can't block the user's response.
 */
export async function recordAiUsage(input: RecordUsageInput): Promise<void> {
  try {
    const supabase = createServiceClient()
    const cost_cents = estimateCostCents(input.model, input.inputTokens, input.outputTokens)
    await supabase.from('ai_usage').insert({
      account_id: input.accountId,
      user_id: input.userId ?? null,
      provider: input.provider,
      model: input.model,
      kind: input.kind,
      input_tokens: input.inputTokens,
      output_tokens: input.outputTokens,
      cost_cents,
      metadata: input.metadata ?? {},
    })
  } catch (e) {
    // Never break the calling request because of telemetry
    logger.error('[ai-usage] Failed to record usage row:', e)
  }
}

/**
 * Helper to record usage from an Anthropic `.messages.create()` response.
 * Extracts the token counts from `resp.usage` if present, otherwise records 0
 * (so the row at least counts the call frequency).
 */
export function recordAnthropicUsage(
  resp: { usage?: { input_tokens?: number; output_tokens?: number } } | null | undefined,
  args: { accountId: string | null; userId?: string | null; model: ClaudeModel | string; kind: string; metadata?: Record<string, unknown> }
): Promise<void> {
  return recordAiUsage({
    accountId: args.accountId,
    userId: args.userId,
    provider: 'anthropic',
    model: args.model,
    kind: args.kind,
    inputTokens: resp?.usage?.input_tokens ?? 0,
    outputTokens: resp?.usage?.output_tokens ?? 0,
    metadata: args.metadata,
  })
}
