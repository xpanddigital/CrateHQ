# Dashboard Guide

## Overview

The Dashboard provides a comprehensive overview of your CrateHQ workspace with real-time stats, pipeline visualization, recent activity tracking, and team performance metrics.

## Features

### ✅ Stats Cards (Top Row)
- **Total Artists** - Total count in database
- **Contactable Artists** - Artists with valid emails (is_contactable = true)
- **Active Deals** - Deals not in closed_won or closed_lost stages
- **Pipeline Value** - Sum of estimated_deal_value for active deals
- **Unread Inbox** - Count of unread inbound messages

### ✅ Pipeline Funnel Chart
- Interactive bar chart showing deal distribution by stage
- Color-coded bars matching DEAL_STAGES colors
- Built with Recharts for smooth visualization
- Hover to see exact counts

### ✅ Recent Activity Feed
- Last 20 events across your workspace
- Types of activities:
  - New artists added
  - Deals created
  - Messages received
  - Messages sent
- Shows artist name, event description, scout, and time ago
- Clickable artist names link to artist detail pages

### ✅ Role-Based Views

#### For Scouts (role = 'scout')
- See only their own deals
- Their inbox count
- Their stats and activity
- No leaderboard access

#### For Admins (role = 'admin')
- See all deals across all scouts
- All inbox messages
- Full workspace stats
- **Scout Leaderboard** with:
  - Scout ranking by pipeline value
  - Deals created count
  - Deals won count
  - Total pipeline value per scout

### ✅ Quick Actions
- Jump to Artists, Pipeline, or Outreach pages
- Hover effects for better UX

---

## Accessing the Dashboard

**From Sidebar:** Click **Dashboard**

**Direct URL:** `/dashboard`

**Default Landing:** Dashboard is the first page after login

---

## Stats Cards Breakdown

### 1. Total Artists
- **Source:** Count from `artists` table
- **Calculation:** Total rows
- **Use Case:** Track database growth

### 2. Contactable Artists
- **Source:** `artists` table where `is_contactable = true`
- **Calculation:** Count with filter
- **Percentage:** Shows % of total artists
- **Use Case:** Measure outreach-ready leads

### 3. Active Deals
- **Source:** `deals` table
- **Filter:** Stage NOT IN ('closed_won', 'closed_lost')
- **Scope:** 
  - Scouts: Only their deals
  - Admins: All deals
- **Use Case:** Track current pipeline size

### 4. Pipeline Value
- **Source:** Sum of `estimated_deal_value` from active deals
- **Filter:** Only active deals (not closed)
- **Format:** Currency (e.g., $450K)
- **Scope:**
  - Scouts: Only their pipeline
  - Admins: Total workspace pipeline
- **Use Case:** Forecast potential revenue

### 5. Unread Inbox
- **Source:** `conversations` table
- **Filter:** 
  - `is_read = false`
  - `direction = 'inbound'`
- **Scope:**
  - Scouts: Only their conversations
  - Admins: All conversations
- **Use Case:** Track messages needing attention

---

## Pipeline Funnel Chart

### Data Source
- Aggregates deals by stage
- Counts deals in each stage
- Matches colors from `DEAL_STAGES` constant

### Stage Colors
Each stage has a unique color:
- **New** - Gray (#6B7280)
- **Enriched** - Purple (#8B5CF6)
- **Queued** - Blue (#3B82F6)
- **Contacted** - Dark Blue (#2563EB)
- **Replied** - Amber (#F59E0B)
- **Interested** - Orange (#D97706)
- **Call Scheduled** - Green (#10B981)
- **Call Done** - Emerald (#059669)
- **Qualified** - Dark Green (#047857)
- **Handed Off** - Indigo (#6366F1)
- **Negotiation** - Deep Indigo (#4F46E5)
- **Contract Sent** - Violet (#7C3AED)
- **Won** - Green (#22C55E)
- **Lost** - Red (#EF4444)
- **Nurture** - Slate (#64748B)

### Interactions
- **Hover:** See exact count for each stage
- **X-Axis:** Stage names (angled for readability)
- **Y-Axis:** Deal count
- **Responsive:** Adapts to screen size

### Use Cases
- Identify bottlenecks in pipeline
- See where deals are concentrated
- Track stage distribution over time

---

## Recent Activity Feed

### Activity Types

#### 1. Artist Added
- **Icon:** UserPlus
- **Description:** "was added to the database"
- **Shows:** Artist name, time ago
- **Source:** `artists` table

#### 2. Deal Created
- **Icon:** Briefcase
- **Description:** "deal created (Stage Name)"
- **Shows:** Artist name, stage, scout name, time ago
- **Source:** `deals` table

#### 3. Message Received
- **Icon:** MessageSquare
- **Description:** "replied via [channel]"
- **Shows:** Artist name, channel, scout, time ago
- **Source:** `conversations` table (direction = 'inbound')

#### 4. Message Sent
- **Icon:** Mail
- **Description:** "message sent via [channel]"
- **Shows:** Artist name, channel, scout, time ago
- **Source:** `conversations` table (direction = 'outbound')

### Time Display
- **Just now** - Less than 1 minute
- **Xm ago** - Minutes (1-59)
- **Xh ago** - Hours (1-23)
- **Xd ago** - Days (1-6)
- **Date** - 7+ days ago

### Sorting
- Activities sorted by timestamp (newest first)
- Shows last 20 events
- Auto-refreshes on page load

### Interactions
- Click artist name to view artist detail page
- Scroll to see all 20 activities

---

## Scout Leaderboard (Admin Only)

### Visibility
- **Admins:** See full leaderboard
- **Scouts:** Not visible

### Metrics Per Scout

#### 1. Deals Created
- Total deals created by scout
- All-time count
- Includes closed deals

#### 2. Deals Won
- Deals in 'closed_won' stage
- Success metric
- Conversion indicator

#### 3. Pipeline Value
- Sum of `estimated_deal_value` for active deals
- Only active deals (not closed)
- Primary ranking metric

### Ranking
- Sorted by pipeline value (highest first)
- Shows position (#1, #2, #3, etc.)
- Color-coded badges

### Display
- Scout name
- Position badge
- Deals created count
- Deals won count
- Pipeline value (large, bold)

### Use Cases
- Track team performance
- Identify top performers
- Motivate competition
- Allocate resources

---

## API Endpoint

### GET /api/analytics/dashboard

**Authentication:** Required (user must be logged in)

**Response:**
```json
{
  "stats": {
    "total_artists": 1250,
    "contactable_artists": 890,
    "active_deals": 45,
    "total_pipeline_value": 450000,
    "unread_inbox": 12
  },
  "pipeline_funnel": [
    { "stage": "new", "count": 15 },
    { "stage": "contacted", "count": 12 },
    { "stage": "interested", "count": 8 }
  ],
  "recent_activity": [
    {
      "type": "deal_created",
      "timestamp": "2026-02-16T10:30:00Z",
      "artist_name": "Alex Rivers",
      "artist_id": "uuid",
      "scout_name": "Sarah Johnson",
      "stage": "new"
    }
  ],
  "scout_leaderboard": [
    {
      "scout_id": "uuid",
      "scout_name": "Sarah Johnson",
      "deals_created": 45,
      "deals_won": 8,
      "pipeline_value": 180000
    }
  ],
  "profile": {
    "role": "admin",
    "full_name": "John Doe"
  }
}
```

**Role-Based Filtering:**
- Scouts: Only their deals, conversations, and stats
- Admins: All data across workspace

**Performance:**
- Single API call loads all dashboard data
- Optimized queries with proper indexing
- Typical response time: 200-500ms

---

## Technical Details

### Data Aggregation
- All data fetched in one API call
- Server-side aggregation for performance
- Role-based query filtering

### Chart Library
- **Recharts** for pipeline funnel
- Responsive and interactive
- Color-coded bars
- Tooltip on hover

### Real-Time Updates
- Data fetched on page load
- Refresh page to see latest data
- Future: WebSocket for live updates

### Performance Optimizations
- Indexed database queries
- Limit to last 20 activities
- Cached profile data
- Efficient aggregations

---

## Use Cases

### For Scouts

#### Morning Routine
1. Check unread inbox count
2. Review active deals count
3. See pipeline value
4. Check recent activity for replies

#### Pipeline Management
1. View funnel to identify bottlenecks
2. See which stages need attention
3. Track personal performance

#### Activity Tracking
1. See recent artist additions
2. Monitor deal progress
3. Track message responses

### For Admins

#### Team Overview
1. Check total workspace stats
2. Review scout leaderboard
3. Identify top performers
4. Allocate resources

#### Pipeline Health
1. View overall funnel distribution
2. Identify team bottlenecks
3. Track total pipeline value
4. Monitor conversion rates

#### Activity Monitoring
1. See all team activity
2. Track deal creation rate
3. Monitor response times
4. Identify busy periods

---

## Best Practices

### Daily Check-In
- Start your day with the dashboard
- Review unread inbox count
- Check active deals
- Scan recent activity

### Pipeline Management
- Monitor funnel for bottlenecks
- Focus on stages with high counts
- Move deals forward regularly
- Keep pipeline value growing

### Activity Tracking
- Check recent activity for replies
- Respond to inbound messages quickly
- Follow up on new deals
- Stay on top of artist additions

### Team Management (Admins)
- Review leaderboard weekly
- Recognize top performers
- Support struggling scouts
- Balance workload

---

## Troubleshooting

### Stats Not Loading
- Check internet connection
- Refresh the page
- Check browser console for errors
- Verify authentication

### Chart Not Displaying
- Ensure deals exist in database
- Check that deals have valid stages
- Verify recharts is installed
- Clear browser cache

### Activity Feed Empty
- Create some deals or add artists
- Check that conversations exist
- Verify date filters
- Ensure proper permissions

### Leaderboard Not Showing (Admin)
- Verify you're logged in as admin
- Check that scouts exist
- Ensure deals are created
- Refresh the page

---

## Future Enhancements

### Planned Features
- [ ] Real-time updates via WebSocket
- [ ] Customizable date ranges
- [ ] Export dashboard data
- [ ] More chart types (line, pie)
- [ ] Filters for activity feed
- [ ] Scout performance trends
- [ ] Goal tracking
- [ ] Notifications for milestones

### Requested Features
- Custom dashboard layouts
- Widget drag-and-drop
- Saved dashboard views
- Email digest of daily stats

---

## Tips & Tricks

### Quick Navigation
- Click artist names in activity feed to jump to details
- Use quick actions for common tasks
- Bookmark dashboard as your home page

### Performance Tracking
- Check leaderboard for team motivation
- Track your pipeline value growth
- Monitor deal stage distribution

### Inbox Management
- Keep unread count at zero
- Respond to messages promptly
- Use inbox badge as reminder

### Pipeline Health
- Aim for even distribution across stages
- Avoid bottlenecks in early stages
- Move deals forward regularly

---

## Support

For questions or issues:
- Check this guide first
- Review API endpoint documentation
- Check browser console for errors
- Contact your CrateHQ admin

---

**Pro Tip:** Make the dashboard your default landing page. Starting your day with a clear overview of your pipeline, inbox, and recent activity helps you prioritize and stay organized! 📊
