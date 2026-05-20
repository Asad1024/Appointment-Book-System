import { z } from 'zod';

export const bookingDetailsSchema = z.object({
  customerName: z.string().min(2, 'Please enter your full name'),
  customerEmail: z.string().email('Please enter a valid email'),
  customerPhone: z
    .string()
    .min(8, 'Please enter a valid phone number')
    .max(20, 'Phone number is too long')
    .regex(/^\+?[\d\s\-()]+$/, 'Use digits with optional country code, e.g. +971501234567'),
});

export type BookingDetailsFormValues = z.infer<typeof bookingDetailsSchema>;
