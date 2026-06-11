import { z } from 'zod';
import { zodRequiredPhone } from '@/lib/phone';

export const bookingDetailsSchema = z.object({
  customerName: z.string().min(2, 'Please enter your full name'),
  customerEmail: z.string().email('Please enter a valid email'),
  customerPhone: zodRequiredPhone,
});

export type BookingDetailsFormValues = z.infer<typeof bookingDetailsSchema>;
