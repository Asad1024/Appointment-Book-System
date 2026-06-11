import {
  isValidPhoneNumber,
  parsePhoneNumberFromString,
} from 'libphonenumber-js/max';
import type { CountryCode } from 'libphonenumber-js';
import { z } from 'zod';

export const DEFAULT_PHONE_COUNTRY: CountryCode =
  (process.env.NEXT_PUBLIC_DEFAULT_PHONE_COUNTRY as CountryCode) || 'AE';

const GUESS_COUNTRIES: CountryCode[] = [
  'PK',
  'AE',
  'SA',
  'IN',
  'GB',
  'US',
  'CA',
  'AU',
];

/** IANA timezone → ISO2 for booking phone defaults (customer TZ, not office). */
const TZ_TO_COUNTRY: Record<string, CountryCode> = {
  'Asia/Karachi': 'PK',
  'Asia/Dubai': 'AE',
  'Asia/Riyadh': 'SA',
  'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN',
  'Asia/Singapore': 'SG',
  'Europe/London': 'GB',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Los_Angeles': 'US',
  'America/Toronto': 'CA',
  'Australia/Sydney': 'AU',
};

export function countryFromTimezone(tz?: string | null): CountryCode | undefined {
  const key = tz?.trim();
  if (!key) return undefined;
  return TZ_TO_COUNTRY[key];
}

export function countryCodeFromIso2(iso2?: string | null): CountryCode | undefined {
  const code = iso2?.trim().toUpperCase();
  if (!code || code.length !== 2) return undefined;
  return code as CountryCode;
}

/** Lowercase ISO2 for react-international-phone */
export function toPhoneInputCountry(country: CountryCode = DEFAULT_PHONE_COUNTRY): string {
  return country.toLowerCase();
}

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '');
}

function isPkMobileDigits(digits: string): boolean {
  return /^03\d{9}$/.test(digits) || /^3\d{9}$/.test(digits);
}

/** PK mobiles start with 03; include partial CRM values before all digits arrive. */
function looksLikePkNationalDigits(digits: string): boolean {
  return isPkMobileDigits(digits) || /^0?3\d{8,10}$/.test(digits);
}

export function inferCountryFromDigits(digits: string): CountryCode | undefined {
  const d = digitsOnly(digits);
  if (!d) return undefined;
  if (looksLikePkNationalDigits(d)) return 'PK';
  if (/^05\d{8}$/.test(d) || /^5\d{8}$/.test(d)) return 'AE';
  if (/^[6-9]\d{9}$/.test(d)) return 'IN';
  return undefined;
}

function inferCountriesFromNationalDigits(digits: string): CountryCode[] {
  const hints: CountryCode[] = [];
  if (isPkMobileDigits(digits)) hints.push('PK');
  if (/^05\d{8}$/.test(digits) || /^5\d{8}$/.test(digits)) hints.push('AE', 'SA');
  if (/^[6-9]\d{9}$/.test(digits)) hints.push('IN');
  if (/^\d{10}$/.test(digits)) hints.push('US', 'CA');
  return hints;
}

function tryParseWithCountry(raw: string, country: CountryCode): string | undefined {
  const digits = digitsOnly(raw);
  const candidates = [raw.trim(), digits];
  if (country === 'PK' && /^3\d{9}$/.test(digits)) {
    candidates.unshift(`0${digits}`);
  }
  for (const candidate of candidates) {
    const parsed = parsePhoneNumberFromString(candidate, country);
    if (parsed?.isValid()) return parsed.number;
  }
  return undefined;
}

/** CRM sometimes sends PK numbers already merged with UAE code (+9713…). */
function repairUaePrefixedPk(digits: string): string | undefined {
  if (!digits.startsWith('971')) return undefined;
  const national = digits.slice(3);
  if (!isPkMobileDigits(national) && !isPkMobileDigits(`0${national}`)) return undefined;
  const normalizedNational = national.startsWith('0') ? national : `0${national}`;
  return tryParseWithCountry(normalizedNational, 'PK');
}

function shouldSkipCountryForDigits(digits: string, country: CountryCode): boolean {
  if (!looksLikePkNationalDigits(digits)) return false;
  return country === 'AE' || country === 'SA';
}

/**
 * Normalize to E.164 when possible.
 * Handles CRM values like `03040630451` (PK) that arrive without a country code.
 */
export function normalizePhoneValue(
  raw?: string | null,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): string {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return '';

  const digits = digitsOnly(trimmed);

  if (trimmed.startsWith('+')) {
    const parsed = parsePhoneNumberFromString(trimmed);
    if (parsed?.isValid()) return parsed.number;
    const repaired = repairUaePrefixedPk(digits);
    if (repaired) return repaired;
    return trimmed;
  }

  if (!digits) return trimmed;

  if (digits.startsWith('971')) {
    const repaired = repairUaePrefixedPk(digits);
    if (repaired) return repaired;
  }

  if (digits.startsWith('92') && digits.length >= 12) {
    const pkFromIntl = tryParseWithCountry(`+${digits}`, 'PK');
    if (pkFromIntl) return pkFromIntl;
  }

  const repaired = repairUaePrefixedPk(digits);
  if (repaired) return repaired;

  if (isPkMobileDigits(digits)) {
    const pk = tryParseWithCountry(digits, 'PK');
    if (pk) return pk;
  }

  const candidates = [
    ...inferCountriesFromNationalDigits(digits),
    defaultCountry,
    ...GUESS_COUNTRIES,
  ];

  for (const country of [...new Set(candidates)]) {
    if (shouldSkipCountryForDigits(digits, country)) continue;
    const parsed = tryParseWithCountry(trimmed, country);
    if (parsed) return parsed;
  }

  return trimmed;
}

export function getCountryFromPhoneValue(
  value?: string | null,
  fallback: CountryCode = DEFAULT_PHONE_COUNTRY,
): CountryCode {
  const rawDigits = digitsOnly(value ?? '');
  const inferredRaw = inferCountryFromDigits(rawDigits);
  const hint = inferredRaw ?? fallback;

  const normalized = normalizePhoneValue(value, hint);
  if (!normalized) return hint;

  const parsed = parsePhoneNumberFromString(normalized);
  if (parsed?.isValid() && parsed.country) return parsed.country;

  return inferCountryFromDigits(digitsOnly(normalized)) ?? inferredRaw ?? hint;
}

export function isValidPhoneValue(value?: string | null): boolean {
  const normalized = normalizePhoneValue(value);
  if (!normalized) return false;
  try {
    return isValidPhoneNumber(normalized);
  } catch {
    return false;
  }
}

export const zodOptionalPhone = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    if (!trimmed) return undefined;
    return normalizePhoneValue(trimmed);
  })
  .refine((value) => !value || isValidPhoneValue(value), {
    message: 'Enter a valid phone number',
  });

export const zodRequiredPhone = z
  .string()
  .min(1, 'Phone number is required')
  .transform((value) => normalizePhoneValue(value))
  .refine(isValidPhoneValue, { message: 'Enter a valid phone number' });
