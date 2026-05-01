export function normalizePhonePreservePlus(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return `+${trimmed.slice(1).replace(/\D/g, '')}`;
  return trimmed.replace(/[^\d+]/g, '');
}

export function normalizePhoneWithCountryCode(
  countryCode: string,
  rawPhone: string
): string {
  const trimmed = rawPhone.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return trimmed.replace(/\s+/g, '');
  const digits = trimmed.replace(/\D/g, '').replace(/^0+/, '');
  return `${countryCode}${digits}`;
}
