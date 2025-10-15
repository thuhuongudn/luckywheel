# 🔐 Lucky Wheel Backend - Secure API Proxy

Backend Node.js để bảo vệ N8N webhook khỏi spam và abuse.

## 🎯 Tại sao cần Backend?

### ❌ Vấn đề khi gọi trực tiếp N8N từ frontend:

1. **Webhook URL bị lộ** → Ai cũng có thể gọi
2. **Không authentication** → Spam dễ dàng
3. **Không rate limiting** → DDoS dễ dàng
4. **Data không validate** → Gửi dữ liệu giả
5. **Không kiểm soát được** → Tạo mã vô hạn

### ✅ Giải pháp với Backend Proxy:

1. **Ẩn N8N webhook** - URL không bao giờ lộ ra frontend
2. **HMAC signature** - Xác thực mọi request
3. **Rate limiting** - Giới hạn số request/IP
4. **Validation** - Kiểm tra dữ liệu đầy đủ
5. **Duplicate check** - Mỗi SĐT chỉ quay 1 lần
6. **IP tracking** - Chống spam theo IP

---

## 🏗️ Kiến trúc

```
┌─────────────┐
│   Frontend  │ (http://localhost:5173)
│  React + TS │
└─────┬───────┘
      │
      │ HTTPS + HMAC Signature
      │
      ▼
┌─────────────┐
│   Backend   │ (http://localhost:3000)
│  Node.js    │
│  Express    │
├─────────────┤
│ • CORS      │
│ • Rate Limit│
│ • Validate  │
│ • Dedupe    │
│ • Sign      │
└─────┬───────┘
      │
      │ Hidden Webhook
      │
      ▼
┌─────────────┐
│     N8N     │ (https://n8n.nhathuocvietnhat.vn)
│  Workflow   │
└─────────────┘
      │
      ├──► Zalo OA
      ├──► Database
      └──► Haravan API
```

---

## 📦 Cài đặt

```bash
npm install
```

## 🔧 Cấu hình

### 1. Copy .env.example

```bash
cp .env.example .env
```

### 2. Sửa .env

```bash
# Server
PORT=3000
NODE_ENV=production

# Frontend CORS
FRONTEND_URL=https://your-frontend.com

# N8N Webhook (ẨN - không cho frontend biết)
N8N_WEBHOOK_URL=https://n8n.nhathuocvietnhat.vn/webhook/lucky-wheel-2025-10-14
N8N_WEBHOOK_SECRET=your-n8n-secret-key

# Security - PHẢI ĐỔI TRONG PRODUCTION
API_SECRET=your-random-secret-key-min-32-chars
SECRET_PEPPER=your-phone-hash-pepper-min-16-chars
```

### 3. Generate secrets mạnh

```bash
# API_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# SECRET_PEPPER
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🚀 Chạy Server

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

Server sẽ chạy tại: http://localhost:3000

---

## 📡 API Endpoints

### 1. Health Check

**GET** `/health`

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": 1729004567890
}
```

---

### 2. Check Eligibility

**POST** `/api/check-eligibility`

Kiểm tra số điện thoại đã quay chưa.

**Request**:
```json
{
  "phone": "0912345678",
  "campaign_id": "lucky-wheel-2025-10-14"
}
```

**Response - Chưa quay**:
```json
{
  "success": true,
  "eligible": true,
  "message": "Bạn có thể quay",
  "phone_hash": "abc123..."
}
```

**Response - Đã quay**:
```json
{
  "success": false,
  "eligible": false,
  "message": "Bạn đã quay rồi! Vui lòng kiểm tra Zalo.",
  "already_spun": true,
  "spun_at": 1729004567890
}
```

---

### 3. Spin (Main Endpoint)

**POST** `/api/spin`

Gửi kết quả quay đến N8N.

**Request**:
```json
{
  "phone": "0912345678",
  "prize": 50000,
  "campaign_id": "lucky-wheel-2025-10-14",
  "timestamp": 1729004567890,
  "signature": "hmac_signature_here",
  "user_agent": "Mozilla/5.0..."
}
```

**Signature Generation** (Frontend):
```javascript
const CryptoJS = require('crypto-js');

const payload = {
  phone: "0912345678",
  prize: 50000,
  campaign_id: "lucky-wheel-2025-10-14"
};
const timestamp = Date.now();
const message = JSON.stringify(payload) + timestamp;
const signature = CryptoJS.HmacSHA256(message, API_SECRET).toString();
```

**Response - Success**:
```json
{
  "success": true,
  "message": "Mã giảm giá đã được gửi qua Zalo",
  "code": "LUCKY50K",
  "prize": 50000,
  "phone_masked": "091***5678"
}
```

**Response - Error**:
```json
{
  "success": false,
  "message": "Bạn đã quay rồi",
  "already_spun": true
}
```

---

## 🔐 Bảo mật

### 1. HMAC Signature

Mọi request phải có signature hợp lệ:

```
HMAC-SHA256(JSON.stringify(payload) + timestamp, API_SECRET)
```

- Signature sai → **401 Unauthorized**
- Timestamp quá cũ (> 5 phút) → **401 Unauthorized**

### 2. Rate Limiting

**Global**: 100 requests / 15 phút / IP

**Spin endpoint**: 5 requests / 1 giờ / (IP + Phone Hash)

Vượt quá → **429 Too Many Requests**

### 3. CORS

Chỉ cho phép origin từ `FRONTEND_URL` trong .env

Origin khác → **CORS Error**

### 4. Phone Hashing

```javascript
SHA256(phone + SECRET_PEPPER)
```

Không lưu số điện thoại plain text.

### 5. Duplicate Prevention

Key: `campaign_id:phone_hash`

Đã tồn tại → **400 Bad Request**

### 6. Input Validation

- Phone format: `^(0|\+84)[3|5|7|8|9][0-9]{8}$`
- Prize: Chỉ `[20000, 30000, 50000, 100000]`
- Campaign ID: Required string

---

## 🛡️ Security Headers (Helmet)

Tự động thêm các headers bảo mật:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security`

---

## 📊 Monitoring

### Logs

Server log ra console:
- Request signature invalid
- Rate limit exceeded
- N8N webhook errors
- Duplicate spin attempts

### Production

Nên thêm:
- **Winston** - Structured logging
- **Sentry** - Error tracking
- **Prometheus** - Metrics
- **Slack/Telegram** - Alerts

---

## 🚨 Error Codes

| Code | Message | Meaning |
|------|---------|---------|
| 400 | Missing required fields | Thiếu field bắt buộc |
| 400 | Invalid phone number | SĐT không đúng format |
| 400 | Invalid prize value | Prize không hợp lệ |
| 400 | Bạn đã quay rồi | Duplicate spin |
| 401 | Invalid signature | Signature sai |
| 429 | Too many requests | Rate limit vượt |
| 500 | Internal server error | Lỗi server/N8N |

---

## 🧪 Testing

### Test với curl

```bash
# Health check
curl http://localhost:3000/health

# Check eligibility
curl -X POST http://localhost:3000/api/check-eligibility \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "0912345678",
    "campaign_id": "lucky-wheel-2025-10-14"
  }'
```

### Test signature

```bash
# Get signature (dev only)
curl -X POST http://localhost:3000/api/get-signature \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "0912345678",
    "prize": 50000,
    "campaign_id": "lucky-wheel-2025-10-14"
  }'
```

---

## 📈 Deploy

### Heroku

```bash
# Login
heroku login

# Create app
heroku create lucky-wheel-backend

# Set env vars
heroku config:set NODE_ENV=production
heroku config:set FRONTEND_URL=https://your-frontend.com
heroku config:set N8N_WEBHOOK_URL=https://n8n...
heroku config:set API_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
heroku config:set SECRET_PEPPER=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

### Railway / Render

Tương tự, set env variables và deploy.

---

## ⚠️ Production Checklist

- [ ] Đổi `API_SECRET` (min 32 chars random)
- [ ] Đổi `SECRET_PEPPER` (min 16 chars random)
- [ ] Set `FRONTEND_URL` đúng domain production
- [ ] Set `N8N_WEBHOOK_URL` và `N8N_WEBHOOK_SECRET`
- [ ] Set `NODE_ENV=production`
- [ ] Tắt endpoint `/api/get-signature` trong production
- [ ] Setup logging (Winston/Sentry)
- [ ] Setup monitoring (uptime, errors)
- [ ] Load test với 1000+ concurrent requests
- [ ] Kết nối Redis/DB thật thay vì Map()
- [ ] Setup HTTPS/SSL
- [ ] Review CORS settings
- [ ] Setup rate limiting phù hợp với traffic

---

## 🔄 Upgrade từ Direct N8N

Nếu đang gọi trực tiếp N8N:

### Frontend cũ:
```typescript
// ❌ Không bảo mật
axios.post('https://n8n.../webhook/...', payload)
```

### Frontend mới:
```typescript
// ✅ Bảo mật qua Backend
import { sendSpinResult } from './services/api';
const result = await sendSpinResult(payload);
```

Backend sẽ:
1. Validate
2. Check duplicate
3. Sign request
4. Forward đến N8N (hidden)

---

## 📞 Support

- Backend repo: `/lucky-wheel-backend`
- Frontend repo: `/frontend`
- N8N workflow: See `N8N_WORKFLOW.md`

---

**🔒 Security First - Never expose N8N webhook publicly!**
