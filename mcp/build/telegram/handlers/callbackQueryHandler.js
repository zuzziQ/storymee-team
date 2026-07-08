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
exports.handleCallbackQuery = handleCallbackQuery;
var fetchAxios_1 = require("../../fetchAxios");
var api_client_1 = require("@storymee/api-client");
var telegram_agent_1 = require("../../telegram_agent");
var telegram_agent_2 = require("../../telegram_agent");
var index_1 = require("../../index");
var dotenv = require("dotenv");
dotenv.config();
var TELEGRAM_API = "https://api.telegram.org/bot".concat(process.env.TELEGRAM_BOT_TOKEN);
var CORE_API_URL = process.env.CORE_API_URL || "http://localhost:4500";
var WEB_PORTAL_URL = process.env.WEB_PORTAL_URL || "https://api.storymee.com";
var OMNIROUTER_API_URL = process.env.OMNIROUTER_API_URL || "https://api.storymee.com/api/ai/chat";
var apiClient = new api_client_1.CoreApiClient({ baseURL: CORE_API_URL });
function handleCallbackQuery(callbackQuery) {
    return __awaiter(this, void 0, void 0, function () {
        var queryId, chatId, messageId, data, username, err_1, member, allMembers, cleanUsername_1, err_2, status_1, e_1, result, err_3, e_2, parts, mode, type, e_3, today, e_4, formSessionCallback, ctx, query, textResponse, textResponse, textResponse, textResponse, actionId, actionData, e_5, action, payload, actionMember, result, requestId, e_6, adminEmails, _i, allMembers_1, targetMem, adminChatId, leaveTypeStr, err_4, estimateVal, dDate, now, e_7, estimateVal, dDate, now, result, e_8, result, e_9, result, e_10, result, e_11, result, e_12, allMems, adminEmails, _a, allMems_1, targetMem, adminChatId, reqTypeStr, err_5, result, e_13, result, e_14, err_6, actionId, e_15, parts, leaveType, startDate, endDate, reason, resJson, requestId, e_16, adminEmails, _b, allMembers_2, targetMem, adminChatId, leaveTypeStr, err_7, err_8, err_9, parts, action, taskId, reqType, actionStr, emoji, err_10, err_11, e_17, isAdmin, action, requestId, statusParam, resJson, actionStr, emoji, e_18, leaveReq_1, emp, empChatId, startD, endD, typeStr, err_12, err_13;
        var _c, _d, _e, _f, _g, _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    queryId = callbackQuery.id;
                    chatId = callbackQuery.message.chat.id;
                    messageId = callbackQuery.message.message_id;
                    data = callbackQuery.data;
                    username = callbackQuery.from.username;
                    console.log("[Telegram Callback from @".concat(username, "]: ").concat(data));
                    _j.label = 1;
                case 1:
                    _j.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/answerCallbackQuery"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ callback_query_id: queryId })
                        })];
                case 2:
                    _j.sent();
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _j.sent();
                    return [3 /*break*/, 4];
                case 4:
                    member = null;
                    allMembers = [];
                    _j.label = 5;
                case 5:
                    _j.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, (0, telegram_agent_1.getCachedMembers)()];
                case 6:
                    allMembers = _j.sent();
                    if (allMembers && allMembers.length > 0) {
                        cleanUsername_1 = (username || "").replace(/^@/, "").toLowerCase().trim();
                        member = allMembers.find(function (m) {
                            var cleanDB = (m.telegramUsername || "").replace(/^@/, "").toLowerCase().trim();
                            return cleanDB === cleanUsername_1;
                        });
                    }
                    return [3 /*break*/, 8];
                case 7:
                    err_2 = _j.sent();
                    console.error("Lỗi tìm kiếm nhân sự click nút:", err_2);
                    return [3 /*break*/, 8];
                case 8:
                    if (!!member) return [3 /*break*/, 11];
                    if (!(chatId > 0)) return [3 /*break*/, 10];
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "❌ LỖI: Tài khoản Telegram của bạn chưa được liên kết với nhân sự nào trong hệ thống.")];
                case 9:
                    _j.sent();
                    _j.label = 10;
                case 10: return [2 /*return*/];
                case 11:
                    if (!(data === "group_cmd:check_team")) return [3 /*break*/, 13];
                    // Simulate user typing /check_team to trigger the report logic
                    return [4 /*yield*/, (0, telegram_agent_2.handleTelegramMessage)({
                            chat: { id: chatId },
                            from: { username: username, first_name: "" },
                            text: "/check_team"
                        })];
                case 12:
                    // Simulate user typing /check_team to trigger the report logic
                    _j.sent();
                    return [2 /*return*/];
                case 13:
                    if (!(data === "group_cmd:ai_help")) return [3 /*break*/, 15];
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "🤖 *HƯỚNG DẪN AI CHO NHÓM*\n\nSếp có thể giao việc bằng cách tag bot và ra lệnh trực tiếp trong nhóm. \n\nVí dụ:\n_@Storymeebot Tạo task 'Khảo sát người dùng', giao cho @quangminh, deadline ngày mai_")];
                case 14:
                    _j.sent();
                    return [2 /*return*/];
                case 15:
                    if (!data.startsWith("attendance_direct:")) return [3 /*break*/, 28];
                    status_1 = data.split(":")[1] || "present";
                    _j.label = 16;
                case 16:
                    _j.trys.push([16, 18, , 19]);
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/editMessageText"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                chat_id: chatId,
                                message_id: messageId,
                                text: "\u23F3 *H\u1EC7 th\u1ED1ng:* \u0110ang g\u1EEDi th\u00F4ng tin \u0111i\u1EC3m danh \u0111\u1EBFn API Server..."
                            })
                        })];
                case 17:
                    _j.sent();
                    return [3 /*break*/, 19];
                case 18:
                    e_1 = _j.sent();
                    return [3 /*break*/, 19];
                case 19:
                    _j.trys.push([19, 22, , 27]);
                    return [4 /*yield*/, (0, index_1.executeMcpTool)("check_in_out", {
                            status: status_1,
                            notes: "Điểm danh nhanh qua nút bấm Telegram"
                        }, member)];
                case 20:
                    result = _j.sent();
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/editMessageText"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                chat_id: chatId,
                                message_id: messageId,
                                text: "\u2705 *H\u1EC7 th\u1ED1ng:* ".concat(result.content[0].text),
                                parse_mode: "Markdown"
                            })
                        })];
                case 21:
                    _j.sent();
                    return [3 /*break*/, 27];
                case 22:
                    err_3 = _j.sent();
                    console.error("Lỗi điểm danh qua callback:", err_3);
                    _j.label = 23;
                case 23:
                    _j.trys.push([23, 25, , 26]);
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/editMessageText"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                chat_id: chatId,
                                message_id: messageId,
                                text: "\u274C *H\u1EC7 th\u1ED1ng:* L\u1ED7i \u0111i\u1EC3m danh: ".concat(err_3.message || String(err_3))
                            })
                        })];
                case 24:
                    _j.sent();
                    return [3 /*break*/, 26];
                case 25:
                    e_2 = _j.sent();
                    return [3 /*break*/, 26];
                case 26: return [3 /*break*/, 27];
                case 27: return [2 /*return*/];
                case 28:
                    if (!(data === "start_create_project")) return [3 /*break*/, 30];
                    telegram_agent_1.userFormSession[chatId] = { action: 'create_project', step: 'create_project_name' };
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/sendMessage"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                chat_id: chatId,
                                text: "\uD83D\uDCC2 *T\u1EA0O D\u1EF0 \u00C1N M\u1EDAI*\n\nVui l\u00F2ng nh\u1EADp **T\u00EAn D\u1EF1 \u00E1n**:",
                                reply_markup: { force_reply: true, selective: true }
                            })
                        })];
                case 29:
                    _j.sent();
                    return [2 /*return*/];
                case 30:
                    if (!(data === "start_create_task")) return [3 /*break*/, 32];
                    telegram_agent_1.userFormSession[chatId] = { action: 'create_task', step: 'create_task_title' };
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/sendMessage"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                chat_id: chatId,
                                text: "\uD83D\uDCCB *T\u1EA0O TASK M\u1EDAI*\n\nVui l\u00F2ng nh\u1EADp **Ti\u00EAu \u0111\u1EC1 Task**:",
                                reply_markup: { force_reply: true, selective: true }
                            })
                        })];
                case 31:
                    _j.sent();
                    return [2 /*return*/];
                case 32:
                    if (!data.startsWith("leave_mode:")) return [3 /*break*/, 42];
                    parts = data.split(":");
                    mode = parts[1];
                    type = parts[2] || 'annual';
                    if (!(mode === 'single')) return [3 /*break*/, 37];
                    _j.label = 33;
                case 33:
                    _j.trys.push([33, 35, , 36]);
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/sendMessage"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                chat_id: chatId,
                                text: "\u23F1\uFE0F *[NGH\u1EC8 TRONG NG\u00C0Y (THEO CA)]*\n\nVui l\u00F2ng ch\u1ECDn ca ngh\u1EC9 c\u1EE7a b\u1EA1n d\u01B0\u1EDBi \u0111\u00E2y:",
                                parse_mode: "Markdown",
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            { text: "🌅 Buổi Sáng (AM)", callback_data: "leave_session:am:".concat(type) },
                                            { text: "🌇 Buổi Chiều (PM)", callback_data: "leave_session:pm:".concat(type) }
                                        ],
                                        [
                                            { text: "☀️ Nguyên Ngày (Full)", callback_data: "leave_session:all:".concat(type) }
                                        ]
                                    ]
                                }
                            })
                        })];
                case 34:
                    _j.sent();
                    return [3 /*break*/, 36];
                case 35:
                    e_3 = _j.sent();
                    return [3 /*break*/, 36];
                case 36: return [3 /*break*/, 41];
                case 37:
                    telegram_agent_1.userFormSession[chatId] = {
                        type: 'leave',
                        leaveType: type,
                        remoteSession: 'range',
                        step: 'awaiting_start_date'
                    };
                    today = new Date();
                    _j.label = 38;
                case 38:
                    _j.trys.push([38, 40, , 41]);
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/sendMessage"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                chat_id: chatId,
                                text: "\uD83D\uDCC5 *[NGH\u1EC8 D\u00C0I NG\u00C0Y]*\n\n\uD83D\uDC49 *B\u01B0\u1EDBc 1/2:* Vui l\u00F2ng ch\u1ECDn **Ng\u00E0y b\u1EAFt \u0111\u1EA7u ngh\u1EC9** tr\u00EAn l\u1ECBch d\u01B0\u1EDBi \u0111\u00E2y:",
                                parse_mode: "Markdown",
                                reply_markup: (0, telegram_agent_1.createCalendarKeyboard)(today.getFullYear(), today.getMonth() + 1, "start_date")
                            })
                        })];
                case 39:
                    _j.sent();
                    return [3 /*break*/, 41];
                case 40:
                    e_4 = _j.sent();
                    return [3 /*break*/, 41];
                case 41: return [2 /*return*/];
                case 42:
                    formSessionCallback = require('../callbacks/formSessionCallback').formSessionCallback;
                    ctx = {
                        chatId: chatId,
                        messageId: messageId,
                        callbackQueryId: queryId,
                        data: data,
                        member: member,
                        allMembers: allMembers,
                        apiClient: apiClient,
                        callbackQuery: callbackQuery
                    };
                    return [4 /*yield*/, formSessionCallback.execute(ctx)];
                case 43:
                    if (_j.sent()) {
                        return [2 /*return*/];
                    }
                    if (!data.startsWith("ask_faq:")) return [3 /*break*/, 54];
                    query = data.split(":")[1].trim().toLowerCase();
                    if (!(query === "lương tháng 13")) return [3 /*break*/, 45];
                    textResponse = "\uD83D\uDCB5 *QUY \u0110\u1ECANH L\u01AF\u01A0NG TH\u00C1NG 13 & TH\u01AF\u1EDENG*\n\n\u2022 *L\u01B0\u01A1ng th\u00E1ng 13:* To\u00E0n b\u1ED9 nh\u00E2n vi\u00EAn ch\u00EDnh th\u1EE9c l\u00E0m vi\u1EC7c \u0111\u1EE7 12 th\u00E1ng t\u1EA1i c\u00F4ng ty s\u1EBD \u0111\u01B0\u1EE3c h\u01B0\u1EDFng l\u01B0\u01A1ng th\u00E1ng 13 b\u1EB1ng 1 th\u00E1ng l\u01B0\u01A1ng c\u01A1 b\u1EA3n theo h\u1EE3p \u0111\u1ED3ng lao \u0111\u1ED9ng. N\u1EBFu ch\u01B0a \u0111\u1EE7 12 th\u00E1ng, s\u1EBD t\u00EDnh theo t\u1EF7 l\u1EC7 s\u1ED1 th\u00E1ng l\u00E0m vi\u1EC7c th\u1EF1c t\u1EBF.\n\u2022 *Th\u01B0\u1EDFng hi\u1EC7u qu\u1EA3 c\u00F4ng vi\u1EC7c (KPI):* X\u00E9t duy\u1EC7t d\u1EF1a tr\u00EAn \u0111\u00E1nh gi\u00E1 hi\u1EC7u su\u1EA5t cu\u1ED1i n\u0103m (OKR/KPI) c\u1EE7a c\u00E1 nh\u00E2n v\u00E0 ph\u00F2ng ban do Ban Gi\u00E1m \u0110\u1ED1c ph\u00EA duy\u1EC7t.";
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, textResponse)];
                case 44:
                    _j.sent();
                    return [2 /*return*/];
                case 45:
                    if (!(query === "quy chế thử việc")) return [3 /*break*/, 47];
                    textResponse = "\u23F1\uFE0F *QUY \u0110\u1ECANH V\u1EC0 TH\u1EEC VI\u1EC6C*\n\n\u2022 *Th\u1EDDi gian th\u1EED vi\u1EC7c:* 02 th\u00E1ng \u0111\u1ED1i v\u1EDBi v\u1ECB tr\u00ED chuy\u00EAn m\u00F4n, k\u1EF9 thu\u1EADt ho\u1EB7c qu\u1EA3n l\u00FD. 01 th\u00E1ng \u0111\u1ED1i v\u1EDBi v\u1ECB tr\u00ED nghi\u1EC7p v\u1EE5 kh\u00E1c.\n\u2022 *M\u1EE9c l\u01B0\u01A1ng th\u1EED vi\u1EC7c:* H\u01B0\u1EDFng *85%* m\u1EE9c l\u01B0\u01A1ng ch\u00EDnh th\u1EE9c th\u1ECFa thu\u1EADn trong h\u1EE3p \u0111\u1ED3ng lao \u0111\u1ED9ng.\n\u2022 *\u0110\u00E1nh gi\u00E1 th\u1EED vi\u1EC7c:* Sau th\u1EDDi gian th\u1EED vi\u1EC7c, qu\u1EA3n l\u00FD tr\u1EF1c ti\u1EBFp s\u1EBD \u0111\u00E1nh gi\u00E1 hi\u1EC7u su\u1EA5t \u0111\u1EC3 quy\u1EBFt \u0111\u1ECBnh k\u00FD h\u1EE3p \u0111\u1ED3ng ch\u00EDnh th\u1EE9c.";
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, textResponse)];
                case 46:
                    _j.sent();
                    return [2 /*return*/];
                case 47:
                    if (!(query === "quy định nghỉ phép năm")) return [3 /*break*/, 49];
                    textResponse = "\uD83D\uDCC5 *QUY \u0110\u1ECANH S\u1ED0 NG\u00C0Y PH\u00C9P & NGH\u1EC8 L\u1EC4*\n\n\u2022 *Ngh\u1EC9 ph\u00E9p n\u0103m:* Nh\u00E2n vi\u00EAn ch\u00EDnh th\u1EE9c h\u01B0\u1EDFng *12 ng\u00E0y ph\u00E9p n\u0103m* c\u00F3 h\u01B0\u1EDFng l\u01B0\u01A1ng/n\u0103m (t\u00EDch l\u0169y 1 ng\u00E0y/th\u00E1ng). Th\u00E2m ni\u00EAn l\u00E0m vi\u1EC7c c\u1EE9 m\u1ED7i n\u0103m t\u0103ng th\u00EAm s\u1EBD c\u1ED9ng th\u00EAm 1 ng\u00E0y ph\u00E9p.\n\u2022 *Ngh\u1EC9 l\u1EC5 T\u1EBFt:* \u0110\u01B0\u1EE3c ngh\u1EC9 v\u00E0 h\u01B0\u1EDFng nguy\u00EAn l\u01B0\u01A1ng theo l\u1ECBch ban h\u00E0nh c\u1EE7a Nh\u00E0 n\u01B0\u1EDBc (T\u1EBFt D\u01B0\u01A1ng L\u1ECBch, T\u1EBFt Nguy\u00EAn \u0110\u00E1n, Gi\u1ED7 t\u1ED5 H\u00F9ng V\u01B0\u01A1ng, 30/4 - 1/5, Qu\u1ED1c Kh\u00E1nh 2/9).";
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, textResponse)];
                case 48:
                    _j.sent();
                    return [2 /*return*/];
                case 49:
                    if (!(query === "chế độ bảo hiểm")) return [3 /*break*/, 51];
                    textResponse = "\uD83C\uDFE5 *QUY CH\u1EBE B\u1EA2O HI\u1EC2M & PH\u00DAC L\u1EE2I*\n\n\u2022 *B\u1EA3o hi\u1EC3m x\u00E3 h\u1ED9i:* \u0110\u00F3ng \u0111\u1EA7y \u0111\u1EE7 BHXH, BHYT, BHTN theo quy \u0111\u1ECBnh c\u1EE7a Lu\u1EADt lao \u0111\u1ED9ng ngay sau khi k\u00FD h\u1EE3p \u0111\u1ED3ng ch\u00EDnh th\u1EE9c.\n\u2022 *Kh\u00E1m s\u1EE9c kh\u1ECFe \u0111\u1ECBnh k\u1EF3:* C\u00F4ng ty t\u1ED5 ch\u1EE9c kh\u00E1m s\u1EE9c kh\u1ECFe t\u1ED5ng qu\u00E1t \u0111\u1ECBnh k\u1EF3 h\u00E0ng n\u0103m cho to\u00E0n b\u1ED9 nh\u00E2n s\u1EF1 ch\u00EDnh th\u1EE9c.\n\u2022 *Ph\u00FAc l\u1EE3i C\u00F4ng \u0111o\u00E0n:* Teambuilding, du l\u1ECBch h\u00E0ng n\u0103m, qu\u00E0 t\u1EB7ng sinh nh\u1EADt, tr\u1EE3 c\u1EA5p hi\u1EBFu h\u1EC9, thai s\u1EA3n theo ch\u00EDnh s\u00E1ch c\u1EE7a C\u00F4ng \u0111o\u00E0n c\u00F4ng ty.";
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, textResponse)];
                case 50:
                    _j.sent();
                    return [2 /*return*/];
                case 51: 
                // Fallback: Nếu là các câu hỏi khác, mới gọi AI xử lý
                return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "\uD83D\uDD0D \u0110ang chuy\u1EC3n c\u00E2u h\u1ECFi c\u1EE7a b\u1EA1n cho Tr\u1EE3 l\u00FD AI: *\"".concat(query, "\"*..."))];
                case 52:
                    // Fallback: Nếu là các câu hỏi khác, mới gọi AI xử lý
                    _j.sent();
                    return [4 /*yield*/, (0, telegram_agent_2.handleTelegramMessage)({
                            chat: { id: chatId },
                            from: { username: username, first_name: callbackQuery.from.first_name || '' },
                            text: query
                        })];
                case 53:
                    _j.sent();
                    return [2 /*return*/];
                case 54:
                    if (!data.startsWith("confirm_action:")) return [3 /*break*/, 132];
                    actionId = data.split(":")[1];
                    if (telegram_agent_1.processingActions.has(actionId)) {
                        console.log("[Telegram] B\u1ECF qua click tr\u00F9ng l\u1EB7p cho actionId: ".concat(actionId));
                        return [2 /*return*/];
                    }
                    actionData = telegram_agent_1.actionCache[actionId];
                    if (!!actionData) return [3 /*break*/, 56];
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "⚠️ Lỗi: Phiên xác nhận đã hết hạn hoặc không tồn tại.")];
                case 55:
                    _j.sent();
                    return [2 /*return*/];
                case 56:
                    // Normalize payload type from AI response
                    if (actionData.payload && actionData.payload.request_type && !actionData.payload.type) {
                        actionData.payload.type = actionData.payload.request_type;
                    }
                    telegram_agent_1.processingActions.add(actionId);
                    _j.label = 57;
                case 57:
                    _j.trys.push([57, 59, , 60]);
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/editMessageText"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                chat_id: chatId,
                                message_id: messageId,
                                text: "\u23F3 *H\u1EC7 th\u1ED1ng:* \u0110ang x\u1EED l\u00FD v\u00E0 l\u01B0u th\u00F4ng tin v\u00E0o Database... Vui l\u00F2ng \u0111\u1EE3i trong gi\u00E2y l\u00E1t.",
                                parse_mode: "Markdown"
                            })
                        })];
                case 58:
                    _j.sent();
                    return [3 /*break*/, 60];
                case 59:
                    e_5 = _j.sent();
                    return [3 /*break*/, 60];
                case 60:
                    action = actionData.action, payload = actionData.payload, actionMember = actionData.member;
                    _j.label = 61;
                case 61:
                    _j.trys.push([61, 128, 130, 131]);
                    if (!(action === 'leave_request')) return [3 /*break*/, 73];
                    return [4 /*yield*/, (0, index_1.executeMcpTool)("submit_leave_request", {
                            startDate: payload.startDate,
                            endDate: payload.endDate,
                            leaveType: payload.leaveType,
                            reason: payload.reason || "Xin nghỉ phép qua Bot Telegram"
                        }, actionMember)];
                case 62:
                    result = _j.sent();
                    requestId = result.requestId;
                    _j.label = 63;
                case 63:
                    _j.trys.push([63, 65, , 66]);
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/editMessageText"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                chat_id: chatId,
                                message_id: messageId,
                                text: "\uD83D\uDE80 *H\u1EC7 th\u1ED1ng:* \u0110\u00E3 g\u1EEDi y\u00EAu c\u1EA7u ngh\u1EC9 ph\u00E9p c\u1EE7a b\u1EA1n th\u00E0nh c\u00F4ng! Phi\u1EBFu \u0111ang \u1EDF tr\u1EA1ng th\u00E1i *Ch\u1EDD duy\u1EC7t*.",
                                parse_mode: "Markdown"
                            })
                        })];
                case 64:
                    _j.sent();
                    return [3 /*break*/, 66];
                case 65:
                    e_6 = _j.sent();
                    return [3 /*break*/, 66];
                case 66:
                    if (!requestId) return [3 /*break*/, 72];
                    adminEmails = ['kimngan151091@gmail.com', 'lehuyducanh.vn@gmail.com', 'zuzzivn@gmail.com'];
                    console.log("SENDING ADMIN: allMembers count:", allMembers.length, "requestId:", requestId);
                    _i = 0, allMembers_1 = allMembers;
                    _j.label = 67;
                case 67:
                    if (!(_i < allMembers_1.length)) return [3 /*break*/, 72];
                    targetMem = allMembers_1[_i];
                    if (!((adminEmails.includes((targetMem.email || "").toLowerCase()) || ((_c = targetMem.telegramUsername) === null || _c === void 0 ? void 0 : _c.toLowerCase()) === 'mlq007') && targetMem.telegramChatId)) return [3 /*break*/, 71];
                    adminChatId = Number(targetMem.telegramChatId);
                    console.log("Found ADMIN:", targetMem.email, "ChatId:", adminChatId);
                    leaveTypeStr = payload.leaveType === 'sick' ? 'Nghỉ ốm' : payload.leaveType === 'annual' ? 'Nghỉ phép năm' : payload.leaveType === 'remote' ? 'Đăng ký Remote' : 'Việc riêng';
                    _j.label = 68;
                case 68:
                    _j.trys.push([68, 70, , 71]);
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/sendMessage"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                chat_id: adminChatId,
                                text: "\uD83D\uDD14 *Y\u00CAU C\u1EA6U DUY\u1EC6T PH\u00C9P M\u1EDAI*\n\n\u2022 Nh\u00E2n vi\u00EAn: *".concat(actionMember.fullName, "*\n\u2022 Lo\u1EA1i ngh\u1EC9: *").concat(leaveTypeStr, "*\n\u2022 Th\u1EDDi gian: *").concat(payload.startDate, " \u0111\u1EBFn ").concat(payload.endDate, "*\n\u2022 L\u00FD do: *").concat(payload.reason || 'Không có', "*\n\n\uD83D\uDC49 Vui l\u00F2ng duy\u1EC7t ho\u1EB7c t\u1EEB ch\u1ED1i y\u00EAu c\u1EA7u n\u00E0y d\u01B0\u1EDBi \u0111\u00E2y:"),
                                parse_mode: "Markdown",
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            { text: "✅ Duyệt nghỉ", callback_data: "approve_leave:".concat(requestId) },
                                            { text: "❌ Từ chối", callback_data: "reject_leave:".concat(requestId) }
                                        ]
                                    ]
                                }
                            })
                        })];
                case 69:
                    _j.sent();
                    return [3 /*break*/, 71];
                case 70:
                    err_4 = _j.sent();
                    console.error("Lỗi gửi tin nhắn duyệt cho admin:", err_4);
                    return [3 /*break*/, 71];
                case 71:
                    _i++;
                    return [3 /*break*/, 67];
                case 72: return [3 /*break*/, 127];
                case 73:
                    if (!(action === 'update_task')) return [3 /*break*/, 79];
                    estimateVal = payload.estimate;
                    if (payload.deadline && (!estimateVal || estimateVal === 0)) {
                        dDate = new Date(payload.deadline);
                        now = new Date();
                        estimateVal = (0, telegram_agent_1.calculateWorkingHours)(now, dDate);
                    }
                    return [4 /*yield*/, (0, index_1.executeMcpTool)("update_task", {
                            task_id: payload.id,
                            status: payload.status || undefined,
                            assignee: payload.assignee || undefined,
                            estimate: estimateVal || undefined,
                            priority: payload.priority || undefined,
                            deadline: payload.deadline || undefined
                        }, actionMember)];
                case 74:
                    _j.sent();
                    _j.label = 75;
                case 75:
                    _j.trys.push([75, 77, , 78]);
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/editMessageText"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                chat_id: chatId,
                                message_id: messageId,
                                text: "\u2705 *H\u1EC7 th\u1ED1ng:* \u0110\u00E3 c\u1EADp nh\u1EADt th\u00E0nh c\u00F4ng c\u00F4ng vi\u1EC7c *".concat(payload.id, "* qua MCP!"),
                                parse_mode: "Markdown"
                            })
                        })];
                case 76:
                    _j.sent();
                    return [3 /*break*/, 78];
                case 77:
                    e_7 = _j.sent();
                    return [3 /*break*/, 78];
                case 78: return [3 /*break*/, 127];
                case 79:
                    if (!(action === 'create_task')) return [3 /*break*/, 85];
                    estimateVal = payload.estimate;
                    if (payload.deadline && (!estimateVal || estimateVal === 0)) {
                        dDate = new Date(payload.deadline);
                        now = new Date();
                        estimateVal = (0, telegram_agent_1.calculateWorkingHours)(now, dDate);
                    }
                    return [4 /*yield*/, (0, index_1.executeMcpTool)("create_task", {
                            title: payload.title || "Nhiệm vụ mới từ Telegram",
                            assignee: payload.assignee || actionMember.fullName,
                            estimate: estimateVal || undefined,
                            priority: payload.priority || "Medium",
                            deadline: payload.deadline || undefined
                        }, actionMember)];
                case 80:
                    result = _j.sent();
                    _j.label = 81;
                case 81:
                    _j.trys.push([81, 83, , 84]);
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/editMessageText"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                chat_id: chatId,
                                message_id: messageId,
                                text: "\u2705 *H\u1EC7 th\u1ED1ng:* \u0110\u00E3 t\u1EA1o m\u1EDBi c\u00F4ng vi\u1EC7c qua MCP th\u00E0nh c\u00F4ng!\n".concat(result.content[0].text.split('\n').slice(1).join('\n')),
                                parse_mode: "Markdown"
                            })
                        })];
                case 82:
                    _j.sent();
                    return [3 /*break*/, 84];
                case 83:
                    e_8 = _j.sent();
                    return [3 /*break*/, 84];
                case 84: return [3 /*break*/, 127];
                case 85:
                    if (!(action === 'check_in_out')) return [3 /*break*/, 91];
                    return [4 /*yield*/, (0, index_1.executeMcpTool)("check_in_out", {
                            status: payload.status,
                            notes: payload.notes,
                            employee_name: payload.employee_name
                        }, actionMember)];
                case 86:
                    result = _j.sent();
                    _j.label = 87;
                case 87:
                    _j.trys.push([87, 89, , 90]);
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/editMessageText"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                chat_id: chatId,
                                message_id: messageId,
                                text: "\u2705 *H\u1EC7 th\u1ED1ng:* ".concat(result.content[0].text),
                                parse_mode: "Markdown"
                            })
                        })];
                case 88:
                    _j.sent();
                    return [3 /*break*/, 90];
                case 89:
                    e_9 = _j.sent();
                    return [3 /*break*/, 90];
                case 90: return [3 /*break*/, 127];
                case 91:
                    if (!(action === 'breakdown_task')) return [3 /*break*/, 97];
                    return [4 /*yield*/, (0, index_1.executeMcpTool)("breakdown_task", {
                            task_id: payload.task_id
                        }, actionMember)];
                case 92:
                    result = _j.sent();
                    _j.label = 93;
                case 93:
                    _j.trys.push([93, 95, , 96]);
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/editMessageText"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                chat_id: chatId,
                                message_id: messageId,
                                text: "\u2705 *H\u1EC7 th\u1ED1ng:* ".concat(result.content[0].text),
                                parse_mode: "Markdown"
                            })
                        })];
                case 94:
                    _j.sent();
                    return [3 /*break*/, 96];
                case 95:
                    e_10 = _j.sent();
                    return [3 /*break*/, 96];
                case 96: return [3 /*break*/, 127];
                case 97:
                    if (!(action === 'update_subtasks')) return [3 /*break*/, 103];
                    return [4 /*yield*/, (0, index_1.executeMcpTool)("update_subtasks", {
                            task_id: payload.task_id,
                            titles: payload.titles
                        }, actionMember)];
                case 98:
                    result = _j.sent();
                    _j.label = 99;
                case 99:
                    _j.trys.push([99, 101, , 102]);
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/editMessageText"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                chat_id: chatId,
                                message_id: messageId,
                                text: "\u2705 *H\u1EC7 th\u1ED1ng:* ".concat(result.content[0].text),
                                parse_mode: "Markdown"
                            })
                        })];
                case 100:
                    _j.sent();
                    return [3 /*break*/, 102];
                case 101:
                    e_11 = _j.sent();
                    return [3 /*break*/, 102];
                case 102: return [3 /*break*/, 127];
                case 103:
                    if (!(action === 'request_task_approval')) return [3 /*break*/, 116];
                    return [4 /*yield*/, (0, index_1.executeMcpTool)("request_task_approval", {
                            task_id: payload.task_id,
                            type: payload.type,
                            reason: payload.reason || "Không có lý do",
                            new_deadline: payload.new_deadline
                        }, actionMember)];
                case 104:
                    result = _j.sent();
                    _j.label = 105;
                case 105:
                    _j.trys.push([105, 107, , 108]);
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/editMessageText"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                chat_id: chatId,
                                message_id: messageId,
                                text: "\u2705 *H\u1EC7 th\u1ED1ng:* ".concat(result.content[0].text),
                                parse_mode: "Markdown"
                            })
                        })];
                case 106:
                    _j.sent();
                    return [3 /*break*/, 108];
                case 107:
                    e_12 = _j.sent();
                    return [3 /*break*/, 108];
                case 108:
                    _j.trys.push([108, 114, , 115]);
                    return [4 /*yield*/, (0, telegram_agent_1.getCachedMembers)()];
                case 109:
                    allMems = _j.sent();
                    if (!(allMems && allMems.length > 0)) return [3 /*break*/, 113];
                    adminEmails = ['kimngan151091@gmail.com', 'lehuyducanh.vn@gmail.com', 'zuzzivn@gmail.com'];
                    _a = 0, allMems_1 = allMems;
                    _j.label = 110;
                case 110:
                    if (!(_a < allMems_1.length)) return [3 /*break*/, 113];
                    targetMem = allMems_1[_a];
                    if (!((adminEmails.includes((targetMem.email || "").toLowerCase()) || ((_d = targetMem.telegramUsername) === null || _d === void 0 ? void 0 : _d.toLowerCase()) === 'mlq007') && targetMem.telegramChatId)) return [3 /*break*/, 112];
                    adminChatId = Number(targetMem.telegramChatId);
                    reqTypeStr = payload.type === 'extend' || payload.type === 'extend_deadline' ? 'Xin dời deadline' : (payload.type === 'archive' || payload.type === 'delete') ? 'Xin lưu trữ' : 'Yêu cầu không hợp lệ';
                    if (payload.type === 'delete')
                        payload.type = 'archive';
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/sendMessage"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                chat_id: adminChatId,
                                text: "\uD83D\uDD14 *Y\u00CAU C\u1EA6U PH\u00CA DUY\u1EC6T M\u1EDAI*\n\n\u2022 Nh\u00E2n s\u1EF1: **".concat(actionMember.fullName, "**\n\u2022 Task ID: **").concat(payload.task_id, "**\n\u2022 Y\u00EAu c\u1EA7u: **").concat(reqTypeStr, "**\n\u2022 L\u00FD do: _").concat(payload.reason || 'Không có', "_") + (payload.new_deadline ? "\n\u2022 H\u1EA1n m\u1EDBi \u0111\u1EC1 xu\u1EA5t: *".concat(payload.new_deadline, "*") : ""),
                                parse_mode: "Markdown",
                                reply_markup: {
                                    inline_keyboard: [
                                        [{ text: "✅ Phê duyệt", callback_data: "approve_task:".concat(payload.task_id, ":").concat(payload.type) }],
                                        [{ text: "❌ Từ chối", callback_data: "reject_task:".concat(payload.task_id, ":").concat(payload.type) }]
                                    ]
                                }
                            })
                        })];
                case 111:
                    _j.sent();
                    _j.label = 112;
                case 112:
                    _a++;
                    return [3 /*break*/, 110];
                case 113: return [3 /*break*/, 115];
                case 114:
                    err_5 = _j.sent();
                    console.error("Lỗi gửi tin nhắn duyệt task cho admin:", err_5);
                    return [3 /*break*/, 115];
                case 115: return [3 /*break*/, 127];
                case 116:
                    if (!(action === 'approve_task_request')) return [3 /*break*/, 122];
                    return [4 /*yield*/, (0, index_1.executeMcpTool)("approve_task_request", {
                            task_id: payload.task_id,
                            type: payload.type,
                            decision: payload.decision,
                            new_deadline: payload.new_deadline
                        }, actionMember)];
                case 117:
                    result = _j.sent();
                    _j.label = 118;
                case 118:
                    _j.trys.push([118, 120, , 121]);
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/editMessageText"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                chat_id: chatId,
                                message_id: messageId,
                                text: "\u2705 *H\u1EC7 th\u1ED1ng:* ".concat(result.content[0].text),
                                parse_mode: "Markdown"
                            })
                        })];
                case 119:
                    _j.sent();
                    return [3 /*break*/, 121];
                case 120:
                    e_13 = _j.sent();
                    return [3 /*break*/, 121];
                case 121: return [3 /*break*/, 127];
                case 122:
                    if (!(action === 'get_attendance_report')) return [3 /*break*/, 127];
                    return [4 /*yield*/, (0, index_1.executeMcpTool)("get_attendance_report", {
                            employee_name: payload.employee_name,
                            month: payload.month,
                            year: payload.year
                        }, actionMember)];
                case 123:
                    result = _j.sent();
                    _j.label = 124;
                case 124:
                    _j.trys.push([124, 126, , 127]);
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/editMessageText"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                chat_id: chatId,
                                message_id: messageId,
                                text: result.content[0].text,
                                parse_mode: "Markdown"
                            })
                        })];
                case 125:
                    _j.sent();
                    return [3 /*break*/, 127];
                case 126:
                    e_14 = _j.sent();
                    return [3 /*break*/, 127];
                case 127:
                    delete telegram_agent_1.actionCache[actionId];
                    return [3 /*break*/, 131];
                case 128:
                    err_6 = _j.sent();
                    console.error("Lỗi xác nhận hành động:", err_6);
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "❌ Lỗi kết nối hệ thống khi xác nhận hành động.")];
                case 129:
                    _j.sent();
                    return [3 /*break*/, 131];
                case 130:
                    telegram_agent_1.processingActions.delete(actionId);
                    return [7 /*endfinally*/];
                case 131: return [2 /*return*/];
                case 132:
                    if (!data.startsWith("cancel_action:")) return [3 /*break*/, 137];
                    actionId = data.split(":")[1];
                    delete telegram_agent_1.actionCache[actionId];
                    _j.label = 133;
                case 133:
                    _j.trys.push([133, 135, , 136]);
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/editMessageText"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                chat_id: chatId,
                                message_id: messageId,
                                text: "\u274C Y\u00EAu c\u1EA7u h\u00E0nh \u0111\u1ED9ng \u0111\u00E3 \u0111\u01B0\u1EE3c h\u1EE7y b\u1ECF.",
                                parse_mode: "Markdown"
                            })
                        })];
                case 134:
                    _j.sent();
                    return [3 /*break*/, 136];
                case 135:
                    e_15 = _j.sent();
                    return [3 /*break*/, 136];
                case 136: return [2 /*return*/];
                case 137:
                    if (!data.startsWith("submit_leave:")) return [3 /*break*/, 156];
                    parts = data.split(":");
                    leaveType = parts[1];
                    startDate = parts[2];
                    endDate = parts[3];
                    reason = parts.slice(4).join(":");
                    _j.label = 138;
                case 138:
                    _j.trys.push([138, 154, , 155]);
                    _j.label = 139;
                case 139:
                    _j.trys.push([139, 151, , 153]);
                    return [4 /*yield*/, apiClient.post("/omnitask/hr/leave-request", {
                            telegramUsername: member.telegramUsername,
                            leaveType: leaveType,
                            startDate: startDate + "T00:00:00.000Z",
                            endDate: endDate + "T23:59:59.000Z",
                            reason: reason || "Xin nghỉ phép qua Bot Telegram"
                        })];
                case 140:
                    resJson = _j.sent();
                    if (!(resJson && resJson.data && resJson.data.id)) return [3 /*break*/, 150];
                    requestId = resJson.data.id;
                    _j.label = 141;
                case 141:
                    _j.trys.push([141, 143, , 144]);
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/editMessageText"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                chat_id: chatId,
                                message_id: messageId,
                                text: "\uD83D\uDE80 *H\u1EC7 th\u1ED1ng:* \u0110\u00E3 g\u1EEDi y\u00EAu c\u1EA7u ngh\u1EC9 ph\u00E9p c\u1EE7a b\u1EA1n th\u00E0nh c\u00F4ng! Phi\u1EBFu \u0111ang \u1EDF tr\u1EA1ng th\u00E1i *Ch\u1EDD duy\u1EC7t*.",
                                parse_mode: "Markdown"
                            })
                        })];
                case 142:
                    _j.sent();
                    return [3 /*break*/, 144];
                case 143:
                    e_16 = _j.sent();
                    return [3 /*break*/, 144];
                case 144:
                    adminEmails = ['kimngan151091@gmail.com', 'lehuyducanh.vn@gmail.com', 'zuzzivn@gmail.com'];
                    _b = 0, allMembers_2 = allMembers;
                    _j.label = 145;
                case 145:
                    if (!(_b < allMembers_2.length)) return [3 /*break*/, 150];
                    targetMem = allMembers_2[_b];
                    if (!((adminEmails.includes((targetMem.email || "").toLowerCase()) || ((_e = targetMem.telegramUsername) === null || _e === void 0 ? void 0 : _e.toLowerCase()) === 'mlq007') && targetMem.telegramChatId)) return [3 /*break*/, 149];
                    adminChatId = Number(targetMem.telegramChatId);
                    leaveTypeStr = leaveType === 'sick' ? 'Nghỉ ốm' : leaveType === 'annual' ? 'Nghỉ phép năm' : leaveType === 'remote' ? 'Đăng ký Remote' : 'Việc riêng';
                    _j.label = 146;
                case 146:
                    _j.trys.push([146, 148, , 149]);
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/sendMessage"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                chat_id: adminChatId,
                                text: "\uD83D\uDD14 *Y\u00CAU C\u1EA6U DUY\u1EC6T PH\u00C9P M\u1EDAI*\n\n\u2022 Nh\u00E2n vi\u00EAn: *".concat(member.fullName, "*\n\u2022 Lo\u1EA1i ngh\u1EC9: *").concat(leaveTypeStr, "*\n\u2022 Th\u1EDDi gian: *").concat(startDate, " \u0111\u1EBFn ").concat(endDate, "*\n\u2022 L\u00FD do: *").concat(reason || 'Không có', "*\n\n\uD83D\uDC49 Vui l\u00F2ng duy\u1EC7t ho\u1EB7c t\u1EEB ch\u1ED1i y\u00EAu c\u1EA7u n\u00E0y d\u01B0\u1EDBi \u0111\u00E2y:"),
                                parse_mode: "Markdown",
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            { text: "✅ Duyệt nghỉ", callback_data: "approve_leave:".concat(requestId) },
                                            { text: "❌ Từ chối", callback_data: "reject_leave:".concat(requestId) }
                                        ]
                                    ]
                                }
                            })
                        })];
                case 147:
                    _j.sent();
                    return [3 /*break*/, 149];
                case 148:
                    err_7 = _j.sent();
                    console.error("Lỗi gửi tin nhắn duyệt cho admin:", err_7);
                    return [3 /*break*/, 149];
                case 149:
                    _b++;
                    return [3 /*break*/, 145];
                case 150: return [3 /*break*/, 153];
                case 151:
                    err_8 = _j.sent();
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "❌ Lỗi: Cổng HR Service không thể khởi tạo phiếu nghỉ phép.")];
                case 152:
                    _j.sent();
                    throw err_8;
                case 153: return [3 /*break*/, 155];
                case 154:
                    err_9 = _j.sent();
                    console.error("Lỗi gọi API leave-request:", err_9);
                    return [3 /*break*/, 155];
                case 155: return [3 /*break*/, 167];
                case 156:
                    if (!(data.startsWith("approve_task:") || data.startsWith("reject_task:"))) return [3 /*break*/, 167];
                    parts = data.split(":");
                    action = parts[0] === "approve_task" ? "approve" : "reject";
                    taskId = parts[1];
                    reqType = parts[2] || 'archive';
                    _j.label = 157;
                case 157:
                    _j.trys.push([157, 164, , 166]);
                    _j.label = 158;
                case 158:
                    _j.trys.push([158, 161, , 163]);
                    return [4 /*yield*/, apiClient.post("/omnitask/hr/tasks/".concat(taskId, "/approve"), { type: reqType, decision: action })];
                case 159:
                    _j.sent();
                    actionStr = action === "approve" ? "Đã Phê duyệt" : "Đã Từ chối";
                    emoji = action === "approve" ? "✅" : "❌";
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/editMessageText"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                chat_id: chatId,
                                message_id: messageId,
                                text: ((_f = callbackQuery.message) === null || _f === void 0 ? void 0 : _f.text) + "\n\n".concat(emoji, " *").concat(actionStr, "*"),
                                parse_mode: "Markdown"
                            })
                        })];
                case 160:
                    _j.sent();
                    return [3 /*break*/, 163];
                case 161:
                    err_10 = _j.sent();
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "❌ Lỗi hệ thống khi duyệt task.")];
                case 162:
                    _j.sent();
                    throw err_10;
                case 163: return [3 /*break*/, 166];
                case 164:
                    err_11 = _j.sent();
                    console.error("Lỗi gọi API duyệt task:", err_11);
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "❌ Lỗi kết nối hệ thống.")];
                case 165:
                    _j.sent();
                    return [3 /*break*/, 166];
                case 166: return [2 /*return*/];
                case 167:
                    if (!(data === "cancel_leave")) return [3 /*break*/, 172];
                    _j.label = 168;
                case 168:
                    _j.trys.push([168, 170, , 171]);
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/editMessageText"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                chat_id: chatId,
                                message_id: messageId,
                                text: "\u274C Y\u00EAu c\u1EA7u xin ngh\u1EC9 ph\u00E9p \u0111\u00E3 \u0111\u01B0\u1EE3c h\u1EE7y b\u1ECF.",
                                parse_mode: "Markdown"
                            })
                        })];
                case 169:
                    _j.sent();
                    return [3 /*break*/, 171];
                case 170:
                    e_17 = _j.sent();
                    return [3 /*break*/, 171];
                case 171: return [3 /*break*/, 188];
                case 172:
                    if (!(data.startsWith("approve_leave:") || data.startsWith("reject_leave:"))) return [3 /*break*/, 188];
                    isAdmin = ['kimngan151091@gmail.com', 'lehuyducanh.vn@gmail.com', 'zuzzivn@gmail.com'].includes(member.email.toLowerCase());
                    if (!!isAdmin) return [3 /*break*/, 174];
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "⚠️ Quyền hạn không đủ! Bạn không có quyền phê duyệt đơn xin nghỉ phép này.")];
                case 173:
                    _j.sent();
                    return [2 /*return*/];
                case 174:
                    action = data.startsWith("approve_leave:") ? "approve" : "reject";
                    requestId = data.split(":")[1];
                    _j.label = 175;
                case 175:
                    _j.trys.push([175, 187, , 188]);
                    statusParam = action === "approve" ? "approved" : "rejected";
                    _j.label = 176;
                case 176:
                    _j.trys.push([176, 184, , 186]);
                    return [4 /*yield*/, apiClient.post("/hr/leave-requests/".concat(requestId, "/approve"), { status: statusParam })];
                case 177:
                    resJson = _j.sent();
                    actionStr = action === "approve" ? "Đã Phê duyệt" : "Đã Từ chối";
                    emoji = action === "approve" ? "✅" : "❌";
                    _j.label = 178;
                case 178:
                    _j.trys.push([178, 180, , 181]);
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(TELEGRAM_API, "/editMessageText"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                chat_id: chatId,
                                message_id: messageId,
                                text: "".concat((_g = callbackQuery.message) === null || _g === void 0 ? void 0 : _g.text, "\n\n").concat(emoji, " *K\u1EBET QU\u1EA2:* Admin *").concat(member.fullName, "* \u0111\u00E3 *").concat(actionStr, "* \u0111\u01A1n xin ngh\u1EC9 ph\u00E9p n\u00E0y."),
                                parse_mode: "Markdown"
                            })
                        })];
                case 179:
                    _j.sent();
                    return [3 /*break*/, 181];
                case 180:
                    e_18 = _j.sent();
                    return [3 /*break*/, 181];
                case 181:
                    leaveReq_1 = (_h = resJson === null || resJson === void 0 ? void 0 : resJson.data) === null || _h === void 0 ? void 0 : _h.leaveRequest;
                    if (!((resJson === null || resJson === void 0 ? void 0 : resJson.status) === 'success' && leaveReq_1 && leaveReq_1.memberId)) return [3 /*break*/, 183];
                    emp = allMembers.find(function (m) { return m.id === leaveReq_1.memberId; });
                    if (!(emp && emp.telegramChatId)) return [3 /*break*/, 183];
                    empChatId = Number(emp.telegramChatId);
                    startD = leaveReq_1.startDate.split('T')[0];
                    endD = leaveReq_1.endDate.split('T')[0];
                    typeStr = leaveReq_1.leaveType === 'sick' ? 'Nghỉ ốm' : leaveReq_1.leaveType === 'annual' ? 'Nghỉ phép năm' : leaveReq_1.leaveType === 'remote' ? 'Làm Remote' : 'Việc riêng';
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(empChatId, "\uD83D\uDD14 *C\u1EACP NH\u1EACT TR\u1EA0NG TH\u00C1I PH\u00C9P PH\u00C9P*\n\nY\u00EAu c\u1EA7u ".concat(typeStr, " t\u1EEB ng\u00E0y *").concat(startD, " \u0111\u1EBFn ").concat(endD, "* c\u1EE7a b\u1EA1n \u0111\u00E3 \u0111\u01B0\u1EE3c Admin *").concat(member.fullName, "* x\u1EED l\u00FD: *").concat(actionStr, "* ").concat(emoji))];
                case 182:
                    _j.sent();
                    _j.label = 183;
                case 183: return [3 /*break*/, 186];
                case 184:
                    err_12 = _j.sent();
                    return [4 /*yield*/, (0, telegram_agent_1.sendMessage)(chatId, "❌ Lỗi: Cổng HR Service phản hồi thất bại khi thực thi duyệt phép.")];
                case 185:
                    _j.sent();
                    throw err_12;
                case 186: return [3 /*break*/, 188];
                case 187:
                    err_13 = _j.sent();
                    console.error("Lỗi gọi API duyệt phép:", err_13);
                    return [3 /*break*/, 188];
                case 188: return [2 /*return*/];
            }
        });
    });
}
