export function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr${h > 1 ? "s" : ""} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d > 1 ? "s" : ""} ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Everything on this site is San Diego local, and dates are formatted in both
 * server components and client components. Pinning the zone keeps the two
 * renders identical (no hydration mismatch) and keeps late-evening posts from
 * showing tomorrow's date because the server runs in UTC.
 */
const SD_TZ = "America/Los_Angeles";

/** YYYY-MM-DD in San Diego time — a stable key for "same day" comparisons. */
function sdDay(ts: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SD_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ts));
}

/** "3:42 PM" */
export function clockTime(ts: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SD_TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ts));
}

/** "Today" / "Yesterday" / "Mon, Jul 20" / "Jul 20, 2025" — for day dividers. */
export function dayLabel(ts: number): string {
  const now = Date.now();
  const day = sdDay(ts);
  if (day === sdDay(now)) return "Today";
  if (day === sdDay(now - 86_400_000)) return "Yesterday";
  const sameYear = day.slice(0, 4) === sdDay(now).slice(0, 4);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SD_TZ,
    weekday: sameYear ? "short" : undefined,
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  }).format(new Date(ts));
}

/** Compact stamp for a conversation row: time if today, otherwise the date. */
export function listStamp(ts: number): string {
  const now = Date.now();
  const day = sdDay(ts);
  if (day === sdDay(now)) return clockTime(ts);
  if (day === sdDay(now - 86_400_000)) return "Yesterday";
  return dayLabel(ts);
}

/** "Mon, Jul 20, 2026 at 3:42 PM" — full stamp for tooltips. */
export function fullStamp(ts: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SD_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ts));
}

export function labelize(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
