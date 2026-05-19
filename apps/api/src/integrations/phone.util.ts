/** Normalize to WhatsApp attendee id: E.164 digits + @s.whatsapp.net */
export function toWhatsAppAttendeeId(phone: string, defaultCountryCode?: string): string {
  let digits = phone.replace(/\D/g, '');
  const cc = (defaultCountryCode ?? process.env.DEFAULT_PHONE_COUNTRY_CODE ?? '')
    .replace(/\D/g, '');

  if (digits.startsWith('0') && cc) {
    digits = cc + digits.slice(1);
  } else if (cc && digits.length <= 10) {
    digits = cc + digits;
  }

  if (digits.length < 8) {
    throw new Error('Invalid phone number');
  }

  return `${digits}@s.whatsapp.net`;
}

export function isValidPhoneInput(phone: string): boolean {
  const trimmed = phone.trim();
  if (trimmed.length < 8 || trimmed.length > 20) return false;
  return /^\+?[\d\s\-()]+$/.test(trimmed);
}
