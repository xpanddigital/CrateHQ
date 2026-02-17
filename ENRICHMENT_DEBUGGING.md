# Enrichment Debugging Guide

## Issue: No Emails Found

If enrichment runs but finds no emails (0/25 success rate), here's how to debug:

---

## 🔍 Where to Find Logs

### 1. **Server Logs (Terminal)**

The enrichment API logs to the console. Check your terminal where Next.js is running:

```bash
# Look for these log patterns:
Error bulk enriching artists: [error details]
```

**To see logs in development:**
```bash
npm run dev
# Watch the terminal output during enrichment
```

### 2. **Browser Console**

Open browser DevTools (F12) → Console tab:
- Look for network requests to `/api/artists/bulk-enrich`
- Check the response body for detailed results

### 3. **API Response Details**

The bulk-enrich API returns detailed results:

```json
{
  "success": true,
  "total": 25,
  "enriched": 25,
  "found_emails": 0,
  "results": [
    {
      "artist_id": "uuid",
      "artist_name": "Artist Name",
      "success": false,
      "email": null
    }
  ],
  "errors": []
}
```

---

## 🐛 Common Reasons for No Emails Found

### 1. **Missing Anthropic API Key**

The enrichment pipeline requires Claude AI to find emails.

**Check:**
```bash
# In your .env.local file
ANTHROPIC_API_KEY=sk-ant-...
```

**If missing:**
1. Get API key from https://console.anthropic.com/
2. Add to `.env.local`
3. Restart Next.js server

### 2. **Artists Missing Required Data**

The pipeline needs certain fields to find emails:

**Required Fields:**
- `social_links` (YouTube, website, etc.)
- `instagram_handle`
- `website`
- `biography`

**Check your artists:**
```sql
-- In Supabase SQL Editor
SELECT 
  name,
  social_links,
  instagram_handle,
  website,
  biography
FROM artists
LIMIT 10;
```

**If fields are empty:**
- Artists need to be scraped/enriched with social data first
- Use the scraping feature to get YouTube, Instagram, etc.

### 3. **Rate Limiting**

Claude API has rate limits. If you're hitting them:

**Symptoms:**
- Errors in console about rate limits
- Enrichment stops partway through

**Solution:**
- Increase delay between requests (currently 1 second)
- Process fewer artists at once
- Check your Anthropic API usage dashboard

### 4. **Invalid Social Links Data**

If `social_links` is malformed or empty:

**Check:**
```sql
SELECT name, social_links FROM artists WHERE social_links IS NULL OR social_links = '{}';
```

**Fix:**
- Re-scrape artists to populate social links
- Manually add social links if known

---

## 🔧 How to Debug Step-by-Step

### Step 1: Check API Key

```bash
# In terminal
echo $ANTHROPIC_API_KEY
# Should show: sk-ant-...

# Or check .env.local file
cat .env.local | grep ANTHROPIC
```

### Step 2: Test with One Artist

Instead of bulk enriching, test with a single artist:

1. **Check artist data:**
```sql
SELECT * FROM artists WHERE name = 'Artist Name' LIMIT 1;
```

2. **Look for:**
   - Does `social_links` have data?
   - Is there an `instagram_handle`?
   - Is there a `website`?
   - Is there a `biography`?

3. **If all fields are empty:**
   - The enrichment has nothing to work with
   - You need to scrape/populate these fields first

### Step 3: Check Console Logs

Add detailed logging to the enrichment:

**Edit `src/app/api/artists/bulk-enrich/route.ts`:**

```typescript
// After line 43 (inside the loop)
console.log(`Enriching artist ${i + 1}/${artists.length}: ${artist.name}`)
console.log('Social links:', artist.social_links)
console.log('Instagram:', artist.instagram_handle)
console.log('Website:', artist.website)

const result = await enrichArtist(artist, apiKeys)

console.log('Result:', {
  email_found: result.email_found,
  confidence: result.email_confidence,
  source: result.email_source,
  steps: result.steps.map(s => ({
    method: s.method,
    status: s.status,
    emails_found: s.emails_found.length,
  }))
})
```

### Step 4: Check Network Tab

1. Open DevTools (F12)
2. Go to Network tab
3. Filter by "bulk-enrich"
4. Click the request
5. View Response tab
6. Look at the `results` array

**Example:**
```json
{
  "results": [
    {
      "artist_id": "123",
      "artist_name": "John Doe",
      "success": false,
      "email": null
    }
  ]
}
```

---

## 🎯 Quick Fixes

### Fix 1: Add Anthropic API Key

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

**Restart server:**
```bash
# Stop (Ctrl+C) and restart
npm run dev
```

### Fix 2: Populate Artist Data First

Before enrichment, artists need social data:

1. **Use Scraping Feature:**
   - Go to `/scraping` (admin only)
   - Discover artists from Spotify
   - This populates social links

2. **Or Import with Data:**
   - When importing CSV, include social links
   - Format: `{"youtube": "url", "instagram": "handle"}`

### Fix 3: Test API Key

Create a test endpoint to verify Claude is working:

**Create `src/app/api/test-claude/route.ts`:**
```typescript
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function GET() {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    
    if (!apiKey) {
      return NextResponse.json({ error: 'No API key found' })
    }

    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: 'Reply with just "OK" if you can read this.'
      }]
    })

    return NextResponse.json({ 
      success: true,
      response: response.content[0].type === 'text' ? response.content[0].text : ''
    })
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message,
      details: error.toString()
    })
  }
}
```

**Test it:**
```
Visit: http://localhost:3000/api/test-claude
```

---

## 📊 Expected Results

With proper setup, you should see:

**Good Enrichment:**
```json
{
  "total": 25,
  "enriched": 25,
  "found_emails": 18,  // ~72% hit rate
  "results": [
    {
      "artist_name": "John Doe",
      "success": true,
      "email": "john@example.com"
    }
  ]
}
```

**No Data to Work With:**
```json
{
  "total": 25,
  "enriched": 25,
  "found_emails": 0,
  "results": [
    {
      "artist_name": "John Doe",
      "success": false,
      "email": null
    }
  ]
}
```

---

## 🔍 Detailed Step Logging

To see what each enrichment step is doing, add this to the pipeline:

**Edit `src/lib/enrichment/pipeline.ts`:**

```typescript
// After line 142 (inside the step loop)
console.log(`[${artist.name}] Step ${i + 1}: ${step.label}`)

// After line 164 (after extracting emails)
console.log(`[${artist.name}] Found ${step.emails_found.length} emails:`, step.emails_found)
console.log(`[${artist.name}] Confidence: ${step.confidence}`)

// After line 191 (if failed)
if (step.status === 'failed') {
  console.log(`[${artist.name}] Step failed:`, step.error || 'No emails found')
}
```

---

## 🎯 Most Likely Issue

**If you got "25 enriched, 0 emails found":**

The most likely cause is **missing Anthropic API key** or **artists have no social data**.

**Quick Check:**
```bash
# 1. Check API key exists
cat .env.local | grep ANTHROPIC_API_KEY

# 2. Check if artists have data
# Go to Supabase SQL Editor and run:
SELECT 
  name,
  CASE 
    WHEN social_links IS NULL OR social_links = '{}' THEN 'NO DATA'
    ELSE 'HAS DATA'
  END as has_social_links,
  instagram_handle,
  website
FROM artists
LIMIT 10;
```

**If "NO DATA" for most artists:**
- You need to scrape/populate social links first
- The enrichment pipeline needs this data to find emails

---

## 📝 Next Steps

1. **Check API key** in `.env.local`
2. **Check artist data** in Supabase
3. **Add console logs** to see what's happening
4. **Test with one artist** that has good social data
5. **Check browser DevTools** Network tab for API response

If still no emails found after checking these, the artists likely don't have publicly available contact info, which is expected for some artists.

---

## 💡 Pro Tips

1. **Best Results:**
   - Artists with YouTube channels (45% hit rate)
   - Artists with websites (high hit rate)
   - Artists with Instagram business accounts

2. **Poor Results:**
   - Artists with only Spotify links
   - Artists with no social media presence
   - Very new/unknown artists

3. **Improve Hit Rate:**
   - Scrape artists thoroughly first
   - Focus on artists with 10K+ followers
   - Target artists with websites listed

---

## 🆘 Still Stuck?

If you've checked everything and still no emails:

1. **Share the logs:**
   - Terminal output
   - Browser console errors
   - API response from Network tab

2. **Share artist data:**
   - Example artist that failed
   - Their social_links content
   - Their other fields

3. **Check Anthropic Dashboard:**
   - Visit https://console.anthropic.com/
   - Check API usage
   - Look for error logs

The enrichment should work if:
- ✅ Anthropic API key is set
- ✅ Artists have social data (YouTube, Instagram, website)
- ✅ API key has credits/quota remaining
