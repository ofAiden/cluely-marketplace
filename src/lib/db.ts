import { createClient, type Client, type InValue } from "@libsql/client";
import path from "path";
import fs from "fs";

/**
 * SQLite database via libsql. All queries are parameterized — never
 * interpolate user input into SQL strings.
 */

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const globalForDb = globalThis as unknown as { __db?: Client; __dbInit?: boolean };

export const db: Client =
  globalForDb.__db ??
  createClient({ url: `file:${path.join(DATA_DIR, "market.db")}` });
globalForDb.__db = db;

let initPromise: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (globalForDb.__dbInit) return Promise.resolve();
  if (!initPromise) {
    initPromise = (async () => {
      await db.executeMultiple(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          team_number INTEGER NOT NULL,
          team_name TEXT NOT NULL,
          city TEXT NOT NULL DEFAULT 'San Diego',
          created_at INTEGER NOT NULL,
          failed_logins INTEGER NOT NULL DEFAULT 0,
          locked_until INTEGER
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

        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          listing_id TEXT NOT NULL REFERENCES listings(id),
          buyer_id TEXT NOT NULL REFERENCES users(id),
          amount_cents INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
          payment_provider TEXT NOT NULL DEFAULT 'mock',
          stripe_session_id TEXT,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
        CREATE INDEX IF NOT EXISTS idx_orders_listing ON orders(listing_id);

        CREATE TABLE IF NOT EXISTS billing_details (
          user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          full_name TEXT NOT NULL DEFAULT '',
          address1 TEXT NOT NULL DEFAULT '',
          address2 TEXT NOT NULL DEFAULT '',
          city TEXT NOT NULL DEFAULT '',
          state TEXT NOT NULL DEFAULT 'CA',
          zip TEXT NOT NULL DEFAULT '',
          updated_at INTEGER NOT NULL
        );
      `);
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

export interface Order {
  id: string;
  listing_id: string;
  buyer_id: string;
  amount_cents: number;
  status: "pending" | "paid" | "cancelled";
  payment_provider: string;
  stripe_session_id: string | null;
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
