# Fix Guide - Admin Dashboard 500 Error

## 🔧 Vấn đề

Sau khi đăng nhập, admin dashboard gặp lỗi 500 khi fetch data từ Supabase:
```
Failed to load resource: the server responded with a status of 500
Error fetching spins: Object
```

## ✅ Giải pháp đã thực hiện

### 1. Thêm Backend API Endpoints

**File:** `server.js`

Đã thêm 3 admin endpoints sử dụng Service Role Key (có quyền full access):

- `GET /api/admin/spins` - Lấy danh sách tất cả spins
- `GET /api/admin/statistics` - Lấy thống kê
- `PUT /api/admin/spins/:id/status` - Update status (future use)

### 2. Cập nhật Frontend API

**File:** `frontend/src/services/adminApi.ts`

Thay đổi từ gọi trực tiếp Supabase (bị chặn bởi RLS) sang gọi backend API:

**Trước:**
```typescript
const { data, error } = await supabase
  .from('lucky_wheel_spins')
  .select('*')
```

**Sau:**
```typescript
const response = await axios.get(`${API_BASE_URL}/api/admin/spins`)
```

## 🚀 Cách khắc phục

### Bước 1: Chạy Migration (NẾU CHƯA CHẠY)

1. Truy cập [Supabase Dashboard](https://app.supabase.com)
2. Chọn project `zigemvynmihdhntrxzsg`
3. Mở **SQL Editor**
4. Copy nội dung file `supabase/06_add_status_field.sql`
5. Paste và **Run**

**Kiểm tra migration thành công:**
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'lucky_wheel_spins'
AND column_name = 'status';
```

✅ Kết quả phải có column `status` với type `text`

### Bước 2: Restart Backend Server

**Terminal 1:**
```bash
cd /Volumes/DATA/ts-web-dev/haravan-app/lucky-wheel-backend

# Stop server cũ (nếu đang chạy)
pkill -f "node.*server.js" || true

# Start server mới với endpoints mới
npm start
```

Đợi thấy:
```
✅ Server running on http://localhost:3000
🔌 Testing Supabase connection...
✅ Supabase connected successfully
```

### Bước 3: Restart Frontend

**Terminal 2:**
```bash
cd /Volumes/DATA/ts-web-dev/haravan-app/lucky-wheel-backend/frontend

# Stop frontend (Ctrl+C nếu đang chạy)
# Start lại
npm run dev
```

### Bước 4: Test Admin Dashboard

1. Mở browser: http://localhost:5173/login
2. Đăng nhập:
   - Username: `nhathuocvietnhatdn@gmail.com`
   - Password: `Vietnhat@123`
3. Kiểm tra Console (F12):
   - ✅ Không còn lỗi 500
   - ✅ Thấy logs: `📊 [ADMIN] Fetching spins for campaign...`
   - ✅ Dashboard hiển thị data

## 🔍 Debug Checklist

Nếu vẫn gặp lỗi, check theo thứ tự:

### 1. Backend Logs
```bash
# Terminal backend phải thấy:
📊 [ADMIN] Fetching spins for campaign: lucky-wheel-2025-10-14
✅ [ADMIN] Fetched X spins

# Nếu thấy lỗi:
❌ [ADMIN] Supabase error: ...
```

**→ Check:** Service Role Key trong `.env` có đúng không?

### 2. Migration Status
```sql
-- Run trong Supabase SQL Editor:
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'active') as active,
  COUNT(*) FILTER (WHERE status = 'expired') as expired,
  COUNT(*) FILTER (WHERE status = 'used') as used
FROM lucky_wheel_spins;
```

**→ Nếu lỗi:** Column `status` không tồn tại → Chạy migration lại

### 3. Function Statistics
```sql
-- Test function:
SELECT * FROM get_spin_statistics('lucky-wheel-2025-10-14');
```

**→ Nếu lỗi:** Function chưa được update → Chạy migration lại

### 4. Network Requests
Mở DevTools → Network tab:

**Requests phải thấy:**
- `GET /api/admin/spins?campaign_id=lucky-wheel-2025-10-14` → Status 200
- `GET /api/admin/statistics?campaign_id=lucky-wheel-2025-10-14` → Status 200

**Response format:**
```json
{
  "success": true,
  "data": [...]
}
```

**→ Nếu 500:** Check backend logs
**→ Nếu CORS error:** Check backend CORS config
**→ Nếu 404:** Backend chưa restart với code mới

## 🔐 Security Note

**Tại sao thay đổi approach?**

1. **Trước (Direct Supabase):**
   - Frontend dùng anon key
   - RLS policies chặn truy cập
   - Cần phải tạo complex policies

2. **Sau (Backend API):**
   - Frontend gọi backend API
   - Backend dùng service role key (full access)
   - An toàn hơn, dễ control

**Architecture:**
```
Frontend (anon key)
  ↓
Backend API (service role key)
  ↓
Supabase Database
```

## ✅ Success Indicators

Dashboard hoạt động khi:

1. ✅ Login thành công
2. ✅ Dashboard load không lỗi 500
3. ✅ Statistics cards hiển thị số liệu
4. ✅ Prize distribution có data
5. ✅ Table hiển thị danh sách spins
6. ✅ Search và filter hoạt động
7. ✅ Console không có error

## 📝 Files Changed

1. **`server.js`** - Thêm 3 admin endpoints
2. **`frontend/src/services/adminApi.ts`** - Đổi từ Supabase client sang axios

## 🎯 Next Steps

Sau khi fix xong:

1. Test đầy đủ các tính năng admin
2. Verify data accuracy
3. Test responsive design
4. Deploy to production (chạy migration trên production DB trước)

## 📞 Still Having Issues?

1. Check tất cả environment variables:
   ```bash
   # Backend
   cat .env | grep SUPABASE

   # Frontend
   cat frontend/.env | grep VITE
   ```

2. Clear browser cache và localStorage:
   ```javascript
   // Browser Console
   localStorage.clear();
   location.reload();
   ```

3. Check Supabase Dashboard → Logs để xem query nào fail

4. Enable debug logs trong backend (thêm vào server.js):
   ```javascript
   app.use((req, res, next) => {
     console.log(`${req.method} ${req.path}`);
     next();
   });
   ```

**Good luck! 🚀**
