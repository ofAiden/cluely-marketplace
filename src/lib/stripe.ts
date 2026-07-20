import "server-only";
import Stripe from "stripe";

/**
 * Stripe runs in TEST MODE with your test keys (sk_test_...).
 * If no key is configured, the app falls back to a clearly-labeled
 * mock checkout so the site works out of the box.
 *
 * Card numbers are NEVER touched by this server — Stripe Checkout
 * hosts the payment page.
 */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export function stripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET ?? null;
}
