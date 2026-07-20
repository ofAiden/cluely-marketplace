import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

export const metadata: Metadata = {
  title: "SD FTC Parts Exchange",
  description:
    "Buy and sell extra FTC robotics parts with other teams in the San Diego region.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="bg-stone-900 text-white">
          <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-4 flex-wrap">
            <Link href="/" className="font-bold text-lg tracking-tight">
              <span className="text-orange-500">SD</span> FTC Parts Exchange
            </Link>
            <span className="hidden sm:inline text-stone-400 text-sm">
              by The Clueless · 11212
            </span>
            <nav className="ml-auto flex items-center gap-3 text-sm">
              <Link href="/sell" className="btn !py-1.5 !px-3">
                + Post a part
              </Link>
              {user ? (
                <>
                  <Link href="/messages" className="text-stone-200 hover:text-white">
                    Messages
                  </Link>
                  <Link href="/dashboard" className="text-stone-200 hover:text-white">
                    Team {user.team_number}
                  </Link>
                  <LogoutButton />
                </>
              ) : (
                <>
                  <Link href="/login" className="text-stone-200 hover:text-white">
                    Sign in
                  </Link>
                  <Link href="/register" className="text-stone-200 hover:text-white">
                    Register team
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
        <footer className="border-t border-stone-200 text-center text-xs text-stone-500 py-6">
          Built by <span className="font-semibold text-orange-600">The Clueless · FTC Team 11212</span>{" "}
          for San Diego FTC teams · Not affiliated with <span className="italic">FIRST</span>®
        </footer>
      </body>
    </html>
  );
}
