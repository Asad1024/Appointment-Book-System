/** Stripe-compatible booking currencies (lowercase ISO 4217). */
export declare const DEFAULT_BOOKING_CURRENCY: "aed";
export declare const BOOKING_CURRENCIES: readonly [{
    readonly code: "aed";
    readonly label: "UAE Dirham";
    readonly symbol: "AED";
}, {
    readonly code: "usd";
    readonly label: "US Dollar";
    readonly symbol: "$";
}, {
    readonly code: "eur";
    readonly label: "Euro";
    readonly symbol: "€";
}, {
    readonly code: "gbp";
    readonly label: "British Pound";
    readonly symbol: "£";
}, {
    readonly code: "pkr";
    readonly label: "Pakistani Rupee";
    readonly symbol: "Rs";
}, {
    readonly code: "sar";
    readonly label: "Saudi Riyal";
    readonly symbol: "SAR";
}, {
    readonly code: "inr";
    readonly label: "Indian Rupee";
    readonly symbol: "₹";
}, {
    readonly code: "cad";
    readonly label: "Canadian Dollar";
    readonly symbol: "CA$";
}, {
    readonly code: "aud";
    readonly label: "Australian Dollar";
    readonly symbol: "A$";
}];
export type BookingCurrencyCode = (typeof BOOKING_CURRENCIES)[number]['code'];
export declare function normalizeBookingCurrency(code?: string | null): BookingCurrencyCode;
export declare function getBookingCurrencyMeta(code?: string | null): {
    readonly code: "aed";
    readonly label: "UAE Dirham";
    readonly symbol: "AED";
} | {
    readonly code: "usd";
    readonly label: "US Dollar";
    readonly symbol: "$";
} | {
    readonly code: "eur";
    readonly label: "Euro";
    readonly symbol: "€";
} | {
    readonly code: "gbp";
    readonly label: "British Pound";
    readonly symbol: "£";
} | {
    readonly code: "pkr";
    readonly label: "Pakistani Rupee";
    readonly symbol: "Rs";
} | {
    readonly code: "sar";
    readonly label: "Saudi Riyal";
    readonly symbol: "SAR";
} | {
    readonly code: "inr";
    readonly label: "Indian Rupee";
    readonly symbol: "₹";
} | {
    readonly code: "cad";
    readonly label: "Canadian Dollar";
    readonly symbol: "CA$";
} | {
    readonly code: "aud";
    readonly label: "Australian Dollar";
    readonly symbol: "A$";
};
export declare function formatMoneyFromCents(cents: number, currencyCode?: string | null): string;
export declare function bookingCurrencyLabel(code?: string | null): string;
