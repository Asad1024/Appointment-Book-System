"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingCurrencyLabel = exports.formatMoneyFromCents = exports.getBookingCurrencyMeta = exports.normalizeBookingCurrency = exports.BOOKING_CURRENCIES = exports.DEFAULT_BOOKING_CURRENCY = void 0;
/** Stripe-compatible booking currencies (lowercase ISO 4217). */
exports.DEFAULT_BOOKING_CURRENCY = 'aed';
exports.BOOKING_CURRENCIES = [
    { code: 'aed', label: 'UAE Dirham', symbol: 'AED' },
    { code: 'usd', label: 'US Dollar', symbol: '$' },
    { code: 'eur', label: 'Euro', symbol: '€' },
    { code: 'gbp', label: 'British Pound', symbol: '£' },
    { code: 'pkr', label: 'Pakistani Rupee', symbol: 'Rs' },
    { code: 'sar', label: 'Saudi Riyal', symbol: 'SAR' },
    { code: 'inr', label: 'Indian Rupee', symbol: '₹' },
    { code: 'cad', label: 'Canadian Dollar', symbol: 'CA$' },
    { code: 'aud', label: 'Australian Dollar', symbol: 'A$' },
];
const CODE_SET = new Set(exports.BOOKING_CURRENCIES.map((c) => c.code));
function normalizeBookingCurrency(code) {
    const normalized = (code ?? exports.DEFAULT_BOOKING_CURRENCY).trim().toLowerCase();
    if (CODE_SET.has(normalized))
        return normalized;
    return exports.DEFAULT_BOOKING_CURRENCY;
}
exports.normalizeBookingCurrency = normalizeBookingCurrency;
function getBookingCurrencyMeta(code) {
    const normalized = normalizeBookingCurrency(code);
    return exports.BOOKING_CURRENCIES.find((c) => c.code === normalized) ?? exports.BOOKING_CURRENCIES[0];
}
exports.getBookingCurrencyMeta = getBookingCurrencyMeta;
function formatMoneyFromCents(cents, currencyCode) {
    if (!cents || cents <= 0)
        return 'Free';
    const code = normalizeBookingCurrency(currencyCode);
    try {
        return new Intl.NumberFormat('en', {
            style: 'currency',
            currency: code.toUpperCase(),
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(cents / 100);
    }
    catch {
        const meta = getBookingCurrencyMeta(code);
        return `${meta.symbol}${(cents / 100).toFixed(2)}`;
    }
}
exports.formatMoneyFromCents = formatMoneyFromCents;
function bookingCurrencyLabel(code) {
    const meta = getBookingCurrencyMeta(code);
    return `${meta.label} (${meta.symbol})`;
}
exports.bookingCurrencyLabel = bookingCurrencyLabel;
