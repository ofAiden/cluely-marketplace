import "server-only";
import { cookies } from "next/headers";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { q, qOne, run, type User } from "./db";

/**
 * Session-based auth.
 *
 * - Passwords hashed with bcrypt (cost 12). Plaintext never stored or logged.
 * - Session tokens are 256-bit random values. Only a SHA-256 HASH of the
 *   token is stored in the DB, so a leaked database cannot be used to
 *   hijack sessions.
 * - Cookie is httpOnly (no JS access), SameSite=Lax (CSRF mitigation),
 *   Secure in production.
 * - Sessions expire after 14 days and are validated server-side on every use.
 */

export const SESSION_COOKIE = "ftc_session";
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const BCRYPT_COST = 12;

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function newId(): string {
  return crypto.randomBytes(16).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  await run(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    [hashToken(token), userId, now, now + SESSION_TTL_MS]
  );
  // Opportunistically clear expired sessions.
  await run("DELETE FROM sessions WHERE expires_at < ?", [now]);
  return token;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}

export async function destroySession(token: string): Promise<void> {
  await run("DELETE FROM sessions WHERE token_hash = ?", [hashToken(token)]);
}

export async function destroyAllSessions(userId: string): Promise<void> {
  await run("DELETE FROM sessions WHERE user_id = ?", [userId]);
}

export type SafeUser = Omit<User, "password_hash" | "failed_logins" | "locked_until">;

export async function getCurrentUser(): Promise<SafeUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await qOne<User & { expires_at: number }>(
    `SELECT u.id, u.email, u.team_number, u.team_name, u.city, u.created_at, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?`,
    [hashToken(token)]
  );
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    await destroySession(token);
    return null;
  }
  const { expires_at: _discard, password_hash: _d2, failed_logins: _d3, locked_until: _d4, ...safe } =
    row as User & { expires_at: number };
  void _discard; void _d2; void _d3; void _d4;
  return safe;
}

/** Account lockout: 8 failed attempts locks the account for 15 minutes. */
export const MAX_FAILED_LOGINS = 8;
export const LOCKOUT_MS = 15 * 60 * 1000;

export async function recordFailedLogin(userId: string): Promise<void> {
  const rows = await q<{ failed_logins: number }>(
    "UPDATE users SET failed_logins = failed_logins + 1 WHERE id = ? RETURNING failed_logins",
    [userId]
  );
  const fails = rows[0]?.failed_logins ?? 0;
  if (fails >= MAX_FAILED_LOGINS) {
    await run("UPDATE users SET locked_until = ?, failed_logins = 0 WHERE id = ?", [
      Date.now() + LOCKOUT_MS,
      userId,
    ]);
  }
}

export async function clearFailedLogins(userId: string): Promise<void> {
  await run("UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?", [userId]);
}
