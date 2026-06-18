/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.scdn.co', // Spotify CDN (artist images)
      },
      {
        protocol: 'https',
        hostname: '*.scdn.co', // Spotify CDN variants
      },
      {
        protocol: 'https',
        hostname: '*.cdninstagram.com', // Instagram CDN
      },
      {
        protocol: 'https',
        hostname: '*.fbcdn.net', // Facebook/Instagram CDN
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com', // YouTube thumbnails
      },
      {
        protocol: 'https',
        hostname: '*.ggpht.com', // YouTube channel avatars
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          // Conservative CSP. Tighten further if you remove inline scripts;
          // Next.js dev/prod both inject inline runtime so 'unsafe-inline' is required.
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.vercel-insights.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.anthropic.com https://api.instantly.ai https://services.leadconnectorhq.com https://generativelanguage.googleapis.com https://*.vercel-insights.com",
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
              "frame-ancestors 'none'",
              "form-action 'self' https://checkout.stripe.com",
              "base-uri 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
