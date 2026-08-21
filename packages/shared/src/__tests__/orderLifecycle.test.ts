import { describe, expect, it } from 'vitest';
import {
  canClientReleaseEscrow,
  canParticipantOpenDispute,
  canProviderCompleteOrder,
} from '../utils/orderLifecycle';

describe('secure order lifecycle', () => {
  it('only lets providers complete funded or active work', () => {
    expect(canProviderCompleteOrder('payment_in_escrow')).toBe(true);
    expect(canProviderCompleteOrder('in_progress')).toBe(true);
    expect(canProviderCompleteOrder('awaiting_payment')).toBe(false);
    expect(canProviderCompleteOrder('disputed')).toBe(false);
  });

  it('only releases escrow after provider completion', () => {
    expect(canClientReleaseEscrow('completed_by_provider')).toBe(true);
    expect(canClientReleaseEscrow('payment_in_escrow')).toBe(false);
    expect(canClientReleaseEscrow('approved_by_client')).toBe(false);
  });

  it('only opens disputes while funds are held and work is active', () => {
    expect(canParticipantOpenDispute('payment_in_escrow')).toBe(true);
    expect(canParticipantOpenDispute('in_progress')).toBe(true);
    expect(canParticipantOpenDispute('completed_by_provider')).toBe(true);
    expect(canParticipantOpenDispute('awaiting_payment')).toBe(false);
    expect(canParticipantOpenDispute('refunded')).toBe(false);
  });
});
