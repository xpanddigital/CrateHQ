# Quick Start Guide

Get CrateHQ running in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works)
- Git (optional)

## Step 1: Install Dependencies

Dependencies are already installed. If you need to reinstall:

```bash
npm install
```

## Step 2: Set Up Supabase

1. **Create a Supabase project**
   - Go to https://supabase.com
   - Click "New Project"
   - Choose a name, database password, and region

2. **Run the database schema**
   - In your Supabase dashboard, go to "SQL Editor"
   - Click "New Query"
   - Copy the entire contents of `supabase-schema.sql`
   - Paste and click "Run"
   - You should see "Success. No rows returned"

3. **Get your API keys**
   - Go to Settings > API
   - Copy your "Project URL" and "anon public" key

## Step 3: Configure Environment

Create a `.env.local` file in the root directory:

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Optional (add later)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=your-anthropic-key
APIFY_TOKEN=your-apify-token
HUNTER_API_KEY=your-hunter-key
APOLLO_API_KEY=your-apollo-key
```

## Step 4: Run the Development Server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Step 5: Create Your First User

1. Go to http://localhost:3000 (it will redirect to `/login`)
2. Click "Sign up"
3. Enter your name, email, and password
4. You'll be automatically logged in and redirected to the dashboard

## Step 6: Make Yourself an Admin

By default, new users are "scouts". To access admin features:

1. Go to your Supabase dashboard
2. Navigate to "Authentication" > "Users"
3. Find your user and copy the UUID
4. Go to "Table Editor" > "profiles"
5. Find your profile row and change `role` from `scout` to `admin`
6. Refresh your CrateHQ dashboard

## What's Working Now

✅ **Authentication**: Login, signup, logout
✅ **Dashboard**: Overview with stats
✅ **Artists**: View, search, paginate artist list
✅ **Artist Detail**: View individual artist profiles
✅ **Tags**: Tag system is ready (API implemented)
✅ **Dark Theme**: Production-ready UI

## What's Next

The foundation is complete! Here's what to build next:

1. **Add Artist Modal**: Create the "Add Artist" button functionality
2. **CSV Import**: Build the import flow
3. **Enrichment**: Connect Hunter.io and Apollo.io APIs
4. **Pipeline**: Build the kanban board with drag-and-drop
5. **Instantly Integration**: Connect email campaigns
6. **AI SDR**: Implement reply classification and generation

## Testing the App

### Add a Test Artist (via Supabase)

1. Go to Supabase > Table Editor > artists
2. Click "Insert row"
3. Fill in:
   - `name`: "Test Artist"
   - `spotify_monthly_listeners`: 50000
   - `email`: "test@example.com"
   - `is_contactable`: true
4. Click "Save"
5. Refresh your Artists page in CrateHQ

### Create a Test Tag

Use the API directly or add via Supabase:

```bash
curl -X POST http://localhost:3000/api/tags \
  -H "Content-Type: application/json" \
  -d '{"name": "hip-hop", "color": "#8B5CF6"}'
```

## Troubleshooting

### "Unauthorized" errors
- Check that your `.env.local` file exists and has the correct keys
- Restart the dev server after adding environment variables

### Database errors
- Make sure you ran the entire `supabase-schema.sql` file
- Check that Row Level Security policies were created

### Can't login after signup
- Check Supabase > Authentication > Users to see if the user was created
- Check Supabase > Table Editor > profiles to see if the profile was created

### Styling looks broken
- Make sure `npm install` completed successfully
- Check that `tailwind.config.ts` and `globals.css` exist

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # Login & signup pages
│   ├── (dashboard)/         # All dashboard pages
│   │   ├── layout.tsx       # Sidebar + auth guard
│   │   ├── dashboard/       # Home dashboard
│   │   ├── artists/         # Artist management
│   │   ├── pipeline/        # Deal pipeline
│   │   ├── outreach/        # Email campaigns
│   │   ├── inbox/           # Reply management
│   │   ├── analytics/       # Charts & metrics
│   │   ├── scouts/          # Team management
│   │   └── settings/        # User settings
│   └── api/                 # API routes
│       ├── artists/         # Artist CRUD
│       └── tags/            # Tag CRUD
├── components/
│   ├── ui/                  # shadcn/ui components
│   └── shared/              # Reusable components
├── lib/
│   ├── supabase/            # Database clients
│   ├── ai/                  # AI SDR logic
│   ├── instantly/           # Email API client
│   ├── apify/               # Scraping client
│   └── enrichment/          # Email finding
└── types/
    └── database.ts          # TypeScript types
```

## Next Steps

1. **Add your first artist** (manually or via Supabase)
2. **Create some tags** for organization
3. **Explore the codebase** - everything is well-organized
4. **Start building features** - follow the BUILD ORDER in the main prompt

## Need Help?

- Check the main README.md for detailed documentation
- Review the original prompt for feature specifications
- Inspect the database schema in `supabase-schema.sql`

---

**You're all set!** The foundation is solid and ready for feature development.
