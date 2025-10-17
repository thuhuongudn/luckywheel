const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

// Import Supabase client and DB functions
const { supabase, testConnection } = require('./lib/supabase');
const db = require('./lib/db');
const haravan = require('./lib/haravan');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (required for Heroku to get correct IP)
app.set('trust proxy', 1);

// Security middleware - Configure Helmet CSP for same-origin API calls
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'"], // Allow fetch to same origin (API calls)
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for React
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'", "https:", "data:"],
    },
  },
}));
app.use(express.json());

// CORS - allow frontend domains
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://luckywheel-dc4995c0f577.herokuapp.com',
  process.env.FRONTEND_URL,
  process.env.PRODUCTION_URL,
].filter(Boolean);

// Vite picks random ports (5173+). Allow any localhost:517* origin during local dev.
const isLocalhostDevOrigin = (origin = '') => origin.startsWith('http://localhost:517');

// Apply CORS only to API routes, not static assets
app.use('/api', cors({
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

// Helper: Verify HMAC signature (REMOVED - no longer needed)
// Security now relies on:
// 1. Rate limiting (spinLimiter)
// 2. Database unique constraint on (campaign_id, phone_hash)
// 3. Phone number hashing with secret pepper

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
    expires_at: spinData.expiresAt,
    timestamp: Date.now(),
    user_agent: spinData.userAgent,
    ip: spinData.ipAddress,
    idempotency_key: `${spinData.campaignId}-${db.hashPhone(spinData.phone)}-${Date.now()}`
  };

  console.log('🚀 [N8N] Sending webhook:', {
    campaign_id: payload.campaign_id,
    phone_masked: payload.phone_masked,
    prize: payload.prize,
    coupon_code: payload.coupon_code,
    expires_at: payload.expires_at
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

// Helper: Auto-create Haravan discount (async, fire-and-forget)
async function createHaravanDiscountAsync(spinRecord, campaignId, expiresAt) {
  try {
    console.log('📝 [HARAVAN] Creating discount for spin:', spinRecord.id);

    // Create discount in Haravan
    const discount = await haravan.createDiscount({
      code: spinRecord.coupon_code,
      value: spinRecord.prize,
      starts_at: spinRecord.created_at,
      ends_at: expiresAt,
      campaignId: campaignId
    });

    console.log('🎉 [HARAVAN] Discount created:', {
      discountId: discount.discountId,
      code: discount.code,
      is_promotion: discount.is_promotion,
      times_used: discount.times_used,
      usage_limit: discount.usage_limit
    });

    // Calculate status based on Haravan rules
    const status = haravan.calculateStatus(
      discount.is_promotion,
      discount.times_used,
      discount.usage_limit
    );

    console.log('📊 [HARAVAN] Calculated status:', status);

    // Update database with Haravan data
    const { error } = await supabase
      .from('lucky_wheel_spins')
      .update({
        discount_id: discount.discountId,
        is_promotion: discount.is_promotion,
        times_used: discount.times_used,
        usage_limit: discount.usage_limit,
        status: status
      })
      .eq('id', spinRecord.id);

    if (error) {
      throw new Error(`Database update failed: ${error.message}`);
    }

    console.log('✅ [HARAVAN] Discount created and saved successfully:', discount.discountId);

  } catch (error) {
    console.error('❌ [HARAVAN] Auto-create error:', error.message);
    // Re-throw to be caught by .catch() in calling code
    throw error;
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
        prize: spin.prize,
        expires_at: spin.expires_at
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
  const { phone, name, campaign_id } = req.body;

  console.log('\n🎯 [API] /api/spin request received');
  console.log('📥 [API] Request body:', {
    phone: phone ? db.maskPhone(phone) : 'MISSING',
    name,
    campaign_id
  });

  try {
    // 1. Validate required fields
    if (!phone || !campaign_id) {
      console.log('❌ [API] Missing required fields');
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

    // 3. Select random prize from database (weight-based)
    console.log('🎲 [API] Selecting random prize...');
    const { prize_value, prize_label } = await db.selectRandomPrize(campaign_id);

    console.log(`🎰 [SPIN] Selected prize: ${prize_label} (${prize_value}đ) for ${db.maskPhone(phone)}`);

    // 4. Generate coupon code
    const couponCode = generateCouponCode();
    console.log(`🎟️  [API] Generated coupon: ${couponCode}`);

    const expiresAtIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    console.log(`🗓️  [API] Calculated expiry: ${expiresAtIso}`);

    // 5. Save to database IMMEDIATELY (DB constraint will prevent duplicates)
    console.log('💾 [API] Calling db.saveSpin...');
    let spinRecord;
    try {
      spinRecord = await db.saveSpin({
        campaignId: campaign_id,
        phone: phone,
        customerName: name || 'Anonymous',
        prize: prize_value,
        couponCode: couponCode,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        expiresAt: expiresAtIso
      });

      console.log(`✅ [SPIN] Saved to DB successfully: ${spinRecord?.id}`);
      console.log('📋 [SPIN] Saved record:', {
        id: spinRecord?.id,
        campaign_id: spinRecord?.campaign_id,
        prize: spinRecord?.prize,
        coupon_code: spinRecord?.coupon_code,
        phone_masked: spinRecord?.phone_masked,
        expires_at: spinRecord?.expires_at
      });
    } catch (saveError) {
      console.error('❌ [API] saveSpin threw error:', saveError.message);
      // Handle duplicate phone (DB unique constraint violation)
      if (saveError.message === 'DUPLICATE_PHONE') {
        console.log(`⚠️  [SPIN] Duplicate detected by DB constraint: ${db.maskPhone(phone)}`);

        // Fetch existing spin record to show user their previous prize
        const { spin: existingSpin } = await db.checkPhoneExists(phone, campaign_id);

        return res.status(400).json({
          success: false,
          message: 'Số điện thoại đã quay rồi! Vui lòng kiểm tra Zalo để nhận mã giảm giá.',
          already_spun: true,
          spun_at: existingSpin?.created_at,
          prize: existingSpin?.prize,
          coupon_code: existingSpin?.coupon_code,
          expires_at: existingSpin?.expires_at
        });
      }
      // Re-throw other errors
      throw saveError;
    }

    // 6. Auto-create Haravan discount (fire-and-forget, don't block response)
    console.log('🎫 [HARAVAN] Auto-creating discount asynchronously...');
    createHaravanDiscountAsync(spinRecord, campaign_id, expiresAtIso).catch(err => {
      console.error('❌ [HARAVAN] Auto-create failed:', err.message);
      // Don't fail the spin, admin can manually create later
    });

    // 7. Return success to frontend IMMEDIATELY (150-200ms total)
    console.log('📤 [API] Sending success response to frontend');
    const responseData = {
      success: true,
      message: 'Mã giảm giá sẽ được gửi qua Zalo trong vài giây',
      code: couponCode,
      prize: prize_value,
      phone_masked: db.maskPhone(phone),
      expires_at: spinRecord?.expires_at || expiresAtIso
    };
    console.log('✅ [API] Response:', responseData);
    res.json(responseData);

    // 8. Send to N8N asynchronously (fire-and-forget, don't block response)
    console.log('🚀 [API] Sending to N8N asynchronously...');
    sendToN8N({
      campaignId: campaign_id,
      phone: phone,
      customerName: name || 'Anonymous',
      prize: prize_value,
      couponCode: couponCode,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      expiresAt: spinRecord?.expires_at || expiresAtIso
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

// Get campaign statistics (for admin only - requires authentication)
app.get('/api/statistics/:campaignId', limiter, async (req, res) => {
  try {
    // SECURITY: Require admin authentication
    const authHeader = req.headers.authorization;
    const adminToken = process.env.ADMIN_API_TOKEN || 'change-me-in-production';

    if (!authHeader || authHeader !== `Bearer ${adminToken}`) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Admin authentication required'
      });
    }

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
// ADMIN API ENDPOINTS (Service Role - Full Access)
// =============================================================================

// Get all spins for admin dashboard
app.get('/api/admin/spins', async (req, res) => {
  try {
    const campaignId = req.query.campaign_id || process.env.CAMPAIGN_ID || 'lucky-wheel-2025-10-14';

    console.log('📊 [ADMIN] Fetching spins for campaign:', campaignId);

    const { data, error } = await supabase
      .from('lucky_wheel_spins')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [ADMIN] Supabase error:', error);
      return res.status(500).json({
        success: false,
        message: 'Database error',
        error: error.message
      });
    }

    console.log('✅ [ADMIN] Fetched', data.length, 'spins');

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('❌ [ADMIN] Error fetching spins:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching spins',
      error: error.message
    });
  }
});

// Get statistics for admin dashboard
app.get('/api/admin/statistics', async (req, res) => {
  try {
    const campaignId = req.query.campaign_id || process.env.CAMPAIGN_ID || 'lucky-wheel-2025-10-14';

    console.log('📈 [ADMIN] Fetching statistics for campaign:', campaignId);

    const { data, error } = await supabase
      .rpc('get_spin_statistics', { p_campaign_id: campaignId });

    if (error) {
      console.error('❌ [ADMIN] Statistics error:', error);
      return res.status(500).json({
        success: false,
        message: 'Statistics error',
        error: error.message
      });
    }

    console.log('✅ [ADMIN] Statistics fetched');

    res.json({
      success: true,
      data: data?.[0] || {
        total_spins: 0,
        active_count: 0,
        inactive_count: 0,
        expired_count: 0,
        used_count: 0,
        prize_20k_count: 0,
        prize_30k_count: 0,
        prize_50k_count: 0,
        prize_100k_count: 0,
        total_prize_value: 0,
        active_value: 0,
        used_value: 0,
        potential_value: 0
      }
    });
  } catch (error) {
    console.error('❌ [ADMIN] Error fetching statistics:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
});

// Update spin status (for future use)
app.put('/api/admin/spins/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = ['active', 'inactive', 'expired', 'used'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be: active, inactive, expired, or used'
      });
    }

    console.log('🔄 [ADMIN] Updating spin', id, 'to status:', status);

    const { data, error } = await supabase
      .from('lucky_wheel_spins')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ [ADMIN] Update error:', error);
      return res.status(500).json({
        success: false,
        message: 'Update failed',
        error: error.message
      });
    }

    console.log('✅ [ADMIN] Spin updated');

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('❌ [ADMIN] Error updating spin:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error updating spin',
      error: error.message
    });
  }
});

// =============================================================================
// HARAVAN DISCOUNT CODE API ENDPOINTS
// =============================================================================

// Create Haravan discount code for a spin
app.post('/api/admin/haravan/create-discount', async (req, res) => {
  try {
    const { spinId } = req.body;

    if (!spinId) {
      return res.status(400).json({
        success: false,
        message: 'spinId is required'
      });
    }

    console.log('📝 [HARAVAN] Creating discount for spin:', spinId);

    // Get spin record
    const { data: spin, error: fetchError } = await supabase
      .from('lucky_wheel_spins')
      .select('*')
      .eq('id', spinId)
      .single();

    if (fetchError || !spin) {
      return res.status(404).json({
        success: false,
        message: 'Spin not found'
      });
    }

    // Check if discount already created
    if (spin.discount_id) {
      return res.status(400).json({
        success: false,
        message: 'Discount already created for this spin',
        discountId: spin.discount_id
      });
    }

    // Create discount in Haravan
    const discount = await haravan.createDiscount({
      code: spin.coupon_code,
      value: spin.prize,
      starts_at: spin.created_at,
      ends_at: spin.expires_at,
      campaignId: spin.campaign_id
    });

    // Calculate status based on Haravan response
    const status = haravan.calculateStatus(
      discount.is_promotion,
      discount.times_used,
      discount.usage_limit
    );

    // Update spin record with Haravan data
    const { data: updated, error: updateError } = await supabase
      .from('lucky_wheel_spins')
      .update({
        discount_id: discount.discountId,
        is_promotion: discount.is_promotion,
        times_used: discount.times_used,
        usage_limit: discount.usage_limit,
        status: status
      })
      .eq('id', spinId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ [HARAVAN] Database update error:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Discount created but failed to update database',
        error: updateError.message
      });
    }

    console.log('✅ [HARAVAN] Discount created and saved:', discount.discountId);

    res.json({
      success: true,
      data: updated,
      discount
    });

  } catch (error) {
    console.error('❌ [HARAVAN] Create discount error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Refresh status for active spins (batch refresh)
app.post('/api/admin/haravan/refresh-status', async (req, res) => {
  try {
    console.log('🔄 [HARAVAN] Refreshing status for active spins');

    // Get all active spins with discount_id
    const { data: spins, error: fetchError } = await supabase
      .from('lucky_wheel_spins')
      .select('*')
      .eq('status', 'active')
      .not('discount_id', 'is', null);

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    if (!spins || spins.length === 0) {
      return res.json({
        success: true,
        message: 'No active spins to refresh',
        updated: 0
      });
    }

    console.log(`📊 [HARAVAN] Found ${spins.length} active spins to refresh`);

    // Refresh each spin
    const results = [];
    const errors = [];

    for (const spin of spins) {
      try {
        // Get latest data from Haravan
        const discount = await haravan.getDiscount(spin.discount_id);

        // Calculate new status
        const newStatus = haravan.calculateStatus(
          discount.is_promotion,
          discount.times_used,
          discount.usage_limit
        );

        // Update if status changed
        if (newStatus !== spin.status || discount.times_used !== spin.times_used) {
          const { error: updateError } = await supabase
            .from('lucky_wheel_spins')
            .update({
              is_promotion: discount.is_promotion,
              times_used: discount.times_used,
              usage_limit: discount.usage_limit,
              status: newStatus
            })
            .eq('id', spin.id);

          if (updateError) {
            errors.push({ spinId: spin.id, error: updateError.message });
          } else {
            results.push({
              spinId: spin.id,
              code: spin.coupon_code,
              oldStatus: spin.status,
              newStatus: newStatus,
              times_used: discount.times_used
            });
          }
        }

        // Rate limiting: wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ [HARAVAN] Error refreshing spin ${spin.id}:`, error.message);
        errors.push({ spinId: spin.id, error: error.message });
      }
    }

    console.log(`✅ [HARAVAN] Refreshed ${results.length} spins`);

    res.json({
      success: true,
      updated: results.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ [HARAVAN] Refresh status error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Delete Haravan discount
app.delete('/api/admin/haravan/discount/:spinId', async (req, res) => {
  try {
    const { spinId } = req.params;

    console.log('🗑️  [HARAVAN] Deleting discount for spin:', spinId);

    // Get spin record
    const { data: spin, error: fetchError } = await supabase
      .from('lucky_wheel_spins')
      .select('*')
      .eq('id', spinId)
      .single();

    if (fetchError || !spin) {
      return res.status(404).json({
        success: false,
        message: 'Spin not found'
      });
    }

    if (!spin.discount_id) {
      return res.status(400).json({
        success: false,
        message: 'No discount to delete'
      });
    }

    // Delete from Haravan
    await haravan.deleteDiscount(spin.discount_id);

    // Update spin record (clear Haravan fields, set status to expired)
    const { error: updateError } = await supabase
      .from('lucky_wheel_spins')
      .update({
        discount_id: null,
        is_promotion: false,
        times_used: 0,
        usage_limit: 1,
        status: 'expired'
      })
      .eq('id', spinId);

    if (updateError) {
      console.error('❌ [HARAVAN] Database update error:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Discount deleted but failed to update database',
        error: updateError.message
      });
    }

    console.log('✅ [HARAVAN] Discount deleted');

    res.json({
      success: true,
      message: 'Discount deleted successfully'
    });

  } catch (error) {
    console.error('❌ [HARAVAN] Delete discount error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// =============================================================================
// SERVE FRONTEND (For Heroku all-in-one deployment)
// =============================================================================

// Serve static files from frontend build folder
const frontendBuildPath = path.join(__dirname, 'frontend/dist');
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
