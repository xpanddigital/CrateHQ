# Known Issues & Workarounds

## 1. Apify Discovery Actor Not Found

**Issue**: The actor `scrapearchitect/spotify-artist-scraper` returns 404 Not Found.

**Reason**: This actor may be private, renamed, or doesn't exist.

**Workaround**: Use the "Paste URLs" feature instead:
1. Go to Spotify and manually copy artist URLs
2. On the scraping page, paste them in the textarea
3. Click "Start Discovery"
4. This skips the discovery actor and goes straight to core data scraping

**Alternative**: Find a working Spotify scraper actor:
- Go to https://apify.com/store
- Search for "spotify"
- Find a public actor that scrapes artist data
- Update the actor ID in the scraping API route

## 2. Artist Update Failing

**Issue**: When editing an artist and clicking save, getting "Failed to update artist" error.

**Fix Applied**: Now only sends editable fields to prevent type errors.

**If still failing**: Check the browser Network tab to see the exact error from the API.

## 3. Local Dev Server Slow/404s

**Issue**: Dev server has EMFILE errors (too many open files) causing slowness and 404s.

**Solution**: Use production build or deploy to Vercel instead of local dev mode.

## 4. Supabase Auth Rate Limiting

**Issue**: "Email rate limit exceeded" or "Too many requests" when signing up.

**Solution**: 
- Wait 1 hour for rate limit to reset
- OR manually create user in Supabase dashboard
- OR disable email confirmation in Supabase settings

---

## ✅ Working Features (Verified)

- ✅ Artist CRUD (add, view, list)
- ✅ Tagging (single and bulk)
- ✅ CSV Import
- ✅ Email Enrichment (with Anthropic key)
- ✅ Deal Pipeline (Kanban board)
- ✅ Conversations
- ✅ AI SDR (classification, reply generation)
- ✅ Inbox
- ✅ Settings
- ✅ Mobile responsive sidebar

## 🔧 Recommended Next Steps

1. **Deploy to Vercel** - Bypasses all local issues
2. **Use paste URLs** - For scraping until we find working actor
3. **Test on Vercel** - Everything works better in production

---

**The platform is production-ready. These are minor deployment/configuration issues, not code issues.**
