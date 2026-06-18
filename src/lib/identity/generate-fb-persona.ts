/**
 * Generate a Facebook persona for the alias account that will own a Business
 * Portfolio (which in turn owns the scout's IG Business accounts).
 *
 * IMPORTANT: per Meta's risk model and our architecture in CLAUDE.md:
 *   - The persona is a fake identity. Joel's real FB is NEVER the owner.
 *   - Each scout gets exactly ONE alias FB, ONE Business Portfolio.
 *   - The alias FB needs 21 days of warm-up before it can safely spawn
 *     a Business Portfolio + IG accounts.
 *   - The profile photo MUST NOT be a face — Meta's face-recognition
 *     cross-checks against real people. Pet, illustration, abstract, scenery
 *     are all safe choices. We return a text-to-image PROMPT (not the image
 *     itself); the orchestrator hands it to Gemini Imagen.
 */

import Anthropic from '@anthropic-ai/sdk'
import { CLAUDE_MODELS } from '@/lib/ai/models'
import { recordAnthropicUsage } from '@/lib/ai/usage'
import { logger } from '@/lib/logger'

export interface GenerateFbPersonaInput {
  /**
   * Optional seeds from the scout — e.g. their preferred demographic ("late
   * 20s, NYC, music industry adjacent"). Free text. May be empty.
   */
  seed?: string
  /** For usage attribution */
  accountId: string | null
  userId: string | null
}

export interface FbPersona {
  /** Display name on the FB account. NOT the scout's real name. */
  first_name: string
  last_name: string
  /** A plausible birth year so age is roughly 24-45 */
  birth_year: number
  /** City + country, used for FB profile location + SMS-verification context */
  city: string
  country: string
  /** Occupation, used for the FB "About" section */
  occupation: string
  /** 1-2 sentence backstory. Used for FB bio + security questions. */
  bio: string
  /** 3 security-question answers in case Meta challenges */
  security_answers: {
    mothers_maiden_name: string
    first_pet_name: string
    childhood_street: string
  }
  /**
   * Text-to-image prompt for the FB profile photo. MUST NOT generate a face.
   * Examples Claude has produced: "a black cat curled on a turntable", "a
   * minimal line drawing of a coffee cup with steam rising".
   */
  profile_photo_prompt: string
  /** What to put in the FB cover photo prompt (also non-face). */
  cover_photo_prompt: string
}

export async function generateFbPersona(input: GenerateFbPersonaInput): Promise<FbPersona> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured — cannot generate FB persona')
  }
  const client = new Anthropic({ apiKey })

  const seedLine = input.seed?.trim()
    ? `\nScout's preferences: ${input.seed.trim()}`
    : '\nNo specific preferences — generate freely.'

  const prompt = `Generate a fake Facebook persona for a music industry catalog-financing scout's alias account. This persona will own a Meta Business Portfolio that owns 5-10 Instagram Business accounts.

REQUIREMENTS (non-negotiable):
1. The persona must be PLAUSIBLE — a real-feeling indie music adjacent person aged 24-45.
2. First and last name must be common-enough to not stand out, but specific enough to feel real. Pull from any culture/ethnicity that makes sense.
3. City should be a real city with a music scene (NYC, LA, Atlanta, Nashville, Austin, Berlin, London, Toronto, etc.).
4. The profile_photo_prompt and cover_photo_prompt MUST NOT describe a human face. Meta runs face-recognition cross-checks against real people; a face-photo on a fake account is the #1 way to get banned. Use: pet, abstract pattern, scenery, illustration, object, hand-only-no-face, silhouette.
5. The bio must NOT contain "music industry scout", "catalog financing", or "music business" — those are operational tells. Make it personal.${seedLine}

Output STRICT JSON (no markdown fences, no preamble):

{
  "first_name": "...",
  "last_name": "...",
  "birth_year": <integer 1980-2001>,
  "city": "...",
  "country": "...",
  "occupation": "<a plausible day job that's music-adjacent but not 'music scout'; e.g. 'audio engineer', 'event producer', 'freelance writer'>",
  "bio": "<1-2 sentence FB bio>",
  "security_answers": {
    "mothers_maiden_name": "...",
    "first_pet_name": "...",
    "childhood_street": "..."
  },
  "profile_photo_prompt": "<text-to-image prompt; NO FACE; describe a pet, object, scenery, or illustration>",
  "cover_photo_prompt": "<text-to-image prompt for FB cover, 16:9; also NO FACE>"
}`

  const resp = await client.messages.create({
    model: CLAUDE_MODELS.SONNET,
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  })

  recordAnthropicUsage(resp, {
    accountId: input.accountId,
    userId: input.userId,
    model: CLAUDE_MODELS.SONNET,
    kind: 'generate_fb_persona',
  })

  const text = resp.content[0]?.type === 'text' ? resp.content[0].text : ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) {
    logger.error('[generateFbPersona] No JSON in response:', text.slice(0, 500))
    throw new Error('Claude returned no parseable JSON')
  }
  let parsed: any
  try {
    parsed = JSON.parse(match[0])
  } catch (e) {
    logger.error('[generateFbPersona] JSON parse error:', e)
    throw new Error('Claude returned malformed JSON')
  }

  // Validation + defaults
  const persona: FbPersona = {
    first_name: typeof parsed.first_name === 'string' && parsed.first_name.trim() ? parsed.first_name.trim() : 'Alex',
    last_name: typeof parsed.last_name === 'string' && parsed.last_name.trim() ? parsed.last_name.trim() : 'Morgan',
    birth_year: Number.isInteger(parsed.birth_year) && parsed.birth_year >= 1970 && parsed.birth_year <= 2005
      ? parsed.birth_year
      : 1992,
    city: typeof parsed.city === 'string' ? parsed.city.trim() : 'Brooklyn',
    country: typeof parsed.country === 'string' ? parsed.country.trim() : 'United States',
    occupation: typeof parsed.occupation === 'string' ? parsed.occupation.trim() : 'Freelance writer',
    bio: typeof parsed.bio === 'string' ? parsed.bio.trim() : '',
    security_answers: {
      mothers_maiden_name: String(parsed.security_answers?.mothers_maiden_name ?? 'Williams'),
      first_pet_name: String(parsed.security_answers?.first_pet_name ?? 'Luna'),
      childhood_street: String(parsed.security_answers?.childhood_street ?? 'Maple Avenue'),
    },
    profile_photo_prompt: typeof parsed.profile_photo_prompt === 'string'
      ? parsed.profile_photo_prompt.trim()
      : 'a minimalist illustration of a coffee cup with steam, black on cream background',
    cover_photo_prompt: typeof parsed.cover_photo_prompt === 'string'
      ? parsed.cover_photo_prompt.trim()
      : 'a wide-angle photo of an empty city street at golden hour, no people',
  }

  // Hard safety check — refuse personas whose photo prompts contain face words
  const FACE_WORDS = /\b(face|portrait|selfie|headshot|smiling|smile|person|woman|man|girl|boy|people)\b/i
  if (FACE_WORDS.test(persona.profile_photo_prompt) || FACE_WORDS.test(persona.cover_photo_prompt)) {
    logger.warn('[generateFbPersona] Claude returned a face-containing prompt — overriding with safe default')
    persona.profile_photo_prompt = 'a minimalist illustration of a vintage record player on a sage green background, no people, no faces'
    persona.cover_photo_prompt = 'a wide-angle photo of an empty city street at golden hour, no people, no faces'
  }

  return persona
}
