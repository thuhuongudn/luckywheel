# Quick Start - Lucky Wheel Admin

## 🚀 Khởi chạy nhanh trong 3 bước

### Bước 1: Chạy Migration Database (5 phút)

1. **Mở Supabase Dashboard:**
   - Truy cập: https://app.supabase.com
   - Login với account
   - Chọn project: `zigemvynmihdhntrxzsg`

2. **Chạy Migration SQL:**
   - Click menu **SQL Editor** ở sidebar trái
   - Click **New Query**
   - Mở file: `supabase/06_add_status_field.sql`
   - Copy TOÀN BỘ nội dung
   - Paste vào SQL Editor
   - Click **Run** (hoặc Ctrl/Cmd + Enter)

3. **Kiểm tra thành công:**
   ```sql
   -- Copy và run query này để verify:
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'lucky_wheel_spins'
   AND column_name = 'status';
   ```

   ✅ Kết quả: Sẽ thấy column `status` với type `text`

---

### Bước 2: Khởi động Backend + Frontend (2 phút)

**Terminal 1 - Backend:**
```bash
cd /Volumes/DATA/ts-web-dev/haravan-app/lucky-wheel-backend
npm start
```
Đợi thấy: `✅ Server running on http://localhost:3000`

**Terminal 2 - Frontend:**
```bash
cd /Volumes/DATA/ts-web-dev/haravan-app/lucky-wheel-backend/frontend
npm run dev
```
Đợi thấy: `Local: http://localhost:5173/`

---

### Bước 3: Truy cập Admin Dashboard (1 phút)

1. **Mở browser:** http://localhost:5173/login

2. **Đăng nhập với credentials:**
   - **Username:** `nhathuocvietnhatdn@gmail.com`
   - **Password:** `Vietnhat@123`
   - Click **Đăng nhập**

3. **Tự động redirect đến:** http://localhost:5173/admin

✅ **Hoàn tất!** Bạn sẽ thấy Admin Dashboard với đầy đủ thống kê.

---

## 🎯 What You'll See

### Login Page
- Form đăng nhập với medical blue theme
- Error message nếu sai credentials

### Admin Dashboard
- **8 thẻ thống kê:**
  - Tổng mã, Active, Used, Expired
  - Giá trị Active, Used, Tiềm năng, Tổng

- **Prize Distribution:**
  - 4 loại giải: 20k, 30k, 50k, 100k
  - Filter theo status
  - Progress bars visual

- **Data Table:**
  - List tất cả mã giảm giá
  - Search và filter
  - Vietnamese format

---

## 🔧 Troubleshooting

### Lỗi 1: "Missing Supabase environment variables"
**Nguyên nhân:** File .env chưa có Supabase keys

**Giải pháp:**
```bash
# Check file này có đúng không:
cat frontend/.env | grep VITE_SUPABASE

# Phải thấy:
VITE_SUPABASE_URL=https://zigemvynmihdhntrxzsg.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

Nếu thiếu, thêm vào `frontend/.env`:
```env
VITE_SUPABASE_URL=https://zigemvynmihdhntrxzsg.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppZ2VtdnlubWloZGhudHJ4enNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MTIyMzcsImV4cCI6MjA3NjA4ODIzN30.LB49ozSksrj-dyoiU0WjiszfEwMwXILnYAUvFT3-9Ss
```

### Lỗi 2: Migration SQL fail
**Nguyên nhân:** Column đã tồn tại từ trước

**Giải pháp:** Skip lỗi này, column đã được thêm rồi. Chỉ cần verify:
```sql
SELECT status, COUNT(*) FROM lucky_wheel_spins GROUP BY status;
```

### Lỗi 3: "Failed to fetch data"
**Nguyên nhân:** RLS policies chưa được setup

**Giải pháp:** Run query này trong SQL Editor:
```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'lucky_wheel_spins';

-- Nếu không thấy policy "Service role has full access", run migration lại
```

### Lỗi 4: Login không hoạt động
**Nguyên nhân:** Credentials sai hoặc AuthContext chưa load

**Giải pháp:**
1. Clear localStorage: `localStorage.clear()` trong Console
2. Hard refresh: Cmd/Ctrl + Shift + R
3. Check credentials chính xác:
   - Username: `nhathuocvietnhatdn@gmail.com`
   - Password: `Vietnhat@123`

### Lỗi 5: Blank page sau login
**Nguyên nhân:** Data fetch fail

**Giải pháp:**
1. Mở DevTools → Console tab
2. Xem error message
3. Check Network tab → Filter: Fetch/XHR
4. Xem response từ Supabase

Most common: Migration chưa chạy → Run Bước 1 lại

---

## 📋 Checklist

Trước khi bắt đầu:
- [ ] Node.js đã cài (v18+)
- [ ] npm dependencies đã install
- [ ] Supabase project đã có data (spins table)
- [ ] Backend `.env` có đầy đủ keys
- [ ] Frontend `.env` có Supabase anon key

Sau khi setup:
- [ ] Migration chạy thành công
- [ ] Backend running trên port 3000
- [ ] Frontend running trên port 5173
- [ ] Login page hiển thị
- [ ] Đăng nhập thành công
- [ ] Admin dashboard show data
- [ ] Statistics cards hiển thị
- [ ] Prize distribution hoạt động
- [ ] Table có data và filter hoạt động

---

## 🎓 Learn More

- **Full Setup Guide:** `ADMIN_SETUP.md`
- **Implementation Details:** `IMPLEMENTATION_SUMMARY.md`
- **UI Preview:** `ADMIN_UI_PREVIEW.md`
- **Migration Guide:** `supabase/MIGRATION_GUIDE.md`

---

## 📞 Support

Nếu vẫn gặp lỗi:
1. Check Console logs (F12 → Console)
2. Check Network tab (F12 → Network)
3. Review migration logs trong Supabase
4. Verify environment variables
5. Clear cache và restart servers

**Common Commands:**
```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild frontend
npm run build

# Check environment
env | grep VITE
```

---

## ✅ Success Indicators

Bạn đã setup thành công khi:

1. ✅ Login page load không lỗi
2. ✅ Đăng nhập thành công redirect to `/admin`
3. ✅ Dashboard hiển thị 8 stat cards
4. ✅ Prize distribution có 4 cards với progress bars
5. ✅ Table hiển thị data với Vietnamese headers
6. ✅ Search và filter hoạt động
7. ✅ Refresh button reload data mới
8. ✅ Logout redirect về `/login`

**Congratulations! 🎉 Admin Dashboard ready to use!**
