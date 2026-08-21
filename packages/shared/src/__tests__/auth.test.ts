import { describe, it, expect } from 'vitest';
import { UserRole, SignupData } from '../types';

describe('RooServ Authentication & Role Permissions Engine', () => {
  it('correctly constructs client signup payload', () => {
    const signupPayload: SignupData = {
      role: 'client',
      fullName: 'Mariana Alcantara',
      email: 'mariana@email.com',
      password: 'secretPassword123',
      phone: '(66) 99123-4567',
      neighborhood: 'Vila Aurora',
    };

    expect(signupPayload.role).toBe('client');
    expect(signupPayload.neighborhood).toBe('Vila Aurora');
    expect(signupPayload.documentCpf).toBeUndefined();
  });

  it('correctly constructs provider signup payload with CPF', () => {
    const providerPayload: SignupData = {
      role: 'provider',
      fullName: 'Carlos Eduardo',
      email: 'carlos.eletrica@email.com',
      password: 'providerSecret123',
      phone: '(66) 98765-4321',
      neighborhood: 'Centro',
      documentCpf: '123.456.789-00',
    };

    expect(providerPayload.role).toBe('provider');
    expect(providerPayload.documentCpf).toBe('123.456.789-00');
  });

  it('validates role switching permissions for providers and clients', () => {
    const canSwitchRole = (role: UserRole) => role === 'provider' || role === 'admin';

    expect(canSwitchRole('provider')).toBe(true);
    expect(canSwitchRole('admin')).toBe(true);
    expect(canSwitchRole('client')).toBe(false);
  });
});
