import { describe, it, expect } from 'vitest';
import { sanitizeChatMessage } from '../utils/security';

describe('RooServ Anti-Disintermediation Security Engine', () => {
  const sensitiveCases = [
    {
      description: 'Brazilian phone numbers',
      input: 'Me chama no whats 66999887766 para combinar',
      expectedPlaceholder: '[🔒 TELEFONE BLOQUEADO PELO ROOSERV]',
    },
    {
      description: 'email addresses',
      input: 'Manda o orçamento para contato@prestador.com',
      expectedPlaceholder: '[🔒 E-MAIL BLOQUEADO PELO ROOSERV]',
    },
    {
      description: 'social media handles',
      input: 'Segue meu insta: @eletricista_rondonopolis',
      expectedPlaceholder: '[🔒 REDE SOCIAL BLOQUEADA]',
    },
    {
      description: 'CPF Pix keys',
      input: 'Faz o pix para 123.456.789-00',
      expectedPlaceholder: '[🔒 PIX DIRETO BLOQUEADO]',
    },
  ];

  it.each(sensitiveCases)('detects and masks $description', ({ input, expectedPlaceholder }) => {
    const result = sanitizeChatMessage(input);
    expect(result.hasSensitiveContact).toBe(true);
    expect(result.sanitizedText).toContain(expectedPlaceholder);
  });

  it('allows normal conversation without false positives', () => {
    const text = 'Olá! O chuveiro precisa ser 220v ou 110v? O disjuntor é no quadro geral.';
    const result = sanitizeChatMessage(text);
    expect(result.hasSensitiveContact).toBe(false);
    expect(result.sanitizedText).toBe(text);
  });
});
