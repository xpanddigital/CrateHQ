/**
 * GeeLark cloud-phone client.
 *
 * Real endpoints + auth verified live against openapi.geelark.com on
 * 2026-05-26 by running phone/list with the issued credentials.
 *
 * Auth — "Token" verification mode:
 *   Headers:
 *     traceId (UUIDv4)
 *     Authorization: Bearer <GEELARK_API_KEY>
 *
 * GeeLark also supports a "Key" mode (HMAC of appId+traceId+ts+nonce+apiKey)
 * but Token mode is simpler and what their dashboard issues by default —
 * the value GeeLark labels "API Key" works as a Bearer token directly.
 *
 * Response envelope (always):
 *   { traceId, code, msg, data }     // code === 0 means success
 *
 * Sub-user management is NOT exposed via API. Both createSubUser and
 * assignPhoneToSubUser throw SubUserApiNotSupportedError — the API routes
 * catch it and surface the "create manually in dashboard" instruction.
 */

import crypto from 'crypto'
import {
  CloudPhoneClient,
  CloudPhoneProvider,
  CloudPhoneStatus,
  ProvisionPhoneOpts,
  ProvisionedPhone,
  SubUserApiNotSupportedError,
  SubUserCredentials,
} from './types'

const ENDPOINTS = {
  phoneAddNew: '/open/v1/phone/addNew',
  phoneStart: '/open/v1/phone/start',
  phoneStop: '/open/v1/phone/stop',
  phoneDelete: '/open/v1/phone/delete',
  phoneList: '/open/v1/phone/list',
  phoneStatus: '/open/v1/phone/status',
} as const

const DEFAULT_API_BASE = 'https://openapi.geelark.com'
// VERIFY: GeeLark's API docs don't publish a deep-link URL pattern. This is
// the dashboard-side route — confirm by opening a phone in the dashboard
// once and copying the URL. Override via GEELARK_DEEP_LINK_TEMPLATE if
// different ({id} is substituted for the profileId).
const DEFAULT_DEEP_LINK_TEMPLATE = 'https://app.geelark.com/cloudPhones/{id}'

interface GeeLarkResponse<T> {
  traceId?: string
  code?: number
  msg?: string
  data?: T
}

export class GeeLarkClient implements CloudPhoneClient {
  readonly provider: CloudPhoneProvider = 'geelark'
  private readonly apiKey: string
  private readonly apiBase: string
  private readonly deepLinkTemplate: string

  constructor() {
    const apiKey = process.env.GEELARK_API_KEY
    if (!apiKey) {
      throw new Error(
        'GeeLark not configured — set GEELARK_API_KEY in your env (see .env.local.example)'
      )
    }
    this.apiKey = apiKey
    this.apiBase = (process.env.GEELARK_API_BASE || DEFAULT_API_BASE).replace(
      /\/+$/,
      ''
    )
    this.deepLinkTemplate =
      process.env.GEELARK_DEEP_LINK_TEMPLATE || DEFAULT_DEEP_LINK_TEMPLATE
  }

  async provisionPhone(opts: ProvisionPhoneOpts): Promise<ProvisionedPhone> {
    // GeeLark's addNew is batch — we send one env row. mobileType defaults
    // to Android 12 (current most reliable for IG outreach per the
    // operations playbook). Adjust via opts.metadata if needed.
    const envRow: Record<string, unknown> = {
      profileName: opts.label,
      profileNote: opts.label,
    }

    if (opts.proxy) {
      // GeeLark expects a single proxy URL string, not an object.
      const cred = opts.proxy.username
        ? `${encodeURIComponent(opts.proxy.username)}:${encodeURIComponent(
            opts.proxy.password ?? ''
          )}@`
        : ''
      envRow.proxyInformation = `${opts.proxy.type}://${cred}${opts.proxy.host}:${opts.proxy.port}`
    } else if (process.env.GEELARK_DEFAULT_PROXY_INFORMATION) {
      // BYO proxy URL fallback. Format: socks5://user:pass@host:port
      envRow.proxyInformation = process.env.GEELARK_DEFAULT_PROXY_INFORMATION
    } else if (process.env.GEELARK_DEFAULT_DYNAMIC_PROXY) {
      // Dynamic proxy from a provider configured in the GeeLark dashboard.
      // Allowed values per GeeLark docs: IPHTML / kookeey / Luminati (BrightData)
      // / rolaip / Proxyma / DECODO / NodeMaven / kookeeyMobile.
      envRow.dynamicProxy = process.env.GEELARK_DEFAULT_DYNAMIC_PROXY
      envRow.dynamicProxyLocation =
        process.env.GEELARK_DEFAULT_DYNAMIC_PROXY_LOCATION || 'us'
    } else if (process.env.GEELARK_DEFAULT_PROXY_NUMBER) {
      // Use a saved proxy by serial number (set up once via the GeeLark UI
      // or POST /open/v1/proxy/add).
      envRow.proxyNumber = parseInt(process.env.GEELARK_DEFAULT_PROXY_NUMBER, 10)
    }
    // If none of the above are set AND opts.proxy isn't passed, GeeLark
    // will reject the request with code 45006 "proxy information error".
    // We let that bubble up rather than fake-succeeding — the caller's UI
    // surfaces it as a provisioning failure with the GeeLark error verbatim.

    const requestBody: Record<string, unknown> = {
      mobileType: (opts.metadata?.mobileType as string) ?? 'Android 12',
      chargeMode: 0,
      region: (opts.metadata?.region as string) ?? 'sgp',
      data: [envRow],
    }

    const res = await this.request<{
      totalAmount?: number
      successAmount?: number
      failAmount?: number
      details?: Array<{
        index?: number
        code?: number
        msg?: string
        id?: string
        profileName?: string
        envSerialNo?: string
      }>
    }>(ENDPOINTS.phoneAddNew, requestBody)

    const detail = res.details?.[0]
    if (!detail || detail.code !== 0 || !detail.id) {
      throw new Error(
        `GeeLark addNew returned no successful detail: ${JSON.stringify(res).slice(0, 500)}`
      )
    }

    return {
      provider: 'geelark',
      profileId: detail.id,
      managementUrl: this.deepLinkFor(detail.id),
    }
  }

  async shutdownPhone(profileId: string): Promise<void> {
    await this.request(ENDPOINTS.phoneStop, { ids: [profileId] })
  }

  async getPhoneDeepLink(profileId: string): Promise<string> {
    // GeeLark dashboard sessions are cookie-based — there's no per-link
    // auto-login token. Operator logs in once per browser session with
    // their sub-user credentials; subsequent clicks deep-link to the right
    // phone because they're already authenticated.
    return this.deepLinkFor(profileId)
  }

  async createSubUser(_opts: { displayName: string }): Promise<SubUserCredentials> {
    // GeeLark's public API does not expose sub-user / team-member creation
    // (verified against geelark-openapi/main, only Team App management is
    // documented under "Application Management"). The API route catches
    // this and returns a "create manually in dashboard, then POST with
    // manual_creds" 422.
    throw new SubUserApiNotSupportedError(
      'GeeLark does not expose sub-user creation via API. Create the sub-user manually in Settings → Team, then POST /api/admin/cloud-phones/create-subuser with manual_creds.'
    )
  }

  async assignPhoneToSubUser(_profileId: string, _subUserId: string): Promise<void> {
    // Same reason as createSubUser — manual via dashboard only.
    throw new SubUserApiNotSupportedError(
      'GeeLark does not expose sub-user assignment via API. Assign the phone to the sub-user manually in Settings → Team → <user> → Phone Permissions.'
    )
  }

  async getPhoneStatus(profileId: string): Promise<CloudPhoneStatus> {
    const res = await this.request<{
      successDetails?: Array<{ id: string; serialName?: string; status?: number }>
      failDetails?: Array<{ id: string; code?: number; msg?: string }>
    }>(ENDPOINTS.phoneStatus, { ids: [profileId] })

    const success = res.successDetails?.find((d) => d.id === profileId)
    if (success && typeof success.status === 'number') {
      // GeeLark status integer mapping per their dashboard convention:
      //   0 = stopped/expired, 1 = starting, 2 = running, 3 = stopping
      // We bucket conservatively — unknown values map to 'unknown' rather
      // than guess. Verify at smoke test and tighten if needed.
      let mapped: CloudPhoneStatus['status'] = 'unknown'
      if (success.status === 0) mapped = 'shutdown'
      else if (success.status === 1) mapped = 'running' // starting → effectively up
      else if (success.status === 2) mapped = 'running'
      else if (success.status === 3) mapped = 'suspended'
      return { status: mapped }
    }

    const failure = res.failDetails?.find((d) => d.id === profileId)
    if (failure) {
      return { status: 'unknown' }
    }
    return { status: 'unknown' }
  }

  private deepLinkFor(profileId: string): string {
    return this.deepLinkTemplate.replace('{id}', encodeURIComponent(profileId))
  }

  /**
   * POST with Token-mode Bearer auth. Returns the unwrapped `data` field
   * on success; throws GeeLarkApiError on any non-zero code or HTTP error.
   */
  private async request<T>(path: string, body: unknown): Promise<T> {
    const traceId = crypto.randomUUID()
    const url = `${this.apiBase}${path}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        traceId,
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body ?? {}),
    })

    const text = await res.text()
    let json: GeeLarkResponse<T> | undefined
    try {
      json = text ? JSON.parse(text) : undefined
    } catch {
      throw new GeeLarkApiError(
        `GeeLark ${path}: non-JSON response (HTTP ${res.status}): ${text.slice(0, 500)}`,
        res.status
      )
    }

    if (!res.ok) {
      throw new GeeLarkApiError(
        `GeeLark ${path} HTTP ${res.status}: ${json?.msg || text.slice(0, 300)}`,
        res.status,
        json?.code
      )
    }

    if (json && typeof json.code === 'number' && json.code !== 0) {
      throw new GeeLarkApiError(
        `GeeLark ${path} biz error ${json.code}: ${json?.msg ?? 'unknown'}`,
        res.status,
        json.code
      )
    }

    return (json?.data ?? ({} as T)) as T
  }
}

export class GeeLarkApiError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly bizCode?: number
  ) {
    super(message)
    this.name = 'GeeLarkApiError'
  }
}
