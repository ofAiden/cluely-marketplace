"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders a listing description that always wraps to the screen width (never
 * forces horizontal scroll, even with long unbroken strings like URLs) and
 * collapses long text behind a "Read more" toggle.
 *
 * The collapse is measured, not guessed: the button only appears when the
 * full text is actually taller than the collapsed height, so it adapts to
 * both phones (narrow -> more lines) and laptops (wide -> fewer lines).
 */
const COLLAPSED_PX = 208; // ~10 lines at the current line-height before truncating

export default function Description({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // scrollHeight is the full content height regardless of the maxHeight cap,
    // so this stays accurate whether collapsed or expanded.
    const check = () => setOverflows(el.scrollHeight > COLLAPSED_PX + 4);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [text]);

  const collapsed = !expanded && overflows;

  return (
    <div className="mt-5">
      <div className="relative">
        <div
          ref={ref}
          style={{ maxHeight: collapsed ? COLLAPSED_PX : undefined }}
          className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed overflow-hidden"
        >
          {text}
        </div>
        {collapsed && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent"
          />
        )}
      </div>
      {overflows && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="link text-sm font-semibold mt-2"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
