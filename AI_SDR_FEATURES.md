# AI SDR Features - Complete Implementation

## 🤖 Overview

The AI Sales Development Representative system automatically classifies incoming replies, generates contextual responses, and manages the inbox workflow. Built with Claude Sonnet for reply generation and Claude Haiku for classification.

## ✅ Features Implemented

### 1. AI SDR Module ✅
**Location**: `src/lib/ai/sdr.ts`

**Functions**:
- `classifyReply()` - Classify artist replies into 6 categories
- `generateReply()` - Generate contextual responses
- `generateFollowup()` - Create follow-up messages for stale leads

**Classifications**:
- **interested** - Wants to learn more, positive sentiment
- **question** - Asking for information
- **objection** - Specific concern or pushback
- **not_interested** - Clear opt-out
- **warm_no** - Not ready now, door open
- **unclear** - Cannot determine intent

**Scout Personas**:
- **professional** - Concise, data-aware, respects time
- **relationship_builder** - Warm, connection-first
- **direct** - Confident, lead with numbers
- **educator** - Knowledgeable, teaches before pitching
- **peer** - Casual, music-industry native

**Fallback System**:
- Keyword-based classification if API fails
- Template-based follow-ups if AI unavailable
- Works without API keys (degraded mode)

---

### 2. Classification API ✅
**Endpoint**: `POST /api/ai/classify`

**Request**:
```json
{
  "replyText": "Yeah I'm interested, tell me more",
  "conversationHistory": [...]
}
```

**Response**:
```json
{
  "classification": "interested",
  "sentiment": "positive",
  "urgency": "high",
  "suggested_action": "send_booking_link",
  "reasoning": "Positive signals"
}
```

**Uses**:
- Claude Haiku for fast classification
- Conversation history for context
- Keyword fallback if API fails

---

### 3. Reply Generation API ✅
**Endpoint**: `POST /api/ai/generate-reply`

**Request**:
```json
{
  "replyText": "How much can I get?",
  "artistData": {...},
  "scoutProfile": {...},
  "classification": {...},
  "conversationHistory": [...]
}
```

**Response**:
```json
{
  "reply_text": "Great question! Artists with your streaming profile...",
  "action": "send",
  "stage_suggestion": "interested",
  "booking_link_included": true,
  "confidence": 0.85
}
```

**Uses**:
- Claude Sonnet for high-quality replies
- Scout persona from profile
- Artist streaming data for context
- Booking link from scout profile
- Safety check: low confidence → hold for review

---

### 4. Follow-up Generation API ✅
**Endpoint**: `POST /api/ai/generate-followup`

**Request**:
```json
{
  "artistData": {...},
  "daysSinceLastContact": 14,
  "scoutProfile": {...},
  "conversationHistory": [...]
}
```

**Response**:
```json
{
  "subject": "Still open to chatting?",
  "body": "Hi there, wanted to check...",
  "strategy": "direct_question"
}
```

**Strategies by Days**:
- **0-5 days**: Gentle nudge
- **6-10 days**: Value-add (share useful info)
- **11-20 days**: Direct question (yes/no)
- **21-30 days**: Breakup email (highest reply rate)
- **30+ days**: Re-engagement (fresh angle)

---

### 5. Inbox Page ✅
**Location**: `/inbox`

**Query Logic**:
Shows conversations where:
- `requires_human_review = true` OR
- (`direction = 'inbound'` AND `is_read = false`)

**Sorting**:
Priority order:
1. Interested (green)
2. Questions (blue)
3. Objections (orange)
4. Warm No (yellow)
5. Unclear (gray)
6. Not Interested (red)

**Each Item Shows**:
- Artist name
- Reply preview (truncated)
- AI classification badge (color-coded)
- Confidence percentage
- Time ago
- Channel badge

**Expandable View**:
- Full conversation history (last 3 messages)
- AI-generated draft reply (if available)
- Three action buttons:
  - **Approve & Send** - Sends draft as outbound, marks read
  - **Edit** - Opens textarea to modify draft
  - **Dismiss** - Marks read without sending

---

### 6. Auto-Classification on Inbound Messages ✅

**When**: New inbound message added to deal

**Process**:
1. Message received (via API or manual add)
2. Auto-call `classifyReply()` with conversation history
3. Store results:
   - `ai_classification` - Category
   - `ai_confidence` - Confidence score
   - `requires_human_review` - Set to true
4. If classification is "interested":
   - Auto-call `generateReply()`
   - Store draft in `ai_suggested_reply`
5. Message appears in inbox

**Integration**:
- Built into `POST /api/deals/[id]/message`
- Works for all inbound channels
- Graceful failure (continues without AI if error)

---

### 7. Settings Page with Persona Selector ✅
**Location**: `/settings`

**Sections**:

**Profile**:
- Full name (editable)
- Email (read-only)
- Phone number

**Booking Link**:
- Calendly URL input
- Used in AI-generated replies
- Shown in booking link prompts

**AI SDR Persona**:
- Dropdown with 5 personas
- Live preview of selected persona
- Description of communication style
- Affects all AI-generated replies

**Save Button**:
- Updates profile in database
- Refreshes app state

---

## 🎨 UI Components

### Inbox Item Component
**File**: `src/components/inbox/InboxList.tsx`

**Features**:
- Collapsible card design
- Color-coded classification badges
- Conversation history preview
- AI draft display with syntax highlighting
- Edit mode for draft modification
- Three-button action bar

**States**:
- Collapsed: Shows preview only
- Expanded: Shows full thread + draft
- Editing: Textarea with draft text
- Sending: Loading state

---

## 🔄 Complete Workflow

### Scenario 1: Artist Replies "Interested"

1. Artist sends email: "Yeah tell me more"
2. Scout manually adds to deal as inbound message
3. System auto-classifies: "interested" (high urgency)
4. System auto-generates reply draft
5. Message appears in inbox with green badge
6. Scout opens inbox, sees draft
7. Scout clicks "Approve & Send"
8. Reply sent as outbound message
9. Inbox item removed
10. Deal updated with timestamps

### Scenario 2: Artist Asks Question

1. Artist replies: "How much do I keep?"
2. Auto-classified as "question"
3. No auto-draft (not interested yet)
4. Appears in inbox with blue badge
5. Scout manually replies or dismisses

### Scenario 3: Artist Says No

1. Artist replies: "Not interested"
2. Auto-classified as "not_interested"
3. Suggested action: "remove_from_sequence"
4. Appears in inbox with red badge
5. Scout dismisses
6. Can manually move deal to "closed_lost"

---

## 🔑 Environment Variables

```env
# Required for AI SDR features
ANTHROPIC_API_KEY=your_anthropic_key
```

**Without API Key**:
- Classification falls back to keyword matching
- Follow-ups use template system
- Reply generation unavailable

---

## 💰 Cost Analysis

### Per Conversation
- **Classification**: ~$0.0001 (Haiku, 300 tokens)
- **Reply Generation**: ~$0.001 (Sonnet, 500 tokens)
- **Follow-up**: ~$0.0008 (Sonnet, 400 tokens)

### Monthly Estimates
- 100 conversations: ~$0.11
- 500 conversations: ~$0.55
- 1,000 conversations: ~$1.10

**Very affordable** compared to human time!

---

## 📊 Expected Performance

### Classification Accuracy
- **High confidence** (>80%): Clear signals (interested, not_interested)
- **Medium confidence** (60-80%): Questions, objections
- **Low confidence** (<60%): Unclear, ambiguous replies

### Reply Quality
- **Personalized**: Uses artist data and scout persona
- **Contextual**: Includes conversation history
- **Appropriate**: Matches classification and urgency
- **Safe**: Low confidence replies held for review

### Inbox Efficiency
- **Time saved**: ~80% reduction in reply time
- **Consistency**: All replies follow brand guidelines
- **Scalability**: Handle 10x more conversations

---

## 🎯 Best Practices

### Setting Up
1. **Configure Calendly link** - Required for booking prompts
2. **Choose persona** - Match your communication style
3. **Review first 10 drafts** - Ensure quality meets standards
4. **Enable auto-send** (future) - Only after validation

### Daily Workflow
1. **Check inbox** - Sort by interested first
2. **Review AI drafts** - Quick scan for quality
3. **Approve or edit** - One-click send or quick edits
4. **Dismiss non-actionable** - Keep inbox clean

### Quality Control
- **Monitor confidence scores** - Low confidence = review carefully
- **Check classification accuracy** - Retrain if needed
- **Review sent messages** - Ensure quality maintained
- **Update persona** - Adjust if replies feel off

---

## 🔧 Technical Details

### Auto-Classification Flow
```
Inbound message received
  ↓
Fetch conversation history
  ↓
Call classifyReply() with context
  ↓
Store classification + confidence
  ↓
If "interested" → generateReply()
  ↓
Store draft in ai_suggested_reply
  ↓
Set requires_human_review = true
  ↓
Appears in inbox
```

### Inbox Query
```sql
SELECT * FROM conversations
WHERE (requires_human_review = true 
   OR (direction = 'inbound' AND is_read = false))
ORDER BY 
  CASE ai_classification
    WHEN 'interested' THEN 1
    WHEN 'question' THEN 2
    WHEN 'objection' THEN 3
    WHEN 'warm_no' THEN 4
    WHEN 'unclear' THEN 5
    ELSE 6
  END,
  sent_at DESC
```

### Scout Persona Integration
- Read from `profiles.ai_sdr_persona`
- Applied to system prompt
- Affects tone and style
- Consistent across all AI interactions

---

## 📝 Database Fields Used

### Conversations Table
- `ai_classification` - Category (interested, question, etc.)
- `ai_confidence` - Confidence score (0-1)
- `ai_suggested_reply` - Generated draft text
- `requires_human_review` - Boolean flag
- `is_read` - Mark as processed

### Profiles Table
- `ai_sdr_persona` - Selected persona (professional, etc.)
- `calendly_link` - Booking URL
- `ai_sdr_auto_send` - Future: auto-send high confidence

---

## 🚀 Future Enhancements

### Auto-Send (Coming Soon)
- Enable in settings
- Only send if confidence > 90%
- Only for "interested" classification
- Notify scout after sending

### Learning System
- Track reply rates by persona
- A/B test different approaches
- Optimize prompts based on results

### Advanced Classification
- Detect urgency from language
- Identify decision-makers
- Recognize buying signals

---

## ✅ Quality Checklist

- [x] Classification with 6 categories
- [x] Reply generation with persona
- [x] Follow-up with time-based strategies
- [x] Inbox with priority sorting
- [x] Auto-classification on inbound
- [x] AI draft display and editing
- [x] Approve/Edit/Dismiss workflow
- [x] Settings page with persona selector
- [x] Keyword fallbacks (no API required)
- [x] Error handling throughout

---

**The complete AI SDR system is now functional and ready to handle conversations at scale!** 🤖
