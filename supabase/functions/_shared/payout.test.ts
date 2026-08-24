import { describe, expect, it } from 'vitest';
import {
  mapPixKeyType,
  mapWithdrawalStatus,
  isWithdrawalNotFoundResponse,
  normalizePixKey,
  validateWithdrawal,
} from './payout';

describe('payout helpers', () => {
  it('normaliza chaves Pix sem alterar EVP', () => {
    expect(normalizePixKey('123.456.789-01', 'cpf')).toBe('12345678901');
    expect(normalizePixKey('+55 (65) 99999-9999', 'phone')).toBe('65999999999');
    expect(normalizePixKey(' User@Example.COM ', 'email')).toBe('user@example.com');
    expect(normalizePixKey(' 123e4567-e89b-12d3-a456-426614174000 ', 'evp'))
      .toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(mapPixKeyType('evp')).toBe('RANDOM');
  });

  it('mapeia apenas estados finais conhecidos', () => {
    expect(mapWithdrawalStatus('PENDING')).toBe('PENDING');
    expect(mapWithdrawalStatus('COMPLETE')).toBe('DONE');
    expect(mapWithdrawalStatus('FAILED')).toBe('FAILED');
    expect(mapWithdrawalStatus(undefined)).toBe('PENDING');
  });

  it('reconhece somente respostas explícitas de saque inexistente', () => {
    expect(isWithdrawalNotFoundResponse(404, null)).toBe(true);
    expect(isWithdrawalNotFoundResponse(400, 'Not found')).toBe(true);
    expect(isWithdrawalNotFoundResponse(400, 'Saque não encontrado com o externalId fornecido.')).toBe(true);
    expect(isWithdrawalNotFoundResponse(400, 'Invalid Pix key')).toBe(false);
    expect(isWithdrawalNotFoundResponse(401, 'Not found')).toBe(false);
  });

  it('rejeita respostas divergentes do saque solicitado', () => {
    const valid = {
      id: 'tran_123',
      status: 'PENDING' as const,
      externalId: 'payout_123',
      amount: 5000,
      kind: 'WITHDRAW',
    };

    expect(validateWithdrawal(valid, 'payout_123', 5000)).toBeNull();
    expect(validateWithdrawal({ ...valid, externalId: 'outro' }, 'payout_123', 5000))
      .toContain('Referência externa');
    expect(validateWithdrawal({ ...valid, amount: 4999 }, 'payout_123', 5000))
      .toContain('Valor divergente');
    expect(validateWithdrawal({ ...valid, id: 'tran_999' }, 'payout_123', 5000, 'tran_123'))
      .toContain('Identificador divergente');
  });
});
