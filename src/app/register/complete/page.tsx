import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyPayload, GOOGLE_PENDING_COOKIE } from "@/lib/google";
import CompleteProfileForm from "@/components/CompleteProfileForm";

export const dynamic = "force-dynamic";

export default async function CompleteProfilePage() {
  const store = await cookies();
  const pending = verifyPayload<{ email: string; name: string }>(
    store.get(GOOGLE_PENDING_COOKIE)?.value
  );
  if (!pending) redirect("/register");

  return (
    <div className="max-w-md mx-auto card p-6 mt-6">
      <h1 className="text-xl font-bold">Finish setting up your team</h1>
      <p className="text-sm text-stone-500 mt-1 mb-4">
        Signed in with Google as <strong>{pending.email}</strong>. Add your team details to
        finish.
      </p>
      <CompleteProfileForm suggestedName={pending.name} />
    </div>
  );
}
