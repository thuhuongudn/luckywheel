# Heroku Deployment Guide - Lucky Wheel

## Câu trả lời cho câu hỏi của bạn

### ✅ CÓ, bạn CẦN config `ADMIN_API_TOKEN` lên Heroku Config Vars

**Lý do:**
- File `.env` chỉ tồn tại trên local development
- Heroku KHÔNG đọc file `.env` khi deploy
- Heroku sử dụng **Config Vars** để lưu environment variables
- Nếu không set, `ADMIN_API_TOKEN` sẽ là `undefined`, và statistics endpoint sẽ fail

---

## 1. Heroku Config Vars cần thiết

### Critical (Bắt buộc phải có)

```bash
# Admin API Token (for statistics endpoint)
heroku config:set ADMIN_API_TOKEN=admin-lucky-wheel-b20d65e3f7dd44538d62400ccc4e1e161bd2f99e6c215df699ac0064d14ad441

# Supabase Database
heroku config:set SUPABASE_URL=https://zigemvynmihdhntrxzsg.supabase.co
heroku config:set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# N8N Webhook
heroku config:set N8N_WEBHOOK_URL=https://n8n.nhathuocvietnhat.vn/webhook/lucky-wheel-2025-10-14
heroku config:set N8N_WEBHOOK_API_KEY=lucky-wheel-123456
heroku config:set N8N_WEBHOOK_SECRET=change-me-in-production

# Security Keys
heroku config:set SECRET_PEPPER=dev-pepper-789

# Server Config
heroku config:set NODE_ENV=production
heroku config:set FRONTEND_URL=https://luckywheel-dc4995c0f577.herokuapp.com
```

### Optional (Tùy chỉnh)

```bash
# Production domain (if different from Heroku domain)
heroku config:set PRODUCTION_URL=https://your-custom-domain.com
```

---

## 2. Cách set Heroku Config Vars

### Option A: Heroku CLI (Recommended)

```bash
# Login to Heroku
heroku login

# List current config vars
heroku config

# Set một biến
heroku config:set ADMIN_API_TOKEN=admin-lucky-wheel-...

# Set nhiều biến cùng lúc
heroku config:set \
  ADMIN_API_TOKEN=admin-lucky-wheel-... \
  SECRET_PEPPER=your-secret-pepper \
  NODE_ENV=production

# Verify
heroku config:get ADMIN_API_TOKEN

# Delete một biến (nếu cần)
heroku config:unset ADMIN_API_TOKEN
```

### Option B: Heroku Dashboard (Web UI)

1. Mở: https://dashboard.heroku.com/apps/luckywheel-dc4995c0f577
2. Click tab **Settings**
3. Scroll xuống **Config Vars**
4. Click **Reveal Config Vars**
5. Add từng biến:
   - KEY: `ADMIN_API_TOKEN`
   - VALUE: `admin-lucky-wheel-b20d65e3f7dd44538d62400ccc4e1e161bd2f99e6c215df699ac0064d14ad441`
6. Click **Add**

---

## 3. Deployment Steps

### Step 1: Verify local changes

```bash
cd /path/to/lucky-wheel-backend

# Test locally
npm start

# Verify endpoints
curl http://localhost:3000/health
```

### Step 2: Commit changes

```bash
# Check status
git status

# Add files
git add .

# Commit
git commit -m "Security: Remove HMAC from frontend, add ADMIN_API_TOKEN"

# Push to GitHub (if using)
git push origin main
```

### Step 3: Deploy to Heroku

```bash
# Deploy
git push heroku main

# Or if using GitHub integration:
# Just push to GitHub, Heroku will auto-deploy
```

### Step 4: Set Config Vars (IMPORTANT!)

```bash
# Set all required config vars
heroku config:set ADMIN_API_TOKEN=admin-lucky-wheel-b20d65e3f7dd44538d62400ccc4e1e161bd2f99e6c215df699ac0064d14ad441

# (Set other vars as listed above)
```

### Step 5: Verify deployment

```bash
# Check app status
heroku ps

# Check logs
heroku logs --tail

# Test endpoints
curl https://luckywheel-dc4995c0f577.herokuapp.com/health
```

### Step 6: Test statistics endpoint

```bash
# Should FAIL without token
curl https://luckywheel-dc4995c0f577.herokuapp.com/api/statistics/lucky-wheel-2025-10-14

# Should FAIL with wrong token
curl -H "Authorization: Bearer change-me-in-production" \
  https://luckywheel-dc4995c0f577.herokuapp.com/api/statistics/lucky-wheel-2025-10-14

# Should SUCCEED with correct token
curl -H "Authorization: Bearer admin-lucky-wheel-b20d65e3f7dd44538d62400ccc4e1e161bd2f99e6c215df699ac0064d14ad441" \
  https://luckywheel-dc4995c0f577.herokuapp.com/api/statistics/lucky-wheel-2025-10-14
```

---

## 4. Troubleshooting

### Problem: Statistics endpoint returns 401 Unauthorized

**Cause:** `ADMIN_API_TOKEN` chưa được set trên Heroku

**Solution:**
```bash
heroku config:set ADMIN_API_TOKEN=admin-lucky-wheel-b20d65e3f7dd44538d62400ccc4e1e161bd2f99e6c215df699ac0064d14ad441

# Verify
heroku config:get ADMIN_API_TOKEN

# Restart app
heroku restart
```

---

### Problem: Database connection failed

**Cause:** `SUPABASE_SERVICE_ROLE_KEY` chưa set hoặc sai

**Solution:**
```bash
# Check current value
heroku config:get SUPABASE_SERVICE_ROLE_KEY

# Update if needed
heroku config:set SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

---

### Problem: N8N webhook not working

**Cause:** N8N config vars chưa set

**Solution:**
```bash
heroku config:set N8N_WEBHOOK_URL=https://n8n.nhathuocvietnhat.vn/webhook/lucky-wheel-2025-10-14
heroku config:set N8N_WEBHOOK_API_KEY=lucky-wheel-123456
heroku config:set N8N_WEBHOOK_SECRET=your-secret
```

---

### Problem: App crashes on startup

**Check logs:**
```bash
heroku logs --tail

# Look for errors like:
# - Missing environment variables
# - Database connection failed
# - Port binding issues
```

---

## 5. Security Checklist ✅

Trước khi deploy production:

- [ ] **Set ADMIN_API_TOKEN trên Heroku Config Vars**
- [ ] **Set tất cả required config vars** (listed above)
- [ ] **Verify .env không bị commit lên Git**
  ```bash
  git log --all -- .env
  # Should return empty
  ```
- [ ] **Test statistics endpoint với token mới**
- [ ] **Test spin endpoint (rate limiting + duplicate prevention)**
- [ ] **Verify CORS configuration cho production domain**
- [ ] **Enable Heroku SSL (HTTPS only)**
- [ ] **Setup monitoring/alerts** (Papertrail hoặc Sentry)

---

## 6. Useful Heroku Commands

```bash
# View app info
heroku info

# View config vars
heroku config

# View logs (real-time)
heroku logs --tail

# View logs (last 500 lines)
heroku logs -n 500

# Restart app
heroku restart

# Run bash on Heroku dyno
heroku run bash

# View database stats (if using Heroku Postgres)
heroku pg:info

# Scale dynos
heroku ps:scale web=1

# Open app in browser
heroku open

# Check app status
heroku ps
```

---

## 7. Environment Variables Mapping

| Local (.env) | Heroku Config Var | Required? |
|--------------|-------------------|-----------|
| `ADMIN_API_TOKEN` | `ADMIN_API_TOKEN` | ✅ Yes |
| `SUPABASE_URL` | `SUPABASE_URL` | ✅ Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes |
| `N8N_WEBHOOK_URL` | `N8N_WEBHOOK_URL` | ✅ Yes |
| `N8N_WEBHOOK_API_KEY` | `N8N_WEBHOOK_API_KEY` | ✅ Yes |
| `N8N_WEBHOOK_SECRET` | `N8N_WEBHOOK_SECRET` | ✅ Yes |
| `SECRET_PEPPER` | `SECRET_PEPPER` | ✅ Yes |
| `NODE_ENV` | `NODE_ENV` | ✅ Yes (set to "production") |
| `FRONTEND_URL` | `FRONTEND_URL` | ⚠️  Optional |
| `PRODUCTION_URL` | `PRODUCTION_URL` | ⚠️  Optional |
| `PORT` | `PORT` | ❌ No (Heroku sets automatically) |

**Note:** Heroku tự động set `PORT` environment variable, không cần set manually.

---

## 8. Quick Deploy Script

Tạo file `deploy.sh` để tự động deploy:

```bash
#!/bin/bash

echo "🚀 Starting deployment to Heroku..."

# Build frontend
echo "📦 Building frontend..."
cd frontend
npm run build
cd ..

# Commit changes
echo "📝 Committing changes..."
git add .
git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M:%S')"

# Push to Heroku
echo "🔼 Pushing to Heroku..."
git push heroku main

# Verify deployment
echo "✅ Verifying deployment..."
sleep 5
curl -s https://luckywheel-dc4995c0f577.herokuapp.com/health | jq

echo "🎉 Deployment complete!"
```

```bash
# Make executable
chmod +x deploy.sh

# Run
./deploy.sh
```

---

## 9. Rollback (Nếu cần)

```bash
# View releases
heroku releases

# Rollback to previous release
heroku rollback

# Rollback to specific version
heroku rollback v123
```

---

**Last Updated:** 2025-10-16
**Heroku App:** https://luckywheel-dc4995c0f577.herokuapp.com
