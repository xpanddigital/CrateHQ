const APIFY_BASE = 'https://api.apify.com/v2'

export async function startActorRun(token: string, actorId: string, input: object) {
  // Apify API format: /v2/acts/{actorId}/runs
  const res = await fetch(`${APIFY_BASE}/acts/${actorId}/runs?token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Apify API error: ${res.status} ${res.statusText} - ${errorText}`)
  }
  return res.json()
}

export async function getRunStatus(token: string, runId: string) {
  const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`, {
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Apify API error: ${res.status} ${res.statusText} - ${errorText}`)
  }
  return res.json()
}

export async function getDatasetItems(token: string, datasetId: string) {
  const res = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items?format=json&token=${token}`, {
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Apify API error: ${res.status} ${res.statusText} - ${errorText}`)
  }
  return res.json()
}
