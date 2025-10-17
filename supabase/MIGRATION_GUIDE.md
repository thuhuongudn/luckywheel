# Migration Guide: Add Status Field

## Bước 1: Truy cập Supabase Dashboard

1. Đăng nhập vào [Supabase Dashboard](https://app.supabase.com)
2. Chọn project: `zigemvynmihdhntrxzsg`
3. Vào menu **SQL Editor** ở sidebar bên trái

## Bước 2: Chạy Migration

1. Tạo một SQL query mới
2. Copy toàn bộ nội dung từ file `06_add_status_field.sql`
3. Paste vào SQL Editor
4. Click **Run** để thực thi

## Bước 3: Kiểm tra kết quả

Sau khi migration chạy thành công, kiểm tra:

```sql
-- Kiểm tra column status đã được thêm
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'lucky_wheel_spins'
AND column_name = 'status';

-- Kiểm tra dữ liệu
SELECT status, COUNT(*) as count
FROM lucky_wheel_spins
GROUP BY status;
```

## Bước 4: Verify Function

Kiểm tra function đã được cập nhật:

```sql
-- Test statistics function
SELECT * FROM get_spin_statistics('lucky-wheel-2025-10-14');
```

Kết quả sẽ bao gồm các trường mới:
- `active_count`
- `inactive_count`
- `expired_count`
- `used_count`
- `active_value`
- `used_value`
- `potential_value`

## Troubleshooting

### Lỗi: Column already exists
Nếu gặp lỗi "column already exists", có nghĩa migration đã chạy trước đó. Skip bước này.

### Lỗi: Function already exists
Sử dụng `CREATE OR REPLACE FUNCTION` để cập nhật function.

### Kiểm tra RLS Policies
Đảm bảo RLS policies cho phép admin đọc dữ liệu:

```sql
SELECT * FROM pg_policies WHERE tablename = 'lucky_wheel_spins';
```

## Migration Checklist

- [ ] Column `status` đã được thêm vào `lucky_wheel_spins`
- [ ] Indexes đã được tạo (`idx_spins_status`, `idx_spins_campaign_status`)
- [ ] Function `get_spin_statistics` đã được cập nhật
- [ ] Function `auto_update_expired_status` đã được tạo
- [ ] Trigger `trigger_check_expiry_before_update` đã được tạo
- [ ] Dữ liệu hiện tại đã được cập nhật status (active/expired)
