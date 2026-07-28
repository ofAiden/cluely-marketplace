import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { unreadMessageCount } from "@/lib/db";
import LogoutButton from "@/components/LogoutButton";
import UnreadBadge from "@/components/UnreadBadge";
import Wordmark from "@/components/Wordmark";

export const metadata: Metadata = {
  title: "partsXchange — spare FTC parts in San Diego",
  description:
    "Buy and sell extra FTC robotics parts with other teams in the San Diego region.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  const unread = user ? await unreadMessageCount(user.id) : 0;
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="bg-stone-900 text-white">
          <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-4 flex-wrap">
            <Link href="/" aria-label="partsXchange home">
              {/* Fixed height, width from the viewBox — the wordmark is six
                  times wider than it is tall and must not be squeezed. */}
              <Wordmark className="h-7 sm:h-8 w-auto text-white" />
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
                  {user.is_admin && (
                    <Link href="/admin" className="text-orange-400 font-semibold hover:text-orange-300">
                      Admin
                    </Link>
                  )}
                  <Link
                    href="/messages"
                    className="relative text-stone-200 hover:text-white"
                  >
                    Messages
                    <UnreadBadge initial={unread} />
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
        <footer className="border-t border-stone-200 text-center text-xs text-stone-500 py-6 space-y-2">
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a
              href="https://www.thecluelessftc.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="link font-semibold"
            >
              The Clueless website
            </a>
            <span className="text-stone-300">·</span>
            <a href="mailto:ftc11212@gmail.com" className="link font-semibold">
              Contact us
            </a>
          </div>
          <div>
            Built by <span className="font-semibold text-orange-600">The Clueless · FTC Team 11212</span>{" "}
            for San Diego FTC teams · Not affiliated with <span className="italic">FIRST</span>®
          </div>
        </footer>
      </body>
    </html>
  );
}
