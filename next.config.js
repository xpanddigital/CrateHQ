/** @type {import('next').NextConfig} */
const nextConfig = {
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
}

module.exports = nextConfig
