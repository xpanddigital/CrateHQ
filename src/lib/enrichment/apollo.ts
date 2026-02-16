// Apollo.io API client
// Requires APOLLO_API_KEY environment variable

export interface ApolloContact {
  email: string
  first_name: string
  last_name: string
  title: string
  organization_name: string
  linkedin_url: string
}

export async function searchPerson(
  name: string,
  organization?: string
): Promise<ApolloContact[]> {
  const apiKey = process.env.APOLLO_API_KEY
  if (!apiKey) {
    console.warn('APOLLO_API_KEY not configured')
    return []
  }

  try {
    const res = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        q_keywords: name,
        ...(organization && { q_organization_name: organization }),
        page: 1,
        per_page: 10,
      }),
    })

    if (!res.ok) {
      throw new Error(`Apollo.io API error: ${res.statusText}`)
    }

    const data = await res.json()
    return data.people || []
  } catch (error) {
    console.error('Apollo.io error:', error)
    return []
  }
}
