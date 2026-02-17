# Vercel Environment Variables Setup 🔧

## The Problem

Your Apify integration works locally but **not on Vercel** because environment variables in `.env.local` are only available during local development. They are **not automatically deployed** to Vercel.

## The Solution

You need to add `APIFY_TOKEN` to Vercel's environment variables.

### Step 1: Go to Vercel Dashboard

1. Open https://vercel.com/
2. Click on your project: **CrateHQ**
3. Click **Settings** tab
4. Click **Environment Variables** in the left sidebar

### Step 2: Add APIFY_TOKEN

Click **Add New** and enter:

**Key:**
```
APIFY_TOKEN
```

**Value:**
```
apify_api_xxxxxxxxxxxxx
```
(Use the value from your `.env.local` file)

**Environments:** Select all three:
- ✅ Production
- ✅ Preview
- ✅ Development

Click **Save**.

### Step 3: Redeploy

After adding the environment variable, you need to trigger a new deployment:

**Option A: Push a dummy commit**
```bash
git commit --allow-empty -m "Trigger redeploy with APIFY_TOKEN"
git push origin main
```

**Option B: Manual redeploy in Vercel**
1. Go to **Deployments** tab
2. Click the **⋯** menu on the latest deployment
3. Click **Redeploy**
4. Check **Use existing Build Cache**
5. Click **Redeploy**

### Step 4: Verify

After deployment completes:

1. Go to your live site
2. Open browser console (F12)
3. Try enriching an artist
4. Look for these logs:
   ```
   [Enrichment] Using batched Apify fetch for all URLs...
   [collectArtistUrls] Collected X URLs...
   [Apify Fetch Multiple] Starting batch fetch...
   ```

5. Check your Apify dashboard at https://console.apify.com/
   - You should see a new run of `apify/website-content-crawler`

## Why This Happened

**Local Development:**
- `.env.local` file is read by Next.js
- `process.env.APIFY_TOKEN` is available
- Apify integration works ✅

**Vercel Deployment:**
- `.env.local` is in `.gitignore` (not pushed to GitHub)
- Vercel doesn't have access to `.env.local`
- `process.env.APIFY_TOKEN` is `undefined`
- `useApifyBatch` becomes `false`
- Apify integration is skipped ❌

## Current Environment Variables in Vercel

You should have these set:

1. **NEXT_PUBLIC_SUPABASE_URL**
   ```
   https://ngefkeguvtzzvcjeqtvx.supabase.co
   ```

2. **NEXT_PUBLIC_SUPABASE_ANON_KEY**
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nZWZrZWd1dnR6enZjamVxdHZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExODgwNTEsImV4cCI6MjA4Njc2NDA1MX0.zQC5JLoxImdJcYAqR1s89ApJ8_ro4qKzKDZhWQeBkZc
   ```

3. **ANTHROPIC_API_KEY**
   ```
   sk-ant-xxxxxxxxxxxxx
   ```

4. **APIFY_TOKEN** ⚠️ MISSING - Add this!
   ```
   apify_api_xxxxxxxxxxxxx
   ```

## How to Check Current Vercel Environment Variables

### Method 1: Vercel Dashboard
1. Go to https://vercel.com/
2. Select your project
3. Settings → Environment Variables
4. See what's currently set

### Method 2: Vercel CLI
```bash
vercel env ls
```

### Method 3: Add a Debug API Route (Temporary)

Create `src/app/api/debug/env/route.ts`:
```typescript
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    has_apify_token: !!process.env.APIFY_TOKEN,
    has_anthropic_key: !!process.env.ANTHROPIC_API_KEY,
    node_env: process.env.NODE_ENV,
  })
}
```

Then visit: `https://your-site.vercel.app/api/debug/env`

**Expected response after fix:**
```json
{
  "has_apify_token": true,
  "has_anthropic_key": true,
  "node_env": "production"
}
```

## Security Note

⚠️ **Never commit API keys to Git!**

- `.env.local` is in `.gitignore` ✅
- Always use Vercel's Environment Variables UI for production secrets ✅
- If you accidentally commit a key, rotate it immediately ✅

---

**Status:** Action required - Add `APIFY_TOKEN` to Vercel
**Time:** 2 minutes
**Impact:** Apify integration will start working on production
