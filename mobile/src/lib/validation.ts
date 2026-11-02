import { z } from 'zod';

export const email = z.string().trim().toLowerCase().email('Enter a valid email');

export const strongPassword = z
  .string()
  .min(10, 'At least 10 characters')
  .max(128)
  .regex(/[A-Z]/, 'Add an uppercase letter')
  .regex(/[a-z]/, 'Add a lowercase letter')
  .regex(/\d/, 'Add a number')
  .regex(/[^\w\s]/, 'Add a symbol');

export const loginSchema = z.object({ email, password: z.string().min(1, 'Enter your password') });

export const registerSchema = z
  .object({
    full_name: z.string().trim().min(2, 'Enter your name').max(80),
    email,
    phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit Indian mobile number'),
    password: strongPassword,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export const mfaSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') });

export const resetSchema = z
  .object({ code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'), password: strongPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export const panSchema = z.object({
  pan: z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'PAN format is AAAAA9999A'),
});

export const aaHandleSchema = z.object({
  aa_handle: z.string().trim().regex(/^[\w.-]+@[\w-]+$/, 'Format: yourname@aa-provider'),
});
