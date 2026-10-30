/** Only allow same-site relative paths as post-login redirects (blocks open redirects like `//evil.com`). */
export function safeNextPath(next: unknown, fallback = "/books"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
