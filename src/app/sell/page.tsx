import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import SellForm from "@/components/SellForm";

export const dynamic = "force-dynamic";

export default async function SellPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Post a part</h1>
      <p className="text-sm text-stone-500 mt-1 mb-5">
        Listing as <strong>{user.team_name} · Team {user.team_number}</strong>. Keep
        titles specific — “REV Core Hex Motor (2)” beats “motors”.
      </p>
      <SellForm />
    </div>
  );
}
