"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeAttendanceTool = executeAttendanceTool;
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const api_client_1 = require("@storymee/api-client");
async function executeAttendanceTool(name, args, user, isBoss, apiClient, members) {
    switch (name) {
        case "check_in_out": {
            const { status, notes, employee_name } = args;
            let targetMember = user;
            if (employee_name && employee_name.toLowerCase() !== user.fullName.toLowerCase()) {
                if (!isBoss) {
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, "TỪ CHỐI TRUY CẬP: Chỉ có Admin/Boss mới có quyền điểm danh hộ nhân sự khác.");
                }
                const found = members.find((m) => m.fullName.toLowerCase() === employee_name.toLowerCase());
                if (!found) {
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, `Không tìm thấy nhân sự ${employee_name} trong hệ thống.`);
                }
                targetMember = found;
            }
            let checkinData;
            try {
                if (status === 'checkout') {
                    checkinData = (await apiClient.post(api_client_1.API_ROUTES.HR.ATTENDANCE_CHECKOUT, {
                        memberId: targetMember.id,
                        notes: notes || `Checkout từ Telegram`
                    }));
                }
                else {
                    checkinData = (await apiClient.post(api_client_1.API_ROUTES.HR.ATTENDANCE_CHECKIN, {
                        memberId: targetMember.id,
                        status: status || "present",
                        notes: notes || `Checkin từ Telegram`
                    }));
                }
            }
            catch (err) {
                console.error("[attendanceTools] Core API Error:", err);
                const errorData = err.data || err.response?.data;
                if (errorData?.status === 'already_checked_in') {
                    return {
                        content: [{
                                type: "text",
                                text: `⚠️ Nhân sự ${targetMember.fullName} đã check-in trước đó rồi.`
                            }]
                    };
                }
                if (errorData?.status === 'already_checked_out') {
                    return {
                        content: [{
                                type: "text",
                                text: `⚠️ Nhân sự ${targetMember.fullName} đã check-out trước đó rồi.`
                            }]
                    };
                }
                throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Lỗi kết nối điểm danh với Core API. Chi tiết: ${err.message || JSON.stringify(err)}`);
            }
            const att = checkinData.data;
            // Định dạng phản hồi
            const formatTime = (isoStr) => {
                if (!isoStr)
                    return "";
                return new Date(isoStr).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
            };
            const inTime = formatTime(att.checkIn);
            const outTime = att.checkOut ? formatTime(att.checkOut) : "";
            const actionType = att.checkOut ? "CHECK-OUT 🚪" : "CHECK-IN 🌅";
            const detailStr = att.checkOut
                ? `Check-in lúc: *${inTime}* | Check-out lúc: *${outTime}*`
                : `Check-in lúc: *${inTime}*`;
            return {
                content: [{
                        type: "text",
                        text: `🔔 *ĐIỂM DANH THÀNH CÔNG (${actionType}):*\n• Nhân viên: *${targetMember.fullName}*\n• Trạng thái: *${att.status}*\n• ${detailStr}\n• Ghi chú: *${att.notes || "Không có"}*`
                    }]
            };
        }
        case "get_attendance_report": {
            const { employee_name, month, year } = args;
            let targetMem = null;
            if (employee_name) {
                targetMem = members.find((m) => m.fullName.toLowerCase().includes(employee_name.toLowerCase()));
                if (!targetMem) {
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, `Không tìm thấy nhân viên tên "${employee_name}" trong hệ thống.`);
                }
            }
            else if (!isBoss) {
                targetMem = user;
            }
            const queryPath = targetMem
                ? `/internal/v1/team/hr/attendance?memberId=${targetMem.id}`
                : `/internal/v1/team/hr/attendance`;
            let attData;
            try {
                attData = (await apiClient.get(queryPath));
            }
            catch (err) {
                throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Lỗi fetch dữ liệu chấm công từ hệ thống HR.");
            }
            const list = attData.data || [];
            // Filter by month/year
            const d = new Date();
            const mTarget = month ? Number(month) : d.getMonth() + 1;
            const yTarget = year ? Number(year) : d.getFullYear();
            let totalHoursStr = 0;
            let presentDays = 0;
            let lateDays = 0;
            list.forEach((item) => {
                const itemD = new Date(item.date);
                if (itemD.getMonth() + 1 === mTarget && itemD.getFullYear() === yTarget) {
                    totalHoursStr += (item.totalHours || 0);
                    if (item.status === 'present')
                        presentDays++;
                    if (item.status === 'late')
                        lateDays++;
                }
            });
            totalHoursStr = Math.round(totalHoursStr * 100) / 100;
            const title = targetMem
                ? `Báo cáo công tháng ${mTarget}/${yTarget} của ${targetMem.fullName}`
                : `Báo cáo tổng hợp công tháng ${mTarget}/${yTarget} của toàn Team`;
            return {
                content: [{
                        type: "text",
                        text: `📊 *${title}*
• Tổng giờ làm: **${totalHoursStr} giờ**
• Số ngày đi đúng giờ: ${presentDays}
• Số ngày đi muộn: ${lateDays}`
                    }]
            };
        }
        default:
            throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, `Công cụ task ${name} chưa được hỗ trợ`);
    }
}
