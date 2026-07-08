"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeHrTool = executeHrTool;
var types_js_1 = require("@modelcontextprotocol/sdk/types.js");
var api_client_1 = require("@storymee/api-client");
function executeHrTool(name, args, user, isBoss, apiClient, members) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, _b, date, session, type, reason, startDate, endDate, leaveType, employeeName, sessionText, finalStartDate, finalEndDate, finalLeaveType, resJson, err_1, statusStr, requestId, leaveTypeStr, targetName_1, targetUser_1, leavesRes, annualUsed_1, remoteUsed_1, leavesData, leaves, _c, employee_name, month, targetName_2, targetUser, salaryMap, salaryInfo, gross, dependent, insuranceBase, bhxh, bhyt, bhtn, totalInsurance, selfDeduction, dependentDeduction, taxableIncome, pit, netSalary, _d, bank_account, bank_name, err_2, _e, email, fullName, role, skills, phone, telegramUsername, telegramChatId, bankName, bankAccount, err_3;
        var _f, _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    _a = name;
                    switch (_a) {
                        case "submit_leave_request": return [3 /*break*/, 1];
                        case "get_leave_allowance": return [3 /*break*/, 6];
                        case "get_my_payroll_slip": return [3 /*break*/, 10];
                        case "update_personal_info": return [3 /*break*/, 11];
                        case "upsert_team_member": return [3 /*break*/, 16];
                    }
                    return [3 /*break*/, 21];
                case 1:
                    _b = args, date = _b.date, session = _b.session, type = _b.type, reason = _b.reason, startDate = _b.startDate, endDate = _b.endDate, leaveType = _b.leaveType;
                    employeeName = user.fullName;
                    sessionText = session === "all" ? "Cả ngày" : session === "am" ? "Buổi sáng" : "Buổi chiều";
                    finalStartDate = date ? date + "T00:00:00.000Z" : (startDate ? startDate + "T00:00:00.000Z" : null);
                    finalEndDate = date ? date + "T23:59:59.000Z" : (endDate ? endDate + "T23:59:59.000Z" : null);
                    finalLeaveType = leaveType || (type === "leave" ? "annual" : "remote");
                    if (!finalStartDate || !finalEndDate) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, "Thiếu thông tin ngày xin nghỉ.");
                    }
                    resJson = void 0;
                    _h.label = 2;
                case 2:
                    _h.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, apiClient.post(api_client_1.API_ROUTES.HR.LEAVE_REQUESTS, {
                            memberId: user.id,
                            telegramUsername: user.telegramUsername || user.fullName,
                            leaveType: finalLeaveType,
                            startDate: finalStartDate,
                            endDate: finalEndDate,
                            reason: reason || "Xin nghỉ phép qua Bot Telegram"
                        })];
                case 3:
                    resJson = (_h.sent());
                    return [3 /*break*/, 5];
                case 4:
                    err_1 = _h.sent();
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Lỗi tạo đơn xin nghỉ phép tại Core API.");
                case 5:
                    statusStr = ((_f = resJson.data) === null || _f === void 0 ? void 0 : _f.status) === 'approved' ? 'Approved' : 'Pending';
                    requestId = (_g = resJson.data) === null || _g === void 0 ? void 0 : _g.id;
                    leaveTypeStr = finalLeaveType === 'sick' ? 'Nghỉ ốm' : finalLeaveType === 'annual' ? 'Nghỉ phép năm' : finalLeaveType === 'remote' ? 'Đăng ký Remote' : 'Việc riêng';
                    return [2 /*return*/, {
                            content: [{
                                    type: "text",
                                    text: "N\u1ED9p \u0111\u01A1n \u0111\u0103ng k\u00FD th\u00E0nh c\u00F4ng! \u2713\n\u2022 **H\u1ECD t\u00EAn**: ".concat(employeeName, "\n\u2022 **Lo\u1EA1i \u0111\u01A1n**: ").concat(leaveTypeStr, " (").concat(sessionText, ")\n\u2022 **Th\u1EDDi gian**: ").concat(finalStartDate.split('T')[0], " \u0111\u1EBFn ").concat(finalEndDate.split('T')[0], "\n\u2022 **L\u00FD do**: ").concat(reason || 'Không có', "\n\u2022 **Tr\u1EA1ng th\u00E1i**: ").concat(statusStr)
                                }],
                            requestId: requestId
                        }];
                case 6:
                    targetName_1 = (args === null || args === void 0 ? void 0 : args.employee_name) || user.fullName;
                    if (!isBoss && targetName_1.toLowerCase() !== user.fullName.toLowerCase()) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, "T\u1EEA CH\u1ED0I TRUY C\u1EACP: B\u1EA1n kh\u00F4ng c\u00F3 quy\u1EC1n tra c\u1EE9u h\u1EA1n ng\u1EA1ch ngh\u1EC9 ph\u00E9p c\u1EE7a nh\u00E2n s\u1EF1 ".concat(targetName_1, "."));
                    }
                    targetUser_1 = members.find(function (m) { return m.fullName.toLowerCase() === targetName_1.toLowerCase(); });
                    if (!targetUser_1) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, "Kh\u00F4ng t\u00ECm th\u1EA5y nh\u00E2n s\u1EF1 ".concat(targetName_1, "."));
                    }
                    return [4 /*yield*/, apiClient.get("/omnitask/hr/leave-requests")];
                case 7:
                    leavesRes = _h.sent();
                    annualUsed_1 = 0;
                    remoteUsed_1 = 0;
                    if (!leavesRes.ok) return [3 /*break*/, 9];
                    return [4 /*yield*/, leavesRes.json()];
                case 8:
                    leavesData = _h.sent();
                    leaves = leavesData.data || [];
                    leaves.forEach(function (l) {
                        if (l.memberId === targetUser_1.id && l.status === 'approved') {
                            var start = new Date(l.startDate);
                            var end = new Date(l.endDate);
                            var diffTime = Math.abs(end.getTime() - start.getTime());
                            var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
                            if (l.leaveType === 'remote') {
                                remoteUsed_1 += diffDays;
                            }
                            else {
                                annualUsed_1 += diffDays;
                            }
                        }
                    });
                    _h.label = 9;
                case 9: return [2 /*return*/, {
                        content: [{
                                type: "text",
                                text: "H\u1EA1n ng\u1EA1ch ph\u00E9p n\u0103m & l\u00E0m remote c\u1EE7a **".concat(targetUser_1.fullName, "**:\n") +
                                    "\u2022 Ngh\u1EC9 ph\u00E9p n\u0103m: \u0110\u00E3 d\u00F9ng **".concat(annualUsed_1, "** / **12** ng\u00E0y.\n") +
                                    "\u2022 L\u00E0m vi\u1EC7c t\u1EEB xa (Remote): \u0110\u00E3 d\u00F9ng **".concat(remoteUsed_1, "** / **4** ng\u00E0y trong th\u00E1ng.")
                            }]
                    }];
                case 10:
                    {
                        _c = args, employee_name = _c.employee_name, month = _c.month;
                        targetName_2 = employee_name || user.fullName;
                        if (!isBoss && targetName_2.toLowerCase() !== user.fullName.toLowerCase()) {
                            throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, "T\u1EEA CH\u1ED0I TRUY C\u1EACP: B\u1EA1n kh\u00F4ng \u0111\u01B0\u1EE3c ph\u00E9p xem b\u1EA3ng l\u01B0\u01A1ng c\u1EE7a nh\u00E2n s\u1EF1 ".concat(targetName_2, "."));
                        }
                        targetUser = members.find(function (m) { return m.fullName.toLowerCase() === targetName_2.toLowerCase(); });
                        if (!targetUser) {
                            throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, "Kh\u00F4ng t\u00ECm th\u1EA5y nh\u00E2n s\u1EF1 ".concat(targetName_2, " \u0111\u1EC3 t\u00EDnh l\u01B0\u01A1ng."));
                        }
                        salaryMap = {
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
                        salaryInfo = salaryMap[targetUser.fullName.toLowerCase()] || { gross: 15000000, dependent: 0 };
                        gross = salaryInfo.gross;
                        dependent = salaryInfo.dependent;
                        insuranceBase = 5310000;
                        bhxh = insuranceBase * 0.08;
                        bhyt = insuranceBase * 0.015;
                        bhtn = insuranceBase * 0.01;
                        totalInsurance = bhxh + bhyt + bhtn;
                        selfDeduction = 11000000;
                        dependentDeduction = dependent * 4400000;
                        taxableIncome = Math.max(0, gross - totalInsurance - selfDeduction - dependentDeduction);
                        pit = 0;
                        if (taxableIncome > 0) {
                            if (taxableIncome <= 5000000)
                                pit = taxableIncome * 0.05;
                            else if (taxableIncome <= 10000000)
                                pit = taxableIncome * 0.1 - 250000;
                            else if (taxableIncome <= 18000000)
                                pit = taxableIncome * 0.15 - 750000;
                            else if (taxableIncome <= 32000000)
                                pit = taxableIncome * 0.2 - 1650000;
                            else if (taxableIncome <= 52000000)
                                pit = taxableIncome * 0.25 - 3250000;
                            else if (taxableIncome <= 80000000)
                                pit = taxableIncome * 0.3 - 5850000;
                            else
                                pit = taxableIncome * 0.35 - 9850000;
                        }
                        netSalary = gross - totalInsurance - pit;
                        return [2 /*return*/, {
                                content: [{
                                        type: "text",
                                        text: "Phi\u1EBFu l\u01B0\u01A1ng nh\u00E2n s\u1EF1 **".concat(targetUser.fullName, "** (Th\u00E1ng ").concat(month, "):\n") +
                                            "\u2022 V\u1ECB tr\u00ED: ".concat(targetUser.role || 'Nhân sự', "\n") +
                                            "\u2022 L\u01B0\u01A1ng Gross: **".concat(gross.toLocaleString("vi-VN"), " VN\u0110**\n") +
                                            "\u2022 Kh\u1EA5u tr\u1EEB b\u1EA3o hi\u1EC3m (10.5% m\u1EE9c \u0111\u00F3ng t\u1ED1i thi\u1EC3u 5.310.000\u0111): **-".concat(totalInsurance.toLocaleString("vi-VN"), " VN\u0110**\n") +
                                            "  (BHXH: -".concat(bhxh.toLocaleString("vi-VN"), "\u0111, BHYT: -").concat(bhyt.toLocaleString("vi-VN"), "\u0111, BHTN: -").concat(bhtn.toLocaleString("vi-VN"), "\u0111)\n") +
                                            "\u2022 Thu\u1EBF TNCN kh\u1EA5u tr\u1EEB: **-".concat(pit.toLocaleString("vi-VN"), " VN\u0110** (S\u1ED1 ng\u01B0\u1EDDi ph\u1EE5 thu\u1ED9c: ").concat(dependent, ")\n") +
                                            "\u2022 **L\u01AF\u01A0NG NET TH\u1EF0C NH\u1EACN**: **".concat(Math.round(netSalary).toLocaleString("vi-VN"), " VN\u0110**\n") +
                                            "\u2022 T\u00E0i kho\u1EA3n chuy\u1EC3n kho\u1EA3n: ".concat(targetUser.bankAccount || 'Chưa cập nhật', " (").concat(targetUser.bankName || 'Chưa cập nhật', ")")
                                    }]
                            }];
                    }
                    _h.label = 11;
                case 11:
                    _d = args, bank_account = _d.bank_account, bank_name = _d.bank_name;
                    _h.label = 12;
                case 12:
                    _h.trys.push([12, 14, , 15]);
                    return [4 /*yield*/, apiClient.post(api_client_1.API_ROUTES.HR.TEAM_MEMBERS, {
                            fullName: user.fullName,
                            email: user.email,
                            bankName: bank_name,
                            bankAccount: bank_account,
                            telegramUsername: user.telegramUsername,
                            telegramChatId: user.telegramChatId ? Number(user.telegramChatId) : null,
                            role: user.role,
                            skills: user.skills,
                            phone: user.phone
                        })];
                case 13:
                    _h.sent();
                    return [3 /*break*/, 15];
                case 14:
                    err_2 = _h.sent();
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Lỗi cập nhật thông tin tại Core API.");
                case 15: return [2 /*return*/, {
                        content: [{
                                type: "text",
                                text: "C\u1EADp nh\u1EADt th\u00F4ng tin nh\u1EADn l\u01B0\u01A1ng th\u00E0nh c\u00F4ng! \u2713\n\u2022 **Ch\u1EE7 t\u00E0i kho\u1EA3n**: ".concat(user.fullName, "\n\u2022 **S\u1ED1 t\u00E0i kho\u1EA3n m\u1EDBi**: ").concat(bank_account, "\n\u2022 **Ng\u00E2n h\u00E0ng**: ").concat(bank_name)
                            }]
                    }];
                case 16:
                    _e = args, email = _e.email, fullName = _e.fullName, role = _e.role, skills = _e.skills, phone = _e.phone, telegramUsername = _e.telegramUsername, telegramChatId = _e.telegramChatId, bankName = _e.bankName, bankAccount = _e.bankAccount;
                    if (!isBoss) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, "TỪ CHỐI TRUY CẬP: Chỉ có Admin/Boss mới có quyền thêm hoặc cập nhật thông tin nhân sự.");
                    }
                    _h.label = 17;
                case 17:
                    _h.trys.push([17, 19, , 20]);
                    return [4 /*yield*/, apiClient.post(api_client_1.API_ROUTES.HR.TEAM_MEMBERS, {
                            email: email,
                            fullName: fullName,
                            role: role || undefined,
                            skills: skills || [],
                            phone: phone || undefined,
                            telegramUsername: telegramUsername || undefined,
                            telegramChatId: telegramChatId ? Number(telegramChatId) : undefined,
                            bankName: bankName || undefined,
                            bankAccount: bankAccount || undefined
                        })];
                case 18:
                    _h.sent();
                    return [3 /*break*/, 20];
                case 19:
                    err_3 = _h.sent();
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Lỗi cập nhật nhân sự tại Core API.");
                case 20: return [2 /*return*/, {
                        content: [{
                                type: "text",
                                text: "C\u1EADp nh\u1EADt nh\u00E2n s\u1EF1 th\u00E0nh c\u00F4ng! \u2713\n\u2022 **H\u1ECD t\u00EAn**: ".concat(fullName, "\n\u2022 **Email**: ").concat(email, "\n\u2022 **Vai tr\u00F2**: ").concat(role || 'Chưa rõ', "\n\u2022 **Telegram**: ").concat(telegramUsername ? '@' + telegramUsername : 'Chưa có', " (Chat ID: ").concat(telegramChatId || 'Chưa có', ")")
                            }]
                    }];
                case 21: throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, "C\u00F4ng c\u1EE5 task ".concat(name, " ch\u01B0a \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3"));
            }
        });
    });
}
