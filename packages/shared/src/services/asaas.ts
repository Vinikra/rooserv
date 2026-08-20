// ==============================================================================
// ROOSERV - INTEGRAÇÃO ASAAS PAYMENT GATEWAY (PIX, CARTÃO E SPLIT AUTOMÁTICO)
// ==============================================================================

export type AsaasBillingType = 'PIX' | 'CREDIT_CARD' | 'BOLETO';

export type AsaasPaymentStatus =
  | 'PENDING'
  | 'RECEIVED'
  | 'CONFIRMED'
  | 'OVERDUE'
  | 'REFUNDED'
  | 'RECEIVED_IN_CASH'
  | 'REFUND_REQUESTED'
  | 'CHARGEBACK_REQUESTED'
  | 'AWAITING_RISK_ANALYSIS';

export interface AsaasSplitConfig {
  walletId: string;
  percentualValue?: number; // Ex: 88.0 para o prestador
  fixedValue?: number;
  description?: string;
}

export interface AsaasCustomerData {
  name: string;
  cpfCnpj: string;
  email: string;
  phone?: string;
  mobilePhone?: string;
  address?: string;
  addressNumber?: string;
  province?: string; // Bairro em Rondonópolis
  postalCode?: string;
}

export interface CreateAsaasPaymentParams {
  customerId: string;
  billingType: AsaasBillingType;
  value: number;
  dueDate: string; // YYYY-MM-DD
  description: string;
  externalReference: string; // orderId do RooServ
  splits?: AsaasSplitConfig[];
  installmentCount?: number;
  installmentValue?: number;
}

export interface AsaasPixQrCodeResponse {
  encodedImage: string; // Base64 da imagem do QR Code
  payload: string; // String Pix Copia e Cola (BR Code)
  expirationDate: string;
}

export interface AsaasPaymentResponse {
  id: string;
  dateCreated: string;
  customer: string;
  paymentLink?: string;
  value: number;
  netValue: number;
  billingType: AsaasBillingType;
  status: AsaasPaymentStatus;
  dueDate: string;
  originalValue?: number;
  interestValue?: number;
  description: string;
  externalReference: string;
  canBePaidWithPix: boolean;
  pixTransaction?: string;
}

export interface AsaasWebhookPayload {
  event:
    | 'PAYMENT_CREATED'
    | 'PAYMENT_RECEIVED'
    | 'PAYMENT_CONFIRMED'
    | 'PAYMENT_REFUNDED'
    | 'PAYMENT_OVERDUE'
    | 'TRANSFER_CREATED'
    | 'TRANSFER_DONE';
  payment: AsaasPaymentResponse;
}

/**
 * Constrói payload padronizado para criação de cobrança Pix com Split de 12% RooServ
 */
export function buildAsaasPixPaymentPayload(params: {
  customerId: string;
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  providerWalletId?: string;
  platformFeePercent?: number; // Padrão 12%
}): CreateAsaasPaymentParams {
  const feePercent = params.platformFeePercent ?? 12.0;
  const providerPercent = 100.0 - feePercent; // 88%

  const today = new Date();
  const dueDate = today.toISOString().split('T')[0];

  const splits: AsaasSplitConfig[] = [];

  if (params.providerWalletId) {
    splits.push({
      walletId: params.providerWalletId,
      percentualValue: providerPercent,
      description: `Repasse de 88% ao prestador de serviços RooServ`,
    });
  }

  return {
    customerId: params.customerId,
    billingType: 'PIX',
    value: params.totalAmount,
    dueDate,
    description: `RooServ Rondonópolis - Pedido ${params.orderNumber} (Custódia Segura)`,
    externalReference: params.orderId,
    splits: splits.length > 0 ? splits : undefined,
  };
}

/**
 * Gera um Pix Copia e Cola dinâmico e mock base64 QR Code ultra-realista
 * para ambiente de desenvolvimento ou modo offline resiliente
 */
export function generateMockPixQrCode(orderNumber: string, amount: number): AsaasPixQrCodeResponse {
  const cleanAmount = amount.toFixed(2);
  const pixCode = `00020126580014br.gov.bcb.pix0136${orderNumber.toLowerCase()}-rooserv-rondonopolis520400005303986540${cleanAmount.length}${cleanAmount}5802BR5915ROOSERV MT LTDA6012RONDONOPOLIS62070503***6304`;

  // Imagem mock SVG de um QR Code limpo estilizado
  const qrSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"><rect width="200" height="200" fill="#ffffff"/><rect x="20" y="20" width="50" height="50" fill="#0f172a"/><rect x="30" y="30" width="30" height="30" fill="#ffffff"/><rect x="37" y="37" width="16" height="16" fill="#0f172a"/><rect x="130" y="20" width="50" height="50" fill="#0f172a"/><rect x="140" y="30" width="30" height="30" fill="#ffffff"/><rect x="147" y="37" width="16" height="16" fill="#0f172a"/><rect x="20" y="130" width="50" height="50" fill="#0f172a"/><rect x="30" y="140" width="30" height="30" fill="#ffffff"/><rect x="37" y="147" width="16" height="16" fill="#0f172a"/><rect x="85" y="25" width="20" height="20" fill="#2563eb"/><rect x="90" y="80" width="20" height="40" fill="#0f172a"/><rect x="130" y="90" width="40" height="20" fill="#0f172a"/><rect x="30" y="90" width="40" height="20" fill="#0f172a"/><rect x="80" y="140" width="40" height="20" fill="#0f172a"/><rect x="135" y="135" width="40" height="40" fill="#2563eb"/></svg>`;

  const base64Image =
    typeof (globalThis as any).btoa === 'function'
      ? (globalThis as any).btoa(qrSvg)
      : typeof (globalThis as any).Buffer !== 'undefined'
      ? (globalThis as any).Buffer.from(qrSvg).toString('base64')
      : '';

  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + 15);

  return {
    encodedImage: `data:image/svg+xml;base64,${base64Image}`,
    payload: pixCode,
    expirationDate: expiry.toISOString(),
  };
}
