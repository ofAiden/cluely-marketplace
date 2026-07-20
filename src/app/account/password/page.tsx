import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ChangePasswordForm from "@/components/ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="max-w-md mx-auto card p-6 mt-6">
      <h1 className="text-xl font-bold">Change password</h1>
      <p className="text-sm text-stone-500 mt-1 mb-4">
        Signed in as <strong>{user.team_name}</strong> ({user.email}).
      </p>
      <ChangePasswordForm />
    </div>
  );
}
