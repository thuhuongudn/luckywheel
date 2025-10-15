const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto-js');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

// Import Supabase client and DB functions
const { supabase, testConnection } = require('./lib/supabase');
const db = require('./lib/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (required for Heroku to get correct IP)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(express.json());

// CORS - allow frontend domains
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
  process.env.PRODUCTION_URL,
].filter(Boolean);

// Vite picks random ports (5173+). Allow any localhost:517* origin during local dev.
const isLocalhostDevOrigin = (origin = '') => origin.startsWith('http://localhost:517');

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Heroku health checks)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1 || isLocalhostDevOrigin(origin)) {
      callback(null, true);
    } else {
      console.warn('❌ CORS blocked request from:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Rate limiting - prevent spam
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per IP per 15 minutes
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const spinLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Max 5 spins per IP+phone per hour
  keyGenerator: (req, res) => {
    const ipKey = rateLimit.ipKeyGenerator(req, res);
    const phone = req.body.phone || '';
    const phoneHash = db.hashPhone(phone);
    return `${ipKey}-${phoneHash.substring(0, 8)}`;
  },
  skip: (req) => !req.body.phone,
  message: 'Too many spin attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    validationsConfig: false,
    xForwardedForHeader: false
  }
});

app.use('/api/', limiter);

// Helper: Verify HMAC signature
function verifySignature(payload, signature, timestamp) {
  const secret = process.env.API_SECRET || 'change-me';

  // Check timestamp (must be within 5 minutes)
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

// Helper: Generate coupon code
function generateCouponCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper: Send to N8N (async, fire-and-forget)
async function sendToN8N(spinData) {
  const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!n8nWebhookUrl) {
    console.warn('⚠️  N8N_WEBHOOK_URL not configured, skipping N8N send');
    return { success: false, error: 'N8N not configured' };
  }

  const n8nApiKey = process.env.N8N_WEBHOOK_API_KEY;

  const payload = {
    campaign_id: spinData.campaignId,
    phone: spinData.phone,
    phone_hash: db.hashPhone(spinData.phone),
    phone_masked: db.maskPhone(spinData.phone),
    customer_name: spinData.customerName,
    prize: spinData.prize,
    coupon_code: spinData.couponCode,
    timestamp: Date.now(),
    user_agent: spinData.userAgent,
    ip: spinData.ipAddress,
    idempotency_key: `${spinData.campaignId}-${db.hashPhone(spinData.phone)}-${Date.now()}`
  };

  console.log('🚀 [N8N] Sending webhook:', {
    campaign_id: payload.campaign_id,
    phone_masked: payload.phone_masked,
    prize: payload.prize,
    coupon_code: payload.coupon_code
  });

  try {
    const response = await axios.post(n8nWebhookUrl, payload, {
      timeout: 25000, // 25s (less than Heroku's 30s timeout)
      headers: {
        'Content-Type': 'application/json',
        'lucky-wheel': n8nApiKey || '',
        'X-Webhook-Secret': process.env.N8N_WEBHOOK_SECRET || ''
      }
    });

    console.log('✅ [N8N] Success:', response.status);
    return { success: true, response: response.data };
  } catch (error) {
    console.error('❌ [N8N] Error:', error.message);
    return { success: false, error: error.message };
  }
}

// =============================================================================
// API ROUTES
// =============================================================================

// Health check
app.get('/health', async (req, res) => {
  const dbConnected = await testConnection();
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    database: dbConnected ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Check eligibility - fast duplicate check
app.post('/api/check-eligibility', limiter, async (req, res) => {
  try {
    const { phone, campaign_id } = req.body;

    // Validate required fields
    if (!phone || !campaign_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: phone, campaign_id'
      });
    }

    // Validate phone format
    const phoneRegex = /^0[3|5|7|8|9][0-9]{8}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }

    // Check if phone has already spun
    const { exists, spin } = await db.checkPhoneExists(phone, campaign_id);

    if (exists) {
      return res.json({
        success: false,
        eligible: false,
        message: 'Số điện thoại đã quay mã, vui lòng kiểm tra Zalo!',
        already_spun: true,
        spun_at: spin.created_at,
        prize: spin.prize
      });
    }

    // Eligible to spin
    res.json({
      success: true,
      eligible: true,
      message: 'Bạn có thể quay'
    });

  } catch (error) {
    console.error('❌ [CHECK] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Không thể kiểm tra điều kiện. Vui lòng thử lại.'
    });
  }
});

// Main spin endpoint
app.post('/api/spin', spinLimiter, async (req, res) => {
  const { phone, name, campaign_id, timestamp, signature } = req.body;

  try {
    // 1. Validate required fields
    if (!phone || !campaign_id || !timestamp || !signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // 2. Validate phone format
    const phoneRegex = /^0[3|5|7|8|9][0-9]{8}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }

    // 3. Check duplicate (FAST - 50-100ms)
    const { exists, spin: existingSpin } = await db.checkPhoneExists(phone, campaign_id);

    if (exists) {
      console.log(`⚠️  [SPIN] Duplicate attempt: ${db.maskPhone(phone)}`);
      return res.status(400).json({
        success: false,
        message: 'Số điện thoại đã quay rồi! Vui lòng kiểm tra Zalo.',
        already_spun: true,
        spun_at: existingSpin.created_at,
        prize: existingSpin.prize,
        coupon_code: existingSpin.coupon_code
      });
    }

    // 4. Select random prize from database (weight-based)
    const { prize_value, prize_label } = await db.selectRandomPrize(campaign_id);

    console.log(`🎰 [SPIN] Selected prize: ${prize_label} (${prize_value}đ) for ${db.maskPhone(phone)}`);

    // 5. Generate coupon code
    const couponCode = generateCouponCode();

    // 6. Save to database IMMEDIATELY (mark as used)
    const spinRecord = await db.saveSpin({
      campaignId: campaign_id,
      phone: phone,
      customerName: name || 'Anonymous',
      prize: prize_value,
      couponCode: couponCode,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    console.log(`✅ [SPIN] Saved to DB: ${spinRecord.id}`);

    // 7. Return success to frontend IMMEDIATELY (150-200ms total)
    res.json({
      success: true,
      message: 'Mã giảm giá sẽ được gửi qua Zalo trong vài giây',
      code: couponCode,
      prize: prize_value,
      phone_masked: db.maskPhone(phone)
    });

    // 8. Send to N8N asynchronously (fire-and-forget, don't block response)
    sendToN8N({
      campaignId: campaign_id,
      phone: phone,
      customerName: name || 'Anonymous',
      prize: prize_value,
      couponCode: couponCode,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).then(result => {
      // Update N8N status in database
      db.updateN8NStatus(
        spinRecord.id,
        result.success,
        result.response || null,
        result.error || null
      );
    }).catch(err => {
      console.error('❌ [N8N] Unexpected error:', err.message);
      db.updateN8NStatus(spinRecord.id, false, null, err.message);
    });

  } catch (error) {
    console.error('❌ [SPIN] Error:', error.message);

    // Handle duplicate phone error (race condition)
    if (error.message === 'DUPLICATE_PHONE') {
      return res.status(400).json({
        success: false,
        message: 'Số điện thoại đã quay rồi',
        already_spun: true
      });
    }

    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra. Vui lòng thử lại sau.',
      error_code: 'INTERNAL_ERROR'
    });
  }
});

// Get campaign statistics (for admin)
app.get('/api/statistics/:campaignId', limiter, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const stats = await db.getSpinStatistics(campaignId);

    if (!stats) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found or statistics unavailable'
      });
    }

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ [STATS] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics'
    });
  }
});

// Get active prizes for frontend
app.get('/api/prizes/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const prizes = await db.getActivePrizes(campaignId);

    res.json({
      success: true,
      data: prizes
    });
  } catch (error) {
    console.error('❌ [PRIZES] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching prizes'
    });
  }
});

// =============================================================================
// SERVE FRONTEND (For Heroku all-in-one deployment)
// =============================================================================

// Serve static files from frontend build folder
const frontendBuildPath = path.join(__dirname, '../lucky-wheel-app/dist');
app.use(express.static(frontendBuildPath));

// SPA fallback - serve index.html for all non-API routes
// This must be AFTER all API routes
app.use((req, res, next) => {
  // Skip if it's an API route
  if (req.path.startsWith('/api/')) {
    return next();
  }

  // Skip if it's a static file request (has extension)
  if (path.extname(req.path)) {
    return next();
  }

  // Serve index.html for all other routes (SPA routing)
  res.sendFile(path.join(frontendBuildPath, 'index.html'), (err) => {
    if (err) {
      next(err);
    }
  });
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

app.use((err, req, res, next) => {
  console.error('❌ [ERROR]', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// =============================================================================
// START SERVER
// =============================================================================

async function startServer() {
  // Test Supabase connection
  console.log('🔌 Testing Supabase connection...');
  const dbConnected = await testConnection();

  if (!dbConnected) {
    console.warn('⚠️  Supabase connection failed. Server will start but database operations will fail.');
    console.warn('   Make sure you have run the SQL setup scripts in supabase/ folder');
  }

  app.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('🚀 Lucky Wheel Backend Server');
    console.log('═══════════════════════════════════════════════');
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️  Database: ${dbConnected ? '✅ Connected' : '❌ Disconnected'}`);
    console.log(`🔐 Rate limiting: ✅ Enabled`);
    console.log(`🛡️  Security headers: ✅ Enabled`);
    console.log(`🔗 N8N Webhook: ${process.env.N8N_WEBHOOK_URL ? '✅ Configured' : '⚠️  Not configured'}`);
    console.log('═══════════════════════════════════════════════');
    console.log('');
  });
}

startServer();

module.exports = app;
