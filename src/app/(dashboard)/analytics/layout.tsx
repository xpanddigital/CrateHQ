import { requireAdminPage } from '@/lib/auth/require-admin-page'

export default async function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAdminPage()
  return <>{children}</>
}
