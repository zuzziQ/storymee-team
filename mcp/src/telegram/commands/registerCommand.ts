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
            
            // Nếu email tồn tại nhưng chưa liên kết Telegram -> Thực hiện liên kết hồ sơ sẵn có
            await sendMessage(chatId, "⏳ Đang liên kết tài khoản Telegram của bạn với hồ sơ sẵn có...");
            try {
                await apiClient.post(API_ROUTES.HR.TEAM_MEMBERS, {
                  ...existingEmailMember,
                  telegramUsername: username,
                  telegramChatId: chatId
                });
                await sendMessage(chatId, `🎉 **Liên kết tài khoản thành công!**\n\n• Họ tên: **${existingEmailMember.fullName}**\n• Email: **${existingEmailMember.email}**\n• Chức vụ: **${existingEmailMember.role || 'Nhân viên'}**\n• Telegram: **@${username}**\n\nBạn đã có thể sử dụng tất cả các lệnh của bot.`, KEYBOARD_MAIN);
              } catch (err: any) {
                console.error('[registerCommand] API POST (Link) Error:', err);
                await sendMessage(chatId, "❌ Lỗi: Cổng đăng ký từ chối liên kết tài khoản.");
                throw err;
              }
            return true;
          }
      }

      // 3. Nếu là email hoàn toàn mới -> Tạo mới nhân sự mới
      await sendMessage(chatId, "⏳ Đang tạo hồ sơ nhân sự mới trên hệ thống...");
      try {
          await apiClient.post(API_ROUTES.HR.TEAM_MEMBERS, {
            email,
            fullName,
            telegramUsername: username,
            telegramChatId: chatId,
            role: "Nhân sự mới",
            skills: []
          });
          await sendMessage(chatId, `🎉 **Đăng ký nhân sự mới thành công!**\n\n• Họ tên: **${fullName}**\n• Email: **${email}**\n• Telegram: **@${username}**\n• Chat ID: **${chatId}**\n\nHệ thống đã tự động tạo hồ sơ của bạn. Bạn đã có thể bắt đầu sử dụng bot!`, KEYBOARD_MAIN);
        } catch (err: any) {
          console.error('[registerCommand] API POST Error:', err);
          await sendMessage(chatId, "❌ Lỗi: Cổng đăng ký từ chối tạo tài khoản mới.");
          throw err;
        }
    } catch (err) {
      await sendMessage(chatId, "❌ Lỗi kết nối hệ thống khi đăng ký.");
    }
    return true;
  }
};
