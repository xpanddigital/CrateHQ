# Development Checklist

Use this checklist to track feature implementation progress.

## ✅ Phase 0: Foundation (COMPLETE)

- [x] Project setup with Next.js 14
- [x] TypeScript configuration
- [x] Tailwind CSS + shadcn/ui
- [x] Database schema
- [x] Authentication system
- [x] Dashboard layout
- [x] Basic routing
- [x] API infrastructure

## 🚧 Phase 1: Core Artist Management

### Add Artist Modal
- [ ] Create `ArtistAddModal.tsx` component
- [ ] Form with fields: name, email, instagram, website, streams, genres
- [ ] Form validation
- [ ] Connect to POST /api/artists
- [ ] Success/error toast notifications
- [ ] Refresh artist list after add

### CSV Import
- [ ] Create `ArtistImport.tsx` component
- [ ] File upload with drag-and-drop
- [ ] CSV parsing (use `papaparse` library)
- [ ] Column mapping UI
- [ ] Preview table with validation
- [ ] Create POST /api/artists/import route
- [ ] Bulk insert with transaction
- [ ] Error handling for duplicate/invalid rows
- [ ] Success summary with stats

### Bulk Actions
- [ ] Tag modal component
- [ ] Multi-select tag dropdown
- [ ] POST /api/artists/bulk-tag route
- [ ] Enrich selected button
- [ ] POST /api/artists/bulk-enrich route
- [ ] Progress indicator for batch operations
- [ ] Success/error feedback

## 🚧 Phase 2: Enrichment Pipeline

### Single Artist Enrichment
- [ ] Enrich button on artist detail page
- [ ] POST /api/artists/[id]/enrich route
- [ ] Implement enrichment pipeline:
  - [ ] Parse social links for emails
  - [ ] Hunter.io domain search
  - [ ] Apollo.io person search
  - [ ] Claude Haiku analysis
- [ ] Update artist record with results
- [ ] Display enrichment results in UI
- [ ] Show confidence scores

### Batch Enrichment
- [ ] Queue system for batch jobs
- [ ] Background processing
- [ ] Real-time progress updates
- [ ] Email notification on completion
- [ ] Enrichment history log

### Apify Scraping
- [ ] Scraping form on import page
- [ ] Fields: keywords, playlist URLs, max results
- [ ] POST /api/artists/scrape route
- [ ] Start Apify actor run
- [ ] Poll for completion
- [ ] Fetch dataset results
- [ ] Transform Spotify data to artist schema
- [ ] Preview results table
- [ ] Bulk insert with auto-tag

## 🚧 Phase 3: Deal Pipeline

### Deals API
- [ ] GET /api/deals (list with filters)
- [ ] POST /api/deals (create from artist)
- [ ] GET /api/deals/[id] (detail with artist & conversations)
- [ ] PATCH /api/deals/[id] (update)
- [ ] POST /api/deals/[id]/move (change stage)
- [ ] POST /api/deals/[id]/message (add conversation)

### Create Deal Flow
- [ ] "Create Deal" button on artist detail
- [ ] Deal creation modal
- [ ] Select scout (if admin)
- [ ] Initial notes field
- [ ] Estimated value input
- [ ] Create deal and redirect to pipeline

### Kanban Board
- [ ] Install @hello-pangea/dnd
- [ ] Create `KanbanBoard.tsx`
- [ ] Create `StageColumn.tsx`
- [ ] Create `DealCard.tsx`
- [ ] Implement drag-and-drop
- [ ] Update deal stage on drop
- [ ] Optimistic UI updates
- [ ] Stage filters
- [ ] Scout filter (admin)

### Deal Detail Page
- [ ] Deal header with artist info
- [ ] Stage selector dropdown
- [ ] Estimated/actual value display
- [ ] Notes section (editable)
- [ ] Conversation thread component
- [ ] Add message form
- [ ] Channel selector (email, instagram, phone, note)
- [ ] Timeline view

## 🚧 Phase 4: Email Outreach

### Instantly Integration
- [ ] Settings page integration section
- [ ] API key input with test connection
- [ ] Store in integrations table
- [ ] GET /api/integrations route
- [ ] POST /api/integrations route
- [ ] Test connection button

### Campaign Builder
- [ ] Create `CampaignBuilder.tsx`
- [ ] Tag multi-select filter
- [ ] Preview matching artists
- [ ] Instantly campaign selector
- [ ] Email template selector
- [ ] Custom variables mapping
- [ ] POST /api/outreach/push-leads route
- [ ] Push to Instantly with variables
- [ ] Success confirmation with count

### Email Templates
- [ ] Templates list page
- [ ] Create `TemplateEditor.tsx`
- [ ] Subject and body fields
- [ ] Variable placeholders guide
- [ ] Preview with sample data
- [ ] GET /api/templates route
- [ ] POST /api/templates route
- [ ] PATCH /api/templates/[id] route
- [ ] DELETE /api/templates/[id] route
- [ ] Template categories
- [ ] Sequence position

## 🚧 Phase 5: AI SDR

### Classification
- [ ] POST /api/ai/classify route
- [ ] Implement Claude Haiku classification
- [ ] Return: classification, sentiment, urgency, action
- [ ] Store in conversation record
- [ ] Display classification badge in inbox

### Reply Generation
- [ ] POST /api/ai/generate-reply route
- [ ] Build conversation context
- [ ] Include artist data
- [ ] Include scout persona
- [ ] Use Claude Sonnet for generation
- [ ] Return reply text and confidence
- [ ] Handle objections
- [ ] Include booking link when appropriate

### Follow-up Generation
- [ ] POST /api/ai/generate-followup route
- [ ] Calculate days since last contact
- [ ] Generate contextual follow-up
- [ ] Respect warm_no classification
- [ ] Schedule for optimal timing

### Inbox
- [ ] Inbox list query (unread + needs review)
- [ ] Create `InboxList.tsx`
- [ ] Create `ConversationThread.tsx`
- [ ] Create `AiSdrDraft.tsx`
- [ ] Display AI classification
- [ ] Show suggested reply
- [ ] Edit draft functionality
- [ ] Approve and send
- [ ] Dismiss/mark as read
- [ ] Real-time updates (Supabase Realtime)

## 🚧 Phase 6: Analytics & Admin

### Dashboard Analytics
- [ ] Install recharts
- [ ] Pipeline funnel chart
- [ ] Email metrics line chart
- [ ] Conversion rates
- [ ] Scout leaderboard (admin)
- [ ] Recent activity feed
- [ ] GET /api/analytics/dashboard route
- [ ] Date range selector
- [ ] Export to CSV

### Scout Management
- [ ] Scouts list page (admin only)
- [ ] Scout detail page
- [ ] Performance metrics per scout
- [ ] Commission calculator
- [ ] Invite scout flow
- [ ] POST /api/scouts/invite route
- [ ] Send invite email
- [ ] Deactivate scout
- [ ] Reassign deals

### Settings Page
- [ ] Profile section
  - [ ] Edit full name
  - [ ] Upload avatar
  - [ ] Phone number
  - [ ] Calendly link
- [ ] AI SDR section
  - [ ] Persona selector
  - [ ] Auto-send toggle
  - [ ] Custom instructions
- [ ] Integrations section
  - [ ] Instantly.ai
  - [ ] Hunter.io
  - [ ] Apollo.io
  - [ ] Apify
- [ ] Notifications section
  - [ ] Email preferences
  - [ ] Slack webhook (future)

## 🚧 Phase 7: Polish & Production

### Error Handling
- [ ] Global error boundary
- [ ] API error responses standardized
- [ ] User-friendly error messages
- [ ] Retry logic for failed requests
- [ ] Offline detection

### Toast Notifications
- [ ] Install sonner or similar
- [ ] Success toasts for all actions
- [ ] Error toasts with details
- [ ] Loading toasts for async operations
- [ ] Undo functionality where applicable

### Loading States
- [ ] Skeleton loaders for tables
- [ ] Spinner for buttons
- [ ] Progress bars for uploads
- [ ] Shimmer effects for cards
- [ ] Optimistic UI updates

### Empty States
- [ ] Empty state for each list view
- [ ] Helpful illustrations
- [ ] Clear CTAs
- [ ] Onboarding hints

### Responsive Design
- [ ] Mobile sidebar (hamburger menu)
- [ ] Responsive tables (horizontal scroll)
- [ ] Touch-friendly buttons
- [ ] Mobile-optimized forms
- [ ] Test on tablet

### Performance
- [ ] Image optimization
- [ ] Code splitting
- [ ] Lazy loading for heavy components
- [ ] Debounce search inputs
- [ ] Virtualized lists for large datasets
- [ ] Cache API responses

### Testing
- [ ] Test auth flow
- [ ] Test artist CRUD
- [ ] Test deal creation
- [ ] Test enrichment
- [ ] Test email sending
- [ ] Test AI classification
- [ ] Test permissions (admin vs scout)

### Documentation
- [ ] API documentation
- [ ] Component documentation
- [ ] Deployment guide
- [ ] User guide
- [ ] Video walkthrough

### Deployment
- [ ] Set up Vercel project
- [ ] Configure environment variables
- [ ] Set up custom domain
- [ ] Configure Supabase production
- [ ] Set up monitoring (Sentry)
- [ ] Set up analytics (PostHog/Plausible)

## 🎯 Optional Enhancements

### Advanced Features
- [ ] Bulk email sending (without Instantly)
- [ ] SMS outreach via Twilio
- [ ] WhatsApp integration
- [ ] LinkedIn scraping
- [ ] Automated follow-up sequences
- [ ] A/B testing for email templates
- [ ] Smart scheduling (send time optimization)
- [ ] Duplicate detection
- [ ] Artist similarity matching
- [ ] Predictive deal scoring

### Integrations
- [ ] Slack notifications
- [ ] Discord webhooks
- [ ] Zapier integration
- [ ] Google Sheets sync
- [ ] Airtable sync
- [ ] HubSpot integration

### AI Enhancements
- [ ] Voice of customer analysis
- [ ] Sentiment tracking over time
- [ ] Churn prediction
- [ ] Deal win probability
- [ ] Automated meeting notes
- [ ] Email subject line optimization

---

## Progress Tracking

**Total Tasks**: ~150
**Completed**: ~40 (Foundation)
**Remaining**: ~110

**Current Phase**: Phase 1 (Core Artist Management)
**Next Milestone**: Complete Phase 1 (7-9 hours)

---

## Daily Standup Template

Use this to track daily progress:

```
## [Date]

### Completed
- [ ] Task 1
- [ ] Task 2

### In Progress
- [ ] Task 3

### Blocked
- [ ] Task 4 (reason)

### Next
- [ ] Task 5
- [ ] Task 6

### Notes
- Any learnings or decisions made
```

---

**Last Updated**: Initial setup complete
**Next Review**: After Phase 1 completion
