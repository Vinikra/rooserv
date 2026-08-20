export const DEFAULT_PLATFORM_FEE_PERCENT = 12.0; // 12% take rate RooServ
export const CREDIT_CARD_SURCHARGE_PERCENT = 2.99; // Taxa de intermediação de cartão (repassada ao comprador)
export const CREDIT_CARD_FIXED_FEE = 0.49; // Taxa fixa por transação de cartão
export const MONTHLY_INSTALLMENT_INTEREST_RATE = 0.0239; // 2.39% a.m. (juros de parcelamento repassado ao pagador)

export interface SplitCalculation {
  totalAmount: number;
  platformFeePercent: number;
  platformFeeAmount: number;
  providerPayoutAmount: number;
}

/**
 * Calcula o split do serviço base entre a plataforma e o prestador
 */
export function calculateServiceSplit(
  serviceAmount: number,
  platformFeePercent: number = DEFAULT_PLATFORM_FEE_PERCENT
): SplitCalculation {
  const feeAmount = Number(((serviceAmount * platformFeePercent) / 100).toFixed(2));
  const providerAmount = Number((serviceAmount - feeAmount).toFixed(2));

  return {
    totalAmount: serviceAmount,
    platformFeePercent,
    platformFeeAmount: feeAmount,
    providerPayoutAmount: providerAmount,
  };
}

export interface InstallmentOption {
  installments: number;
  installmentAmount: number;
  totalWithInterest: number;
  hasInterest: boolean;
  gatewayFeeAdded: number;
}

/**
 * Simula as opções de parcelamento no Cartão de Crédito
 * O custo financeiro do gateway é 100% repassado ao comprador (pagador),
 * garantindo que a margem da administração (12%) e do prestador (88%) fiquem intocadas.
 */
export function calculateInstallments(
  serviceAmount: number,
  maxInstallments: number = 12
): InstallmentOption[] {
  const options: InstallmentOption[] = [];

  for (let i = 1; i <= maxInstallments; i++) {
    if (i === 1) {
      // 1x no Cartão: Apenas a taxa de processamento do cartão (2.99% + R$ 0,49)
      const gatewayFee = Number(((serviceAmount * CREDIT_CARD_SURCHARGE_PERCENT) / 100 + CREDIT_CARD_FIXED_FEE).toFixed(2));
      const totalCharged = Number((serviceAmount + gatewayFee).toFixed(2));

      options.push({
        installments: 1,
        installmentAmount: totalCharged,
        totalWithInterest: totalCharged,
        hasInterest: false,
        gatewayFeeAdded: gatewayFee,
      });
    } else {
      // 2x a 12x no Cartão: Amortização com juros repassados ao comprador
      const factor =
        (MONTHLY_INSTALLMENT_INTEREST_RATE * Math.pow(1 + MONTHLY_INSTALLMENT_INTEREST_RATE, i)) /
        (Math.pow(1 + MONTHLY_INSTALLMENT_INTEREST_RATE, i) - 1);
      
      const installmentValue = Number((serviceAmount * factor).toFixed(2));
      const totalCharged = Number((installmentValue * i).toFixed(2));
      const gatewayFee = Number((totalCharged - serviceAmount).toFixed(2));

      options.push({
        installments: i,
        installmentAmount: installmentValue,
        totalWithInterest: totalCharged,
        hasInterest: true,
        gatewayFeeAdded: gatewayFee,
      });
    }
  }

  return options;
}

export interface CheckoutPricingBreakdown {
  serviceBaseAmount: number;          // Ex: R$ 200,00 (Valor acordado do serviço)
  paymentMethod: 'pix' | 'credit_card';
  installments: number;
  gatewayFeeChargedToBuyer: number;   // Taxa do cartão repassada ao morador
  totalChargedToClient: number;       // Total final pago pelo morador
  platformFeeAmount: number;          // 12% RooServ INTOCADO (Ex: R$ 24,00)
  platformFeePercent: number;         // 12.0%
  providerPayoutAmount: number;       // 88% Prestador INTOCADO (Ex: R$ 176,00)
  installmentValue: number;           // Valor de cada parcela
}

/**
 * Calcula a precificação completa do checkout:
 * - No Pix: Cliente paga exatamente o valor base com desconto/à vista.
 * - No Cartão: O acréscimo de gateway é somado no total do cliente.
 * - Em todos os casos, a administração recebe os 12% cheios e o prestador recebe os 88% cheios!
 */
export function calculateCheckoutPricing(params: {
  serviceAmount: number;
  paymentMethod: 'pix' | 'credit_card';
  installments?: number;
  platformFeePercent?: number;
}): CheckoutPricingBreakdown {
  const feePercent = params.platformFeePercent ?? DEFAULT_PLATFORM_FEE_PERCENT;
  const split = calculateServiceSplit(params.serviceAmount, feePercent);
  const installments = params.installments ?? 1;

  if (params.paymentMethod === 'pix') {
    return {
      serviceBaseAmount: params.serviceAmount,
      paymentMethod: 'pix',
      installments: 1,
      gatewayFeeChargedToBuyer: 0,
      totalChargedToClient: params.serviceAmount,
      platformFeeAmount: split.platformFeeAmount,
      platformFeePercent: feePercent,
      providerPayoutAmount: split.providerPayoutAmount,
      installmentValue: params.serviceAmount,
    };
  }

  // Cartão de Crédito
  const installmentOptions = calculateInstallments(params.serviceAmount, 12);
  const selectedOpt = installmentOptions.find((o) => o.installments === installments) || installmentOptions[0];

  return {
    serviceBaseAmount: params.serviceAmount,
    paymentMethod: 'credit_card',
    installments: selectedOpt.installments,
    gatewayFeeChargedToBuyer: selectedOpt.gatewayFeeAdded,
    totalChargedToClient: selectedOpt.totalWithInterest,
    platformFeeAmount: split.platformFeeAmount,
    platformFeePercent: feePercent,
    providerPayoutAmount: split.providerPayoutAmount,
    installmentValue: selectedOpt.installmentAmount,
  };
}

/**
 * Formata valor em moeda brasileira (BRL)
 */
export function formatCurrencyBRL(amount: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);
}
