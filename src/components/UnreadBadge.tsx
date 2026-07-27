"use client";

import { useEffect, useState } from "react";

/** Any part of the app can ask the badge to re-check itself right now. */
export const UNREAD_REFRESH_EVENT = "unread:refresh";

export function refreshUnreadBadge() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(UNREAD_REFRESH_EVENT));
  }
}

/**
 * Red count bubble on the "Messages" link. The server renders the first value
 * so there is no flash on load; after that this polls a tiny endpoint so the
 * count appears and clears without a page reload — including the moment you
 * open a chat, which fires UNREAD_REFRESH_EVENT.
 */
export default function UnreadBadge({ initial }: { initial: number }) {
  const [count, setCount] = useState(initial);

  useEffect(() => {
    let alive = true;

    async function refresh() {
      try {
        const res = await fetch("/api/messages/unread", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (alive && typeof data.count === "number") setCount(data.count);
      } catch {
        /* transient network hiccup — the next tick will catch up */
      }
    }

    // Only poll while the tab is actually on screen; a backgrounded tab does
    // not need to hit the database every few seconds.
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    const t = setInterval(onVisible, 8000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener(UNREAD_REFRESH_EVENT, refresh);

    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener(UNREAD_REFRESH_EVENT, refresh);
    };
  }, []);

  if (count <= 0) return null;

  return (
    <span
      className="absolute -top-2 -right-3 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[11px] font-bold leading-none"
      aria-label={`${count} unread message${count === 1 ? "" : "s"}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
