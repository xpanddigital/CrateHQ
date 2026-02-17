# Instantly.ai Integration Guide

## Overview

The Instantly.ai integration allows you to push contactable artists to email outreach campaigns directly from CrateHQ. This integration includes campaign management, lead pushing with auto-batching, analytics tracking, and outreach history logging.

## Features

### 1. **Instantly API Client** (`src/lib/instantly/client.ts`)
- ✅ Campaign listing
- ✅ Campaign creation
- ✅ Lead pushing with auto-batching (500 leads per request)
- ✅ Campaign analytics (emails sent, opens, replies, bounces)
- ✅ Connection testing
- ✅ Artist-to-lead transformation helper

### 2. **Settings Page** (`/settings`)
- ✅ API key input field
- ✅ "Save & Test Connection" button
- ✅ Success/failure status display
- ✅ Secure storage in `integrations` table (service = 'instantly')

### 3. **Outreach Page** (`/outreach`)

#### Step 1: Select Artists
- Filter artists by tags (multi-select)
- Only shows contactable artists (`is_contactable = true`)
- Displays count of matching artists
- Preview table showing:
  - Artist name
  - Email address
  - Monthly streams
  - Estimated value range

#### Step 2: Select Campaign
- Dropdown of existing Instantly campaigns
- "Create New Campaign" button
- Real-time campaign list from Instantly API

#### Step 3: Push Leads
- "Push X Leads to Instantly" button
- Progress indicator during push
- Results display:
  - X leads added
  - Y leads skipped (duplicates)
  - Z deals created

#### Campaign Analytics
- Real-time stats from Instantly API:
  - Total leads
  - Emails sent
  - Opens
  - Replies
  - Reply rate percentage

#### Outreach History
- Complete log of all lead pushes
- Shows:
  - Date and time
  - Campaign name
  - Number of leads pushed
  - Leads added vs skipped
  - Deals created
  - Scout who pushed the leads

## Setup Instructions

### 1. Database Setup

Run the SQL migration to create the `outreach_logs` table:

```bash
# In your Supabase SQL Editor, run:
cat supabase-outreach-logs.sql
```

This creates:
- `outreach_logs` table for tracking push history
- Indexes for performance
- Row Level Security policies

### 2. Get Your Instantly API Key

1. Log in to [Instantly.ai](https://app.instantly.ai)
2. Go to **Settings** → **API & Webhooks**
3. Copy your API key

### 3. Configure in CrateHQ

1. Navigate to **Settings** (`/settings`)
2. Scroll to **Instantly.ai Integration**
3. Paste your API key
4. Click **Test** to verify connection
5. If successful, the key is automatically saved

### 4. Start Using Outreach

1. Navigate to **Outreach** (`/outreach`)
2. Select tags to filter contactable artists
3. Choose or create a campaign
4. Push leads to Instantly

## API Routes

### Campaign Management
- `GET /api/outreach/campaigns` - List all campaigns
- `POST /api/outreach/campaigns` - Create new campaign

### Lead Management
- `POST /api/outreach/push-leads` - Push artists to campaign
  - Auto-creates deals in CrateHQ
  - Logs outreach activity
  - Returns push results

### Analytics
- `GET /api/outreach/campaigns/[id]/analytics` - Get campaign stats

### History
- `GET /api/outreach/history` - Fetch outreach logs

### Integration Testing
- `POST /api/integrations/test-instantly` - Test API connection

## Data Flow

```
1. User selects artists by tags
   ↓
2. Filter contactable artists (has email)
   ↓
3. User selects/creates Instantly campaign
   ↓
4. Click "Push Leads"
   ↓
5. Transform artists to Instantly lead format
   ↓
6. Push to Instantly API (batched, 500/request)
   ↓
7. Create deals in CrateHQ (stage: outreach_queued)
   ↓
8. Log outreach activity to outreach_logs
   ↓
9. Display results to user
```

## Artist-to-Lead Transformation

The `artistToInstantlyLead()` helper transforms CrateHQ artists into Instantly leads:

```typescript
{
  email: "artist@example.com",
  first_name: "John",
  last_name: "Doe",
  company_name: "John Doe",
  variables: {
    artist_name: "John Doe",
    monthly_streams: "1,234,567",
    track_count: "42",
    genres: "Pop, Rock",
    estimated_value_low: "$15K",
    estimated_value_high: "$25K",
    sender_name: "Your Name",
    booking_link: "https://calendly.com/..."
  }
}
```

These variables can be used in your Instantly email templates with:
- `{{custom_artist_name}}`
- `{{custom_monthly_streams}}`
- `{{custom_track_count}}`
- `{{custom_genres}}`
- `{{custom_estimated_value_low}}`
- `{{custom_estimated_value_high}}`
- `{{custom_sender_name}}`
- `{{custom_booking_link}}`

## Deal Creation

When leads are pushed, CrateHQ automatically creates deals with:
- **Stage**: `outreach_queued`
- **Scout**: Current user
- **Campaign ID**: Instantly campaign ID
- **Estimated Value**: Artist's estimated offer

This allows you to track the entire pipeline from outreach to closed deal.

## Rate Limiting

The client automatically handles rate limiting:
- Batches leads in groups of 500
- Waits 500ms between batches
- Prevents API throttling

## Error Handling

The integration gracefully handles:
- Invalid API keys (test connection fails)
- Network errors (retries automatically)
- Duplicate leads (skipped by Instantly)
- Missing data (validation before push)

## Troubleshooting

### "Instantly not configured" error
- Go to Settings and add your API key
- Click "Test" to verify it works

### No campaigns showing
- Create a campaign in Instantly.ai first
- Or use the "Create New Campaign" button in CrateHQ

### Leads not being added
- Verify artists have valid email addresses
- Check if leads already exist in Instantly workspace (they'll be skipped)
- Ensure campaign is active in Instantly

### Analytics not loading
- Campaign must have sent emails for analytics to appear
- Analytics may take a few minutes to update in Instantly

## Best Practices

1. **Tag Your Artists**: Use tags to organize artists by genre, tier, or campaign type
2. **Check Contactability**: Only contactable artists (with emails) will appear
3. **Review Before Pushing**: Use the preview table to verify artist data
4. **Monitor Analytics**: Track campaign performance in real-time
5. **Review History**: Use outreach logs to avoid duplicate pushes

## Security

- API keys are stored encrypted in Supabase
- Row Level Security ensures users only see their own data
- API keys are never exposed to the frontend
- All API calls are server-side only

## Support

For Instantly.ai API documentation, visit:
https://developer.instantly.ai/

For CrateHQ support, contact your admin.
