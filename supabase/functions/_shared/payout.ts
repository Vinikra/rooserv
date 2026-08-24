export type AbacatePayWithdrawalStatus =
  | 'PENDING'
  | 'COMPLETE'
  | 'COMPLETED'
  | 'DONE'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface AbacatePayWithdrawal {
  id?: string;
  amount?: number;
  status?: AbacatePayWithdrawalStatus;
  externalId?: string;
  receiptUrl?: string | null;
  kind?: string;
}

export function normalizePixKey(key: string, type: string) {
  const normalizedType = type.toLowerCase();
  if (normalizedType === 'cpf' || normalizedType === 'cnpj') return key.replace(/\D/g, '');
  if (normalizedType === 'phone') {
    const digits = key.replace(/\D/g, '');
    return digits.startsWith('55') ? digits.slice(2) : digits;
  }
  if (normalizedType === 'email') return key.trim().toLowerCase();
  return key.trim();
}

export function mapPixKeyType(type: string) {
  const types: Record<string, string> = {
    cpf: 'CPF',
    cnpj: 'CNPJ',
    email: 'EMAIL',
    phone: 'PHONE',
    random: 'RANDOM',
    evp: 'RANDOM',
  };
  return types[type.toLowerCase()] || 'RANDOM';
}

export function mapWithdrawalStatus(status?: AbacatePayWithdrawalStatus) {
  if (status === 'COMPLETE' || status === 'COMPLETED' || status === 'DONE') return 'DONE';
  if (status === 'FAILED' || status === 'CANCELLED' || status === 'REFUNDED') return 'FAILED';
  return 'PENDING';
}

export function isWithdrawalNotFoundResponse(status: number, error?: string | null) {
  if (status === 404) return true;
  if (status !== 400 || typeof error !== 'string') return false;

  const normalized = error
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  return normalized === 'not found'
    || normalized.includes('saque nao encontrado');
}

export function validateWithdrawal(
  withdrawal: AbacatePayWithdrawal,
  payoutRequestId: string,
  amountCents: number,
  expectedGatewayId?: string | null,
) {
  if (!withdrawal.id || !withdrawal.status) return 'Resposta de saque inválida da AbacatePay.';
  if (withdrawal.kind && withdrawal.kind !== 'WITHDRAW') return 'Operação divergente da solicitação local.';
  if (withdrawal.externalId !== payoutRequestId) return 'Referência externa divergente no saque.';
  if (Number(withdrawal.amount) !== amountCents) return 'Valor divergente no saque.';
  if (expectedGatewayId && withdrawal.id !== expectedGatewayId) return 'Identificador divergente no saque.';
  return null;
}
