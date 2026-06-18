import type { CloudPhoneClient, CloudPhoneProvider } from './types'
import { GeeLarkClient } from './geelark'

/**
 * Factory for cloud-phone provider clients. v1 ships GeeLark only;
 * additional providers slot in here behind the same interface.
 */
export function getCloudPhoneClient(
  provider: CloudPhoneProvider = 'geelark'
): CloudPhoneClient {
  switch (provider) {
    case 'geelark':
      return new GeeLarkClient()
    case 'manual':
      throw new Error(
        "Provider 'manual' has no client — phones for manual providers are tracked in ig_accounts but never provisioned via API."
      )
    default:
      throw new Error(
        `Unsupported cloud phone provider: ${provider}. Add an implementation in src/lib/cloud-phones/.`
      )
  }
}

export * from './types'
