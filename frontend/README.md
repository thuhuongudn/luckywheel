# 🎰 Lucky Wheel App - Vòng Quay May Mắn

Ứng dụng vòng quay may mắn với React + TypeScript, tích hợp n8n webhook và Zalo OA.

## 🚀 Tính năng

- ✅ Vòng quay may mắn với 4 mức giải thưởng: 20k, 30k, 50k, 100k
- ✅ Form nhập số điện thoại với validation
- ✅ Popup hiển thị kết quả trúng thưởng
- ✅ Tích hợp n8n webhook để xử lý backend
- ✅ Gửi mã giảm giá qua Zalo
- ✅ Responsive design - tương thích mobile
- ✅ Anti-spam: mỗi số điện thoại chỉ quay 1 lần

## 📦 Cài đặt

```bash
npm install
```

## 🛠️ Chạy Development

```bash
npm run dev
```

Server sẽ chạy tại: http://localhost:5173

## 🏗️ Build Production

```bash
npm run build
```

## 📁 Cấu trúc thư mục

```
lucky-wheel-app/
├── src/
│   ├── components/
│   │   ├── LuckyWheel.tsx      # Component vòng quay chính
│   │   └── PrizePopup.tsx      # Popup hiển thị kết quả
│   ├── services/
│   │   └── api.ts              # API service (n8n webhook)
│   ├── styles/
│   │   ├── LuckyWheel.css      # Styles cho vòng quay
│   │   └── PrizePopup.css      # Styles cho popup
│   ├── types/
│   │   └── index.ts            # TypeScript types
│   ├── App.tsx
│   └── main.tsx
└── package.json
```

## 🔧 Cấu hình

### N8N Webhook URL

File: `src/services/api.ts`

```typescript
const N8N_WEBHOOK_URL = 'https://n8n.nhathuocvietnhat.vn/webhook/lucky-wheel-2025-10-14';
```

### Giải thưởng

File: `src/components/LuckyWheel.tsx`

```typescript
const prizes: Prize[] = [
  { background: '#ffb8b8', fonts: [{ text: '20.000đ' }], value: 20000 },
  { background: '#ffd88d', fonts: [{ text: '30.000đ' }], value: 30000 },
  { background: '#b8e6b8', fonts: [{ text: '50.000đ' }], value: 50000 },
  { background: '#ffc6ff', fonts: [{ text: '100.000đ' }], value: 100000 },
];
```

## 📡 N8N Webhook

### Request Payload

```json
{
  "campaign_id": "lucky-wheel-2025-10-14",
  "phone": "0912345678",
  "prize": 50000,
  "timestamp": 1729004567890,
  "user_agent": "Mozilla/5.0..."
}
```

### Expected Response

```json
{
  "success": true,
  "message": "Mã giảm giá đã được gửi qua Zalo",
  "code": "LUCKY50K",
  "prize": 50000
}
```

## 🎯 Luồng hoạt động

1. Người dùng nhập số điện thoại → Validate
2. Bấm "Quay" → Vòng quay bắt đầu
3. Random giải thưởng → Dừng tại vị trí
4. Gửi webhook đến n8n
5. N8N xử lý: kiểm tra, tạo mã, gửi Zalo, lưu DB
6. Hiển thị popup với kết quả

## 📱 Nhúng vào Liquid (Haravan/Shopify)

```liquid
<iframe
  src="https://your-app.herokuapp.com/"
  width="100%"
  height="800"
  frameborder="0"
></iframe>
```

## 📚 Dependencies

- React 19
- TypeScript
- Vite
- @lucky-canvas/react
- axios

## 📄 License

MIT
