/**
 * Unified admin / boss detection for Team domain.
 * Used by Plane review, archive, delete, and NATS admin fan-out.
 *
 * Priority:
 * 1) member.isTeamAdmin === true (DB flag, configurable in HR)
 * 2) TEAM_ADMIN_EMAILS env / default allowlist
 * 3) Role keywords (founder, it admin, admin, director, …)
 */
const DEFAULT_ADMIN_EMAILS = [
  'kimngan151091@gmail.com',
  'lehuyducanh.vn@gmail.com',
  'zuzzivn@gmail.com',
];

const ADMIN_ROLE_KEYWORDS = [
  'founder',
  'it admin',
  'admin',
  'director',
  'boss',
  'manager',
  'hr',
  'ceo',
  'cto',
];

export function getAdminEmails(): string[] {
  const fromEnv = (process.env.TEAM_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_ADMIN_EMAILS;
}

export function isTeamAdmin(
  member: {
    email?: string | null;
    role?: string | null;
    isTeamAdmin?: boolean | null;
  } | null | undefined
): boolean {
  if (!member) return false;
  if (member.isTeamAdmin === true) return true;
  const email = (member.email || '').toLowerCase().trim();
  if (email && getAdminEmails().includes(email)) return true;
  const role = (member.role || '').toLowerCase();
  if (!role) return false;
  return ADMIN_ROLE_KEYWORDS.some((k) => role.includes(k));
}

/** Sensitive fields peers must not see when privacy is on. */
export const PRIVATE_MEMBER_FIELDS = [
  'salaryGross',
  'bankName',
  'bankAccount',
  'dependentCount',
] as const;

export function redactMemberPrivacy<T extends Record<string, any>>(
  member: T,
  opts: { viewerIsAdmin: boolean; isSelf: boolean; hidePrivate: boolean }
): T {
  if (opts.viewerIsAdmin || opts.isSelf || !opts.hidePrivate) return member;
  const copy: any = { ...member };
  for (const f of PRIVATE_MEMBER_FIELDS) {
    if (f in copy) {
      if (f === 'salaryGross' || f === 'dependentCount') copy[f] = 0;
      else copy[f] = null;
    }
  }
  copy._privacyRedacted = true;
  return copy;
}

export function isInReviewState(state: { name?: string | null; group?: string | null } | null | undefined): boolean {
  if (!state) return false;
  const name = (state.name || '').toLowerCase().trim();
  return name === 'in review' || name === 'in_review' || name === 'inreview';
}
