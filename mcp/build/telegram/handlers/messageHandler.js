"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.handleTelegramMessage = handleTelegramMessage;
var fetchAxios_1 = require("../../fetchAxios");
var api_client_1 = require("@storymee/api-client");
var telegram_agent_1 = require("../../telegram_agent");
var index_1 = require("../../index");
var dotenv = require("dotenv");
dotenv.config();
var TELEGRAM_API = "https://api.telegram.org/bot".concat(process.env.TELEGRAM_BOT_TOKEN);
var CORE_API_URL = process.env.CORE_API_URL || "http://localhost:4500";
var WEB_PORTAL_URL = process.env.WEB_PORTAL_URL || "https://api.storymee.com";
var OMNIROUTER_API_URL = process.env.OMNIROUTER_API_URL || "https://api.storymee.com/api/ai/chat";
var apiClient = new api_client_1.CoreApiClient({ baseURL: CORE_API_URL });
function handleTelegramMessage(message) {
    return __awaiter(this, void 0, void 0, function () {
        var chatId, username, text, isGroup, isAiCommand, lowerText, prefetchTasksPromise, member, allMembers, cleanUsername_1, err_1, registerCommand, ctx, err_2, err_3, session, formSessionCommand, ctx_1, isAdmin, res, json, allRecords, today_1, todayRecords, checkedIn, late, reportMsg, lines, _i, todayRecords_1, r, memberName, workType, ci, co, icon, err_4, query, res, json, err_5, dbTasks_1, mappedTasks_1, json, allMembers_1, err_6, now_1, activeTasks, doneCount, overdueCount, reviewCount, reportMsg, _a, activeTasks_1, task, isOverdue, emoji, dlText, cleanText, skillsStr, bankNameStr, bankAccountStr, phoneStr, leaveLimit, leaveUsed, remoteLimit, remoteUsed, profileMsg, token, portalUrl, result, text_1, formattedText, e_1, dbTasks, mappedTasks, tasksData, err_7, projects, history_1, res, json, aiResponse, rp, result, result, actionId, confirmMsg, lp, cp, bp, up, listStr, tp, statusText, assigneeText, deadlineText, estimateText, priorityText, ap, tp, assigneeText, estimateText, priorityText, errorText, err_8;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    chatId = message.chat.id;
                    username = message.from.username;
                    text = (message.text || "").replace(/@storymeebot/gi, "").trim();
                    isGroup = chatId < 0;
                    isAiCommand = false;
                    if (text.toLowerCase().startsWith("/ai ")) {
                        text = text.substring(4).trim();
                        isAiCommand = true;
                    }
                    else if (text.toLowerCase() === "/ai") {
                        text = "";
                        isAiCommand = true;
                    }
                    // Trong group chat, chỉ xử lý nếu bắt đầu bằng /ai hoặc các lệnh hệ thống (vd: /checkin, /register)
                    if (isGroup && !isAiCommand && !text.startsWith('/')) {
                        return [2 /*return*/]; // Bỏ qua tin nhắn thường trong group
                    }
                    console.log("[Telegram Msg from @".concat(username, " in ").concat(isGroup ? 'Group' : 'Private', " ").concat(chatId, "]: ").concat(text));
                    lowerText = (text || "").trim().toLowerCase();
                    if (!!username) return [3 /*break*/, 3];
                    if (!!isGroup) return [3 /*break*/, 2];
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "⚠️ Vui lòng cấu hình Username trên Telegram của bạn để hệ thống định danh quyền hạn.")];
                case 1:
                    _c.sent();
                    _c.label = 2;
                case 2: return [2 /*return*/];
                case 3:
                    prefetchTasksPromise = apiClient.get("/omnitask/").catch(function (err) {
                        console.error("Lỗi prefetch tasks:", err);
                        return null;
                    });
                    member = null;
                    allMembers = [];
                    _c.label = 4;
                case 4:
                    _c.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, (0, telegram_agent_1.getCachedMembers)()];
                case 5:
                    allMembers = _c.sent();
                    if (allMembers && allMembers.length > 0) {
                        cleanUsername_1 = (username || "").replace(/^@/, "").toLowerCase().trim();
                        member = allMembers.find(function (m) {
                            if (m.telegramChatId && m.telegramChatId === chatId) {
                                return true;
                            }
                            if (cleanUsername_1) {
                                var cleanDB = (m.telegramUsername || "").replace(/^@/, "").toLowerCase().trim();
                                return cleanDB === cleanUsername_1;
                            }
                            return false;
                        });
                    }
                    return [3 /*break*/, 7];
                case 6:
                    err_1 = _c.sent();
                    console.error("Lỗi định danh nhân sự qua Postgres API:", err_1);
                    return [3 /*break*/, 7];
                case 7:
                    registerCommand = require('../commands/registerCommand').registerCommand;
                    ctx = {
                        chatId: chatId,
                        username: username,
                        text: text,
                        lowerText: text.toLowerCase().trim(),
                        isGroup: isGroup,
                        member: member,
                        allMembers: allMembers,
                        apiClient: apiClient,
                        message: message
                    };
                    return [4 /*yield*/, registerCommand.execute(ctx)];
                case 8:
                    if (_c.sent()) {
                        return [2 /*return*/];
                    }
                    if (!!member) return [3 /*break*/, 11];
                    if (!!isGroup) return [3 /*break*/, 10];
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "\u274C L\u1ED6I B\u1EA2O M\u1EACT: T\u00E0i kho\u1EA3n Telegram **@".concat(username, "** ch\u01B0a \u0111\u01B0\u1EE3c li\u00EAn k\u1EBFt v\u1EDBi nh\u00E2n s\u1EF1 n\u00E0o trong h\u1EC7 th\u1ED1ng Storymee.\n\n\uD83D\uDCA1 *C\u00E1ch x\u1EED l\u00FD nhanh:* H\u00E3y click n\u00FAt **\uD83D\uDC64 \u0110\u0103ng k\u00FD nh\u00E2n vi\u00EAn m\u1EDBi** b\u00EAn d\u01B0\u1EDBi ho\u1EB7c g\u00F5 l\u1EC7nh \u0111\u0103ng k\u00FD:\n\n`/register [email_c\u00F4ng_ty] [H\u1ECD_v\u00E0_T\u00EAn]`\n\n_(V\u00ED d\u1EE5: `/register an.nguyen@storymee.com Nguy\u1EC5n V\u0103n An`)_"), telegram_agent_1.KEYBOARD_UNAUTHORIZED)];
                case 9:
                    _c.sent();
                    _c.label = 10;
                case 10: return [2 /*return*/];
                case 11:
                    if (!(isGroup && (lowerText === "/menu" || lowerText.startsWith("/menu@")))) return [3 /*break*/, 13];
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "🤖 *STORYMEE TEAM BOT*\nChọn chức năng quản lý nhóm:", {
                            inline_keyboard: [
                                [
                                    { text: "📊 Báo cáo Tiến độ Team", callback_data: "group_cmd:check_team" },
                                    { text: "🔍 Hỗ trợ AI", callback_data: "group_cmd:ai_help" }
                                ],
                                [
                                    { text: "🌐 Mở Web Quản trị", url: "https://storymee-team.vercel.app/" }
                                ]
                            ]
                        })];
                case 12:
                    _c.sent();
                    return [2 /*return*/];
                case 13:
                    if (!(!isGroup && (!member.telegramChatId || Number(member.telegramChatId) !== chatId))) return [3 /*break*/, 20];
                    _c.label = 14;
                case 14:
                    _c.trys.push([14, 19, , 20]);
                    console.log("[Postgres API] \u0110ang c\u1EADp nh\u1EADt chat_id ".concat(chatId, " cho @").concat(username, "..."));
                    _c.label = 15;
                case 15:
                    _c.trys.push([15, 17, , 18]);
                    return [4 /*yield*/, apiClient.post("/hr/team-members", {
                            fullName: member.fullName,
                            email: member.email,
                            telegramUsername: member.telegramUsername,
                            telegramChatId: chatId,
                            role: member.role,
                            skills: member.skills,
                            bankName: member.bankName,
                            bankAccount: member.bankAccount,
                            phone: member.phone
                        })];
                case 16:
                    _c.sent();
                    console.log("[Postgres API] \u0110\u00E3 \u0111\u1ED3ng b\u1ED9 th\u00E0nh c\u00F4ng chat_id ".concat(chatId, " cho @").concat(username, " (").concat(member.fullName, ")"));
                    member.telegramChatId = chatId;
                    return [3 /*break*/, 18];
                case 17:
                    err_2 = _c.sent();
                    throw err_2;
                case 18: return [3 /*break*/, 20];
                case 19:
                    err_3 = _c.sent();
                    console.error("Lỗi đồng bộ chat_id lên Postgres API:", err_3);
                    return [3 /*break*/, 20];
                case 20:
                    session = telegram_agent_1.userFormSession[chatId];
                    if (!session) return [3 /*break*/, 22];
                    formSessionCommand = require('../commands/formSessionCommand').formSessionCommand;
                    ctx_1 = {
                        chatId: chatId,
                        username: username,
                        text: text,
                        lowerText: text.toLowerCase().trim(),
                        isGroup: isGroup,
                        member: member,
                        allMembers: allMembers,
                        apiClient: apiClient,
                        message: message
                    };
                    return [4 /*yield*/, formSessionCommand.execute(ctx_1)];
                case 21:
                    if (_c.sent()) {
                        return [2 /*return*/];
                    }
                    _c.label = 22;
                case 22:
                    if (!(text.trim() === "/start")) return [3 /*break*/, 24];
                    telegram_agent_1.chatHistories[chatId] = []; // Reset context chat
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "\uD83D\uDC4B Ch\u00E0o m\u1EEBng *".concat(member.fullName, "* \u0111\u1EBFn v\u1EDBi Storymee AI Task Manager!\n\n\uD83E\uDD16 T\u00F4i l\u00E0 tr\u1EE3 l\u00FD bot t\u1EF1 \u0111\u1ED9ng h\u00F3a. T\u00F4i \u0111\u00E3 ghi nh\u1EADn Chat ID c\u1EE7a b\u1EA1n \u0111\u1EC3 g\u1EEDi th\u00F4ng b\u00E1o c\u00F4ng vi\u1EC7c & deadline \u0111\u1ECBnh k\u1EF3.\n\n\uD83D\uDCA1 S\u1EED d\u1EE5ng **khay n\u00FAt b\u1EA5m b\u00EAn d\u01B0\u1EDBi** \u0111\u1EC3 th\u1EF1c hi\u1EC7n nhanh c\u00E1c t\u00E1c v\u1EE5, ho\u1EB7c chat tr\u1EF1c ti\u1EBFp b\u1EB1ng ti\u1EBFng Vi\u1EC7t v\u1EDBi t\u00F4i."), telegram_agent_1.KEYBOARD_MAIN)];
                case 23:
                    _c.sent();
                    return [2 /*return*/];
                case 24:
                    if (!(text.trim() === "/check")) return [3 /*break*/, 30];
                    isAdmin = ['kimngan151091@gmail.com', 'lehuyducanh.vn@gmail.com', 'zuzzivn@gmail.com'].includes(member.email.toLowerCase());
                    if (!!isAdmin) return [3 /*break*/, 26];
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "⚠️ Quyền hạn không đủ! Lệnh `/check` chỉ dành cho Ban Giám Đốc.")];
                case 25:
                    _c.sent();
                    return [2 /*return*/];
                case 26: return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "🔍 Đang tiến hành quét và gửi thông báo deadline tới toàn bộ nhân viên...")];
                case 27:
                    _c.sent();
                    return [4 /*yield*/, (0, telegram_agent_1.checkRealtimeOverdueDeadlines)()];
                case 28:
                    _c.sent();
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "✅ Đã quét xong!")];
                case 29:
                    _c.sent();
                    return [2 /*return*/];
                case 30:
                    if (!(lowerText === "/team_status" || lowerText === "trạng thái checkin")) return [3 /*break*/, 41];
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "🔍 Đang truy vấn trạng thái check-in hôm nay...")];
                case 31:
                    _c.sent();
                    _c.label = 32;
                case 32:
                    _c.trys.push([32, 38, , 40]);
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)(CORE_API_URL + "/hr/attendance")];
                case 33:
                    res = _c.sent();
                    return [4 /*yield*/, res.json()];
                case 34:
                    json = _c.sent();
                    allRecords = Array.isArray(json) ? json : ((json === null || json === void 0 ? void 0 : json.data) || []);
                    today_1 = new Date().toISOString().split('T')[0];
                    todayRecords = allRecords.filter(function (r) { return (r.date || "").startsWith(today_1); });
                    if (!(todayRecords.length === 0)) return [3 /*break*/, 36];
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "📊 *Báo cáo Check-in hôm nay*\nChưa có ai check-in hôm nay.")];
                case 35:
                    _c.sent();
                    return [2 /*return*/];
                case 36:
                    checkedIn = 0;
                    late = 0;
                    reportMsg = "\uD83D\uDCCA *B\u00E1o c\u00E1o Check-in h\u00F4m nay (".concat(today_1, ")*\n");
                    lines = [];
                    for (_i = 0, todayRecords_1 = todayRecords; _i < todayRecords_1.length; _i++) {
                        r = todayRecords_1[_i];
                        memberName = ((_b = r.member) === null || _b === void 0 ? void 0 : _b.fullName) || "Unknown";
                        workType = r.workType === "remote" ? "Remote" : "Office";
                        ci = r.checkIn ? r.checkIn.substring(11, 16) : "?";
                        co = r.checkOut ? r.checkOut.substring(11, 16) : "Chưa out";
                        icon = "✅";
                        if (r.status === "late") {
                            icon = "⚠️";
                            late++;
                        }
                        else if (r.status === "leave")
                            icon = "🏖️";
                        if (r.checkIn)
                            checkedIn++;
                        lines.push("\u2022 ".concat(icon, " *").concat(memberName, "* (").concat(workType, "): ").concat(ci, " - ").concat(co));
                    }
                    reportMsg += "\uD83D\uDC65 \u0110\u00E3 check-in: *".concat(checkedIn, "* | \u0110i mu\u1ED9n: *").concat(late, "*\n\n") + lines.join("\n");
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, reportMsg)];
                case 37:
                    _c.sent();
                    return [3 /*break*/, 40];
                case 38:
                    err_4 = _c.sent();
                    console.error("Lỗi lấy team status:", err_4);
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "❌ Lỗi lấy dữ liệu chấm công.")];
                case 39:
                    _c.sent();
                    return [3 /*break*/, 40];
                case 40: return [2 /*return*/];
                case 41:
                    if (!lowerText.startsWith("/subtask")) return [3 /*break*/, 58];
                    query = text.substring(8).trim();
                    if (!!query) return [3 /*break*/, 43];
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "⚠️ Vui lòng cung cấp mã task hoặc tên task. Ví dụ: `/subtask T-104`\n\n💡 Bạn cũng có thể dùng nút trên Web Portal.")];
                case 42:
                    _c.sent();
                    return [2 /*return*/];
                case 43: return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "\uD83E\uDD16 \u0110ang ph\u00E2n r\u00E3 task ".concat(query, " b\u1EB1ng AI..."))];
                case 44:
                    _c.sent();
                    _c.label = 45;
                case 45:
                    _c.trys.push([45, 55, , 57]);
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)(WEB_PORTAL_URL + "/api/ai/breakdown", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ taskId: query })
                        })];
                case 46:
                    res = _c.sent();
                    if (!res.ok) return [3 /*break*/, 52];
                    return [4 /*yield*/, res.json()];
                case 47:
                    json = _c.sent();
                    if (!(json.success || json.status === "success")) return [3 /*break*/, 49];
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "✅ Đã phân rã và tạo subtasks thành công trên hệ thống!")];
                case 48:
                    _c.sent();
                    return [3 /*break*/, 51];
                case 49: return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "🤖 Lỗi kết nối AI hoặc task không tồn tại. Vui lòng thử lại sau.")];
                case 50:
                    _c.sent();
                    _c.label = 51;
                case 51: return [3 /*break*/, 54];
                case 52: return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "🤖 Lỗi kết nối AI. Vui lòng thử lại sau.")];
                case 53:
                    _c.sent();
                    _c.label = 54;
                case 54: return [3 /*break*/, 57];
                case 55:
                    err_5 = _c.sent();
                    console.error("Lỗi phân rã task:", err_5);
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "🤖 Lỗi kết nối AI. Vui lòng thử lại sau.")];
                case 56:
                    _c.sent();
                    return [3 /*break*/, 57];
                case 57: return [2 /*return*/];
                case 58:
                    if (!(lowerText === "/check_all" || lowerText === "/check_team" || lowerText.startsWith("/check_team@") || lowerText === "📊 trạng thái thành viên")) return [3 /*break*/, 74];
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "🔍 Đang truy vấn cơ sở dữ liệu và tổng hợp báo cáo trạng thái toàn bộ thành viên...")];
                case 59:
                    _c.sent();
                    dbTasks_1 = [];
                    mappedTasks_1 = [];
                    _c.label = 60;
                case 60:
                    _c.trys.push([60, 63, , 65]);
                    return [4 /*yield*/, apiClient.get("/omnitask/")];
                case 61:
                    json = _c.sent();
                    dbTasks_1 = Array.isArray(json) ? json : ((json === null || json === void 0 ? void 0 : json.data) || []);
                    return [4 /*yield*/, (0, telegram_agent_1.getCachedMembers)()];
                case 62:
                    allMembers_1 = _c.sent();
                    dbTasks_1.forEach(function (t) {
                        if (Array.isArray(t.subTasks)) {
                            t.subTasks.forEach(function (sub) {
                                var _a;
                                var memberName = ((_a = (allMembers_1 || []).find(function (m) { return m.id === sub.assigneeId; })) === null || _a === void 0 ? void 0 : _a.fullName) || 'Không rõ';
                                // Map status text (e.g. pending, in_progress, in_review, done)
                                var st = 'Pending';
                                if (sub.status === 'in_progress')
                                    st = 'In Progress';
                                else if (sub.status === 'in_review')
                                    st = 'In Review';
                                else if (sub.status === 'done')
                                    st = 'Done';
                                else if (sub.status === 'pending')
                                    st = 'Pending';
                                else
                                    st = sub.status;
                                mappedTasks_1.push({
                                    title: sub.title,
                                    status: st,
                                    deadline: sub.deadline ? sub.deadline.split('T')[0] : 'Chưa có',
                                    rawDeadline: sub.deadline ? new Date(sub.deadline) : null,
                                    assignee: memberName,
                                    planeTaskId: sub.planeTaskId || 'Task'
                                });
                            });
                        }
                    });
                    return [3 /*break*/, 65];
                case 63:
                    err_6 = _c.sent();
                    console.error("Lỗi fetch tasks cho report:", err_6);
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "❌ Lỗi kết nối cổng dữ liệu để tải danh sách công việc.")];
                case 64:
                    _c.sent();
                    return [2 /*return*/];
                case 65:
                    if (!(mappedTasks_1.length === 0)) return [3 /*break*/, 67];
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "📭 Hiện không có công việc nào trên hệ thống.")];
                case 66:
                    _c.sent();
                    return [2 /*return*/];
                case 67:
                    now_1 = new Date();
                    now_1.setHours(0, 0, 0, 0);
                    activeTasks = mappedTasks_1.filter(function (t) { return t.status !== 'Done'; });
                    activeTasks.sort(function (a, b) {
                        var aReview = a.status === 'In Review';
                        var bReview = b.status === 'In Review';
                        if (aReview !== bReview)
                            return aReview ? -1 : 1; // In Review lên đầu
                        var aOverdue = a.rawDeadline && a.rawDeadline < now_1;
                        var bOverdue = b.rawDeadline && b.rawDeadline < now_1;
                        if (aOverdue && !bOverdue)
                            return -1;
                        if (!aOverdue && bOverdue)
                            return 1;
                        if (!a.rawDeadline && b.rawDeadline)
                            return 1;
                        if (a.rawDeadline && !b.rawDeadline)
                            return -1;
                        if (!a.rawDeadline && !b.rawDeadline)
                            return 0;
                        return a.rawDeadline.getTime() - b.rawDeadline.getTime();
                    });
                    doneCount = mappedTasks_1.filter(function (t) { return t.status === 'Done'; }).length;
                    overdueCount = activeTasks.filter(function (t) { return t.rawDeadline && t.rawDeadline < now_1; }).length;
                    reviewCount = activeTasks.filter(function (t) { return t.status === 'In Review'; }).length;
                    reportMsg = "\uD83D\uDCCA *B\u00C1O C\u00C1O TI\u1EBEN \u0110\u1ED8 \u0110\u1ED8I NG\u0168*\n"
                        + "\uD83D\uDD35 Review: *".concat(reviewCount, "* | \uD83D\uDD34 Qu\u00E1 h\u1EA1n: *").concat(overdueCount, "* | \uD83D\uDFE2 Done: *").concat(doneCount, "* | \uD83D\uDCCB T\u1ED5ng \u0111ang m\u1EDF: *").concat(activeTasks.length, "*\n")
                        + "".concat('─'.repeat(30), "\n");
                    _a = 0, activeTasks_1 = activeTasks;
                    _c.label = 68;
                case 68:
                    if (!(_a < activeTasks_1.length)) return [3 /*break*/, 71];
                    task = activeTasks_1[_a];
                    isOverdue = task.rawDeadline && task.rawDeadline < now_1;
                    emoji = '⚪';
                    if (isOverdue)
                        emoji = '🔴';
                    else if (task.status === 'In Review')
                        emoji = '🔵';
                    else if (task.status === 'In Progress')
                        emoji = '🟡';
                    else if (task.status === 'Todo')
                        emoji = '⚪';
                    dlText = task.deadline
                        ? (isOverdue ? "\uD83D\uDCC5 ".concat(task.deadline, " \u26A0\uFE0F QU\u00C1 H\u1EA0N") : "\uD83D\uDCC5 ".concat(task.deadline))
                        : '📅 Chưa đặt';
                    reportMsg += "\n".concat(emoji, " *").concat(task.planeTaskId, "*: ").concat(task.title, "\n");
                    reportMsg += "   \uD83D\uDC64 ".concat(task.assignee, "  |  `").concat(task.status, "`  ").concat(dlText, "\n");
                    if (!(reportMsg.length > 3500)) return [3 /*break*/, 70];
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, reportMsg)];
                case 69:
                    _c.sent();
                    reportMsg = '';
                    _c.label = 70;
                case 70:
                    _a++;
                    return [3 /*break*/, 68];
                case 71:
                    if (!reportMsg.trim()) return [3 /*break*/, 73];
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, reportMsg)];
                case 72:
                    _c.sent();
                    _c.label = 73;
                case 73: return [2 /*return*/];
                case 74:
                    cleanText = text.trim().toLowerCase();
                    if (!(cleanText === "👤 hồ sơ của tôi" || cleanText === "/ho_so")) return [3 /*break*/, 78];
                    if (!!member) return [3 /*break*/, 76];
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "❌ Tài khoản Telegram của bạn chưa được liên kết với nhân sự nào. Vui lòng bấm nút đăng ký hoặc liên kết trước.")];
                case 75:
                    _c.sent();
                    return [2 /*return*/];
                case 76:
                    skillsStr = Array.isArray(member.skills) && member.skills.length > 0 ? member.skills.join(", ") : "Chưa cập nhật";
                    bankNameStr = member.bankName || "Chưa cập nhật";
                    bankAccountStr = member.bankAccount || "Chưa cập nhật";
                    phoneStr = member.phone || "Chưa cập nhật";
                    leaveLimit = member.annualLeaveLimit || 12;
                    leaveUsed = member.annualLeaveUsed || 0;
                    remoteLimit = member.remoteLimit || 4;
                    remoteUsed = member.remoteUsed || 0;
                    profileMsg = "\uD83D\uDC64 **H\u1ED2 S\u01A0 C\u00C1 NH\u00C2N C\u1EE6A B\u1EA0N**\n    \n\u2022 H\u1ECD v\u00E0 t\u00EAn: **".concat(member.fullName, "**\n\u2022 Email: **").concat(member.email, "**\n\u2022 Ch\u1EE9c danh: **").concat(member.role || 'Nhân viên', "**\n\u2022 S\u0110T: **").concat(phoneStr, "**\n\u2022 T\u00E0i kho\u1EA3n NH: **").concat(bankNameStr, " - ").concat(bankAccountStr, "**\n\u2022 K\u1EF9 n\u0103ng: *").concat(skillsStr, "*\n\n\uD83D\uDCCA **H\u1EA1n m\u1EE9c ngh\u1EC9 ph\u00E9p & Remote:**\n\u2022 Ngh\u1EC9 ph\u00E9p n\u0103m: **").concat(leaveUsed, " / ").concat(leaveLimit, " ng\u00E0y** \u0111\u00E3 d\u00F9ng\n\u2022 L\u00E0m vi\u1EC7c t\u1EEB xa: **").concat(remoteUsed, " / ").concat(remoteLimit, " ng\u00E0y** \u0111\u00E3 d\u00F9ng\n\n\uD83D\uDCA1 *L\u01B0u \u00FD:* \u0110\u1EC3 c\u1EADp nh\u1EADt th\u00F4ng tin c\u00E1 nh\u00E2n (S\u0110T, s\u1ED1 t\u00E0i kho\u1EA3n, k\u1EF9 n\u0103ng...), vui l\u00F2ng truy c\u1EADp giao di\u1EC7n Web Portal ho\u1EB7c g\u1EEDi y\u00EAu c\u1EA7u cho AI Assistant.");
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, profileMsg)];
                case 77:
                    _c.sent();
                    return [2 /*return*/];
                case 78:
                    if (!(cleanText === "/portal" || cleanText === "🌐 mở web portal")) return [3 /*break*/, 82];
                    if (!!member) return [3 /*break*/, 80];
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "❌ Tài khoản Telegram của bạn chưa được liên kết với nhân sự nào. Vui lòng bấm nút đăng ký hoặc liên kết trước.")];
                case 79:
                    _c.sent();
                    return [2 /*return*/];
                case 80:
                    token = member.lettaConversationId || "conv-".concat(member.id);
                    portalUrl = "".concat(WEB_PORTAL_URL, "/login?token=").concat(token);
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "🌐 Bấm nút dưới đây để mở giao diện Web Portal:", {
                            inline_keyboard: [
                                [
                                    { text: "🚀 Mở Storymee Portal", url: portalUrl }
                                ]
                            ]
                        })];
                case 81:
                    _c.sent();
                    return [2 /*return*/];
                case 82:
                    if (!(cleanText === "📁 quản lý dự án & task")) return [3 /*break*/, 86];
                    if (!!member) return [3 /*break*/, 84];
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "❌ Tài khoản Telegram của bạn chưa được liên kết với nhân sự nào.")];
                case 83:
                    _c.sent();
                    return [2 /*return*/];
                case 84: return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "🚀 *QUẢN LÝ DỰ ÁN & TASK*\n\nVui lòng chọn chức năng bạn muốn thực hiện:", {
                        inline_keyboard: [
                            [
                                { text: "📂 Tạo Dự án mới", callback_data: "start_create_project" }
                            ],
                            [
                                { text: "📋 Tạo Task mới", callback_data: "start_create_task" }
                            ]
                        ]
                    })];
                case 85:
                    _c.sent();
                    return [2 /*return*/];
                case 86:
                    if (!(cleanText === "🌅 điểm danh (check-in/out)" || cleanText === "/checkin" || cleanText === "/checkout")) return [3 /*break*/, 90];
                    if (!!member) return [3 /*break*/, 88];
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "❌ Tài khoản Telegram của bạn chưa được liên kết với nhân sự nào. Vui lòng liên kết trước.")];
                case 87:
                    _c.sent();
                    return [2 /*return*/];
                case 88: return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "🌅 *BÁO CÁO ĐIỂM DANH HÀNG NGÀY*\n\nVui lòng chọn ca điểm danh của bạn dưới đây:", {
                        inline_keyboard: [
                            [
                                { text: "🌅 Vào ca (Check-in)", callback_data: "attendance_direct:present" },
                                { text: "🚪 Tan ca (Check-out)", callback_data: "attendance_direct:checkout" }
                            ]
                        ]
                    })];
                case 89:
                    _c.sent();
                    return [2 /*return*/];
                case 90:
                    if (!(cleanText === "📝 đăng ký nghỉ phép / remote" || cleanText === "/dang_ky" || cleanText === "/nghi_phep" || cleanText === "/remote")) return [3 /*break*/, 92];
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "📝 *ĐĂNG KÝ NGHỈ PHÉP & REMOTE*\n\nVui lòng chọn loại đăng ký bạn muốn thực hiện dưới đây:", {
                            inline_keyboard: [
                                [
                                    { text: "📅 Xin Nghỉ Phép", callback_data: "start_form:leave" },
                                    { text: "💻 Xin làm Remote", callback_data: "start_form:remote" }
                                ]
                            ]
                        })];
                case 91:
                    _c.sent();
                    return [2 /*return*/];
                case 92:
                    if (!(cleanText === "📝 công việc của tôi" || cleanText === "/cong_viec")) return [3 /*break*/, 100];
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "🔍 Đang truy vấn danh sách công việc của bạn...")];
                case 93:
                    _c.sent();
                    _c.label = 94;
                case 94:
                    _c.trys.push([94, 97, , 99]);
                    return [4 /*yield*/, (0, index_1.executeMcpTool)("get_my_tasks", { employee_name: member.fullName }, member)];
                case 95:
                    result = _c.sent();
                    text_1 = result.content[0].text;
                    formattedText = text_1.replace(/Danh sách task của [^:]+:/i, "\uD83D\uDCCB *C\u00D4NG VI\u1EC6C C\u1EE6A B\u1EA0N:*");
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, formattedText)];
                case 96:
                    _c.sent();
                    return [3 /*break*/, 99];
                case 97:
                    e_1 = _c.sent();
                    console.error("Lỗi fetch task qua MCP:", e_1);
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "❌ Gặp lỗi khi truy vấn danh sách công việc.")];
                case 98:
                    _c.sent();
                    return [3 /*break*/, 99];
                case 99: return [2 /*return*/];
                case 100:
                    if (!(cleanText === "📊 hỏi quy chế đãi ngộ" || cleanText === "/quy_che")) return [3 /*break*/, 102];
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "📊 *HỎI ĐÁP QUY CHẾ ĐÃI NGỘ*\n\nBạn muốn tìm hiểu về quy chế nào dưới đây? Click để hỏi trợ lý AI ngay lập tức:", {
                            inline_keyboard: [
                                [
                                    { text: "💵 Lương tháng 13 & Thưởng", callback_data: "ask_faq:lương tháng 13" },
                                    { text: "⏱️ Quy định thử việc", callback_data: "ask_faq:quy chế thử việc" }
                                ],
                                [
                                    { text: "📅 Số ngày phép & nghỉ lễ", callback_data: "ask_faq:quy định nghỉ phép năm" },
                                    { text: "🏥 Bảo hiểm & phúc lợi", callback_data: "ask_faq:chế độ bảo hiểm" }
                                ]
                            ]
                        })];
                case 101:
                    _c.sent();
                    return [2 /*return*/];
                case 102:
                    if (!!text) return [3 /*break*/, 104];
                    if (isGroup)
                        return [2 /*return*/]; // Bỏ qua nếu tin nhắn rỗng (ví dụ: chỉ gõ /ai)
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "Vui lòng nhập nội dung để AI hỗ trợ.")];
                case 103:
                    _c.sent();
                    return [2 /*return*/];
                case 104: return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "\u23F3 Tr\u1EE3 l\u00FD AI \u0111ang x\u1EED l\u00FD y\u00EAu c\u1EA7u c\u1EE7a b\u1EA1n, **".concat(member.fullName, "**..."))];
                case 105:
                    _c.sent();
                    dbTasks = [];
                    mappedTasks = [];
                    _c.label = 106;
                case 106:
                    _c.trys.push([106, 108, , 109]);
                    return [4 /*yield*/, prefetchTasksPromise];
                case 107:
                    tasksData = _c.sent();
                    if (tasksData) {
                        dbTasks = tasksData.data || [];
                        dbTasks.forEach(function (t) {
                            if (Array.isArray(t.subTasks)) {
                                t.subTasks.forEach(function (sub) {
                                    mappedTasks.push({
                                        id: sub.planeTaskId || sub.id,
                                        title: sub.title,
                                        description: sub.description || '',
                                        assignee: sub.Assignee ? sub.Assignee.fullName : 'Chưa phân công',
                                        priority: sub.priority.charAt(0).toUpperCase() + sub.priority.slice(1),
                                        status: sub.status === 'pending' ? 'Todo' : sub.status === 'in_progress' ? 'In Progress' : sub.status === 'done' ? 'Done' : sub.status,
                                        deadline: sub.deadline ? sub.deadline.split('T')[0] : '',
                                        estimate: sub.estimatedHours || 0,
                                        projectId: t.id,
                                        uuid: sub.id // Lưu ID UUID thật của subtask để thao tác update sau này
                                    });
                                });
                            }
                        });
                    }
                    return [3 /*break*/, 109];
                case 108:
                    err_7 = _c.sent();
                    console.error("Lỗi fetch tasks/projects cho AI context:", err_7);
                    return [3 /*break*/, 109];
                case 109:
                    projects = dbTasks.map(function (t) { return ({
                        id: t.id,
                        title: t.title
                    }); });
                    _c.label = 110;
                case 110:
                    _c.trys.push([110, 128, , 130]);
                    history_1 = telegram_agent_1.chatHistories[chatId] || [];
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)(OMNIROUTER_API_URL, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                message: text,
                                history: history_1,
                                currentUser: __assign(__assign({}, member), { name: member.fullName }),
                                tasks: mappedTasks,
                                projects: projects,
                                companyRules: "Danh sách nhân sự công ty thực tế từ Database:\n" + allMembers.map(function (m) { return "- ".concat(m.fullName, " (Role: ").concat(m.role || 'Nhân viên', ")"); }).join("\n"),
                                config: { useCloud: true, useFallback: true, useMasking: true, useCompression: true }
                            })
                        })];
                case 111:
                    res = _c.sent();
                    if (!res.ok) return [3 /*break*/, 125];
                    return [4 /*yield*/, res.json()];
                case 112:
                    json = (_c.sent());
                    if (!(json.status === "success" && json.data)) return [3 /*break*/, 122];
                    aiResponse = json.data;
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, aiResponse.reply)];
                case 113:
                    _c.sent();
                    // Lưu hội thoại vào history
                    history_1.push({ role: "user", parts: [{ text: text }] });
                    history_1.push({ role: "model", parts: [{ text: aiResponse.reply }] });
                    telegram_agent_1.chatHistories[chatId] = history_1.slice(-15); // Giới hạn 15 tin nhắn gần nhất
                    if (!(aiResponse.action === 'get_attendance_report')) return [3 /*break*/, 116];
                    rp = aiResponse.reportPayload || {};
                    return [4 /*yield*/, (0, index_1.executeMcpTool)("get_attendance_report", {
                            employee_name: rp.employee_name,
                            month: rp.month,
                            year: rp.year
                        }, member)];
                case 114:
                    result = _c.sent();
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, result.content[0].text)];
                case 115:
                    _c.sent();
                    return [3 /*break*/, 121];
                case 116:
                    if (!(aiResponse.action === 'get_team_leaves')) return [3 /*break*/, 119];
                    return [4 /*yield*/, (0, index_1.executeMcpTool)("get_team_leaves", aiResponse.teamLeavesPayload || {}, member)];
                case 117:
                    result = _c.sent();
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, result.content[0].text)];
                case 118:
                    _c.sent();
                    return [3 /*break*/, 121];
                case 119:
                    if (!['update_task', 'create_task', 'leave_request', 'check_in_out', 'breakdown_task', 'update_subtasks', 'request_task_approval'].includes(aiResponse.action)) return [3 /*break*/, 121];
                    actionId = Math.random().toString(36).substring(2, 10);
                    telegram_agent_1.actionCache[actionId] = {
                        action: aiResponse.action,
                        payload: aiResponse.action === 'leave_request'
                            ? aiResponse.leavePayload
                            : aiResponse.action === 'check_in_out'
                                ? aiResponse.checkInOutPayload
                                : aiResponse.action === 'breakdown_task'
                                    ? aiResponse.breakdownPayload
                                    : aiResponse.action === 'update_subtasks'
                                        ? aiResponse.updateSubtasksPayload
                                        : aiResponse.action === 'request_task_approval'
                                            ? aiResponse.approvalPayload
                                            : aiResponse.taskPayload,
                        member: member
                    };
                    confirmMsg = '';
                    if (aiResponse.action === 'leave_request') {
                        lp = aiResponse.leavePayload;
                        confirmMsg = "\uD83D\uDCA1 *\u0110\u1EC0 XU\u1EA4T XIN NGH\u1EC8 PH\u00C9P:*\n\u2022 Lo\u1EA1i ph\u00E9p: *".concat(lp.leaveType === 'sick' ? 'Nghỉ ốm' : lp.leaveType === 'annual' ? 'Nghỉ phép năm' : 'Việc riêng', "*\n\u2022 Th\u1EDDi gian: *").concat(lp.startDate, " \u0111\u1EBFn ").concat(lp.endDate, "*\n\u2022 L\u00FD do: *").concat(lp.reason || 'Không có', "*");
                    }
                    else if (aiResponse.action === 'check_in_out') {
                        cp = aiResponse.checkInOutPayload;
                        confirmMsg = "\uD83D\uDCA1 *\u0110\u1EC0 XU\u1EA4T \u0110I\u1EC2M DANH:*\n\u2022 Tr\u1EA1ng th\u00E1i: *".concat(cp.status === 'present' ? 'Đi làm' : cp.status === 'late' ? 'Đi muộn' : 'Vắng', "*\n\u2022 Ghi ch\u00FA: *").concat(cp.notes || 'Không có', "*").concat(cp.employee_name ? "\n\u2022 Nh\u00E2n s\u1EF1: *".concat(cp.employee_name, "*") : '');
                    }
                    else if (aiResponse.action === 'breakdown_task') {
                        bp = aiResponse.breakdownPayload;
                        confirmMsg = "\uD83D\uDCA1 *\u0110\u1EC0 XU\u1EA4T PH\u00C2N R\u00C3 C\u00D4NG VI\u1EC6C ".concat(bp.task_id, ":*\n\u2022 H\u1EC7 th\u1ED1ng AI s\u1EBD t\u1EF1 \u0111\u1ED9ng sinh danh s\u00E1ch vi\u1EC7c con v\u00E0 l\u01B0u v\u00E0o DB.");
                    }
                    else if (aiResponse.action === 'update_subtasks') {
                        up = aiResponse.updateSubtasksPayload;
                        listStr = up.titles ? up.titles.map(function (t) { return "  \u2022 ".concat(t); }).join('\n') : '';
                        confirmMsg = "\uD83D\uDCA1 *\u0110\u1EC0 XU\u1EA4T C\u1EACP NH\u1EACT C\u00C1C C\u00D4NG VI\u1EC6C CON CHO ".concat(up.task_id, ":*\n").concat(listStr, "\n\n\uD83D\uDC49 B\u1EA5m X\u00E1c nh\u1EADn s\u1EBD x\u00F3a to\u00E0n b\u1ED9 vi\u1EC7c con c\u0169 c\u1EE7a task n\u00E0y v\u00E0 thay b\u1EB1ng danh s\u00E1ch tr\u00EAn.");
                    }
                    else if (aiResponse.action === 'update_task') {
                        tp = aiResponse.taskPayload;
                        statusText = tp.status ? "\n\u2022 Tr\u1EA1ng th\u00E1i m\u1EDBi: *".concat(tp.status, "*") : '';
                        assigneeText = tp.assignee ? "\n\u2022 Ng\u01B0\u1EDDi ph\u1EE5 tr\u00E1ch: *".concat(tp.assignee, "*") : '';
                        deadlineText = tp.deadline ? "\n\u2022 H\u1EA1n ch\u00F3t m\u1EDBi: *".concat(tp.deadline, "*") : '';
                        estimateText = tp.estimate ? "\n\u2022 \u01AF\u1EDBc t\u00EDnh m\u1EDBi: *".concat(tp.estimate, "h*") : '';
                        priorityText = tp.priority ? "\n\u2022 \u0110\u1ED9 \u01B0u ti\u00EAn: *".concat(tp.priority, "*") : '';
                        confirmMsg = "\uD83D\uDCA1 *\u0110\u1EC0 XU\u1EA4T C\u1EACP NH\u1EACT C\u00D4NG VI\u1EC6C ".concat(tp.id, ":*").concat(statusText).concat(assigneeText).concat(deadlineText).concat(estimateText).concat(priorityText);
                    }
                    else if (aiResponse.action === 'request_task_approval') {
                        ap = aiResponse.approvalPayload;
                        confirmMsg = "\uD83D\uDCA1 *\u0110\u1EC0 XU\u1EA4T XIN DUY\u1EC6T C\u00D4NG VI\u1EC6C ".concat(ap.task_id, ":*\n\u2022 Y\u00EAu c\u1EA7u: *").concat(ap.type, "*\n\u2022 H\u1EA1n ch\u00F3t xin d\u1EDDi (n\u1EBFu c\u00F3): *").concat(ap.new_deadline || 'Không', "*\n\u2022 Ghi ch\u00FA: *").concat(ap.reason || 'Không', "*");
                    }
                    else {
                        tp = aiResponse.taskPayload;
                        assigneeText = tp.assignee ? "\n\u2022 Ng\u01B0\u1EDDi ph\u1EE5 tr\u00E1ch: *".concat(tp.assignee, "*") : '';
                        estimateText = tp.estimate ? "\n\u2022 \u01AF\u1EDBc t\u00EDnh: *".concat(tp.estimate, "h*") : '';
                        priorityText = tp.priority ? "\n\u2022 \u0110\u1ED9 \u01B0u ti\u00EAn: *".concat(tp.priority, "*") : '';
                        confirmMsg = "\uD83D\uDCA1 *\u0110\u1EC0 XU\u1EA4T T\u1EA0O C\u00D4NG VI\u1EC6C M\u1EDAI:*\n\u2022 Ti\u00EAu \u0111\u1EC1: *".concat(tp.title, "*").concat(assigneeText).concat(estimateText).concat(priorityText);
                    }
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "".concat(confirmMsg, "\n\n\uD83D\uDC49 Vui l\u00F2ng x\u00E1c nh\u1EADn th\u1EF1c thi h\u00E0nh \u0111\u1ED9ng n\u00E0y d\u01B0\u1EDBi \u0111\u00E2y:"), {
                            inline_keyboard: [
                                [
                                    { text: "✅ Xác nhận", callback_data: "confirm_action:".concat(actionId) },
                                    { text: "❌ Hủy bỏ", callback_data: "cancel_action:".concat(actionId) }
                                ]
                            ]
                        })];
                case 120:
                    _c.sent();
                    _c.label = 121;
                case 121: return [3 /*break*/, 124];
                case 122: return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "⚠️ Trợ lý AI đã nhận yêu cầu nhưng gặp lỗi định cấu hình phản hồi.")];
                case 123:
                    _c.sent();
                    _c.label = 124;
                case 124: return [3 /*break*/, 127];
                case 125: return [4 /*yield*/, res.text().catch(function () { return "N/A"; })];
                case 126:
                    errorText = _c.sent();
                    throw new Error("L\u1ED7i g\u1ECDi OmniRouter API: status=".concat(res.status, ", body=").concat(errorText));
                case 127: return [3 /*break*/, 130];
                case 128:
                    err_8 = _c.sent();
                    console.error("Lỗi kết nối AI:", err_8);
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "\uD83E\uDD16 C\u1ED5ng AI Gateway hi\u1EC7n ch\u01B0a c\u1EA5u h\u00ECnh ho\u1EB7c \u0111ang b\u1EA3o tr\u00EC. \u0110\u00E3 ghi nh\u1EADn c\u00E2u l\u1EC7nh c\u1EE7a b\u1EA1n: *\"".concat(text, "\"*"))];
                case 129:
                    _c.sent();
                    return [3 /*break*/, 130];
                case 130: return [2 /*return*/];
            }
        });
    });
}
