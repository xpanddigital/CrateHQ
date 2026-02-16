# Email Enrichment Guide

## Overview

The enrichment pipeline automatically finds contact emails for artists using a 4-step waterfall approach that stops as soon as an email is found to minimize API costs.

## How It Works

### Pipeline Steps

1. **Parse Existing Data** (Free, Always Runs)
   - Searches social_links JSON for email patterns
   - Checks biography text
   - Checks website field
   - Filters out junk domains
   - Confidence: 60%

2. **Hunter.io Domain Search** (Paid, Conditional)
   - Requires: Artist has a website
   - Extracts domain from website URL
   - Searches Hunter.io database
   - Prioritizes management/booking emails
   - Confidence: 80%

3. **Apollo.io Person Match** (Paid, Conditional)
   - Searches by artist name + domain
   - Returns verified business email
   - Confidence: 75%

4. **Claude Haiku AI Analysis** (Paid, Last Resort)
   - Analyzes all available data
   - Suggests likely email patterns
   - Identifies management companies
   - Confidence: 30%

### Early Stopping

The pipeline stops as soon as ANY step finds an email. This means:
- If email is in bio → Only step 1 runs (free!)
- If found by Hunter → Steps 1-2 run (cheaper)
- If AI needed → All 4 steps run (most expensive)

## Features

### Single Artist Enrichment

**Location**: Artist detail page → Right sidebar → "Enrich" button

**What Happens**:
1. Click "Enrich" button
2. Pipeline runs through steps
3. Real-time progress display shows:
   - Which step is running
   - Which steps succeeded/failed
   - Which steps were skipped (email already found)
4. Results displayed with:
   - Email found
   - Source method
   - Confidence score
5. Artist record automatically updated

**UI Components**:
- Step-by-step progress indicators
- Green checkmarks for success
- Red X for failures
- Gray clock for skipped steps
- Success card showing email + metadata

### Batch Enrichment

**Location**: Artists table → Select artists → "Enrich (X)" button

**What Happens**:
1. Select artists with checkboxes
2. Click "Enrich (X)" button
3. Modal opens with summary
4. Click "Start Enrichment"
5. Progress bar shows current/total
6. 2-second delay between each artist (rate limiting)
7. Summary shows:
   - Total processed
   - Emails found
   - Any errors
8. Auto-closes after 3 seconds
9. Table refreshes with updated data

**Rate Limiting**:
- 2-second delay between artists
- Prevents API rate limit errors
- Estimated time shown upfront

## API Routes

### POST /api/artists/[id]/enrich

Enriches a single artist.

**Request**: No body required

**Response**:
```json
{
  "artist_id": "uuid",
  "artist_name": "Drake",
  "email_found": "drake@example.com",
  "email_confidence": 0.8,
  "email_source": "hunter",
  "all_emails": [
    {
      "email": "drake@example.com",
      "source": "hunter",
      "confidence": 0.8
    }
  ],
  "methods_tried": ["parse_existing", "hunter"],
  "is_contactable": true
}
```

**Database Updates**:
- `email` - Best email found
- `email_confidence` - Confidence score
- `email_source` - Method that found it
- `all_emails_found` - All emails discovered
- `is_enriched` - true
- `is_contactable` - true if email found
- `last_enriched_at` - Current timestamp
- `enrichment_attempts` - Incremented by 1

### POST /api/artists/bulk-enrich

Enriches multiple artists with rate limiting.

**Request**:
```json
{
  "artistIds": ["uuid1", "uuid2", "uuid3"]
}
```

**Response**:
```json
{
  "success": true,
  "total": 3,
  "enriched": 3,
  "found_emails": 2,
  "results": [
    {
      "artist_id": "uuid1",
      "artist_name": "Drake",
      "success": true,
      "email": "drake@example.com"
    }
  ],
  "errors": []
}
```

## Environment Variables

The enrichment pipeline uses these optional API keys:

```env
# Optional - Pipeline gracefully skips if not configured
HUNTER_API_KEY=your_hunter_io_key
APOLLO_API_KEY=your_apollo_io_key
ANTHROPIC_API_KEY=your_anthropic_key  # Required for AI search
```

### Without API Keys

If no API keys are configured:
- Step 1 (parse existing) still runs
- Steps 2-4 are skipped
- Still useful for finding emails in bios/social links

### With Partial Keys

You can configure only some keys:
- Just Hunter → Steps 1-2 run
- Just Apollo → Steps 1, 3 run
- Just Anthropic → Steps 1, 4 run

## Cost Optimization

### API Costs (Approximate)

- **Hunter.io**: $0.01 per search (50 searches/month free)
- **Apollo.io**: $0.02 per match (varies by plan)
- **Claude Haiku**: $0.0001 per request (~400 tokens)

### Strategies to Minimize Cost

1. **Add Website URLs First**
   - Hunter.io requires a domain
   - Most cost-effective method
   - High confidence results

2. **Enrich in Batches**
   - Use bulk enrichment for efficiency
   - 2-second delay prevents rate limits
   - Process overnight for large batches

3. **Use Existing Data**
   - Add Instagram bios to social_links
   - Paste website content into biography
   - Free email extraction

4. **Skip Re-enrichment**
   - Check `is_enriched` flag
   - Only re-enrich if data changed
   - Track `enrichment_attempts`

## Best Practices

### Before Enrichment

1. **Add Social Links**
   - Instagram handle
   - Website URL
   - Any other social profiles

2. **Add Biography**
   - Paste from Spotify
   - Include any contact info

3. **Verify Website**
   - Make sure URL is correct
   - Hunter.io needs valid domain

### After Enrichment

1. **Review Confidence**
   - 80%+ → Very reliable
   - 60-79% → Likely correct
   - <60% → Verify before outreach

2. **Check All Emails**
   - View `all_emails_found` array
   - Multiple emails = more options
   - Management emails preferred

3. **Manual Verification**
   - For low confidence (<60%)
   - Check artist's social media
   - Google the email address

## Troubleshooting

### No Email Found

**Possible Reasons**:
- Artist has no website
- Website doesn't list emails
- Not in Hunter/Apollo databases
- Social links incomplete

**Solutions**:
- Add more social links
- Add biography with contact info
- Try manual Google search
- Check Instagram bio

### Low Confidence

**Why It Happens**:
- AI-generated suggestion
- Email from social link (not verified)
- Partial match in Apollo

**What to Do**:
- Verify email manually
- Try alternative emails in `all_emails_found`
- Re-enrich after adding more data

### API Errors

**Hunter.io Errors**:
- Rate limit: Wait and retry
- Invalid domain: Check website URL
- No credits: Upgrade plan

**Apollo.io Errors**:
- Authentication: Check API key
- No match: Artist not in database
- Rate limit: Use batch with delays

**Anthropic Errors**:
- Invalid API key: Check .env.local
- Rate limit: Rare, but wait if occurs
- Parsing error: Check response format

## Success Metrics

After enrichment, track:
- **Contactable Rate**: % of artists with emails
- **Confidence Distribution**: How many high vs low confidence
- **Method Effectiveness**: Which methods find most emails
- **Cost per Email**: Total API costs / emails found

## Database Schema

### Fields Updated by Enrichment

```sql
-- Primary email
email TEXT

-- Metadata
email_confidence NUMERIC(3,2)  -- 0.00 to 1.00
email_source TEXT               -- 'hunter', 'apollo', etc.

-- All emails found (JSONB array)
all_emails_found JSONB DEFAULT '[]'
-- Example: [{"email": "...", "source": "...", "confidence": 0.8}]

-- Status flags
is_enriched BOOLEAN DEFAULT false
is_contactable BOOLEAN DEFAULT false

-- Tracking
last_enriched_at TIMESTAMPTZ
enrichment_attempts INTEGER DEFAULT 0
```

## Example Workflow

### Scenario 1: High-Value Artist

1. Add artist manually with website
2. Click "Enrich" on detail page
3. Hunter.io finds management email
4. Confidence: 80%
5. Ready for outreach immediately

### Scenario 2: Batch Import

1. Import 100 artists from CSV
2. Select all artists
3. Click "Enrich (100)"
4. Wait ~3-4 minutes
5. 65 emails found
6. Filter by `is_contactable = true`
7. Push to Instantly campaign

### Scenario 3: Manual Research

1. Artist has no website
2. Enrichment finds nothing
3. Manually add Instagram bio to `biography` field
4. Re-run enrichment
5. Email extracted from bio text
6. Confidence: 60%

## Integration with Other Features

### With Outreach
- Filter artists by `is_contactable = true`
- Only contactable artists can be pushed to Instantly
- Confidence score helps prioritize outreach

### With Pipeline
- Create deals only for contactable artists
- Track enrichment status in deal notes
- Re-enrich if email bounces

### With Analytics
- Track enrichment success rate
- Monitor API costs
- Identify best sources

## Tips & Tricks

1. **Batch Overnight**: Run large enrichments overnight to avoid rate limits

2. **Verify High-Value**: Manually verify emails for artists with >$50K estimated offers

3. **Re-enrich Periodically**: Artists change management, re-enrich every 6 months

4. **Use AI Sparingly**: AI search is least accurate, only use when others fail

5. **Check All Emails**: Sometimes the 2nd or 3rd email is better than the first

---

**The enrichment system is fully functional and ready to use!** 🎯
