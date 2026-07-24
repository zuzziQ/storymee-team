const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/telegram_agent.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove getCachedMembersMockResponse entirely
content = content.replace(
/async function getCachedMembersMockResponse\(\): Promise<any> \{[\s\S]*?\}\n\/\//,
'//'
);

// 2. Refactor sendDailySummaryAndNotify
content = content.replace(
`    const membersRes = await getCachedMembersMockResponse();
    if (!membersRes.ok) throw new Error("Không thể fetch team members");
    const membersData = (await membersRes.json()) as any;
    const members = membersData.data;`,
`    const members = await getCachedMembers();
    if (!members || members.length === 0) throw new Error("Không thể fetch team members");`
);

// 3. Refactor checkRealtimeOverdueDeadlines
content = content.replace(
`    const membersRes = await getCachedMembersMockResponse();
    if (!membersRes.ok) throw new Error("Không thể fetch team members");
    const membersData = (await membersRes.json()) as any;
    const members = membersData.data;`,
`    const members = await getCachedMembers();
    if (!members || members.length === 0) throw new Error("Không thể fetch team members");`
);

// 4. Refactor A. Định danh người dùng
content = content.replace(
`  try {
    const membersRes = await getCachedMembersMockResponse();
    if (membersRes.ok) {
      const membersData = (await membersRes.json()) as any;
      if (membersData.status === 'success' && Array.isArray(membersData.data)) {
        allMembers = membersData.data;
        const cleanUsername = (username || "").replace(/^@/, "").toLowerCase().trim();
        member = allMembers.find((m: any) => {
          if (m.telegramChatId && m.telegramChatId === chatId) {
            return true;
          }
          if (cleanUsername) {
            const cleanDB = (m.telegramUsername || "").replace(/^@/, "").toLowerCase().trim();
            return cleanDB === cleanUsername;
          }
          return false;
        });
      }
    }
  } catch (err) {`,
`  try {
    allMembers = await getCachedMembers();
    if (allMembers && allMembers.length > 0) {
      const cleanUsername = (username || "").replace(/^@/, "").toLowerCase().trim();
      member = allMembers.find((m: any) => {
        if (m.telegramChatId && m.telegramChatId === chatId) {
          return true;
        }
        if (cleanUsername) {
          const cleanDB = (m.telegramUsername || "").replace(/^@/, "").toLowerCase().trim();
          return cleanDB === cleanUsername;
        }
        return false;
      });
    }
  } catch (err) {`
);

// 5. Refactor register check
content = content.replace(
`      // Fetch tất cả members để kiểm tra trùng lặp email
      const checkRes = await getCachedMembersMockResponse();
      if (checkRes.ok) {
        const checkData = (await checkRes.json()) as any;
        if (checkData.status === 'success' && Array.isArray(checkData.data)) {
          // 2. Kiểm tra xem email này đã tồn tại trong hệ thống chưa
          const existingEmailMember = checkData.data.find((m: any) => m.email.toLowerCase() === email);`,
`      // Fetch tất cả members để kiểm tra trùng lặp email
      const allMems = await getCachedMembers();
      if (allMems && allMems.length > 0) {
          // 2. Kiểm tra xem email này đã tồn tại trong hệ thống chưa
          const existingEmailMember = allMems.find((m: any) => m.email.toLowerCase() === email);`
);
// Make sure to replace the matching closing brackets! Wait, I shouldn't use regex for that. I'll just use string replacement carefully.
// Ah, the previous block has closing brackets that need to be removed.
content = content.replace(
`            // Nếu email tồn tại nhưng chưa liên kết Telegram -> Thực hiện liên kết hồ sơ sẵn có
            await sendMessage(chatId, "⏳ Đang liên kết tài khoản Telegram của bạn với hồ sơ sẵn có...");
            try {
                const updateRes = await apiClient.post("/omnitask/team-members", {
                  ...existingEmailMember,
                  telegramUsername: username,
                  telegramChatId: chatId
                });
                await sendMessage(chatId, \`🎉 **Liên kết tài khoản thành công!**\\n\\n• Họ tên: **\${existingEmailMember.fullName}**\\n• Email: **\${existingEmailMember.email}**\\n• Chức vụ: **\${existingEmailMember.role || 'Nhân viên'}**\\n• Telegram: **@\${username}**\\n\\nBạn đã có thể sử dụng tất cả các lệnh của bot.\`, KEYBOARD_MAIN);
              } catch (err: any) {
                await sendMessage(chatId, "❌ Lỗi: Cổng đăng ký từ chối liên kết tài khoản.");
                throw err;
              }
            return;
          }
        }
      }`,
`            // Nếu email tồn tại nhưng chưa liên kết Telegram -> Thực hiện liên kết hồ sơ sẵn có
            await sendMessage(chatId, "⏳ Đang liên kết tài khoản Telegram của bạn với hồ sơ sẵn có...");
            try {
                const updateRes = await apiClient.post("/omnitask/team-members", {
                  ...existingEmailMember,
                  telegramUsername: username,
                  telegramChatId: chatId
                });
                await sendMessage(chatId, \`🎉 **Liên kết tài khoản thành công!**\\n\\n• Họ tên: **\${existingEmailMember.fullName}**\\n• Email: **\${existingEmailMember.email}**\\n• Chức vụ: **\${existingEmailMember.role || 'Nhân viên'}**\\n• Telegram: **@\${username}**\\n\\nBạn đã có thể sử dụng tất cả các lệnh của bot.\`, KEYBOARD_MAIN);
              } catch (err: any) {
                await sendMessage(chatId, "❌ Lỗi: Cổng đăng ký từ chối liên kết tài khoản.");
                throw err;
              }
            return;
          }
      }`
);

// 6. Refactor fetch tasks logic. We see this a lot:
// let tasksData;
// try {
//   tasksData = (await apiClient.get("/omnitask/")) as any;
// } catch (err: any) { ... }
// const dbTasks = tasksData.data;
// It's correct since the API returns { status, data: [] }. But we can make it cleaner.
content = content.replace(
/let tasksData;\n\s*try \{\n\s*tasksData = \(await apiClient\.get\("\/omnitask\/"\)\) as any;\n\s*\} catch \(err: any\) \{\n\s*throw new Error\("Không thể fetch tasks"\);\n\s*\}\n\s*const dbTasks = tasksData\.data;/g,
`let dbTasks: any[] = [];
    try {
      const tasksData = (await apiClient.get("/omnitask/")) as any;
      dbTasks = tasksData?.data || [];
    } catch (err: any) {
      throw new Error("Không thể fetch tasks");
    }`
);

// Write back
fs.writeFileSync(filePath, content, 'utf8');
console.log('Refactored getCachedMembersMockResponse usages.');
