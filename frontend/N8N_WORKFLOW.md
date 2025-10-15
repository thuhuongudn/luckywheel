# 🔄 N8N Workflow Configuration

## Tổng quan Workflow

Workflow xử lý vòng quay may mắn với các bước:

1. **Webhook In** - Nhận request từ widget
2. **Validate** - Kiểm tra dữ liệu đầu vào
3. **Anti-Fraud Check** - Chống gian lận
4. **Check Eligibility** - Kiểm tra đủ điều kiện
5. **Reserve Code** - Rút mã từ code pool
6. **Create/Activate Discount** - Tạo mã giảm giá (nếu cần)
7. **Send Zalo** - Gửi mã qua Zalo OA/ZNS
8. **Update Database** - Lưu log
9. **Response** - Trả về kết quả

---

## Chi tiết các Node

### 1. Webhook Node

**Type**: Webhook
**Method**: POST
**Path**: `/webhook/lucky-wheel-2025-10-14`

**Request Body Example**:
```json
{
  "campaign_id": "lucky-wheel-2025-10-14",
  "phone": "0912345678",
  "prize": 50000,
  "timestamp": 1729004567890,
  "user_agent": "Mozilla/5.0..."
}
```

---

### 2. Validate Data Node

**Type**: Function
**Code**:

```javascript
// Validate phone number
const phone = $input.item.json.phone;
const phoneRegex = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/;

if (!phone || !phoneRegex.test(phone)) {
  throw new Error('Invalid phone number');
}

// Validate prize
const validPrizes = [20000, 30000, 50000, 100000];
const prize = $input.item.json.prize;

if (!validPrizes.includes(prize)) {
  throw new Error('Invalid prize value');
}

// Hash phone number (with pepper for security)
const crypto = require('crypto');
const pepper = 'your-secret-pepper-2025'; // Store in env
const phoneHash = crypto
  .createHash('sha256')
  .update(phone + pepper)
  .digest('hex');

return {
  ...($input.item.json),
  phone_hash: phoneHash,
  phone_masked: phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1***$3')
};
```

---

### 3. Check Database - Already Spun?

**Type**: Supabase / PostgreSQL Query

**Query**:
```sql
SELECT * FROM spin_entries
WHERE campaign_id = '{{ $json.campaign_id }}'
  AND phone_hash = '{{ $json.phone_hash }}'
LIMIT 1;
```

**If Found**: Return error "Bạn đã quay rồi"
**If Not Found**: Continue to next node

---

### 4. Anti-Fraud Check

**Type**: Function

```javascript
// Rate limit by IP
const ip = $input.item.json.ip || 'unknown';
const cacheKey = `rate_limit:${ip}`;

// Check Redis/Cache
const rateLimitCount = await $redis.get(cacheKey);

if (rateLimitCount && parseInt(rateLimitCount) > 5) {
  throw new Error('Too many requests from this IP');
}

// Increment counter
await $redis.set(cacheKey, (parseInt(rateLimitCount) || 0) + 1, 'EX', 3600);

return $input.item.json;
```

---

### 5. Reserve Code from Pool

**Type**: PostgreSQL Query with Transaction

**Query**:
```sql
WITH selected_code AS (
  SELECT code, prize
  FROM coupon_pool
  WHERE prize = {{ $json.prize }}
    AND status = 'available'
    AND campaign_id = '{{ $json.campaign_id }}'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
UPDATE coupon_pool
SET status = 'reserved',
    reserved_at = NOW(),
    phone_hash = '{{ $json.phone_hash }}'
WHERE code = (SELECT code FROM selected_code)
RETURNING *;
```

**Fallback**: Nếu hết mã mệnh giá này, chọn mệnh giá thấp hơn

---

### 6. Create Discount on Haravan/Shopify (Optional)

**Type**: HTTP Request

**Method**: POST
**URL**: `https://your-shop.myharavan.com/admin/discount_codes.json`

**Headers**:
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer YOUR_ACCESS_TOKEN"
}
```

**Body**:
```json
{
  "discount_code": {
    "code": "{{ $json.code }}",
    "value": {{ $json.prize }},
    "value_type": "fixed_amount",
    "usage_limit": 1,
    "applies_to_resource": "collection",
    "entitled_collection_ids": [123456],
    "starts_at": "{{ $now }}",
    "ends_at": "{{ $now + 7days }}",
    "minimum_order_value": 0
  }
}
```

---

### 7. Send Zalo OA/ZNS

**Type**: HTTP Request

**Method**: POST
**URL**: `https://openapi.zalo.me/v3.0/oa/message/cs`

**Headers**:
```json
{
  "Content-Type": "application/json",
  "access_token": "YOUR_ZALO_ACCESS_TOKEN"
}
```

**Body** (ZNS Template):
```json
{
  "recipient": {
    "phone": "{{ $json.phone }}"
  },
  "message": {
    "template_id": "YOUR_TEMPLATE_ID",
    "template_data": {
      "code": "{{ $json.code }}",
      "value": "{{ $json.prize / 1000 }}K",
      "expiry": "7 ngày"
    }
  }
}
```

**Response Handling**:
- Success: Continue
- Failed: Retry 3 times with exponential backoff
- Still failed: Send to dead-letter queue

---

### 8. Update Database - Save Entry

**Type**: Supabase / PostgreSQL Insert

**Query**:
```sql
INSERT INTO spin_entries (
  campaign_id,
  phone_hash,
  phone_masked,
  prize,
  code,
  status,
  zalo_status,
  ip,
  user_agent,
  created_at,
  updated_at
) VALUES (
  '{{ $json.campaign_id }}',
  '{{ $json.phone_hash }}',
  '{{ $json.phone_masked }}',
  {{ $json.prize }},
  '{{ $json.code }}',
  'sent',
  '{{ $json.zalo_response.status }}',
  '{{ $json.ip }}',
  '{{ $json.user_agent }}',
  NOW(),
  NOW()
)
RETURNING *;
```

---

### 9. Response to Widget

**Type**: Respond to Webhook

**Status Code**: 200

**Headers**:
```json
{
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
}
```

**Body**:
```json
{
  "success": true,
  "message": "Mã giảm giá đã được gửi qua Zalo",
  "code": "{{ $json.code }}",
  "prize": {{ $json.prize }}
}
```

---

## Error Handling

### Node: Error Handler

**Triggered on**: Any node error

**Actions**:
1. Log error to database
2. Send alert to Slack/Telegram
3. Return user-friendly error

**Response**:
```json
{
  "success": false,
  "message": "Có lỗi xảy ra. Vui lòng thử lại sau.",
  "error_code": "{{ $node.error.code }}"
}
```

---

## Database Schema

### Table: `spin_entries`

```sql
CREATE TABLE spin_entries (
  id SERIAL PRIMARY KEY,
  campaign_id VARCHAR(100) NOT NULL,
  phone_hash VARCHAR(64) NOT NULL,
  phone_masked VARCHAR(15),
  prize INTEGER NOT NULL,
  code VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',
  zalo_status VARCHAR(20),
  zalo_message_id VARCHAR(100),
  ip VARCHAR(45),
  user_agent TEXT,
  device_fingerprint VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(campaign_id, phone_hash)
);

CREATE INDEX idx_campaign_phone ON spin_entries(campaign_id, phone_hash);
CREATE INDEX idx_created_at ON spin_entries(created_at);
```

### Table: `coupon_pool`

```sql
CREATE TABLE coupon_pool (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  prize INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'available',
  campaign_id VARCHAR(100) NOT NULL,
  phone_hash VARCHAR(64),
  reserved_at TIMESTAMP,
  sent_at TIMESTAMP,
  redeemed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_status_prize (status, prize),
  INDEX idx_campaign_code (campaign_id, code)
);
```

---

## Monitoring & Alerts

### Slack Alert Node

**Triggered when**:
- Code pool < 10 for any prize level
- Zalo send failed > 5 times in 10 minutes
- Unusual spike in requests

**Message Template**:
```
⚠️ *Lucky Wheel Alert*

Campaign: {{ $json.campaign_id }}
Issue: {{ $json.alert_type }}
Details: {{ $json.details }}
Time: {{ $now }}

Action required: {{ $json.action }}
```

---

## Testing Workflow

### Test Data

```json
{
  "campaign_id": "lucky-wheel-2025-10-14",
  "phone": "0912345678",
  "prize": 50000,
  "timestamp": 1729004567890,
  "user_agent": "Mozilla/5.0",
  "ip": "123.45.67.89"
}
```

### Expected Flow

1. ✅ Validate pass
2. ✅ Not found in DB
3. ✅ Anti-fraud pass
4. ✅ Code reserved
5. ✅ Zalo sent
6. ✅ DB updated
7. ✅ Response 200

---

## Production Checklist

- [ ] Enable authentication/HMAC signature
- [ ] Set up proper error handling
- [ ] Configure retry logic
- [ ] Enable logging
- [ ] Set up monitoring alerts
- [ ] Test with real Zalo OA
- [ ] Verify Haravan API integration
- [ ] Load test with 100+ concurrent requests
- [ ] Set up backup workflow
- [ ] Document all endpoints
