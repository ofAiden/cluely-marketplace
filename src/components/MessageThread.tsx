"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clockTime, dayLabel, fullStamp } from "@/lib/format";
import { refreshUnreadBadge } from "@/components/UnreadBadge";

/** Messages from one person inside this window stack as a single burst. */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

interface Msg {
  id: string;
  sender_id: string;
  body: string;
  created_at: number;
}

export default function MessageThread({
  conversationId,
  currentUserId,
  isSeller,
  listingSold,
  accepted,
  closed,
  initialMessages,
  otherEmail,
}: {
  conversationId: string;
  currentUserId: string;
  isSeller: boolean;
  listingSold: boolean;
  accepted: boolean;
  closed: boolean;
  initialMessages: Msg[];
  otherEmail: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [status, setStatus] = useState<string>(accepted ? "accepted" : closed ? "closed" : "open");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const countRef = useRef(initialMessages.length);

  const isAccepted = status === "accepted" || accepted;
  const isClosed = status === "closed" || closed;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Opening the thread marked it read on the server, so drop the header badge
  // straight away instead of waiting for the next page load.
  useEffect(() => {
    refreshUnreadBadge();
  }, [conversationId]);

  // Poll for new messages every 5s.
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/messages?conversationId=${conversationId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          // The poll also marks the thread read, so a message that arrives
          // while you are sitting here should not light the badge up.
          if (data.messages.length !== countRef.current) refreshUnreadBadge();
          countRef.current = data.messages.length;
          setMessages(data.messages);
        }
        if (data.status) setStatus(data.status);
      } catch {
        /* ignore transient poll errors */
      }
    }, 5000);
    return () => clearInterval(t);
  }, [conversationId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = input.trim();
    if (!body) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not send.");
      } else {
        setInput("");
        setMessages((m) => [
          ...m,
          { id: Math.random().toString(), sender_id: currentUserId, body, created_at: Date.now() },
        ]);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function accept() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/conversations/${conversationId}/accept`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Could not accept.");
      else router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      {isAccepted && (
        <div className="card p-3 mb-3 bg-green-50 border-green-200 text-sm text-green-900">
          Deal agreed. Arrange your pickup by messaging below or emailing{" "}
          <a className="link" href={`mailto:${otherEmail}`}>
            {otherEmail}
          </a>
          . Meet in a safe public place.
        </div>
      )}

      <div className="card p-3 max-h-[55vh] overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-6">No messages yet. Say hello!</p>
        ) : (
          messages.map((m, i) => {
            const mine = m.sender_id === currentUserId;
            const prev = messages[i - 1];
            const next = messages[i + 1];
            // A divider whenever the calendar day changes (and above the first).
            const newDay = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at);
            // Messages from the same person in quick succession read as one
            // burst, so stack them tight and only stamp the last of the run.
            const joinsPrev =
              !newDay &&
              !!prev &&
              prev.sender_id === m.sender_id &&
              m.created_at - prev.created_at < GROUP_WINDOW_MS;
            const endsGroup =
              !next ||
              next.sender_id !== m.sender_id ||
              next.created_at - m.created_at >= GROUP_WINDOW_MS ||
              dayLabel(next.created_at) !== dayLabel(m.created_at);
            return (
              <div key={m.id} className={joinsPrev ? "mt-0.5" : "mt-2 first:mt-0"}>
                {newDay && (
                  <div className="flex items-center gap-3 py-2">
                    <span className="h-px flex-1 bg-stone-200" />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                      {dayLabel(m.created_at)}
                    </span>
                    <span className="h-px flex-1 bg-stone-200" />
                  </div>
                )}
                <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                  <div
                    title={fullStamp(m.created_at)}
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${
                      mine ? "bg-orange-600 text-white" : "bg-stone-100 text-stone-900"
                    } ${joinsPrev ? (mine ? "rounded-tr-md" : "rounded-tl-md") : ""} ${
                      !endsGroup ? (mine ? "rounded-br-md" : "rounded-bl-md") : ""
                    }`}
                  >
                    {m.body}
                  </div>
                  {endsGroup && (
                    <span
                      className="text-[11px] text-stone-400 mt-0.5 px-1"
                      title={fullStamp(m.created_at)}
                    >
                      {clockTime(m.created_at)}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {isSeller && !isAccepted && !listingSold && (
        <button className="btn w-full mt-3" disabled={busy} onClick={accept}>
          Accept this buyer &amp; mark sold
        </button>
      )}

      {isClosed ? (
        <p className="text-sm text-stone-500 mt-3 text-center">
          This part was sold to another team. This conversation is closed.
        </p>
      ) : (
        <form onSubmit={send} className="mt-3 flex gap-2">
          <input
            className="field"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Write a message…"
            maxLength={2000}
          />
          <button className="btn" disabled={busy || !input.trim()}>
            Send
          </button>
        </form>
      )}
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  );
}
