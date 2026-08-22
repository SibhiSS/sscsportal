// Recipient allowlist — the control that survives an API key leak.
//
// Mirrors ALLOWED_DOMAINS / ALLOWED_ADDRESSES from google_script_mail_relay.js.
// Nothing about switching providers should widen who this app can mail: even
// holding a leaked provider key, a caller should only be able to reach VIT
// addresses and the club's own inboxes, never an arbitrary third party.
//
// Configured via env (comma-separated), not hardcoded, so it can be tightened
// or extended per deployment without a code change — same reasoning as the
// Apps Script version being Script Properties rather than a literal in code.

export function parseList(csv: string | undefined): string[] {
  if (!csv) return [];
  return csv
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

export function isAllowedRecipient(
  email: string | undefined | null,
  allowedDomains: string[],
  allowedAddresses: string[],
): boolean {
  if (!email || !email.includes('@')) return false;
  const addr = email.trim().toLowerCase();
  if (allowedAddresses.includes(addr)) return true;
  const domain = addr.split('@').pop() ?? '';
  return allowedDomains.includes(domain);
}
