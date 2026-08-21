import { supabase } from '../lib/supabase';

export interface PixChargeResult {
  success: boolean;
  paymentId?: string;
  pixQrCode?: {
    encodedImage: string; // Base64 da imagem do QR Code
    payload: string;      // Código copia-e-cola do Pix
    expirationDate: string;
  };
  amount?: number;
  dueDate?: string;
  error?: string;
}

export interface PaymentProcessingState {
  status: 'idle' | 'generating_pix' | 'awaiting_payment' | 'confirmed' | 'failed';
  pixData?: PixChargeResult;
  expiresInSeconds: number;
  errorMessage?: string;
}

export class RooServPaymentService {
  /**
   * Inicia o fluxo de pagamento Pix via Edge Function (Asaas real)
   * A chave de API fica segura no backend (Edge Function), nunca no frontend.
   */
  public static async initiatePixCheckout(order: {
    id: string;
  }): Promise<PixChargeResult> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        return { success: false, error: 'Usuário não autenticado.' };
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/create-pix-charge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: order.id,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        return {
          success: false,
          error: result.error || 'Erro ao gerar cobrança Pix.',
        };
      }

      return {
        success: true,
        paymentId: result.paymentId,
        pixQrCode: result.pixQrCode,
        amount: result.amount,
        dueDate: result.dueDate,
      };
    } catch (err) {
      console.error('[RooServPaymentService] Erro:', err);
      return {
        success: false,
        error: 'Erro de comunicação com o servidor de pagamentos.',
      };
    }
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
