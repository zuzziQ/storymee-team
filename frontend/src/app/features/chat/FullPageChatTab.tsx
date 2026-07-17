import React from 'react';
import { Bot, Calendar, Clock, Flag, Send } from 'lucide-react';
import { ChatMessage, renderFormattedText } from '../../constants';

interface FullPageChatTabProps {
  aiChatMessages: ChatMessage[];
  aiChatInput: string;
  setAiChatInput: (val: string) => void;
  aiChatLoading: boolean;
  handleSendAiChat: (customText?: string) => void;
  handleAutoSendChat: (customText: string) => void;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
}

export default function FullPageChatTab({
  aiChatMessages,
  aiChatInput,
  setAiChatInput,
  aiChatLoading,
  handleSendAiChat,
  handleAutoSendChat,
  chatEndRef
}: FullPageChatTabProps) {
  return (
    <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 120px)', overflow: 'hidden' }}>
      {/* Left Column: Assistant Info & Quick Actions */}
      <div className="glass" style={{ width: 280, display: 'flex', flexDirection: 'column', padding: '20px 18px', gap: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot size={18} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#fafafa' }}>Trợ lý AI Storymee</div>
            <div style={{ fontSize: 10, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} /> Hoạt động</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thao tác nhanh</span>
          
          <button
            className="btn-ghost"
            onClick={() => {
              const inp = `Tôi muốn xin nghỉ phép từ ngày 30/06 đến 02/07 vì lý do sức khỏe. Trợ lý hỗ trợ đề xuất đơn xin nghỉ giúp tôi.`;
              handleAutoSendChat(inp);
            }}
            style={{ justifyContent: 'flex-start', width: '100%', fontSize: 12, padding: '8px 12px', gap: 8 }}
          >
            <Calendar size={13} color="#f59e0b" /> Xin nghỉ phép
          </button>

          <button
            className="btn-ghost"
            onClick={() => {
              const inp = `Tôi muốn xin hoãn/delay task T-103 đến ngày 05/07/2026 vì cần thêm thời gian viết handler onDrop. Trợ lý đề xuất giúp tôi.`;
              handleAutoSendChat(inp);
            }}
            style={{ justifyContent: 'flex-start', width: '100%', fontSize: 12, padding: '8px 12px', gap: 8 }}
          >
            <Clock size={13} color="#ef4444" /> Xin hoãn/delay task
          </button>

          <button
            className="btn-ghost"
            onClick={() => {
              const inp = `Hãy tóm tắt và báo cáo tiến độ dự án Phát triển WebApp StorymeeTeam hiện tại, chỉ ra các công việc đang chạy và rủi ro.`;
              handleAutoSendChat(inp);
            }}
            style={{ justifyContent: 'flex-start', width: '100%', fontSize: 12, padding: '8px 12px', gap: 8 }}
          >
            <Flag size={13} color="#3b82f6" /> Báo cáo dự án
          </button>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, fontSize: 11, color: '#71717a', lineHeight: 1.4, marginTop: 'auto' }}>
          💡 Trợ lý AI liên kết trực tiếp với dữ liệu Kanban thực tế của bạn, cho phép bạn cập nhật hoặc truy vấn công việc bằng ngôn ngữ tự nhiên.
        </div>
      </div>

      {/* Right Column: Chat area */}
      <div className="glass" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Chat Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {aiChatMessages.map(m => (
            <div key={m.id} style={{ display: 'flex', gap: 10, justifyContent: m.sender === 'user' ? 'flex-end' : 'flex-start' }}>
              {m.sender === 'ai' && (
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Bot size={14} />
                </div>
              )}
              <div
                style={{
                  maxWidth: '70%',
                  padding: '10px 14px',
                  borderRadius: 14,
                  fontSize: 13,
                  lineHeight: 1.4,
                  background: m.sender === 'user' ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'rgba(255,255,255,0.03)',
                  border: m.sender === 'user' ? 'none' : '1px solid rgba(255,255,255,0.04)',
                  color: m.sender === 'user' ? 'white' : '#fafafa',
                  whiteSpace: 'pre-line'
                }}
              >
                {renderFormattedText(m.text)}
              </div>
            </div>
          ))}
          {aiChatLoading && (
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Bot size={14} />
              </div>
              <div style={{ padding: '10px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)', color: '#71717a', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="dot-blink" style={{ width: 5, height: 5, borderRadius: '50%', background: '#71717a' }} />
                <span className="dot-blink" style={{ width: 5, height: 5, borderRadius: '50%', background: '#71717a', animationDelay: '0.2s' }} />
                <span className="dot-blink" style={{ width: 5, height: 5, borderRadius: '50%', background: '#71717a', animationDelay: '0.4s' }} />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <div style={{ padding: 14, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(0,0,0,0.15)' }}>
          <input
            className="input-dark"
            placeholder="Nhập yêu cầu, ví dụ: 'Thống kê công việc của Minh'..."
            value={aiChatInput}
            onChange={e => setAiChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { if (e.nativeEvent.isComposing) return; e.preventDefault(); handleSendAiChat(); } }}
            style={{ flex: 1, padding: '10px 14px', borderRadius: 10 }}
          />
          <button
            onClick={() => handleSendAiChat()}
            disabled={!aiChatInput.trim() || aiChatLoading}
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: aiChatInput.trim() ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.05)',
              border: 'none',
              cursor: aiChatInput.trim() ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
          >
            <Send size={14} color={aiChatInput.trim() ? 'white' : '#52525b'} />
          </button>
        </div>
      </div>
    </div>
  );
}
