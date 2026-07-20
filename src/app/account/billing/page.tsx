import { redirect } from "next/navigation";
import { qOne } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import BillingForm from "@/components/BillingForm";

export const dynamic = "force-dynamic";

interface Billing {
  full_name: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
}

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const billing = await qOne<Billing>(
    "SELECT full_name, address1, address2, city, state, zip FROM billing_details WHERE user_id = ?",
    [user.id]
  );

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold">Billing &amp; pickup details</h1>
      <p className="text-sm text-stone-500 mt-1 mb-4">
        Used to coordinate local pickup and receipts.{" "}
        <strong>Card numbers are never stored here</strong> — payments are handled
        entirely by Stripe.
      </p>
      <BillingForm
        initial={{
          fullName: billing?.full_name ?? "",
          address1: billing?.address1 ?? "",
          address2: billing?.address2 ?? "",
          city: billing?.city ?? "San Diego",
          state: billing?.state ?? "CA",
          zip: billing?.zip ?? "",
        }}
      />
    </div>
  );
}
