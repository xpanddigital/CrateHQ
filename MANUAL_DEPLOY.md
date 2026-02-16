# Manual Deployment to Vercel

Since automated deployment is having issues, here's how to manually trigger a redeploy:

## 🚀 Option 1: Redeploy from Vercel Dashboard (Fastest - 2 minutes)

1. Go to: https://vercel.com/dashboard
2. Click on your **CrateHQ** project
3. Click the **"Deployments"** tab
4. Find the most recent deployment
5. Click the **"..."** menu (three dots)
6. Click **"Redeploy"**
7. Make sure "Use existing Build Cache" is **UNCHECKED**
8. Click **"Redeploy"**
9. Wait 2 minutes

**This will pull the latest code from GitHub (commit 438b31d) and deploy it!**

---

## 🚀 Option 2: Trigger New Deployment from GitHub

1. Go to: https://github.com/xpanddigital/CrateHQ
2. Make a small change (add a space to README.md)
3. Commit and push
4. Vercel will auto-deploy

---

## 🚀 Option 3: Use Vercel CLI (If you have it)

```bash
cd /Users/joelhouse/Documents/CURSOR/CrateHQ
vercel --prod
```

---

## ✅ How to Verify Latest Version is Deployed

After redeploying, check if you have the latest features:

1. Go to https://crate-hq.vercel.app
2. Login
3. Go to an artist detail page
4. Look for **"Get Catalog Value"** button in the header
5. If you see it → Latest version deployed! ✅
6. If you don't see it → Need to redeploy again

---

## 🎯 What's in the Latest Version (438b31d)

- ✅ Correct Apify actor IDs (VCXf9fqUpGHnOdeUV, YZhD6hYc8daYSWXKs)
- ✅ Apify API using query parameters (tested and working)
- ✅ "Get Catalog Value" button on artist detail
- ✅ Mobile responsive sidebar with hamburger menu
- ✅ Artist update fix (only editable fields)
- ✅ Better error messages throughout

---

**Go to Vercel dashboard and click "Redeploy" now!** 🚀

It's the fastest way to get the latest working version live.
