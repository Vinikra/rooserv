import { describe, expect, it } from 'vitest';
import { getPasswordValidationError, isValidBrazilianPhone, isValidCpf } from '../utils/identity';

describe('Brazilian identity validation', () => {
  it('validates CPF check digits and rejects repeated digits', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('123.456.789-00')).toBe(false);
    expect(isValidCpf('111.111.111-11')).toBe(false);
  });

  it('accepts only phone numbers with DDD and 10 or 11 digits', () => {
    expect(isValidBrazilianPhone('(66) 99999-0000')).toBe(true);
    expect(isValidBrazilianPhone('(66) 3333-0000')).toBe(true);
    expect(isValidBrazilianPhone('9999-0000')).toBe(false);
  });

  it('requires a minimally strong password', () => {
    expect(getPasswordValidationError('senha')).toBeTruthy();
    expect(getPasswordValidationError('senhafraca1')).toBeTruthy();
    expect(getPasswordValidationError('SenhaForte1')).toBeNull();
  });
});
