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
exports.KEYBOARD_UNAUTHORIZED = exports.KEYBOARD_MAIN = exports.processingActions = exports.userFormSession = exports.actionCache = exports.chatHistories = void 0;
exports.getCachedMembers = getCachedMembers;
exports.calculateWorkingHours = calculateWorkingHours;
exports.createCalendarKeyboard = createCalendarKeyboard;
exports.formatTelegramText = formatTelegramText;
exports.sendMessage = sendMessage;
exports.parseMarkdownRules = parseMarkdownRules;
exports.filterRelevantRules = filterRelevantRules;
exports.sendDailySummaryAndNotify = sendDailySummaryAndNotify;
exports.checkRealtimeOverdueDeadlines = checkRealtimeOverdueDeadlines;
exports.handleTelegramMessage = handleTelegramMessage;
exports.handleCallbackQuery = handleCallbackQuery;
exports.startTelegramPolling = startTelegramPolling;
var fetchAxios_1 = require("./fetchAxios");
var dotenv = require("dotenv");
var express_1 = require("express");
var fs = require("fs");
var path = require("path");
var node_cron_1 = require("node-cron");
var api_client_1 = require("@storymee/api-client");
dotenv.config();
// --- CACHE HỆ THỐNG ---
var CACHE_TTL = 10 * 60 * 1000; // 10 minutes
var membersCache = null;
function getCachedMembers() {
    return __awaiter(this, void 0, void 0, function () {
        var now, json, dataArr, now_1, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    now = Date.now();
                    if (membersCache && (now - membersCache.timestamp < CACHE_TTL)) {
                        return [2 /*return*/, membersCache.data];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, apiClient.get("/hr/team-members")];
                case 2:
                    json = _a.sent();
                    dataArr = Array.isArray(json) ? json : ((json === null || json === void 0 ? void 0 : json.data) || []);
                    if (Array.isArray(dataArr)) {
                        now_1 = Date.now();
                        membersCache = { data: dataArr, timestamp: now_1 };
                        return [2 /*return*/, dataArr];
                    }
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _a.sent();
                    console.error("Lỗi fetch team-members:", err_1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/, membersCache ? membersCache.data : []];
            }
        });
    });
}
// ----------------------
function calculateWorkingHours(start, end) {
    if (start >= end)
        return 0;
    var totalHours = 0;
    var current = new Date(start.getTime());
    while (current < end) {
        var currentDay = current.getDay();
        var isWeekend = currentDay === 0 || currentDay === 6;
        if (!isWeekend) {
            var morningStart = new Date(current);
            morningStart.setHours(8, 30, 0, 0);
            var morningEnd = new Date(current);
            morningEnd.setHours(12, 0, 0, 0);
            var afternoonStart = new Date(current);
            afternoonStart.setHours(13, 30, 0, 0);
            var afternoonEnd = new Date(current);
            afternoonEnd.setHours(18, 0, 0, 0);
            var morningOverlapStart = current > morningStart ? current : morningStart;
            var morningOverlapEnd = end < morningEnd ? end : morningEnd;
            if (morningOverlapStart < morningOverlapEnd) {
                totalHours += (morningOverlapEnd.getTime() - morningOverlapStart.getTime()) / (1000 * 60 * 60);
            }
            var afternoonOverlapStart = current > afternoonStart ? current : afternoonStart;
            var afternoonOverlapEnd = end < afternoonEnd ? end : afternoonEnd;
            if (afternoonOverlapStart < afternoonOverlapEnd) {
                totalHours += (afternoonOverlapEnd.getTime() - afternoonOverlapStart.getTime()) / (1000 * 60 * 60);
            }
        }
        current.setDate(current.getDate() + 1);
        current.setHours(0, 0, 0, 0);
    }
    return Math.round(totalHours * 10) / 10;
}
/**
 * TELEGRAM AGENT - KẾT NỐI POSTGRES API VÀ OMNIROUTER THỰC TẾ
 *
 * Lắng nghe tin nhắn qua Long Polling, định danh nhân viên qua Telegram Username,
 * tự động lưu Chat ID, và chạy cronjob nhắc nhở/cảnh báo deadline quá hạn qua Postgres.
 */
var TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
var TELEGRAM_API = "https://api.telegram.org/bot".concat(TELEGRAM_BOT_TOKEN);
var WEB_PORTAL_URL = process.env.WEB_PORTAL_URL || "http://localhost:3010";
var OMNIROUTER_API_URL = process.env.OMNIROUTER_API_URL || "".concat(WEB_PORTAL_URL, "/api/ai/chat");
var CORE_API_URL = process.env.CORE_API_URL || "http://localhost:5100/internal/v1/team";
var apiClient = new api_client_1.CoreApiClient({ baseURL: CORE_API_URL });
exports.chatHistories = {};
exports.actionCache = {};
exports.userFormSession = {};
exports.processingActions = new Set();
function createCalendarKeyboard(year, month, actionType) {
    var inline_keyboard = [];
    // Hàng 1: Navigation chuyển tháng
    var prevMonth = month === 1 ? 12 : month - 1;
    var prevYear = month === 1 ? year - 1 : year;
    var nextMonth = month === 12 ? 1 : month + 1;
    var nextYear = month === 12 ? year + 1 : year;
    inline_keyboard.push([
        { text: "◀️", callback_data: "cal_nav:".concat(prevYear, ":").concat(prevMonth, ":").concat(actionType) },
        { text: "".concat(month, "/").concat(year), callback_data: "cal_ignore" },
        { text: "▶️", callback_data: "cal_nav:".concat(nextYear, ":").concat(nextMonth, ":").concat(actionType) }
    ]);
    // Hàng 2: Thứ
    inline_keyboard.push([
        { text: "Hai", callback_data: "cal_ignore" },
        { text: "Ba", callback_data: "cal_ignore" },
        { text: "Tư", callback_data: "cal_ignore" },
        { text: "Năm", callback_data: "cal_ignore" },
        { text: "Sáu", callback_data: "cal_ignore" },
        { text: "Bảy", callback_data: "cal_ignore" },
        { text: "CN", callback_data: "cal_ignore" }
    ]);
    // Tính ngày trong tháng
    var startDate = new Date(year, month - 1, 1);
    var endDate = new Date(year, month, 0);
    var totalDays = endDate.getDate();
    // Lấy thứ của ngày đầu tiên (0: CN, 1: T2, ..., 6: T7)
    // Chuyển đổi sang chuẩn T2=0, ..., CN=6
    var startDay = startDate.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1;
    var currentWeek = [];
    // Thêm khoảng trống đầu tháng
    for (var i = 0; i < startDay; i++) {
        currentWeek.push({ text: " ", callback_data: "cal_ignore" });
    }
    // Thêm các ngày (không cho phép chọn ngày quá khứ)
    var now = new Date();
    var vietnamOffset = 7 * 60 * 60 * 1000;
    var todayVn = new Date(now.getTime() + vietnamOffset);
    var todayStr = todayVn.toISOString().split('T')[0];
    for (var day = 1; day <= totalDays; day++) {
        var dayStr = day < 10 ? "0".concat(day) : "".concat(day);
        var monthStr = month < 10 ? "0".concat(month) : "".concat(month);
        var dateVal = "".concat(year, "-").concat(monthStr, "-").concat(dayStr);
        var isPast = dateVal < todayStr;
        var btnText = isPast ? "·" : "".concat(day);
        var btnCallback = isPast ? "cal_ignore" : "cal_day:".concat(dateVal, ":").concat(actionType);
        currentWeek.push({ text: btnText, callback_data: btnCallback });
        if (currentWeek.length === 7) {
            inline_keyboard.push(currentWeek);
            currentWeek = [];
        }
    }
    // Điền nốt khoảng trống cuối tháng
    if (currentWeek.length > 0) {
        while (currentWeek.length < 7) {
            currentWeek.push({ text: " ", callback_data: "cal_ignore" });
        }
        inline_keyboard.push(currentWeek);
    }
    return { inline_keyboard: inline_keyboard };
}
exports.KEYBOARD_MAIN = {
    keyboard: [
        [
            { text: "🌅 Điểm danh (Check-in/out)" },
            { text: "📊 Trạng thái thành viên" }
        ],
        [
            { text: "📝 Công việc của tôi" },
            { text: "📝 Đăng ký Nghỉ phép / Remote" }
        ],
        [
            { text: "👤 Hồ sơ của tôi" },
            { text: "🌐 Mở Web Portal" }
        ],
        [
            { text: "📁 Quản lý Dự án & Task" }
        ]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
};
exports.KEYBOARD_UNAUTHORIZED = {
    keyboard: [
        [
            { text: "👤 Đăng ký nhân viên mới" }
        ]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
};
function formatTelegramText(text) {
    if (!text)
        return '';
    return text
        .replace(/<\/?ul>/gi, '')
        .replace(/<\/li>/gi, '\n')
        .replace(/<li>/gi, '• ')
        .replace(/<b>(.*?)<\/b>/gi, '*$1*')
        .replace(/<strong>(.*?)<\/strong>/gi, '*$1*')
        .replace(/<i>(.*?)<\/i>/gi, '_$1_')
        .replace(/<em>(.*?)<\/em>/gi, '_$1_')
        .replace(/<br\s*\/?>/gi, '\n');
}
var KEYBOARD_REMOVE = {
    remove_keyboard: true
};
function sendMessage(chatId, text, replyMarkup) {
    return __awaiter(this, void 0, void 0, function () {
        var formattedText, isGroup, finalMarkup, res, errText, errText, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!TELEGRAM_BOT_TOKEN) {
                        console.log("[Mock Telegram Send to ".concat(chatId, "]: ").concat(text));
                        return [2 /*return*/];
                    }
                    formattedText = formatTelegramText(text);
                    isGroup = chatId < 0;
                    finalMarkup = replyMarkup;
                    if (!finalMarkup) {
                        finalMarkup = isGroup ? KEYBOARD_REMOVE : exports.KEYBOARD_MAIN;
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 8, , 9]);
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/sendMessage"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                chat_id: chatId,
                                text: formattedText,
                                parse_mode: "Markdown",
                                reply_markup: finalMarkup
                            }),
                        })];
                case 2:
                    res = _a.sent();
                    if (!(res.status === 400)) return [3 /*break*/, 5];
                    return [4 /*yield*/, res.text()];
                case 3:
                    errText = _a.sent();
                    console.warn("[Telegram API Warning] Markdown failed (".concat(errText, "). Falling back to plain text..."));
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/sendMessage"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                chat_id: chatId,
                                text: formattedText,
                                reply_markup: finalMarkup
                            }),
                        })];
                case 4:
                    res = _a.sent();
                    _a.label = 5;
                case 5:
                    if (!!res.ok) return [3 /*break*/, 7];
                    return [4 /*yield*/, res.text()];
                case 6:
                    errText = _a.sent();
                    console.error("[Telegram API Error] /sendMessage status=".concat(res.status, ":"), errText);
                    _a.label = 7;
                case 7: return [3 /*break*/, 9];
                case 8:
                    err_2 = _a.sent();
                    console.error("Lỗi gửi tin nhắn Telegram:", err_2);
                    return [3 /*break*/, 9];
                case 9: return [2 /*return*/];
            }
        });
    });
}
// Helper filter rules tương tự ở frontend
function parseMarkdownRules(mdText) {
    if (!mdText)
        return [];
    var blocks = mdText.split(/###\s*(?=ĐIỀU|Chương)/gi);
    return blocks.map(function (block) {
        var _a;
        var lines = block.trim().split('\n');
        var title = ((_a = lines[0]) === null || _a === void 0 ? void 0 : _a.replace(/^###\s*/, '').trim()) || 'Quy định bổ sung';
        var content = lines.slice(1).join('\n').trim();
        var keywords = title.toLowerCase()
            .replace(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹ\s]/g, '')
            .split(/\s+/)
            .filter(function (w) { return w.length > 2; });
        return { title: title, content: content, keywords: keywords };
    });
}
function filterRelevantRules(message, rawRules) {
    if (!rawRules)
        return '';
    var m = message.toLowerCase();
    var parsedRules = parseMarkdownRules(rawRules);
    var relevantContent = '';
    parsedRules.forEach(function (rule) {
        var titleMatch = rule.title.toLowerCase().includes(m) || m.includes(rule.title.toLowerCase());
        var kwMatch = rule.keywords.some(function (kw) { return m.includes(kw); });
        if (titleMatch || kwMatch) {
            relevantContent += "### ".concat(rule.title, "\n").concat(rule.content, "\n\n");
        }
    });
    return relevantContent.trim();
}
/**
 * 1A. Gửi báo cáo tổng hợp 8h30 sáng và 17h chiều hàng ngày
 */
function sendDailySummaryAndNotify(type) {
    return __awaiter(this, void 0, void 0, function () {
        var members, dbTasks, tasksData, err_3, groupId, _loop_1, _i, members_1, m, err_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("\u23F0 [Cron Summary] B\u1EAFt \u0111\u1EA7u g\u1EEDi b\u00E1o c\u00E1o t\u1ED5ng h\u1EE3p: ".concat(type));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 16, , 17]);
                    return [4 /*yield*/, getCachedMembers()];
                case 2:
                    members = _a.sent();
                    if (!members || members.length === 0)
                        throw new Error("Không thể fetch team members");
                    dbTasks = [];
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, apiClient.get("/omnitask/")];
                case 4:
                    tasksData = (_a.sent());
                    dbTasks = Array.isArray(tasksData) ? tasksData : ((tasksData === null || tasksData === void 0 ? void 0 : tasksData.data) || []);
                    return [3 /*break*/, 6];
                case 5:
                    err_3 = _a.sent();
                    throw new Error("Không thể fetch tasks");
                case 6:
                    groupId = process.env.TELEGRAM_GROUP_ID;
                    if (!groupId) return [3 /*break*/, 11];
                    if (!(type === "morning")) return [3 /*break*/, 9];
                    return [4 /*yield*/, handleTelegramMessage({
                            chat: { id: Number(groupId) },
                            from: { username: "cron_system", first_name: "System" },
                            text: "/check_team"
                        })];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, sendMessage(Number(groupId), "🌅 Chúc toàn đội ngũ một ngày làm việc năng suất! Nhớ cập nhật trạng thái các task trên bảng Kanban nhé.")];
                case 8:
                    _a.sent();
                    return [3 /*break*/, 11];
                case 9: return [4 /*yield*/, sendMessage(Number(groupId), "🌙 18h00 rồi! Đội ngũ vui lòng dành ít phút review lại tiến độ công việc trong ngày, kéo thẻ Kanban và điểm danh ra về nhé. Cảm ơn mọi người!")];
                case 10:
                    _a.sent();
                    _a.label = 11;
                case 11:
                    _loop_1 = function (m) {
                        var chatId, mySubTasks, pendingTasks, taskListStr_1, msg, e_1, activeTasks, taskListStr_2, msg, e_2;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    if (!m.telegramChatId)
                                        return [2 /*return*/, "continue"];
                                    chatId = Number(m.telegramChatId);
                                    mySubTasks = [];
                                    dbTasks.forEach(function (t) {
                                        if (Array.isArray(t.subTasks)) {
                                            t.subTasks.forEach(function (sub) {
                                                if (sub.assigneeId === m.id) {
                                                    mySubTasks.push(sub);
                                                }
                                            });
                                        }
                                    });
                                    if (!(type === "morning")) return [3 /*break*/, 8];
                                    pendingTasks = mySubTasks.filter(function (s) { return s.status !== 'done'; });
                                    if (!(pendingTasks.length === 0)) return [3 /*break*/, 2];
                                    return [4 /*yield*/, sendMessage(chatId, "\u2600\uFE0F *B\u00C1O C\u00C1O \u0110\u1EA6U NG\u00C0Y (8h30)*\n\nCh\u00E0o *".concat(m.fullName, "*, h\u00F4m nay b\u1EA1n kh\u00F4ng c\u00F3 c\u00F4ng vi\u1EC7c n\u00E0o \u0111ang ch\u1EDD x\u1EED l\u00FD. Ch\u00FAc b\u1EA1n m\u1ED9t ng\u00E0y m\u1EDBi l\u00E0m vi\u1EC7c tr\u00E0n \u0111\u1EA7y n\u0103ng l\u01B0\u1EE3ng!"), {
                                            inline_keyboard: [[{ text: "🌅 Vào ca (Check-in)", callback_data: "attendance_direct:present" }]]
                                        })];
                                case 1:
                                    _b.sent();
                                    return [2 /*return*/, "continue"];
                                case 2:
                                    taskListStr_1 = "";
                                    pendingTasks.forEach(function (s) {
                                        var dlStr = s.deadline ? s.deadline.split('T')[0] : 'Chưa có';
                                        taskListStr_1 += "\u2022 *".concat(s.planeTaskId || 'Task', ": ").concat(s.title, "* (Tr\u1EA1ng th\u00E1i: *").concat(s.status, "*, H\u1EA1n ch\u00F3t: *").concat(dlStr, "*)\n");
                                    });
                                    msg = "\u2600\uFE0F *B\u00C1O C\u00C1O C\u00D4NG VI\u1EC6C \u0110\u1EA6U NG\u00C0Y (8h30)*\n\nCh\u00E0o *".concat(m.fullName, "*, d\u01B0\u1EDBi \u0111\u00E2y l\u00E0 danh s\u00E1ch c\u00E1c c\u00F4ng vi\u1EC7c b\u1EA1n c\u1EA7n t\u1EADp trung x\u1EED l\u00FD trong h\u00F4m nay:\n\n").concat(taskListStr_1, "\n\uD83D\uDCAA Ch\u00FAc b\u1EA1n m\u1ED9t ng\u00E0y l\u00E0m vi\u1EC7c hi\u1EC7u qu\u1EA3 v\u00E0 ho\u00E0n th\u00E0nh xu\u1EA5t s\u1EAFc m\u1EE5c ti\u00EAu!");
                                    return [4 /*yield*/, sendMessage(chatId, msg, {
                                            inline_keyboard: [[{ text: "🌅 Vào ca (Check-in)", callback_data: "attendance_direct:present" }]]
                                        })];
                                case 3:
                                    _b.sent();
                                    _b.label = 4;
                                case 4:
                                    _b.trys.push([4, 6, , 7]);
                                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(WEB_PORTAL_URL, "/api/ai/announcements"), {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                title: "\u2600\uFE0F B\u00E1o c\u00E1o \u0111\u1EA7u ng\u00E0y (8h30): ".concat(m.fullName),
                                                content: "H\u1EC7 th\u1ED1ng t\u1EF1 \u0111\u1ED9ng nh\u1EAFc nh\u1EDF \u0111\u1EA7u ng\u00E0y cho ".concat(m.fullName, ". S\u1ED1 task c\u1EA7n l\u00E0m: ").concat(pendingTasks.length, "."),
                                                sender: "Bot AI Tự động"
                                            })
                                        })];
                                case 5:
                                    _b.sent();
                                    return [3 /*break*/, 7];
                                case 6:
                                    e_1 = _b.sent();
                                    return [3 /*break*/, 7];
                                case 7: return [3 /*break*/, 13];
                                case 8:
                                    activeTasks = mySubTasks.filter(function (s) { return s.status === 'in_progress' || s.status === 'pending'; });
                                    taskListStr_2 = "";
                                    if (activeTasks.length > 0) {
                                        activeTasks.forEach(function (s) {
                                            taskListStr_2 += "\u2022 *".concat(s.planeTaskId || 'Task', ": ").concat(s.title, "* (Tr\u1EA1ng th\u00E1i: *").concat(s.status, "*)\n");
                                        });
                                    }
                                    else {
                                        taskListStr_2 = "Không có công việc nào đang mở.";
                                    }
                                    msg = "\uD83C\uDF19 *C\u1EACP NH\u1EACT TI\u1EBEN \u0110\u1ED8 CU\u1ED0I NG\u00C0Y (18h00)*\n\nCh\u00E0o *".concat(m.fullName, "*, b\u1EA1n vui l\u00F2ng d\u00E0nh \u00EDt ph\u00FAt c\u1EADp nh\u1EADt ti\u1EBFn tr\u00ECnh c\u1EE7a c\u00E1c c\u00F4ng vi\u1EC7c sau l\u00EAn b\u1EA3ng Kanban tr\u01B0\u1EDBc khi ra v\u1EC1 nh\u00E9:\n\n").concat(taskListStr_2, "\n\uD83D\uDE4F C\u1EA3m \u01A1n b\u1EA1n v\u00E0 ch\u00FAc b\u1EA1n c\u00F3 m\u1ED9t bu\u1ED5i t\u1ED1i th\u01B0 gi\u00E3n vui v\u1EBB!");
                                    return [4 /*yield*/, sendMessage(chatId, msg, {
                                            inline_keyboard: [[{ text: "🚪 Tan ca (Check-out)", callback_data: "attendance_direct:checkout" }]]
                                        })];
                                case 9:
                                    _b.sent();
                                    _b.label = 10;
                                case 10:
                                    _b.trys.push([10, 12, , 13]);
                                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(WEB_PORTAL_URL, "/api/ai/announcements"), {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                title: "\uD83C\uDF19 Nh\u1EAFc ti\u1EBFn \u0111\u1ED9 cu\u1ED1i ng\u00E0y (17h00): ".concat(m.fullName),
                                                content: "H\u1EC7 th\u1ED1ng nh\u1EAFc nh\u1EDF c\u1EADp nh\u1EADt tr\u1EA1ng th\u00E1i cu\u1ED1i ng\u00E0y cho ".concat(m.fullName, ". S\u1ED1 task \u0111ang l\u00E0m: ").concat(activeTasks.length, "."),
                                                sender: "Bot AI Tự động"
                                            })
                                        })];
                                case 11:
                                    _b.sent();
                                    return [3 /*break*/, 13];
                                case 12:
                                    e_2 = _b.sent();
                                    return [3 /*break*/, 13];
                                case 13: return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, members_1 = members;
                    _a.label = 12;
                case 12:
                    if (!(_i < members_1.length)) return [3 /*break*/, 15];
                    m = members_1[_i];
                    return [5 /*yield**/, _loop_1(m)];
                case 13:
                    _a.sent();
                    _a.label = 14;
                case 14:
                    _i++;
                    return [3 /*break*/, 12];
                case 15: return [3 /*break*/, 17];
                case 16:
                    err_4 = _a.sent();
                    console.error("Lỗi gửi báo cáo summary:", err_4);
                    return [3 /*break*/, 17];
                case 17: return [2 /*return*/];
            }
        });
    });
}
/**
 * 1B. Quét deadline quá hạn realtime và gửi thông báo ngay lập tức
 */
function checkRealtimeOverdueDeadlines() {
    return __awaiter(this, void 0, void 0, function () {
        var members, dbTasks, tasksData, err_5, now, alertedDir, alertedFile, alertedIds, arr, alertCount, _i, dbTasks_1, t, _loop_2, _a, _b, sub, groupId, err_6;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    console.log("⏰ [Cron Overdue] Đang quét deadline quá hạn realtime...");
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 15, , 16]);
                    return [4 /*yield*/, getCachedMembers()];
                case 2:
                    members = _c.sent();
                    if (!members || members.length === 0)
                        throw new Error("Không thể fetch team members");
                    dbTasks = [];
                    _c.label = 3;
                case 3:
                    _c.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, apiClient.get("/omnitask/")];
                case 4:
                    tasksData = (_c.sent());
                    dbTasks = Array.isArray(tasksData) ? tasksData : ((tasksData === null || tasksData === void 0 ? void 0 : tasksData.data) || []);
                    return [3 /*break*/, 6];
                case 5:
                    err_5 = _c.sent();
                    throw new Error("Không thể fetch tasks");
                case 6:
                    now = new Date();
                    alertedDir = path.join(__dirname, "../data");
                    if (!fs.existsSync(alertedDir)) {
                        fs.mkdirSync(alertedDir, { recursive: true });
                    }
                    alertedFile = path.join(alertedDir, "alerted_subtasks.json");
                    alertedIds = new Set();
                    if (fs.existsSync(alertedFile)) {
                        try {
                            arr = JSON.parse(fs.readFileSync(alertedFile, "utf-8"));
                            alertedIds = new Set(arr);
                        }
                        catch (e) { }
                    }
                    alertCount = 0;
                    _i = 0, dbTasks_1 = dbTasks;
                    _c.label = 7;
                case 7:
                    if (!(_i < dbTasks_1.length)) return [3 /*break*/, 12];
                    t = dbTasks_1[_i];
                    if (!Array.isArray(t.subTasks)) return [3 /*break*/, 11];
                    _loop_2 = function (sub) {
                        var deadline, member, chatId, dlStr, e_3;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0:
                                    if (sub.status === 'done')
                                        return [2 /*return*/, "continue"];
                                    if (!sub.deadline)
                                        return [2 /*return*/, "continue"];
                                    deadline = new Date(sub.deadline);
                                    if (!(deadline <= now && !alertedIds.has(sub.id))) return [3 /*break*/, 6];
                                    member = (members || []).find(function (m) { return m.id === sub.assigneeId; });
                                    if (!member || !member.telegramChatId)
                                        return [2 /*return*/, "continue"];
                                    chatId = Number(member.telegramChatId);
                                    dlStr = sub.deadline.split('T')[0] + ' ' + sub.deadline.split('T')[1].substring(0, 5);
                                    // 1. Gửi tin nhắn Telegram
                                    return [4 /*yield*/, sendMessage(chatId, "\uD83D\uDEA8 *C\u1EA2NH B\u00C1O QU\u00C1 H\u1EA0N DEADLINE REALTIME!*\n\n\u2022 Nhi\u1EC7m v\u1EE5: *".concat(sub.planeTaskId || 'Task', ": ").concat(sub.title, "*\n\u2022 Ng\u01B0\u1EDDi ph\u1EE5 tr\u00E1ch: *").concat(member.fullName, "*\n\u2022 H\u1EA1n ch\u00F3t: *").concat(dlStr, "* (\u0110\u00E3 qu\u00E1 h\u1EA1n)\n\n\u26A0\uFE0F Vui l\u00F2ng c\u1EADp nh\u1EADt tr\u1EA1ng th\u00E1i c\u00F4ng vi\u1EC7c ho\u1EB7c li\u00EAn h\u1EC7 admin ho\u00E3n task ngay l\u1EADp t\u1EE9c!"))];
                                case 1:
                                    // 1. Gửi tin nhắn Telegram
                                    _d.sent();
                                    _d.label = 2;
                                case 2:
                                    _d.trys.push([2, 4, , 5]);
                                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(WEB_PORTAL_URL, "/api/ai/announcements"), {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                title: "\uD83D\uDEA8 Qu\u00E1 h\u1EA1n Realtime: ".concat(sub.title),
                                                content: "Nhi\u1EC7m v\u1EE5 '".concat(sub.title, "' giao cho ").concat(member.fullName, " \u0111\u00E3 qu\u00E1 h\u1EA1n v\u00E0o l\u00FAc ").concat(dlStr, "."),
                                                sender: "Cảnh báo Hệ thống"
                                            })
                                        })];
                                case 3:
                                    _d.sent();
                                    return [3 /*break*/, 5];
                                case 4:
                                    e_3 = _d.sent();
                                    return [3 /*break*/, 5];
                                case 5:
                                    alertedIds.add(sub.id);
                                    alertCount++;
                                    _d.label = 6;
                                case 6: return [2 /*return*/];
                            }
                        });
                    };
                    _a = 0, _b = t.subTasks;
                    _c.label = 8;
                case 8:
                    if (!(_a < _b.length)) return [3 /*break*/, 11];
                    sub = _b[_a];
                    return [5 /*yield**/, _loop_2(sub)];
                case 9:
                    _c.sent();
                    _c.label = 10;
                case 10:
                    _a++;
                    return [3 /*break*/, 8];
                case 11:
                    _i++;
                    return [3 /*break*/, 7];
                case 12:
                    if (!(alertCount > 0)) return [3 /*break*/, 14];
                    fs.writeFileSync(alertedFile, JSON.stringify(Array.from(alertedIds), null, 2));
                    console.log("\u23F0 [Cron Overdue] \u0110\u00E3 g\u1EEDi ".concat(alertCount, " th\u00F4ng b\u00E1o qu\u00E1 h\u1EA1n realtime."));
                    groupId = process.env.TELEGRAM_GROUP_ID;
                    if (!groupId) return [3 /*break*/, 14];
                    return [4 /*yield*/, sendMessage(Number(groupId), "\uD83D\uDEA8 *C\u1EA2NH B\u00C1O NH\u00D3M:* C\u00F3 ".concat(alertCount, " nhi\u1EC7m v\u1EE5 v\u1EEBa b\u1ECB qu\u00E1 h\u1EA1n! Vui l\u00F2ng g\u1ECDi l\u1EC7nh /check_team \u0111\u1EC3 xem danh s\u00E1ch ti\u1EBFn \u0111\u1ED9."))];
                case 13:
                    _c.sent();
                    _c.label = 14;
                case 14: return [3 /*break*/, 16];
                case 15:
                    err_6 = _c.sent();
                    console.error("Lỗi check deadline realtime:", err_6);
                    return [3 /*break*/, 16];
                case 16: return [2 /*return*/];
            }
        });
    });
}
function handleTelegramMessage(message) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('./telegram/handlers/messageHandler'); })];
                case 1: return [2 /*return*/, (_a.sent()).handleTelegramMessage(message)];
            }
        });
    });
}
function handleCallbackQuery(callbackQuery) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('./telegram/handlers/callbackQueryHandler'); })];
                case 1: return [2 /*return*/, (_a.sent()).handleCallbackQuery(callbackQuery)];
            }
        });
    });
}
/**
 * 3. Bắt đầu cơ chế Long Polling & Cron Job nội bộ
 */
function setupBotCommands() {
    return __awaiter(this, void 0, void 0, function () {
        var res, err_7;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/setMyCommands"), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                commands: [
                                    { command: "start", description: "Khởi động trợ lý AI & hiện khay phím tắt" },
                                    { command: "register", description: "Đăng ký liên kết tài khoản cho nhân sự mới" },
                                    { command: "ho_so", description: "Xem thông tin hồ sơ cá nhân của tôi" },
                                    { command: "portal", description: "Đăng nhập nhanh vào Web Portal" },
                                    { command: "dang_ky", description: "Đăng ký Nghỉ phép / Làm Remote" },
                                    { command: "cong_viec", description: "Xem danh sách công việc của tôi" },
                                    { command: "check", description: "Quét deadline quá hạn realtime (Admin)" },
                                    { command: "check_all", description: "Báo cáo trạng thái toàn bộ nhân viên" },
                                    { command: "team_status", description: "Báo cáo chấm công hôm nay" },
                                    { command: "subtask", description: "Phân rã task bằng AI" }
                                ]
                            })
                        })];
                case 1:
                    res = _a.sent();
                    if (res.ok) {
                        console.log("🤖 [Telegram] Đã tự động cấu hình các nút lệnh Commands thành công!");
                    }
                    return [3 /*break*/, 3];
                case 2:
                    err_7 = _a.sent();
                    console.error("Lỗi setMyCommands:", err_7);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function startTelegramPolling() {
    return __awaiter(this, void 0, void 0, function () {
        var app, WEBHOOK_PORT;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!TELEGRAM_BOT_TOKEN) {
                        console.log("⚠️ CHƯA CẤU HÌNH TELEGRAM_BOT_TOKEN. Chạy bot ở chế độ MOCK (Giả lập console).");
                        return [2 /*return*/];
                    }
                    console.log("\uD83E\uDD16 Telegram Bot \u0111ang kh\u1EDFi \u0111\u1ED9ng ch\u1EBF \u0111\u1ED9 Webhook (Token: ...".concat(TELEGRAM_BOT_TOKEN.substring(0, 8), ")..."));
                    return [4 /*yield*/, setupBotCommands()];
                case 1:
                    _a.sent();
                    // Vòng lặp Cron Worker nội bộ với timezone cụ thể
                    node_cron_1.default.schedule('30 8 * * 1-6', function () { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    console.log("⏰ [Cron Summary] Đến giờ 8h30 sáng, gửi báo cáo đầu ngày...");
                                    return [4 /*yield*/, sendDailySummaryAndNotify("morning")];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); }, { timezone: "Asia/Ho_Chi_Minh" });
                    node_cron_1.default.schedule('0 18 * * 1-6', function () { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    console.log("⏰ [Cron Summary] Đến giờ 18h00 chiều, gửi nhắc nhở cuối ngày...");
                                    return [4 /*yield*/, sendDailySummaryAndNotify("evening")];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); }, { timezone: "Asia/Ho_Chi_Minh" });
                    node_cron_1.default.schedule('*/5 * * * *', function () { return __awaiter(_this, void 0, void 0, function () {
                        var err_8;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, checkRealtimeOverdueDeadlines()];
                                case 1:
                                    _a.sent();
                                    return [3 /*break*/, 3];
                                case 2:
                                    err_8 = _a.sent();
                                    console.error("Lỗi cron check deadline:", err_8);
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); }, { timezone: "Asia/Ho_Chi_Minh" });
                    // Quét ngay lần đầu chạy
                    setTimeout(function () {
                        checkRealtimeOverdueDeadlines();
                    }, 5000);
                    app = (0, express_1.default)();
                    app.use(express_1.default.json());
                    // Webhook Route
                    app.post('/worker/v1/telegram/webhook', function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var update, err_9;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 5, , 6]);
                                    update = req.body;
                                    if (!(update.message && update.message.text)) return [3 /*break*/, 2];
                                    return [4 /*yield*/, handleTelegramMessage(update.message)];
                                case 1:
                                    _a.sent();
                                    return [3 /*break*/, 4];
                                case 2:
                                    if (!update.callback_query) return [3 /*break*/, 4];
                                    return [4 /*yield*/, handleCallbackQuery(update.callback_query)];
                                case 3:
                                    _a.sent();
                                    _a.label = 4;
                                case 4:
                                    res.sendStatus(200);
                                    return [3 /*break*/, 6];
                                case 5:
                                    err_9 = _a.sent();
                                    console.error("Lỗi xử lý webhook:", err_9);
                                    // TRẢ VỀ 200 OK NGAY LẬP TỨC để Telegram không gửi lại (retry) tin nhắn
                                    res.sendStatus(200);
                                    return [3 /*break*/, 6];
                                case 6: return [2 /*return*/];
                            }
                        });
                    }); });
                    WEBHOOK_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4511;
                    app.listen(WEBHOOK_PORT, function () { return __awaiter(_this, void 0, void 0, function () {
                        var WEBHOOK_URL, res, data, e_4;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    console.log("\uD83D\uDE80 Telegram Webhook Server \u0111ang ch\u1EA1y t\u1EA1i port ".concat(WEBHOOK_PORT, "..."));
                                    WEBHOOK_URL = "https://api.storymee.com/worker/v1/telegram/webhook";
                                    _a.label = 1;
                                case 1:
                                    _a.trys.push([1, 4, , 5]);
                                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/setWebhook?url=").concat(WEBHOOK_URL))];
                                case 2:
                                    res = _a.sent();
                                    return [4 /*yield*/, res.json()];
                                case 3:
                                    data = _a.sent();
                                    if (data.ok) {
                                        console.log("\u2705 \u0110\u00E3 \u0111\u0103ng k\u00FD Telegram Webhook th\u00E0nh c\u00F4ng: ".concat(WEBHOOK_URL));
                                    }
                                    else {
                                        console.error("❌ Lỗi đăng ký Webhook:", data);
                                    }
                                    return [3 /*break*/, 5];
                                case 4:
                                    e_4 = _a.sent();
                                    console.error("❌ Lỗi kết nối đăng ký Webhook:", e_4);
                                    return [3 /*break*/, 5];
                                case 5: return [2 /*return*/];
                            }
                        });
                    }); });
                    return [2 /*return*/];
            }
        });
    });
}
// Khởi chạy
// import { startCronJobs } from "./cronJobs.js";
// startCronJobs(apiClient, sendMessage); // Đã gộp vào vòng lặp cron bên trong
startTelegramPolling();
