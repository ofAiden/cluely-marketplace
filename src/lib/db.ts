import { createClient, type Client, type InValue } from "@libsql/client";
import path from "path";
import fs from "fs";

/**
 * SQLite database via libsql. All queries are parameterized, never
 * interpolate user input into SQL strings.
 */

/**
 * In production (Vercel), set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN and the
 * app talks to a hosted Turso database over the same libsql protocol.
 * Locally, with no env vars, it falls back to a SQLite file in ./data.
 */
const REMOTE_URL = process.env.TURSO_DATABASE_URL;

function makeClient(): Client {
  if (REMOTE_URL) {
    return createClient({
      url: REMOTE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  const DATA_DIR = path.join(process.cwd(), "data");
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  return createClient({ url: `file:${path.join(DATA_DIR, "market.db")}` });
}

const globalForDb = globalThis as unknown as { __db?: Client; __dbInit?: boolean };

export const db: Client = globalForDb.__db ?? makeClient();
globalForDb.__db = db;

let initPromise: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (globalForDb.__dbInit) return Promise.resolve();
  if (!initPromise) {
    initPromise = (async () => {
      if (!REMOTE_URL) {
        // Local file DB tuning; Turso manages this itself server-side.
        await db.executeMultiple(`
          PRAGMA journal_mode = WAL;
          PRAGMA foreign_keys = ON;
        `);
      }
      await db.executeMultiple(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          team_number INTEGER NOT NULL,
          team_name TEXT NOT NULL,
          city TEXT NOT NULL DEFAULT 'San Diego',
          created_at INTEGER NOT NULL,
          failed_logins INTEGER NOT NULL DEFAULT 0,
          locked_until INTEGER,
          banned INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS sessions (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

        CREATE TABLE IF NOT EXISTS listings (
          id TEXT PRIMARY KEY,
          seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          category TEXT NOT NULL,
          condition TEXT NOT NULL,
          price_cents INTEGER NOT NULL CHECK (price_cents >= 0 AND price_cents <= 100000000),
          neighborhood TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold','removed')),
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status, created_at);
        CREATE INDEX IF NOT EXISTS idx_listings_seller ON listings(seller_id);

        CREATE TABLE IF NOT EXISTS listing_images (
          id TEXT PRIMARY KEY,
          listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
          filename TEXT NOT NULL,
          position INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_images_listing ON listing_images(listing_id);

        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
          buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','closed')),
          created_at INTEGER NOT NULL,
          last_message_at INTEGER NOT NULL,
          UNIQUE(listing_id, buyer_id)
        );
        CREATE INDEX IF NOT EXISTS idx_conv_seller ON conversations(seller_id, last_message_at);
        CREATE INDEX IF NOT EXISTS idx_conv_buyer ON conversations(buyer_id, last_message_at);

        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
          sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          body TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, created_at);

        CREATE TABLE IF NOT EXISTS password_resets (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_resets_user ON password_resets(user_id);
      `);

      // Idempotent migration for databases created before `banned` existed.
      try {
        await db.execute("ALTER TABLE users ADD COLUMN banned INTEGER NOT NULL DEFAULT 0");
      } catch {
        // Column already exists — ignore.
      }

      // Idempotent migration: per-participant "last read" markers for unread
      // message badges. Default 0 means "never read" (everything counts unread).
      for (const col of ["buyer_last_read_at", "seller_last_read_at"]) {
        try {
          await db.execute(
            `ALTER TABLE conversations ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 0`
          );
        } catch {
          // Column already exists — ignore.
        }
      }

      globalForDb.__dbInit = true;
    })();
  }
  return initPromise;
}

export async function q<T = Record<string, unknown>>(
  sql: string,
  args: InValue[] = []
): Promise<T[]> {
  await ensureSchema();
  const res = await db.execute({ sql, args });
  return res.rows as unknown as T[];
}

export async function qOne<T = Record<string, unknown>>(
  sql: string,
  args: InValue[] = []
): Promise<T | null> {
  const rows = await q<T>(sql, args);
  return rows[0] ?? null;
}

export async function run(sql: string, args: InValue[] = []): Promise<void> {
  await ensureSchema();
  await db.execute({ sql, args });
}

// ---------- Types ----------
export interface User {
  id: string;
  email: string;
  password_hash: string;
  team_number: number;
  team_name: string;
  city: string;
  created_at: number;
  failed_logins: number;
  locked_until: number | null;
  banned: number;
}

export interface Listing {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  price_cents: number;
  neighborhood: string;
  status: "active" | "sold" | "removed";
  created_at: number;
}

export interface ListingWithMeta extends Listing {
  team_number: number;
  team_name: string;
  thumb: string | null;
}

export interface Conversation {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  status: "open" | "accepted" | "closed";
  created_at: number;
  last_message_at: number;
  buyer_last_read_at: number;
  seller_last_read_at: number;
}

/**
 * Total number of messages the user hasn't seen yet: messages in any of their
 * conversations, sent by the other party, newer than the user's last-read mark
 * for that conversation. Every param is the same user id, so ordering is moot.
 */
export async function unreadMessageCount(userId: string): Promise<number> {
  const row = await qOne<{ n: number }>(
    `SELECT COUNT(*) AS n
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
      WHERE m.sender_id != ?
        AND ((c.buyer_id = ?  AND m.created_at > c.buyer_last_read_at)
          OR (c.seller_id = ? AND m.created_at > c.seller_last_read_at))`,
    [userId, userId, userId]
  );
  return row?.n ?? 0;
}

/** Mark a conversation read for one participant (clears its unread messages). */
export async function markConversationRead(
  conversationId: string,
  isSeller: boolean
): Promise<void> {
  const col = isSeller ? "seller_last_read_at" : "buyer_last_read_at";
  await run(`UPDATE conversations SET ${col} = ? WHERE id = ?`, [Date.now(), conversationId]);
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: number;
}

export const CATEGORIES = [
  "motors",
  "servos",
  "wheels",
  "structure",
  "electronics",
  "sensors",
  "hardware",
  "gears-belts",
  "control-hubs",
  "other",
] as const;

export const CONDITIONS = ["new", "like-new", "used", "for-parts"] as const;
