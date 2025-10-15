# 🚀 Heroku Deployment Guide

## 📋 Overview

This guide will help you deploy the Lucky Wheel app (Frontend + Backend) to Heroku as a single application.

## ✅ Prerequisites

- ✅ Supabase account with database setup complete
- ✅ Heroku account with CLI installed
- ✅ Heroku credit available (Eco Dyno = $5/month)
- ✅ N8N webhook configured (optional)

## 🗂️ Project Structure

```
lucky-wheel-backend/
├── server.js
├── Procfile
├── package.json
├── .env (local only, DO NOT commit!)
├── lib/
│   ├── supabase.js
│   └── db.js
└── frontend/               ← React app (built on deploy)
    ├── package.json
    ├── src/
    └── dist/              ← Built files served by backend
```

## 🚀 Deployment Steps

### Step 1: Install Heroku CLI

```bash
# macOS
brew tap heroku/brew && brew install heroku

# Or download from: https://devcenter.heroku.com/articles/heroku-cli
```

### Step 2: Login to Heroku

```bash
heroku login
```

### Step 3: Create Heroku App

```bash
cd /Volumes/DATA/ts-web-dev/haravan-app/lucky-wheel-backend

# Create app (choose a unique name)
heroku create lucky-wheel-app-your-name

# Or use auto-generated name:
heroku create
```

### Step 4: Set Environment Variables

**IMPORTANT:** Set these environment variables in Heroku:

```bash
# Required: Server Configuration
heroku config:set NODE_ENV=production
heroku config:set PORT=3000

# Required: Supabase Configuration
heroku config:set SUPABASE_URL=https://zigemvynmihdhntrxzsg.supabase.co
heroku config:set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppZ2VtdnlubWloZGhudHJ4enNnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDUxMjIzNywiZXhwIjoyMDc2MDg4MjM3fQ.1x_yKrodyrBdTowa7WnPGYumv767GzwtUkrhZU-aTGA

# Required: Security Keys (CHANGE THESE IN PRODUCTION!)
heroku config:set API_SECRET=k7idGxyxhN2moKZXF82WPMWJs6g70FUZ
heroku config:set SECRET_PEPPER=OzaOZm40Uj9zaIyTrXh2j4DtZhVNi8le

# Optional: N8N Webhook (if you want Zalo integration)
heroku config:set N8N_WEBHOOK_URL=https://n8n.nhathuocvietnhat.vn/webhook/lucky-wheel-2025-10-14
heroku config:set N8N_WEBHOOK_API_KEY=lucky-wheel-123456
heroku config:set N8N_WEBHOOK_SECRET=wNCKKSnDyMeU74KsTLhKiUZwkP2TmVmO

# Optional: Frontend URL (for CORS)
heroku config:set FRONTEND_URL=https://your-app-name.herokuapp.com
heroku config:set PRODUCTION_URL=https://your-custom-domain.com
```

**Generate secure random strings:**

```bash
# Generate API_SECRET (32 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate SECRET_PEPPER (32 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 5: Initialize Git Repository

```bash
cd /Volumes/DATA/ts-web-dev/haravan-app/lucky-wheel-backend

# Initialize git if not already done
git init

# Create .gitignore
cat > .gitignore << EOF
node_modules/
.env
.DS_Store
*.log
dist/
EOF

# Add files
git add .
git commit -m "Initial commit - Lucky Wheel app with Supabase"
```

### Step 6: Deploy to Heroku

```bash
# Add Heroku remote
heroku git:remote -a your-app-name

# Deploy
git push heroku main  # Or 'master' if your branch is named master

# If you're on a different branch:
git push heroku your-branch-name:main
```

**Expected output:**
```
Counting objects: 100% (X/X), done.
Delta compression using up to Y threads
Compressing objects: 100% (X/X), done.
Writing objects: 100% (X/X), done.
remote: -----> Building on the Heroku-20 stack
remote: -----> Using buildpack: heroku/nodejs
remote: -----> Node.js app detected
remote: -----> Installing dependencies
remote: -----> Building frontend...
remote: -----> Launching...
remote:        https://your-app-name.herokuapp.com/ deployed to Heroku
```

### Step 7: Check Deployment Status

```bash
# Check logs
heroku logs --tail

# Expected output:
# ═══════════════════════════════════════════════
# 🚀 Lucky Wheel Backend Server
# ═══════════════════════════════════════════════
# 📍 Port: 3000
# 🌍 Environment: production
# 🗄️  Database: ✅ Connected
# 🔐 Rate limiting: ✅ Enabled
# 🛡️  Security headers: ✅ Enabled
# 🔗 N8N Webhook: ✅ Configured
# ═══════════════════════════════════════════════

# Open app in browser
heroku open

# Check health endpoint
curl https://your-app-name.herokuapp.com/health
```

## 🔍 Troubleshooting

### Issue 1: "Application Error" after deploy

```bash
# Check logs
heroku logs --tail

# Common causes:
# - Missing environment variables
# - Supabase credentials incorrect
# - Port not set correctly (Heroku assigns PORT automatically)
```

### Issue 2: Database connection failed

```bash
# Verify Supabase credentials
heroku config:get SUPABASE_URL
heroku config:get SUPABASE_SERVICE_ROLE_KEY

# Test connection from local:
node -e "const {createClient} = require('@supabase/supabase-js'); const s = createClient('YOUR_URL', 'YOUR_KEY'); s.from('campaigns').select('*').limit(1).then(console.log)"
```

### Issue 3: Frontend not loading

```bash
# Check if dist/ folder exists
heroku run ls -la frontend/dist

# If not, rebuild frontend:
heroku run npm run build:frontend

# Or redeploy:
git commit --allow-empty -m "Rebuild frontend"
git push heroku main
```

### Issue 4: Rate limiter IPv6 warning

This warning is safe to ignore. It's a validation warning from `express-rate-limit` but doesn't affect functionality.

## 📊 Monitoring

### View Logs

```bash
# Real-time logs
heroku logs --tail

# Filter logs
heroku logs --tail | grep "SPIN"
heroku logs --tail | grep "ERROR"

# Last 1000 lines
heroku logs -n 1000
```

### Check App Status

```bash
# Dyno status
heroku ps

# App info
heroku info

# Database metrics
curl https://your-app-name.herokuapp.com/api/statistics/lucky-wheel-2025-10-14
```

## 🔄 Updating the App

```bash
# 1. Make changes to code
# 2. Commit changes
git add .
git commit -m "Your commit message"

# 3. Deploy
git push heroku main

# 4. Verify
heroku logs --tail
```

## 💰 Cost Breakdown

```
Heroku Eco Dyno:          $5/month (with your credit = FREE)
Supabase Database:        $0/month (free tier)
N8N Webhook:              $0/month (free tier)
────────────────────────────────────────────────
TOTAL:                    $5/month → FREE with credit
```

## 🆘 Support

If you encounter issues:

1. Check logs: `heroku logs --tail`
2. Verify environment variables: `heroku config`
3. Test locally first: `npm run dev`
4. Check Supabase connection: SQL Editor → Run test query

## 🔗 Useful Links

- Heroku Dashboard: https://dashboard.heroku.com/apps/your-app-name
- Supabase Dashboard: https://supabase.com/dashboard/project/zigemvynmihdhntrxzsg
- App URL: https://your-app-name.herokuapp.com
- Health Check: https://your-app-name.herokuapp.com/health

## ✅ Post-Deployment Checklist

- [ ] App is accessible at Heroku URL
- [ ] Health endpoint returns `{"status": "ok", "database": "connected"}`
- [ ] Test spin functionality (should save to Supabase)
- [ ] Check Supabase database for new spin records
- [ ] Verify N8N webhook is called (if configured)
- [ ] Test duplicate phone detection
- [ ] Check rate limiting works (try 5+ spins from same IP)
- [ ] Monitor logs for any errors

## 🎉 Success!

Your Lucky Wheel app is now live on Heroku with Supabase backend! 🚀
