/**
 * Internal StorymeeTeam admin detection — align with core-team-api teamAuth.service.
 * Env override: NEXT_PUBLIC_TEAM_ADMIN_EMAILS=a@x.com,b@y.com
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

export type AccountStatus = 'pending' | 'active' | 'suspended' | 'rejected';

export type PrivacySettings = {
  hideSalaryFromPeers: boolean;
  hideBankFromPeers: boolean;
  hideAttendanceFromPeers: boolean;
  hidePhoneFromPeers: boolean;
};

export const DEFAULT_PRIVACY: PrivacySettings = {
  hideSalaryFromPeers: true,
  hideBankFromPeers: true,
  hideAttendanceFromPeers: true,
  hidePhoneFromPeers: false,
};

export function getAdminEmails(): string[] {
  const fromEnv = (process.env.NEXT_PUBLIC_TEAM_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_ADMIN_EMAILS;
}

export function isTeamAdmin(member: {
  email?: string | null;
  role?: string | null;
  isTeamAdmin?: boolean | null;
} | null | undefined): boolean {
  if (!member) return false;
  if (member.isTeamAdmin === true) return true;
  const email = (member.email || '').toLowerCase().trim();
  if (email && getAdminEmails().includes(email)) return true;
  const role = (member.role || '').toLowerCase();
  if (!role) return false;
  return ADMIN_ROLE_KEYWORDS.some((k) => role.includes(k));
}

export function isAccountActive(member: {
  accountStatus?: string | null;
  isActive?: boolean | null;
} | null | undefined): boolean {
  if (!member) return false;
  const st = (member.accountStatus || 'active').toLowerCase();
  if (st !== 'active') return false;
  if (member.isActive === false) return false;
  return true;
}

export function accountStatusLabel(status?: string | null): string {
  switch ((status || 'active').toLowerCase()) {
    case 'pending':
      return 'Chờ duyệt';
    case 'active':
      return 'Đang hoạt động';
    case 'suspended':
      return 'Đã khoá';
    case 'rejected':
      return 'Từ chối';
    default:
      return status || '—';
  }
}

/** Can viewer see sensitive fields of target? */
export function canViewPrivateFields(
  viewer: { email?: string | null; role?: string | null; isTeamAdmin?: boolean | null; id?: string } | null | undefined,
  target: { email?: string | null; id?: string } | null | undefined,
  privacy: PrivacySettings = DEFAULT_PRIVACY
): { salary: boolean; bank: boolean; phone: boolean } {
  const self =
    !!viewer &&
    !!target &&
    ((viewer.id && target.id && viewer.id === target.id) ||
      (viewer.email || '').toLowerCase() === (target.email || '').toLowerCase());
  const admin = isTeamAdmin(viewer);
  return {
    salary: admin || self || !privacy.hideSalaryFromPeers,
    bank: admin || self || !privacy.hideBankFromPeers,
    phone: admin || self || !privacy.hidePhoneFromPeers,
  };
}
