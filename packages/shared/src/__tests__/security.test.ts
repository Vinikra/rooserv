import { describe, it, expect } from 'vitest';
import { sanitizeChatMessage } from '../utils/security';

describe('RooServ Anti-Disintermediation Security Engine', () => {
  it('detects and masks standard Brazilian phone numbers', () => {
    const text = 'Me chama no whats 66999887766 para combinar';
    const result = sanitizeChatMessage(text);
    expect(result.hasSensitiveContact).toBe(true);
    expect(result.sanitizedText).toContain('[🔒');
    expect(result.sanitizedText).not.toContain('66999887766');
  });

  it('detects and masks email addresses', () => {
    const text = 'Manda o orçamento para contato@prestador.com';
    const result = sanitizeChatMessage(text);
    expect(result.hasSensitiveContact).toBe(true);
    expect(result.sanitizedText).toContain('[🔒 E-MAIL BLOQUEADO PELO ROOSERV]');
  });

  it('detects and masks social media handles', () => {
    const text = 'Segue meu insta: @eletricista_rondonopolis';
    const result = sanitizeChatMessage(text);
    expect(result.hasSensitiveContact).toBe(true);
    expect(result.sanitizedText).toContain('[🔒 REDE SOCIAL BLOQUEADA]');
  });

  it('detects and masks CPF Pix keys', () => {
    const text = 'Faz o pix para 123.456.789-00';
    const result = sanitizeChatMessage(text);
    expect(result.hasSensitiveContact).toBe(true);
    expect(result.sanitizedText).toContain('[🔒 PIX DIRETO BLOQUEADO]');
  });

  it('allows normal conversation without false positives', () => {
    const text = 'Olá! O chuveiro precisa ser 220v ou 110v? O disjuntor é no quadro geral.';
    const result = sanitizeChatMessage(text);
    expect(result.hasSensitiveContact).toBe(false);
    expect(result.sanitizedText).toBe(text);
  });
});
