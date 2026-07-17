import { TelegramMessageContext, TelegramCommand } from './types';
import { sendMessage, getCachedMembers, KEYBOARD_MAIN } from '../../telegram_agent';
import { API_ROUTES } from '@storymee/api-client';

export const registerCommand: TelegramCommand = {
  name: 'register',
  description: 'Đăng ký nhân sự mới',
  match: (text: string, lowerText: string) => 
    lowerText === "👤 đăng ký nhân viên mới" || lowerText.startsWith("/register"),
  execute: async (ctx: TelegramMessageContext) => {
    const { chatId, username, text, lowerText, member, apiClient } = ctx;

    if (lowerText === "👤 đăng ký nhân viên mới") {
      await sendMessage(chatId, "💡 *Cú pháp đăng ký:* `/register [email] [Họ và Tên]`\n\nVí dụ: `/register an.nguyen@storymee.com Nguyễn Văn An` (Hệ thống sẽ tự nhận diện Telegram ID & Username của bạn)");
      return true;
    }

    const parts = text.split(/\s+/);
    if (parts.length < 3) {
      await sendMessage(chatId, "💡 *Cú pháp đăng ký:* `/register [email] [Họ và Tên]`\n\nVí dụ: `/register an.nguyen@storymee.com Nguyễn Văn An` (Hệ thống sẽ tự nhận diện Telegram ID & Username của bạn)");
      return true;
    }
    const email = parts[1].trim().toLowerCase();
    const fullName = parts.slice(2).join(" ").trim();
    
    // Kiểm tra định dạng email hợp lệ
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await sendMessage(chatId, "❌ *Lỗi đăng ký:* Email không đúng định dạng. Vui lòng nhập đúng email công ty để liên kết.\n\nVí dụ: `/register an.nguyen@storymee.com Nguyễn Văn An` (Họ tên phải có đầy đủ họ và tên)");
      return true;
    }

    // Kiểm tra độ dài Họ tên
    if (fullName.length < 2) {
      await sendMessage(chatId, "❌ *Lỗi đăng ký:* Họ tên quá ngắn. Vui lòng nhập đầy đủ Họ và Tên của bạn.");
      return true;
    }

    // 1. Kiểm tra xem Telegram Username này đã được liên kết với ai chưa
    if (member) {
      await sendMessage(chatId, `⚠️ *Tài khoản đã liên kết:* Tài khoản Telegram của bạn đã được liên kết với hồ sơ **${member.fullName}** (Email: \`${member.email}\`) trên hệ thống rồi. Không cần đăng ký lại.\n\n💡 Nếu cần thay đổi liên kết, vui lòng liên hệ Admin.`);
      return true;
    }

    try {
      // Fetch tất cả members để kiểm tra trùng lặp email
      const allMems = await getCachedMembers();
      if (allMems && allMems.length > 0) {
          // 2. Kiểm tra xem email này đã tồn tại trong hệ thống chưa
          const existingEmailMember = allMems.find((m: any) => m.email.toLowerCase() === email);
          
          if (existingEmailMember) {
            // Nếu email đã được liên kết với một tài khoản Telegram khác
            if (existingEmailMember.telegramUsername) {
              await sendMessage(chatId, `❌ *Email đã có chủ:* Email \`${email}\` đã được liên kết với tài khoản Telegram **@${existingEmailMember.telegramUsername}**. Không thể đăng ký đè.\n\n💡 Vui lòng kiểm tra lại hoặc liên hệ Admin.`);
              return true;
            }
            
            // Liên kết Telegram qua register (giữ pending nếu chưa duyệt)
            await sendMessage(chatId, "⏳ Đang liên kết Telegram với hồ sơ sẵn có...");
            try {
                const res: any = await apiClient.post(`${API_ROUTES.HR.TEAM_MEMBERS}/register`, {
                  email,
                  fullName: existingEmailMember.fullName || fullName,
                  telegramUsername: username,
                  telegramChatId: chatId,
                });
                const st = res?.data?.accountStatus || existingEmailMember.accountStatus || 'pending';
                if (st === 'active') {
                  await sendMessage(chatId, `🎉 **Liên kết thành công!**\n\n• **${existingEmailMember.fullName}**\n• Email: \`${email}\`\n• Telegram: **@${username}**\n\nBạn có thể dùng bot.`, KEYBOARD_MAIN);
                } else {
                  await sendMessage(chatId, `🔗 Đã gắn Telegram, nhưng tài khoản đang **${st}** — chờ Admin duyệt/mở khoá.`, KEYBOARD_MAIN);
                }
              } catch (err: any) {
                console.error('[registerCommand] API POST (Link) Error:', err);
                await sendMessage(chatId, `❌ Lỗi liên kết: ${err?.data?.message || err?.message || 'từ chối'}`);
                throw err;
              }
            return true;
          }
      }

      // 3. Email mới → đăng ký PENDING, chờ Admin duyệt (không vào app ngay)
      await sendMessage(chatId, "⏳ Đang gửi yêu cầu đăng ký (chờ Admin duyệt)...");
      try {
          const res: any = await apiClient.post(`${API_ROUTES.HR.TEAM_MEMBERS}/register`, {
            email,
            fullName,
            telegramUsername: username,
            telegramChatId: chatId,
            role: "Nhân sự mới",
          });
          const st = res?.data?.accountStatus || res?.accountStatus || 'pending';
          if (st === 'pending') {
            await sendMessage(
              chatId,
              `📝 **Đã gửi đăng ký — chờ Admin duyệt**\n\n` +
              `• Họ tên: **${fullName}**\n• Email: **${email}**\n• Telegram: **@${username}**\n\n` +
              `Bạn **chưa** đăng nhập được StorymeeTeam / dùng đủ bot cho đến khi Admin duyệt.\n` +
              `Admin sẽ nhận thông báo và duyệt trên web HR.`,
              KEYBOARD_MAIN
            );
          } else {
            await sendMessage(chatId, `✅ ${res?.message || 'Đăng ký / liên kết thành công.'}`, KEYBOARD_MAIN);
          }
        } catch (err: any) {
          console.error('[registerCommand] API POST Error:', err);
          await sendMessage(chatId, `❌ Lỗi đăng ký: ${err?.data?.message || err?.message || 'Cổng từ chối tạo tài khoản.'}`);
          throw err;
        }
    } catch (err) {
      await sendMessage(chatId, "❌ Lỗi kết nối hệ thống khi đăng ký.");
    }
    return true;
  }
};
