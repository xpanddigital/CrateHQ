/**
 * Centralized Anthropic model IDs.
 *
 * Pin the exact model ID we want for each use case here so deprecations
 * don't silently break runtime calls across the codebase.
 *
 * Tier guidance:
 *   - OPUS  → highest quality, slowest, most expensive. Cold DMs, where reply
 *             rate is the whole business.
 *   - SONNET → balanced. Content generation, scheduled comments, brand voice.
 *   - HAIKU → cheap + fast. Classification, short generations, batch loops.
 */

export const CLAUDE_MODELS = {
  /** Cold DM generation — Joel's $700/mo lever, worth the spend */
  OPUS: 'claude-opus-4-7',
  /** Content posts, voice prompts, generated comments */
  SONNET: 'claude-sonnet-4-6',
  /** Reply classification, lightweight loops */
  HAIKU: 'claude-haiku-4-5-20251001',
} as const

export type ClaudeModel = (typeof CLAUDE_MODELS)[keyof typeof CLAUDE_MODELS]
