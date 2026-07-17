// @ts-nocheck
import { ITeamMember, ILeaveRequest } from "@storymee/api-client";
import { prisma } from '../config/prisma';
import { HrHandoverService } from '../services/hrHandover.service';
import { HrService } from '../services/hr.service';
import { NotificationService } from '../services/notification.service';
import { TeamAccountService } from '../services/teamAccount.service';
import { isTeamAdmin, redactMemberPrivacy } from '../services/teamAuth.service';
import { StringCodec } from 'nats';

function serialize(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
}

function publishNats(req: any, subject: string, payload: unknown) {
  if (!req.server?.nats) return;
  try {
    const sc = StringCodec();
    req.server.nats.publish(subject, sc.encode(JSON.stringify(payload)));
  } catch (e) {
    console.error('[HrController] NATS publish failed', subject, e);
  }
}

export class HrController {
  /**
   * GET /hr/team-members?status=all|pending|active|suspended|rejected
   * Optional privacy: ?viewerId= | ?viewerEmail=
   * Non-admin viewers get salary/bank redacted when privacy settings require it.
   */
  static async getTeamMembers(req: any, reply: any) {
    const { status, viewerId, viewerEmail } = req.query || {};
    const members = await TeamAccountService.listMembers({
      status: status || 'all',
    });
    const privacy = await TeamAccountService.getPrivacySettings();
    let viewer: any = null;
    if (viewerId) {
      viewer = members.find((m: any) => m.id === viewerId) ||
        (await prisma.teamMember.findUnique({ where: { id: viewerId } }));
    } else if (viewerEmail) {
      const email = String(viewerEmail).toLowerCase().trim();
      viewer = members.find((m: any) => (m.email || '').toLowerCase() === email) ||
        (await prisma.teamMember.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
        }));
    }
    const viewerIsAdmin = isTeamAdmin(viewer);
    const data = members.map((m: any) => {
      const isSelf = viewer && (m.id === viewer.id || (m.email || '').toLowerCase() === (viewer.email || '').toLowerCase());
      let out = m;
      if (privacy.hideSalaryFromPeers || privacy.hideBankFromPeers) {
        out = redactMemberPrivacy(m, {
          viewerIsAdmin,
          isSelf: !!isSelf,
          hidePrivate: true,
        });
        if (!viewerIsAdmin && !isSelf) {
          if (!privacy.hideSalaryFromPeers) {
            out = { ...out, salaryGross: m.salaryGross, dependentCount: m.dependentCount };
          }
          if (!privacy.hideBankFromPeers) {
            out = { ...out, bankName: m.bankName, bankAccount: m.bankAccount };
          }
          if (privacy.hidePhoneFromPeers) {
            out = { ...out, phone: null };
          }
        }
      }
      // Always expose admin flag for UI badges (not sensitive)
      return serialize({ ...out, isTeamAdmin: !!(m as any).isTeamAdmin || isTeamAdmin(m) });
    });
    reply.code(200).send({
      status: 'success',
      data,
      privacy,
      viewerIsAdmin,
    });
  }

  /** GET /hr/settings/privacy */
  static async getPrivacySettings(req: any, reply: any) {
    const privacy = await TeamAccountService.getPrivacySettings();
    reply.code(200).send({ status: 'success', data: privacy });
  }

  /** PATCH /hr/settings/privacy — admin only */
  static async updatePrivacySettings(req: any, reply: any) {
    const { actorId, actorEmail, ...patch } = req.body || {};
    let actor: any = null;
    if (actorId) actor = await prisma.teamMember.findUnique({ where: { id: actorId } });
    else if (actorEmail) {
      actor = await prisma.teamMember.findFirst({
        where: { email: { equals: String(actorEmail).trim(), mode: 'insensitive' } },
      });
    }
    if (!isTeamAdmin(actor)) {
      reply.code(403).send({ status: 'error', message: 'Chỉ Admin mới sửa privacy settings' });
      return;
    }
    const allowed: any = {};
    for (const k of [
      'hideSalaryFromPeers',
      'hideBankFromPeers',
      'hideAttendanceFromPeers',
      'hidePhoneFromPeers',
    ]) {
      if (typeof patch[k] === 'boolean') allowed[k] = patch[k];
    }
    const data = await TeamAccountService.setPrivacySettings(allowed);
    reply.code(200).send({ status: 'success', data });
  }

  /** POST /hr/team-members/:id/set-admin — grant/revoke isTeamAdmin flag */
  static async setMemberAdmin(req: any, reply: any) {
    const { id } = req.params;
    const { actorId, actorEmail, isTeamAdmin: flag } = req.body || {};
    if (typeof flag !== 'boolean') {
      reply.code(400).send({ status: 'error', message: 'isTeamAdmin boolean required' });
      return;
    }
    let actor: any = null;
    if (actorId) actor = await prisma.teamMember.findUnique({ where: { id: actorId } });
    else if (actorEmail) {
      actor = await prisma.teamMember.findFirst({
        where: { email: { equals: String(actorEmail).trim(), mode: 'insensitive' } },
      });
    }
    if (!isTeamAdmin(actor)) {
      reply.code(403).send({ status: 'error', message: 'Chỉ Admin mới gán quyền Admin' });
      return;
    }
    // Prevent self-demotion if last email allowlist admin? allow demote non-allowlist only
    const member = await prisma.teamMember.findUnique({ where: { id } });
    if (!member) {
      reply.code(404).send({ status: 'error', message: 'Member not found' });
      return;
    }
    const updated = await TeamAccountService.setTeamAdminFlag(id, flag);
    reply.code(200).send({
      status: 'success',
      data: serialize({ ...updated, isTeamAdmin: flag }),
      message: flag ? `Đã cấp quyền Admin cho ${member.fullName}` : `Đã thu hồi Admin của ${member.fullName}`,
    });
  }

  /** GET /hr/auth/lookup?q=email|telegram — only active accounts (login gate) */
  static async authLookup(req: any, reply: any) {
    const q = (req.query?.q || req.query?.email || '').toString();
    if (!q) {
      reply.code(400).send({ status: 'error', message: 'Thiếu query q (email hoặc telegram)' });
      return;
    }
    const member = await TeamAccountService.lookupActive(q);
    if (!member) {
      // Distinguish pending vs not found
      await TeamAccountService.ensureSchema();
      const any = await prisma.teamMember.findFirst({
        where: {
          OR: [
            { email: { equals: q.replace(/^@/, '').trim(), mode: 'insensitive' } },
            { telegramUsername: { equals: q.replace(/^@/, '').trim(), mode: 'insensitive' } },
          ],
        },
      });
      if (any) {
        reply.code(403).send({
          status: 'error',
          code: `ACCOUNT_${(any.accountStatus || 'unknown').toUpperCase()}`,
          message:
            any.accountStatus === 'pending'
              ? 'Tài khoản đang chờ Admin duyệt. Vui lòng đợi thông báo.'
              : any.accountStatus === 'rejected'
                ? 'Tài khoản đã bị từ chối. Liên hệ Admin.'
                : any.accountStatus === 'suspended'
                  ? 'Tài khoản đang bị khoá. Liên hệ Admin.'
                  : 'Tài khoản chưa được kích hoạt.',
          accountStatus: any.accountStatus,
        });
        return;
      }
      reply.code(404).send({ status: 'error', code: 'NOT_FOUND', message: 'Không tìm thấy tài khoản nội bộ.' });
      return;
    }
    reply.code(200).send({ status: 'success', data: serialize(member) });
  }

  /**
   * POST /hr/team-members/register — self register → pending + NATS notify admins
   */
  static async registerTeamMember(req: any, reply: any) {
    try {
      const { fullName, email, telegramUsername, telegramChatId, role, phone } = req.body || {};
      if (!fullName || !email) {
        reply.code(400).send({ status: 'error', message: 'fullName và email là bắt buộc' });
        return;
      }
      const member = await TeamAccountService.register({
        fullName,
        email,
        telegramUsername,
        telegramChatId,
        role,
        phone,
      });
      publishNats(req, 'core.team.account.registered', {
        member: serialize(member),
        message: 'Yêu cầu đăng ký tài khoản nội bộ mới',
      });
      reply.code(201).send({
        status: 'success',
        message:
          member.accountStatus === 'pending'
            ? 'Đã gửi đăng ký. Vui lòng chờ Admin duyệt trước khi đăng nhập StorymeeTeam / dùng bot đầy đủ.'
            : 'Đã cập nhật liên kết Telegram trên hồ sơ hiện có.',
        data: serialize(member),
      });
    } catch (err: any) {
      reply.code(err.statusCode || 500).send({
        status: 'error',
        code: err.code,
        message: err.message || 'Đăng ký thất bại',
      });
    }
  }

  /**
   * POST /hr/team-members — admin upsert full profile OR self-update safe fields
   * Header/body: actorEmail (optional) — if same as email and not elevating status → self path
   */
  static async upsertTeamMember(req: any, reply: any) {
    try {
      const body = req.body || {};
      const {
        fullName, telegramUsername, telegramChatId, planeMemberId, email, role, skills,
        bankName, bankAccount, phone, lettaConversationId,
        workArrangement, annualLeaveLimit, annualLeaveUsed, remoteLimit, remoteUsed,
        salaryGross, dependentCount, isActive, accountStatus, accountNote,
        actorEmail, mode,
      } = body;
      if (!fullName || !email) {
        reply.code(400).send({ status: 'error', message: 'fullName và email là bắt buộc' });
        return;
      }

      // Self-service profile (explicit mode or actor matches target without admin flags)
      const isSelfMode = mode === 'self' || (
        actorEmail &&
        actorEmail.toLowerCase() === email.toLowerCase() &&
        accountStatus === undefined &&
        isActive === undefined &&
        salaryGross === undefined
      );

      if (isSelfMode) {
        const member = await TeamAccountService.updateSelfProfile(email, {
          fullName,
          phone,
          telegramUsername,
          bankName,
          bankAccount,
          skills: skills || [],
          workArrangement,
        });
        reply.code(200).send({ status: 'success', data: serialize(member) });
        return;
      }

      const member = await TeamAccountService.upsertByAdmin({
        fullName,
        telegramUsername,
        telegramChatId,
        planeMemberId,
        email,
        role,
        skills: skills || [],
        bankName,
        bankAccount,
        phone,
        lettaConversationId,
        workArrangement,
        annualLeaveLimit: annualLeaveLimit !== undefined ? Number(annualLeaveLimit) : undefined,
        annualLeaveUsed: annualLeaveUsed !== undefined ? Number(annualLeaveUsed) : undefined,
        remoteLimit: remoteLimit !== undefined ? Number(remoteLimit) : undefined,
        remoteUsed: remoteUsed !== undefined ? Number(remoteUsed) : undefined,
        salaryGross: salaryGross !== undefined ? Number(salaryGross) : undefined,
        dependentCount: dependentCount !== undefined ? Number(dependentCount) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        accountStatus,
        accountNote,
      });

      reply.code(200).send({
        status: 'success',
        data: serialize(member)
      });
    } catch (err: any) {
      reply.code(err.statusCode || 500).send({
        status: 'error',
        code: err.code,
        message: err.message || 'Cập nhật thất bại',
      });
    }
  }

  static async approveMember(req: any, reply: any) {
    try {
      const { id } = req.params;
      const { reviewerId, note } = req.body || {};
      if (!reviewerId) {
        reply.code(400).send({ status: 'error', message: 'Thiếu reviewerId' });
        return;
      }
      const reviewer = await TeamAccountService.getById(reviewerId);
      if (!isTeamAdmin(reviewer)) {
        reply.code(403).send({ status: 'error', message: 'Chỉ Admin mới được duyệt tài khoản' });
        return;
      }
      const member = await TeamAccountService.approve(id, reviewerId, note);
      publishNats(req, 'core.team.account.approved', { member: serialize(member), reviewerId });
      reply.code(200).send({ status: 'success', message: 'Đã duyệt tài khoản.', data: serialize(member) });
    } catch (err: any) {
      reply.code(500).send({ status: 'error', message: err.message });
    }
  }

  static async rejectMember(req: any, reply: any) {
    try {
      const { id } = req.params;
      const { reviewerId, note } = req.body || {};
      if (!reviewerId) {
        reply.code(400).send({ status: 'error', message: 'Thiếu reviewerId' });
        return;
      }
      const reviewer = await TeamAccountService.getById(reviewerId);
      if (!isTeamAdmin(reviewer)) {
        reply.code(403).send({ status: 'error', message: 'Chỉ Admin mới được từ chối tài khoản' });
        return;
      }
      const member = await TeamAccountService.reject(id, reviewerId, note);
      publishNats(req, 'core.team.account.rejected', { member: serialize(member), reviewerId });
      reply.code(200).send({ status: 'success', message: 'Đã từ chối đăng ký.', data: serialize(member) });
    } catch (err: any) {
      reply.code(500).send({ status: 'error', message: err.message });
    }
  }

  static async suspendMember(req: any, reply: any) {
    try {
      const { id } = req.params;
      const { reviewerId, note } = req.body || {};
      if (!reviewerId) {
        reply.code(400).send({ status: 'error', message: 'Thiếu reviewerId' });
        return;
      }
      const reviewer = await TeamAccountService.getById(reviewerId);
      if (!isTeamAdmin(reviewer)) {
        reply.code(403).send({ status: 'error', message: 'Chỉ Admin mới được khoá tài khoản' });
        return;
      }
      const member = await TeamAccountService.suspend(id, reviewerId, note);
      publishNats(req, 'core.team.account.suspended', { member: serialize(member), reviewerId });
      reply.code(200).send({ status: 'success', message: 'Đã khoá tài khoản.', data: serialize(member) });
    } catch (err: any) {
      reply.code(500).send({ status: 'error', message: err.message });
    }
  }

  /** DELETE /hr/team-members/:id?hard=true — soft suspend default; hard removes row */
  static async deleteMember(req: any, reply: any) {
    try {
      const { id } = req.params;
      const hard = String(req.query?.hard || '') === 'true';
      const { reviewerId, note } = req.body || {};
      if (reviewerId) {
        const reviewer = await TeamAccountService.getById(reviewerId);
        if (!isTeamAdmin(reviewer)) {
          reply.code(403).send({ status: 'error', message: 'Chỉ Admin mới được xoá tài khoản' });
          return;
        }
      }
      const result = await TeamAccountService.remove(id, { hard, reviewerId, note });
      publishNats(req, 'core.team.account.deleted', { id, hard, member: serialize(result) });
      reply.code(200).send({
        status: 'success',
        message: hard ? 'Đã xoá vĩnh viễn tài khoản.' : 'Đã xoá mềm (suspend) tài khoản.',
        data: serialize(result),
      });
    } catch (err: any) {
      reply.code(500).send({
        status: 'error',
        message: err.message || 'Xoá thất bại (có thể còn ràng buộc task/attendance). Thử soft delete.',
      });
    }
  }

  static async getSubtasks(req: any, reply: any) {
    const subtasks = await HrService.getSubtasks();
    const serialized = serialize(subtasks) as any[];

    // Group by parent Task to produce format: [{ id, title, subTasks: [...] }]
    // This is the format expected by storymeeteam-mcp MCP tools.
    const grouped: Record<string, any> = {};
    for (const sub of serialized) {
      const parentId = sub.taskId || '__no_parent__';
      if (!grouped[parentId]) {
        grouped[parentId] = {
          id: parentId,
          title: sub.Task?.title || sub.title,
          projectId: sub.Task?.projectId || null,
          subTasks: []
        };
      }
      grouped[parentId].subTasks.push(sub);
    }

    reply.code(200).send({
      status: 'success',
      data: Object.values(grouped)
    });
  }

  static async updateSubTask(req: any, reply: any) {
    const { id } = req.params;
    const { status, assigneeId, priority, deadline, estimatedHours, googleSheetRowId, planeTaskId, title, description } = req.body;

    const updated = await HrService.updateSubTask(id, {
      status,
      assigneeId,
      priority,
      deadline,
      estimatedHours,
      googleSheetRowId,
      planeTaskId,
      title,
      description
    });

    reply.code(200).send({
      status: 'success',
      data: serialize(updated)
    });
  }

  /**
   * @deprecated FROZEN — omni_sub_tasks create.
   * SSOT: POST /internal/v1/team/plane/issues with parentId for subtasks.
   */
  static async createSubTask(req: any, reply: any) {
    reply.code(410).send({
      status: 'error',
      success: false,
      code: 'LEGACY_SUBTASK_CREATE_FROZEN',
      message:
        'Legacy SubTask create đã đóng băng. Dùng POST /internal/v1/team/plane/issues với parentId (UUID PlIssue cha).',
      migrateTo: {
        method: 'POST',
        path: '/internal/v1/team/plane/issues',
        example: { title: 'Subtask', projectId: '<uuid>', parentId: '<parent pl_issue uuid>' },
      },
    });
  }

  static async deleteSubTask(req: any, reply: any) {
    const { id } = req.params;
    await HrService.deleteSubTask(id);
    reply.code(200).send({
      status: 'success',
      message: 'Subtask deleted successfully'
    });
  }

  /**
   * GET /hr/attendance?memberId=&viewerId=&viewerEmail=
   * Privacy: non-admin cannot list peers when hideAttendanceFromPeers.
   */
  static async getAttendance(req: any, reply: any) {
    const { memberId, viewerId, viewerEmail } = req.query || {};
    const privacy = await TeamAccountService.getPrivacySettings();

    let viewer: any = null;
    if (viewerId) {
      viewer = await prisma.teamMember.findUnique({ where: { id: viewerId } });
    } else if (viewerEmail) {
      viewer = await prisma.teamMember.findFirst({
        where: { email: { equals: String(viewerEmail).trim(), mode: 'insensitive' } },
      });
    }
    const viewerIsAdmin = isTeamAdmin(viewer);

    let where: any = memberId ? { memberId: memberId as string } : {};
    if (!viewerIsAdmin && privacy.hideAttendanceFromPeers && viewer?.id) {
      // Force self-only for peers
      where = { memberId: viewer.id };
    }

    const list = await prisma.attendance.findMany({
      where,
      include: { member: true },
      orderBy: { date: 'desc' },
    });
    reply.code(200).send({
      status: 'success',
      data: serialize(list),
      privacy: { hideAttendanceFromPeers: privacy.hideAttendanceFromPeers },
      viewerIsAdmin,
    });
  }

  /**
   * Resolve workType for check-in:
   * 1) full remote HR → remote
   * 2) approved remote leave covering the day → remote
   * 3) client request remote → remote
   * 4) else office
   */
  static async resolveCheckinWorkType(
    member: any,
    memberId: string,
    date: Date,
    requestedWorkType?: string
  ): Promise<{ workType: 'office' | 'remote'; reason: string }> {
    const arrangement = String(member?.workArrangement || 'office').toLowerCase();
    const isFullRemote =
      arrangement === 'remote' ||
      arrangement === 'full_remote' ||
      arrangement === 'fully_remote' ||
      arrangement === 'wfh';
    if (isFullRemote) {
      return { workType: 'remote', reason: 'full_remote_hr' };
    }

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const approvedRemote = await prisma.leaveRequest.findFirst({
      where: {
        memberId,
        leaveType: 'remote',
        status: 'approved',
        startDate: { lte: dayEnd },
        endDate: { gte: dayStart },
      },
      select: { id: true },
    });
    if (approvedRemote) {
      return { workType: 'remote', reason: 'approved_remote_leave' };
    }

    const requested = String(requestedWorkType || '').toLowerCase().trim();
    if (requested === 'remote') {
      return { workType: 'remote', reason: 'client_request' };
    }
    return { workType: 'office', reason: 'default_office' };
  }

  /**
   * When remote leave is approved: mark each day as remote attendance.
   * - Today / past days without check-in → auto check-in remote (08:30 VN that day, or now if today after 08:30)
   * - Future days → pre-create workType=remote (no check-in yet; check-in later still remote)
   * - Existing office check-in → flip workType to remote (giữ giờ vào)
   */
  static async applyApprovedRemoteToAttendance(
    memberId: string,
    startDate: Date,
    endDate: Date,
    reason?: string
  ): Promise<number> {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    const vnNowStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
    const vnNow = new Date(vnNowStr);
    const todayVn = new Date(vnNow);
    todayVn.setHours(0, 0, 0, 0);

    let touched = 0;
    for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
      const day = new Date(d);
      day.setHours(0, 0, 0, 0);
      const isFuture = day.getTime() > todayVn.getTime();
      const isToday = day.getTime() === todayVn.getTime();

      const existing = await prisma.attendance.findUnique({
        where: { memberId_date: { memberId, date: day } },
      });

      const noteTag = reason
        ? `Remote đã duyệt: ${reason}`
        : 'Auto remote (đơn remote đã duyệt)';

      if (existing?.checkIn) {
        // Đã check-in: chỉ sửa loại công + note
        await prisma.attendance.update({
          where: { id: existing.id },
          data: {
            workType: 'remote',
            notes: existing.notes?.includes('Remote')
              ? existing.notes
              : `${existing.notes || ''} | ${noteTag}`.trim().replace(/^\|/, '').trim(),
          },
        });
        touched++;
        continue;
      }

      // Chưa check-in
      let checkIn: Date | null = null;
      let status = 'present';
      if (!isFuture) {
        // 08:30 VN của ngày đó
        const checkInVn = new Date(day);
        checkInVn.setHours(8, 30, 0, 0);
        if (isToday && vnNow.getTime() > checkInVn.getTime()) {
          checkIn = new Date(); // dùng now thực (UTC ok)
        } else {
          // store as absolute time: construct from VN wall clock ≈ day 08:30 +7
          checkIn = new Date(day.getTime() + 8.5 * 3600 * 1000);
        }
        const hour = isToday ? vnNow.getHours() : 8;
        status = hour >= 9 ? 'late' : 'present';
      }

      await prisma.attendance.upsert({
        where: { memberId_date: { memberId, date: day } },
        create: {
          memberId,
          date: day,
          checkIn,
          status,
          workType: 'remote',
          notes: noteTag,
        },
        update: {
          workType: 'remote',
          ...(checkIn && !existing?.checkIn ? { checkIn, status } : {}),
          notes: noteTag,
        },
      });
      touched++;
    }
    return touched;
  }

  /** CHECK-IN: Ghi nhận giờ vào — chỉ tạo mới, không update nếu đã check-in */
  static async checkin(req: any, reply: any) {
    const { memberId, notes, workType } = req.body;
    if (!memberId) {
      reply.code(400).send({ status: 'error', message: 'memberId là bắt buộc' });
      return;
    }

    const member = await prisma.teamMember.findUnique({ where: { id: memberId } });
    if (!member) {
      reply.code(404).send({ status: 'error', message: 'Không tìm thấy nhân sự' });
      return;
    }

    const now = new Date();
    // Chuyển giờ hệ thống sang giờ VN, sau đó lấy mốc Midnight UTC của ngày hôm đó
    const vnTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
    const date = new Date(vnTimeStr);
    date.setHours(0, 0, 0, 0);

    const resolved = await HrController.resolveCheckinWorkType(member, memberId, date, workType);
    const resolvedWorkType = resolved.workType;
    const arrangement = String((member as any).workArrangement || 'office').toLowerCase();
    const isFullRemote = resolved.reason === 'full_remote_hr';

    // Kiểm tra đã check-in chưa
    const existing = await prisma.attendance.findUnique({
      where: { memberId_date: { memberId, date } }
    });

    if (existing?.checkIn) {
      // Nếu đã check-in office nhưng hôm nay có remote leave / full remote → sửa workType
      if (existing.workType !== resolvedWorkType && resolvedWorkType === 'remote') {
        const fixed = await prisma.attendance.update({
          where: { id: existing.id },
          data: {
            workType: 'remote',
            notes: `${existing.notes || ''} | Sửa remote (${resolved.reason})`.trim(),
          },
          include: { member: true },
        });
        reply.code(200).send({
          status: 'success',
          action: 'check_in_worktype_fixed',
          message: 'Đã check-in trước đó — cập nhật loại công sang Remote.',
          data: serialize(fixed),
          resolvedWorkType,
          resolveReason: resolved.reason,
        });
        return;
      }
      reply.code(409).send({
        status: 'already_checked_in',
        message: 'Đã check-in rồi, vui lòng dùng endpoint checkout để check-out.',
        data: serialize(existing)
      });
      return;
    }

    // Xác định trạng thái đúng giờ / đi muộn (sau 9:00)
    const vietNamHour = new Date(vnTimeStr).getHours();
    const status = vietNamHour >= 9 ? 'late' : 'present';

    const defaultNote =
      notes ||
      (resolved.reason === 'approved_remote_leave'
        ? 'Check-in Remote (đơn remote đã duyệt)'
        : isFullRemote
          ? 'Check-in Remote (full remote HR)'
          : `Check-in ${resolvedWorkType === 'remote' ? 'Remote' : 'Văn phòng'}`);

    const attendance = await prisma.attendance.upsert({
      where: { memberId_date: { memberId, date } },
      create: {
        memberId,
        date,
        checkIn: now,
        status,
        workType: resolvedWorkType,
        notes: defaultNote,
      },
      update: {
        checkIn: now,
        status,
        workType: resolvedWorkType,
        notes: notes || undefined
      },
      include: { member: true }
    });

    reply.code(200).send({
      status: 'success',
      action: 'check_in',
      data: serialize(attendance),
      workArrangement: arrangement,
      resolvedWorkType,
      resolveReason: resolved.reason,
      forcedRemote: resolvedWorkType === 'remote',
    });
  }

  /** CHECK-OUT: Ghi nhận giờ ra — chỉ update nếu đã check-in, tính totalHours */
  static async checkout(req: any, reply: any) {
    const { memberId, notes } = req.body;
    if (!memberId) {
      reply.code(400).send({ status: 'error', message: 'memberId là bắt buộc' });
      return;
    }

    const now = new Date();
    // Chuyển giờ hệ thống sang giờ VN, sau đó lấy mốc Midnight UTC của ngày hôm đó
    const vnTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
    const date = new Date(vnTimeStr);
    date.setHours(0, 0, 0, 0);

    const existing = await prisma.attendance.findUnique({
      where: { memberId_date: { memberId, date } }
    });

    if (!existing?.checkIn) {
      reply.code(400).send({ status: 'error', message: 'Chưa check-in, không thể check-out.' });
      return;
    }

    if (existing.checkOut) {
      reply.code(409).send({
        status: 'already_checked_out',
        message: 'Đã check-out rồi hôm nay.',
        data: serialize(existing)
      });
      return;
    }

    // Tính tổng giờ làm (checkIn -> checkOut)
    const checkInTime = new Date(existing.checkIn);
    const diffMs = now.getTime() - checkInTime.getTime();
    let totalHours = diffMs / (1000 * 60 * 60);

    // Trừ giờ nghỉ trưa (12:00 - 13:30)
    const lunchStart = new Date(date);
    lunchStart.setHours(12, 0, 0, 0);
    const lunchEnd = new Date(date);
    lunchEnd.setHours(13, 30, 0, 0);

    const overlapStart = new Date(Math.max(checkInTime.getTime(), lunchStart.getTime()));
    const overlapEnd = new Date(Math.min(now.getTime(), lunchEnd.getTime()));
    
    if (overlapStart < overlapEnd) {
      const overlapHours = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60);
      totalHours -= overlapHours;
    }
    
    if (totalHours < 0) totalHours = 0;
    totalHours = Math.round(totalHours * 100) / 100; // 2 decimal

    const attendance = await prisma.attendance.update({
      where: { id: existing.id },
      data: {
        checkOut: now,
        totalHours,
        notes: notes ? `${existing.notes || ''} | Check-out: ${notes}` : existing.notes
      },
      include: { member: true }
    });

    reply.code(200).send({ status: 'success', action: 'check_out', totalHours, data: serialize(attendance) });
  }

  static async getLeaveRequests(req: any, reply: any) {
    const list = await prisma.leaveRequest.findMany({
      include: { member: true },
      orderBy: { createdAt: 'desc' }
    });
    reply.code(200).send({ status: 'success', data: serialize(list) });
  }

  static async createLeaveRequest(req: any, reply: any) {
    const { memberId, leaveType, startDate, endDate, reason } = req.body;
    if (!memberId || !leaveType || !startDate || !endDate) {
      reply.code(400).send({ status: 'error', message: 'Thiếu thông tin yêu cầu phép' });
      return;
    }

    const request = await prisma.leaveRequest.create({
      data: {
        memberId,
        leaveType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
        status: "pending"
      },
      include: { member: true }
    });

    const notif = await NotificationService.createNotification(
      memberId,
      `Yêu cầu nghỉ phép`,
      `Nhân sự xin ${leaveType === 'sick' ? 'nghỉ ốm' : leaveType === 'annual' ? 'nghỉ phép năm' : leaveType === 'remote' ? 'làm remote' : 'nghỉ việc riêng'} từ ${startDate} đến ${endDate}`,
      'leave_request',
      { leaveRequestId: request.id, leaveType, startDate, endDate, reason }
    );

    if (req.server && req.server.nats) {
      const sc = StringCodec();
      req.server.nats.publish('core.team.leave.request', sc.encode(JSON.stringify({
        leaveRequest: request,
        notification: notif
      })));
    }

    reply.code(201).send({ status: 'success', data: serialize(request) });
  }

  static async approveLeaveRequest(req: any, reply: any) {
    const { id } = req.params;
    const { status } = req.body; // "approved" hoặc "rejected"

    const current = await prisma.leaveRequest.findUnique({ where: { id }, include: { member: true } });
    if (!current) {
      reply.code(404).send({ status: 'error', message: 'Không tìm thấy đơn xin nghỉ' });
      return;
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: status || "approved"
      },
      include: { member: true }
    });

    // Nếu approve → cộng số ngày vào counter của member
    if (updated.status === 'approved' && current.status !== 'approved') {
      const start = new Date(current.startDate);
      const end = new Date(current.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      // Tính số ngày (inclusive, min 1)
      const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1);

      const member = current.member;
      if (member) {
        if (current.leaveType === 'annual' || current.leaveType === 'sick') {
          await prisma.teamMember.update({
            where: { id: member.id },
            data: { annualLeaveUsed: { increment: diffDays } }
          });
        } else if (current.leaveType === 'remote') {
          await prisma.teamMember.update({
            where: { id: member.id },
            data: { remoteUsed: { increment: diffDays } }
          });
          // Auto ghi attendance remote cho các ngày trong đơn (hôm nay/quá khứ: auto check-in)
          try {
            const n = await HrController.applyApprovedRemoteToAttendance(
              member.id,
              current.startDate,
              current.endDate,
              current.reason || undefined
            );
            console.log(
              `[approveLeave] remote auto-attendance member=${member.id} daysTouched=${n}`
            );
          } catch (e: any) {
            console.error('[approveLeave] applyApprovedRemoteToAttendance failed:', e?.message || e);
          }
        }
      }
    }

    // Nếu reject sau khi đã approve trước đó → hoàn trả counter
    if (updated.status === 'rejected' && current.status === 'approved') {
      const start = new Date(current.startDate);
      const end = new Date(current.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1);
      const member = current.member;
      if (member) {
        if (current.leaveType === 'annual' || current.leaveType === 'sick') {
          await prisma.teamMember.update({
            where: { id: member.id },
            data: { annualLeaveUsed: { decrement: diffDays } }
          });
        } else if (current.leaveType === 'remote') {
          await prisma.teamMember.update({
            where: { id: member.id },
            data: { remoteUsed: { decrement: diffDays } }
          });
        }
      }
    }

    let handoverResult = null;
    if (updated.status === 'approved') {
      handoverResult = await HrHandoverService.handleLeaveApproval(updated.id);
    }
    
    const notif = await NotificationService.createNotification(
      updated.memberId,
      updated.status === 'approved' ? `Đơn xin nghỉ được duyệt` : `Đơn xin nghỉ bị từ chối`,
      updated.status === 'approved' ? `Admin đã phê duyệt đơn xin nghỉ của bạn.` : `Admin đã từ chối đơn xin nghỉ của bạn.`,
      'leave_resolved',
      { leaveRequestId: updated.id, status: updated.status }
    );

    if (req.server && req.server.nats) {
      const sc = StringCodec();
      req.server.nats.publish('core.team.leave.resolved', sc.encode(JSON.stringify({
        leaveRequest: updated,
        handover: handoverResult,
        notification: notif
      })));
    }

    reply.code(200).send({
      status: 'success',
      data: {
        leaveRequest: serialize(updated),
        handover: serialize(handoverResult)
      }
    });
  }

  /**
   * @deprecated FROZEN — SubTask archive.
   * SSOT: POST /internal/v1/team/plane/issues/:id/request-archive
   */
  static async requestArchiveTask(req: any, reply: any) {
    const { taskId } = req.params;
    reply.code(410).send({
      status: 'error',
      success: false,
      code: 'LEGACY_ARCHIVE_FROZEN',
      message:
        'Legacy /hr/tasks/:id/request-archive (SubTask) đã đóng băng. ' +
        `Dùng POST /internal/v1/team/plane/issues/${taskId}/request-archive`,
      migrateTo: {
        method: 'POST',
        path: `/internal/v1/team/plane/issues/${taskId}/request-archive`,
        body: { reason: '...' },
      },
    });
  }
}
