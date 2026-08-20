import { 
  AsaasPixQrCodeResponse, 
  generateMockPixQrCode, 
  buildAsaasPixPaymentPayload, 
  Order 
} from '@servicos/shared';

export interface PaymentProcessingState {
  status: 'idle' | 'generating_pix' | 'awaiting_payment' | 'confirmed' | 'failed';
  pixData?: AsaasPixQrCodeResponse;
  expiresInSeconds: number;
  errorMessage?: string;
}

export class RooServPaymentService {
  /**
   * Inicia o fluxo de pagamento Pix via Asaas / Custódia RooServ
   */
  public static async initiatePixCheckout(order: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    providerWalletId?: string;
  }): Promise<AsaasPixQrCodeResponse> {
    // 1. Gera código Pix dinâmico padronizado com identificador do pedido
    const pixResponse = generateMockPixQrCode(order.orderNumber, order.totalAmount);
    return pixResponse;
  }

  /**
   * Formata contador regressivo de tempo MM:SS
   */
  public static formatCountdown(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}
