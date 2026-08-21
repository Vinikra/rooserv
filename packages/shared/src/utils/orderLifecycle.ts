import { OrderStatus } from '../types';

export function canProviderCompleteOrder(status: OrderStatus): boolean {
  return status === 'payment_in_escrow' || status === 'in_progress';
}

export function canClientReleaseEscrow(status: OrderStatus): boolean {
  return status === 'completed_by_provider';
}

export function canParticipantOpenDispute(status: OrderStatus): boolean {
  return status === 'payment_in_escrow' || status === 'in_progress' || status === 'completed_by_provider';
}
