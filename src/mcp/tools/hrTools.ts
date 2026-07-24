import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { CoreApiClient, API_ROUTES } from "@storymee/api-client";
import { fetchAxios } from "../../fetchAxios";
import { getTeamMembersCache } from "../../index";

async function resolveAttendees(attendeesInput: any[]): Promise<string[]> {
  if (!attendeesInput || !Array.isArray(attendeesInput) || attendeesInput.length === 0) return [];
  const members = await getTeamMembersCache();
  const resolvedIds: string[] = [];
  for (const input of attendeesInput) {
    if (!input || typeof input !== 'string') continue;
    const cleanInput = input.replace(/^@/, '').toLowerCase().trim();
    let found = members.find((m: any) => 
      m.id.toLowerCase() === cleanInput || 
      (m.telegramUsername && m.telegramUsername.toLowerCase() === cleanInput) ||
      (m.email && m.email.toLowerCase() === cleanInput) ||
      m.fullName.toLowerCase() === cleanInput
    );
    if (!found) {
      found = members.find((m: any) => m.fullName.toLowerCase().includes(cleanInput) || (m.telegramUsername && m.telegramUsername.toLowerCase().includes(cleanInput)));
    }
    if (found && !resolvedIds.includes(found.id)) {
      resolvedIds.push(found.id);
    }
  }
  return resolvedIds;
}

export const HR_TOOLS_SCHEMA = [
  {
    name: "submit_leave_request",
    description: "Đăng ký đơn xin nghỉ phép thường niên hoặc làm việc từ xa (remote). Bắt buộc phải có ngày nghỉ, buổi nghỉ, loại đơn và lý do.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Ngày xin nghỉ định dạng YYYY-MM-DD" },
        session: { type: "string", enum: ["all", "am", "pm"], description: "Cả ngày (all), sáng (am), hoặc chiều (pm)" },
        type: { type: "string", enum: ["leave", "remote"], description: "Nghỉ phép (leave) hoặc làm remote (remote)" },
        reason: { type: "string", description: "Lý do xin phép cụ thể" }
      },
      required: ["date", "session", "type", "reason"]
    }
  },
  {
    name: "get_leave_allowance",
    description: "Xem hạn mức ngày nghỉ phép/remote còn lại của nhân sự.",
    inputSchema: {
      type: "object",
      properties: {
        employee_name: { type: "string", description: "Tên nhân sự tra cứu. Để trống nếu tự xem của mình." }
      }
    }
  },
  {
    name: "get_my_payroll_slip",
    description: "Tra cứu chi tiết phiếu lương cá nhân (Gross, Net, BHXH, Thuế TNCN). Nhân viên chỉ xem được của chính mình. Admin/Boss xem được của tất cả.",
    inputSchema: {
      type: "object",
      properties: {
        employee_name: { type: "string", description: "Tên nhân sự cần xem. Để trống nếu tự xem của mình." },
        month: { type: "string", description: "Tháng tra cứu định dạng YYYY-MM (Ví dụ: 2026-06)" }
      },
      required: ["month"]
    }
  },
  {
    name: "update_personal_info",
    description: "Cập nhật số tài khoản ngân hàng và tên ngân hàng nhận lương của cá nhân.",
    inputSchema: {
      type: "object",
      properties: {
        bank_account: { type: "string", description: "Số tài khoản ngân hàng mới" },
        bank_name: { type: "string", description: "Tên ngân hàng (ví dụ: Techcombank, Vietcombank)" }
      },
      required: ["bank_account", "bank_name"]
    }
  },
  {
    name: "upsert_team_member",
    description: "Tạo mới hoặc cập nhật thông tin chi tiết của một nhân sự (Họ tên, email, vai trò, kỹ năng, số điện thoại, ngân hàng, Telegram ID...).",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Email của nhân viên (khóa định danh chính)" },
        fullName: { type: "string", description: "Họ và tên đầy đủ" },
        role: { type: "string", description: "Vai trò/Chức danh (ví dụ: Developer, Designer)" },
        skills: { type: "array", items: { type: "string" }, description: "Danh sách kỹ năng" },
        phone: { type: "string", description: "Số điện thoại liên hệ" },
        telegramUsername: { type: "string", description: "Username Telegram (không chứa ký tự @)" },
        telegramChatId: { type: "number", description: "ID Chat Telegram (số nguyên)" },
        bankName: { type: "string", description: "Tên ngân hàng" },
        bankAccount: { type: "string", description: "Số tài khoản ngân hàng" }
      },
      required: ["email", "fullName"]
    }
  },
  {
    name: "schedule_meeting",
    description: "Tạo lịch họp mới. QUAN TRỌNG: startTime và endTime PHẢI là chuỗi ISO 8601 đầy đủ (ví dụ: '2026-07-23T09:00:00+07:00'). Nếu user không nói endTime, hãy tự động tính endTime = startTime + 1 giờ. Luôn dùng múi giờ +07:00 (Việt Nam).",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Tiêu đề cuộc họp" },
        description: { type: "string", description: "Mô tả nội dung họp" },
        startTime: { type: "string", description: "Giờ bắt đầu, ISO 8601, ví dụ: 2026-07-23T09:00:00+07:00" },
        endTime: { type: "string", description: "Giờ kết thúc, ISO 8601. Nếu không rõ, mặc định = startTime + 1 giờ" },
        attendees: { type: "array", items: { type: "string" }, description: "Danh sách người tham dự (tên, email hoặc @telegram)" },
        meetLink: { type: "string", description: "Link Google Meet hoặc Zoom (nếu có)" }
      },
      required: ["title", "startTime"]
    }
  },
  {
    name: "update_meeting",
    description: "Cập nhật hoặc hủy lịch họp.",
    inputSchema: {
      type: "object",
      properties: {
        meeting_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        startTime: { type: "string" },
        endTime: { type: "string" },
        attendees: { type: "array", items: { type: "string" } },
        meetLink: { type: "string", description: "Link Google Meet (nếu có)" },
        status: { type: "string" }
      },
      required: ["meeting_id"]
    }
  },
  {
    name: "approve_leave_request",
    description: "Admin duyệt hoặc từ chối đơn nghỉ phép/remote. CHỈ ADMIN.",
    inputSchema: {
      type: "object",
      properties: {
        leave_id: { type: "string", description: "UUID đơn nghỉ (leave request id)" },
        decision: { type: "string", enum: ["approve", "reject", "approved", "rejected"], description: "Duyệt hoặc từ chối" }
      },
      required: ["leave_id", "decision"]
    }
  },
  {
    name: "list_leave_requests",
    description: "Liệt kê đơn nghỉ. Nhân viên: của mình. Admin: tất cả hoặc filter status.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "approved", "rejected", "all"], description: "Lọc trạng thái (mặc định all)" }
      }
    }
  },
  {
    name: "broadcast_announcement",
    description: "Gửi thông báo toàn team (notify all). CHỈ ADMIN.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        content: { type: "string" }
      },
      required: ["title", "content"]
    }
  }
];

export async function executeHrTool(name: string, args: any, user: any, isBoss: boolean, apiClient: CoreApiClient, members: any[]): Promise<{ content: Array<{ type: string; text: string }> }> {

  switch (name) {
case "submit_leave_request": {
      const { date, session, type, reason, startDate, endDate, leaveType } = args as any;

      const employeeName = user.fullName;
      const sessionText = session === "all" ? "Cả ngày" : session === "am" ? "Buổi sáng" : "Buổi chiều";
      
      let finalStartDate = date ? date + "T00:00:00.000Z" : (startDate ? startDate + "T00:00:00.000Z" : null);
      let finalEndDate = date ? date + "T23:59:59.000Z" : (endDate ? endDate + "T23:59:59.000Z" : null);
      
      if (session === "am" && finalEndDate) {
        finalEndDate = finalEndDate.replace("T23:59:59.000Z", "T12:00:00.000Z");
      } else if (session === "pm" && finalStartDate) {
        finalStartDate = finalStartDate.replace("T00:00:00.000Z", "T12:00:00.000Z");
      }
      
      const finalLeaveType = leaveType || (type === "leave" ? "annual" : "remote");

      if (!finalStartDate || !finalEndDate) {
        throw new McpError(ErrorCode.InvalidParams, "Thiếu thông tin ngày xin nghỉ.");
      }

      // SSOT body — identical to StorymeeTeam LeaveRequestForm
      // POST /hr/leave-requests { memberId, leaveType, startDate, endDate, reason }
      let resJson;
          try {
            resJson = (await apiClient.post(API_ROUTES.HR.LEAVE_REQUESTS, {
                    memberId: user.id,
                    leaveType: finalLeaveType, // annual | remote | sick | personal
                    startDate: finalStartDate,
                    endDate: finalEndDate,
                    reason: reason || "Xin nghỉ phép qua Bot Telegram"
                  })) as any;
            if (resJson?.status === 'error' || resJson?.success === false) {
              throw new Error(resJson.message || 'API từ chối đơn nghỉ');
            }
          } catch (err: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Lỗi tạo đơn xin nghỉ phép: ${err?.data?.message || err?.message || err}`
            );
          }
      const statusStr = resJson.data?.status === 'approved' ? 'Approved' : 'Pending';
      const requestId = resJson.data?.id;

      const leaveTypeStr = finalLeaveType === 'sick' ? 'Nghỉ ốm' : finalLeaveType === 'annual' ? 'Nghỉ phép năm' : finalLeaveType === 'remote' ? 'Đăng ký Remote' : 'Việc riêng';

      return {
        content: [{
          type: "text",
          text: `Nộp đơn đăng ký thành công! ✓\n• **Họ tên**: ${employeeName}\n• **Loại đơn**: ${leaveTypeStr} (${sessionText})\n• **Thời gian**: ${finalStartDate.split('T')[0]} đến ${finalEndDate.split('T')[0]}\n• **Lý do**: ${reason || 'Không có'}\n• **Trạng thái**: ${statusStr}`
        }],
        requestId: requestId
      } as any;
    }
case "get_leave_allowance": {
      const targetName = args?.employee_name || user.fullName;

      if (!isBoss && targetName.toLowerCase() !== user.fullName.toLowerCase()) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `TỪ CHỐI TRUY CẬP: Bạn không có quyền tra cứu hạn ngạch nghỉ phép của nhân sự ${targetName}.`
        );
      }

      const targetUser = members.find((m: any) => m.fullName.toLowerCase() === targetName.toLowerCase());
      if (!targetUser) {
        throw new McpError(ErrorCode.InvalidParams, `Không tìm thấy nhân sự ${targetName}.`);
      }

      // apiClient base already includes /internal/v1/team
      const leavesRes = (await apiClient.get(API_ROUTES.HR.LEAVE_REQUESTS)) as any;
      let annualUsed = Number(targetUser.annualLeaveUsed) || 0;
      let remoteUsed = Number(targetUser.remoteUsed) || 0;

      // Prefer counters on TeamMember; optionally recompute from approved leaves if counters missing
      if (!targetUser.annualLeaveUsed && !targetUser.remoteUsed) {
        annualUsed = 0;
        remoteUsed = 0;
        const leaves = leavesRes?.data || [];
        leaves.forEach((l: any) => {
          if (l.memberId === targetUser.id && l.status === 'approved') {
            const start = new Date(l.startDate);
            const end = new Date(l.endDate);
            start.setHours(0, 0, 0, 0);
            end.setHours(0, 0, 0, 0);
            const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
            
            if (l.leaveType === 'remote') {
              remoteUsed += diffDays;
            } else {
              annualUsed += diffDays;
            }
          }
        });
      }

      const annualLimit = Number(targetUser.annualLeaveLimit) || 12;
      const remoteLimit = Number(targetUser.remoteLimit) || 4;
      const work = targetUser.workArrangement || 'office';
      const remoteLine =
        work === 'remote'
          ? `• Làm việc từ xa: **Full remote** (không áp hạn mức remote tháng).`
          : `• Làm việc từ xa (Remote): Đã dùng **${remoteUsed}** / **${remoteLimit}** ngày (hạn mức cấu hình HR).`;

      return {
        content: [{
          type: "text",
          text: `Hạn ngạch phép & remote của **${targetUser.fullName}**:\n` +
            `• Hình thức làm việc: **${work}**\n` +
            `• Nghỉ phép năm: Đã dùng **${annualUsed}** / **${annualLimit}** ngày (còn ${Math.max(0, annualLimit - annualUsed)}).\n` +
            remoteLine
        }]
      };
    }
case "get_my_payroll_slip": {
      const { employee_name, month } = args as any;
      const targetName = employee_name || user.fullName;

      if (!isBoss && targetName.toLowerCase() !== user.fullName.toLowerCase()) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `TỪ CHỐI TRUY CẬP: Bạn không được phép xem bảng lương của nhân sự ${targetName}.`
        );
      }

      const targetUser = members.find((m: any) => m.fullName.toLowerCase() === targetName.toLowerCase());
      if (!targetUser) {
        throw new McpError(ErrorCode.InvalidParams, `Không tìm thấy nhân sự ${targetName} để tính lương.`);
      }

      const salaryMap: Record<string, { gross: number, dependent: number }> = {
        "trần thị kim ngân": { gross: 45000000, dependent: 1 },
        "lê huy đức anh": { gross: 35000000, dependent: 0 },
        "trần thanh tú": { gross: 25000000, dependent: 2 },
        "nguyễn đức trung dũng": { gross: 18000000, dependent: 0 },
        "nguyễn thảo lan": { gross: 12000000, dependent: 0 },
        "bùi hương giang": { gross: 18000000, dependent: 0 },
        "lê quang minh": { gross: 22000000, dependent: 0 },
        "trần hải dương": { gross: 16000000, dependent: 1 },
        "đậu thị linh": { gross: 15000000, dependent: 0 },
        "phạm hoàng quỳnh hương": { gross: 17000000, dependent: 0 }
      };

      const salaryInfo = salaryMap[targetUser.fullName.toLowerCase()] || { gross: 15000000, dependent: 0 };
      const gross = salaryInfo.gross;
      const dependent = salaryInfo.dependent;

      const insuranceBase = 5310000;
      const bhxh = insuranceBase * 0.08;
      const bhyt = insuranceBase * 0.015;
      const bhtn = insuranceBase * 0.01;
      const totalInsurance = bhxh + bhyt + bhtn;

      const selfDeduction = 11000000;
      const dependentDeduction = dependent * 4400000;
      const taxableIncome = Math.max(0, gross - totalInsurance - selfDeduction - dependentDeduction);

      let pit = 0;
      if (taxableIncome > 0) {
        if (taxableIncome <= 5000000) pit = taxableIncome * 0.05;
        else if (taxableIncome <= 10000000) pit = taxableIncome * 0.1 - 250000;
        else if (taxableIncome <= 18000000) pit = taxableIncome * 0.15 - 750000;
        else if (taxableIncome <= 32000000) pit = taxableIncome * 0.2 - 1650000;
        else if (taxableIncome <= 52000000) pit = taxableIncome * 0.25 - 3250000;
        else if (taxableIncome <= 80000000) pit = taxableIncome * 0.3 - 5850000;
        else pit = taxableIncome * 0.35 - 9850000;
      }

      const netSalary = gross - totalInsurance - pit;

      return {
        content: [{
          type: "text",
          text: `Phiếu lương nhân sự **${targetUser.fullName}** (Tháng ${month}):\n` +
            `• Vị trí: ${targetUser.role || 'Nhân sự'}\n` +
            `• Lương Gross: **${gross.toLocaleString("vi-VN")} VNĐ**\n` +
            `• Khấu trừ bảo hiểm (10.5% mức đóng tối thiểu 5.310.000đ): **-${totalInsurance.toLocaleString("vi-VN")} VNĐ**\n` +
            `  (BHXH: -${bhxh.toLocaleString("vi-VN")}đ, BHYT: -${bhyt.toLocaleString("vi-VN")}đ, BHTN: -${bhtn.toLocaleString("vi-VN")}đ)\n` +
            `• Thuế TNCN khấu trừ: **-${pit.toLocaleString("vi-VN")} VNĐ** (Số người phụ thuộc: ${dependent})\n` +
            `• **LƯƠNG NET THỰC NHẬN**: **${Math.round(netSalary).toLocaleString("vi-VN")} VNĐ**\n` +
            `• Tài khoản chuyển khoản: ${targetUser.bankAccount || 'Chưa cập nhật'} (${targetUser.bankName || 'Chưa cập nhật'})`
        }]
      };
    }
case "update_personal_info": {
      const { bank_account, bank_name } = args as any;

      try {
            // mode:self — không được nâng accountStatus/role (parity FE handleSaveMyProfile)
            await apiClient.post(API_ROUTES.HR.TEAM_MEMBERS, {
                    mode: 'self',
                    actorEmail: user.email,
                    fullName: user.fullName,
                    email: user.email,
                    bankName: bank_name,
                    bankAccount: bank_account,
                    telegramUsername: user.telegramUsername,
                    phone: user.phone,
                    skills: user.skills || [],
                  });
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, `Lỗi cập nhật thông tin: ${err?.data?.message || err?.message || err}`);
          }
      return {
        content: [{
          type: "text",
          text: `Cập nhật thông tin nhận lương thành công! ✓\n• **Chủ tài khoản**: ${user.fullName}\n• **Số tài khoản mới**: ${bank_account}\n• **Ngân hàng**: ${bank_name}`
        }]
      };
    }
case "upsert_team_member": {
      const { email, fullName, role, skills, phone, telegramUsername, telegramChatId, bankName, bankAccount } = args as any;

      if (!isBoss) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          "TỪ CHỐI TRUY CẬP: Chỉ có Admin/Boss mới có quyền thêm hoặc cập nhật thông tin nhân sự."
        );
      }

      try {
            await apiClient.post(API_ROUTES.HR.TEAM_MEMBERS, {
                    email,
                    fullName,
                    role: role || undefined,
                    skills: skills || [],
                    phone: phone || undefined,
                    telegramUsername: telegramUsername || undefined,
                    telegramChatId: telegramChatId ? Number(telegramChatId) : undefined,
                    bankName: bankName || undefined,
                    bankAccount: bankAccount || undefined
                  });
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi cập nhật nhân sự tại Core API.");
          }
      return {
        content: [{
          type: "text",
          text: `Cập nhật nhân sự thành công! ✓\n• **Họ tên**: ${fullName}\n• **Email**: ${email}\n• **Vai trò**: ${role || 'Chưa rõ'}\n• **Telegram**: ${telegramUsername ? '@' + telegramUsername : 'Chưa có'} (Chat ID: ${telegramChatId || 'Chưa có'})`
        }]
      };
    }
    
    case "schedule_meeting": {
      // Normalize: LLM đôi khi gửi start_time/end_time thay vì startTime/endTime
      const rawArgs = args as any;
      const title = rawArgs.title;
      const description = rawArgs.description;
      const meetLink = rawArgs.meetLink || rawArgs.meet_link;
      const rawAttendees = rawArgs.attendees || rawArgs.participants || [];

      // Normalize startTime
      let startTime: string = rawArgs.startTime || rawArgs.start_time || '';
      if (!startTime) {
        throw new McpError(ErrorCode.InternalError, 'Thiếu thông tin giờ bắt đầu (startTime). Vui lòng thử lại và cung cấp giờ bắt đầu.');
      }
      // Ensure timezone offset for VN if missing
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(startTime)) {
        startTime = startTime + '+07:00';
      }

      // Normalize endTime — default to startTime + 1h if missing
      let endTime: string = rawArgs.endTime || rawArgs.end_time || '';
      if (!endTime) {
        const startMs = new Date(startTime).getTime();
        if (!isNaN(startMs)) {
          endTime = new Date(startMs + 60 * 60 * 1000).toISOString();
        }
      }
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(endTime)) {
        endTime = endTime + '+07:00';
      }

      const resolvedAttendees = await resolveAttendees(rawAttendees);
      let resJson;
      try {
        if (!user?.id) {
          throw new McpError(ErrorCode.InternalError, 'Không xác định được người tổ chức (hostId). Vui lòng thử lại.');
        }
        resJson = await apiClient.post(API_ROUTES.HR.MEETINGS, {
          title,
          description,
          startTime,
          endTime,
          hostId: user.id,
          attendees: resolvedAttendees,
          meetLink
        });
      } catch (err: any) {
        const errMsg = err?.data?.message || err?.message || JSON.stringify(err);
        console.error('[schedule_meeting] API error:', errMsg, '| user.id:', user?.id, '| startTime:', startTime, '| endTime:', endTime, '| args:', JSON.stringify(rawArgs));
        if (err instanceof McpError) throw err;
        throw new McpError(ErrorCode.InternalError, `Lỗi tạo lịch họp: ${errMsg}`);
      }
      const meeting = resJson?.data || resJson;
      // Format time for display in VN timezone
      const fmtTime = (iso: string) => {
        try {
          return new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch { return iso; }
      };
      return {
        content: [{ type: "text", text: `Đã đặt lịch họp thành công! ✓\n• Tiêu đề: ${title}\n• Bắt đầu: ${fmtTime(startTime)}\n• Kết thúc: ${fmtTime(endTime)}\n• Người tham dự: ${resolvedAttendees.length} người` }]
      };
    }
    
    case "update_meeting": {
      const { meeting_id, title, description, startTime, endTime, attendees, status, meetLink } = args as any;
      
      let resolvedAttendees = undefined;
      if (attendees) {
        resolvedAttendees = await resolveAttendees(attendees);
      }

      try {
        await apiClient.patch(`hr/meetings/${meeting_id}`, {
          title,
          description,
          startTime,
          endTime,
          attendees: resolvedAttendees,
          status,
          meetLink
        });
      } catch (err: any) {
        throw new McpError(ErrorCode.InternalError, `Lỗi cập nhật lịch họp: ${err?.data?.message || err?.message || err}`);
      }
      return {
        content: [{ type: "text", text: `Đã cập nhật lịch họp thành công: ${meeting_id}` }]
      };
    }

    case "approve_leave_request": {
      if (!isBoss) {
        throw new McpError(ErrorCode.InvalidRequest, "Chỉ Admin mới được duyệt đơn nghỉ.");
      }
      const { leave_id, decision } = args as any;
      if (!leave_id || !decision) {
        throw new McpError(ErrorCode.InvalidParams, "Cần leave_id và decision (approve|reject).");
      }
      const d = String(decision).toLowerCase();
      const status =
        d === 'approve' || d === 'approved' || d === 'duyet' || d === 'duyệt'
          ? 'approved'
          : 'rejected';
      try {
        await apiClient.post(`${API_ROUTES.HR.LEAVE_REQUESTS}/${leave_id}/approve`, { status });
      } catch (err: any) {
        throw new McpError(
          ErrorCode.InternalError,
          `Lỗi duyệt đơn: ${err?.data?.message || err?.message || err}`
        );
      }
      return {
        content: [{
          type: "text",
          text: `Đã ${status === 'approved' ? 'DUYỆT' : 'TỪ CHỐI'} đơn nghỉ \`${leave_id}\`.`
        }]
      };
    }

    case "list_leave_requests": {
      const statusFilter = (args?.status || 'all').toLowerCase();
      let res: any;
      try {
        res = await apiClient.get(API_ROUTES.HR.LEAVE_REQUESTS);
      } catch (err: any) {
        throw new McpError(ErrorCode.InternalError, "Lỗi lấy danh sách đơn nghỉ.");
      }
      let leaves = res?.data || [];
      if (!isBoss) {
        leaves = leaves.filter((l: any) => l.memberId === user.id);
      }
      if (statusFilter !== 'all') {
        leaves = leaves.filter((l: any) => (l.status || '').toLowerCase() === statusFilter);
      }
      if (leaves.length === 0) {
        return { content: [{ type: "text", text: "Không có đơn nghỉ nào (theo bộ lọc)." }] };
      }
      const lines = leaves.slice(0, 20).map((l: any) => {
        const name = l.member?.fullName || l.memberId;
        const s = (l.startDate || '').toString().split('T')[0];
        const e = (l.endDate || '').toString().split('T')[0];
        return `• \`${l.id}\` ${name} | ${l.leaveType} | ${s}→${e} | *${l.status}* | ${l.reason || ''}`;
      });
      return {
        content: [{
          type: "text",
          text: `📋 *ĐƠN NGHỈ* (${leaves.length}):\n` + lines.join('\n')
        }]
      };
    }

    case "broadcast_announcement": {
      if (!isBoss) {
        throw new McpError(ErrorCode.InvalidRequest, "Chỉ Admin mới gửi thông báo toàn team.");
      }
      const { title, content } = args as any;
      if (!title || !content) {
        throw new McpError(ErrorCode.InvalidParams, "Cần title và content.");
      }
      try {
        await apiClient.post('hr/announcements', {
          title,
          content,
          senderId: user.id,
        });
      } catch (err: any) {
        throw new McpError(
          ErrorCode.InternalError,
          `Lỗi gửi announcement: ${err?.data?.message || err?.message || err}`
        );
      }
      return {
        content: [{ type: "text", text: `Đã gửi thông báo toàn team: *${title}*` }]
      };
    }

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Công cụ HR ${name} chưa được hỗ trợ`);
  }
}
