import axios from 'axios';
import type { SpinRecord, SpinStatistics, PrizeDistribution } from '../types/admin';

const CAMPAIGN_ID = import.meta.env.VITE_CAMPAIGN_ID || 'lucky-wheel-2025-10-14';
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || '';

export const adminApi = {
  // Fetch all spins with status
  async getSpins(): Promise<SpinRecord[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/admin/spins`, {
        params: { campaign_id: CAMPAIGN_ID }
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to fetch spins');
      }

      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching spins:', error);
      throw error;
    }
  },

  // Get statistics using the database function
  async getStatistics(): Promise<SpinStatistics> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/admin/statistics`, {
        params: { campaign_id: CAMPAIGN_ID }
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to fetch statistics');
      }

      return response.data.data || {
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
      };
    } catch (error) {
      console.error('Error fetching statistics:', error);
      throw error;
    }
  },

  // Get prize distribution with status filter
  async getPrizeDistribution(): Promise<PrizeDistribution[]> {
    const spins = await this.getSpins();

    const prizes = [20000, 30000, 50000, 100000];
    return prizes.map(prize => {
      const prizeSpins = spins.filter(s => s.prize === prize);
      return {
        prize,
        total: prizeSpins.length,
        active: prizeSpins.filter(s => s.status === 'active').length,
        expired: prizeSpins.filter(s => s.status === 'expired').length,
        used: prizeSpins.filter(s => s.status === 'used').length,
        inactive: 0, // Removed 'inactive' status - always return 0
      };
    });
  },

  // Update spin status (for future use)
  async updateSpinStatus(id: string, status: SpinRecord['status']): Promise<void> {
    try {
      const response = await axios.put(`${API_BASE_URL}/api/admin/spins/${id}/status`, {
        status
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating spin status:', error);
      throw error;
    }
  },

  // Haravan Integration APIs

  // Create Haravan discount code
  async createHaravanDiscount(spinId: string): Promise<any> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/admin/haravan/create-discount`, {
        spinId
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to create discount');
      }

      return response.data;
    } catch (error: any) {
      console.error('Error creating Haravan discount:', error);
      throw new Error(error.response?.data?.message || error.message);
    }
  },

  // Refresh status for all active spins
  async refreshHaravanStatus(): Promise<any> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/admin/haravan/refresh-status`);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to refresh status');
      }

      return response.data;
    } catch (error: any) {
      console.error('Error refreshing Haravan status:', error);
      throw new Error(error.response?.data?.message || error.message);
    }
  },

  // Delete Haravan discount
  async deleteHaravanDiscount(spinId: string): Promise<void> {
    try {
      const response = await axios.delete(`${API_BASE_URL}/api/admin/haravan/discount/${spinId}`);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to delete discount');
      }
    } catch (error: any) {
      console.error('Error deleting Haravan discount:', error);
      throw new Error(error.response?.data?.message || error.message);
    }
  }
};
