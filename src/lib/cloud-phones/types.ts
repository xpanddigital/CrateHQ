/**
 * Provider-agnostic cloud-phone interface.
 *
 * GeeLark is the v1 implementation. BitBrowser / Multilogin / aliremote can
 * slot in behind this same interface without UI changes.
 *
 * See docs/CLOUD-PHONE-INTEGRATION-HANDOFF.md §6.
 */

export type CloudPhoneProvider =
  | 'geelark'
  | 'bitbrowser'
  | 'aliremote'
  | 'multilogin'
  | 'manual'

export interface ProvisionPhoneOpts {
  /** Human-readable label, e.g. 'alias-brooklyn-1'. Used by the operator UI. */
  label: string
  /**
   * Optional explicit proxy config. When omitted, the provider's native IP
   * (e.g. GeeLark's SIM-based mobile IP) is used. Bring-your-own is only
   * needed if the user wants a residential proxy from Bright Data / Soax /
   * etc.
   */
  proxy?: {
    type: 'sock5' | 'http'
    host: string
    port: number
    username?: string
    password?: string
  }
  /** Provider-specific extras passed through verbatim. */
  metadata?: Record<string, unknown>
}

export interface ProvisionedPhone {
  provider: CloudPhoneProvider
  /** Provider's identifier for this phone profile. Stored in ig_accounts.cloud_phone_profile_id. */
  profileId: string
  /** Browser URL the operator opens to manage this phone in the vendor dashboard. */
  managementUrl: string
}

export interface SubUserCredentials {
  username: string
  /** Plaintext on creation; encrypt via lib/crypto.encrypt() before persisting. */
  password: string
  subUserId: string
}

/**
 * Health snapshot. `unknown` means the provider didn't respond with a status
 * we recognise — treat as "needs investigation" not "broken".
 */
export interface CloudPhoneStatus {
  status: 'running' | 'suspended' | 'shutdown' | 'unknown'
  lastSeen?: Date
}

export interface CloudPhoneClient {
  provider: CloudPhoneProvider

  provisionPhone(opts: ProvisionPhoneOpts): Promise<ProvisionedPhone>
  shutdownPhone(profileId: string): Promise<void>

  /**
   * URL the operator should open in a new tab. May include short-lived auth
   * params (which is why the API route hashes the URL for the audit log
   * instead of persisting it verbatim).
   */
  getPhoneDeepLink(
    profileId: string,
    subUserCreds?: SubUserCredentials
  ): Promise<string>

  /**
   * Create a vendor sub-user scoped to a subset of phones. May throw
   * `SubUserApiNotSupportedError` if the provider only supports manual
   * sub-user creation in their dashboard — callers should catch and fall
   * back to a "create this manually" admin instruction.
   */
  createSubUser(opts: { displayName: string }): Promise<SubUserCredentials>

  assignPhoneToSubUser(profileId: string, subUserId: string): Promise<void>

  getPhoneStatus(profileId: string): Promise<CloudPhoneStatus>
}

/**
 * Thrown when the vendor's API doesn't expose sub-user management
 * programmatically. The /api/admin/cloud-phones/create-subuser route catches
 * this and returns a "create this manually in the vendor dashboard"
 * instruction to the admin instead of failing.
 */
export class SubUserApiNotSupportedError extends Error {
  constructor(message = 'Vendor does not expose sub-user creation via API') {
    super(message)
    this.name = 'SubUserApiNotSupportedError'
  }
}
