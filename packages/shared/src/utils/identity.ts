export function isValidCpf(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const calculateDigit = (length: number) => {
    const sum = digits.slice(0, length).split('').reduce(
      (total, digit, index) => total + Number(digit) * (length + 1 - index),
      0,
    );
    const result = 11 - (sum % 11);
    return result >= 10 ? 0 : result;
  };

  return calculateDigit(9) === Number(digits[9])
    && calculateDigit(10) === Number(digits[10]);
}

export function isValidBrazilianPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length === 10 || digits.length === 11;
}

export function getPasswordValidationError(value: string): string | null {
  if (value.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
  if (!/[A-Z]/.test(value)) return 'A senha deve conter pelo menos uma letra maiúscula.';
  if (!/[a-z]/.test(value)) return 'A senha deve conter pelo menos uma letra minúscula.';
  if (!/[0-9]/.test(value)) return 'A senha deve conter pelo menos um número.';
  return null;
}
