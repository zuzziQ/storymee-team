/**
 * Internal StorymeeTeam account lifecycle (TeamMember / omni_team_members).
 *
 * SSOT table: omni_team_members
 * Status: pending | active | suspended | rejected
 *
 * Free product users (account-api users) are OUT OF SCOPE.
 * See: team-hr-vs-account.md, team-roadmap.md
 */
import { prisma } from '../config/prisma';

export type AccountStatus = 'pending' | 'active' | 'suspended' | 'rejected';

export const ACCOUNT_STATUSES: AccountStatus[] = ['pending', 'active', 'suspended', 'rejected'];

let schemaReady: Promise<void> | null = null;

export class TeamAccountService {
  /** Ensure account_status columns exist (safe on every boot). */
  static async ensureSchema(): Promise<void> {
    if (!schemaReady) {
      schemaReady = (async () => {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE omni_team_members
          ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active';
        `);
        await prisma.$executeRawUnsafe(`
          ALTER TABLE omni_team_members
          ADD COLUMN IF NOT EXISTS account_note TEXT;
        `);
        await prisma.$executeRawUnsafe(`
          ALTER TABLE omni_team_members
          ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
        `);
        await prisma.$executeRawUnsafe(`
          ALTER TABLE omni_team_members
          ADD COLUMN IF NOT EXISTS reviewed_by_id UUID;
        `);
        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS idx_omni_team_members_account_status
          ON omni_team_members (account_status);
        `);
        await prisma.$executeRawUnsafe(`
          ALTER TABLE omni_team_members
          ADD COLUMN IF NOT EXISTS is_team_admin BOOLEAN NOT NULL DEFAULT false;
        `);
        // Seed default admins by email allowlist
        await prisma.$executeRawUnsafe(`
          UPDATE omni_team_members
          SET is_team_admin = true
          WHERE lower(email) IN (
            'kimngan151091@gmail.com',
            'lehuyducanh.vn@gmail.com',
            'zuzzivn@gmail.com'
          );
        `);
        // Backfill: is_active=false without status → suspended; else keep active default
        await prisma.$executeRawUnsafe(`
          UPDATE omni_team_members
          SET account_status = 'suspended'
          WHERE is_active = false
            AND (account_status IS NULL OR account_status = 'active');
        `);
        // Team privacy / admin settings key-value
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS team_settings (
            key TEXT PRIMARY KEY,
            value JSONB NOT NULL DEFAULT '{}'::jsonb,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);
        await prisma.$executeRawUnsafe(`
          INSERT INTO team_settings (key, value)
          VALUES (
            'privacy',
            '{"hideSalaryFromPeers":true,"hideBankFromPeers":true,"hideAttendanceFromPeers":true,"hidePhoneFromPeers":false}'::jsonb
          )
          ON CONFLICT (key) DO NOTHING;
        `);
      })().catch((err) => {
        schemaReady = null;
        throw err;
      });
    }
    await schemaReady;
  }

  static async setTeamAdminFlag(memberId: string, isTeamAdmin: boolean) {
    await this.ensureSchema();
    await prisma.$executeRawUnsafe(
      `UPDATE omni_team_members SET is_team_admin = ${isTeamAdmin ? 'true' : 'false'}, updated_at = NOW() WHERE id = '${memberId}'::uuid`
    );
    return prisma.teamMember.findUnique({ where: { id: memberId } });
  }

  static async getPrivacySettings(): Promise<{
    hideSalaryFromPeers: boolean;
    hideBankFromPeers: boolean;
    hideAttendanceFromPeers: boolean;
    hidePhoneFromPeers: boolean;
  }> {
    await this.ensureSchema();
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT value FROM team_settings WHERE key = 'privacy' LIMIT 1`
    );
    const v = rows?.[0]?.value || {};
    return {
      hideSalaryFromPeers: v.hideSalaryFromPeers !== false,
      hideBankFromPeers: v.hideBankFromPeers !== false,
      hideAttendanceFromPeers: v.hideAttendanceFromPeers !== false,
      hidePhoneFromPeers: v.hidePhoneFromPeers === true,
    };
  }

  static async setPrivacySettings(patch: Record<string, boolean>) {
    await this.ensureSchema();
    const current = await this.getPrivacySettings();
    const next = { ...current, ...patch };
    const json = JSON.stringify(next).replace(/'/g, "''");
    await prisma.$executeRawUnsafe(`
      INSERT INTO team_settings (key, value, updated_at)
      VALUES ('privacy', '${json}'::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `);
    return next;
  }

  static async listMembers(opts?: {
    status?: AccountStatus | 'all';
    /** default true: only active; false: all */
    activeOnly?: boolean;
  }) {
    await this.ensureSchema();
    const status = opts?.status || 'all';
    const activeOnly = opts?.activeOnly === true;

    const where: any = {};
    if (activeOnly || status === 'active') {
      where.accountStatus = 'active';
      where.isActive = true;
    } else if (status && status !== 'all') {
      where.accountStatus = status;
    }

    return prisma.teamMember.findMany({
      where,
      orderBy: [{ accountStatus: 'asc' }, { fullName: 'asc' }],
    });
  }

  /** Login / bot identity: only fully active accounts. */
  static async lookupActive(query: string) {
    await this.ensureSchema();
    const q = (query || '').replace(/^@/, '').trim().toLowerCase();
    if (!q) return null;

    const members = await prisma.teamMember.findMany({
      where: {
        accountStatus: 'active',
        isActive: true,
        OR: [
          { email: { equals: q, mode: 'insensitive' } },
          { telegramUsername: { equals: q, mode: 'insensitive' } },
        ],
      },
      take: 2,
    });
    return members[0] || null;
  }

  static async getById(id: string) {
    await this.ensureSchema();
    return prisma.teamMember.findUnique({ where: { id } });
  }

  static async getByEmail(email: string) {
    await this.ensureSchema();
    return prisma.teamMember.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  }

  /**
   * Self-register (Telegram / form). Creates pending account — cannot login until approved.
   */
  static async register(data: {
    fullName: string;
    email: string;
    telegramUsername?: string;
    telegramChatId?: bigint | number | null;
    role?: string;
    phone?: string;
  }) {
    await this.ensureSchema();
    const email = data.email.toLowerCase().trim();
    const existing = await prisma.teamMember.findUnique({ where: { email } });

    if (existing) {
      // Link telegram if pending/active without telegram
      if (existing.accountStatus === 'rejected') {
        throw Object.assign(new Error('Tài khoản email này đã bị từ chối. Liên hệ Admin.'), {
          code: 'ACCOUNT_REJECTED',
          statusCode: 403,
        });
      }
      if (existing.accountStatus === 'suspended') {
        throw Object.assign(new Error('Tài khoản đang bị khoá. Liên hệ Admin.'), {
          code: 'ACCOUNT_SUSPENDED',
          statusCode: 403,
        });
      }
      if (existing.telegramUsername && data.telegramUsername) {
        const a = existing.telegramUsername.replace(/^@/, '').toLowerCase();
        const b = data.telegramUsername.replace(/^@/, '').toLowerCase();
        if (a !== b) {
          throw Object.assign(
            new Error(`Email đã liên kết Telegram @${existing.telegramUsername}.`),
            { code: 'EMAIL_TAKEN', statusCode: 409 }
          );
        }
      }
      // Link telegram to existing pending/active profile
      return prisma.teamMember.update({
        where: { id: existing.id },
        data: {
          telegramUsername: data.telegramUsername ?? existing.telegramUsername,
          telegramChatId: data.telegramChatId != null ? BigInt(data.telegramChatId) : existing.telegramChatId,
          fullName: data.fullName || existing.fullName,
        },
      });
    }

    // New email → pending
    return prisma.teamMember.create({
      data: {
        email,
        fullName: data.fullName.trim(),
        telegramUsername: data.telegramUsername || null,
        telegramChatId: data.telegramChatId != null ? BigInt(data.telegramChatId) : null,
        role: data.role || 'Nhân sự mới',
        skills: [],
        phone: data.phone || null,
        accountStatus: 'pending',
        isActive: false,
        workArrangement: 'office',
      },
    });
  }

  /**
   * Admin create/update full profile. Can set status/role.
   * Self profile update should NOT pass accountStatus elevation.
   */
  static async upsertByAdmin(data: {
    fullName: string;
    email: string;
    telegramUsername?: string;
    telegramChatId?: bigint | number | null;
    planeMemberId?: string;
    role?: string;
    skills?: string[];
    bankName?: string;
    bankAccount?: string;
    phone?: string;
    lettaConversationId?: string;
    workArrangement?: string;
    annualLeaveLimit?: number;
    annualLeaveUsed?: number;
    remoteLimit?: number;
    remoteUsed?: number;
    salaryGross?: number;
    dependentCount?: number;
    isActive?: boolean;
    accountStatus?: AccountStatus;
    accountNote?: string;
  }) {
    await this.ensureSchema();
    const email = data.email.toLowerCase().trim();
    const status = data.accountStatus;
    const isActive =
      data.isActive !== undefined
        ? data.isActive
        : status
          ? status === 'active'
          : undefined;

    return prisma.teamMember.upsert({
      where: { email },
      update: {
        fullName: data.fullName,
        telegramUsername: data.telegramUsername,
        telegramChatId: data.telegramChatId != null ? BigInt(data.telegramChatId) : undefined,
        planeMemberId: data.planeMemberId,
        role: data.role,
        skills: data.skills || [],
        bankName: data.bankName,
        bankAccount: data.bankAccount,
        phone: data.phone,
        lettaConversationId: data.lettaConversationId,
        ...(data.workArrangement !== undefined && { workArrangement: data.workArrangement }),
        ...(data.annualLeaveLimit !== undefined && { annualLeaveLimit: data.annualLeaveLimit }),
        ...(data.annualLeaveUsed !== undefined && { annualLeaveUsed: data.annualLeaveUsed }),
        ...(data.remoteLimit !== undefined && { remoteLimit: data.remoteLimit }),
        ...(data.remoteUsed !== undefined && { remoteUsed: data.remoteUsed }),
        ...(data.salaryGross !== undefined && { salaryGross: data.salaryGross }),
        ...(data.dependentCount !== undefined && { dependentCount: data.dependentCount }),
        ...(status !== undefined && { accountStatus: status }),
        ...(isActive !== undefined && { isActive }),
        ...(data.accountNote !== undefined && { accountNote: data.accountNote }),
      },
      create: {
        email,
        fullName: data.fullName,
        telegramUsername: data.telegramUsername || null,
        telegramChatId: data.telegramChatId != null ? BigInt(data.telegramChatId) : null,
        planeMemberId: data.planeMemberId || null,
        role: data.role || 'developer',
        skills: data.skills || [],
        bankName: data.bankName || null,
        bankAccount: data.bankAccount || null,
        phone: data.phone || null,
        lettaConversationId: data.lettaConversationId || null,
        workArrangement: data.workArrangement ?? 'office',
        annualLeaveLimit: data.annualLeaveLimit ?? 12,
        annualLeaveUsed: data.annualLeaveUsed ?? 0,
        remoteLimit: data.remoteLimit ?? 4,
        remoteUsed: data.remoteUsed ?? 0,
        salaryGross: data.salaryGross ?? 0,
        dependentCount: data.dependentCount ?? 0,
        accountStatus: status || 'active',
        isActive: isActive !== undefined ? isActive : (status || 'active') === 'active',
      },
    });
  }

  /** Self-service profile update — cannot change accountStatus / role to admin / isActive. */
  static async updateSelfProfile(
    email: string,
    data: {
      fullName?: string;
      phone?: string;
      telegramUsername?: string;
      bankName?: string;
      bankAccount?: string;
      skills?: string[];
      workArrangement?: string;
    }
  ) {
    await this.ensureSchema();
    const member = await prisma.teamMember.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (!member) {
      throw Object.assign(new Error('Không tìm thấy tài khoản'), { statusCode: 404 });
    }
    if (member.accountStatus !== 'active' || !member.isActive) {
      throw Object.assign(new Error('Tài khoản chưa được kích hoạt — không thể cập nhật hồ sơ'), {
        statusCode: 403,
        code: 'ACCOUNT_NOT_ACTIVE',
      });
    }
    return prisma.teamMember.update({
      where: { id: member.id },
      data: {
        ...(data.fullName !== undefined && { fullName: data.fullName }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.telegramUsername !== undefined && { telegramUsername: data.telegramUsername }),
        ...(data.bankName !== undefined && { bankName: data.bankName }),
        ...(data.bankAccount !== undefined && { bankAccount: data.bankAccount }),
        ...(data.skills !== undefined && { skills: data.skills }),
        ...(data.workArrangement !== undefined && { workArrangement: data.workArrangement }),
      },
    });
  }

  static async approve(id: string, reviewerId: string, note?: string) {
    await this.ensureSchema();
    return prisma.teamMember.update({
      where: { id },
      data: {
        accountStatus: 'active',
        isActive: true,
        accountNote: note || null,
        reviewedAt: new Date(),
        reviewedById: reviewerId,
      },
    });
  }

  static async reject(id: string, reviewerId: string, note?: string) {
    await this.ensureSchema();
    return prisma.teamMember.update({
      where: { id },
      data: {
        accountStatus: 'rejected',
        isActive: false,
        accountNote: note || 'Từ chối đăng ký',
        reviewedAt: new Date(),
        reviewedById: reviewerId,
      },
    });
  }

  static async suspend(id: string, reviewerId: string, note?: string) {
    await this.ensureSchema();
    return prisma.teamMember.update({
      where: { id },
      data: {
        accountStatus: 'suspended',
        isActive: false,
        accountNote: note || 'Tạm khoá',
        reviewedAt: new Date(),
        reviewedById: reviewerId,
      },
    });
  }

  /**
   * Soft delete = suspended. Hard delete removes row (only if no critical FKs — may fail).
   */
  static async remove(id: string, opts: { hard?: boolean; reviewerId?: string; note?: string }) {
    await this.ensureSchema();
    if (opts.hard) {
      return prisma.teamMember.delete({ where: { id } });
    }
    return this.suspend(id, opts.reviewerId || 'system', opts.note || 'Xoá mềm (suspend)');
  }
}
