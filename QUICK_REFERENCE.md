# 🚀 Quick Reference Card - Lucky Wheel Security

## ⚡ TL;DR - Những gì bạn CẦN BIẾT

### ✅ Đã fix xong
1. Statistics endpoint bây giờ yêu cầu `ADMIN_API_TOKEN`
2. Frontend không còn chứa secrets
3. HMAC signature đã được loại bỏ (đơn giản hơn, an toàn hơn)

### ⚠️ Trước khi deploy Heroku
```bash
# BẮT BUỘC: Set Config Var này
heroku config:set ADMIN_API_TOKEN=admin-lucky-wheel-b20d65e3f7dd44538d62400ccc4e1e161bd2f99e6c215df699ac0064d14ad441
```

---

## 🔑 ADMIN_API_TOKEN

### Token hiện tại (Development)
```
admin-lucky-wheel-b20d65e3f7dd44538d62400ccc4e1e161bd2f99e6c215df699ac0064d14ad441
```

### Sử dụng
```bash
# Get campaign statistics
curl -H "Authorization: Bearer admin-lucky-wheel-b20d65e3f7dd44538d62400ccc4e1e161bd2f99e6c215df699ac0064d14ad441" \
  https://luckywheel-dc4995c0f577.herokuapp.com/api/statistics/lucky-wheel-2025-10-14
```

### Lưu trữ
- ✅ Local: `.env` file (line 20)
- ✅ Heroku: Config Vars (set manually)
- ❌ KHÔNG commit lên Git!

---

## 📦 Files Changed

| File | Action |
|------|--------|
| `.env` | ✅ Added `ADMIN_API_TOKEN` |
| `frontend/.env` | ❌ Removed `VITE_API_SECRET`, `VITE_WEBHOOK_TOKEN` |
| `frontend/src/services/api.ts` | ♻️ Removed HMAC logic |
| `server.js` | ♻️ Removed signature verification |

---

## 🧪 Test Commands

```bash
# Start server
npm start

# Test health
curl http://localhost:3000/health

# Test statistics (should FAIL without token)
curl http://localhost:3000/api/statistics/lucky-wheel-2025-10-14

# Test statistics (should SUCCESS with token)
curl -H "Authorization: Bearer admin-lucky-wheel-b20d65e3f7dd44538d62400ccc4e1e161bd2f99e6c215df699ac0064d14ad441" \
  http://localhost:3000/api/statistics/lucky-wheel-2025-10-14
```

---

## 🚀 Deploy to Heroku

```bash
# 1. Set Config Vars
heroku config:set ADMIN_API_TOKEN=admin-lucky-wheel-b20d65e3f7dd44538d62400ccc4e1e161bd2f99e6c215df699ac0064d14ad441
heroku config:set SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
heroku config:set N8N_WEBHOOK_URL=https://n8n.nhathuocvietnhat.vn/webhook/lucky-wheel-2025-10-14
# (See HEROKU_DEPLOYMENT.md for complete list)

# 2. Deploy
git push heroku main

# 3. Verify
curl https://luckywheel-dc4995c0f577.herokuapp.com/health
```

---

## 📚 Documentation

- **Security details:** [SECURITY.md](SECURITY.md)
- **Heroku deployment:** [HEROKU_DEPLOYMENT.md](HEROKU_DEPLOYMENT.md)
- **Changes summary:** [SECURITY_CHANGES.md](SECURITY_CHANGES.md)

---

## 🆘 Emergency Contacts

**If something breaks:**
1. Check logs: `heroku logs --tail`
2. Verify config: `heroku config`
3. Rollback: `heroku rollback`

**Common issues:**
- "Unauthorized" error → Check `ADMIN_API_TOKEN` is set on Heroku
- Database error → Check `SUPABASE_SERVICE_ROLE_KEY`
- N8N not working → Check `N8N_WEBHOOK_URL` and `N8N_WEBHOOK_API_KEY`

---

**Last Updated:** 2025-10-16
**Version:** 1.1.0
**Status:** ✅ Production Ready
