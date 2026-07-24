const fs = require('fs');
const file = 'src/telegram/handlers/messageHandler.ts';
let code = fs.readFileSync(file, 'utf8');

// Add /team_status
if (!code.includes('/team_status')) {
    const checkAllIndex = code.indexOf('if (lowerText === "/check_all"');
    const teamStatusLogic = `
  // F1. Lệnh /team_status
  if (lowerText === "/team_status" || lowerText === "trạng thái checkin") {
    await sendMessage(chatId, "🔍 Đang truy vấn trạng thái check-in hôm nay...");
    try {
      const res = await fetchAxios(CORE_API_URL + "/hr/attendance");
      const json = await res.json();
      const allRecords = Array.isArray(json) ? json : (json?.data || []);
      const today = new Date().toISOString().split('T')[0];
      const todayRecords = allRecords.filter((r: any) => (r.date || "").startsWith(today));
      
      if (todayRecords.length === 0) {
        await sendMessage(chatId, "📊 *Báo cáo Check-in hôm nay*\\nChưa có ai check-in hôm nay.");
        return;
      }
      
      let checkedIn = 0;
      let late = 0;
      let reportMsg = \`📊 *Báo cáo Check-in hôm nay (\${today})*\\n\`;
      const lines = [];
      
      for (const r of todayRecords) {
        const memberName = r.member?.fullName || "Unknown";
        const workType = r.workType === "remote" ? "Remote" : "Office";
        const ci = r.checkIn ? r.checkIn.substring(11, 16) : "?";
        const co = r.checkOut ? r.checkOut.substring(11, 16) : "Chưa out";
        let icon = "✅";
        if (r.status === "late") { icon = "⚠️"; late++; }
        else if (r.status === "leave") icon = "🏖️";
        if (r.checkIn) checkedIn++;
        lines.push(\`• \${icon} *\${memberName}* (\${workType}): \${ci} - \${co}\`);
      }
      reportMsg += \`👥 Đã check-in: *\${checkedIn}* | Đi muộn: *\${late}*\\n\\n\` + lines.join("\\n");
      await sendMessage(chatId, reportMsg);
    } catch (err) {
      console.error("Lỗi lấy team status:", err);
      await sendMessage(chatId, "❌ Lỗi lấy dữ liệu chấm công.");
    }
    return;
  }
`;
    code = code.slice(0, checkAllIndex) + teamStatusLogic + code.slice(checkAllIndex);
}

// Add /subtask
if (!code.includes('/subtask')) {
    const checkAllIndex = code.indexOf('if (lowerText === "/check_all"');
    const subtaskLogic = `
  // F2. Lệnh /subtask
  if (lowerText.startsWith("/subtask")) {
    const query = text.substring(8).trim();
    if (!query) {
      await sendMessage(chatId, "⚠️ Vui lòng cung cấp mã task hoặc tên task. Ví dụ: \`/subtask T-104\`\\n\\n💡 Bạn cũng có thể dùng nút trên Web Portal.");
      return;
    }
    await sendMessage(chatId, \`🤖 Đang phân rã task \${query} bằng AI...\`);
    try {
      // Gọi API phân rã của OmniRouter (Web Portal API)
      const res = await fetchAxios(WEB_PORTAL_URL + "/api/ai/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: query })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success || json.status === "success") {
           await sendMessage(chatId, "✅ Đã phân rã và tạo subtasks thành công trên hệ thống!");
        } else {
           await sendMessage(chatId, "🤖 Lỗi kết nối AI hoặc task không tồn tại. Vui lòng thử lại sau.");
        }
      } else {
        await sendMessage(chatId, "🤖 Lỗi kết nối AI. Vui lòng thử lại sau.");
      }
    } catch(err) {
      console.error("Lỗi phân rã task:", err);
      await sendMessage(chatId, "🤖 Lỗi kết nối AI. Vui lòng thử lại sau.");
    }
    return;
  }
`;
    code = code.slice(0, checkAllIndex) + subtaskLogic + code.slice(checkAllIndex);
}

fs.writeFileSync(file, code);

// Update telegram_agent.ts menu
const agentFile = 'src/telegram_agent.ts';
let agentCode = fs.readFileSync(agentFile, 'utf8');
if (!agentCode.includes('team_status')) {
    agentCode = agentCode.replace(
      '{ command: "check_all", description: "Báo cáo trạng thái toàn bộ nhân viên" }',
      '{ command: "check_all", description: "Báo cáo trạng thái toàn bộ nhân viên" },\\n          { command: "team_status", description: "Báo cáo chấm công hôm nay" },\\n          { command: "subtask", description: "Phân rã task bằng AI" }'
    );
    fs.writeFileSync(agentFile, agentCode);
}
console.log("Done patching TS files");
