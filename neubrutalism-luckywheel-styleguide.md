# 🎨 Bộ Tiêu Chuẩn Thiết Kế Neo-brutalism Cho Giao Diện Lucky Wheel  

> **Mục tiêu:** Xây dựng guideline đầy đủ (màu sắc, typography, viền, bo góc, shadow, tone & microinteraction) để đội dev có thể triển khai nhanh phong cách **Neo-brutalism** vui tươi – rõ ràng – tương phản cao – thân thiện cho giao diện **Lucky Wheel** (vòng quay may mắn).  

---

## 🧭 1. Triết Lý Thiết Kế

Neo-brutalism cho Lucky Wheel = **“Thô – Vui – Nổi”**  
Kế thừa tinh thần thẳng thắn, khối rõ, viền dày của Brutalism, nhưng **pha màu pop-art và độ bo mềm** để phù hợp giao diện trò chơi.

**Mục tiêu cảm xúc:**  
- Gợi cảm giác “may mắn – vui – bất ngờ”  
- Dễ đọc, dễ click, phản hồi trực quan  
- Tránh cảm giác lạnh, thô kỹ thuật

---

## 🎨 2. Màu Sắc (Color Palette)

| Mục đích | Tên màu | HEX | Ghi chú |
|-----------|----------|-----|---------|
| **Nền chính** | Soft White | `#F9F9F9` | Giữ nhẹ để màu rực nổi bật |
| **Text & viền chính** | Deep Black | `#111111` | Dùng cho border, heading, icon |
| **Màu nhấn 1 (CTA)** | Neo Lime | `#A8FF60` | Cho nút “Quay ngay” |
| **Màu nhấn 2 (Win state)** | Hot Coral | `#FF4D4F` | Cho kết quả “Trúng thưởng” |
| **Màu phụ** | Cyber Blue | `#00E5A8` | Cho label, hover, icon vui |
| **Màu clash accent** | Sun Yellow | `#FFD93D` | Dùng nhẹ cho wheel sectors |
| **Shadow đen** | Offset Black | `#000000` @ 100% | Không blur, chỉ offset |

🧩 **Tỉ lệ đề xuất:**  
70% nền trung tính + 20% màu nhấn (lime, coral, blue) + 10% clash (yellow).

---

## 🖋️ 3. Font Chữ (Typography System)

| Phân loại | Font | Cỡ chữ | Ghi chú |
|------------|-------|----------|----------|
| **Heading (H1, H2)** | `Space Grotesk` hoặc `Satoshi` | H1: 48–64px / H2: 32–40px | Bold 700, chữ hoa, spacing 0.02em |
| **Body text** | `Inter` hoặc `Manrope` | 16–18px | Medium 500, line-height 1.6 |
| **Button / Label** | `Poppins ExtraBold` | 16–20px | All caps, strong weight |
| **Number (Wheel Sectors)** | `Clash Display` hoặc `DM Sans` | 18–24px | Bold, tracking 0.03em |

🔤 **Tone chữ:** to, đậm, dứt khoát – tránh serif hoặc handwritten.

---

## ⬛ 4. Viền & Bo Góc (Border & Radius)

| Thành phần | Độ dày viền | Màu viền | Bo góc | Ghi chú |
|-------------|--------------|----------|--------|----------|
| **Wheel** | 4px | `#111111` | 12px | Viền dày tạo cảm giác nổi khối |
| **Button chính** | 3px | `#111111` | 8px | Bo nhẹ để thân thiện hơn |
| **Popup kết quả** | 3px | `#111111` | 10px | Kết hợp shadow lệch |
| **Card/Section** | 2px | `#111111` | 6px | Padding lớn, border đều |

🪞 **Quy tắc:**  
> Viền **đều, đậm, rõ**, bo **vừa đủ mềm**, luôn dùng cùng màu text chính (#111).

---

## 🧱 5. Shadow & Hiệu Ứng Nổi (Offset Shadow)

- **Kiểu:** không blur, **offset rõ ràng**.  
- **Công thức chung:**  
```

box-shadow: 6px 6px 0 0 #111111;

```
- **Hover:** dịch chuyển ngược hướng shadow:  
```

transform: translate(-2px, -2px);
box-shadow: 8px 8px 0 0 #111111;

````
- **Active (click):** shadow thu nhỏ 2–3px; tạo cảm giác “nút bị nhấn xuống”.

---

## 🎛️ 6. Component Tokens

### 🎯 Button
```css
.nb-btn {
background: #A8FF60;
color: #111;
border: 3px solid #111;
border-radius: 8px;
font-weight: 700;
padding: 14px 20px;
box-shadow: 6px 6px 0 0 #111;
transition: transform .05s linear, box-shadow .05s linear;
}
.nb-btn:hover {
transform: translate(-2px, -2px);
box-shadow: 8px 8px 0 0 #111;
}
.nb-btn:active {
transform: translate(2px, 2px);
box-shadow: 3px 3px 0 0 #111;
}
````

### 🌀 Wheel Sector

```css
.wheel-sector {
  border: 4px solid #111;
  border-radius: 12px;
  background: var(--sector-color);
  box-shadow: 6px 6px 0 0 #111;
}
```

### 💬 Result Popup

```css
.result-card {
  background: #FFF;
  border: 3px solid #111;
  border-radius: 10px;
  padding: 24px;
  box-shadow: 8px 8px 0 0 #111;
}
```

---

## 🧩 7. Interaction & Motion

| Hành động        | Hiệu ứng                                   | Mô tả                |
| ---------------- | ------------------------------------------ | -------------------- |
| **Hover button** | Dịch 2px lên + shadow lệch xa hơn          | Gợi cảm giác nổi bật |
| **Click button** | Shadow nhỏ lại + rung nhẹ (keyframe 0.05s) | Cảm giác vật lý “ấn” |
| **Wheel quay**   | Rotation ease-out cubic (1.8–2s)           | Dừng mượt, dứt khoát |
| **Kết quả hiện** | Fade-in + scale 1.05 → 1                   | Tạo moment “Wow”     |

---

## 💡 8. Icon & Sticker

* **Kiểu:** outline đen 2–3px, doodle hoặc emoji vui 🎉💥⭐
* **Tông:** pop-art, cartoon, đơn giản, không gradient.
* **Nên dùng SVG nét dày**, tránh icon mảnh hoặc hiệu ứng 3D.

---

## ⚖️ 9. Accessibility & Contrast

| Thành phần               | Tương phản khuyến nghị       | Mô tả        |
| ------------------------ | ---------------------------- | ------------ |
| Text đen trên nền trắng  | ≥ 12.5:1                     | Đạt AAA      |
| Text đen trên lime/coral | ≥ 7:1                        | Đạt AA       |
| Button lime/đen          | ≥ 8:1                        | Tốt          |
| Text trên neon           | Giảm bão hòa 10–15% nếu chói | Giữ readable |

---

## 🧱 10. Tone Thị Giác Tổng Thể

* **Cảm xúc:** vui tươi – retro – “bật lên khỏi nền”.
* **Không khí:** như một game arcade 2D, phẳng nhưng có chiều sâu.
* **Tính thương hiệu:** giữ độ nhất quán border, font, shadow trên toàn hệ thống.

---

## 📦 11. Token Tổng Hợp (Tailwind Style Reference)

```css
:root {
  --nb-black: #111;
  --nb-white: #F9F9F9;
  --nb-lime: #A8FF60;
  --nb-coral: #FF4D4F;
  --nb-blue: #00E5A8;
  --nb-yellow: #FFD93D;
  --nb-border: 3px solid var(--nb-black);
  --nb-radius: 8px;
  --nb-shadow: 6px 6px 0 0 var(--nb-black);
}
```

| Token           | Tailwind tương đương           |
| --------------- | ------------------------------ |
| Border          | `border-[3px] border-black`    |
| Shadow          | `shadow-[6px_6px_0_0_#111]`    |
| Radius          | `rounded-md` hoặc `rounded-lg` |
| Font            | `font-satoshi font-bold`       |
| Background lime | `bg-[#A8FF60]`                 |
| Text            | `text-[#111111]`               |

---

## 🧭 12. Tóm Tắt Quy Chuẩn “Neo-brutalism for Lucky Wheel”

| Hạng mục      | Quy chuẩn               | Ghi chú                       |
| ------------- | ----------------------- | ----------------------------- |
| **Màu nền**   | Trắng/xám nhạt          | Tạo độ tương phản mạnh        |
| **Màu nhấn**  | Lime, Coral, Blue       | Dùng cho CTA & wheel          |
| **Font**      | Grotesk đậm, sans-serif | Dễ đọc, mạnh mẽ               |
| **Border**    | 3–4px đen, đều          | Nhất quán toàn UI             |
| **Shadow**    | Offset, không blur      | Tạo hiệu ứng “khối nổi”       |
| **Bo góc**    | 6–12px                  | Giữ vui và thân thiện         |
| **Icon**      | Doodle/emoji outline    | Hơi “vui trẻ con” có chủ đích |
| **UX Motion** | Ngắn, bật tắt nhanh     | Cảm giác “ấn thật”            |

---

## ✅ 13. Mẫu Tổng Hợp Demo Màu (tham khảo)

| Màu       | Mục đích     | HEX       | Preview                                                         |
| --------- | ------------ | --------- | --------------------------------------------------------------- |
| 🟩 Lime   | CTA          | `#A8FF60` | ![#A8FF60](https://via.placeholder.com/20/A8FF60/000000?text=+) |
| 🟥 Coral  | Trúng thưởng | `#FF4D4F` | ![#FF4D4F](https://via.placeholder.com/20/FF4D4F/000000?text=+) |
| 🟦 Blue   | Accent phụ   | `#00E5A8` | ![#00E5A8](https://via.placeholder.com/20/00E5A8/000000?text=+) |
| 🟨 Yellow | Wheel Sector | `#FFD93D` | ![#FFD93D](https://via.placeholder.com/20/FFD93D/000000?text=+) |
| ⚫ Black   | Border/Text  | `#111111` | ![#111111](https://via.placeholder.com/20/111111/FFFFFF?text=+) |
| ⚪ White   | Nền          | `#F9F9F9` | ![#F9F9F9](https://via.placeholder.com/20/F9F9F9/000000?text=+) |

---

### 📘 Tổng kết

> “Neo-brutalism cho Lucky Wheel không chỉ là phong cách thị giác — nó là ngôn ngữ cảm xúc: vui, rõ, thật, retro-modern.
> Viền dày, màu rực, shadow lệch chính là thứ giúp người chơi *thấy – tin – chạm*.”

---

### 📁 File này có thể dùng trực tiếp cho:

* Claude Code / Codex để sinh CSS component
* Dev Tailwind setup theme token
* UI/UX designer dựng Figma Style Guide

### Mã nhúng font chữ

#### Space Grotesk
Nhúng mã vào <head> của html của bạn

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap" rel="stylesheet">

Hoặc Space Grotesk: Lớp CSS cho kiểu biến đổi

.space-grotesk-<uniquifier> {
  font-family: "Space Grotesk", sans-serif;
  font-optical-sizing: auto;
  font-weight: <weight>;
  font-style: normal;
}

Inter: CSS class for a variable style

.inter-<uniquifier> {
  font-family: "Inter", sans-serif;
  font-optical-sizing: auto;
  font-weight: <weight>;
  font-style: normal;
}

DM Sans: CSS class for a variable style


.dm-sans-<uniquifier> {
  font-family: "DM Sans", sans-serif;
  font-optical-sizing: auto;
  font-weight: <weight>;
  font-style: normal;
}

#### Inter

Embed code in the <head> of your html

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Space+Grotesk:wght@300..700&display=swap" rel="stylesheet">

Space Grotesk: CSS class for a variable style


.space-grotesk-<uniquifier> {
  font-family: "Space Grotesk", sans-serif;
  font-optical-sizing: auto;
  font-weight: <weight>;
  font-style: normal;
}

Inter: CSS class for a variable style


.inter-<uniquifier> {
  font-family: "Inter", sans-serif;
  font-optical-sizing: auto;
  font-weight: <weight>;
  font-style: normal;
}

#### DM Sans

Embed code in the <head> of your html

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Space+Grotesk:wght@300..700&display=swap" rel="stylesheet">

Space Grotesk: CSS class for a variable style


.space-grotesk-<uniquifier> {
  font-family: "Space Grotesk", sans-serif;
  font-optical-sizing: auto;
  font-weight: <weight>;
  font-style: normal;
}

DM Sans: CSS class for a variable style


.dm-sans-<uniquifier> {
  font-family: "DM Sans", sans-serif;
  font-optical-sizing: auto;
  font-weight: <weight>;
  font-style: normal;
}
