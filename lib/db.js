/**
 * Database Service Layer
 * Purpose: Abstract database operations for lucky wheel spins
 */

const { supabase } = require('./supabase');
const crypto = require('crypto-js');

/**
 * Hash phone number with pepper for security
 * @param {string} phone - Raw phone number
 * @returns {string} SHA256 hash
 */
function hashPhone(phone) {
  const pepper = process.env.SECRET_PEPPER || 'default-pepper-change-me';
  return crypto.SHA256(phone + pepper).toString();
}

/**
 * Mask phone number for admin view
 * @param {string} phone - Raw phone number (e.g., "0912345678")
 * @returns {string} Masked phone (e.g., "091***5678")
 */
function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone;
  const start = phone.substring(0, 3);
  const end = phone.substring(phone.length - 4);
  return `${start}***${end}`;
}

/**
 * Check if phone has already spun for this campaign
 * @param {string} phone - Raw phone number
 * @param {string} campaignId - Campaign ID
 * @returns {Promise<{exists: boolean, spin?: object}>}
 */
async function checkPhoneExists(phone, campaignId) {
  try {
    // FIX: Check using phone_plain instead of phone_hash
    // This ensures duplicate check works regardless of SECRET_PEPPER value
    // across different environments (local vs production)
    const { data, error } = await supabase
      .from('lucky_wheel_spins')
      .select('id, created_at, prize, coupon_code, expires_at')
      .eq('campaign_id', campaignId)
      .eq('phone_plain', phone)  // Changed from phone_hash to phone_plain
      .single();

    if (error) {
      // PGRST116 means no rows found (not an error for us)
      if (error.code === 'PGRST116') {
        return { exists: false };
      }
      throw error;
    }

    return {
      exists: true,
      spin: {
        id: data.id,
        created_at: data.created_at,
        prize: data.prize,
        coupon_code: data.coupon_code,
        expires_at: data.expires_at
      }
    };
  } catch (err) {
    console.error('[DB] Error checking phone existence:', err.message);
    throw new Error('Database error checking phone');
  }
}

/**
 * Get active prize configuration for campaign
 * @param {string} campaignId - Campaign ID
 * @returns {Promise<Array>} List of active prizes with weights
 */
async function getActivePrizes(campaignId) {
  try {
    const { data, error } = await supabase
      .rpc('get_active_prizes', { p_campaign_id: campaignId });

    if (error) throw error;

    return data || [];
  } catch (err) {
    console.error('[DB] Error getting active prizes:', err.message);
    // Fallback to default prizes if function fails
    return [
      { prize_value: 20000, prize_label: '20.000đ', weight: 40, background_color: '#ffb8b8', font_size: '18px' },
      { prize_value: 30000, prize_label: '30.000đ', weight: 30, background_color: '#ffd88d', font_size: '18px' },
      { prize_value: 50000, prize_label: '50.000đ', weight: 20, background_color: '#b8e6b8', font_size: '18px' },
      { prize_value: 100000, prize_label: '100.000đ', weight: 10, background_color: '#ffc6ff', font_size: '18px' }
    ];
  }
}

/**
 * Select random prize based on weight distribution
 * @param {string} campaignId - Campaign ID
 * @returns {Promise<{prize_value: number, prize_label: string}>}
 */
async function selectRandomPrize(campaignId) {
  try {
    const { data, error } = await supabase
      .rpc('select_random_prize', { p_campaign_id: campaignId })
      .single();

    if (error) throw error;

    if (!data) {
      throw new Error('No active prizes available for this campaign');
    }

    return {
      prize_value: data.prize_value,
      prize_label: data.prize_label
    };
  } catch (err) {
    console.error('[DB] Error selecting random prize:', err.message);

    // Fallback: Manual random selection
    const prizes = await getActivePrizes(campaignId);
    if (prizes.length === 0) {
      throw new Error('No prizes configured for this campaign');
    }

    const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0);
    const random = Math.floor(Math.random() * totalWeight);

    let cumulativeWeight = 0;
    for (const prize of prizes) {
      cumulativeWeight += prize.weight;
      if (random < cumulativeWeight) {
        return {
          prize_value: prize.prize_value,
          prize_label: prize.prize_label
        };
      }
    }

    // Fallback to first prize
    return {
      prize_value: prizes[0].prize_value,
      prize_label: prizes[0].prize_label
    };
  }
}

/**
 * Save spin result to database
 * @param {object} spinData - Spin data
 * @returns {Promise<object>} Saved spin record
 */
async function saveSpin(spinData) {
  const {
    campaignId,
    phone,
    customerName,
    prize,
    couponCode,
    ipAddress,
    userAgent,
    expiresAt,
  } = spinData;

  console.log('\n🔍 [DB] saveSpin called with:', {
    campaignId,
    phone: maskPhone(phone),
    customerName,
    prize,
    expiresAt,
    couponCode,
    ipAddress: ipAddress?.substring(0, 20),
    userAgent: userAgent?.substring(0, 50)
  });

  try {
    const phoneHash = hashPhone(phone);
    const phoneMasked = maskPhone(phone);

    const basePayload = {
      campaign_id: campaignId,
      phone_hash: phoneHash,
      phone_masked: phoneMasked,
      phone_plain: phone,
      customer_name: customerName,
      prize: prize,
      expires_at: expiresAt,
      coupon_code: couponCode,
      ip_address: ipAddress,
      user_agent: userAgent,
      n8n_sent: false,
      created_at: new Date().toISOString()
    };

    console.log('📦 [DB] Payload prepared:', {
      campaign_id: basePayload.campaign_id,
      phone_hash: basePayload.phone_hash.substring(0, 16) + '...',
      phone_masked: basePayload.phone_masked,
      prize: basePayload.prize,
      expires_at: basePayload.expires_at,
      coupon_code: basePayload.coupon_code
    });

    console.log('💾 [DB] Attempting Supabase insert...');
    let insertPayload = { ...basePayload };
    let data;
    let error;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      ({ data, error } = await supabase
        .from('lucky_wheel_spins')
        .insert([insertPayload])
        .select()
        .single());

      console.log('📊 [DB] Insert result:', {
        attempt: attempt + 1,
        hasData: !!data,
        hasError: !!error,
        errorCode: error?.code,
        errorMessage: error?.message,
        errorDetails: error?.details,
        errorHint: error?.hint
      });

      if (!error) {
        break;
      }

      if (error.code === '42703') {
        const missingColumnMatch = error.message?.match(/column "(.+?)"/i);
        const missingColumn = missingColumnMatch?.[1];
        if (missingColumn && Object.prototype.hasOwnProperty.call(insertPayload, missingColumn)) {
          console.warn(`⚠️  [DB] Column ${missingColumn} missing. Retrying without it.`);
          const { [missingColumn]: _, ...rest } = insertPayload;
          insertPayload = rest;
          continue;
        }
      }

      break;
    }

    if (error) {
      console.error('❌ [DB] Supabase error object:', JSON.stringify(error, null, 2));

      // Check for unique constraint violation (race condition)
      if (error.code === '23505') {
        console.log('⚠️  [DB] Duplicate phone detected (23505)');
        throw new Error('DUPLICATE_PHONE');
      }

      console.error('❌ [DB] Throwing Supabase error');
      throw error;
    }

    console.log('✅ [DB] Spin saved successfully:', {
      id: data?.id,
      campaign_id: data?.campaign_id,
      prize: data?.prize,
      coupon_code: data?.coupon_code,
      expires_at: data?.expires_at
    });

    return data;
  } catch (err) {
    console.error('❌ [DB] Exception in saveSpin:');
    console.error('   - Error message:', err.message);
    console.error('   - Error code:', err.code);
    console.error('   - Error details:', err.details);
    console.error('   - Full error:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));

    if (err.message === 'DUPLICATE_PHONE') {
      throw err;
    }

    throw new Error('Database error saving spin: ' + err.message);
  }
}

/**
 * Update N8N send status
 * @param {string} spinId - Spin record ID
 * @param {boolean} success - Whether N8N send was successful
 * @param {object} response - N8N response data
 * @param {string} error - Error message if failed
 */
async function updateN8NStatus(spinId, success, response = null, error = null) {
  try {
    const updates = {
      n8n_sent: success,
      n8n_sent_at: success ? new Date().toISOString() : null,
      n8n_response: response,
      n8n_error: error
    };

    if (!success) {
      // Increment retry count
      const { data: currentSpin } = await supabase
        .from('lucky_wheel_spins')
        .select('n8n_retry_count')
        .eq('id', spinId)
        .single();

      if (currentSpin) {
        updates.n8n_retry_count = (currentSpin.n8n_retry_count || 0) + 1;
      }
    }

    const { error: updateError } = await supabase
      .from('lucky_wheel_spins')
      .update(updates)
      .eq('id', spinId);

    if (updateError) throw updateError;

    console.log(`[DB] Updated N8N status for spin ${spinId}: ${success ? 'SUCCESS' : 'FAILED'}`);
  } catch (err) {
    console.error('[DB] Error updating N8N status:', err.message);
    // Don't throw - this is not critical
  }
}

/**
 * Get spin statistics for campaign
 * @param {string} campaignId - Campaign ID
 * @returns {Promise<object>} Statistics
 */
async function getSpinStatistics(campaignId) {
  try {
    const { data, error } = await supabase
      .rpc('get_spin_statistics', { p_campaign_id: campaignId })
      .single();

    if (error) throw error;

    return data || {
      total_spins: 0,
      prize_20k_count: 0,
      prize_30k_count: 0,
      prize_50k_count: 0,
      prize_100k_count: 0,
      total_prize_value: 0,
      n8n_success_count: 0,
      n8n_failed_count: 0
    };
  } catch (err) {
    console.error('[DB] Error getting statistics:', err.message);
    return null;
  }
}

module.exports = {
  hashPhone,
  maskPhone,
  checkPhoneExists,
  getActivePrizes,
  selectRandomPrize,
  saveSpin,
  updateN8NStatus,
  getSpinStatistics
};
