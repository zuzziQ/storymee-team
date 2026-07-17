import cron from "node-cron";
import { CoreApiClient, API_ROUTES } from "@storymee/api-client";
import {
  parseIssue,
  isDoneGroup,
  formatIssueBlock,
  formatGroupMorningReport,
  formatGroupEveningReport,
  type TeamReportData,
} from "./telegram/formatters/issueFormatter";

/** Xây dựng cấu trúc cây cha-con từ flat array của Plane API */
function buildHierarchy(rawTasks: any[]): any[] {
  const parentMap = new Map<string, any>();
  const topLevelIssues: any[] = [];

  rawTasks.forEach((t: any) => {
    t.subIssues = [];
    parentMap.set(t.id, t);
  });

  rawTasks.forEach((t: any) => {
    if (t.parentId && parentMap.has(t.parentId)) {
      parentMap.get(t.parentId).subIssues.push(t);
    } else {
      topLevelIssues.push(t);
    }
  });

  return topLevelIssues;
}

/** Ngày hôm nay theo Asia/Ho_Chi_Minh (YYYY-MM-DD) */
function todayVnStr(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().substring(0, 10);
}

/** Lấy lịch họp trong ngày hôm nay (VN) */
async function fetchTodayMeetings(apiClient: CoreApiClient): Promise<any[]> {
  try {
    const res = (await apiClient.get("/hr/meetings")) as any;
    const meetings: any[] = res?.data || [];
    const todayStr = todayVnStr();
    return meetings
      .filter((m: any) => {
        if ((m.status || "").toLowerCase() === "cancelled") return false;
        const start = new Date(m.startTime || m.start_time || m.createdAt);
        // Compare calendar day in VN
        const startVn = new Date(start.getTime() + 7 * 3600 * 1000)
          .toISOString()
          .substring(0, 10);
        return startVn === todayStr;
      })
      .sort((a: any, b: any) => {
        return (
          new Date(a.startTime || a.start_time).getTime() -
          new Date(b.startTime || b.start_time).getTime()
        );
      });
  } catch {
    return [];
  }
}

/** Format block lịch họp cho báo cáo */
function formatMeetingBlock(m: any): string {
  const start = new Date(m.startTime || m.start_time);
  const timeStr = start.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
  const title = m.title || "Cuộc họp";
  const host = m.host?.fullName || m.hostName || "";
  const location = m.location ? ` 📍 ${m.location}` : "";
  const hostStr = host ? ` (Host: ${host})` : "";
  return `📅 *${timeStr}* — ${title}${hostStr}${location}\n`;
}

function isActiveMember(m: any): boolean {
  const st = (m.accountStatus || "active").toLowerCase();
  return st === "active" && m.isActive !== false && !!m.telegramChatId;
}

/** Fetch tất cả data cần thiết */
async function fetchAllData(apiClient: CoreApiClient) {
  const [membersRes, tasksRes, attendanceRes] = await Promise.all([
    apiClient.get(API_ROUTES.HR.TEAM_MEMBERS) as Promise<any>,
    apiClient.get(API_ROUTES.PLANE.ISSUES) as Promise<any>,
    apiClient.get(API_ROUTES.HR.ATTENDANCE) as Promise<any>,
  ]);

  const members: any[] = (membersRes?.data || []).filter(isActiveMember);
  const rawTasks: any[] = tasksRes?.data || [];
  const attendance: any[] = attendanceRes?.data || [];
  const allIssues = buildHierarchy(rawTasks);
  const todayStr = todayVnStr();

  return { members, rawTasks, allIssues, attendance, todayStr };
}

/**
 * Cron SSOT (Asia/Ho_Chi_Minh):
 *  - 08:20 Mon–Sat → DM cá nhân + nút Check-in (giữ báo cáo khi bấm)
 *  - 18:05 Mon–Sat → DM cá nhân + nút Check-out + nhóm tổng kết
 *  - mỗi phút → nhắc họp 30' và 15' trước
 *
 * Env:
 *  TELEGRAM_GROUP_ID — group chat id
 *  CRON_MORNING=20 8 * * 1-6 (optional override)
 *  CRON_EVENING=5 18 * * 1-6
 *  CRON_MEETING_REMIND=* * * * *
 */
export function startCronJobs(
  apiClient: CoreApiClient,
  sendMessage: (chatId: number, text: string, replyMarkup?: any) => Promise<void>
) {
  console.log("🕒 Khởi động hệ thống Report tự động (Cron Jobs v3)...");

  const GROUP_ID = process.env.TELEGRAM_GROUP_ID
    ? Number(process.env.TELEGRAM_GROUP_ID)
    : null;

  const CRON_MORNING = process.env.CRON_MORNING || "20 8 * * 1-6";
  const CRON_EVENING = process.env.CRON_EVENING || "5 18 * * 1-6";
  const CRON_MEETING = process.env.CRON_MEETING_REMIND || "* * * * *";
  const TZ = "Asia/Ho_Chi_Minh";

  // ─── 08:20 DM morning ───────────────────────────────────────
  cron.schedule(
    CRON_MORNING,
    async () => {
      try {
        console.log("[Cron 8h20 DM] Đang gửi nhắc đầu ngày...");
        const { members, allIssues, todayStr } = await fetchAllData(apiClient);
        const todayMeetings = await fetchTodayMeetings(apiClient);
        console.log(
          `[Cron 8h20 DM] ${members.length} active members, ${allIssues.length} issues, ${todayMeetings.length} meetings`
        );

        // Optional group summary at same window (no separate 9:00 hardcode)
        if (GROUP_ID) {
          try {
            let gMsg = "";
            if (todayMeetings.length > 0) {
              gMsg += `📆 *LỊCH HỌP HÔM NAY (${todayMeetings.length}):*\n`;
              todayMeetings.forEach((m: any) => {
                gMsg += formatMeetingBlock(m);
              });
              gMsg += "\n";
            }
            gMsg += formatGroupMorningReport({
              members,
              allIssues,
              attendance: [],
              todayStr,
            } as TeamReportData);
            await sendMessage(GROUP_ID, gMsg);
          } catch (e) {
            console.error("[Cron 8h20 Nhóm] Lỗi:", e);
          }
        }

        for (const m of members) {
          const chatId = Number(m.telegramChatId);
          const myIssues = allIssues.filter((t: any) => {
            const isAssigned = t.assigneeId === m.id;
            const hasAssignedSub = (t.subIssues || []).some(
              (sub: any) => sub.assigneeId === m.id
            );
            return isAssigned || hasAssignedSub;
          });
          const activeIssues = myIssues.filter(
            (t: any) => !isDoneGroup(t.State?.group || "unstarted")
          );

          if (activeIssues.length === 0) {
            await sendMessage(
              chatId,
              `☀️ *BÁO CÁO ĐẦU NGÀY (8h20)*\n\nChào *${m.fullName}*! Hôm nay bạn không có công việc nào đang mở. Chúc một ngày mới tràn đầy năng lượng! 🎉`,
              {
                inline_keyboard: [
                  [
                    {
                      text:
                        String(m.workArrangement || "").toLowerCase() === "remote"
                          ? "🏠 Vào ca Remote"
                          : "🌅 Vào ca (Check-in)",
                      callback_data:
                        String(m.workArrangement || "").toLowerCase() === "remote"
                          ? "attendance_direct:present:remote"
                          : "attendance_direct:present",
                    },
                  ],
                ],
              }
            );
            continue;
          }

          const parsed = activeIssues.map((i: any) => parseIssue(i, members));
          const overdue = parsed.filter((f) => f.isOverdue);
          const dueToday = parsed.filter((f) => f.isDueToday);
          const inProgress = parsed.filter(
            (f) => !f.isOverdue && !f.isDueToday && f.stateGroup === "started"
          );
          const others = parsed.filter(
            (f) => !f.isOverdue && !f.isDueToday && f.stateGroup !== "started"
          );

          let msg = `☀️ *BÁO CÁO ĐẦU NGÀY (8h20)*\n`;
          msg += `Chào *${m.fullName}*! Dưới đây là công việc cần tập trung hôm nay:\n\n`;

          if (todayMeetings.length > 0) {
            msg += `📆 *LỊCH HỌP HÔM NAY (${todayMeetings.length} cuộc):*\n`;
            todayMeetings.forEach((mtg: any) => {
              msg += formatMeetingBlock(mtg);
            });
            msg += "\n";
          }

          msg += `📊 Tổng: *${activeIssues.length} task* đang mở\n\n`;

          if (overdue.length > 0) {
            msg += `🚨 *QUÁ HẠN (${overdue.length}):*\n`;
            overdue.forEach((f) => {
              msg += formatIssueBlock(f, true);
            });
            msg += "\n";
          }
          if (dueToday.length > 0) {
            msg += `⏰ *DEADLINE HÔM NAY (${dueToday.length}):*\n`;
            dueToday.forEach((f) => {
              msg += formatIssueBlock(f, true);
            });
            msg += "\n";
          }
          if (inProgress.length > 0) {
            msg += `🟡 *ĐANG TIẾN HÀNH (${inProgress.length}):*\n`;
            inProgress.forEach((f) => {
              msg += formatIssueBlock(f, true);
            });
            msg += "\n";
          }
          if (others.length > 0) {
            msg += `📌 *CÔNG VIỆC KHÁC (${others.length}):*\n`;
            others.slice(0, 4).forEach((f) => {
              msg += formatIssueBlock(f, false);
            });
            if (others.length > 4) msg += `   _(và ${others.length - 4} task khác)_\n`;
          }

          msg += `\n💪 Chúc bạn một ngày làm việc hiệu quả!`;

          const isRemoteStaff = String(m.workArrangement || "").toLowerCase() === "remote";
          await sendMessage(chatId, msg, {
            inline_keyboard: [
              [
                {
                  text: isRemoteStaff ? "🏠 Vào ca Remote" : "🌅 Vào ca (Check-in)",
                  callback_data: isRemoteStaff
                    ? "attendance_direct:present:remote"
                    : "attendance_direct:present",
                },
              ],
            ],
          });
        }
        console.log("[Cron 8h20 DM] ✅ Done");
      } catch (err) {
        console.error("[Cron 8h20 DM] Lỗi:", err);
      }
    },
    { timezone: TZ }
  );

  // ─── 18:05 evening DM + group ───────────────────────────────
  cron.schedule(
    CRON_EVENING,
    async () => {
      try {
        console.log("[Cron 18h05] Đang gửi tổng kết cuối ngày...");
        const data = await fetchAllData(apiClient);
        const { members, allIssues, todayStr } = data;

        if (GROUP_ID) {
          try {
            const msg = formatGroupEveningReport(data as TeamReportData);
            await sendMessage(GROUP_ID, msg);
          } catch (e) {
            console.error("[Cron 18h05 Nhóm] Lỗi:", e);
          }
        }

        for (const m of members) {
          const chatId = Number(m.telegramChatId);
          const myIssues = allIssues.filter((t: any) => {
            const isAssigned = t.assigneeId === m.id;
            const hasAssignedSub = (t.subIssues || []).some(
              (sub: any) => sub.assigneeId === m.id
            );
            return isAssigned || hasAssignedSub;
          });
          const doneToday = myIssues.filter((t: any) => {
            const g = t.State?.group || "unstarted";
            return g === "completed" && t.updatedAt?.startsWith(todayStr);
          });
          const stillOpen = myIssues.filter(
            (t: any) => !isDoneGroup(t.State?.group || "unstarted")
          );
          const openParsed = stillOpen.map((i: any) => parseIssue(i, members));

          let msg = `🌇 *TỔNG KẾT CUỐI NGÀY (18h05)*\n`;
          msg += `Chào *${m.fullName}*! Tóm tắt ngày làm việc:\n\n`;

          if (doneToday.length > 0) {
            msg += `✅ *ĐÃ HOÀN THÀNH HÔM NAY (${doneToday.length}):*\n`;
            doneToday.slice(0, 4).forEach((t: any) => {
              const f = parseIssue(t, members);
              msg += `🟢 *${f.shortId}*: ${t.title}\n`;
            });
            msg += "\n";
          }

          if (stillOpen.length > 0) {
            msg += `⏳ *CÒN MỞ (${stillOpen.length} task):*\n`;
            openParsed.slice(0, 5).forEach((f) => {
              msg += formatIssueBlock(f, true);
            });
            if (stillOpen.length > 5)
              msg += `   _(và ${stillOpen.length - 5} task khác)_\n`;
          } else {
            msg += `🎉 Tuyệt vời! Bạn đã hoàn thành tất cả công việc mở!\n`;
          }

          msg += `\n🕐 Nhớ *Check-out* trước khi về nhé! 🌙`;

          await sendMessage(chatId, msg, {
            inline_keyboard: [
              [
                {
                  text: "🚪 Tan ca (Check-out)",
                  callback_data: "attendance_direct:checkout",
                },
              ],
            ],
          });
        }
        console.log("[Cron 18h05] ✅ Done");
      } catch (err) {
        console.error("[Cron 18h05] Lỗi:", err);
      }
    },
    { timezone: TZ }
  );

  // ─── Meeting reminders 30' + 15' ────────────────────────────
  const notifiedMeeting30m = new Set<string>();
  const notifiedMeeting15m = new Set<string>();

  cron.schedule(
    CRON_MEETING,
    async () => {
      try {
        const nowMs = Date.now();
        // Compare in absolute time (meeting times stored as ISO UTC usually)
        const meetings = await fetchTodayMeetings(apiClient);
        let members: any[] = [];
        try {
          const membersRes = (await apiClient.get(API_ROUTES.HR.TEAM_MEMBERS)) as any;
          members = (membersRes?.data || []).filter(isActiveMember);
        } catch {
          /* ignore */
        }

        for (const m of meetings) {
          const startTime = new Date(m.startTime || m.start_time);
          const diffMin = Math.floor((startTime.getTime() - nowMs) / 60000);

          let notifType: "30m" | "15m" | null = null;
          if (diffMin >= 29 && diffMin <= 31 && !notifiedMeeting30m.has(m.id)) {
            notifType = "30m";
            notifiedMeeting30m.add(m.id);
          } else if (diffMin >= 14 && diffMin <= 16 && !notifiedMeeting15m.has(m.id)) {
            notifType = "15m";
            notifiedMeeting15m.add(m.id);
          }

          if (!notifType) continue;

          const title = m.title || "Cuộc họp";
          const timeStr = startTime.toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Ho_Chi_Minh",
          });
          const hostName = m.host?.fullName || m.hostName || "";
          const hostStr = hostName ? ` (Host: ${hostName})` : "";

          const attendeesNames: string[] = [];
          const dmTargets = new Set<string>();
          if (m.hostId) dmTargets.add(m.hostId);

          const attendeesList = Array.isArray(m.attendees) ? m.attendees : [];
          for (const attendeeId of attendeesList) {
            const id =
              typeof attendeeId === "string"
                ? attendeeId
                : attendeeId?.id || attendeeId?.memberId;
            if (!id) continue;
            const member = members.find((x: any) => x.id === id);
            if (member) {
              attendeesNames.push(member.fullName);
              dmTargets.add(member.id);
            }
          }
          const attendeesStr =
            attendeesNames.length > 0
              ? `\n👥 *Thành phần*: ${attendeesNames.join(", ")}`
              : "";

          const notifMsg =
            `⏰ *NHẮC LỊCH HỌP*\n\n` +
            `📅 *${title}*${hostStr}\n` +
            `Sẽ bắt đầu lúc *${timeStr}* (còn ${notifType === "30m" ? "30" : "15"} phút)` +
            `${attendeesStr}\n\nVui lòng chuẩn bị!`;

          if (GROUP_ID) {
            try {
              await sendMessage(GROUP_ID, notifMsg);
            } catch {
              /* ignore */
            }
          }

          for (const targetId of dmTargets) {
            const member = members.find((x: any) => x.id === targetId);
            if (member?.telegramChatId) {
              try {
                await sendMessage(Number(member.telegramChatId), notifMsg);
              } catch {
                /* ignore */
              }
            }
          }
          console.log(
            `[Cron Meeting] ✅ Nhắc ${notifType}: "${title}" @ ${timeStr}`
          );
        }

        // Cleanup ids older than 40 min after start
        [notifiedMeeting30m, notifiedMeeting15m].forEach((set) => {
          set.forEach((id) => {
            const mtg = meetings.find((x: any) => x.id === id);
            if (mtg) {
              const start = new Date(mtg.startTime || mtg.start_time);
              if (start.getTime() < nowMs - 40 * 60 * 1000) set.delete(id);
            }
          });
        });
      } catch {
        /* silent */
      }
    },
    { timezone: TZ }
  );

  console.log("✅ Cron Jobs (env-overridable):");
  console.log(`   • ${CRON_MORNING} → 8:20 DM + nhóm (morning)`);
  console.log(`   • ${CRON_EVENING} → 18:05 DM + nhóm (evening)`);
  console.log(`   • ${CRON_MEETING} → nhắc họp 30' & 15' trước`);
  console.log(`   • TZ=${TZ} GROUP_ID=${GROUP_ID || "(unset)"}`);
}
