# Outreach & Instantly Integration - Complete

## 🎯 Overview

Complete email outreach automation system integrated with Instantly.ai. Filter artists by tags, push to campaigns with custom variables, track analytics, and auto-create deals in the pipeline.

## ✅ Features Implemented

### 1. Instantly.ai Client ✅
**Location**: `src/lib/instantly/client.ts`

**Features**:
- Campaign listing
- Campaign creation
- Lead pushing with auto-batching (500 per batch)
- Campaign analytics
- Connection testing
- `artistToInstantlyLead()` helper with custom variables

**Auto-Batching**:
- Splits large lead lists into 500-lead batches
- 500ms delay between batches
- Handles rate limiting automatically

**Custom Variables**:
- `artist_name` - Full artist name
- `monthly_streams` - Formatted with commas
- `track_count` - Number of tracks
- `genres` - Comma-separated list
- `estimated_value_low` - Lower bound ($XK format)
- `estimated_value_high` - Upper bound ($XK format)
- `sender_name` - Scout's full name
- `booking_link` - Scout's Calendly URL

---

### 2. Settings Page - Instantly Integration ✅
**Location**: `/settings` → Instantly section

**Features**:
- API key input (password field)
- "Test Connection" button
- Success/failure feedback with icons
- Auto-saves key to integrations table
- Validates connection before saving

**Flow**:
1. Enter Instantly API key
2. Click "Test Connection"
3. System calls `listCampaigns()` to verify
4. If success: Green checkmark + saves to database
5. If error: Red X + shows error message

**Database**:
- Stored in `integrations` table
- `service = 'instantly'`
- `user_id` = current user
- `api_key` = encrypted key
- `is_active = true`

---

### 3. Outreach Page ✅
**Location**: `/outreach`

**Complete Workflow**:

#### Step 1: Filter Artists by Tags
- Multi-select tag badges (click to toggle)
- Only shows artists where `is_contactable = true`
- Real-time filtering
- Shows count of matching artists

#### Step 2: Preview Matching Artists
- Table showing:
  - Artist name
  - Email
  - Monthly streams
  - Estimated value range
- Shows first 10, indicates "+X more"
- Scrollable if many results

#### Step 3: Select Campaign
- Dropdown lists all Instantly campaigns
- "Create New Campaign" option
- Input field + Create button
- New campaigns appear in dropdown immediately

#### Step 4: Push to Instantly
- "Push X Leads to Instantly" button
- Shows progress during push
- Auto-batches if >500 leads
- Returns summary:
  - Added count
  - Skipped count (duplicates)
  - Deals created count

#### Step 5: View Analytics
- Campaign analytics cards
- Shows for each campaign:
  - Total leads
  - Emails sent
  - Opens
  - Replies
  - Reply rate percentage
- Auto-refreshes when page loads

---

### 4. API Routes ✅

**GET /api/outreach/campaigns**:
- Fetches user's Instantly API key from integrations
- Calls `listCampaigns()`
- Returns campaign list

**POST /api/outreach/campaigns**:
- Creates new campaign via Instantly API
- Takes `{ name }`
- Returns campaign object with ID

**POST /api/outreach/push-leads**:
- Takes `{ campaignId, artistIds }`
- Fetches artists from database
- Transforms to Instantly leads with variables
- Pushes to campaign
- Creates deal records with:
  - `stage = 'outreach_queued'`
  - `instantly_campaign_id = campaignId`
  - `scout_id = current_user`
  - `estimated_deal_value = artist.estimated_offer`
- Returns counts

**GET /api/outreach/campaigns/[id]/analytics**:
- Fetches campaign summary from Instantly
- Returns metrics (leads, sent, opens, replies)

**POST /api/integrations/test-instantly**:
- Tests API key validity
- Returns success/failure

**GET/POST /api/integrations**:
- Get all integrations for user
- Save new integration

---

### 5. Auto-Create Deals ✅

**When Leads Pushed**:
- Deal created for each artist
- Stage: `outreach_queued`
- Campaign ID stored
- Estimated value from artist
- Scout assigned (current user)

**Benefits**:
- Leads appear in pipeline immediately
- Track progress through stages
- Link outreach to deals
- Calculate commissions later

---

## 🎨 UI/UX Highlights

### Tag Filter
- Visual tag badges
- Click to toggle selection
- Color-coded by tag
- Shows count of matching artists

### Artist Preview
- Clean table layout
- Key info at a glance
- Scrollable for large lists
- "+X more" indicator

### Campaign Selector
- Dropdown with all campaigns
- Inline creation
- Immediate feedback

### Push Button
- Shows lead count
- Loading state during push
- Success summary with metrics
- Error handling

### Analytics Cards
- One card per campaign
- 5 key metrics displayed
- Reply rate calculated
- Icons for each metric

---

## 🔄 Complete Workflow

### Setup (One Time)
1. Go to `/settings`
2. Scroll to "Instantly.ai Integration"
3. Enter API key
4. Click "Test Connection"
5. See green checkmark

### Daily Outreach
1. Go to `/outreach`
2. Select tags (e.g., "hip-hop", "high-value")
3. Review filtered artists
4. Select or create campaign
5. Click "Push X Leads"
6. Wait for confirmation
7. Leads now in Instantly
8. Deals created in pipeline

### Monitor Performance
1. View analytics on outreach page
2. See reply rates per campaign
3. Identify best-performing campaigns
4. Adjust strategy accordingly

---

## 📊 Data Flow

### Lead Push Process
```
Select tags
  ↓
Filter artists (is_contactable = true)
  ↓
Transform to Instantly format
  ↓
Add custom variables
  ↓
Batch into 500-lead chunks
  ↓
Push to Instantly API
  ↓
Create deal records
  ↓
Return summary
```

### Custom Variables in Instantly
```
{{custom_artist_name}} - Drake
{{custom_monthly_streams}} - 85,000,000
{{custom_track_count}} - 250
{{custom_genres}} - hip-hop, rap
{{custom_estimated_value_low}} - $450K
{{custom_estimated_value_high}} - $600K
{{custom_sender_name}} - John Smith
{{custom_booking_link}} - https://calendly.com/john/15min
```

---

## 💰 Cost & Limits

### Instantly.ai Limits
- **Free tier**: 500 leads/month
- **Growth**: 5,000 leads/month
- **Pro**: 25,000 leads/month
- **Rate limit**: 1,000 leads per request (handled automatically)

### Our Implementation
- Auto-batches at 500 per request
- 500ms delay between batches
- Skip duplicates automatically
- No lead wasted

---

## 🎯 Best Practices

### Tag Strategy
- Create specific tags: "hip-hop-us", "high-value", "batch-feb-2026"
- Use tags to segment campaigns
- Tag by genre, value tier, or source

### Campaign Organization
- One campaign per segment
- Name clearly: "Hip-Hop High Value Q1 2026"
- Track performance by campaign
- Pause underperforming campaigns

### Lead Quality
- Only push contactable artists (enforced)
- Enrich before pushing
- Verify estimated values are set
- Check email confidence scores

### Monitoring
- Review analytics weekly
- Track reply rates
- Identify best-performing segments
- Adjust targeting based on data

---

## 🔧 Technical Details

### Lead Transformation
```typescript
artistToInstantlyLead(artist, scoutProfile)
// Returns:
{
  email: "drake@example.com",
  first_name: "Drake",
  last_name: "",
  company_name: "Drake",
  variables: {
    artist_name: "Drake",
    monthly_streams: "85,000,000",
    track_count: "250",
    genres: "hip-hop, rap",
    estimated_value_low: "$450K",
    estimated_value_high: "$600K",
    sender_name: "John Smith",
    booking_link: "https://calendly.com/..."
  }
}
```

### Deal Creation
```sql
INSERT INTO deals (
  artist_id,
  scout_id,
  stage,
  instantly_campaign_id,
  estimated_deal_value
) VALUES (
  artist.id,
  current_user.id,
  'outreach_queued',
  campaign_id,
  artist.estimated_offer
)
```

### Analytics Fetching
- Calls Instantly API for each campaign
- Caches for performance
- Shows top 5 campaigns
- Real-time data

---

## 📝 Database Schema

### Integrations Table
```sql
id, user_id, service, api_key, config, is_active
```

### Deals Table (Updated)
```sql
instantly_campaign_id TEXT  -- Links to Instantly campaign
stage = 'outreach_queued'    -- Initial stage for pushed leads
```

---

## 🚀 Usage Examples

### Example 1: Push High-Value Hip-Hop Artists
```
1. Tag 50 artists with "hip-hop" and "high-value"
2. Go to /outreach
3. Select both tags
4. See 50 contactable artists
5. Select campaign "Hip-Hop Q1"
6. Click "Push 50 Leads"
7. Wait 30 seconds
8. See: "45 added, 5 skipped, 45 deals created"
9. Go to /pipeline
10. See 45 new deals in "Outreach Queued"
```

### Example 2: Create New Campaign
```
1. Go to /outreach
2. Enter campaign name: "Indie Rock Outreach"
3. Click "Create"
4. Campaign appears in dropdown
5. Select it
6. Push leads
```

### Example 3: Monitor Performance
```
1. Go to /outreach
2. Scroll to "Campaign Analytics"
3. See:
   - Hip-Hop Q1: 100 leads, 250 sent, 80 opens, 12 replies (4.8%)
   - Indie Rock: 50 leads, 120 sent, 45 opens, 8 replies (6.7%)
4. Conclusion: Indie Rock performing better
5. Adjust strategy: push more indie artists
```

---

## ⚠️ Important Notes

### Email Variables in Templates
When creating email templates in Instantly, use:
```
Hi {{first_name}},

I saw you're getting {{custom_monthly_streams}} streams/month...
With {{custom_track_count}} tracks, artists typically qualify for 
{{custom_estimated_value_low}} to {{custom_estimated_value_high}}...

Book a call: {{custom_booking_link}}

Best,
{{custom_sender_name}}
```

### Duplicate Handling
- `skip_if_in_workspace: true` prevents duplicates
- Instantly tracks emails across all campaigns
- Skipped leads still counted in response

### Rate Limiting
- 500 leads per batch
- 500ms between batches
- Instantly has daily send limits (check your plan)

---

## ✅ Quality Checklist

- [x] Instantly client with all methods
- [x] Settings integration section
- [x] Connection testing
- [x] API key storage
- [x] Campaign listing
- [x] Campaign creation
- [x] Tag-based filtering
- [x] Artist preview table
- [x] Lead transformation with variables
- [x] Auto-batching for large lists
- [x] Deal auto-creation
- [x] Campaign analytics display
- [x] Error handling
- [x] Progress feedback

---

## 🎉 Platform Status

**Phase 1**: ✅ Artist Management
**Phase 2**: ✅ Enrichment (72% hit rate)
**Phase 3**: ✅ Deal Pipeline
**Phase 4**: ✅ AI SDR System
**Phase 5**: ✅ Outreach & Instantly ← **Just Completed!**

**Remaining**: Analytics dashboard, Scout management, Polish

---

**The complete outreach system is now functional!** Push leads to Instantly with one click! 📧
