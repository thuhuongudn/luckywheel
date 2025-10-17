# Lucky Wheel Admin Dashboard - Hướng dẫn Setup

## 📋 Tổng quan

Admin Dashboard cho phép quản lý và theo dõi các mã giảm giá từ Lucky Wheel với các tính năng:

1. ✅ Đăng nhập bảo mật với username/password
2. 📊 Thống kê tổng quan (tổng mã, active, used, expired)
3. 📈 Phân tích giá trị mã giảm giá (active/used/tiềm năng)
4. 🎯 Phân bổ mã theo giá trị giải với filter status
5. 📋 Bảng danh sách mã giảm giá với tìm kiếm và lọc

## 🔐 Thông tin đăng nhập Admin

- **URL:** `http://localhost:5173/admin` (dev) hoặc `https://your-domain.com/admin` (production)
- **Username:** `nhathuocvietnhatdn@gmail.com`
- **Password:** `Vietnhat@123`

## 🚀 Setup Instructions

### Bước 1: Chạy Migration Database

Migration này thêm field `status` vào table `lucky_wheel_spins` với 4 trạng thái:
- `active`: Mã đang hoạt động (chưa hết hạn, chưa sử dụng)
- `inactive`: Mã bị vô hiệu hóa
- `expired`: Mã đã hết hạn
- `used`: Mã đã được sử dụng

**Cách chạy migration:**

1. Truy cập [Supabase Dashboard](https://app.supabase.com)
2. Chọn project `zigemvynmihdhntrxzsg`
3. Vào **SQL Editor**
4. Copy nội dung từ file `supabase/06_add_status_field.sql`
5. Paste và click **Run**
6. Xem chi tiết trong `supabase/MIGRATION_GUIDE.md`

### Bước 2: Kiểm tra Environment Variables

File `/frontend/.env` đã được cập nhật với:

```env
VITE_SUPABASE_URL=https://zigemvynmihdhntrxzsg.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Bước 3: Cài đặt Dependencies

Dependencies đã được cài đặt:
- `react-router-dom` - Routing
- `@supabase/supabase-js` - Supabase client

```bash
cd frontend
npm install
```

### Bước 4: Chạy Development Server

```bash
# Terminal 1: Backend
npm start

# Terminal 2: Frontend
cd frontend
npm run dev
```

Truy cập:
- Lucky Wheel: `http://localhost:5173/`
- Admin Login: `http://localhost:5173/login`
- Admin Dashboard: `http://localhost:5173/admin`

## 📁 Cấu trúc Code

### Frontend Structure

```
frontend/src/
├── contexts/
│   └── AuthContext.tsx           # Authentication context
├── pages/
│   ├── Login.tsx                 # Login page
│   └── Admin.tsx                 # Admin dashboard page
├── components/
│   ├── ProtectedRoute.tsx        # Route protection
│   ├── AdminStats.tsx            # Statistics cards
│   ├── AdminTable.tsx            # Spins data table
│   └── PrizeDistribution.tsx     # Prize distribution charts
├── services/
│   ├── supabase.ts              # Supabase client
│   └── adminApi.ts              # Admin API functions
├── types/
│   └── admin.ts                 # TypeScript interfaces
└── styles/
    ├── Login.css
    ├── Admin.css
    ├── AdminStats.css
    ├── AdminTable.css
    └── PrizeDistribution.css
```

### Database Schema

**Table: `lucky_wheel_spins`**

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| campaign_id | TEXT | Campaign ID |
| customer_name | TEXT | Tên khách hàng |
| phone_plain | TEXT | Số điện thoại |
| prize | INTEGER | Giá trị giải (20000, 30000, 50000, 100000) |
| coupon_code | TEXT | Mã giảm giá |
| **status** | **TEXT** | **Trạng thái (active, inactive, expired, used)** |
| created_at | TIMESTAMPTZ | Ngày tạo |
| expires_at | TIMESTAMPTZ | Ngày hết hạn |

**Function: `get_spin_statistics(p_campaign_id)`**

Trả về thống kê chi tiết bao gồm:
- `total_spins`, `active_count`, `used_count`, `expired_count`, `inactive_count`
- `prize_20k_count`, `prize_30k_count`, `prize_50k_count`, `prize_100k_count`
- `total_prize_value`, `active_value`, `used_value`, `potential_value`

## 🎨 Tính năng Admin Dashboard

### 1. Statistics Overview (AdminStats)

Hiển thị 8 thẻ thống kê:
- 📊 Tổng số mã giảm giá
- ✅ Mã đang hoạt động (Active)
- 💰 Mã đã sử dụng (Used)
- ⏰ Mã đã hết hạn (Expired)
- 💵 Giá trị mã Active
- 💸 Giá trị mã đã dùng
- 🎯 Tiềm năng (Active + Used)
- 📈 Tổng giá trị tất cả mã

### 2. Prize Distribution (PrizeDistribution)

- Biểu đồ phân bổ mã theo giá trị giải (20k, 30k, 50k, 100k)
- Filter theo status (tất cả, active, used, expired, inactive)
- Hiển thị tỷ lệ phần trăm và số lượng
- Tổng giá trị cho từng loại giải
- Chi tiết breakdown theo status

### 3. Data Table (AdminTable)

Bảng danh sách với các tính năng:
- ✅ Hiển thị tất cả fields đã Việt hóa
- 🔍 Tìm kiếm theo tên, số điện thoại, mã giảm giá
- 🎯 Filter theo status
- 📊 Sắp xếp theo ngày tạo (mới nhất → cũ nhất)
- 🎨 Badge màu cho status
- 📱 Responsive design

**Các cột:**
1. STT
2. Tên khách hàng
3. Số điện thoại
4. Mã giảm giá
5. Giá trị (VND format)
6. Trạng thái (badge)
7. Ngày tạo
8. Ngày hết hạn

## 🔒 Security Features

1. **Protected Routes**: Admin route yêu cầu authentication
2. **Local Storage**: Auth token lưu trong localStorage
3. **RLS (Row Level Security)**: Database có RLS policies
4. **Supabase Anon Key**: Frontend chỉ dùng anon key (read-only)
5. **Password không hardcode**: Credentials trong AuthContext

## 🔄 Logic Status Update (Tương lai)

Hiện tại status được set logic phía frontend. Bước tiếp theo sẽ tạo endpoint để update status:

```typescript
// Future endpoint: PUT /api/admin/spins/:id/status
{
  "status": "used" | "inactive"
}
```

Auto-expiry logic đã được tạo trong database trigger.

## 🧪 Testing

### Test Authentication
1. Truy cập `/admin` → redirect to `/login`
2. Đăng nhập sai → hiển thị error
3. Đăng nhập đúng → redirect to `/admin`
4. Logout → redirect to `/login`

### Test Dashboard
1. Statistics cards hiển thị đúng số liệu
2. Prize distribution chart cập nhật khi thay đổi filter
3. Table filter và search hoạt động
4. Refresh button load lại data

### Test Responsive
1. Mobile view: Stats grid 1 column
2. Tablet view: Stats grid 2 columns
3. Desktop view: Stats grid 4 columns

## 📝 Notes

1. **Status Logic**: Hiện tại chưa có endpoint để update status `used`. Bước tiếp theo sẽ tích hợp với Haravan API.

2. **Real-time Updates**: Có thể thêm Supabase Realtime để auto-refresh khi có spin mới.

3. **Export Data**: Có thể thêm tính năng export CSV/Excel.

4. **Analytics**: Có thể thêm charts (Line chart, Pie chart) bằng Chart.js hoặc Recharts.

5. **Permissions**: Hiện tại chỉ có 1 admin. Có thể mở rộng với multi-admin và roles.

## 🐛 Troubleshooting

### Lỗi: "Missing Supabase environment variables"
- Check file `.env` có `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`
- Restart dev server sau khi update `.env`

### Lỗi: "Failed to fetch data"
- Check Supabase RLS policies
- Check migration đã chạy thành công
- Check network tab trong DevTools

### Lỗi: "Build failed"
- Run `npm install` để cài dependencies
- Check TypeScript errors với `npm run build`

## 📞 Support

Nếu có vấn đề, check:
1. Console logs trong browser DevTools
2. Network tab để xem API calls
3. Supabase logs trong Dashboard
4. File `supabase/MIGRATION_GUIDE.md` cho migration issues
