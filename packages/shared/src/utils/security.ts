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

// 1. Expressões Regulares de Detecção
const PHONE_REGEX = /\b(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4}\b/gi;
const DIGIT_SEQUENCE_REGEX = /\b\d{8,11}\b/g;

// 2. Regex para E-mails
const EMAIL_REGEX = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,7}\b/gi;

// 3. Regex para Redes Sociais / WhatsApp / Instagram
const SOCIAL_MEDIA_REGEX = /(?:@[a-z0-9_.-]{3,}|instagram\.com\/|insta:|whats|face:|tiktok)/gi;

// 4. Regex para Chaves Pix (CPF com ou sem pontuação)
const CPF_PIX_REGEX = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;

/**
 * Analisa o texto de uma mensagem do chat e bloqueia tentativas de contato externo
 */
export function sanitizeChatMessage(text: string): ContactDetectionResult {
  let sanitized = text;
  const detectedTypes: ('phone' | 'email' | 'pix' | 'social_media')[] = [];

  // Checar telefone e sequências numéricas longas
  if (PHONE_REGEX.test(sanitized) || DIGIT_SEQUENCE_REGEX.test(sanitized)) {
    detectedTypes.push('phone');
    sanitized = sanitized
      .replace(PHONE_REGEX, ' [🔒 TELEFONE BLOQUEADO PELO ROOSERV] ')
      .replace(DIGIT_SEQUENCE_REGEX, ' [🔒 NÚMERO BLOQUEADO] ');
  }

  // Checar e-mail
  if (EMAIL_REGEX.test(sanitized)) {
    detectedTypes.push('email');
    sanitized = sanitized.replace(EMAIL_REGEX, ' [🔒 E-MAIL BLOQUEADO PELO ROOSERV] ');
  }

  // Checar redes sociais
  if (SOCIAL_MEDIA_REGEX.test(sanitized)) {
    detectedTypes.push('social_media');
    sanitized = sanitized.replace(SOCIAL_MEDIA_REGEX, ' [🔒 REDE SOCIAL BLOQUEADA] ');
  }

  // Checar Chave Pix direta
  if (CPF_PIX_REGEX.test(sanitized)) {
    detectedTypes.push('pix');
    sanitized = sanitized.replace(CPF_PIX_REGEX, ' [🔒 PIX DIRETO BLOQUEADO] ');
  }

  const hasSensitiveContact = detectedTypes.length > 0;

  return {
    hasSensitiveContact,
    detectedTypes,
    sanitizedText: sanitized,
    originalText: text,
    warningMessage: hasSensitiveContact
      ? 'Aviso de segurança RooServ: mantenha propostas e negociações na plataforma para preservar o histórico usado em suporte e disputas.'
      : undefined,
  };
}
