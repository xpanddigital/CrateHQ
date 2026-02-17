# Email Templates Guide

## Overview

The Email Template Management system allows you to create, edit, and manage reusable email templates for outreach campaigns. Templates support dynamic variables for personalization and track performance metrics.

## Features

### ✅ Template Management
- Create, edit, duplicate, and delete templates
- Organize by category and sequence
- Toggle active/inactive status
- Search and filter templates

### ✅ Template Editor
- Rich text editor with live preview
- Dynamic variable insertion
- Subject line and body editing
- Category and sequence positioning
- Variable reference panel

### ✅ Performance Tracking
- Times sent counter
- Times replied counter
- Reply rate percentage
- Overall statistics dashboard

### ✅ Default Templates
- 3 pre-seeded templates on first load:
  1. Initial Outreach - Catalog Financing
  2. Follow-Up 1 - Gentle Nudge
  3. Breakup - Door Open

## Accessing Templates

Navigate to **Templates** from the sidebar or go to `/templates`

## Template Categories

Templates are organized into categories for email sequences:

- **Initial Outreach** - First contact with artists
- **Follow-Up 1** - First follow-up (typically 3 days later)
- **Follow-Up 2** - Second follow-up
- **Follow-Up 3** - Third follow-up
- **Breakup** - Final email closing the sequence
- **Re-Engagement** - Reaching out to cold leads

## Available Variables

Templates support the following dynamic variables:

### Artist Information
- `{{artist_name}}` - Full name (e.g., "Alex Rivers")
- `{{first_name}}` - First name only (e.g., "Alex")
- `{{monthly_streams}}` - Formatted stream count (e.g., "2,450,000")
- `{{track_count}}` - Number of tracks (e.g., "38")
- `{{genres}}` - Comma-separated genres (e.g., "Electronic, House, Dance")

### Valuation
- `{{estimated_value_low}}` - Lower bound (e.g., "$18K")
- `{{estimated_value_high}}` - Upper bound (e.g., "$32K")

### Sender Information
- `{{sender_name}}` - Your full name (e.g., "Sarah Johnson")
- `{{booking_link}}` - Your Calendly link (e.g., "https://calendly.com/sarah/15min")

## Creating a Template

### Step 1: Open Template Editor

Click **"Create Template"** button on the Templates page.

### Step 2: Fill in Template Details

**Template Name**
- Give it a descriptive name
- Example: "Initial Outreach - Catalog Financing"

**Category**
- Select from dropdown: initial_outreach, follow_up_1, etc.

**Sequence Position** (optional)
- Number indicating order in sequence (1, 2, 3...)
- Used for organizing multi-step campaigns

**Subject Line**
- Write your email subject
- Use variables for personalization
- Example: `Quick question about your music catalog, {{first_name}}`

**Email Body**
- Write your email content
- Use variables throughout
- Click variable badges to insert at cursor position

### Step 3: Preview

The right panel shows a live preview with sample data:
- Subject line with variables replaced
- Body with variables replaced
- Variable reference guide

### Step 4: Save

Click **"Create Template"** to save.

## Editing Templates

1. Find the template in the list
2. Click the **⋮** menu button
3. Select **"Edit"**
4. Make your changes
5. Click **"Update Template"**

## Duplicating Templates

To create a variation of an existing template:

1. Click the **⋮** menu button
2. Select **"Duplicate"**
3. A copy is created with "(Copy)" appended to the name
4. Edit the duplicate as needed

## Deleting Templates

1. Click the **⋮** menu button
2. Select **"Delete"**
3. Confirm deletion

**Note:** This action cannot be undone.

## Template Status

Templates can be **Active** or **Inactive**:

- **Active** - Available for use in campaigns
- **Inactive** - Hidden from campaign selection

Click the status badge to toggle.

## Performance Metrics

Each template tracks:

- **Sent** - Total times the template was used
- **Replied** - Total replies received
- **Reply Rate** - Percentage (Replied / Sent × 100)

These metrics help you identify your best-performing templates.

## Example Templates

### 1. Initial Outreach

```
Subject: Quick question about your music catalog, {{first_name}}

Hey {{first_name}},

I came across your music and I'm impressed — {{monthly_streams}} monthly streams is no small feat.

I work with artists who are looking to unlock capital from their catalog without giving up ownership or creative control. Think of it like a non-recoupable advance against your future royalties.

Based on your current streams, you could potentially access {{estimated_value_low}} - {{estimated_value_high}} upfront.

Would you be open to a quick 15-minute call to explore if this makes sense for you?

Best,
{{sender_name}}

P.S. If you're interested, grab a time here: {{booking_link}}
```

### 2. Follow-Up 1

```
Subject: Re: Quick question about your music catalog

Hey {{first_name}},

Just wanted to follow up on my last email about catalog financing.

I know you're busy, so I'll keep this short: we help artists like you ({{genres}}) access capital from their streaming royalties without selling their rights.

No strings attached — just a conversation to see if it's a fit.

Interested in chatting for 15 minutes?

Best,
{{sender_name}}
```

### 3. Breakup Email

```
Subject: I'll leave you be, {{first_name}}

Hey {{first_name}},

I haven't heard back, so I'm guessing now isn't the right time — totally understand!

I'll stop reaching out, but if you ever want to explore catalog financing down the road, my door's always open.

Wishing you continued success with your music.

Best,
{{sender_name}}

P.S. If you change your mind, you can always book a call here: {{booking_link}}
```

## Best Practices

### 1. Personalization
- Always use `{{first_name}}` instead of `{{artist_name}}` for a personal touch
- Reference specific data points like streams or genres
- Mention their estimated value range when relevant

### 2. Subject Lines
- Keep them short and personal
- Use the artist's first name
- Create curiosity without being clickbait
- Test different approaches and track reply rates

### 3. Email Body
- Keep it concise (under 150 words)
- Lead with value, not features
- Include a clear call-to-action
- Make it easy to respond (yes/no questions work well)

### 4. Sequence Strategy
- **Initial**: Introduce yourself and the opportunity
- **Follow-Up 1** (3 days): Gentle reminder with value prop
- **Follow-Up 2** (7 days): Different angle or case study
- **Breakup** (14 days): Graceful exit, door open

### 5. Testing & Optimization
- Create multiple versions of each template
- Track reply rates
- Keep what works, discard what doesn't
- A/B test subject lines and opening lines

## Variable Data Sources

Variables are populated from:

- **Artist Data** - From the `artists` table
- **Profile Data** - From your `profiles` record (sender_name, booking_link)
- **Calculated Data** - Formatted values (e.g., "1,234,567" streams)

## Integration with Instantly

Templates are designed to work with Instantly.ai campaigns:

1. Create templates in CrateHQ
2. Use the same variables in Instantly email sequences
3. Variables are passed when pushing leads
4. Instantly replaces them in real-time

**Instantly Variable Format:**
- CrateHQ: `{{artist_name}}`
- Instantly: `{{custom_artist_name}}`

The system automatically prefixes variables with `custom_` when pushing to Instantly.

## Tips & Tricks

### Quick Variable Insertion
- Click any variable badge to insert at cursor position
- No need to type `{{` manually

### Live Preview
- Preview updates in real-time as you type
- Uses sample data to show how variables render
- Toggle between edit and preview modes

### Template Organization
- Use sequence positions to keep templates ordered
- Name templates descriptively
- Use categories to group by campaign type

### Performance Analysis
- Sort by reply rate to find winners
- Duplicate high-performing templates
- Iterate on successful patterns

## Troubleshooting

### Variables Not Showing in Preview
- Check spelling (case-sensitive)
- Ensure proper format: `{{variable_name}}`
- No spaces inside braces

### Template Not Saving
- All required fields must be filled:
  - Name
  - Category
  - Subject
  - Body
- Check for error messages

### Low Reply Rates
- Test different subject lines
- Shorten email body
- Increase personalization
- Check timing (don't send on weekends)

## API Endpoints

For developers integrating with the template system:

- `GET /api/templates` - List all templates
- `POST /api/templates` - Create template
- `GET /api/templates/[id]` - Get single template
- `PUT /api/templates/[id]` - Update template
- `DELETE /api/templates/[id]` - Delete template

## Database Schema

Templates are stored in the `email_templates` table:

```sql
CREATE TABLE email_templates (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  sequence_position INTEGER,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  times_sent INTEGER DEFAULT 0,
  times_replied INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Next Steps

1. **Create Your First Template**
   - Start with the default templates
   - Customize them to your style
   - Test with a small batch

2. **Build a Sequence**
   - Create 3-5 templates for a complete sequence
   - Set sequence positions
   - Test the flow

3. **Track Performance**
   - Monitor reply rates
   - Iterate on low performers
   - Scale what works

4. **Integrate with Outreach**
   - Use templates in Instantly campaigns
   - Push leads from CrateHQ
   - Track results

## Support

For questions or issues:
- Check this guide first
- Review example templates
- Contact your CrateHQ admin

---

**Pro Tip:** The best templates are conversational, personal, and focused on the artist's success—not your product. Lead with value, keep it short, and make it easy to say yes.
