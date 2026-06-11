'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { PhoneInput as IntlPhoneInput } from 'react-international-phone';
import type { CountryIso2, PhoneInputRefType } from 'react-international-phone';
import { cn } from '@/lib/utils';
import {
  countryCodeFromIso2,
  DEFAULT_PHONE_COUNTRY,
  getCountryFromPhoneValue,
  normalizePhoneValue,
  toPhoneInputCountry,
} from '@/lib/phone';
import type { CountryCode } from 'libphonenumber-js';
import 'react-international-phone/style.css';

const PREFERRED_COUNTRIES: CountryIso2[] = ['ae', 'pk', 'sa', 'in', 'gb', 'us'];

export type PhoneInputProps = {
  id?: string;
  value?: string;
  onChange: (value: string | undefined) => void;
  onBlur?: () => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  defaultCountry?: CountryIso2 | string;
  className?: string;
  invalid?: boolean;
};

export function PhoneInput({
  id,
  value,
  onChange,
  onBlur,
  disabled,
  required,
  placeholder = 'Enter phone number',
  defaultCountry,
  className,
  invalid,
}: PhoneInputProps) {
  const phoneInputRef = useRef<PhoneInputRefType>(null);
  const lastSyncedValueRef = useRef<string | undefined>(value);

  const fallbackCountryCode = useMemo((): CountryCode => {
    const fromProp = countryCodeFromIso2(
      typeof defaultCountry === 'string' ? defaultCountry : undefined,
    );
    return fromProp ?? DEFAULT_PHONE_COUNTRY;
  }, [defaultCountry]);

  const fallbackCountry = toPhoneInputCountry(fallbackCountryCode).toLowerCase() as CountryIso2;

  const selectedCountryRef = useRef<CountryCode>(
    value?.trim() ? getCountryFromPhoneValue(value, fallbackCountryCode) : fallbackCountryCode,
  );

  const initialCountryRef = useRef<CountryIso2>(
    toPhoneInputCountry(selectedCountryRef.current).toLowerCase() as CountryIso2,
  );

  const handleChange = useCallback(
    (phone: string, meta: { country: { iso2: string } }) => {
      const country =
        countryCodeFromIso2(meta.country.iso2) ?? selectedCountryRef.current ?? fallbackCountryCode;
      selectedCountryRef.current = country;

      const next = phone.trim() ? normalizePhoneValue(phone, country) : '';
      lastSyncedValueRef.current = next || undefined;
      onChange(next || undefined);
    },
    [onChange, fallbackCountryCode],
  );

  // Sync country / CRM prefill when the value changes outside the input (not while typing).
  useEffect(() => {
    if (value === lastSyncedValueRef.current) return;

    const inputEl = phoneInputRef.current;
    const isFocused = Boolean(inputEl && document.activeElement === inputEl);

    if (!value?.trim()) {
      lastSyncedValueRef.current = value;
      if (!isFocused) {
        selectedCountryRef.current = fallbackCountryCode;
        phoneInputRef.current?.setCountry(fallbackCountry, { focusOnInput: false });
      }
      return;
    }

    if (isFocused) {
      lastSyncedValueRef.current = value;
      return;
    }

    const countryForNormalize = getCountryFromPhoneValue(value, selectedCountryRef.current);
    const normalized = normalizePhoneValue(value, countryForNormalize);
    if (normalized && normalized !== value) {
      lastSyncedValueRef.current = normalized;
      selectedCountryRef.current = getCountryFromPhoneValue(normalized, countryForNormalize);
      onChange(normalized);
      return;
    }

    lastSyncedValueRef.current = value;
    selectedCountryRef.current = countryForNormalize;
    phoneInputRef.current?.setCountry(
      toPhoneInputCountry(countryForNormalize).toLowerCase() as CountryIso2,
      { focusOnInput: false },
    );
  }, [value, fallbackCountry, fallbackCountryCode, onChange]);

  return (
    <div
      className={cn(
        'phone-input-wrapper',
        invalid && 'phone-input-wrapper--invalid',
        disabled && 'phone-input-wrapper--disabled',
        className,
      )}
    >
      <IntlPhoneInput
        ref={phoneInputRef}
        defaultCountry={initialCountryRef.current}
        preferredCountries={PREFERRED_COUNTRIES}
        value={value ?? ''}
        onChange={handleChange}
        disableCountryGuess={false}
        disableDialCodePrefill={false}
        allowMaskOverflow={false}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        className="phone-input-root"
        inputClassName="phone-input-field"
        countrySelectorStyleProps={{
          buttonClassName: 'phone-input-country-btn',
          dropdownStyleProps: {
            className: 'phone-input-country-dropdown',
          },
        }}
        inputProps={{
          id,
          onBlur,
          type: 'tel',
          inputMode: 'tel',
          autoComplete: 'tel',
        }}
      />
    </div>
  );
}
