# Migration Fixed - Hướng dẫn chạy Migration đúng

## ❌ Lỗi gặp phải

```
ERROR: 42710: trigger "trigger_check_expiry_before_update" for relation "lucky_wheel_spins" already exists
```

## ✅ Đã fix

Migration đã được cập nhật để xử lý trường hợp chạy lại (idempotent).

## 🚀 Cách chạy Migration (2 phương án)

### Phương án 1: File mới (RECOMMENDED) - An toàn 100%

**File:** `supabase/06_add_status_field_SAFE.sql`

Đây là phiên bản **SAFE** - có thể chạy nhiều lần mà không lỗi:
- ✅ Tự động skip nếu column đã tồn tại
- ✅ Tự động drop trigger cũ trước khi tạo mới
- ✅ Có thông báo chi tiết từng bước
- ✅ Verification cuối cùng

**Các bước:**
1. Mở [Supabase Dashboard](https://app.supabase.com)
2. Chọn project → SQL Editor
3. Copy toàn bộ nội dung từ `06_add_status_field_SAFE.sql`
4. Paste và click **Run**
5. Xem messages/notices để verify thành công

### Phương án 2: File gốc (đã fix)

**File:** `supabase/06_add_status_field.sql`

Đã được fix ở dòng 75:
```sql
-- Drop trigger if exists before creating
DROP TRIGGER IF EXISTS trigger_check_expiry_before_update ON lucky_wheel_spins;
```

Giờ có thể chạy lại mà không lỗi.

## 📋 Verification sau khi chạy

### 1. Kiểm tra column status
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'lucky_wheel_spins'
AND column_name = 'status';
```

**Expected:** 1 row với `column_name = 'status'`

### 2. Kiểm tra data
```sql
SELECT
  status,
  COUNT(*) as count
FROM lucky_wheel_spins
GROUP BY status
ORDER BY status;
```

**Expected:** Thấy các status: active, expired (hoặc null nếu data cũ chưa update)

### 3. Kiểm tra indexes
```sql
SELECT indexname
FROM pg_indexes
WHERE tablename = 'lucky_wheel_spins'
AND indexname LIKE '%status%';
```

**Expected:** Thấy 2 indexes:
- `idx_spins_status`
- `idx_spins_campaign_status`

### 4. Kiểm tra trigger
```sql
SELECT tgname, tgtype, tgenabled
FROM pg_trigger
WHERE tgrelid = 'lucky_wheel_spins'::regclass
AND tgname = 'trigger_check_expiry_before_update';
```

**Expected:** 1 row với trigger name

### 5. Test function statistics
```sql
SELECT * FROM get_spin_statistics('lucky-wheel-2025-10-14');
```

**Expected:** 1 row với tất cả các fields:
- total_spins
- active_count, expired_count, used_count, inactive_count
- prize counts (20k, 30k, 50k, 100k)
- value fields (total, active, used, potential)

## 🐛 Nếu vẫn gặp lỗi

### Lỗi: "constraint already exists"
```sql
-- Drop constraint trước
ALTER TABLE lucky_wheel_spins
DROP CONSTRAINT IF EXISTS lucky_wheel_spins_status_check;

-- Sau đó chạy lại migration
```

### Lỗi: "function does not exist"
```sql
-- Xóa function cũ
DROP FUNCTION IF EXISTS get_spin_statistics(TEXT);

-- Sau đó chạy lại migration
```

### Lỗi: "permission denied"
Đảm bảo bạn đang dùng tài khoản admin trong Supabase Dashboard.

### Reset hoàn toàn (EXTREME - chỉ khi cần)
```sql
-- Xóa tất cả objects liên quan
DROP TRIGGER IF EXISTS trigger_check_expiry_before_update ON lucky_wheel_spins;
DROP FUNCTION IF EXISTS check_expiry_on_read();
DROP FUNCTION IF EXISTS auto_update_expired_status();
DROP FUNCTION IF EXISTS get_spin_statistics(TEXT);
DROP INDEX IF EXISTS idx_spins_status;
DROP INDEX IF EXISTS idx_spins_campaign_status;

-- Xóa column (CẨN THẬN - sẽ mất data status)
-- ALTER TABLE lucky_wheel_spins DROP COLUMN IF EXISTS status;

-- Sau đó chạy lại migration từ đầu
```

## ✅ Success Checklist

- [ ] Migration chạy không lỗi
- [ ] Column `status` xuất hiện trong table
- [ ] 2 indexes được tạo
- [ ] 3 functions được tạo
- [ ] Trigger được tạo
- [ ] Existing data có status (active/expired)
- [ ] Function `get_spin_statistics()` trả về data đúng

## 📝 Các thay đổi trong migration

### Version 1.1 → 1.2 (SAFE version)

**Improvements:**
1. ✅ Added `DROP TRIGGER IF EXISTS` before creating trigger
2. ✅ Better error handling với DO blocks
3. ✅ Detailed RAISE NOTICE messages
4. ✅ Verification step at the end
5. ✅ Safe constraint creation with exception handling
6. ✅ Grant permissions to both authenticated and service_role

## 🚀 Tiếp theo

Sau khi migration thành công:

1. **Restart Backend:**
   ```bash
   cd /Volumes/DATA/ts-web-dev/haravan-app/lucky-wheel-backend
   npm start
   ```

2. **Restart Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Test Admin Dashboard:**
   - Truy cập: http://localhost:5173/login
   - Login và verify data hiển thị đúng

## 💡 Tips

- Dùng **SAFE version** nếu không chắc chắn
- Migration có thể chạy nhiều lần an toàn
- Backup database trước khi chạy migration quan trọng (production)
- Check logs/notices trong SQL Editor để debug

---

**File locations:**
- Safe version: `supabase/06_add_status_field_SAFE.sql` ⭐ RECOMMENDED
- Fixed original: `supabase/06_add_status_field.sql`
- This guide: `MIGRATION_FIXED.md`
