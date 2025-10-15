# 🚀 Hướng dẫn Deploy

## Deploy lên Heroku

### 1. Cài đặt Heroku CLI

```bash
# macOS
brew tap heroku/brew && brew install heroku

# hoặc
npm install -g heroku
```

### 2. Login Heroku

```bash
heroku login
```

### 3. Tạo app

```bash
heroku create lucky-wheel-app-2025
```

### 4. Thêm buildpack

```bash
heroku buildpacks:set heroku/nodejs
```

### 5. Set environment variables

```bash
heroku config:set VITE_N8N_WEBHOOK_URL=https://n8n.nhathuocvietnhat.vn/webhook/lucky-wheel-2025-10-14
heroku config:set VITE_CAMPAIGN_ID=lucky-wheel-2025-10-14
```

### 6. Deploy

```bash
git push heroku main
```

### 7. Mở app

```bash
heroku open
```

---

## Deploy lên Vercel

### 1. Cài đặt Vercel CLI

```bash
npm install -g vercel
```

### 2. Login

```bash
vercel login
```

### 3. Deploy

```bash
vercel --prod
```

### 4. Set environment variables (trên Vercel Dashboard)

- `VITE_N8N_WEBHOOK_URL`
- `VITE_CAMPAIGN_ID`

---

## Deploy lên Netlify

### 1. Build

```bash
npm run build
```

### 2. Install Netlify CLI

```bash
npm install -g netlify-cli
```

### 3. Deploy

```bash
netlify deploy --prod --dir=dist
```

### 4. Set environment variables (trên Netlify Dashboard)

- `VITE_N8N_WEBHOOK_URL`
- `VITE_CAMPAIGN_ID`

---

## Cấu hình CORS cho N8N

### N8N Workflow - HTTP Response Node

```json
{
  "statusCode": 200,
  "headers": {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  },
  "body": {
    "success": true,
    "message": "Mã giảm giá đã được gửi qua Zalo",
    "code": "LUCKY50K",
    "prize": 50000
  }
}
```

---

## Nhúng vào Haravan/Shopify

### Tạo Section mới

File: `sections/lucky-wheel.liquid`

```liquid
<div class="lucky-wheel-section">
  <iframe
    src="{{ section.settings.iframe_url }}"
    width="100%"
    height="900"
    frameborder="0"
    id="lucky-wheel-iframe"
    allow="clipboard-write"
  ></iframe>
</div>

<style>
  .lucky-wheel-section {
    max-width: 100%;
    margin: 40px auto;
    padding: 0 20px;
  }

  #lucky-wheel-iframe {
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
  }
</style>

<script>
  // Auto resize iframe
  window.addEventListener('message', function(e) {
    if (e.data.type === 'resize') {
      var iframe = document.getElementById('lucky-wheel-iframe');
      if (iframe) {
        iframe.style.height = e.data.height + 'px';
      }
    }
  });
</script>

{% schema %}
{
  "name": "Vòng quay may mắn",
  "settings": [
    {
      "type": "text",
      "id": "iframe_url",
      "label": "URL Widget",
      "default": "https://your-app.herokuapp.com"
    },
    {
      "type": "checkbox",
      "id": "enable",
      "label": "Kích hoạt",
      "default": true
    }
  ],
  "presets": [
    {
      "name": "Lucky Wheel",
      "category": "Promotional"
    }
  ]
}
{% endschema %}
```

### Thêm vào Page Template

```liquid
{% section 'lucky-wheel' %}
```

---

## Monitoring & Analytics

### Google Analytics

Thêm vào `index.html`:

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

### Facebook Pixel

```html
<!-- Facebook Pixel -->
<script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', 'YOUR_PIXEL_ID');
  fbq('track', 'PageView');
</script>
```

---

## Troubleshooting

### Lỗi: Cannot read lucky-canvas

**Giải pháp**: Rebuild lại

```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Lỗi: CORS blocked

**Giải pháp**: Cấu hình CORS headers đúng ở n8n

### Lỗi: Timeout

**Giải pháp**: Tăng timeout trong `api.ts`:

```typescript
timeout: 30000 // 30 seconds
```
