import type { Metadata } from 'next'

// Auth pages carry no SEO value and must never be indexed. They're
// client components, so they can't export metadata themselves — this
// server layout sets a short title (avoids inheriting the long root
// default tagline, which renders a >60-char <title>) and marks the
// whole (auth) segment noindex.
export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
