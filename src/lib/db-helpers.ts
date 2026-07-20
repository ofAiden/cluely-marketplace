import "server-only";
import crypto from "crypto";
export { q, qOne, run } from "./db";

export function newIdSafe(): string {
  return crypto.randomBytes(16).toString("hex");
}
