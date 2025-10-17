export interface PrizeFont {
  text: string;
  top?: string;
  fontSize?: string;
  fontColor?: string;
  fontWeight?: string;
  lineHeight?: string;
  fontFamily?: string;
}

export interface Prize {
  background: string;
  fonts: PrizeFont[];
  value: number; // Giá trị mã giảm giá (20000, 30000, 50000, 100000)
}

export interface SpinResult {
  prize: number;
  code?: string;
  message?: string;
}

export interface WebhookPayload {
  campaign_id: string;
  phone: string;
  name: string;
  code: string;
  prize: number;
  timestamp: number;
  user_agent: string;
  expires_at?: string;
}

export interface WebhookResponse {
  success: boolean;
  message: string;
  code?: string;
  prize?: number;
  expires_at?: string;
}
