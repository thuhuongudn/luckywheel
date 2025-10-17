# Haravan Discount Code Integration

## 📋 Tổng quan

Tích hợp Haravan Discount Code API để tự động tạo và quản lý mã giảm giá sau khi khách hàng quay số.

**Status:** ✅ Implemented in branch `feature/haravan-integration`

---

## 🔑 Cấu hình

### Environment Variables

Thêm vào `.env`:

```env
# Haravan API Configuration
HARAVAN_AUTH_TOKEN=9AF9F109450B9CF25E41F2DB932E41685C0F3132C74C32DDF8E7D336B049C7CE
HARAVAN_COLLECTION_ID=1004564978
```

### Heroku Config

```bash
heroku config:set HARAVAN_AUTH_TOKEN=9AF9F109450B9CF25E41F2DB932E41685C0F3132C74C32DDF8E7D336B049C7CE
heroku config:set HARAVAN_COLLECTION_ID=1004564978
```

---

## 🗄️ Database Changes

### Migration: 07_add_haravan_fields.sql

**New columns added to `lucky_wheel_spins`:**

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `discount_id` | BIGINT | NULL | Haravan discount ID |
| `is_promotion` | BOOLEAN | false | Promotion status from Haravan |
| `times_used` | INTEGER | 0 | Usage count from Haravan |
| `usage_limit` | INTEGER | 1 | Usage limit (always 1) |

**Status constraint updated:**
- Removed `inactive` status
- Valid statuses: `active`, `expired`, `used`

**New function:**
```sql
calculate_haravan_status(is_promotion, times_used, usage_limit) → status
```

**New index:**
```sql
idx_spins_discount_id ON lucky_wheel_spins(discount_id)
```

---

## 📡 API Endpoints

### Base URL
```
https://apis.haravan.com
```

### Authentication
```
Authorization: Bearer {HARAVAN_AUTH_TOKEN}
Content-Type: application/json
```

---

## 🔧 Backend API Endpoints

### 1. Create Haravan Discount

**Endpoint:** `POST /api/admin/haravan/create-discount`

**Body:**
```json
{
  "spinId": "uuid-here"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "discount_id": 123456,
    "is_promotion": true,
    "times_used": 0,
    "usage_limit": 1,
    "status": "active"
  },
  "discount": {
    "discountId": 123456,
    "is_promotion": true,
    "times_used": 0,
    "usage_limit": 1,
    "code": "ABC123"
  }
}
```

**Process:**
1. Fetch spin record from database
2. Check if discount already created (`discount_id` exists)
3. Call Haravan API to create discount
4. Calculate status based on Haravan rules
5. Update spin record with Haravan data

**Haravan Request:**
```json
{
  "discount": {
    "code": "ABC123",
    "is_promotion": true,
    "applies_once": true,
    "usage_limit": 1,
    "once_per_customer": true,
    "rule_customs": [
      { "name": "customer_limit_used", "value": "1" }
    ],
    "products_selection": "collection_prerequisite",
    "entitled_collection_ids": [1004564978],
    "take_type": "fixed_amount",
    "value": 30000,
    "discount_type": "product_amount",
    "starts_at": "2025-10-17T23:14:23.660+07:00",
    "ends_at": "2025-10-24T23:34:03.187+07:00",
    "customers_selection": "all",
    "provinces_selection": "all",
    "channels_selection": "all",
    "locations_selection": "all"
  }
}
```

**Idempotency:**
- Uses `X-Idempotency-Key: {campaign_id}-{code}` header

---

### 2. Refresh Status (Batch)

**Endpoint:** `POST /api/admin/haravan/refresh-status`

**Body:** None (processes all active spins)

**Response:**
```json
{
  "success": true,
  "updated": 5,
  "results": [
    {
      "spinId": "uuid",
      "code": "ABC123",
      "oldStatus": "active",
      "newStatus": "used",
      "times_used": 1
    }
  ],
  "errors": []
}
```

**Process:**
1. Fetch all active spins with `discount_id`
2. For each spin:
   - Call Haravan GET `/com/discounts/{id}.json`
   - Calculate new status
   - Update if changed
   - Wait 100ms (rate limiting)

---

### 3. Delete Haravan Discount

**Endpoint:** `DELETE /api/admin/haravan/discount/:spinId`

**Response:**
```json
{
  "success": true,
  "message": "Discount deleted successfully"
}
```

**Process:**
1. Fetch spin record
2. Call Haravan DELETE `/com/discounts/{id}.json`
3. Clear Haravan fields in database
4. Set status to `expired`

---

## 📊 Status Calculation Rules

**Haravan-based status logic:**

```javascript
// Rule 1: Not a promotion => expired
if (is_promotion === false) return 'expired';

// Rule 2: Active promotion with available uses
if (is_promotion === true && times_used < usage_limit) return 'active';

// Rule 3: Promotion fully used
if (is_promotion === true && times_used >= usage_limit) return 'used';

// Fallback
return 'expired';
```

**Note:** Loại bỏ hoàn toàn status `inactive`

---

## 🎨 Frontend Integration

### AdminTable Enhancements

**New columns:**
- Discount ID (hiển thị nếu có)
- Haravan Status (badge)

**New action buttons per row:**
1. **Tạo Haravan** - Tạo mã giảm giá trong Haravan
   - Show when: `discount_id === null`
   - Action: Call `createHaravanDiscount(spinId)`

2. **Xóa** - Xóa mã trong Haravan
   - Show when: `discount_id !== null`
   - Action: Call `deleteHaravanDiscount(spinId)`
   - Confirm dialog

**New global button:**
- **Làm mới Status** - Batch refresh all active spins
  - Action: Call `refreshHaravanStatus()`
  - Show loading + results

---

## 🔄 Workflow

### Normal Flow

```
1. Khách hàng quay số
   ↓
2. Backend tạo record trong DB
   status = NULL initially
   ↓
3. Admin vào dashboard
   Thấy row mới, chưa có discount_id
   ↓
4. Admin click "Tạo Haravan"
   ↓
5. Backend:
   - Call Haravan API create discount
   - Save discount_id, is_promotion, times_used, usage_limit
   - Calculate status = 'active'
   ↓
6. Frontend refresh, hiển thị:
   - Badge "Active" (green)
   - Discount ID
   - Button "Xóa" thay "Tạo Haravan"
```

### Refresh Flow

```
1. Admin click "Làm mới Status" (global button)
   ↓
2. Backend:
   - Fetch all active spins with discount_id
   - For each: GET from Haravan API
   - Compare times_used, is_promotion
   - Update status if changed
   ↓
3. Frontend:
   - Show progress/loading
   - Display results: X updated
   - Refresh table automatically
```

### Delete Flow

```
1. Admin click "Xóa" on a row
   ↓
2. Confirm dialog
   ↓
3. Backend:
   - DELETE from Haravan API
   - Clear discount_id, set status='expired'
   ↓
4. Frontend:
   - Row updates to show "expired" badge
   - Button changes back to "Tạo Haravan"
```

---

## 🧪 Testing

### 1. Test Create Discount

```bash
curl -X POST http://localhost:3000/api/admin/haravan/create-discount \
  -H "Content-Type: application/json" \
  -d '{"spinId": "uuid-here"}'
```

**Expected:**
- Haravan API returns `discount.id`
- Database updates with `discount_id`, `is_promotion`, etc.
- Status calculates to `active`

### 2. Test Refresh Status

```bash
curl -X POST http://localhost:3000/api/admin/haravan/refresh-status
```

**Expected:**
- Fetches all active spins
- Calls Haravan GET for each
- Updates statuses if changed
- Returns count + results

### 3. Test Delete Discount

```bash
curl -X DELETE http://localhost:3000/api/admin/haravan/discount/{spinId}
```

**Expected:**
- Deletes from Haravan
- Clears discount_id in database
- Sets status to 'expired'

---

## ⚠️ Important Notes

### Timezone Handling

**Backend automatically adds 7 hours:**
```javascript
function addSevenHours(date) {
  const d = new Date(date);
  d.setHours(d.getHours() + 7);
  return d.toISOString().replace('Z', '+07:00');
}
```

**Example:**
```
Database: 2025-10-17T16:14:23.660Z (UTC)
Haravan: 2025-10-17T23:14:23.660+07:00 (UTC+7)
```

### Rate Limiting

**Haravan refresh có rate limiting:**
- Wait 100ms between requests
- Avoid overwhelming Haravan API
- Process sequentially, not parallel

### Error Handling

**Common errors:**

| Status | Message | Solution |
|--------|---------|----------|
| 422 | Loại khuyến mãi không hợp lệ | Check discount_type, take_type |
| 409 | Mã đã tồn tại | Use different code or idempotency key |
| 404 | Discount not found | Already deleted or invalid ID |

### Idempotency

**Prevent duplicate creation:**
- Header: `X-Idempotency-Key: {campaign_id}-{code}`
- Safe to retry if request fails
- Haravan deduplicates based on key

---

## 📝 Migration Steps

### Production Deployment

1. **Run migration:**
   ```sql
   -- In Supabase SQL Editor
   -- Copy content from: 07_add_haravan_fields.sql
   -- Run migration
   ```

2. **Verify migration:**
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'lucky_wheel_spins'
   AND column_name IN ('discount_id', 'is_promotion', 'times_used', 'usage_limit');
   ```

3. **Set Heroku config:**
   ```bash
   heroku config:set HARAVAN_AUTH_TOKEN=...
   heroku config:set HARAVAN_COLLECTION_ID=1004564978
   ```

4. **Deploy code:**
   ```bash
   git push heroku feature/haravan-integration:main
   ```

5. **Test in production:**
   - Create test spin
   - Click "Tạo Haravan"
   - Verify in Haravan dashboard
   - Test refresh status
   - Test delete

---

## 🔐 Security

**Authorization token:**
- Stored in backend `.env` only
- Never exposed to frontend
- Uses Bearer token authentication

**Database access:**
- Backend uses Service Role Key
- Frontend uses backend API only
- No direct Supabase access from frontend

**API security:**
- All Haravan calls from backend
- Rate limiting implemented
- Error handling prevents leaks

---

## 📊 Monitoring

### Logs to watch:

```
📝 [HARAVAN] Creating discount for spin: {spinId}
✅ [HARAVAN] Discount created successfully: {discountId}
🔄 [HARAVAN] Refreshing status for active spins
📊 [HARAVAN] Found X active spins to refresh
✅ [HARAVAN] Refreshed X spins
🗑️  [HARAVAN] Deleting discount for spin: {spinId}
✅ [HARAVAN] Discount deleted
❌ [HARAVAN] Error: {message}
```

### Metrics:

- Total discounts created
- Active vs used vs expired ratio
- Refresh batch size
- Error rate
- API response time

---

## 🎯 Future Enhancements

1. **Auto-create on spin**
   - Automatically create Haravan discount when spin occurs
   - No manual admin action needed

2. **Scheduled refresh**
   - Cron job to refresh status every hour
   - Keep statuses up-to-date automatically

3. **Webhook integration**
   - Haravan webhook when discount is used
   - Real-time status updates

4. **Bulk operations**
   - Create multiple discounts at once
   - Bulk delete expired discounts

5. **Analytics**
   - Track conversion rate (created vs used)
   - Average time to use
   - Most popular prize values

---

**Implementation Date:** October 17, 2025
**Branch:** `feature/haravan-integration`
**Status:** ✅ Ready for testing
