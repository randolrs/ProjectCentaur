// Admin access is gated by an explicit email allowlist in the `ADMIN_EMAILS`
// environment variable (comma-separated). An unset or empty value means no
// account is an admin — the safe default.

/** True when `email` appears in the `ADMIN_EMAILS` allowlist. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
