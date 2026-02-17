# Fix Enrichment - Immediate Action Required

## Problem Identified ✅

Your artists have Instagram URLs, Spotify URLs, Facebook URLs, and Twitter URLs in the CSV, **BUT** they're not being saved to the `social_links` field that the enrichment pipeline needs.

## Solution (2 Steps)

### Step 1: Fix Existing Artists

Run this API endpoint to populate `social_links` for all your existing artists:

```bash
curl -X POST http://localhost:3000/api/artists/fix-social-links \
  -H "Content-Type: application/json"
```

This will:
- ✅ Read all 100+ artists from your database
- ✅ Build `social_links` JSON from their Instagram handle, Spotify URL, and Website
- ✅ Update each artist record
- ✅ Show you how many were updated

**Expected Output:**
```json
{
  "success": true,
  "total": 100,
  "updated": 95,
  "skipped": 5,
  "errors": []
}
```

### Step 2: Re-import Your CSV (Recommended)

Your CSV has these columns:
- `instagram_url` ✅
- `facebook_url` ✅
- `twitter_url` ✅
- `spotify_url` ✅

The updated import route will now automatically populate `social_links` from these columns.

**To re-import:**
1. Go to Artists page
2. Click "Import CSV"
3. Upload your CSV again
4. The system will now properly populate `social_links`

## What Changed

### 1. Artist Add Modal
- Changed "Instagram Handle" → "Instagram URL"
- Added "Spotify URL" field
- Auto-populates `social_links` JSON

### 2. CSV Import Route
- Now reads `instagram_url`, `facebook_url`, `twitter_url`, `spotify_url` columns
- Automatically builds `social_links` JSON
- Extracts Instagram handle from URL

### 3. Fix Script
- New endpoint: `/api/artists/fix-social-links`
- Populates `social_links` for existing artists
- Uses Instagram handle, Spotify URL, and Website

## Why This Matters

The enrichment pipeline looks for data in `social_links`:

```typescript
// Before (broken):
artist.social_links = {}  // Empty!

// After (working):
artist.social_links = {
  "instagram": "https://instagram.com/poolside",
  "spotify": "https://open.spotify.com/artist/...",
  "facebook": "https://facebook.com/poolside",
  "twitter": "https://twitter.com/poolside",
  "website": "https://example.com"
}
```

With this data, the enrichment pipeline can:
1. Extract emails from social link patterns
2. Call Anthropic AI to analyze the social profiles
3. Find contact information from multiple sources

## Test It

After running the fix script:

1. Go to Artists page
2. Select "Poolside" (or any artist)
3. Click "Enrich Selected"
4. Watch the console logs
5. You should see Anthropic API calls now!
6. Check enrichment logs page for detailed results

## Expected Results

With proper `social_links` populated:
- ✅ Anthropic API will be called
- ✅ AI will analyze social profiles
- ✅ Emails will be found (30-50% success rate expected)
- ✅ Logs will show detailed step-by-step results

---

**Run the fix script now, then try enrichment again!**
