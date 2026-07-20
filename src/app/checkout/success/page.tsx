import Link from "next/link";
import { redirect } from "next/navigation";
import { qOne, type Order } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccess({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { order: orderId } = await searchParams;
  if (!orderId || !idSchema.safeParse(orderId).success) redirect("/");

  const order = await qOne<Order & { title: string; seller_email: string; team_number: number }>(
    `SELECT o.*, l.title, u.email AS seller_email, u.team_number
       FROM orders o JOIN listings l ON l.id = o.listing_id JOIN users u ON u.id = l.seller_id
      WHERE o.id = ? AND o.buyer_id = ?`,
    [orderId, user.id]
  );
  if (!order) redirect("/dashboard");

  const paid = order.status === "paid";

  return (
    <div className="max-w-md mx-auto card p-8 mt-8 text-center">
      <div className="text-5xl">{paid ? "🎉" : "⏳"}</div>
      <h1 className="text-2xl font-bold mt-3">
        {paid ? "Order complete!" : "Payment processing…"}
      </h1>
      <p className="text-stone-600 mt-2">
        <strong>{order.title}</strong> · {money(order.amount_cents)}
      </p>
      {paid ? (
        <p className="text-sm text-stone-500 mt-3">
          Email <a className="link" href={`mailto:${order.seller_email}`}>Team {order.team_number}</a>{" "}
          to arrange pickup. League meets and scrimmages work great.
        </p>
      ) : (
        <p className="text-sm text-stone-500 mt-3">
          Stripe is confirming your payment. Refresh in a moment, or check your
          dashboard.
        </p>
      )}
      <div className="mt-5 flex gap-3 justify-center">
        <Link href="/dashboard" className="btn">Go to dashboard</Link>
        <Link href="/" className="btn btn-secondary">Keep browsing</Link>
      </div>
    </div>
  );
}
