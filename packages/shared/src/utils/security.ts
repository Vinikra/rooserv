/**
 * ROOSERV - MOTOR DE SEGURANÇA E PROTEÇÃO ANTI-VAZAMENTO (ANTI-DISINTERMEDIATION)
 */

export interface ContactDetectionResult {
  hasSensitiveContact: boolean;
  detectedTypes: ('phone' | 'email' | 'pix' | 'social_media')[];
  sanitizedText: string;
  originalText: string;
  warningMessage?: string;
}

// 1. Regex para Telefones Brasileiros (inclusive DDD 66 de MT e formatos disfarçados)
const PHONE_REGEX = /(\+?55\s?)?(\(?0?[1-9]{2}\)?\s?)?(\s?9\s?\d{4}[-\s]?\d{4}|\s?\d{4}[-\s]?\d{4})/gi;
const SPACED_DIGITS_REGEX = /\b(\d[\s.-]?){8,11}\b/g;
const WRITTEN_NUMBERS_REGEX = /\b(nove|oito|sete|seis|cinco|quatro|três|tres|dois|um|zero)[\s,.-]+(nove|oito|sete|seis|cinco|quatro|três|tres|dois|um|zero)/gi;

// 2. Regex para E-mails
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/gi;

// 3. Regex para Redes Sociais / WhatsApp / Instagram
const SOCIAL_MEDIA_REGEX = /(@[A-Za-z0-9_.-]{3,}|instagram\.com\/[A-Za-z0-9_.-]+|insta:|whats:|whatsapp|face:|tiktok)/gi;

// 4. Regex para Chaves Pix (CPF com pontos ou sem pontos)
const CPF_PIX_REGEX = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;

/**
 * Analisa o texto de uma mensagem do chat e bloqueia tentativas de contato externo
 */
export function sanitizeChatMessage(text: string): ContactDetectionResult {
  let sanitized = text;
  const detectedTypes: ('phone' | 'email' | 'pix' | 'social_media')[] = [];

  // Checar telefone
  if (PHONE_REGEX.test(sanitized) || SPACED_DIGITS_REGEX.test(sanitized) || WRITTEN_NUMBERS_REGEX.test(sanitized)) {
    detectedTypes.push('phone');
    sanitized = sanitized.replace(
      PHONE_REGEX,
      ' [🔒 TELEFONE BLOQUEADO PELO ROOSERV] '
    );
    sanitized = sanitized.replace(
      SPACED_DIGITS_REGEX,
      ' [🔒 NÚMERO BLOQUEADO] '
    );
    sanitized = sanitized.replace(
      WRITTEN_NUMBERS_REGEX,
      ' [🔒 CONTATO BLOQUEADO] '
    );
  }

  // Checar e-mail
  if (EMAIL_REGEX.test(sanitized)) {
    detectedTypes.push('email');
    sanitized = sanitized.replace(
      EMAIL_REGEX,
      ' [🔒 E-MAIL BLOQUEADO PELO ROOSERV] '
    );
  }

  // Checar redes sociais
  if (SOCIAL_MEDIA_REGEX.test(sanitized)) {
    detectedTypes.push('social_media');
    sanitized = sanitized.replace(
      SOCIAL_MEDIA_REGEX,
      ' [🔒 REDE SOCIAL BLOQUEADA] '
    );
  }

  // Checar CPF / Pix
  if (CPF_PIX_REGEX.test(sanitized)) {
    detectedTypes.push('pix');
    sanitized = sanitized.replace(
      CPF_PIX_REGEX,
      ' [🔒 CHAVE PIX/CPF BLOQUEADA] '
    );
  }

  const hasSensitiveContact = detectedTypes.length > 0;
  let warningMessage: string | undefined;

  if (hasSensitiveContact) {
    warningMessage =
      'Aviso de Segurança RooServ: O compartilhamento de contatos externos (telefone, Pix ou redes sociais) é bloqueado para garantir a proteção contra fraudes, seguro de serviço e garantia de pagamento.';
  }

  return {
    hasSensitiveContact,
    detectedTypes,
    sanitizedText: sanitized.replace(/\s+/g, ' ').trim(),
    originalText: text,
    warningMessage,
  };
}
