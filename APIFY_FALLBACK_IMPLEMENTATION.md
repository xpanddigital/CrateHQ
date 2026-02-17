# Apify Fallback Implementation Guide

## Overview
This document outlines the complete implementation of the 3-tier enrichment system with Apify fallback.

## Status: 🟡 IN PROGRESS

### ✅ Completed
1. **Apify Fallback Class** (`src/lib/enrichment/apify-fallback.ts`)
   - Platform-specific scrapers (YouTube, Instagram, Website, Facebook, Linktree)
   - Blocked content detection
   - Email extraction from Apify results
   - Error handling and logging

2. **Database Schema** (`supabase-enrichment-detailed-logs.sql`)
   - `enrichment_detailed_logs` table for tracking every attempt
   - Analytics view for performance metrics
   - Indexes for fast queries

### 🔄 In Progress / TODO

#### 3. Update Pipeline.ts (CRITICAL)
**File:** `src/lib/enrichment/pipeline.ts`

**Changes needed for each step:**

```typescript
// Example pattern for step1_YouTubeAbout
async function step1_YouTubeAbout(
  artist: Artist,
  anthropicKey: string,
  apifyFallback?: ApifyEnrichmentFallback
): Promise<{ emails: string[]; confidence: number; url: string; rawContent: string; apifyUsed: boolean; wasBlocked: boolean }> {
  
  // TIER 1: Direct fetch
  let html = await fetchWithTimeout(aboutUrl)
  let wasBlocked = ApifyEnrichmentFallback.isBlockedContent(html, 'youtube')
  let apifyUsed = false

  // TIER 2: Apify fallback if blocked
  if (wasBlocked && apifyFallback) {
    const apifyResult = await apifyFallback.scrapeYouTube(youtubeUrl)
    if (apifyResult.success) {
      html = apifyResult.content
      apifyUsed = true
      wasBlocked = false
      
      // Check if Apify already found emails
      if (apifyResult.emails.length > 0) {
        return { 
          emails: apifyResult.emails, 
          confidence: 0.85, 
          url: aboutUrl, 
          rawContent: html,
          apifyUsed: true,
          wasBlocked: false
        }
      }
    }
  }

  // TIER 3: Extract emails from content
  const directEmails = extractEmailsFromHTML(html)
  if (directEmails.length > 0) {
    return { emails: directEmails, confidence: 0.85, url: aboutUrl, rawContent: html, apifyUsed, wasBlocked }
  }

  // TIER 3b: AI extraction
  const aiResult = await extractEmailWithAI(html, prompt, model, anthropicKey)
  if (aiResult.email && validateEmail(aiResult.email, html)) {
    return { emails: [aiResult.email], confidence: 0.85, url: aboutUrl, rawContent: html, apifyUsed, wasBlocked }
  }

  return { emails: [], confidence: 0, url: aboutUrl, rawContent: html, apifyUsed, wasBlocked }
}
```

**Apply this pattern to:**
- ✅ step1_YouTubeAbout
- ⬜ step2_InstagramBio
- ⬜ step3_LinkInBio
- ⬜ step4_WebsiteContact
- ⬜ step5_FacebookAbout
- ⬜ step6_RemainingSocials

**Update main enrichArtist function:**
- Accept `apifyConfig` parameter
- Create ApifyEnrichmentFallback instance if config provided
- Pass to each step
- Log detailed results to `enrichment_detailed_logs` table

#### 4. Settings Page - Apify Actor Configuration
**File:** `src/app/(dashboard)/settings/page.tsx`

**Add new section:**
```typescript
<Card>
  <CardHeader>
    <CardTitle>Enrichment Scrapers (Apify)</CardTitle>
    <CardDescription>
      Configure Apify actor IDs for fallback scraping when direct fetch fails
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="space-y-2">
      <Label>YouTube Scraper Actor ID</Label>
      <Input
        placeholder="apify/youtube-scraper"
        value={apifyActors.youtube}
        onChange={(e) => setApifyActors({...apifyActors, youtube: e.target.value})}
      />
      <p className="text-xs text-muted-foreground">
        Falls back when YouTube blocks direct fetch (45% hit rate)
      </p>
    </div>
    
    <div className="space-y-2">
      <Label>Instagram Scraper Actor ID</Label>
      <Input
        placeholder="apify/instagram-profile-scraper"
        value={apifyActors.instagram}
        onChange={(e) => setApifyActors({...apifyActors, instagram: e.target.value})}
      />
    </div>
    
    <div className="space-y-2">
      <Label>Website Crawler Actor ID</Label>
      <Input
        placeholder="apify/website-content-crawler"
        value={apifyActors.website}
        onChange={(e) => setApifyActors({...apifyActors, website: e.target.value})}
      />
    </div>
    
    <div className="space-y-2">
      <Label>Facebook Scraper Actor ID</Label>
      <Input
        placeholder="apify/facebook-pages-scraper"
        value={apifyActors.facebook}
        onChange={(e) => setApifyActors({...apifyActors, facebook: e.target.value})}
      />
    </div>
    
    <Button onClick={saveApifyActors}>Save Actor Configuration</Button>
  </CardContent>
</Card>
```

**Store in `integrations` table:**
```sql
INSERT INTO integrations (user_id, service, api_key, config)
VALUES (
  auth.uid(),
  'apify_actors',
  null,
  jsonb_build_object(
    'youtube', 'actor-id',
    'instagram', 'actor-id',
    'website', 'actor-id',
    'facebook', 'actor-id'
  )
);
```

#### 5. Enrichment Settings Modal
**File:** `src/components/artists/EnrichmentSettingsModal.tsx` (NEW)

**Features:**
- Checkboxes for which methods to run (YouTube, Instagram, Link-in-bio, Website, Facebook, All Socials)
- "Use Apify fallback" toggle (on by default if Apify token configured)
- AI Model selector: Sonnet (better) vs Haiku (faster)
- Estimated cost display
- Batch size selector

```typescript
interface EnrichmentSettings {
  methods: {
    youtube: boolean
    instagram: boolean
    linkinbio: boolean
    website: boolean
    facebook: boolean
    socials: boolean
  }
  useApifyFallback: boolean
  aiModel: 'sonnet' | 'haiku'
  batchSize: number
}
```

#### 6. Update BulkEnrichModal
**File:** `src/components/artists/BulkEnrichModal.tsx`

**Changes:**
- Add "Settings" button that opens EnrichmentSettingsModal
- Pass settings to API
- Show detailed progress: "Processing 14/340 — Emails found: 8 — Current: checking YouTube for Artist Name"
- Real-time updates with method breakdown
- Summary stats at end: "YouTube: 156, Instagram: 42, Link-in-bio: 28, Website: 12, Facebook: 7"

#### 7. API Route Updates
**File:** `src/app/api/artists/bulk-enrich/route.ts`

**Changes:**
- Accept enrichment settings in request body
- Fetch Apify config from integrations table
- Pass ApifyConfig to enrichment pipeline
- Log detailed results to `enrichment_detailed_logs`
- Return method breakdown stats

#### 8. Analytics Dashboard
**File:** `src/app/(dashboard)/enrichment-analytics/page.tsx` (NEW)

**Features:**
- Success rate by method (bar chart)
- Apify fallback usage (pie chart)
- Blocked attempts by platform
- Cost analysis (AI tokens + Apify runs)
- Time-series of enrichment performance

## Testing Plan

1. **Unit Tests**
   - ApifyEnrichmentFallback class methods
   - isBlockedContent detection
   - Email extraction

2. **Integration Tests**
   - Full pipeline with Apify fallback
   - Settings save/load
   - Batch enrichment with various configurations

3. **Manual Testing**
   - Test each platform scraper
   - Verify fallback triggers correctly
   - Check detailed logs are saved
   - Validate analytics calculations

## Deployment Steps

1. Run `supabase-enrichment-detailed-logs.sql` in Supabase SQL Editor
2. Deploy updated code to Vercel
3. Configure Apify actor IDs in Settings page
4. Test with small batch (5-10 artists)
5. Monitor logs and analytics
6. Scale to full batch enrichment

## Performance Considerations

- **Apify Rate Limits:** Default 120 req/min, can be increased
- **AI Token Costs:** Sonnet ~$15/1M tokens, Haiku ~$1.25/1M tokens
- **Batch Processing:** 2-second delay between artists
- **Timeout:** 10s for direct fetch, 120s for Apify runs
- **Early Termination:** Stop as soon as email found

## Cost Estimation

For 1000 artists:
- **Direct Fetch Only:** ~$5-10 in AI tokens (if all succeed)
- **With Apify Fallback:** ~$15-30 (AI + Apify compute)
- **Apify Actors:** ~$0.01-0.05 per run depending on actor

## Success Metrics

- **Email Discovery Rate:** Target 70%+ (up from current ~30%)
- **Apify Fallback Usage:** Expect 20-30% of attempts
- **Blocked Content Detection:** Should catch 95%+ of login walls
- **Average Time per Artist:** Target <15 seconds

## Next Steps

1. Complete pipeline.ts integration (highest priority)
2. Add settings page UI for Apify actors
3. Create enrichment settings modal
4. Update bulk enrich with detailed progress
5. Build analytics dashboard
6. Write tests
7. Deploy and monitor

---

**Last Updated:** 2026-02-17
**Status:** Part 1 complete (Apify fallback class + DB schema)
**Next:** Pipeline integration
