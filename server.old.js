const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto-js');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(express.json());

// CORS - chỉ cho phép domain của bạn
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
  // Thêm domain production của bạn
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Rate limiting - ngăn spam
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 100, // Tối đa 100 requests/15 phút cho toàn bộ IP
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const spinLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 5, // Tối đa 5 lần quay/1 giờ cho mỗi IP
  keyGenerator: (req) => {
    // Combine IP + phone hash để chặn chính xác hơn
    const phone = req.body.phone || '';
    const phoneHash = crypto.SHA256(phone + process.env.SECRET_PEPPER).toString();
    // req.ip is already normalized by express (handles X-Forwarded-For, IPv6, etc)
    const ip = req.ip || 'unknown';
    return `${ip}-${phoneHash.substring(0, 8)}`;
  },
  skip: (req) => {
    // Skip rate limiting if phone is not provided (validation will handle it)
    return !req.body.phone;
  },
  message: 'Too many spin attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Disable IPv6 validation - req.ip is already normalized by Express
  validate: {
    validationsConfig: false,
    xForwardedForHeader: false
  }
});

app.use('/api/', limiter);

// Database simulation (nên dùng Redis hoặc DB thật)
// Key: phone_hash, Value: { spun: true, timestamp, prize }
const spunPhones = new Map();

// Helper: Hash phone number
function hashPhone(phone) {
  const pepper = process.env.SECRET_PEPPER || 'default-pepper-change-me';
  return crypto.SHA256(phone + pepper).toString();
}

// Helper: Verify request signature (HMAC)
function verifySignature(payload, signature, timestamp) {
  const secret = process.env.API_SECRET || 'change-me';

  // Check timestamp (phải trong vòng 5 phút)
  const now = Date.now();
  if (Math.abs(now - timestamp) > 5 * 60 * 1000) {
    return false;
  }

  // Verify HMAC signature
  const expectedSignature = crypto.HmacSHA256(
    JSON.stringify(payload) + timestamp,
    secret
  ).toString();

  return signature === expectedSignature;
}

// Helper: Generate signature (dùng ở frontend)
function generateSignature(payload, timestamp) {
  const secret = process.env.API_SECRET || 'change-me';
  return crypto.HmacSHA256(
    JSON.stringify(payload) + timestamp,
    secret
  ).toString();
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Get signature for frontend (chỉ trong dev)
if (process.env.NODE_ENV === 'development') {
  app.post('/api/get-signature', (req, res) => {
    const timestamp = Date.now();
    const signature = generateSignature(req.body, timestamp);
    res.json({ signature, timestamp });
  });
}

// Check eligibility - kiểm tra đã quay chưa
app.post('/api/check-eligibility', limiter, async (req, res) => {
  try {
    const { phone, campaign_id } = req.body;

    if (!phone || !campaign_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Validate phone format
    const phoneRegex = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }

    const phoneHash = hashPhone(phone);
    const key = `${campaign_id}:${phoneHash}`;

    // Check in memory (nên check DB thật)
    if (spunPhones.has(key)) {
      const data = spunPhones.get(key);
      return res.json({
        success: false,
        eligible: false,
        message: 'Bạn đã quay rồi! Vui lòng kiểm tra Zalo.',
        already_spun: true,
        spun_at: data.timestamp
      });
    }

    res.json({
      success: true,
      eligible: true,
      message: 'Bạn có thể quay',
      phone_hash: phoneHash
    });

  } catch (error) {
    console.error('Check eligibility error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Main spin endpoint - GỌI WEBHOOK N8N
app.post('/api/spin', spinLimiter, async (req, res) => {
  try {
    const { phone, prize, campaign_id, timestamp, signature } = req.body;

    // 1. Validate required fields
    if (!phone || !prize || !campaign_id || !timestamp || !signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // 2. Verify signature (chống giả mạo request)
    const payload = { phone, prize, campaign_id };
    if (!verifySignature(payload, signature, timestamp)) {
      console.warn('Invalid signature from IP:', req.ip);
      return res.status(401).json({
        success: false,
        message: 'Invalid signature'
      });
    }

    // 3. Validate phone format
    const phoneRegex = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number'
      });
    }

    // 4. Validate prize value
    const validPrizes = [20000, 30000, 50000, 100000];
    if (!validPrizes.includes(prize)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid prize value'
      });
    }

    // 5. Check duplicate spin
    const phoneHash = hashPhone(phone);
    const key = `${campaign_id}:${phoneHash}`;

    if (spunPhones.has(key)) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã quay rồi',
        already_spun: true
      });
    }

    // 6. Mark as spun (idempotency)
    spunPhones.set(key, {
      spun: true,
      timestamp: Date.now(),
      prize,
      ip: req.ip
    });

    // 7. Call N8N webhook (ẨN WEBHOOK URL)
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

    if (!n8nWebhookUrl) {
      throw new Error('N8N webhook URL not configured');
    }

    const n8nPayload = {
      campaign_id,
      phone: phone.replace(/\s/g, ''),
      phone_hash: phoneHash,
      phone_masked: phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1***$3'),
      prize,
      timestamp: Date.now(),
      user_agent: req.get('user-agent'),
      ip: req.ip,
      idempotency_key: `${campaign_id}-${phoneHash}-${Date.now()}`
    };

    console.log('🚀 [N8N] Calling webhook:', {
      url: n8nWebhookUrl,
      campaign_id,
      prize,
      phone_masked: n8nPayload.phone_masked,
      timestamp: new Date().toISOString()
    });

    // N8N Header Authentication (theo docs: https://docs.n8n.io/integrations/builtin/credentials/webhook/)
    const n8nApiKey = process.env.N8N_WEBHOOK_API_KEY;

    const n8nResponse = await axios.post(n8nWebhookUrl, n8nPayload, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        // N8N Header Authentication: header name = "lucky-wheel", value = API key
        'lucky-wheel': n8nApiKey || '',
        // Backward compatibility
        'X-Webhook-Secret': process.env.N8N_WEBHOOK_SECRET || ''
      }
    });

    console.log('✅ [N8N] Response received:', {
      status: n8nResponse.status,
      success: n8nResponse.data.success,
      code: n8nResponse.data.code,
      message: n8nResponse.data.message
    });

    // 8. Return response to frontend
    res.json({
      success: true,
      message: 'Mã giảm giá đã được gửi qua Zalo',
      code: n8nResponse.data.code,
      prize: prize,
      phone_masked: n8nPayload.phone_masked
    });

  } catch (error) {
    console.error('❌ [ERROR] Spin failed:', {
      message: error.message,
      phone_masked: req.body.phone ? req.body.phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1***$3') : 'N/A',
      prize: req.body.prize,
      timestamp: new Date().toISOString()
    });

    // Nếu lỗi, xóa khỏi cache để user có thể thử lại
    const phoneHash = hashPhone(req.body.phone || '');
    const key = `${req.body.campaign_id}:${phoneHash}`;
    spunPhones.delete(key);

    if (error.response) {
      // N8N trả về lỗi
      console.error('❌ [N8N] Error response:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      });

      return res.status(error.response.status).json({
        success: false,
        message: error.response.data.message || 'Có lỗi xảy ra từ server',
        error_code: 'N8N_ERROR'
      });
    }

    if (error.request) {
      console.error('❌ [N8N] No response received:', {
        timeout: error.code === 'ECONNABORTED',
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra. Vui lòng thử lại sau.',
      error_code: 'INTERNAL_ERROR'
    });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 Rate limiting: ON`);
  console.log(`🛡️  Security headers: ON`);
});

module.exports = app;
