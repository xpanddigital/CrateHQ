# Test Apify Integration NOW ✅

## Quick Test (2 minutes)

### 1. Check Your Environment

Make sure `.env.local` has:
```bash
APIFY_TOKEN=apify_api_xxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
```

### 2. Check Your Artist Data

Open your database and run:
```sql
SELECT 
  name, 
  social_links->>'youtube_url' as youtube,
  social_links->>'instagram_url' as instagram,
  social_links->>'facebook_url' as facebook
FROM artists 
WHERE social_links->>'youtube_url' IS NOT NULL
LIMIT 5;
```

You should see URLs like:
- `https://youtube.com/@artistname`
- `https://www.instagram.com/artistname/`
- `https://www.facebook.com/artistname`

If these are empty, your `social_links` JSONB isn't populated yet. Run the fix:
```bash
# In your browser, call this API endpoint once:
POST /api/artists/fix-social-links
```

### 3. Run Enrichment on ONE Artist

1. Go to `/artists` page
2. Find an artist with YouTube/Instagram URLs
3. Click the checkbox next to their name
4. Click "Enrich Selected (1)"
5. **Open browser console** (F12 → Console tab)

### 4. Watch for These Logs

You should see:

```
[Enrichment Start] Artist: Artist Name (uuid)
[Enrichment] Using batched Apify fetch for all URLs...
[collectArtistUrls] Collected 6 URLs for Artist Name: [...]
[Apify Fetch Multiple] Starting batch fetch for 6 URLs...
[Apify Fetch Multiple] Run started: apify_actor_run_xxx
[Apify Fetch Multiple] Polling for completion...
[Apify Fetch Multiple] Run completed successfully
[Apify Fetch Multiple] https://youtube.com/@artist/about: 45231 characters
[Apify Fetch Multiple] https://www.instagram.com/artist/: 38492 characters
[Apify Fetch Multiple] Success: 6/6 pages fetched
[Enrichment] Batched fetch complete: 6 pages loaded

[Step 1] YouTube URL: https://youtube.com/@artist
[Step 1] Fetching YouTube About: https://youtube.com/@artist/about
[Step 1] Using pre-fetched content: 45231 chars  ← ✅ APIFY USED!

[Step 2] Instagram URL: https://www.instagram.com/artist/
[Step 2] Fetching Instagram: https://www.instagram.com/artist/
[Step 2] Using pre-fetched content: 38492 chars  ← ✅ APIFY USED!
```

### 5. Verify in Apify Dashboard

1. Go to https://console.apify.com/
2. Click "Runs" in the sidebar
3. You should see a new run of `apify/website-content-crawler`
4. Click it to see details:
   - Start URLs: Should show 6-10 URLs
   - Status: SUCCEEDED
   - Items: Should show 6-10 results
   - Cost: ~$0.01

## What If It's Not Working?

### Issue: "No APIFY_TOKEN configured"

**Fix:** Add `APIFY_TOKEN=apify_api_xxx` to `.env.local` and restart your dev server.

### Issue: "Collected 0 URLs"

**Fix:** Your `social_links` JSONB is empty. Run:
```bash
POST /api/artists/fix-social-links
```

Or manually update an artist:
```sql
UPDATE artists 
SET social_links = jsonb_build_object(
  'youtube_url', 'https://youtube.com/@artist',
  'instagram_url', 'https://www.instagram.com/artist/',
  'facebook_url', 'https://www.facebook.com/artist'
)
WHERE id = 'uuid-here';
```

### Issue: "Using direct fetch" instead of "Using pre-fetched content"

**Fix:** The URL in `collectArtistUrls()` doesn't match the URL in the step function.

Check the logs:
```
[collectArtistUrls] Collected URLs: [...]
[Step 1] Fetching YouTube About: ...
```

If the URLs don't match exactly, the pre-fetch lookup fails.

### Issue: Apify run times out or fails

**Fix:** Check your Apify account:
- Do you have credits?
- Is the actor `apify/website-content-crawler` available?
- Check the run logs for errors

## Expected Results

After enrichment completes:

1. **Artist record updated:**
   - `email` field populated
   - `email_source` shows "YouTube About" or "Instagram Bio"
   - `email_confidence` shows 0.75-0.95
   - `is_enriched` = true
   - `is_contactable` = true

2. **Enrichment log created:**
   - Go to `/enrichment-logs` page
   - Find the artist's log
   - See step-by-step breakdown
   - `apify_used` should be `true` for most steps

3. **Apify dashboard:**
   - 1 new run per artist
   - 6-10 URLs fetched
   - Cost: ~$0.01 per artist

## Cost Estimate

- **Single artist:** ~$0.01
- **10 artists:** ~$0.10
- **100 artists:** ~$1.00
- **1,000 artists:** ~$10.00

Compare to old system:
- **Old:** 6 Apify runs per artist = $0.06 per artist
- **New:** 1 Apify run per artist = $0.01 per artist
- **Savings:** 83%

---

**Status**: Ready to test
**Next**: Run enrichment on 1 artist and verify the logs above
