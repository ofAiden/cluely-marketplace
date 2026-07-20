import "server-only";

/**
 * Transactional email via Resend (https://resend.com).
 * Gated on RESEND_API_KEY + EMAIL_FROM. If either is missing the app runs
 * normally and simply skips sending, so email is fully optional.
 * Sending never throws into the caller — a mail failure must not break signup.
 */
export function emailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, html: opts.html }),
    });
  } catch {
    // Non-fatal.
  }
}

export function registrationEmail(teamName: string, teamNumber: number, baseUrl: string) {
  return {
    subject: "Welcome to SD FTC Parts Exchange",
    html: `
      <div style="font-family:system-ui,Arial,sans-serif;max-width:520px;margin:auto;color:#1c1917">
        <h2 style="color:#c2410c">You're registered!</h2>
        <p>Hi <strong>${escapeHtml(teamName)}</strong> (Team ${teamNumber}),</p>
        <p>Your account on the <strong>SD FTC Parts Exchange</strong> is ready. You can now
        post spare parts and message other San Diego teams to arrange pickups.</p>
        <p><a href="${baseUrl}" style="display:inline-block;background:#ea580c;color:#fff;
        text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Browse parts</a></p>
        <p style="color:#78716c;font-size:13px">Built by The Clueless, FTC Team 11212.
        If you didn't create this account, you can ignore this email.</p>
      </div>`,
  };
}

export function passwordResetEmail(resetUrl: string) {
  return {
    subject: "Reset your SD FTC Parts Exchange password",
    html: `
      <div style="font-family:system-ui,Arial,sans-serif;max-width:520px;margin:auto;color:#1c1917">
        <h2 style="color:#c2410c">Reset your password</h2>
        <p>We got a request to reset your password. Click below to choose a new one.
        This link expires in 1 hour.</p>
        <p><a href="${resetUrl}" style="display:inline-block;background:#ea580c;color:#fff;
        text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Reset password</a></p>
        <p style="color:#78716c;font-size:13px">If you didn't request this, you can safely ignore
        this email — your password won't change.</p>
      </div>`,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
