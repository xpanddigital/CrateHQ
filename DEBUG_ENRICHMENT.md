# Debug Enrichment Not Using Apify

## Hypothesis

Even though `APIFY_TOKEN` is set in Vercel, Apify isn't being called. Here are the possible reasons:

### 1. `collectArtistUrls()` Returns Empty Array

**Check this first!**

The most likely issue is that `collectArtistUrls()` isn't finding any URLs because your artist records don't have the data in the expected format.

**What the code looks for:**
```javascript
socialLinks.youtube_url
socialLinks.instagram_url
socialLinks.facebook_url
artist.instagram_handle
artist.website
```

**What you might have:**
- Empty `social_links` JSONB
- URLs in different keys
- URLs not formatted correctly

**How to verify:**

Run this SQL query in your Supabase SQL Editor:

```sql
SELECT 
  id,
  name,
  social_links,
  instagram_handle,
  website,
  jsonb_object_keys(social_links) as keys
FROM artists 
WHERE is_enriched = false
LIMIT 5;
```

**Expected output:**
```json
{
  "social_links": {
    "youtube_url": "https://youtube.com/@artist",
    "instagram_url": "https://www.instagram.com/artist/",
    "facebook_url": "https://www.facebook.com/artist"
  },
  "instagram_handle": "artist",
  "website": "https://artist.com"
}
```

**If your data looks different, that's the problem!**

### 2. Apify API Call Failing Silently

The `apifyFetchMultiple()` function catches errors and returns an empty Map:

```javascript
catch (error: any) {
  console.error('[Apify Fetch Multiple] Error:', error.message)
  return resultMap  // Empty Map
}
```

This means if Apify fails, the enrichment continues with direct fetch.

**Possible Apify failures:**
- Invalid token
- Insufficient credits
- Actor not available
- Network timeout
- Rate limiting

### 3. Server Logs Not Visible

Vercel function logs might not be showing in the deployment logs. You need to check the **Function Logs** specifically.

## Debugging Steps

### Step 1: Add Debug Logging

Let me create a debug API endpoint to check what's happening:

**Create:** `src/app/api/debug/enrichment-test/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { collectArtistUrls } from '@/lib/enrichment/apify-fetch'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get one artist
    const { data: artist } = await supabase
      .from('artists')
      .select('*')
      .limit(1)
      .single()

    if (!artist) {
      return NextResponse.json({ error: 'No artists found' })
    }

    // Test URL collection
    const urls = collectArtistUrls(artist)

    return NextResponse.json({
      artist_id: artist.id,
      artist_name: artist.name,
      has_apify_token: !!process.env.APIFY_TOKEN,
      has_anthropic_key: !!process.env.ANTHROPIC_API_KEY,
      social_links: artist.social_links,
      instagram_handle: artist.instagram_handle,
      website: artist.website,
      collected_urls: urls,
      url_count: urls.length,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

Then visit: `https://your-site.vercel.app/api/debug/enrichment-test`

**What to look for:**
- `has_apify_token: true` ✅
- `collected_urls: []` ❌ Problem!
- `collected_urls: ["https://..."]` ✅ Good!

### Step 2: Check Vercel Function Logs

1. Go to https://vercel.com/
2. Select your project
3. Click **Logs** tab (not Deployments)
4. Filter by **Functions**
5. Trigger an enrichment
6. Look for console.log output:
   ```
   [Enrichment] Using batched Apify fetch for all URLs...
   [collectArtistUrls] Collected X URLs...
   ```

If you don't see these logs, the code isn't reaching that point.

### Step 3: Check Apify Account

1. Go to https://console.apify.com/account
2. Check **Account** → **Settings** → **Integrations** → **API tokens**
3. Verify your token is still valid
4. Check **Billing** → **Usage** to see if there are any recent runs

### Step 4: Manual Test with cURL

Test the Apify API directly:

```bash
curl -X POST "https://api.apify.com/v2/acts/apify/website-content-crawler/runs?token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startUrls": [{"url": "https://youtube.com/@test"}],
    "maxCrawlPages": 1,
    "renderingType": "chromium",
    "maxCrawlDepth": 0
  }'
```

If this fails, the token or Apify account has an issue.

## Most Likely Causes (Ranked)

### 1. Empty `social_links` JSONB (90% probability)

**Symptom:** `collectArtistUrls()` returns `[]`

**Fix:** Run the social links migration:
```bash
POST /api/artists/fix-social-links
```

Or manually populate for one artist:
```sql
UPDATE artists 
SET social_links = jsonb_build_object(
  'youtube_url', 'https://youtube.com/@artist',
  'instagram_url', 'https://www.instagram.com/artist/'
)
WHERE id = 'test-artist-id';
```

### 2. Apify API Error (8% probability)

**Symptom:** Logs show "Apify Fetch Multiple Error: ..."

**Fix:** Check Apify dashboard for error details

### 3. Environment Variable Not Actually Set (2% probability)

**Symptom:** `has_apify_token: false` in debug endpoint

**Fix:** Re-add the environment variable in Vercel and redeploy

## Quick Test

Run this in your browser console on the artists page:

```javascript
// Test enrichment on one artist
const testArtist = {
  id: 'test',
  name: 'Test Artist',
  social_links: {
    youtube_url: 'https://youtube.com/@test',
    instagram_url: 'https://www.instagram.com/test/'
  },
  instagram_handle: 'test',
  website: 'https://test.com'
};

// This should return 4-6 URLs
console.log('URLs collected:', collectArtistUrls(testArtist));
```

If this returns an empty array, the URL collection logic has a bug.

---

**Next Action:** Create the debug endpoint and check what `collectArtistUrls()` returns for your real artist data.
