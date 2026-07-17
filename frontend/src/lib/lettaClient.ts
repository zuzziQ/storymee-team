import axios from 'axios';
import { coreApiClient } from './apiClient';

const LETTA_BASE_URL = process.env.NEXT_PUBLIC_LETTA_URL || 'http://localhost:8888/v1';
const LETTA_AGENT_ID = process.env.NEXT_PUBLIC_LETTA_AGENT_ID || 'agent-f5b9cbff-8874-470c-80d5-91027511fe82';

export interface LettaMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp?: string;
}

/**
 * Tìm hoặc tạo mới Letta Conversation cho nhân sự
 */
export async function getOrCreateConversation(email: string, fullName: string): Promise<string> {
  try {
    // 1. Truy cập Core API để lấy thông tin nhân sự và lettaConversationId
    const data = await coreApiClient.get('/hr/team-members');
    
    if (data.status === 'success' && Array.isArray(data.data)) {
      const member = data.data.find((m: any) => (m?.email || '').toLowerCase() === (email || '').toLowerCase());
      if (member) {
        if (member.lettaConversationId) {
          return member.lettaConversationId;
        }
        
        // 2. Chưa có -> Gọi Letta API tạo mới cuộc hội thoại
        console.log(`[Letta] Đang tạo Conversation mới cho ${fullName} (${email})...`);
        const lettaRes = await fetch(`${LETTA_BASE_URL}/conversations/?agent_id=${LETTA_AGENT_ID}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000)
        });
        
        if (!lettaRes.ok) {
          throw new Error(`Lỗi tạo Conversation từ Letta API: ${lettaRes.statusText || lettaRes.status}`);
        }
        
        const lettaData = await lettaRes.json();
        const newConvId = lettaData.id;
        
        if (newConvId) {
          console.log(`[Letta] Đã tạo thành công Conversation ${newConvId}. Đang đồng bộ lên DB...`);
          // 3. Đồng bộ Conversation ID mới lên DB qua Core API upsert
          try {
            await coreApiClient.post('/hr/team-members', {
              fullName: member.fullName,
              email: member.email,
              telegramUsername: member.telegramUsername,
              telegramChatId: member.telegramChatId ? Number(member.telegramChatId) : null,
              role: member.role,
              skills: member.skills,
              bankName: member.bankName,
              bankAccount: member.bankAccount,
              phone: member.phone,
              lettaConversationId: newConvId
            });
            console.log(`[Letta] Đồng bộ Conversation ID lên DB thành công.`);
          } catch (syncErr: any) {
            console.error(`[Letta] Đồng bộ Conversation ID lên DB thất bại:`, syncErr);
          }
          
          return newConvId;
        }
      }
    }
    throw new Error(`Không tìm thấy nhân viên với email ${email}`);
  } catch (err: any) {
    console.error('Lỗi trong getOrCreateConversation:', err);
    throw err;
  }
}

/**
 * Gửi tin nhắn và nhận phản hồi từ Letta Conversation dưới dạng stream SSE
 */
export async function sendMessageToLetta(conversationId: string, message: string): Promise<string> {
  try {
    const res = await fetch(`${LETTA_BASE_URL}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: message }]
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) {
      throw new Error(`Letta API send message error: ${res.status}`);
    }

    let accumulatedText = '';
    
    if (res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const text = decoder.decode(value, { stream: true });
          const lines = text.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              const dataStr = trimmed.substring(6);
              if (dataStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.message_type === 'assistant_message') {
                  accumulatedText += parsed.content || '';
                }
              } catch (e) {
                // Bỏ qua dòng JSON chưa trọn vẹn
              }
            }
          }
        }
      }
    }

    return accumulatedText.trim();
  } catch (err: any) {
    console.error('Lỗi gửi tin nhắn Letta:', err);
    throw err;
  }
}

/**
 * Tải lịch sử chat của cuộc hội thoại từ Letta và format sang kiểu ChatMessage
 */
export async function getLettaHistory(conversationId: string): Promise<LettaMessage[]> {
  try {
    const res = await fetch(`${LETTA_BASE_URL}/conversations/${conversationId}/messages`, {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000)
      });

    if (!res.ok) {
      throw new Error(`Letta API get history error: ${res.status}`);
    }

    const messages = await res.json();
    if (!Array.isArray(messages)) return [];

    const formatted: LettaMessage[] = [];

    for (const m of messages) {
      if (m.message_type !== 'user_message' && m.message_type !== 'assistant_message') {
        continue;
      }

      let text = m.content || '';

      if (m.message_type === 'user_message') {
        // Lọc lấy phần User Message ở cuối để ẩn System Prompt
        if (text.includes('User Message: ')) {
          text = text.split('User Message: ').slice(1).join('User Message: ');
        }
      } else if (m.message_type === 'assistant_message') {
        // Lọc lấy trường reply từ JSON trả về của AI
        try {
          let clean = text.trim();
          if (clean.startsWith('```json')) {
            clean = clean.substring(7);
          } else if (clean.startsWith('```')) {
            clean = clean.substring(3);
          }
          if (clean.endsWith('```')) {
            clean = clean.substring(0, clean.length - 3);
          }
          clean = clean.trim();

          const parsed = JSON.parse(clean);
          if (parsed && parsed.reply) {
            text = parsed.reply;
          }
        } catch (e) {
          // Fallback giữ nguyên
        }
      }

      formatted.push({
        id: m.id,
        role: m.message_type === 'user_message' ? 'user' : 'model',
        text: text,
        timestamp: m.date
      });
    }

    return formatted.reverse();
  } catch (err: any) {
    console.error('Lỗi tải lịch sử Letta:', err);
    return [];
  }
}
