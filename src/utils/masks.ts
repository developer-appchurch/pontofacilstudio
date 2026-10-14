/**
 * Utilitários para formatação e máscaras de documentos brasileiros (CNPJ, CPF)
 */

/**
 * Aplica máscara dinâmica de CNPJ: 00.000.000/0001-00
 * Conforme o usuário digita, formata progressivamente os dígitos numéricos.
 */
export const formatCNPJ = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (!digits) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
};

/**
 * Aplica máscara dinâmica de CPF: 000.000.000-00
 */
export const formatCPF = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
};

/**
 * Remove qualquer caractere não numérico
 */
export const cleanDigits = (value: string): string => {
  return value.replace(/\D/g, '');
};

/**
 * Verifica se o CNPJ atingiu a quantidade completa de 14 dígitos
 */
export const isCNPJComplete = (value: string): boolean => {
  return cleanDigits(value).length === 14;
};
