import { redirect } from "next/navigation";
import { qOne, type Order } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { money } from "@/lib/format";
import MockPayForm from "@/components/MockPayForm";

export const dynamic = "force-dynamic";

export default async function MockCheckout({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { order: orderId } = await searchParams;
  if (!orderId || !idSchema.safeParse(orderId).success) redirect("/");

  const order = await qOne<Order & { title: string }>(
    `SELECT o.*, l.title FROM orders o JOIN listings l ON l.id = o.listing_id
      WHERE o.id = ? AND o.buyer_id = ? AND o.payment_provider = 'mock' AND o.status = 'pending'`,
    [orderId, user.id]
  );
  if (!order) redirect("/dashboard");

  return (
    <div className="max-w-md mx-auto mt-6">
      <div className="rounded-t-xl bg-amber-400 text-amber-950 text-center text-xs font-bold uppercase tracking-wide py-1.5">
        Test checkout — no real payment
      </div>
      <div className="card !rounded-t-none p-6">
        <h1 className="text-lg font-bold">{order.title}</h1>
        <p className="text-3xl font-extrabold text-orange-700 mt-1">
          {money(order.amount_cents)}
        </p>
        <p className="text-sm text-stone-500 mt-2">
          Stripe keys aren&apos;t configured, so this simulates the payment step.
          Add <code className="bg-stone-100 px-1 rounded">STRIPE_SECRET_KEY</code> to{" "}
          <code className="bg-stone-100 px-1 rounded">.env.local</code> for real
          Stripe test-mode checkout.
        </p>
        <MockPayForm orderId={order.id} />
      </div>
    </div>
  );
}
