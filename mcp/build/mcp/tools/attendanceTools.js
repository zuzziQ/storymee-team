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
exports.executeAttendanceTool = executeAttendanceTool;
var types_js_1 = require("@modelcontextprotocol/sdk/types.js");
var api_client_1 = require("@storymee/api-client");
function executeAttendanceTool(name, args, user, isBoss, apiClient, members) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, _b, status_1, notes, employee_name_1, targetMember, found, checkinData, err_1, att, formatTime, inTime, outTime, actionType, detailStr, _c, employee_name_2, month, year, targetMem, queryPath, attData, err_2, list, d, mTarget_1, yTarget_1, totalHoursStr_1, presentDays_1, lateDays_1, title;
        var _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    _a = name;
                    switch (_a) {
                        case "check_in_out": return [3 /*break*/, 1];
                        case "get_attendance_report": return [3 /*break*/, 9];
                    }
                    return [3 /*break*/, 14];
                case 1:
                    _b = args, status_1 = _b.status, notes = _b.notes, employee_name_1 = _b.employee_name;
                    targetMember = user;
                    if (employee_name_1 && employee_name_1.toLowerCase() !== user.fullName.toLowerCase()) {
                        if (!isBoss) {
                            throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, "TỪ CHỐI TRUY CẬP: Chỉ có Admin/Boss mới có quyền điểm danh hộ nhân sự khác.");
                        }
                        found = members.find(function (m) { return m.fullName.toLowerCase() === employee_name_1.toLowerCase(); });
                        if (!found) {
                            throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, "Kh\u00F4ng t\u00ECm th\u1EA5y nh\u00E2n s\u1EF1 ".concat(employee_name_1, " trong h\u1EC7 th\u1ED1ng."));
                        }
                        targetMember = found;
                    }
                    checkinData = void 0;
                    _f.label = 2;
                case 2:
                    _f.trys.push([2, 7, , 8]);
                    if (!(status_1 === 'checkout')) return [3 /*break*/, 4];
                    return [4 /*yield*/, apiClient.post(api_client_1.API_ROUTES.HR.ATTENDANCE_CHECKOUT, {
                            memberId: targetMember.id,
                            notes: notes || "Checkout t\u1EEB Telegram"
                        })];
                case 3:
                    checkinData = (_f.sent());
                    return [3 /*break*/, 6];
                case 4: return [4 /*yield*/, apiClient.post(api_client_1.API_ROUTES.HR.ATTENDANCE_CHECKIN, {
                        memberId: targetMember.id,
                        status: status_1 || "present",
                        notes: notes || "Checkin t\u1EEB Telegram"
                    })];
                case 5:
                    checkinData = (_f.sent());
                    _f.label = 6;
                case 6: return [3 /*break*/, 8];
                case 7:
                    err_1 = _f.sent();
                    if (((_e = (_d = err_1.response) === null || _d === void 0 ? void 0 : _d.data) === null || _e === void 0 ? void 0 : _e.status) === 'already_checked_out') {
                        return [2 /*return*/, {
                                content: [{
                                        type: "text",
                                        text: "\u26A0\uFE0F Nh\u00E2n s\u1EF1 ".concat(targetMember.fullName, " \u0111\u00E3 checkout tr\u01B0\u1EDBc \u0111\u00F3 r\u1ED3i.")
                                    }]
                            }];
                    }
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Lỗi kết nối điểm danh với Core API.");
                case 8:
                    att = checkinData.data;
                    formatTime = function (isoStr) {
                        if (!isoStr)
                            return "";
                        return new Date(isoStr).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
                    };
                    inTime = formatTime(att.checkIn);
                    outTime = att.checkOut ? formatTime(att.checkOut) : "";
                    actionType = att.checkOut ? "CHECK-OUT 🚪" : "CHECK-IN 🌅";
                    detailStr = att.checkOut
                        ? "Check-in l\u00FAc: *".concat(inTime, "* | Check-out l\u00FAc: *").concat(outTime, "*")
                        : "Check-in l\u00FAc: *".concat(inTime, "*");
                    return [2 /*return*/, {
                            content: [{
                                    type: "text",
                                    text: "\uD83D\uDD14 *\u0110I\u1EC2M DANH TH\u00C0NH C\u00D4NG (".concat(actionType, "):*\n\u2022 Nh\u00E2n vi\u00EAn: *").concat(targetMember.fullName, "*\n\u2022 Tr\u1EA1ng th\u00E1i: *").concat(att.status, "*\n\u2022 ").concat(detailStr, "\n\u2022 Ghi ch\u00FA: *").concat(att.notes || "Không có", "*")
                                }]
                        }];
                case 9:
                    _c = args, employee_name_2 = _c.employee_name, month = _c.month, year = _c.year;
                    targetMem = null;
                    if (employee_name_2) {
                        targetMem = members.find(function (m) { return m.fullName.toLowerCase().includes(employee_name_2.toLowerCase()); });
                        if (!targetMem) {
                            throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, "Kh\u00F4ng t\u00ECm th\u1EA5y nh\u00E2n vi\u00EAn t\u00EAn \"".concat(employee_name_2, "\" trong h\u1EC7 th\u1ED1ng."));
                        }
                    }
                    else if (!isBoss) {
                        targetMem = user;
                    }
                    queryPath = targetMem
                        ? "/omnitask/hr/attendance?memberId=".concat(targetMem.id)
                        : "/omnitask/hr/attendance";
                    attData = void 0;
                    _f.label = 10;
                case 10:
                    _f.trys.push([10, 12, , 13]);
                    return [4 /*yield*/, apiClient.get(queryPath)];
                case 11:
                    attData = (_f.sent());
                    return [3 /*break*/, 13];
                case 12:
                    err_2 = _f.sent();
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Lỗi fetch dữ liệu chấm công từ hệ thống HR.");
                case 13:
                    list = attData.data || [];
                    d = new Date();
                    mTarget_1 = month ? Number(month) : d.getMonth() + 1;
                    yTarget_1 = year ? Number(year) : d.getFullYear();
                    totalHoursStr_1 = 0;
                    presentDays_1 = 0;
                    lateDays_1 = 0;
                    list.forEach(function (item) {
                        var itemD = new Date(item.date);
                        if (itemD.getMonth() + 1 === mTarget_1 && itemD.getFullYear() === yTarget_1) {
                            totalHoursStr_1 += (item.totalHours || 0);
                            if (item.status === 'present')
                                presentDays_1++;
                            if (item.status === 'late')
                                lateDays_1++;
                        }
                    });
                    totalHoursStr_1 = Math.round(totalHoursStr_1 * 100) / 100;
                    title = targetMem
                        ? "B\u00E1o c\u00E1o c\u00F4ng th\u00E1ng ".concat(mTarget_1, "/").concat(yTarget_1, " c\u1EE7a ").concat(targetMem.fullName)
                        : "B\u00E1o c\u00E1o t\u1ED5ng h\u1EE3p c\u00F4ng th\u00E1ng ".concat(mTarget_1, "/").concat(yTarget_1, " c\u1EE7a to\u00E0n Team");
                    return [2 /*return*/, {
                            content: [{
                                    type: "text",
                                    text: "\uD83D\uDCCA *".concat(title, "*\n\u2022 T\u1ED5ng gi\u1EDD l\u00E0m: **").concat(totalHoursStr_1, " gi\u1EDD**\n\u2022 S\u1ED1 ng\u00E0y \u0111i \u0111\u00FAng gi\u1EDD: ").concat(presentDays_1, "\n\u2022 S\u1ED1 ng\u00E0y \u0111i mu\u1ED9n: ").concat(lateDays_1)
                                }]
                        }];
                case 14: throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, "C\u00F4ng c\u1EE5 task ".concat(name, " ch\u01B0a \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3"));
            }
        });
    });
}
