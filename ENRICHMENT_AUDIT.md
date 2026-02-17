# Enrichment Logic Audit - Critical Issues Found

## Executive Summary

**Status: ❌ BROKEN - No API calls being made to Anthropic**

After auditing the enrichment pipeline, I've identified **critical issues** that explain why:
1. No emails are being found
2. No Anthropic API calls are being made
3. No logs are appearing in the enrichment logs page

---

## Critical Issues Identified

### 🔴 Issue #1: Anthropic API Key Not Being Passed

**Location:** `src/app/api/artists/bulk-enrich/route.ts` (Line 31-33)

**Current Code:**
```typescript
const apiKeys = {
  anthropic: process.env.ANTHROPIC_API_KEY,
}
```

**Problem:** The code reads `ANTHROPIC_API_KEY` from `process.env`, but in Next.js, **environment variables are only available on the server side during build time or in API routes**. However, there's a more critical issue...

**Your `.env.local` shows:**
```
ANTHROPIC_API_KEY=sk-ant-api03-***[REDACTED]***
```

This key IS present, so that's not the issue...

---

### 🔴 Issue #2: Enrichment Pipeline Logic Flaw

**Location:** `src/lib/enrichment/pipeline.ts`

**The Real Problem:**

Looking at the enrichment pipeline, **ALL 4 steps require the Anthropic API key to work**:

1. **YouTube Email Extraction** (Line 254): Only calls AI if `youtubeUrl && anthropicKey`
2. **Social Media Email** (Line 341): Only calls AI if `anthropicKey && (personalUrls.length > 0 || artist.biography)`
3. **Instagram Contact** (Line 401): Only calls AI if `anthropicKey && artist.instagram_handle`
4. **Instagram Deep** (Line 480): Only calls AI if `anthropicKey`

**BUT** - Each step has a **fallback that returns empty results** if conditions aren't met!

### Example from Step 1 (YouTube):
```typescript
async function extractYouTubeEmail(artist: Artist, anthropicKey?: string) {
  const emails: string[] = []
  
  // Extract emails from social links
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const foundInLinks = allLinksText.match(emailRegex) || []
  emails.push(...foundInLinks)
  
  if (emails.length > 0) {
    return { emails: Array.from(new Set(emails)), confidence: 0.85 }
  }
  
  // If we have a YouTube URL and an AI key, use Claude
  if (youtubeUrl && anthropicKey) {
    // ... AI call here
  }
  
  return { emails: [], confidence: 0 }  // ❌ Returns empty if no AI key or no YouTube URL
}
```

**This means:**
- If artists don't have emails **directly visible** in their social_links JSON
- The pipeline will skip AI analysis and return empty results
- **No Anthropic API calls will be made**

---

### 🔴 Issue #3: Missing Data Prerequisites

For the enrichment to work, artists need:

1. **YouTube URL** in social_links → for Step 1
2. **Personal URLs** (Linktree, website, etc.) OR **biography** → for Step 2
3. **Instagram handle** → for Steps 3 & 4

**If artists are missing these fields, the AI steps are skipped entirely.**

---

### 🔴 Issue #4: Enrichment Logs Not Showing

**Location:** `src/app/api/artists/bulk-enrich/route.ts` (Line 98-111)

The code **does** save to `enrichment_logs` table:

```typescript
await supabase
  .from('enrichment_logs')
  .insert({
    artist_id: artist.id,
    artist_name: artist.name,
    email_found: result.email_found,
    email_confidence: result.email_confidence,
    email_source: result.email_source,
    all_emails: result.all_emails,
    steps: result.steps,
    total_duration_ms: result.total_duration_ms,
    is_contactable: result.is_contactable,
    run_by: user.id,
  })
```

**But this might be failing silently if:**
1. The `enrichment_logs` table doesn't exist in your Supabase database
2. RLS policies are blocking the insert
3. The insert is failing but errors are not being thrown

---

## Root Cause Analysis

### Why No Anthropic API Calls?

The enrichment pipeline is designed to:
1. **First** try to extract emails from existing data (regex on social_links, biography, website)
2. **Only if that fails** → call Anthropic AI

**Your artists likely:**
- Don't have emails visible in their `social_links` JSON
- Don't have YouTube URLs
- Don't have sufficient biography text
- Don't have personal website URLs

**Result:** All 4 steps return `{ emails: [], confidence: 0 }` without ever calling the AI.

---

## Verification Steps

### 1. Check if enrichment_logs table exists

```sql
SELECT * FROM enrichment_logs LIMIT 1;
```

If this fails, run the migration:
```bash
# In Supabase SQL Editor
# Run: supabase-enrichment-logs.sql
```

### 2. Check sample artist data quality

```sql
SELECT 
  name,
  social_links,
  instagram_handle,
  website,
  biography,
  (social_links::text LIKE '%youtube%') as has_youtube,
  (social_links::text LIKE '%@%') as has_email_in_links
FROM artists 
LIMIT 10;
```

This will show if your artists have the necessary data for enrichment.

### 3. Test Anthropic API key directly

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: YOUR_ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-haiku-4-5-20251001",
    "max_tokens": 50,
    "messages": [{"role": "user", "content": "Say OK"}]
  }'
```

If this works, the API key is valid.

### 4. Check server logs during enrichment

When you run enrichment, check your terminal where `npm run dev` is running. You should see:

```
[Enrichment 1/25] Processing: Artist Name
- Social links: Yes/No
- Instagram: @handle or None
- Website: url or None
- Biography: Yes/No
- Result: { email_found: 'None', confidence: 0, source: 'None', steps_completed: 4 }
  Step 1 (YouTube Email Extraction): failed - 0 emails
  Step 2 (Social Media Email Scan): failed - 0 emails
  Step 3 (Instagram Contact Info): failed - 0 emails
  Step 4 (Instagram Deep Search): failed - 0 emails
```

---

## Recommended Fixes

### Fix #1: Make AI Calls More Aggressive

**Problem:** AI is only called as a last resort after regex fails.

**Solution:** Modify the pipeline to **always** call AI if the key is present, even if regex finds nothing.

### Fix #2: Add Better Logging

**Problem:** Silent failures make debugging impossible.

**Solution:** Add console.error for every failed AI call with the actual error message.

### Fix #3: Verify Data Quality First

**Problem:** Enrichment can't work without source data.

**Solution:** Before enriching, check if artists have:
- Social links populated
- Instagram handles
- Websites
- Biographies

### Fix #4: Test with Known Good Data

**Problem:** Can't verify if enrichment works without test data.

**Solution:** Create a test artist with known data:
```json
{
  "name": "Test Artist",
  "social_links": {
    "youtube": "https://youtube.com/@testartist"
  },
  "instagram_handle": "testartist",
  "website": "https://testartist.com",
  "biography": "Contact: booking@testartist.com"
}
```

Run enrichment on this test artist and verify:
1. Anthropic API is called (check API usage)
2. Email is extracted from biography
3. Log is saved to enrichment_logs table

---

## Immediate Action Items

1. **Run the SQL migration** for enrichment_logs table
2. **Check artist data quality** - do they have social_links, Instagram, websites?
3. **Test the Anthropic API key** directly with curl
4. **Run enrichment on 1-2 artists** and watch the server console logs
5. **Check Supabase logs** for any database errors

---

## Expected Behavior

When enrichment is working correctly:

1. **Console logs** should show each step being processed
2. **Anthropic API usage** should increase (check your Anthropic dashboard)
3. **Enrichment logs** should appear in the database and UI
4. **Artist records** should be updated with `email`, `is_contactable`, `last_enriched_at`

---

## Next Steps

I recommend we:

1. **First:** Verify the enrichment_logs table exists
2. **Second:** Check 5-10 sample artists to see their data quality
3. **Third:** Run enrichment on 1 artist with good data and watch logs
4. **Fourth:** Based on results, modify the pipeline to be more aggressive with AI calls

Would you like me to:
- Create a modified version of the pipeline that always calls AI?
- Add better error logging and diagnostics?
- Create a test script to verify the setup?
