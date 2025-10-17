const axios = require('axios');

/**
 * Haravan Discount Code API Service
 * Base URL: https://apis.haravan.com
 * Auth: Bearer token
 */

const HARAVAN_BASE_URL = 'https://apis.haravan.com';
const HARAVAN_AUTH_TOKEN = process.env.HARAVAN_AUTH_TOKEN || '9AF9F109450B9CF25E41F2DB932E41685C0F3132C74C32DDF8E7D336B049C7CE';
const COLLECTION_ID = 1004564978; // Collection ID cho entitled products

// Axios instance với auth header
const haravanApi = axios.create({
  baseURL: HARAVAN_BASE_URL,
  headers: {
    'Authorization': `Bearer ${HARAVAN_AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000 // 30s timeout
});

/**
 * Add 7 hours to timestamp (UTC -> UTC+7)
 * @param {Date|string} date
 * @returns {string} ISO 8601 string with +07:00 timezone
 */
function addSevenHours(date) {
  const d = new Date(date);
  // Add 7 hours in milliseconds
  const utcPlus7 = new Date(d.getTime() + (7 * 60 * 60 * 1000));
  return utcPlus7.toISOString().replace('Z', '+07:00');
}

/**
 * Create discount code in Haravan
 * @param {Object} params
 * @param {string} params.code - Discount code (e.g., "CBPY8G")
 * @param {number} params.value - Discount value (prize amount)
 * @param {string} params.starts_at - Start datetime (ISO string)
 * @param {string} params.ends_at - End datetime (ISO string)
 * @param {string} params.campaignId - Campaign ID for idempotency
 * @returns {Promise<Object>} Discount object with id, is_promotion, times_used, usage_limit
 */
async function createDiscount({ code, value, starts_at, ends_at, campaignId }) {
  try {
    console.log('📝 [HARAVAN] Creating discount:', { code, value });

    // Convert timestamps to UTC+7
    const startsAtUTC7 = addSevenHours(starts_at);
    const endsAtUTC7 = addSevenHours(ends_at);

    const body = {
      discount: {
        code,
        is_promotion: true,

        // Usage rules
        applies_once: true,
        usage_limit: 1,
        once_per_customer: true,
        rule_customs: [
          { name: "customer_limit_used", value: "1" }
        ],

        // Product selection (collection prerequisite)
        products_selection: "collection_prerequisite",
        entitled_collection_ids: [COLLECTION_ID],

        // Discount type & value
        take_type: "fixed_amount",
        value: value,
        discount_type: "product_amount",

        // Time range (UTC+7)
        starts_at: startsAtUTC7,
        ends_at: endsAtUTC7,

        // Selections (all customers, provinces, channels, locations)
        customers_selection: "all",
        provinces_selection: "all",
        channels_selection: "all",
        locations_selection: "all",
        location_ids: []
      }
    };

    const response = await haravanApi.post('/com/discounts.json', body, {
      headers: {
        'X-Idempotency-Key': `${campaignId}-${code}` // Prevent duplicate creation
      }
    });

    console.log('✅ [HARAVAN] Discount created successfully:', response.data.discount.id);

    return {
      discountId: response.data.discount.id,
      is_promotion: response.data.discount.is_promotion,
      times_used: response.data.discount.times_used || 0,
      usage_limit: response.data.discount.usage_limit || 1,
      code: response.data.discount.code
    };

  } catch (error) {
    console.error('❌ [HARAVAN] Create discount error:', error.response?.data || error.message);

    // Handle specific errors
    if (error.response?.status === 422) {
      throw new Error('Loại khuyến mãi không hợp lệ. Kiểm tra discount_type và take_type.');
    }
    if (error.response?.status === 409) {
      throw new Error('Mã giảm giá đã tồn tại trong Haravan.');
    }

    throw new Error(`Haravan API error: ${error.response?.data?.errors || error.message}`);
  }
}

/**
 * Get discount details from Haravan
 * @param {number} discountId - Haravan discount ID
 * @returns {Promise<Object>} Discount details
 */
async function getDiscount(discountId) {
  try {
    console.log('🔍 [HARAVAN] Fetching discount:', discountId);

    const response = await haravanApi.get(`/com/discounts/${discountId}.json`);
    const discount = response.data.discount;

    console.log('✅ [HARAVAN] Discount fetched:', {
      id: discount.id,
      code: discount.code,
      is_promotion: discount.is_promotion,
      times_used: discount.times_used
    });

    return {
      discountId: discount.id,
      code: discount.code,
      is_promotion: discount.is_promotion,
      times_used: discount.times_used || 0,
      usage_limit: discount.usage_limit || 1,
      starts_at: discount.starts_at,
      ends_at: discount.ends_at
    };

  } catch (error) {
    console.error('❌ [HARAVAN] Get discount error:', error.response?.data || error.message);

    if (error.response?.status === 404) {
      throw new Error('Mã giảm giá không tồn tại trong Haravan.');
    }

    throw new Error(`Haravan API error: ${error.response?.data?.errors || error.message}`);
  }
}

/**
 * Delete discount from Haravan
 * @param {number} discountId - Haravan discount ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteDiscount(discountId) {
  try {
    console.log('🗑️  [HARAVAN] Deleting discount:', discountId);

    await haravanApi.delete(`/com/discounts/${discountId}.json`);

    console.log('✅ [HARAVAN] Discount deleted successfully');

    return true;

  } catch (error) {
    console.error('❌ [HARAVAN] Delete discount error:', error.response?.data || error.message);

    if (error.response?.status === 404) {
      // Already deleted or doesn't exist
      console.warn('⚠️  [HARAVAN] Discount not found (already deleted?)');
      return true;
    }

    throw new Error(`Haravan API error: ${error.response?.data?.errors || error.message}`);
  }
}

/**
 * Calculate status based on Haravan rules
 * Rule 1: If is_promotion = false => expired
 * Rule 2: If is_promotion = true AND times_used < usage_limit => active
 * Rule 3: If is_promotion = true AND times_used >= usage_limit => used
 *
 * @param {boolean} is_promotion
 * @param {number} times_used
 * @param {number} usage_limit
 * @returns {string} Status: 'active' | 'expired' | 'used'
 */
function calculateStatus(is_promotion, times_used, usage_limit) {
  // Rule 1: Not a promotion => expired
  if (is_promotion === false) {
    return 'expired';
  }

  // Rule 2: Active promotion with available uses
  if (is_promotion === true && times_used < usage_limit) {
    return 'active';
  }

  // Rule 3: Promotion fully used
  if (is_promotion === true && times_used >= usage_limit) {
    return 'used';
  }

  // Fallback (should not reach here)
  return 'expired';
}

module.exports = {
  createDiscount,
  getDiscount,
  deleteDiscount,
  calculateStatus,
  COLLECTION_ID
};
