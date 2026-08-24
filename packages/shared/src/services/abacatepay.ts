export interface AbacatePayPixQrCodeResponse {
  encodedImage: string;
  payload: string;
  expirationDate: string;
  success?: boolean;
}

export type AbacatePayTransparentStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'REFUNDED';

export interface AbacatePayTransparentPayment {
  id: string;
  externalId: string;
  amount: number;
  status: AbacatePayTransparentStatus;
  brCode?: string;
  brCodeBase64?: string;
  expiresAt?: string;
}
