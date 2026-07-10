// Removes fetchAxios and axios imports
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getOrCreateConversation, sendMessageToLetta, getLettaHistory } from '@/lib/lettaClient';
import { coreApiClient } from '@/lib/apiClient';

export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const name = searchParams.get('name') || '';

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const lettaConvId = await getOrCreateConversation(email, name);
    const history = await getLettaHistory(lettaConvId);

    return NextResponse.json({ status: 'success', history });
  } catch (err: any) {
    console.error('Lỗi GET history:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const startTime = Date.now();
  try {
    const { message, tasks, projects, currentUser, config, companyRules } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!currentUser || !currentUser.email) {
      return NextResponse.json({ error: 'CurrentUser email is required for Letta sync' }, { status: 400 });
    }

    let hrContext = "Chưa có thông tin chấm công/nghỉ phép.";
    try {
      let member = currentUser.id ? currentUser : null;
      if (!member) {
        try {
          const membersData = await coreApiClient.get('/hr/team-members');
          if (membersData.status === 'success') {
            member = (membersData.data || []).find((m: any) => (m?.email || '').toLowerCase() === (currentUser?.email || '').toLowerCase());
          }
        } catch (err) {}
      }

      if (member) {
        hrContext = "";
        const isFullyRemote = ["trantkimngan@gmail.com", "lehuyducanh.vn@gmail.com", "huongiiiang@gmail.com"].includes((member.email || '').toLowerCase());
        const remoteLimit = isFullyRemote ? "Không giới hạn (Theo thoả thuận Remote)" : "4 ngày/tháng";
        hrContext += `- Phân loại nhân sự: ${isFullyRemote ? "Làm việc hoàn toàn từ xa (Fully Remote)" : "Nhân sự văn phòng"}.\n`;

        let leavesData, attData;
        try {
          leavesData = await coreApiClient.get('/hr/leave-requests');
        } catch (e) {}
        try {
          attData = await coreApiClient.get(`/hr/attendance?memberId=${member.id}`);
        } catch (e) {}

        if (leavesData && leavesData.status === 'success') {
          let annualUsed = 0, remoteUsed = 0;
          (leavesData.data || []).forEach((l: any) => {
            if (l.memberId === member.id && l.status === 'approved') {
              const start = new Date(l.startDate);
              const end = new Date(l.endDate);
              const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) || 1;
              if (l.leaveType === 'remote') remoteUsed += diffDays;
              else if (l.leaveType === 'annual') annualUsed += diffDays;
            }
          });
          hrContext += `- Hạn mức nghỉ phép năm đã dùng: ${annualUsed}/12 ngày.\n`;
          hrContext += `- Hạn mức làm Remote đã dùng trong tháng: ${remoteUsed} ngày (Giới hạn: ${remoteLimit}).\n`;
        }

        if (attData && attData.status === 'success') {
          const d = new Date();
          const mTarget = d.getMonth() + 1;
          const yTarget = d.getFullYear();
          let totalHoursStr = 0, presentDays = 0, lateDays = 0;
          (attData.data || []).forEach((item: any) => {
            const itemD = new Date(item.date);
            if (itemD.getMonth() + 1 === mTarget && itemD.getFullYear() === yTarget) {
              totalHoursStr += (item.totalHours || 0);
              if (item.status === 'present') presentDays++;
              if (item.status === 'late') lateDays++;
            }
          });
          totalHoursStr = Math.round(totalHoursStr * 100) / 100;
          hrContext += `- Báo cáo công tháng ${mTarget}/${yTarget}: Đi làm (${presentDays} ngày), Đi muộn (${lateDays} ngày), Tổng giờ công (${totalHoursStr} giờ).`;
        }
      }
    } catch (e) {
      console.error("Lỗi lấy HR context:", e);
    }

    const today = new Date();
    const offsetToday = new Date(today.getTime() + 7 * 60 * 60 * 1000);
    const todayStr = offsetToday.toISOString().substring(0, 10);

    const systemPrompt = `Bạn là trợ lý AI thông minh (AI Assistant) của StorymeeTeam.
Bạn có quyền truy cập thông tin dự án, tasks và quy chế công ty để hỗ trợ quản lý công việc, giải đáp nội quy đãi ngộ, và cập nhật thông tin hệ thống.

Ngữ cảnh thời gian & dự án hiện tại:
- Ngày hôm nay (Thời gian thực của hệ thống): ${todayStr}
- Danh sách dự án lớn: ${JSON.stringify(projects)}
- Danh sách công việc (tasks): ${JSON.stringify(tasks)}
- Nhân sự đang tương tác: ${JSON.stringify(currentUser)}
- Thông tin điểm danh & ngày phép của nhân sự này:
${hrContext}
- Quy chế & đãi ngộ công ty: ${companyRules || 'Không có thông tin quy chế.'}

Quy định định dạng phản hồi:
1. Khi liệt kê danh sách công việc (tasks/subtasks), hãy luôn dùng định dạng Markdown in đậm mã task, tên task, trạng thái, và deadline để người dùng dễ theo dõi nhất.
2. BẮT BUỘC xuống dòng rõ ràng (dùng hai ký tự xuống dòng "\n\n") cho từng mục trong danh sách công việc. Tuyệt đối không viết liền nhau trên cùng một dòng.
3. Tuyệt đối KHÔNG dùng các thẻ HTML như <ul>, <li>, <b> trong câu trả lời.

Nhiệm vụ của bạn:
1. Trả lời các câu hỏi về tiến độ, phân công việc, rủi ro dự án.
2. Giải đáp thắc mắc về nội quy, lương thưởng, lịch phép.
3. LƯU Ý QUAN TRỌNG VỀ ACTION:
   - Chỉ trả về action "update_task", "create_task" hoặc "create_project" khi người dùng đưa ra YÊU CẦU THAY ĐỔI cụ thể (ví dụ: "chuyển task sang done", "tạo dự án mới", "giao task cho A", "lùi deadline", "tạo task mới").
   - Nếu tạo hoặc cập nhật task mà người dùng KHÔNG chủ động nói rõ số giờ/ước tính thời gian hoàn thành (estimate), bạn KHÔNG ĐƯỢC HỎI GẶNG hay yêu cầu họ cung cấp số giờ. Hãy đặt trường "estimate" là null hoặc bỏ qua trong taskPayload. Hệ thống sẽ tự động tính toán giờ công dựa trên deadline.
   - Khi dịch mốc thời gian deadline từ hội thoại (ví dụ: "hết sáng mai", "hết ca chiều", "trong hôm nay"):
     + Hãy dịch sang định dạng ISO đầy đủ chứa cả giờ: 'YYYY-MM-DDTHH:MM:SS'.
   - Nếu người dùng muốn xin nghỉ phép, hãy kiểm tra xem họ đã cung cấp đủ thông tin chưa bao gồm: loại nghỉ phép (leaveType: sick | annual | personal), ngày bắt đầu (startDate: YYYY-MM-DD), và ngày kết thúc (endDate: YYYY-MM-DD).
     + Nếu đã cung cấp đầy đủ thông tin: Trả về action "leave_request" kèm theo leavePayload.
   - Trả về action "check_in_out" khi người dùng muốn điểm danh, check-in, check-out, báo cáo vào ca hoặc tan ca.
   - Trả về action "breakdown_task" khi người dùng muốn phân rã, phân tách hoặc chia nhỏ một công việc lớn (ví dụ: "phân rã task T-103").
   - Trả về action "update_subtasks" khi người dùng dán hoặc liệt kê một danh sách các công việc con (subtasks) tự chia để cập nhật/thay thế các công việc con của một công việc lớn.
   - Trả về action "request_task_approval" khi nhân viên muốn xin dời deadline, xin lưu trữ hoặc xóa task.
   - TRƯỜNG HỢP Boss/Admin duyệt (hoặc từ chối) task: TUYỆT ĐỐI trả về action "none", đồng thời trong mục "reply", hãy nhắc nhở Admin phải bấm vào nút "Phê duyệt" hoặc "Từ chối" ở dưới tin nhắn Yêu cầu trước đó chứ không chat trực tiếp.
   - Trả về action "get_attendance_report" khi người dùng muốn xem báo cáo công, tổng giờ làm của cá nhân hoặc toàn bộ team trong tháng.
   - Trả về action "get_team_leaves" khi Boss/Admin muốn xem danh sách nhân sự xin nghỉ phép hoặc xin làm remote trong khoảng thời gian nhất định (ví dụ: tuần này, tháng này).
   - Nếu người dùng chỉ đang HỎI hoặc TRUY VẤN thông tin thông thường, tuyệt đối KHÔNG được trả về action khác "none".

Định dạng trả về BẮT BUỘC là JSON khớp với schema sau:
{
  "reply": "Câu trả lời của bạn định dạng Markdown sạch",
  "action": "create_project" | "update_task" | "create_task" | "leave_request" | "check_in_out" | "breakdown_task" | "update_subtasks" | "request_task_approval" | "get_attendance_report" | "get_team_leaves" | "none",
  "taskPayload": { "id": "Mã task (nếu sửa)", "title": "Tiêu đề (nếu tạo)", "assignee": "Người phụ trách", "status": "Trạng thái mới", "deadline": "YYYY-MM-DD", "estimate": số_giờ, "priority": "Độ ưu tiên" },
  "projectPayload": { "title": "Tên dự án mới", "description": "Mô tả dự án (nếu có)" },
  "leavePayload": { "leaveType": "sick" | "annual" | "personal", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "reason": "Lý do xin nghỉ" },
  "checkInOutPayload": { "status": "present", "notes": "Ghi chú", "employee_name": "Tên nhân sự" },
  "breakdownPayload": { "task_id": "Mã ID" },
  "updateSubtasksPayload": { "task_id": "Mã ID", "titles": ["V1", "V2"] },
  "approvalPayload": { "task_id": "Mã ID", "type": "extend" | "archive" | "delete", "new_deadline": "YYYY-MM-DD", "reason": "Ghi chú" },
  "reportPayload": { "employee_name": "Tên nhân viên", "month": 7, "year": 2026 },
  "teamLeavesPayload": { "period": "this_week" | "this_month" | "today" }
}`;

    let lettaConvId = null;
    try {
      lettaConvId = await getOrCreateConversation(currentUser.email, currentUser.fullName || currentUser.name);
    } catch (err: any) {
      console.warn("Lỗi khởi tạo Letta Conversation (sẽ fallback sang OmniRouter):", err.message);
    }

    const fullPrompt = `${systemPrompt}\n\nUser Message: ${message}`;
    
    let reply: string | null = null;
    let fallbackProvider = '';
    let fallbackModel = '';

    try {
      if (!lettaConvId) {
        throw new Error("Không có Letta Conversation ID (bỏ qua Letta).");
      }
      reply = await sendMessageToLetta(lettaConvId, fullPrompt);
      if (!reply) {
        throw new Error("Letta Agent returned empty content (possibly only internal monologue).");
      }
    } catch (lettaError: any) {
      console.warn("Letta Agent failed or rate limited. Falling back to core-ai-api...", lettaError.message);
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY || 'AIzaSyC7lBGGw_c2sM6RHif2k32E6mAiZBzCUyY'}`;
        const hubRes = await fetch(geminiUrl, {
          method: "POST",
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }]
          }),
          signal: AbortSignal.timeout(15000)
        });

        if (hubRes.ok) {
          const hubJson = await hubRes.json();
          let rawText = hubJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
          
          let cleanReply = rawText.trim();
          const jsonMatch = cleanReply.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            cleanReply = jsonMatch[0];
          }
          
          reply = cleanReply;
          fallbackModel = 'gemini-2.5-flash';
        } else {
          const errText = await hubRes.text();
          throw new Error(`Gemini API returned ${hubRes.status}: ${errText}`);
        }
      } catch (hubError: any) {
        console.error("Gemini Fallback cũng thất bại:", hubError.message);
        return NextResponse.json({ 
          error: 'Cả hệ thống Letta và OmniRouter dự phòng đều đang quá tải hoặc gặp sự cố.', 
          gemini_error: hubError.message,
          stack: hubError.stack
        }, { status: 500 });
      }
    }

    if (!reply) {
      throw new Error('No content returned from AI Agent');
    }

    let cleanReply = reply.trim();
    const jsonMatch = cleanReply.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanReply = jsonMatch[0];
    }
    
    let result;
    try {
      result = JSON.parse(cleanReply);
    } catch (e: any) {
      // Nếu vẫn lỗi parse, trả về JSON giả định
      console.error("JSON parse failed. Raw reply:", reply);
      result = {
        reply: reply,
        action: "none"
      };
    }
    
    const sentTokens = Math.round(message.length * 0.75 + 1500);
    const useCompression = config && config.useCompression;
    const compressedTokens = useCompression ? Math.round(sentTokens * 0.8) : 0;
    
    let simulatedModel = fallbackModel || (config?.useCloud ? (config?.useFallback ? 'nvidia-auto' : 'openrouter-auto') : 'gemini/gemini-2.5-flash');
    let simulatedProvider = fallbackProvider || (config?.useCloud ? (config?.useFallback ? 'Nvidia' : 'OpenRouter') : 'Gemini Native');

    const log = {
      timestamp: new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      model: simulatedModel,
      provider: simulatedProvider,
      latency: Date.now() - startTime,
      status: fallbackProvider ? 'OmniRouter Fallback' : (config?.useCloud ? 'OmniRouter→Letta' : 'Gemini Direct'),
      tokens: sentTokens,
      compressed: compressedTokens
    };

    try {
      fetch((process.env.NEXT_PUBLIC_API_URL === '/api' || process.env.NEXT_PUBLIC_API_URL === '/' || (process.env.NEXT_PUBLIC_API_URL || '').includes('//hub.storymee.com') || !process.env.NEXT_PUBLIC_API_URL ? 'https://dev-hub.storymee.com' : process.env.NEXT_PUBLIC_API_URL) ? `${process.env.NEXT_PUBLIC_API_URL}/logs` : 'https://dev-hub.storymee.com/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log),
        signal: AbortSignal.timeout(10000)
      }).catch(err => console.error("Lỗi gửi log đến core-ai-api:", err));
    } catch (err) {
      console.error("Lỗi gửi log:", err);
    }

    return NextResponse.json({ status: 'success', data: result, log });
  } catch (error: any) {
    console.error('API Chat Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error', stack: error.stack }, { status: 500 });
  }
}
