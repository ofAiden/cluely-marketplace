"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A button that asks "are you sure?" in an in-page dialog before running its
 * action. This replaces window.confirm(), which some mobile browsers suppress
 * outright and which can't be styled — a destructive action deserves a prompt
 * the seller will actually see and read.
 */
export default function ConfirmButton({
  onConfirm,
  children,
  title,
  message,
  confirmLabel = "Yes, remove it",
  cancelLabel = "Keep it",
  busyLabel = "Removing…",
  className = "btn btn-secondary !py-1 !px-2",
  triggerStyle,
  danger = true,
  disabled = false,
}: {
  onConfirm: () => Promise<void> | void;
  children: React.ReactNode;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busyLabel?: string;
  className?: string;
  /** Inline style for the trigger button (e.g. a red "remove" tint). */
  triggerStyle?: React.CSSProperties;
  danger?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus the safe choice, so a stray Enter keeps the listing rather than
  // deleting it, and let Escape back out.
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !running.current) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function go() {
    if (running.current) return; // one click only, even on a fast double-tap
    running.current = true;
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={className}
        style={triggerStyle}
        disabled={disabled || busy}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="card w-full max-w-sm p-5 bg-white text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-title" className="font-bold text-lg">
              {title}
            </h2>
            <p className="text-sm text-stone-600 mt-2">{message}</p>
            <div className="mt-5 flex gap-2 justify-end">
              <button
                ref={cancelRef}
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                className="btn"
                style={danger ? { background: "#b91c1c", borderColor: "#991b1b" } : undefined}
                disabled={busy}
                onClick={go}
              >
                {busy ? busyLabel : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
