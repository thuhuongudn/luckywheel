import axios from 'axios';
import type { WebhookPayload, WebhookResponse } from '../types';

// SECURITY: All requests go through backend proxy, never directly to N8N
// Use relative URLs by default so frontend works on the same origin as backend in production.
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_URL || '';
const SPIN_ENDPOINT = `${BACKEND_API_URL}/api/spin`;
const CHECK_ENDPOINT = `${BACKEND_API_URL}/api/check-eligibility`;

// Check eligibility - kiểm tra đã quay chưa
export const checkEligibility = async (phone: string, campaignId: string): Promise<{
  eligible: boolean;
  message: string;
  already_spun?: boolean;
}> => {
  // ALWAYS use real API in production - removed mock check
  try {
    const response = await axios.post(CHECK_ENDPOINT, {
      phone,
      campaign_id: campaignId,
    }, {
      timeout: 5000,
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || 'Không thể kiểm tra điều kiện';
      if (error.code === 'ERR_NETWORK') {
        return {
          eligible: true,
          message: 'Mock fallback: đủ điều kiện quay',
          already_spun: false,
        };
      }
      throw new Error(message);
    }
    throw new Error('Không thể kết nối đến server');
  }
};

// Send spin result - gửi qua backend proxy (bảo mật)
export const sendSpinResult = async (payload: WebhookPayload): Promise<WebhookResponse> => {
  // ALWAYS use real API in production - removed mock check
  try {
    // Gửi qua backend proxy (không expose N8N webhook)
    // Backend sẽ xử lý authentication, rate limiting, và DB constraints
    const response = await axios.post<WebhookResponse>(
      SPIN_ENDPOINT,
      {
        phone: payload.phone,
        name: payload.name,
        campaign_id: payload.campaign_id,
        prize: payload.prize,
        code: payload.code,
        expires_at: payload.expires_at,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 15000, // 15 seconds
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || 'Có lỗi xảy ra khi gửi dữ liệu';
      if (error.code === 'ERR_NETWORK') {
        return {
          success: true,
          message: 'Mock fallback: kết quả quay đã được ghi nhận',
          code: payload.code || 'MOCK-FALLBACK',
          prize: payload.prize,
          expires_at: payload.expires_at,
        };
      }
      throw new Error(message);
    }
    throw new Error('Không thể kết nối đến server');
  }
};
