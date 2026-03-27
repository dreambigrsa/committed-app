/**
 * Phone Number Normalization Utility
 * 
 * Normalizes phone numbers to a consistent format to prevent duplicate
 * relationships and improve search accuracy.
 * 
 * Format: +[country code][number] (e.g., +11234567890)
 */

/**
 * Normalizes a phone number to a consistent format
 * @param phoneNumber - The phone number to normalize (can be in any format)
 * @param defaultCountryCode - Default country code to use if not provided (default: '1' for US)
 * @returns Normalized phone number in format +[country code][number] or null if invalid
 */
export function normalizePhoneNumber(
  phoneNumber: string | null | undefined,
  defaultCountryCode: string = '1'
): string | null {
  if (!phoneNumber) return null;

  // Remove all non-digit characters except +
  let cleaned = phoneNumber.trim().replace(/[^\d+]/g, '');

  // If empty after cleaning, return null
  if (!cleaned) return null;

  // If it starts with +, keep it
  if (cleaned.startsWith('+')) {
    // Remove the + and process
    cleaned = cleaned.substring(1);
  } else {
    // If it doesn't start with +, assume it needs country code
    // Check if it looks like it already has a country code (starts with 1 and is 11 digits)
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      // Already has US country code
      cleaned = cleaned;
    } else if (cleaned.length === 10) {
      // 10 digits, add default country code
      cleaned = defaultCountryCode + cleaned;
    } else if (cleaned.length > 10) {
      // More than 10 digits, might already have country code
      // Try to detect: if starts with 1 and is 11 digits, it's US
      if (cleaned.startsWith('1') && cleaned.length === 11) {
        cleaned = cleaned;
      } else {
        // Assume first digits are country code, keep as is
        cleaned = cleaned;
      }
    } else {
      // Less than 10 digits, add default country code
      cleaned = defaultCountryCode + cleaned;
    }
  }

  // Validate: should be between 10-15 digits (E.164 standard allows up to 15 digits)
  const digitsOnly = cleaned.replace(/\D/g, '');
  if (digitsOnly.length < 10 || digitsOnly.length > 15) {
    return null;
  }

  // Return in format +[country code][number]
  return '+' + digitsOnly;
}

/**
 * Compares two phone numbers after normalization
 * @param phone1 - First phone number
 * @param phone2 - Second phone number
 * @param defaultCountryCode - Default country code to use if not provided
 * @returns true if the normalized numbers match, false otherwise
 */
export function comparePhoneNumbers(
  phone1: string | null | undefined,
  phone2: string | null | undefined,
  defaultCountryCode: string = '1'
): boolean {
  const normalized1 = normalizePhoneNumber(phone1, defaultCountryCode);
  const normalized2 = normalizePhoneNumber(phone2, defaultCountryCode);

  if (!normalized1 || !normalized2) return false;

  return normalized1 === normalized2;
}

/**
 * Formats a normalized phone number for display
 * @param phoneNumber - Normalized phone number (format: +[country code][number])
 * @param format - Display format ('international', 'national', 'local')
 * @returns Formatted phone number string
 */
export function formatPhoneNumberForDisplay(
  phoneNumber: string | null | undefined,
  format: 'international' | 'national' | 'local' = 'international'
): string {
  if (!phoneNumber) return '';

  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) return phoneNumber; // Return original if normalization fails

  // Remove the + for processing
  const digits = normalized.substring(1);

  if (format === 'international') {
    // Format: +1 (123) 456-7890
    if (digits.length === 11 && digits.startsWith('1')) {
      // US number
      const countryCode = digits.substring(0, 1);
      const areaCode = digits.substring(1, 4);
      const firstPart = digits.substring(4, 7);
      const secondPart = digits.substring(7);
      return `+${countryCode} (${areaCode}) ${firstPart}-${secondPart}`;
    } else {
      // International number - just add spaces every 3-4 digits
      return normalized.replace(/(\d{1,3})(\d{3})(\d{3})(\d+)/, '+$1 $2 $3 $4');
    }
  } else if (format === 'national') {
    // Format: (123) 456-7890 (without country code)
    if (digits.length === 11 && digits.startsWith('1')) {
      const areaCode = digits.substring(1, 4);
      const firstPart = digits.substring(4, 7);
      const secondPart = digits.substring(7);
      return `(${areaCode}) ${firstPart}-${secondPart}`;
    } else {
      return digits;
    }
  } else {
    // Local format: 456-7890
    if (digits.length >= 10) {
      const last7 = digits.substring(digits.length - 7);
      const firstPart = last7.substring(0, 3);
      const secondPart = last7.substring(3);
      return `${firstPart}-${secondPart}`;
    }
    return digits;
  }
}

/**
 * Extracts country code from a normalized phone number
 * @param phoneNumber - Normalized phone number
 * @returns Country code (e.g., '1' for US) or null
 */
export function extractCountryCode(phoneNumber: string | null | undefined): string | null {
  if (!phoneNumber) return null;

  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) return null;

  // Remove the +
  const digits = normalized.substring(1);

  // Common country codes: 1 (US/Canada), 44 (UK), 33 (France), etc.
  // For now, we'll assume 1-digit country codes (like US) or detect common ones
  if (digits.startsWith('1') && digits.length === 11) {
    return '1';
  } else if (digits.startsWith('44') && digits.length === 12) {
    return '44';
  } else if (digits.startsWith('33') && digits.length === 11) {
    return '33';
  }

  // Default: assume first 1-3 digits are country code
  // This is a simplified approach - for production, use a proper library
  return digits.substring(0, Math.min(3, digits.length - 10));
}

