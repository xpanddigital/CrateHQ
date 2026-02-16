# CrateHQ - Music Catalog Deal Flow Platform

A production-grade CRM and outreach automation platform for managing music catalog financing deal flow.

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: Supabase (PostgreSQL + Auth)
- **AI**: Anthropic Claude API
- **Email**: Instantly.ai API
- **Scraping**: Apify API
- **Drag & Drop**: @hello-pangea/dnd
- **Charts**: recharts

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new Supabase project at https://supabase.com
2. Run the SQL schema from the prompt in the Supabase SQL Editor
3. Copy your project URL and anon key

### 3. Configure Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=your_anthropic_api_key
APIFY_TOKEN=your_apify_token
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Create First User

1. Go to `/signup` and create an account
2. In Supabase Dashboard, go to Authentication > Users
3. Find your user and manually update the `profiles` table to set `role = 'admin'`

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth pages (login, signup)
│   ├── (dashboard)/       # Dashboard pages
│   └── api/               # API routes
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── artists/           # Artist-specific components
│   ├── pipeline/          # Pipeline/deal components
│   ├── outreach/          # Outreach components
│   ├── inbox/             # Inbox components
│   └── shared/            # Shared components
├── lib/
│   ├── supabase/          # Supabase clients
│   ├── ai/                # AI SDR logic
│   ├── instantly/         # Instantly.ai client
│   ├── apify/             # Apify client
│   └── enrichment/        # Enrichment pipeline
└── types/
    └── database.ts        # TypeScript types
```

## Features

### Implemented
- ✅ Authentication (login/signup)
- ✅ Dashboard layout with sidebar navigation
- ✅ Artists database with search and pagination
- ✅ Artist detail pages
- ✅ Tags system
- ✅ API routes for artists and tags
- ✅ Dark theme UI

### Coming Soon
- 🚧 CSV import
- 🚧 Apify scraping
- 🚧 Email enrichment pipeline
- 🚧 Pipeline kanban board
- 🚧 Instantly.ai integration
- 🚧 AI SDR (classification & reply generation)
- 🚧 Inbox with AI drafts
- 🚧 Analytics dashboard
- 🚧 Scout management

## Database Schema

The complete SQL schema is provided in the main prompt. Key tables:

- `profiles` - User accounts
- `artists` - Artist database
- `tags` - Tagging system
- `artist_tags` - Many-to-many relationship
- `deals` - Deal pipeline
- `conversations` - Message threads
- `email_templates` - Email templates
- `integrations` - API key storage

## API Routes

- `GET/POST /api/artists` - List/create artists
- `GET/PATCH/DELETE /api/artists/[id]` - Artist CRUD
- `GET/POST /api/tags` - Tags management
- More routes coming soon...

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Deployment

Deploy to Vercel:

```bash
vercel
```

Make sure to add all environment variables in the Vercel dashboard.

## License

Proprietary - All rights reserved
