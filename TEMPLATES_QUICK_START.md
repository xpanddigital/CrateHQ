# Email Templates - Quick Start Guide 🚀

## What You Get

A complete email template management system with:
- ✅ Visual template editor with live preview
- ✅ 9 dynamic variables for personalization
- ✅ 3 pre-built default templates
- ✅ Performance tracking (sent, replied, reply rate)
- ✅ Search, filter, and organize templates
- ✅ Instantly.ai integration ready

---

## 🎯 Access Templates

**From Sidebar:** Click **Templates** 

**Direct URL:** `/templates`

---

## 📝 Your First Template in 3 Steps

### Step 1: Click "Create Template"

### Step 2: Fill in the Details

```
Name: Initial Outreach - Catalog Financing
Category: Initial Outreach
Sequence: 1
Subject: Quick question about your music catalog, {{first_name}}
Body: [Write your email, click variable badges to insert]
```

### Step 3: Watch Live Preview & Save

The right panel shows exactly how your email will look with real data!

---

## 🎨 Available Variables

Click any badge in the editor to insert:

| Variable | Example Output |
|----------|----------------|
| `{{artist_name}}` | Alex Rivers |
| `{{first_name}}` | Alex |
| `{{monthly_streams}}` | 2,450,000 |
| `{{track_count}}` | 38 |
| `{{genres}}` | Electronic, House, Dance |
| `{{estimated_value_low}}` | $18K |
| `{{estimated_value_high}}` | $32K |
| `{{sender_name}}` | Sarah Johnson |
| `{{booking_link}}` | https://calendly.com/sarah/15min |

---

## 📧 Default Templates (Pre-Loaded)

### 1. Initial Outreach
- **When:** First contact
- **Goal:** Introduce catalog financing opportunity
- **Includes:** Streams, estimated value, booking link

### 2. Follow-Up 1
- **When:** 3 days after initial
- **Goal:** Gentle reminder
- **Includes:** Genres, value prop

### 3. Breakup
- **When:** 14 days after initial
- **Goal:** Graceful exit, door open
- **Includes:** Booking link for future

---

## 🎭 Template Categories

| Category | Use Case | Color |
|----------|----------|-------|
| **Initial Outreach** | First contact | 🔵 Blue |
| **Follow-Up 1** | First reminder | 🟣 Purple |
| **Follow-Up 2** | Second reminder | 🟣 Purple |
| **Follow-Up 3** | Third reminder | 🟣 Purple |
| **Breakup** | Final email | 🟠 Orange |
| **Re-Engagement** | Reactivate cold leads | 🟢 Green |

---

## ⚡ Quick Actions

### Edit Template
1. Click **⋮** menu
2. Select **"Edit"**
3. Make changes
4. Save

### Duplicate Template
1. Click **⋮** menu
2. Select **"Duplicate"**
3. Edit the copy

### Toggle Active/Inactive
- Click the status badge
- Active templates appear in campaigns
- Inactive templates are hidden

### Delete Template
1. Click **⋮** menu
2. Select **"Delete"**
3. Confirm

---

## 📊 Performance Metrics

Each template shows:
- **Sent** - Times used
- **Replied** - Replies received
- **Reply Rate** - Success percentage

**Pro Tip:** Sort by reply rate to find your winners! 🏆

---

## 🔗 Using with Instantly

Templates automatically work with Instantly.ai:

1. Create template in CrateHQ
2. Push leads from Outreach page
3. Variables are sent to Instantly as `custom_artist_name`, etc.
4. Instantly replaces them when sending

**No extra setup needed!** ✨

---

## 💡 Pro Tips

### Subject Lines
- ✅ Use `{{first_name}}` for personalization
- ✅ Keep under 60 characters
- ✅ Create curiosity
- ❌ Avoid spam words

### Email Body
- ✅ Under 150 words
- ✅ Lead with value
- ✅ Clear call-to-action
- ✅ Easy to respond (yes/no)

### Sequences
Build a 3-5 email sequence:
1. Day 0: Initial (introduce)
2. Day 3: Follow-up 1 (remind)
3. Day 7: Follow-up 2 (different angle)
4. Day 14: Breakup (graceful exit)

---

## 🎯 Example Template

**Subject:** Quick question about your music catalog, {{first_name}}

**Body:**
```
Hey {{first_name}},

I came across your music and I'm impressed — {{monthly_streams}} monthly streams is no small feat.

I work with artists who are looking to unlock capital from their catalog without giving up ownership or creative control.

Based on your current streams, you could potentially access {{estimated_value_low}} - {{estimated_value_high}} upfront.

Would you be open to a quick 15-minute call?

Best,
{{sender_name}}

P.S. Grab a time here: {{booking_link}}
```

**Preview Output:**
```
Subject: Quick question about your music catalog, Alex

Hey Alex,

I came across your music and I'm impressed — 2,450,000 monthly streams is no small feat.

I work with artists who are looking to unlock capital from their catalog without giving up ownership or creative control.

Based on your current streams, you could potentially access $18K - $32K upfront.

Would you be open to a quick 15-minute call?

Best,
Sarah Johnson

P.S. Grab a time here: https://calendly.com/sarah/15min
```

---

## 🔍 Search & Filter

Use the search bar to find templates by:
- Name
- Category
- Subject line

Results update in real-time as you type!

---

## 📈 Dashboard Stats

Bottom of the page shows:
- Total templates
- Active templates
- Total sent
- Total replies

Track your overall performance at a glance!

---

## 🆘 Need Help?

**Full Guide:** See `EMAIL_TEMPLATES_GUIDE.md`

**Common Issues:**

**Q: Variables not showing in preview?**
A: Check spelling and format: `{{variable_name}}`

**Q: Template won't save?**
A: Fill in all required fields (name, category, subject, body)

**Q: How do I test a template?**
A: Use the live preview panel on the right

---

## ✅ Next Steps

1. **Visit `/templates`** to see default templates
2. **Create your first custom template**
3. **Build a 3-email sequence**
4. **Use in Outreach campaigns**
5. **Track reply rates**
6. **Iterate and improve**

---

## 🎉 You're Ready!

Start creating personalized, high-converting email templates for your artist outreach campaigns!

**Remember:** The best templates are conversational, personal, and focused on the artist's success. Lead with value! 🎵

---

For detailed documentation, see:
- `EMAIL_TEMPLATES_GUIDE.md` - Complete guide
- `TEMPLATES_SETUP_COMPLETE.md` - Technical overview
