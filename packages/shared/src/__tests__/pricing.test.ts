import { describe, it, expect } from 'vitest';
import { 
  calculateServiceSplit, 
  calculateCheckoutPricing, 
  calculateInstallments, 
  formatCurrencyBRL 
} from '../utils/pricing';

describe('RooServ Pricing & Split Engine', () => {
  it('calculates 12% platform take rate correctly for Pix', () => {
    const split = calculateServiceSplit(100, 12);
    expect(split.totalAmount).toBe(100);
    expect(split.platformFeeAmount).toBe(12);
    expect(split.providerPayoutAmount).toBe(88);
  });

  it('formats BRL currency correctly', () => {
    const formatted = formatCurrencyBRL(1250.5);
    expect(formatted).toContain('1.250,50');
  });

  it('calculates checkout pricing for Pix with 0% extra surcharge', () => {
    const pricing = calculateCheckoutPricing({
      serviceAmount: 200,
      paymentMethod: 'pix',
      installments: 1,
    });

    expect(pricing.serviceBaseAmount).toBe(200);
    expect(pricing.totalChargedToClient).toBe(200);
    expect(pricing.gatewayFeeChargedToBuyer).toBe(0);
    expect(pricing.providerPayoutAmount).toBe(176); // 200 - 12% = 176
    expect(pricing.platformFeeAmount).toBe(24); // 12% of 200 = 24
  });

  it('calculates checkout pricing for 1x credit card adding gateway fee to customer', () => {
    const pricing = calculateCheckoutPricing({
      serviceAmount: 200,
      paymentMethod: 'credit_card',
      installments: 1,
    });

    // 200 + (200 * 0.0299 + 0.49) = 200 + 5.98 + 0.49 = 206.47
    expect(pricing.totalChargedToClient).toBeGreaterThan(200);
    expect(pricing.providerPayoutAmount).toBe(176);
    expect(pricing.platformFeeAmount).toBe(24);
  });

  it('generates 12 installment simulations with compound buyer interest', () => {
    const installments = calculateInstallments(300, 12);
    expect(installments).toHaveLength(12);
    expect(installments[0].installments).toBe(1);
    expect(installments[11].installments).toBe(12);
    expect(installments[11].totalWithInterest).toBeGreaterThan(installments[0].totalWithInterest);
  });
});
