// Hunter.io API client
// Requires HUNTER_API_KEY environment variable

export interface HunterEmail {
  value: string
  type: string
  confidence: number
  sources: Array<{
    domain: string
    uri: string
    extracted_on: string
  }>
}

export async function searchDomain(domain: string): Promise<HunterEmail[]> {
  const apiKey = process.env.HUNTER_API_KEY
  if (!apiKey) {
    console.warn('HUNTER_API_KEY not configured')
    return []
  }

  try {
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${apiKey}`
    )
    if (!res.ok) {
      throw new Error(`Hunter.io API error: ${res.statusText}`)
    }
    const data = await res.json()
    return data.data?.emails || []
  } catch (error) {
    console.error('Hunter.io error:', error)
    return []
  }
}

export async function verifyEmail(email: string): Promise<{ result: string; score: number }> {
  const apiKey = process.env.HUNTER_API_KEY
  if (!apiKey) {
    return { result: 'unknown', score: 0 }
  }

  try {
    const res = await fetch(
      `https://api.hunter.io/v2/email-verifier?email=${email}&api_key=${apiKey}`
    )
    if (!res.ok) {
      throw new Error(`Hunter.io API error: ${res.statusText}`)
    }
    const data = await res.json()
    return {
      result: data.data?.result || 'unknown',
      score: data.data?.score || 0,
    }
  } catch (error) {
    console.error('Hunter.io error:', error)
    return { result: 'unknown', score: 0 }
  }
}
