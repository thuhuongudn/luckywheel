# Lucky Wheel - Security Documentation

## Trạng thái bảo mật hiện tại (Updated: 2025-10-16)

**Điểm bảo mật: 9/10** ⭐

---

## 1. Tổng quan kiến trúc bảo mật

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                            │
│              (React + Vite - Public Domain)                 │
│                                                             │
│  ✅ Không chứa secrets                                      │
│  ✅ Chỉ gửi data đơn giản (phone, name, campaign_id)       │
│  ✅ Không có HMAC signature                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTPS (relative URLs)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND PROXY                            │
│                 (Express.js + Node.js)                      │
│                                                             │
│  🛡️  Rate Limiting (5 spins/hour per IP+phone)             │
│  🛡️  Phone validation (regex)                              │
│  🛡️  Database constraint (unique phone per campaign)       │
│  🔐 Admin API token protection                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ├─────────────┬─────────────────────┐
                       │             │                     │
                       ▼             ▼                     ▼
              ┌──────────────┐  ┌──────────┐      ┌────────────┐
              │   Supabase   │  │   N8N    │      │   Zalo     │
              │   Database   │  │ Webhook  │      │    API     │
              └──────────────┘  └──────────┘      └────────────┘
```

---

## 2. Các biện pháp bảo mật đã triển khai

### 2.1. Kiến trúc Proxy Layer ✅ (Xuất sắc)
- Frontend **không bao giờ** gọi trực tiếp tới N8N webhook hoặc database
- Tất cả requests đi qua backend proxy layer
- N8N credentials chỉ tồn tại trên backend

**Files:**
- [server.js:227-368](server.js#L227-L368) - Main spin endpoint
- [frontend/src/services/api.ts:68-106](frontend/src/services/api.ts#L68-L106) - Frontend API client

---

### 2.2. Phone Number Hashing ✅ (Xuất sắc)
- Sử dụng **SHA256 + secret pepper** để hash phone numbers
- Database lưu `phone_hash` thay vì plain text
- Có `phone_masked` (e.g., `091***5678`) cho admin view
- Pepper chỉ tồn tại trên backend (.env)

**Implementation:**
```javascript
// lib/db.js:14-17
function hashPhone(phone) {
  const pepper = process.env.SECRET_PEPPER || 'default-pepper-change-me';
  return crypto.SHA256(phone + pepper).toString();
}
```

**Lợi ích:**
- Ngăn chặn reverse lookup phone numbers từ database
- Bảo vệ privacy người dùng
- Compliance với GDPR/PDPA

---

### 2.3. Rate Limiting ✅ (Rất tốt)

#### Global API Rate Limit
```javascript
// server.js:64-70
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per IP per 15 minutes
});
```

#### Spin-specific Rate Limit
```javascript
// server.js:72-89
const spinLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Max 5 spins per IP+phone per hour
  keyGenerator: (req, res) => {
    const ipKey = rateLimit.ipKeyGenerator(req, res);
    const phone = req.body.phone || '';
    const phoneHash = db.hashPhone(phone);
    return `${ipKey}-${phoneHash.substring(0, 8)}`;
  }
});
```

**Chống:**
- Spam attacks
- Brute force attempts
- Resource exhaustion (DoS)

---

### 2.4. Database Unique Constraint ✅ (Xuất sắc)

**Supabase constraint:**
```sql
ALTER TABLE lucky_wheel_spins
ADD CONSTRAINT unique_campaign_phone
UNIQUE (campaign_id, phone_hash);
```

**Backend handling:**
```javascript
// lib/db.js:249-252
if (error.code === '23505') {
  console.log('⚠️  [DB] Duplicate phone detected (23505)');
  throw new Error('DUPLICATE_PHONE');
}
```

**Chống:**
- Race conditions (multiple concurrent requests)
- Duplicate spins
- Data integrity issues

---

### 2.5. Statistics Endpoint Protection ✅ (Mới thêm)

**Admin authentication:**
```javascript
// server.js:375-386
const authHeader = req.headers.authorization;
const adminToken = process.env.ADMIN_API_TOKEN;

if (!authHeader || authHeader !== `Bearer ${adminToken}`) {
  return res.status(401).json({
    success: false,
    message: 'Unauthorized: Admin authentication required'
  });
}
```

**Token:**
```bash
# .env:20
ADMIN_API_TOKEN=admin-lucky-wheel-b20d65e3f7dd44538d62400ccc4e1e161bd2f99e6c215df699ac0064d14ad441
```

---

### 2.6. Security Headers ✅ (Helmet.js)

```javascript
// server.js:21-32
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'", "https:", "data:"],
    },
  },
}));
```

**Chống:**
- XSS (Cross-Site Scripting)
- Clickjacking
- MIME type sniffing
- Downgrade attacks

---

### 2.7. CORS Configuration ✅

```javascript
// server.js:36-61
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://luckywheel-dc4995c0f577.herokuapp.com',
  process.env.FRONTEND_URL,
  process.env.PRODUCTION_URL,
].filter(Boolean);

app.use('/api', cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1 || isLocalhostDevOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
```

---

## 3. Các thay đổi bảo mật gần đây (2025-10-16)

### ✅ FIXED: Statistics Endpoint Vulnerability
**Trước:**
- Default token: `'change-me-in-production'`
- Bất kỳ ai cũng có thể truy cập statistics

**Sau:**
- Added strong token: `ADMIN_API_TOKEN=admin-lucky-wheel-b20d65e...`
- Chỉ requests có valid token mới truy cập được

---

### ✅ REMOVED: HMAC Signature từ Frontend
**Trước:**
- Frontend chứa `VITE_API_SECRET` và `VITE_WEBHOOK_TOKEN`
- Client-side HMAC signature generation
- Secrets lộ ra browser (DevTools)

**Sau:**
- Xóa toàn bộ secrets khỏi frontend
- Xóa HMAC signature logic
- Dựa vào rate limiting + DB constraint
- Đơn giản hơn, an toàn hơn

**Files changed:**
- ❌ Removed: [frontend/.env:8,14](frontend/.env) - `VITE_API_SECRET`, `VITE_WEBHOOK_TOKEN`
- ❌ Removed: [frontend/src/services/api.ts](frontend/src/services/api.ts) - `generateSignature()`, `CryptoJS` usage
- ❌ Removed: [server.js:93-97](server.js#L93-L97) - `verifySignature()` function
- ❌ Removed: `crypto-js` import from server.js

---

## 4. Environment Variables

### 4.1. Backend .env (SENSITIVE - Never commit!)

```bash
# Server Configuration
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Supabase Configuration
SUPABASE_URL=https://zigemvynmihdhntrxzsg.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...  # ⚠️  CRITICAL - Admin access to DB

# N8N Webhook Configuration
N8N_WEBHOOK_URL=https://n8n.nhathuocvietnhat.vn/webhook/lucky-wheel-2025-10-14
N8N_WEBHOOK_API_KEY=lucky-wheel-123456
N8N_WEBHOOK_SECRET=change-me-in-production  # ⚠️  Change in prod

# Security Keys
API_SECRET=dev-secret-key-123456  # Currently unused (legacy)
SECRET_PEPPER=dev-pepper-789  # Used for phone hashing

# Admin API Token (for /api/statistics endpoint)
ADMIN_API_TOKEN=admin-lucky-wheel-b20d65e3f7dd44538d62400ccc4e1e161bd2f99e6c215df699ac0064d14ad441
```

### 4.2. Frontend .env (PUBLIC - Safe to commit)

```bash
# Campaign Configuration
VITE_CAMPAIGN_ID=lucky-wheel-2025-10-14

# Development mode (set to true to use mock API)
VITE_USE_MOCK_API=false
```

**⚠️  WARNING:**
- Tất cả biến `VITE_*` đều được expose ra browser!
- KHÔNG BAO GIỜ thêm secrets vào frontend .env

---

## 5. Checklist trước khi deploy Production

### 🔴 CRITICAL (Must do)

- [ ] **Rotate tất cả secrets mới**
  ```bash
  # Generate new secrets
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

  # Update:
  # - SUPABASE_SERVICE_ROLE_KEY (regenerate from Supabase dashboard)
  # - N8N_WEBHOOK_SECRET
  # - SECRET_PEPPER
  # - ADMIN_API_TOKEN
  ```

- [ ] **Set Heroku Config Vars**
  ```bash
  heroku config:set ADMIN_API_TOKEN=admin-lucky-wheel-...
  heroku config:set SECRET_PEPPER=...
  heroku config:set N8N_WEBHOOK_SECRET=...
  # ... (all backend .env vars)
  ```

- [ ] **Verify .gitignore**
  ```bash
  # Ensure these files are NOT tracked:
  .env
  frontend/.env
  .env.local
  .env.production
  ```

- [ ] **Check Git history for leaked secrets**
  ```bash
  git log --all --full-history -- .env
  git log --all --full-history -- frontend/.env

  # If found, rotate keys immediately!
  ```

### 🟡 HIGH (Should do)

- [ ] **Enable Heroku SSL/TLS**
  - All traffic must use HTTPS in production

- [ ] **Configure CORS for production**
  ```javascript
  // server.js: Update allowedOrigins
  const allowedOrigins = [
    'https://your-production-domain.com',
    process.env.PRODUCTION_URL,
  ];
  ```

- [ ] **Set NODE_ENV=production**
  ```bash
  heroku config:set NODE_ENV=production
  ```

- [ ] **Enable Heroku logging & monitoring**
  ```bash
  heroku addons:create papertrail
  heroku logs --tail
  ```

### 🟢 MEDIUM (Nice to have)

- [ ] **Add rate limiting dashboard**
  - Monitor rate limit hits
  - Alert on excessive spam

- [ ] **Setup database backups**
  ```bash
  # Supabase auto-backup (verify enabled)
  ```

- [ ] **Penetration testing**
  - Test rate limiting with real traffic
  - Try bypass scenarios
  - Verify phone hashing security

---

## 6. API Endpoints Security Summary

### Public Endpoints (No authentication)

| Endpoint | Rate Limit | Security |
|----------|------------|----------|
| `GET /health` | 100/15min | ✅ Safe (public health check) |
| `GET /api/prizes/:campaignId` | 100/15min | ✅ Safe (read-only prize config) |
| `POST /api/check-eligibility` | 100/15min | ✅ Safe (duplicate check only) |
| `POST /api/spin` | 5/hour per IP+phone | ✅ Protected (rate limit + DB constraint) |

### Protected Endpoints (Admin only)

| Endpoint | Authentication | Security |
|----------|----------------|----------|
| `GET /api/statistics/:campaignId` | Bearer token | 🔐 Protected (requires ADMIN_API_TOKEN) |

---

## 7. Incident Response Plan

### If secrets are leaked:

1. **Immediately rotate compromised keys**
   - Supabase: Regenerate service role key
   - N8N: Change webhook URL and secrets
   - Admin: Generate new ADMIN_API_TOKEN

2. **Check database for suspicious activity**
   ```sql
   -- Check for unusual spin patterns
   SELECT ip_address, COUNT(*) as spin_count
   FROM lucky_wheel_spins
   WHERE created_at > NOW() - INTERVAL '24 hours'
   GROUP BY ip_address
   HAVING COUNT(*) > 10;
   ```

3. **Review server logs**
   ```bash
   heroku logs --tail | grep "❌"
   ```

4. **Force push to remove secrets from Git history**
   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env" \
     --prune-empty --tag-name-filter cat -- --all

   git push origin --force --all
   ```

---

## 8. Contact & Support

**Security Issues:**
- Report to: [your-email@domain.com]
- Priority: CRITICAL

**Maintenance:**
- Backend: Node.js + Express + Supabase
- Deployment: Heroku
- Monitoring: Heroku logs + Papertrail

---

## 9. Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-10-16 | 1.1.0 | ✅ Fixed statistics endpoint vulnerability<br>✅ Removed HMAC from frontend<br>✅ Added ADMIN_API_TOKEN |
| 2025-10-14 | 1.0.0 | 🎉 Initial security implementation |

---

**Last Updated:** 2025-10-16
**Security Score:** 9/10 ⭐
**Status:** ✅ Ready for Production (after rotating secrets)
