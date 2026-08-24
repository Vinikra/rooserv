import { supabase } from '../lib/supabase';

export type PixGatewayStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'REFUNDED';

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
  devMode?: boolean;
  gatewayStatus?: PixGatewayStatus;
  error?: string;
}

export interface PixPaymentStatusResult {
  success: boolean;
  gatewayStatus?: PixGatewayStatus;
  orderStatus?: string;
  confirmed?: boolean;
  devMode?: boolean;
  expiresAt?: string | null;
  rateLimited?: boolean;
  error?: string;
}

export interface SandboxSimulationResult {
  success: boolean;
  simulated?: boolean;
  reconciled?: boolean;
  gatewayStatus?: PixGatewayStatus;
  devMode?: boolean;
  error?: string;
}

export interface PaymentProcessingState {
  status: 'idle' | 'generating_pix' | 'awaiting_payment' | 'confirmed' | 'failed';
  pixData?: PixChargeResult;
  expiresInSeconds: number;
  errorMessage?: string;
}

export class RooServPaymentService {
  private static async invokePaymentFunction<T extends { success: boolean; error?: string }>(
    functionName: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return { success: false, error: 'Usuário não autenticado.' } as T;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const responseBody = await response.text();
      let result: T;
      try {
        result = JSON.parse(responseBody) as T;
      } catch {
        return { success: false, error: 'O servidor de pagamentos retornou uma resposta inválida.' } as T;
      }

      if (!response.ok || !result.success) {
        return {
          ...result,
          success: false,
          error: result.error || 'A operação de pagamento não foi concluída.',
        };
      }
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof DOMException && error.name === 'AbortError'
          ? 'A consulta ao servidor de pagamentos excedeu o tempo limite.'
          : 'Erro de comunicação com o servidor de pagamentos.',
      } as T;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  /**
   * Inicia o fluxo de pagamento Pix via AbacatePay no backend.
   * A chave de API fica segura no backend (Edge Function), nunca no frontend.
   */
  public static async initiatePixCheckout(order: {
    id: string;
  }): Promise<PixChargeResult> {
    try {
      return await this.invokePaymentFunction<PixChargeResult>('create-pix-charge', {
        orderId: order.id,
      });
    } catch (err) {
      console.error('[RooServPaymentService] Erro:', err);
      return {
        success: false,
        error: 'Erro de comunicação com o servidor de pagamentos.',
      };
    }
  }

  public static async checkPixPayment(orderId: string): Promise<PixPaymentStatusResult> {
    return this.invokePaymentFunction<PixPaymentStatusResult>('check-pix-payment', { orderId });
  }

  public static async simulateSandboxPixPayment(orderId: string): Promise<SandboxSimulationResult> {
    return this.invokePaymentFunction<SandboxSimulationResult>('simulate-pix-payment', { orderId });
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
