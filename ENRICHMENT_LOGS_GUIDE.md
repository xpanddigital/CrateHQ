# Enrichment Logs Guide

## Overview

The enrichment logging system provides detailed, step-by-step visibility into every email enrichment run. You can now see exactly what happened for each artist, which steps succeeded or failed, and why.

## Features

### 1. **In-Modal Detailed Logs**

When you run bulk enrichment from the Artists page:

1. Select artists and click "Enrich Selected"
2. After enrichment completes, click **"View Detailed Logs"**
3. See expandable cards for each artist showing:
   - ✅ Email found (or ❌ no email)
   - Confidence score
   - All emails discovered
   - Step-by-step breakdown of each enrichment method

### 2. **Dedicated Enrichment Logs Page**

Navigate to **Enrichment Logs** in the sidebar to view:

- **Stats Dashboard:**
  - Total enrichment runs
  - Success count (emails found)
  - Failed count (no email)
  - Overall success rate

- **Filters:**
  - Search by artist name
  - Filter by status: All / Success / Failed

- **Historical Logs:**
  - View all past enrichment runs
  - Click any artist to expand and see full details
  - See who ran the enrichment and when

### 3. **What Each Log Shows**

For every artist enriched, you'll see:

#### Summary
- Artist name
- Email found (if any)
- Confidence score (0-100%)
- Source of email (which method found it)
- Total processing time

#### All Emails Found
- Every email discovered across all methods
- Source of each email
- Individual confidence scores

#### Step-by-Step Results
Each enrichment method is logged with:

- **Status:** Success ✅ / Failed ❌ / Skipped ⏭️
- **Duration:** How long the step took
- **Emails Found:** List of emails from this step
- **Error Details:** If failed, why it failed

#### Enrichment Steps Tracked:

1. **Social Link Extraction**
   - Scans Instagram, Twitter, TikTok, YouTube for email patterns
   - Shows which platforms were checked

2. **Instagram Bio Scrape**
   - Checks Instagram bio for email
   - Shows if Instagram handle was available

3. **Website Scrape**
   - Scans artist website for contact emails
   - Shows if website was available

4. **AI Social Analysis**
   - Uses Claude AI to analyze social media posts
   - Shows if sufficient social data was available

5. **Hunter.io Lookup**
   - Domain-based email finder
   - Shows if API key was configured

6. **Apollo.io Lookup**
   - Professional email finder
   - Shows if API key was configured

## Understanding Results

### Why No Email Was Found

The logs will show you exactly why:

- **"Skipped (email already found)"** - A previous step already found an email
- **"No social links available"** - Artist missing Instagram/Twitter/etc
- **"No Instagram handle"** - Can't scrape Instagram bio
- **"No website URL"** - Can't scrape website
- **"Insufficient social data"** - Not enough posts for AI analysis
- **"API key not configured"** - Hunter/Apollo not set up
- **"No emails found in this step"** - Method ran but found nothing

### Success Indicators

- **High Confidence (80-100%)** - Email found from official source (website, verified social)
- **Medium Confidence (50-79%)** - Email found from social media analysis
- **Low Confidence (0-49%)** - Email found but source is uncertain

## Access Control

- **Scouts:** See only their own enrichment logs
- **Admins:** See all enrichment logs from all scouts

## Database Storage

All enrichment logs are stored in the `enrichment_logs` table:

```sql
-- Run this in Supabase SQL Editor
-- See: supabase-enrichment-logs.sql
```

This allows you to:
- Track enrichment history over time
- Analyze success rates
- Identify which methods work best
- Debug issues with specific artists

## Troubleshooting

### No Logs Appearing

1. **Check Database:** Ensure `enrichment_logs` table exists
   ```bash
   # Run the SQL migration
   supabase-enrichment-logs.sql
   ```

2. **Check Console:** Server logs still print to console for debugging

3. **Refresh Page:** Click the "Refresh" button on the logs page

### Low Success Rate

If you're seeing many failures, check the step-by-step logs to identify:

1. **Missing Social Data:** Most artists lack Instagram/Twitter?
   - Solution: Run social scraping first

2. **No Websites:** Artists missing website URLs?
   - Solution: Add websites manually or via CSV import

3. **API Keys Missing:** Hunter/Apollo steps always failing?
   - Solution: Add API keys in Settings → Integrations

4. **AI Analysis Failing:** Anthropic API errors?
   - Solution: Check `ANTHROPIC_API_KEY` in `.env.local`

## Best Practices

1. **Review Logs After Each Run**
   - Check the detailed logs to understand results
   - Identify patterns in failures

2. **Enrich in Batches**
   - Start with 10-20 artists to test
   - Review logs before running larger batches

3. **Fix Data Issues First**
   - If logs show "missing social data", scrape social profiles first
   - If logs show "no website", add websites before enriching

4. **Monitor Success Rate**
   - Track your success rate over time
   - Aim for 30-50% success rate (industry standard)

5. **Use Filters**
   - Filter by "Failed" to see which artists need better data
   - Filter by "Success" to verify email quality

## Example Log Interpretation

### Example 1: Success

```
Artist: Khalid
✅ Email found: khalid@example.com
Confidence: 85%
Source: website_scrape

Steps:
1. Social Link Extraction - Success (1.2s)
   Found: khalid.music@gmail.com (confidence: 60%)
   
2. Instagram Bio Scrape - Skipped
   (Email already found)
   
3. Website Scrape - Success (2.1s)
   Found: khalid@example.com (confidence: 85%)
   
4. AI Social Analysis - Skipped
   (Email already found)
```

**Interpretation:** Website scrape found a high-confidence email, so remaining steps were skipped.

### Example 2: Failure

```
Artist: Unknown Artist
❌ No email found

Steps:
1. Social Link Extraction - Failed (0.5s)
   Error: No social links available
   
2. Instagram Bio Scrape - Failed (0.3s)
   Error: No Instagram handle
   
3. Website Scrape - Failed (0.2s)
   Error: No website URL
   
4. AI Social Analysis - Failed (0.1s)
   Error: Insufficient social data
   
5. Hunter.io Lookup - Skipped
   Error: API key not configured
```

**Interpretation:** Artist lacks all necessary data (social links, Instagram, website). Need to scrape social profiles first.

## Next Steps

1. **Run Enrichment:** Select artists and enrich them
2. **View Logs:** Check the detailed logs in the modal
3. **Review History:** Visit Enrichment Logs page to see all runs
4. **Optimize:** Use insights to improve data quality and success rate

---

**Need Help?**
- Check the console for technical errors
- Review the diagnostic endpoint: `/api/enrichment/diagnose`
- See `ENRICHMENT_DEBUGGING.md` for troubleshooting
