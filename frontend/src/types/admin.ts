export interface SpinRecord {
  id: string;
  campaign_id: string;
  customer_name: string;
  phone_plain: string;
  phone_masked?: string;
  prize: number;
  coupon_code: string;
  status: 'active' | 'expired' | 'used';  // Removed 'inactive'
  created_at: string;
  expires_at: string;
  n8n_sent?: boolean;
  // Haravan fields
  discount_id?: number | null;
  is_promotion?: boolean;
  times_used?: number;
  usage_limit?: number;
}

export interface SpinStatistics {
  total_spins: number;
  active_count: number;
  inactive_count: number;
  expired_count: number;
  used_count: number;
  prize_20k_count: number;
  prize_30k_count: number;
  prize_50k_count: number;
  prize_100k_count: number;
  total_prize_value: number;
  active_value: number;
  used_value: number;
  potential_value: number;
}

export interface PrizeDistribution {
  prize: number;
  total: number;
  active: number;
  expired: number;
  used: number;
  inactive: number;
}
