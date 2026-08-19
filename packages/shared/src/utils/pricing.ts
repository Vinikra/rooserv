export const DEFAULT_PLATFORM_FEE_PERCENT = 12.0; // 12% take rate

export interface SplitCalculation {
  totalAmount: number;
  platformFeePercent: number;
  platformFeeAmount: number;
  providerPayoutAmount: number;
}

/**
 * Calcula o split do serviço entre a plataforma e o prestador
 */
export function calculateServiceSplit(
  totalAmount: number,
  platformFeePercent: number = DEFAULT_PLATFORM_FEE_PERCENT
): SplitCalculation {
  const feeAmount = Number(((totalAmount * platformFeePercent) / 100).toFixed(2));
  const providerAmount = Number((totalAmount - feeAmount).toFixed(2));

  return {
    totalAmount,
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
}

/**
 * Simula as opções de parcelamento no Cartão de Crédito
 * Ex: até 3x sem juros ou até 12x com taxa padrão de cartão
 */
export function calculateInstallments(
  totalAmount: number,
  maxInstallments: number = 12,
  interestFreeLimit: number = 3
): InstallmentOption[] {
  const options: InstallmentOption[] = [];
  const monthlyInterestRate = 0.0249; // 2.49% a.m (padrão médio gateway Brasil)

  for (let i = 1; i <= maxInstallments; i++) {
    if (i <= interestFreeLimit) {
      options.push({
        installments: i,
        installmentAmount: Number((totalAmount / i).toFixed(2)),
        totalWithInterest: totalAmount,
        hasInterest: false,
      });
    } else {
      // Fórmula de amortização Price
      const factor =
        (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, i)) /
        (Math.pow(1 + monthlyInterestRate, i) - 1);
      const installmentValue = Number((totalAmount * factor).toFixed(2));
      const totalFinal = Number((installmentValue * i).toFixed(2));

      options.push({
        installments: i,
        installmentAmount: installmentValue,
        totalWithInterest: totalFinal,
        hasInterest: true,
      });
    }
  }

  return options;
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
