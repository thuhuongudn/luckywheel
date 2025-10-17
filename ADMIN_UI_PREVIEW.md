# Lucky Wheel Admin UI Preview

## 🖥️ Login Page (`/login`)

```
┌─────────────────────────────────────────────────┐
│                                                 │
│           [Medical Blue Background]            │
│                                                 │
│    ┌──────────────────────────────────┐       │
│    │                                  │       │
│    │     🎯 Đăng nhập Admin           │       │
│    │     Lucky Wheel Dashboard        │       │
│    │                                  │       │
│    │  Email/Tên đăng nhập             │       │
│    │  [________________________]      │       │
│    │                                  │       │
│    │  Mật khẩu                        │       │
│    │  [________________________]      │       │
│    │                                  │       │
│    │  [    Đăng nhập    ] (Blue btn) │       │
│    │                                  │       │
│    └──────────────────────────────────┘       │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Features:**
- Gradient blue background (#007AFF → #0051D5)
- White card với shadow
- Clean input fields
- Error message hiển thị nếu login fail
- Auto-redirect to `/admin` khi success

---

## 📊 Admin Dashboard (`/admin`)

### Header (Sticky)
```
┌─────────────────────────────────────────────────────────────┐
│  🎯 Lucky Wheel Admin Dashboard     [🔄 Làm mới] [Đăng xuất] │
└─────────────────────────────────────────────────────────────┘
```

### Section 1: Statistics Overview
```
┌──────────────────── Thống kê tổng quan ────────────────────┐
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ 📊       │  │ ✅       │  │ 💰       │  │ ⏰       │  │
│  │ Tổng mã  │  │ Active   │  │ Đã dùng  │  │ Hết hạn  │  │
│  │  1,234   │  │   456    │  │   123    │  │   89     │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ 💵       │  │ 💸       │  │ 🎯       │  │ 📈       │  │
│  │ Giá trị  │  │ Đã dùng  │  │ Tiềm năng│  │ Tổng GT  │  │
│  │ Active   │  │          │  │          │  │          │  │
│  │ 15M VND  │  │  5M VND  │  │ 20M VND  │  │ 35M VND  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Card Colors:**
- Tổng mã: Purple gradient (#667eea → #764ba2)
- Active: Green gradient (#56ab2f → #a8e063)
- Đã dùng: Pink gradient (#f093fb → #f5576c)
- Hết hạn: Orange gradient (#ffecd2 → #fcb69f)
- Giá trị cards: White với colored left border

### Section 2: Prize Distribution
```
┌──────────── Phân bổ mã theo giá trị giải ──────────────────┐
│                                      [Filter: Tất cả ▼]    │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │ 20,000đ     │  │ 30,000đ     │  │ 50,000đ     │       │
│  │      450 mã │  │      320 mã │  │      180 mã │       │
│  │ ▓▓▓▓▓▓░░░░  │  │ ▓▓▓▓░░░░░░  │  │ ▓▓░░░░░░░░  │       │
│  │ 45% | 9M đ  │  │ 32% | 9.6M │  │ 18% | 9M đ  │       │
│  │             │  │             │  │             │       │
│  │ • Active:200│  │ • Active:150│  │ • Active:80 │       │
│  │ • Used: 100 │  │ • Used: 70  │  │ • Used: 50  │       │
│  │ • Expired:50│  │ • Expired:40│  │ • Expired:30│       │
│  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                             │
│  ┌─────────────┐                                           │
│  │ 100,000đ    │                                           │
│  │       50 mã │                                           │
│  │ ▓░░░░░░░░░  │                                           │
│  │ 5% | 5M đ   │                                           │
│  │             │                                           │
│  │ • Active:26 │                                           │
│  │ • Used: 3   │                                           │
│  │ • Expired:1 │                                           │
│  └─────────────┘                                           │
│                                                             │
│  Tổng số mã (tất cả): 1000                                │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- 4 prize cards (20k, 30k, 50k, 100k)
- Filter dropdown: Tất cả, Active, Used, Expired, Inactive
- Progress bar showing percentage
- Total value per prize
- Status breakdown với colored dots

### Section 3: Data Table
```
┌──────────────── Danh sách mã giảm giá ─────────────────────┐
│                                                             │
│  [🔍 Tìm kiếm...     ]  [Trạng thái: Tất cả ▼]            │
│                                                             │
│  Hiển thị 1000 / 1000 mã giảm giá                          │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │STT│Tên KH   │SĐT       │Mã    │Giá trị │Status│Ngày...│ │
│  ├───┼─────────┼──────────┼──────┼────────┼──────┼───────┤ │
│  │ 1 │Nguyễn A │0912345678│ABC123│20,000đ │Active│18/01..│ │
│  │ 2 │Trần B   │0987654321│XYZ789│30,000đ │Used  │18/01..│ │
│  │ 3 │Lê C     │0901234567│DEF456│50,000đ │Expired│17/01.│ │
│  │...│...      │...       │...   │...     │...   │...    │ │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Table Features:**
- Search box: Tìm theo tên, SĐT, mã
- Filter dropdown: Status
- 8 columns với header Việt hóa:
  1. STT (auto-number)
  2. Tên khách hàng
  3. Số điện thoại
  4. Mã giảm giá (monospace font, blue)
  5. Giá trị (VND format, red)
  6. Trạng thái (colored badge)
  7. Ngày tạo (DD/MM/YYYY HH:mm)
  8. Ngày hết hạn (DD/MM/YYYY HH:mm)
- Sort: Mới nhất → Cũ nhất (default)
- Hover effect on rows

**Status Badges:**
- 🟢 Active (green background)
- 🔴 Used (purple background)
- 🟠 Expired (orange background)
- ⚪ Inactive (gray background)

---

## 📱 Responsive Design

### Mobile (< 768px)
```
┌─────────────────────┐
│ Lucky Wheel Admin   │
│ [🔄] [Logout]       │
├─────────────────────┤
│                     │
│ ┌─────────────────┐ │
│ │ 📊 Tổng mã      │ │
│ │     1,234       │ │
│ └─────────────────┘ │
│                     │
│ ┌─────────────────┐ │
│ │ ✅ Active       │ │
│ │      456        │ │
│ └─────────────────┘ │
│                     │
│ (Single column)     │
│                     │
│ ┌─────────────────┐ │
│ │ 20,000đ         │ │
│ │ 450 mã          │ │
│ │ ▓▓▓▓▓▓░░        │ │
│ └─────────────────┘ │
│                     │
│ [Search box]        │
│ [Filter dropdown]   │
│                     │
│ ┌─────────────────┐ │
│ │ Scrollable      │ │
│ │ Table           │ │
│ └─────────────────┘ │
│                     │
└─────────────────────┘
```

### Tablet (768px - 1024px)
- 2 columns grid for stats
- 2 columns for prize cards
- Full table with horizontal scroll

### Desktop (> 1024px)
- 4 columns grid for stats
- 4 columns for prize cards (or 3 if needed)
- Full table, no scroll

---

## 🎨 Color Palette

### Primary Colors
- **Blue Primary:** `#007AFF`
- **Blue Dark:** `#0051D5`
- **White:** `#FFFFFF`
- **Background:** `#f5f7fa`

### Status Colors
- **Active (Green):** `#56ab2f` to `#a8e063`
- **Used (Pink/Purple):** `#f093fb` to `#f5576c`
- **Expired (Orange):** `#ffecd2` to `#fcb69f`
- **Inactive (Gray):** `#e0e0e0` / `#616161`

### Gradients
```css
/* Total */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Active */
background: linear-gradient(135deg, #56ab2f 0%, #a8e063 100%);

/* Used */
background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);

/* Expired */
background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
```

---

## 🔄 Interactions

### Buttons
- **Làm mới:** Blue background, hover darker
- **Đăng xuất:** Light gray background, hover darker
- **Login:** Blue gradient, hover effect + scale

### Cards
- Hover: `translateY(-2px)` + shadow increase
- Transition: 0.2s ease

### Table
- Row hover: Light gray background
- Clickable elements: Pointer cursor

### Filters
- Dropdown focus: Blue border
- Search input focus: Blue border

---

## 📊 Data Display Examples

### Vietnamese Currency Format
```
20,000₫  → 20.000 ₫
30,000₫  → 30.000 ₫
50,000₫  → 50.000 ₫
100,000₫ → 100.000 ₫
```

### Vietnamese Date Format
```
2025-10-17T10:30:00Z → 17/10/2025 10:30
```

### Percentage Format
```
45% of total
32.5% distribution
```

---

## 🚀 Loading States

### Initial Load
```
┌─────────────────────────────┐
│                             │
│         ⏳                  │
│    Đang tải dữ liệu...      │
│                             │
└─────────────────────────────┘
```

### Error State
```
┌─────────────────────────────┐
│                             │
│         ❌                  │
│  Không thể tải dữ liệu      │
│  [Thử lại]                  │
│                             │
└─────────────────────────────┘
```

### Empty State (Table)
```
┌─────────────────────────────┐
│                             │
│    📭 Không có dữ liệu      │
│                             │
└─────────────────────────────┘
```

---

## ✨ Animations

- **Card hover:** Lift up 2px
- **Button click:** Scale 0.98
- **Page transition:** Fade in
- **Data refresh:** Spinner rotation
- **Progress bar:** Smooth width transition
- **Badge pulse:** Gentle for active status

---

## 🎯 Key UI Principles

1. **Clean & Modern:** Minimalist design, no clutter
2. **Medical Blue Theme:** Professional healthcare brand
3. **Vietnamese First:** All labels in Vietnamese
4. **Mobile Responsive:** Works on all devices
5. **Accessible:** Good contrast, readable fonts
6. **Fast Feedback:** Immediate visual response to actions
7. **Data Dense:** Show max info without overwhelming

---

## 📸 Screenshots Checklist

Khi test UI, kiểm tra:
- [ ] Login page hiển thị đúng
- [ ] Admin header sticky khi scroll
- [ ] 8 stat cards hiển thị đúng màu
- [ ] Prize distribution cards với progress bar
- [ ] Filter dropdown hoạt động
- [ ] Table với Vietnamese headers
- [ ] Status badges đúng màu
- [ ] Search box hoạt động
- [ ] Responsive trên mobile
- [ ] Hover effects smooth
- [ ] Loading spinner khi fetch data
- [ ] Error state khi mất kết nối
