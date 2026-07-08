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
exports.executeTaskTool = executeTaskTool;
var types_js_1 = require("@modelcontextprotocol/sdk/types.js");
var api_client_1 = require("@storymee/api-client");
var fetchAxios_1 = require("../../fetchAxios");
function executeTaskTool(name, args, user, isBoss, apiClient, members) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, targetName_1, tasksData, err_1, dbTasks, mySubTasks_1, outputText_1, groupedTasks_1, _b, title, assignee_1, estimate, priority, deadline, targetUser, deadlineDays, dDate, now, diffTime, diffDays, resJson, err_2, subtask, newId, actualEstimate, _c, task_id_1, status_1, tasksData, err_3, dbTasks, foundSubtask_1, assigneeName, apiStatus, err_4, _d, task_id_2, assignee_2, tasksData, err_5, dbTasks, foundSubtask_2, assigneeName, targetUser, err_6, _e, task_id_3, status_2, assignee_3, estimate, priority, deadline, tasksData, err_7, dbTasks, foundSubtask_3, assigneeName, apiStatus, assigneeId, targetMem, err_8, task_id_4, tasksData, err_9, dbTasks, foundSubtask_4, parentTask_1, assigneeName, deadlineStr, task_id_5, tasksData, err_10, dbTasks, matchedSubtask_1, assigneeEmail, portalUrl, breakdownRes, breakdownData, generatedList, createdSubtasks, subIdx, _i, generatedList_1, item, subtaskIdStr, err_11, _f, task_id_6, titles, tasksData, err_12, dbTasks, matchedSubtask_2, assigneeEmail, deletePromises_1, createdSubtasks, subIdx, _g, titles_1, title, cleanTitle, subtaskIdStr, err_13, _h, task_id_7, type, reason, new_deadline, tasksData, err_14, dbTasks, foundSubtask_5, err_15, _j, task_id_8, type, decision, new_deadline, tasksData, err_16, dbTasks, foundSubtask_6, err_17;
        var _k, _l;
        return __generator(this, function (_m) {
            switch (_m.label) {
                case 0:
                    _a = name;
                    switch (_a) {
                        case "get_my_tasks": return [3 /*break*/, 1];
                        case "create_task": return [3 /*break*/, 6];
                        case "update_task_status": return [3 /*break*/, 11];
                        case "assign_task": return [3 /*break*/, 20];
                        case "update_task": return [3 /*break*/, 29];
                        case "get_task_details": return [3 /*break*/, 38];
                        case "breakdown_task": return [3 /*break*/, 43];
                        case "update_subtasks": return [3 /*break*/, 56];
                        case "request_task_approval": return [3 /*break*/, 69];
                        case "approve_task_request": return [3 /*break*/, 78];
                    }
                    return [3 /*break*/, 87];
                case 1:
                    targetName_1 = (args === null || args === void 0 ? void 0 : args.employee_name) || user.fullName;
                    if (!isBoss && targetName_1.toLowerCase() !== user.fullName.toLowerCase()) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, "T\u1EEA CH\u1ED0I TRUY C\u1EACP: B\u1EA1n kh\u00F4ng c\u00F3 quy\u1EC1n xem danh s\u00E1ch c\u00F4ng vi\u1EC7c c\u1EE7a nh\u00E2n s\u1EF1 ".concat(targetName_1, "."));
                    }
                    tasksData = void 0;
                    _m.label = 2;
                case 2:
                    _m.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, apiClient.get(api_client_1.API_ROUTES.OMNITASK.ROOT)];
                case 3:
                    tasksData = (_m.sent());
                    return [3 /*break*/, 5];
                case 4:
                    err_1 = _m.sent();
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Lỗi fetch tasks từ Core API");
                case 5:
                    dbTasks = tasksData.data || [];
                    mySubTasks_1 = [];
                    dbTasks.forEach(function (t) {
                        if (Array.isArray(t.subTasks)) {
                            t.subTasks.forEach(function (sub) {
                                var assigneeName = sub.Assignee ? sub.Assignee.fullName : "";
                                if (assigneeName.toLowerCase() === targetName_1.toLowerCase()) {
                                    mySubTasks_1.push(sub);
                                }
                            });
                        }
                    });
                    outputText_1 = "Danh s\u00E1ch task c\u1EE7a ".concat(targetName_1, ":\n\n");
                    groupedTasks_1 = {};
                    mySubTasks_1.forEach(function (t) {
                        var pId = t.planeTaskId || t.id;
                        var parts = pId.split('-');
                        var rootId = (parts.length >= 2 && parts[0] === 'T') ? "".concat(parts[0], "-").concat(parts[1]) : pId;
                        if (!groupedTasks_1[rootId]) {
                            groupedTasks_1[rootId] = { parent: null, children: [] };
                        }
                        if (pId === rootId) {
                            groupedTasks_1[rootId].parent = t;
                        }
                        else {
                            t.cleanTitle = t.title.replace(/^\[T-\d+\]\s*/, '');
                            groupedTasks_1[rootId].children.push(t);
                        }
                    });
                    Object.keys(groupedTasks_1).forEach(function (rootId) {
                        var group = groupedTasks_1[rootId];
                        if (group.parent) {
                            var pt = group.parent;
                            var statusStr = pt.status === 'pending' ? 'Todo' : (pt.status === 'in_progress' || pt.status === 'working') ? 'In Progress' : pt.status === 'done' ? 'Done' : pt.status;
                            var dlStr = pt.deadline ? pt.deadline.split('T')[0] : 'None';
                            outputText_1 += "\uD83C\uDFAF *".concat(pt.planeTaskId || pt.id, "*: ").concat(pt.title, "  |  `").concat(statusStr, "`  \uD83D\uDCC5 ").concat(dlStr, "\n");
                        }
                        else {
                            outputText_1 += "\uD83C\uDFAF *[".concat(rootId, "]* (Task cha do ng\u01B0\u1EDDi kh\u00E1c qu\u1EA3n l\u00FD)\n");
                        }
                        group.children.forEach(function (ct) {
                            var statusStr = ct.status === 'pending' ? 'Todo' : (ct.status === 'in_progress' || ct.status === 'working') ? 'In Progress' : ct.status === 'done' ? 'Done' : ct.status;
                            var dlStr = ct.deadline ? ct.deadline.split('T')[0] : 'None';
                            outputText_1 += "   \u21B3 *".concat(ct.planeTaskId || ct.id, "*: ").concat(ct.cleanTitle, "  |  `").concat(statusStr, "`  \uD83D\uDCC5 ").concat(dlStr, "\n");
                        });
                        outputText_1 += "\n";
                    });
                    return [2 /*return*/, {
                            content: [{
                                    type: "text",
                                    text: mySubTasks_1.length > 0 ? outputText_1.trim() : "Nh\u00E2n s\u1EF1 ".concat(targetName_1, " hi\u1EC7n kh\u00F4ng c\u00F3 c\u00F4ng vi\u1EC7c n\u00E0o \u0111ang m\u1EDF.")
                                }]
                        }];
                case 6:
                    _b = args, title = _b.title, assignee_1 = _b.assignee, estimate = _b.estimate, priority = _b.priority, deadline = _b.deadline;
                    if (!isBoss && assignee_1.toLowerCase() !== user.fullName.toLowerCase()) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, "TỪ CHỐI TRUY CẬP: Bạn không có quyền tạo task và gán cho nhân sự khác.");
                    }
                    targetUser = members.find(function (m) { return m.fullName.toLowerCase() === assignee_1.toLowerCase(); });
                    if (!targetUser) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, "Kh\u00F4ng t\u00ECm th\u1EA5y nh\u00E2n s\u1EF1 ".concat(assignee_1, " trong h\u1EC7 th\u1ED1ng."));
                    }
                    deadlineDays = 7;
                    if (deadline) {
                        dDate = new Date(deadline);
                        now = new Date();
                        diffTime = dDate.getTime() - now.getTime();
                        diffDays = diffTime / (1000 * 60 * 60 * 24);
                        deadlineDays = diffDays >= 0 ? diffDays : 0;
                    }
                    resJson = void 0;
                    _m.label = 7;
                case 7:
                    _m.trys.push([7, 9, , 10]);
                    return [4 /*yield*/, apiClient.post(api_client_1.API_ROUTES.OMNITASK.ROOT, {
                            title: title,
                            description: "Tạo tự động qua Model Context Protocol (MCP)",
                            subtasks: [
                                {
                                    title: title,
                                    description: "Tạo tự động qua Model Context Protocol (MCP)",
                                    suggestedAssigneeName: targetUser.fullName,
                                    priority: priority ? priority.toLowerCase() : "medium",
                                    estimatedHours: estimate || undefined, // undefined để Core API tự động tính working hours
                                    deadlineDays: deadlineDays
                                }
                            ]
                        })];
                case 8:
                    resJson = (_m.sent());
                    return [3 /*break*/, 10];
                case 9:
                    err_2 = _m.sent();
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Lỗi tạo task tại Core API Service.");
                case 10:
                    subtask = (_l = (_k = resJson.data) === null || _k === void 0 ? void 0 : _k.subtasks) === null || _l === void 0 ? void 0 : _l[0];
                    newId = (subtask === null || subtask === void 0 ? void 0 : subtask.planeTaskId) || (subtask === null || subtask === void 0 ? void 0 : subtask.id) || "N/A";
                    actualEstimate = (subtask === null || subtask === void 0 ? void 0 : subtask.estimatedHours) || estimate || 4;
                    return [2 /*return*/, {
                            content: [{
                                    type: "text",
                                    text: "\u0110\u00E3 t\u1EA1o c\u00F4ng vi\u1EC7c th\u00E0nh c\u00F4ng! \u2713\n\u2022 **ID**: ".concat(newId, "\n\u2022 **Ti\u00EAu \u0111\u1EC1**: ").concat(title, "\n\u2022 **Ng\u01B0\u1EDDi th\u1EF1c hi\u1EC7n**: ").concat(targetUser.fullName, "\n\u2022 **\u01AF\u1EDBc t\u00EDnh**: ").concat(actualEstimate, "h\n\u2022 **H\u1EA1n ch\u00F3t**: ").concat(deadline ? deadline.split('T')[0] : '7 ngày')
                                }]
                        }];
                case 11:
                    _c = args, task_id_1 = _c.task_id, status_1 = _c.status;
                    tasksData = void 0;
                    _m.label = 12;
                case 12:
                    _m.trys.push([12, 14, , 15]);
                    return [4 /*yield*/, apiClient.get(api_client_1.API_ROUTES.OMNITASK.ROOT)];
                case 13:
                    tasksData = (_m.sent());
                    return [3 /*break*/, 15];
                case 14:
                    err_3 = _m.sent();
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Lỗi fetch tasks từ Core API");
                case 15:
                    dbTasks = tasksData.data || [];
                    foundSubtask_1 = null;
                    dbTasks.forEach(function (t) {
                        if (Array.isArray(t.subTasks)) {
                            t.subTasks.forEach(function (sub) {
                                if (sub.id.toLowerCase() === task_id_1.toLowerCase() || (sub.planeTaskId && sub.planeTaskId.toLowerCase() === task_id_1.toLowerCase())) {
                                    foundSubtask_1 = sub;
                                }
                            });
                        }
                    });
                    if (!foundSubtask_1) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, "Kh\u00F4ng t\u00ECm th\u1EA5y c\u00F4ng vi\u1EC7c m\u00E3 ID ".concat(task_id_1, "."));
                    }
                    assigneeName = foundSubtask_1.Assignee ? foundSubtask_1.Assignee.fullName : "";
                    if (!isBoss && assigneeName.toLowerCase() !== user.fullName.toLowerCase()) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, "T\u1EEA CH\u1ED0I TRUY C\u1EACP: B\u1EA1n kh\u00F4ng c\u00F3 quy\u1EC1n c\u1EADp nh\u1EADt tr\u1EA1ng th\u00E1i c\u1EE7a task ".concat(task_id_1, " do ng\u01B0\u1EDDi kh\u00E1c n\u1EAFm gi\u1EEF."));
                    }
                    apiStatus = status_1 === 'Todo' ? 'pending' : status_1 === 'In Progress' ? 'working' : 'done';
                    _m.label = 16;
                case 16:
                    _m.trys.push([16, 18, , 19]);
                    return [4 /*yield*/, apiClient.patch("".concat(api_client_1.API_ROUTES.HR.SUBTASKS, "/").concat(foundSubtask_1.id), { status: apiStatus })];
                case 17:
                    _m.sent();
                    return [3 /*break*/, 19];
                case 18:
                    err_4 = _m.sent();
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Lỗi cập nhật trạng thái task tại Core API.");
                case 19: return [2 /*return*/, {
                        content: [{
                                type: "text",
                                text: "C\u1EADp nh\u1EADt tr\u1EA1ng th\u00E1i th\u00E0nh c\u00F4ng! \u2713\n\u2022 **Task**: ".concat(task_id_1, " (").concat(foundSubtask_1.title, ")\n\u2022 **Tr\u1EA1ng th\u00E1i**: ").concat(foundSubtask_1.status, " \u2794 ").concat(status_1)
                            }]
                    }];
                case 20:
                    _d = args, task_id_2 = _d.task_id, assignee_2 = _d.assignee;
                    tasksData = void 0;
                    _m.label = 21;
                case 21:
                    _m.trys.push([21, 23, , 24]);
                    return [4 /*yield*/, apiClient.get(api_client_1.API_ROUTES.OMNITASK.ROOT)];
                case 22:
                    tasksData = (_m.sent());
                    return [3 /*break*/, 24];
                case 23:
                    err_5 = _m.sent();
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Lỗi fetch tasks từ Core API");
                case 24:
                    dbTasks = tasksData.data || [];
                    foundSubtask_2 = null;
                    dbTasks.forEach(function (t) {
                        if (Array.isArray(t.subTasks)) {
                            t.subTasks.forEach(function (sub) {
                                if (sub.id.toLowerCase() === task_id_2.toLowerCase() || (sub.planeTaskId && sub.planeTaskId.toLowerCase() === task_id_2.toLowerCase())) {
                                    foundSubtask_2 = sub;
                                }
                            });
                        }
                    });
                    if (!foundSubtask_2) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, "Kh\u00F4ng t\u00ECm th\u1EA5y c\u00F4ng vi\u1EC7c m\u00E3 ID ".concat(task_id_2, "."));
                    }
                    assigneeName = foundSubtask_2.Assignee ? foundSubtask_2.Assignee.fullName : "";
                    if (!isBoss && assigneeName.toLowerCase() !== user.fullName.toLowerCase()) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, "T\u1EEA CH\u1ED0I TRUY C\u1EACP: B\u1EA1n kh\u00F4ng \u0111\u01B0\u1EE3c ph\u00E9p b\u00E0n giao c\u00F4ng vi\u1EC7c ".concat(task_id_2, " c\u1EE7a ng\u01B0\u1EDDi kh\u00E1c."));
                    }
                    targetUser = members.find(function (m) { return m.fullName.toLowerCase() === assignee_2.toLowerCase(); });
                    if (!targetUser) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, "Kh\u00F4ng t\u00ECm th\u1EA5y nh\u00E2n s\u1EF1 ".concat(assignee_2, " \u0111\u1EC3 b\u00E0n giao."));
                    }
                    _m.label = 25;
                case 25:
                    _m.trys.push([25, 27, , 28]);
                    return [4 /*yield*/, apiClient.patch("".concat(api_client_1.API_ROUTES.HR.SUBTASKS, "/").concat(foundSubtask_2.id), { assigneeId: targetUser.id })];
                case 26:
                    _m.sent();
                    return [3 /*break*/, 28];
                case 27:
                    err_6 = _m.sent();
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Lỗi bàn giao công việc tại Core API.");
                case 28: return [2 /*return*/, {
                        content: [{
                                type: "text",
                                text: "B\u00E0n giao c\u00F4ng vi\u1EC7c th\u00E0nh c\u00F4ng! \u2713\n\u2022 **Task**: ".concat(task_id_2, " (").concat(foundSubtask_2.title, ")\n\u2022 **Ng\u01B0\u1EDDi ph\u1EE5 tr\u00E1ch**: ").concat(assigneeName || 'Chưa có', " \u2794 ").concat(targetUser.fullName)
                            }]
                    }];
                case 29:
                    _e = args, task_id_3 = _e.task_id, status_2 = _e.status, assignee_3 = _e.assignee, estimate = _e.estimate, priority = _e.priority, deadline = _e.deadline;
                    tasksData = void 0;
                    _m.label = 30;
                case 30:
                    _m.trys.push([30, 32, , 33]);
                    return [4 /*yield*/, apiClient.get(api_client_1.API_ROUTES.OMNITASK.ROOT)];
                case 31:
                    tasksData = (_m.sent());
                    return [3 /*break*/, 33];
                case 32:
                    err_7 = _m.sent();
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Lỗi fetch tasks từ Core API");
                case 33:
                    dbTasks = tasksData.data || [];
                    foundSubtask_3 = null;
                    dbTasks.forEach(function (t) {
                        if (Array.isArray(t.subTasks)) {
                            t.subTasks.forEach(function (sub) {
                                if (sub.id.toLowerCase() === task_id_3.toLowerCase() || (sub.planeTaskId && sub.planeTaskId.toLowerCase() === task_id_3.toLowerCase())) {
                                    foundSubtask_3 = sub;
                                }
                            });
                        }
                    });
                    if (!foundSubtask_3) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, "Kh\u00F4ng t\u00ECm th\u1EA5y c\u00F4ng vi\u1EC7c m\u00E3 ID ".concat(task_id_3, "."));
                    }
                    assigneeName = foundSubtask_3.Assignee ? foundSubtask_3.Assignee.fullName : "";
                    if (!isBoss && assigneeName.toLowerCase() !== user.fullName.toLowerCase()) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, "T\u1EEA CH\u1ED0I TRUY C\u1EACP: B\u1EA1n kh\u00F4ng \u0111\u01B0\u1EE3c ph\u00E9p c\u1EADp nh\u1EADt c\u00F4ng vi\u1EC7c ".concat(task_id_3, " c\u1EE7a ng\u01B0\u1EDDi kh\u00E1c."));
                    }
                    apiStatus = undefined;
                    if (status_2) {
                        apiStatus = (status_2 === 'Todo' || status_2 === 'pending') ? 'pending' : (status_2 === 'In Progress' || status_2 === 'in_progress' || status_2 === 'working') ? 'in_progress' : 'done';
                    }
                    assigneeId = undefined;
                    if (assignee_3) {
                        targetMem = members.find(function (m) { return m.fullName.toLowerCase().includes(assignee_3.toLowerCase()); });
                        if (targetMem)
                            assigneeId = targetMem.id;
                    }
                    _m.label = 34;
                case 34:
                    _m.trys.push([34, 36, , 37]);
                    return [4 /*yield*/, apiClient.patch("".concat(api_client_1.API_ROUTES.HR.SUBTASKS, "/").concat(foundSubtask_3.id), {
                            status: apiStatus,
                            assigneeId: assigneeId,
                            priority: priority ? priority.toLowerCase() : undefined,
                            deadline: deadline || undefined,
                            estimatedHours: estimate || undefined
                        })];
                case 35:
                    _m.sent();
                    return [3 /*break*/, 37];
                case 36:
                    err_8 = _m.sent();
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Lỗi cập nhật task tại Core API.");
                case 37: return [2 /*return*/, {
                        content: [{
                                type: "text",
                                text: "C\u1EADp nh\u1EADt c\u00F4ng vi\u1EC7c ".concat(task_id_3, " th\u00E0nh c\u00F4ng! \u2713")
                            }]
                    }];
                case 38:
                    task_id_4 = args.task_id;
                    tasksData = void 0;
                    _m.label = 39;
                case 39:
                    _m.trys.push([39, 41, , 42]);
                    return [4 /*yield*/, apiClient.get(api_client_1.API_ROUTES.OMNITASK.ROOT)];
                case 40:
                    tasksData = (_m.sent());
                    return [3 /*break*/, 42];
                case 41:
                    err_9 = _m.sent();
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Lỗi fetch tasks từ Core API");
                case 42:
                    dbTasks = tasksData.data || [];
                    foundSubtask_4 = null;
                    parentTask_1 = null;
                    dbTasks.forEach(function (t) {
                        if (Array.isArray(t.subTasks)) {
                            t.subTasks.forEach(function (sub) {
                                if (sub.id.toLowerCase() === task_id_4.toLowerCase() || (sub.planeTaskId && sub.planeTaskId.toLowerCase() === task_id_4.toLowerCase())) {
                                    foundSubtask_4 = sub;
                                    parentTask_1 = t;
                                }
                            });
                        }
                    });
                    if (!foundSubtask_4) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, "Kh\u00F4ng t\u00ECm th\u1EA5y c\u00F4ng vi\u1EC7c m\u00E3 ID ".concat(task_id_4, "."));
                    }
                    assigneeName = foundSubtask_4.Assignee ? foundSubtask_4.Assignee.fullName : "Chưa phân công";
                    deadlineStr = foundSubtask_4.deadline ? foundSubtask_4.deadline.split('T')[0] : "Chưa đặt";
                    return [2 /*return*/, {
                            content: [{
                                    type: "text",
                                    text: "\uD83D\uDCC4 **CHI TI\u1EBET C\u00D4NG VI\u1EC6C ".concat(task_id_4.toUpperCase(), ":**\n\n") +
                                        "\u2022 **Ti\u00EAu \u0111\u1EC1**: ".concat(foundSubtask_4.title, "\n") +
                                        "\u2022 **M\u00F4 t\u1EA3**: ".concat(foundSubtask_4.description || "Không có mô tả", "\n") +
                                        "\u2022 **D\u1EF1 \u00E1n**: ".concat(parentTask_1 ? parentTask_1.title : "N/A", "\n") +
                                        "\u2022 **Ng\u01B0\u1EDDi ph\u1EE5 tr\u00E1ch**: ".concat(assigneeName, "\n") +
                                        "\u2022 **Tr\u1EA1ng th\u00E1i**: ".concat(foundSubtask_4.status === 'pending' ? 'Todo' : foundSubtask_4.status === 'working' ? 'In Progress' : 'Done', " (").concat(foundSubtask_4.status, ")\n") +
                                        "\u2022 **\u0110\u1ED9 \u01B0u ti\u00EAn**: ".concat(foundSubtask_4.priority.charAt(0).toUpperCase() + foundSubtask_4.priority.slice(1), "\n") +
                                        "\u2022 **H\u1EA1n ch\u00F3t**: ".concat(deadlineStr, "\n") +
                                        "\u2022 **Th\u1EDDi gian \u01B0\u1EDBc t\u00EDnh**: ".concat(foundSubtask_4.estimatedHours || 0, " gi\u1EDD\n") +
                                        "\u2022 **G\u1EE3i \u00FD \u0111\u1EA7u ra (Deliverables)**: ".concat(foundSubtask_4.outputSuggested || "Không có")
                                }]
                        }];
                case 43:
                    task_id_5 = args.task_id;
                    tasksData = void 0;
                    _m.label = 44;
                case 44:
                    _m.trys.push([44, 46, , 47]);
                    return [4 /*yield*/, apiClient.get(api_client_1.API_ROUTES.OMNITASK.ROOT)];
                case 45:
                    tasksData = (_m.sent());
                    return [3 /*break*/, 47];
                case 46:
                    err_10 = _m.sent();
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Lỗi fetch tasks từ Core API");
                case 47:
                    dbTasks = tasksData.data || [];
                    matchedSubtask_1 = null;
                    dbTasks.forEach(function (t) {
                        if (Array.isArray(t.subTasks)) {
                            t.subTasks.forEach(function (sub) {
                                if (sub.planeTaskId === task_id_5 || sub.id === task_id_5) {
                                    matchedSubtask_1 = __assign(__assign({}, sub), { projectId: t.id });
                                }
                            });
                        }
                    });
                    if (!matchedSubtask_1) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, "Kh\u00F4ng t\u00ECm th\u1EA5y c\u00F4ng vi\u1EC7c v\u1EDBi m\u00E3 ID ".concat(task_id_5, "."));
                    }
                    assigneeEmail = matchedSubtask_1.Assignee ? matchedSubtask_1.Assignee.email : "";
                    if (!isBoss && assigneeEmail.toLowerCase() !== user.email.toLowerCase()) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, "T\u1EEA CH\u1ED0I TRUY C\u1EACP: B\u1EA1n kh\u00F4ng c\u00F3 quy\u1EC1n ph\u00E2n r\u00E3 c\u00F4ng vi\u1EC7c c\u1EE7a ".concat(matchedSubtask_1.Assignee ? matchedSubtask_1.Assignee.fullName : "người khác", "."));
                    }
                    portalUrl = process.env.WEB_PORTAL_URL || "https://storymee-team.vercel.app";
                    return [4 /*yield*/, (0, fetchAxios_1.fetchAxios)("".concat(portalUrl, "/api/ai/breakdown"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: {
                                title: matchedSubtask_1.title,
                                description: matchedSubtask_1.description || ""
                            }
                        })];
                case 48:
                    breakdownRes = _m.sent();
                    if (!breakdownRes.ok) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Lỗi gọi AI phân rã công việc qua Vercel API.");
                    }
                    return [4 /*yield*/, breakdownRes.json()];
                case 49:
                    breakdownData = _m.sent();
                    generatedList = breakdownData.subtasks || [];
                    if (!Array.isArray(generatedList) || generatedList.length === 0) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "AI không trả về danh sách công việc con nào.");
                    }
                    createdSubtasks = [];
                    subIdx = 1;
                    _i = 0, generatedList_1 = generatedList;
                    _m.label = 50;
                case 50:
                    if (!(_i < generatedList_1.length)) return [3 /*break*/, 55];
                    item = generatedList_1[_i];
                    subtaskIdStr = "".concat(task_id_5, "-").concat(String(subIdx).padStart(2, '0'));
                    subIdx++;
                    _m.label = 51;
                case 51:
                    _m.trys.push([51, 53, , 54]);
                    return [4 /*yield*/, apiClient.post("/hr/subtasks", {
                            title: "[".concat(task_id_5, "] ").concat(item.title),
                            estimatedHours: 2, // Mặc định 2 giờ mỗi subtask
                            priority: matchedSubtask_1.priority || "medium",
                            assigneeId: matchedSubtask_1.assigneeId,
                            parentTaskId: matchedSubtask_1.projectId,
                            status: "pending",
                            planeTaskId: subtaskIdStr
                        })];
                case 52:
                    _m.sent();
                    return [3 /*break*/, 54];
                case 53:
                    err_11 = _m.sent();
                    throw err_11;
                case 54:
                    _i++;
                    return [3 /*break*/, 50];
                case 55: return [2 /*return*/, {
                        content: [{
                                type: "text",
                                text: "\uD83C\uDF31 *\u0110\u00C3 PH\u00C2N R\u00C3 C\u00D4NG VI\u1EC6C ".concat(task_id_5, " TH\u00C0NH C\u00D4NG:*\n") +
                                    "C\u00F4ng vi\u1EC7c g\u1ED1c: *".concat(matchedSubtask_1.title, "*\n") +
                                    "\u0110\u00E3 t\u1EA1o th\u00EAm ".concat(createdSubtasks.length, " c\u00F4ng vi\u1EC7c con t\u1EF1 \u0111\u1ED9ng l\u01B0u v\u00E0o DB:\n") +
                                    createdSubtasks.join("\n")
                            }]
                    }];
                case 56:
                    _f = args, task_id_6 = _f.task_id, titles = _f.titles;
                    if (!Array.isArray(titles)) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, "Danh sách tiêu đề công việc con phải là một mảng.");
                    }
                    tasksData = void 0;
                    _m.label = 57;
                case 57:
                    _m.trys.push([57, 59, , 60]);
                    return [4 /*yield*/, apiClient.get(api_client_1.API_ROUTES.OMNITASK.ROOT)];
                case 58:
                    tasksData = (_m.sent());
                    return [3 /*break*/, 60];
                case 59:
                    err_12 = _m.sent();
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Lỗi fetch tasks từ Core API");
                case 60:
                    dbTasks = tasksData.data || [];
                    matchedSubtask_2 = null;
                    dbTasks.forEach(function (t) {
                        if (Array.isArray(t.subTasks)) {
                            t.subTasks.forEach(function (sub) {
                                if (sub.planeTaskId === task_id_6 || sub.id === task_id_6) {
                                    matchedSubtask_2 = __assign(__assign({}, sub), { projectId: t.id });
                                }
                            });
                        }
                    });
                    if (!matchedSubtask_2) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, "Kh\u00F4ng t\u00ECm th\u1EA5y c\u00F4ng vi\u1EC7c v\u1EDBi m\u00E3 ID ".concat(task_id_6, "."));
                    }
                    assigneeEmail = matchedSubtask_2.Assignee ? matchedSubtask_2.Assignee.email : "";
                    if (!isBoss && assigneeEmail.toLowerCase() !== user.email.toLowerCase()) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, "T\u1EEA CH\u1ED0I TRUY C\u1EACP: B\u1EA1n kh\u00F4ng c\u00F3 quy\u1EC1n s\u1EEDa \u0111\u1ED5i c\u00F4ng vi\u1EC7c c\u1EE7a ".concat(matchedSubtask_2.Assignee ? matchedSubtask_2.Assignee.fullName : "người khác", "."));
                    }
                    deletePromises_1 = [];
                    dbTasks.forEach(function (t) {
                        if (t.id === matchedSubtask_2.projectId && Array.isArray(t.subTasks)) {
                            t.subTasks.forEach(function (sub) {
                                if (sub.title && sub.title.startsWith("[".concat(task_id_6, "]"))) {
                                    deletePromises_1.push(apiClient.delete("".concat(api_client_1.API_ROUTES.HR.SUBTASKS, "/").concat(sub.id)));
                                }
                            });
                        }
                    });
                    if (!(deletePromises_1.length > 0)) return [3 /*break*/, 62];
                    return [4 /*yield*/, Promise.all(deletePromises_1)];
                case 61:
                    _m.sent();
                    _m.label = 62;
                case 62:
                    createdSubtasks = [];
                    subIdx = 1;
                    _g = 0, titles_1 = titles;
                    _m.label = 63;
                case 63:
                    if (!(_g < titles_1.length)) return [3 /*break*/, 68];
                    title = titles_1[_g];
                    cleanTitle = title.replace(/^-\s*/, '').replace(/^\d+\.\s*/, '').trim();
                    if (!cleanTitle)
                        return [3 /*break*/, 67];
                    subtaskIdStr = "".concat(task_id_6, "-").concat(String(subIdx).padStart(2, '0'));
                    subIdx++;
                    _m.label = 64;
                case 64:
                    _m.trys.push([64, 66, , 67]);
                    return [4 /*yield*/, apiClient.post("/hr/subtasks", {
                            title: "[".concat(task_id_6, "] ").concat(cleanTitle),
                            estimatedHours: 2,
                            priority: matchedSubtask_2.priority || "medium",
                            assigneeId: matchedSubtask_2.assigneeId,
                            parentTaskId: matchedSubtask_2.projectId,
                            status: "pending",
                            planeTaskId: subtaskIdStr
                        })];
                case 65:
                    _m.sent();
                    return [3 /*break*/, 67];
                case 66:
                    err_13 = _m.sent();
                    throw err_13;
                case 67:
                    _g++;
                    return [3 /*break*/, 63];
                case 68: return [2 /*return*/, {
                        content: [{
                                type: "text",
                                text: titles.length === 0
                                    ? "\uD83D\uDCDD *\u0110\u00C3 X\u00D3A TO\u00C0N B\u1ED8 C\u00D4NG VI\u1EC6C CON CHO ".concat(task_id_6, " TH\u00C0NH C\u00D4NG:*\n") +
                                        "C\u00F4ng vi\u1EC7c g\u1ED1c: *".concat(matchedSubtask_2.title, "*\n") +
                                        "\u0110\u00E3 d\u1ECDn d\u1EB9p s\u1EA1ch to\u00E0n b\u1ED9 subtask c\u0169 c\u1EE7a c\u00F4ng vi\u1EC7c n\u00E0y."
                                    : "\uD83D\uDCDD *\u0110\u00C3 C\u1EACP NH\u1EACT C\u00C1C C\u00D4NG VI\u1EC6C CON CHO ".concat(task_id_6, " TH\u00C0NH C\u00D4NG:*\n") +
                                        "C\u00F4ng vi\u1EC7c g\u1ED1c: *".concat(matchedSubtask_2.title, "*\n") +
                                        "\u0110\u00E3 x\u00F3a vi\u1EC7c c\u0169 v\u00E0 t\u1EA1o m\u1EDBi ".concat(createdSubtasks.length, " vi\u1EC7c con:\n") +
                                        createdSubtasks.join("\n")
                            }]
                    }];
                case 69:
                    _h = args, task_id_7 = _h.task_id, type = _h.type, reason = _h.reason, new_deadline = _h.new_deadline;
                    tasksData = void 0;
                    _m.label = 70;
                case 70:
                    _m.trys.push([70, 72, , 73]);
                    return [4 /*yield*/, apiClient.get(api_client_1.API_ROUTES.OMNITASK.ROOT)];
                case 71:
                    tasksData = (_m.sent());
                    return [3 /*break*/, 73];
                case 72:
                    err_14 = _m.sent();
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Lỗi fetch tasks từ Core API");
                case 73:
                    dbTasks = tasksData.data || [];
                    foundSubtask_5 = null;
                    dbTasks.forEach(function (t) {
                        if (Array.isArray(t.subTasks)) {
                            t.subTasks.forEach(function (sub) {
                                if (sub.id.toLowerCase() === task_id_7.toLowerCase() || (sub.planeTaskId && sub.planeTaskId.toLowerCase() === task_id_7.toLowerCase())) {
                                    foundSubtask_5 = sub;
                                }
                            });
                        }
                    });
                    if (!foundSubtask_5) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, "Kh\u00F4ng t\u00ECm th\u1EA5y c\u00F4ng vi\u1EC7c m\u00E3 ID ".concat(task_id_7, "."));
                    }
                    _m.label = 74;
                case 74:
                    _m.trys.push([74, 76, , 77]);
                    return [4 /*yield*/, apiClient.post("/omnitask/hr/tasks/".concat(foundSubtask_5.id, "/request"), { type: type, reason: reason, newDeadline: new_deadline })];
                case 75:
                    _m.sent();
                    return [3 /*break*/, 77];
                case 76:
                    err_15 = _m.sent();
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Lỗi khi gọi API xin duyệt.");
                case 77: return [2 /*return*/, {
                        content: [{
                                type: "text",
                                text: "\u0110\u00E3 g\u1EEDi y\u00EAu c\u1EA7u ".concat(type === 'extend' ? 'dời deadline' : 'xoá/lưu trữ', " cho task ").concat(task_id_7, " th\u00E0nh c\u00F4ng! H\u00E3y \u0111\u1EE3i Admin duy\u1EC7t nh\u00E9.")
                            }]
                    }];
                case 78:
                    _j = args, task_id_8 = _j.task_id, type = _j.type, decision = _j.decision, new_deadline = _j.new_deadline;
                    if (!isBoss) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, "TỪ CHỐI TRUY CẬP: Chỉ Admin/Boss mới có quyền duyệt yêu cầu task.");
                    }
                    tasksData = void 0;
                    _m.label = 79;
                case 79:
                    _m.trys.push([79, 81, , 82]);
                    return [4 /*yield*/, apiClient.get(api_client_1.API_ROUTES.OMNITASK.ROOT)];
                case 80:
                    tasksData = (_m.sent());
                    return [3 /*break*/, 82];
                case 81:
                    err_16 = _m.sent();
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Lỗi fetch tasks từ Core API");
                case 82:
                    dbTasks = tasksData.data || [];
                    foundSubtask_6 = null;
                    dbTasks.forEach(function (t) {
                        if (Array.isArray(t.subTasks)) {
                            t.subTasks.forEach(function (sub) {
                                if (sub.id.toLowerCase() === task_id_8.toLowerCase() || (sub.planeTaskId && sub.planeTaskId.toLowerCase() === task_id_8.toLowerCase())) {
                                    foundSubtask_6 = sub;
                                }
                            });
                        }
                    });
                    if (!foundSubtask_6) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, "Kh\u00F4ng t\u00ECm th\u1EA5y c\u00F4ng vi\u1EC7c m\u00E3 ID ".concat(task_id_8, "."));
                    }
                    _m.label = 83;
                case 83:
                    _m.trys.push([83, 85, , 86]);
                    return [4 /*yield*/, apiClient.post("/omnitask/hr/tasks/".concat(foundSubtask_6.id, "/approve"), { type: type, decision: decision, newDeadline: new_deadline })];
                case 84:
                    _m.sent();
                    return [3 /*break*/, 86];
                case 85:
                    err_17 = _m.sent();
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Lỗi khi gọi API duyệt yêu cầu.");
                case 86: return [2 /*return*/, {
                        content: [{
                                type: "text",
                                text: "\u0110\u00E3 ".concat(decision === 'approve' ? 'DUYỆT' : 'TỪ CHỐI', " y\u00EAu c\u1EA7u ").concat(type, " cho task ").concat(task_id_8, " th\u00E0nh c\u00F4ng!")
                            }]
                    }];
                case 87: throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, "C\u00F4ng c\u1EE5 task ".concat(name, " ch\u01B0a \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3"));
            }
        });
    });
}
