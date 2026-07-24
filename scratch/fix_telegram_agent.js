const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/telegram_agent.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix getCachedMembers()
content = content.replace(
`  try {
    try {
        await apiClient.get("/omnitask/team-members");
      } catch (err: any) {
        throw err;
      }
  } catch (err) {
    console.error("Lỗi fetch team-members:", err);
  }`,
`  try {
    const json = await apiClient.get("/omnitask/team-members") as any;
    if (json && json.status === 'success' && Array.isArray(json.data)) {
      const now = Date.now();
      membersCache = { data: json.data, timestamp: now };
      return json.data;
    }
  } catch (err) {
    console.error("Lỗi fetch team-members:", err);
  }`
);

// 2. Fix sendMessage fallback
content = content.replace(
`  try {
    const res = await fetch(\`\${TELEGRAM_API}/sendMessage\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        chat_id: chatId, 
        text: formattedText, 
        parse_mode: "Markdown",
        reply_markup: finalMarkup
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(\`[Telegram API Error] /sendMessage status=\${res.status}:\`, errText);
    }
  }`,
`  try {
    let res = await fetch(\`\${TELEGRAM_API}/sendMessage\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        chat_id: chatId, 
        text: formattedText, 
        parse_mode: "Markdown",
        reply_markup: finalMarkup
      }),
    });
    
    // If Markdown parsing fails (Telegram is very strict), fallback to plain text
    if (res.status === 400) {
      const errText = await res.text();
      console.warn(\`[Telegram API Warning] Markdown failed (\${errText}). Falling back to plain text...\`);
      res = await fetch(\`\${TELEGRAM_API}/sendMessage\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          chat_id: chatId, 
          text: formattedText,
          reply_markup: finalMarkup
        }),
      });
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error(\`[Telegram API Error] /sendMessage status=\${res.status}:\`, errText);
    }
  }`
);

// 3. Fix registration links
content = content.replace(
`            try {
                await apiClient.post("/omnitask/team-members", JSON.stringify({
                              ...existingEmailMember,
                              telegramUsername: username,
                              telegramChatId: chatId
                            }));
              } catch (err: any) {
                throw err;
              }`,
`            try {
                const updateRes = await apiClient.post("/omnitask/team-members", {
                  ...existingEmailMember,
                  telegramUsername: username,
                  telegramChatId: chatId
                });
                await sendMessage(chatId, \`🎉 **Liên kết tài khoản thành công!**\\n\\n• Họ tên: **\${existingEmailMember.fullName}**\\n• Email: **\${existingEmailMember.email}**\\n• Chức vụ: **\${existingEmailMember.role || 'Nhân viên'}**\\n• Telegram: **@\${username}**\\n\\nBạn đã có thể sử dụng tất cả các lệnh của bot.\`, KEYBOARD_MAIN);
              } catch (err: any) {
                await sendMessage(chatId, "❌ Lỗi: Cổng đăng ký từ chối liên kết tài khoản.");
                throw err;
              }`
);

content = content.replace(
`      try {
          await apiClient.post("/omnitask/team-members", JSON.stringify({
                  email,
                  fullName,
                  telegramUsername: username,
                  telegramChatId: chatId,
                  role: "Developer",
                  skills: []
                }));
        } catch (err: any) {
          throw err;
        }`,
`      try {
          const registerRes = await apiClient.post("/omnitask/team-members", {
            email,
            fullName,
            telegramUsername: username,
            telegramChatId: chatId,
            role: "Developer",
            skills: []
          });
          await sendMessage(chatId, \`🎉 **Đăng ký nhân sự mới thành công!**\\n\\n• Họ tên: **\${fullName}**\\n• Email: **\${email}**\\n• Telegram: **@\${username}**\\n• Chat ID: **\${chatId}**\\n\\nHệ thống đã tự động tạo hồ sơ của bạn. Bạn đã có thể bắt đầu sử dụng bot!\`, KEYBOARD_MAIN);
        } catch (err: any) {
          await sendMessage(chatId, "❌ Lỗi: Cổng đăng ký từ chối tạo tài khoản mới.");
          throw err;
        }`
);

content = content.replace(
`      try {
          await apiClient.post("/omnitask/team-members", JSON.stringify({
                  fullName: member.fullName,
                  email: member.email,
                  telegramUsername: member.telegramUsername,
                  telegramChatId: chatId,
                  role: member.role,
                  skills: member.skills,
                  bankName: member.bankName,
                  bankAccount: member.bankAccount,
                  phone: member.phone
                }));
        } catch (err: any) {
          throw err;
        }`,
`      try {
          await apiClient.post("/omnitask/team-members", {
            fullName: member.fullName,
            email: member.email,
            telegramUsername: member.telegramUsername,
            telegramChatId: chatId,
            role: member.role,
            skills: member.skills,
            bankName: member.bankName,
            bankAccount: member.bankAccount,
            phone: member.phone
          });
          console.log(\`[Postgres API] Đã đồng bộ thành công chat_id \${chatId} cho @\${username} (\${member.fullName})\`);
          member.telegramChatId = chatId;
        } catch (err: any) {
          throw err;
        }`
);

// 4. Fix leave requests remaining limit
content = content.replace(
`        try {
            await apiClient.get("/omnitask/hr/leave-requests");
          } catch (err: any) {
            throw err;
          }`,
`        try {
            const hrData = (await apiClient.get("/omnitask/hr/leave-requests")) as any;
            if (hrData && hrData.status === 'success' && Array.isArray(hrData.data)) {
              const memberRequests = hrData.data.filter((r: any) => r.memberId === member.id && r.status === 'approved');
              
              if (formType === 'leave') {
                const monthLeaves = memberRequests.filter((r: any) => {
                  const rDate = new Date(r.startDate);
                  return r.leaveType !== 'remote' && rDate.getFullYear() === targetYear && (rDate.getMonth() + 1) === targetMonth;
                });
                
                if (monthLeaves.length >= 1) {
                  leaveType = 'personal'; 
                  quotaStatusMsg = \`⚠️ *Cảnh báo hạn mức:* Trong tháng \${targetMonth}/\${targetYear}, bạn đã nghỉ *\${monthLeaves.length}* ngày phép. Theo quy định, ngày nghỉ tiếp theo này sẽ được tính là *Nghỉ không phép (Không lương)*.\`;
                } else {
                  quotaStatusMsg = \`✅ *Trong hạn mức:* Bạn chưa nghỉ ngày phép nào trong tháng \${targetMonth}/\${targetYear} (Hạn mức: 1 ngày phép/tháng có lương).\`;
                }
              } else {
                const monthRemotes = memberRequests.filter((r: any) => {
                  const rDate = new Date(r.startDate);
                  return r.leaveType === 'remote' && rDate.getFullYear() === targetYear && (rDate.getMonth() + 1) === targetMonth;
                });
                const limit = member.remoteLimit || 4;
                if (monthRemotes.length >= limit) {
                  quotaStatusMsg = \`⚠️ *Cảnh báo hạn mức:* Trong tháng \${targetMonth}/\${targetYear}, bạn đã làm remote *\${monthRemotes.length} / \${limit}* ngày. Yêu cầu remote tiếp theo này sẽ vượt quá hạn mức làm việc từ xa của tháng.\`;
                } else {
                  quotaStatusMsg = \`✅ *Trong hạn mức:* Bạn đã làm remote *\${monthRemotes.length} / \${limit}* ngày trong tháng \${targetMonth}/\${targetYear}.\`;
                }
              }
            }
          } catch (err: any) {
            throw err;
          }`
);

// 5. Fix Leave Request Submission
content = content.replace(
`      try {
          await apiClient.post("/omnitask/hr/leave-request", JSON.stringify({
                  telegramUsername: member.telegramUsername,
                  leaveType,
                  startDate: startDate + "T00:00:00.000Z",
                  endDate: endDate + "T23:59:59.000Z",
                  reason: reason || "Xin nghỉ phép qua Bot Telegram"
                }));
        } catch (err: any) {
          throw err;
        }`,
`      try {
          const resJson = await apiClient.post("/omnitask/hr/leave-request", {
            telegramUsername: member.telegramUsername,
            leaveType,
            startDate: startDate + "T00:00:00.000Z",
            endDate: endDate + "T23:59:59.000Z",
            reason: reason || "Xin nghỉ phép qua Bot Telegram"
          }) as any;
          
          if (resJson && resJson.data && resJson.data.id) {
            const requestId = resJson.data.id;
            try {
              await fetch(\`\${TELEGRAM_API}/editMessageText\`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  message_id: messageId,
                  text: \`🚀 *Hệ thống:* Đã gửi yêu cầu nghỉ phép của bạn thành công! Phiếu đang ở trạng thái *Chờ duyệt*.\`,
                  parse_mode: "Markdown"
                })
              });
            } catch (e) {}

            const adminEmails = ['kimngan151091@gmail.com', 'lehuyducanh.vn@gmail.com', 'zuzzivn@gmail.com'];
            for (const targetMem of allMembers) {
              if ((adminEmails.includes(targetMem.email.toLowerCase()) || targetMem.telegramUsername?.toLowerCase() === 'mlq007') && targetMem.telegramChatId) {
                const adminChatId = Number(targetMem.telegramChatId);
                const leaveTypeStr = leaveType === 'sick' ? 'Nghỉ ốm' : leaveType === 'annual' ? 'Nghỉ phép năm' : leaveType === 'remote' ? 'Đăng ký Remote' : 'Việc riêng';
                
                try {
                  await fetch(\`\${TELEGRAM_API}/sendMessage\`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: adminChatId,
                      text: \`🔔 *YÊU CẦU DUYỆT PHÉP MỚI*\\n\\n• Nhân viên: *\${member.fullName}*\\n• Loại nghỉ: *\${leaveTypeStr}*\\n• Thời gian: *\${startDate} đến \${endDate}*\\n• Lý do: *\${reason || 'Không có'}*\\n\\n👉 Vui lòng duyệt hoặc từ chối yêu cầu này dưới đây:\`,
                      parse_mode: "Markdown",
                      reply_markup: {
                        inline_keyboard: [
                          [
                            { text: "✅ Duyệt nghỉ", callback_data: \`approve_leave:\${requestId}\` },
                            { text: "❌ Từ chối", callback_data: \`reject_leave:\${requestId}\` }
                          ]
                        ]
                      }
                    })
                  });
                } catch (err) {
                  console.error("Lỗi gửi tin nhắn duyệt cho admin:", err);
                }
              }
            }
          }
        } catch (err: any) {
          await sendMessage(chatId, "❌ Lỗi: Cổng HR Service không thể khởi tạo phiếu nghỉ phép.");
          throw err;
        }`
);

// 6. Fix Task approval
content = content.replace(
`      try {
          await apiClient.post(\`/omnitask/hr/tasks/\${taskId}/approve\`, JSON.stringify({ type: reqType, decision: action }));
        } catch (err: any) {
          throw err;
        }`,
`      try {
          await apiClient.post(\`/omnitask/hr/tasks/\${taskId}/approve\`, { type: reqType, decision: action });
          const actionStr = action === "approve" ? "Đã Phê duyệt" : "Đã Từ chối";
          const emoji = action === "approve" ? "✅" : "❌";

          await fetch(\`\${TELEGRAM_API}/editMessageText\`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: callbackQuery.message?.text + \`\\n\\n\${emoji} *\${actionStr}*\`,
              parse_mode: "Markdown"
            })
          });
        } catch (err: any) {
          await sendMessage(chatId, "❌ Lỗi hệ thống khi duyệt task.");
          throw err;
        }`
);

// 7. Fix Leave approval
content = content.replace(
`      try {
          await apiClient.post(\`/omnitask/hr/\${endpoint}\`, JSON.stringify({ requestId }));
        } catch (err: any) {
          throw err;
        }`,
`      try {
          const resJson = await apiClient.post(\`/omnitask/hr/\${endpoint}\`, { requestId }) as any;
          const actionStr = action === "approve" ? "Đã Phê duyệt" : "Đã Từ chối";
          const emoji = action === "approve" ? "✅" : "❌";

          try {
            await fetch(\`\${TELEGRAM_API}/editMessageText\`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId,
                text: \`\${callbackQuery.message?.text}\\n\\n\${emoji} *KẾT QUẢ:* Admin *\${member.fullName}* đã *\${actionStr}* đơn xin nghỉ phép này.\`,
                parse_mode: "Markdown"
              })
            });
          } catch (e) {}

          const leaveReq = resJson?.data?.leaveRequest;
          if (resJson?.status === 'success' && leaveReq && leaveReq.memberId) {
            const emp = allMembers.find((m: any) => m.id === leaveReq.memberId);
            if (emp && emp.telegramChatId) {
              const empChatId = Number(emp.telegramChatId);
              const startD = leaveReq.startDate.split('T')[0];
              const endD = leaveReq.endDate.split('T')[0];
              const typeStr = leaveReq.leaveType === 'sick' ? 'Nghỉ ốm' : leaveReq.leaveType === 'annual' ? 'Nghỉ phép năm' : leaveReq.leaveType === 'remote' ? 'Làm Remote' : 'Việc riêng';
              await sendMessage(
                empChatId,
                \`🔔 *CẬP NHẬT TRẠNG THÁI PHÉP PHÉP*\\n\\nYêu cầu \${typeStr} từ ngày *\${startD} đến \${endD}* của bạn đã được Admin *\${member.fullName}* xử lý: *\${actionStr}* \${emoji}\`
              );
            }
          }
        } catch (err: any) {
          await sendMessage(chatId, "❌ Lỗi: Cổng HR Service phản hồi thất bại khi thực thi duyệt phép.");
          throw err;
        }`
);

// 8. Fix webhook res status
content = content.replace(
`    } catch (err) {
      console.error("Lỗi xử lý webhook:", err);
      res.sendStatus(500);
    }`,
`    } catch (err) {
      console.error("Lỗi xử lý webhook:", err);
      // TRẢ VỀ 200 OK NGAY LẬP TỨC để Telegram không gửi lại (retry) tin nhắn
      res.sendStatus(200);
    }`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed telegram_agent.ts');
