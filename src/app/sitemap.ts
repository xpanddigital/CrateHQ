import type { MetadataRoute } from 'next'
import { getVisiblePosts } from './(marketing)/blog/posts'

const BASE = 'https://www.praecora.com'

// Revalidate hourly so scheduled posts flip into the sitemap without
// a deploy. Matches the listing page cadence.
export const revalidate = 3600

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const visiblePosts = getVisiblePosts(now)

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    {
      url: `${BASE}/how-it-works`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${BASE}/pricing`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${BASE}/faq`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE}/demo`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE}/blog`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      // Author profile page — part of the Author Authority Hub pattern.
      // Indexable on purpose; tells Google the relationship between
      // the Praecora property and the canonical author entity at
      // JoelHouse.com.
      url: `${BASE}/author/joel-house`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    // Legal pages are indexable; include them so they aren't flagged as
    // "indexable page not in sitemap."
    {
      url: `${BASE}/legal/terms`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE}/legal/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  const postRoutes: MetadataRoute.Sitemap = visiblePosts.map((p) => ({
    url: `${BASE}/blog/${p.slug}`,
    lastModified: new Date((p.updatedAt ?? p.publishedAt) + 'T00:00:00Z'),
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  return [...staticRoutes, ...postRoutes]
}
