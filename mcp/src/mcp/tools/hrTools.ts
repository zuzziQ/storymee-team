import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { CoreApiClient, API_ROUTES } from "@storymee/api-client";
import { fetchAxios } from "../../fetchAxios";

export async function executeHrTool(name: string, args: any, user: any, isBoss: boolean, apiClient: CoreApiClient, members: any[]): Promise<{ content: Array<{ type: string; text: string }> }> {

  switch (name) {
case "submit_leave_request": {
      const { date, session, type, reason, startDate, endDate, leaveType } = args as any;

      const employeeName = user.fullName;
      const sessionText = session === "all" ? "Cả ngày" : session === "am" ? "Buổi sáng" : "Buổi chiều";
      
      const finalStartDate = date ? date + "T00:00:00.000Z" : (startDate ? startDate + "T00:00:00.000Z" : null);
      const finalEndDate = date ? date + "T23:59:59.000Z" : (endDate ? endDate + "T23:59:59.000Z" : null);
      const finalLeaveType = leaveType || (type === "leave" ? "annual" : "remote");

      if (!finalStartDate || !finalEndDate) {
        throw new McpError(ErrorCode.InvalidParams, "Thiếu thông tin ngày xin nghỉ.");
      }

      let resJson;
          try {
            resJson = (await apiClient.post(API_ROUTES.HR.LEAVE_REQUESTS, {
                    memberId: user.id,
                    telegramUsername: user.telegramUsername || user.fullName,
                    leaveType: finalLeaveType,
                    startDate: finalStartDate,
                    endDate: finalEndDate,
                    reason: reason || "Xin nghỉ phép qua Bot Telegram"
                  })) as any;
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi tạo đơn xin nghỉ phép tại Core API.");
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

      const leavesRes = await apiClient.get("/omnitask/hr/leave-requests");
      let annualUsed = 0;
      let remoteUsed = 0;

      if (leavesRes.ok) {
        const leavesData = await leavesRes.json() as any;
        const leaves = leavesData.data || [];
        
        leaves.forEach((l: any) => {
          if (l.memberId === targetUser.id && l.status === 'approved') {
            const start = new Date(l.startDate);
            const end = new Date(l.endDate);
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
            
            if (l.leaveType === 'remote') {
              remoteUsed += diffDays;
            } else {
              annualUsed += diffDays;
            }
          }
        });
      }

      return {
        content: [{
          type: "text",
          text: `Hạn ngạch phép năm & làm remote của **${targetUser.fullName}**:\n` +
            `• Nghỉ phép năm: Đã dùng **${annualUsed}** / **12** ngày.\n` +
            `• Làm việc từ xa (Remote): Đã dùng **${remoteUsed}** / **4** ngày trong tháng.`
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
            await apiClient.post(API_ROUTES.HR.TEAM_MEMBERS, {
                    fullName: user.fullName,
                    email: user.email,
                    bankName: bank_name,
                    bankAccount: bank_account,
                    telegramUsername: user.telegramUsername,
                    telegramChatId: user.telegramChatId ? Number(user.telegramChatId) : null,
                    role: user.role,
                    skills: user.skills,
                    phone: user.phone
                  });
          } catch (err: any) {
            throw new McpError(ErrorCode.InternalError, "Lỗi cập nhật thông tin tại Core API.");
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

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Công cụ task ${name} chưa được hỗ trợ`);
  }
}
