import { z } from "zod";
import { CATEGORIES, CONDITIONS } from "./db";

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z
    .string()
    .min(10, "Password must be at least 10 characters")
    .max(128)
    .refine((p) => /[a-zA-Z]/.test(p) && /[0-9]/.test(p), {
      message: "Password must contain at least one letter and one number",
    }),
  teamNumber: z.coerce.number().int().min(1).max(99999),
  teamName: z.string().trim().min(2).max(60),
  city: z.string().trim().min(2).max(60).default("San Diego"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});

export const listingSchema = z.object({
  title: z.string().trim().min(4, "Title too short").max(90),
  description: z.string().trim().min(10, "Add a little more detail").max(4000),
  category: z.enum(CATEGORIES),
  condition: z.enum(CONDITIONS),
  priceCents: z.coerce.number().int().min(0).max(100_000_00), // $0 – $10,000
  neighborhood: z.string().trim().max(60).default(""),
});

export const listingStatusSchema = z.object({
  status: z.enum(["active", "sold", "removed"]),
});

export const billingSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  address1: z.string().trim().min(3).max(120),
  address2: z.string().trim().max(120).default(""),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().length(2).toUpperCase(),
  zip: z.string().trim().regex(/^\d{5}(-\d{4})?$/, "Enter a valid ZIP code"),
});

export const checkoutSchema = z.object({
  listingId: z.string().regex(/^[a-f0-9]{32}$/),
});

export const idSchema = z.string().regex(/^[a-f0-9]{32}$/);

export function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Invalid input";
}
