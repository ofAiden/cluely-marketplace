import Link from "next/link";
import ResetPasswordForm from "@/components/ResetPasswordForm";

export const dynamic = "force-dynamic";

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid = typeof token === "string" && /^[a-f0-9]{64}$/.test(token);

  return (
    <div className="max-w-md mx-auto card p-6 mt-6">
      <h1 className="text-xl font-bold">Set a new password</h1>
      {!valid ? (
        <p className="text-sm text-stone-500 mt-2">
          This reset link is missing or malformed.{" "}
          <Link href="/forgot" className="link">
            Request a new one
          </Link>
          .
        </p>
      ) : (
        <>
          <p className="text-sm text-stone-500 mt-1 mb-4">Choose a new password for your account.</p>
          <ResetPasswordForm token={token!} />
        </>
      )}
    </div>
  );
}
