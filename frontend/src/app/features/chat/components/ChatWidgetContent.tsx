import { fetchAxios } from '@/lib/fetchAxios';
import React, { useState, useRef, useEffect } from 'react';
import { Bot, Calendar, Laptop, Clock, Maximize2, Minimize2, X, MessageSquare, MicOff, Mic, Send } from 'lucide-react';
import {
  Priority, Task, TeamMember, DraftTask, ChatMessage,
  COMPANY_RULES, getInitials, getMemberColor
} from '../../../constants';
import { coreApiClient } from '../../../../lib/apiClient';
import { API_ROUTES } from '@/lib/apiClient';

const API_BASE = '';

// ===================== RULES RAG HELPERS =====================
export function parseMarkdownRules(mdText: string) {
  if (!mdText) return [];
  const blocks = mdText.split(/###\s*(?=ĐIỀU|Chương)/gi);
  return blocks.map(block => {
    const lines = block.trim().split('\n');
    const title = lines[0]?.replace(/^###\s*/, '').trim() || 'Quy định bổ sung';
    const content = lines.slice(1).join('\n').trim();
    const keywords = title.toLowerCase()
      .replace(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹ\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2);

    return { title, content, keywords };
  });
}

export function filterRelevantRules(message: string, rawRules: string): string {
  if (!rawRules) return '';
  const m = message.toLowerCase();
  const parsedRules = parseMarkdownRules(rawRules);
  let relevantContent = '';

  parsedRules.forEach(rule => {
    const titleMatch = rule.title.toLowerCase().includes(m) || m.includes(rule.title.toLowerCase());
    const kwMatch = rule.keywords.some(kw => m.includes(kw));
    if (titleMatch || kwMatch) {
      relevantContent += `### ${rule.title}\n${rule.content}\n\n`;
    }
  });

  return relevantContent.trim();
}

// ===================== CHAT WIDGET CONTENT =====================
export function ChatWidgetContent({
  currentUser,
  tasks = [],
  onUpdate,
  onCreateTask,
  onClose,
  chatLayout,
  setChatLayout,
  onAddRoutingLog,
  omniConfig,
  rawMarkdownRules
}: {
  currentUser: TeamMember;
  tasks?: Task[];
  onUpdate?: (t: Task) => void;
  onCreateTask?: (title: string, assignee: string, estimate: number, priority: Priority) => void;
  onClose: () => void;
  chatLayout: 'popup' | 'sidebar';
  setChatLayout: (l: 'popup' | 'sidebar') => void;
  onAddRoutingLog?: (log: any, sentTokens: number) => void;
  omniConfig?: any;
  rawMarkdownRules?: string;
}) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<any>(null);
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Form states inside widget
  const [showRequestForm, setShowRequestForm] = useState<'leave' | 'remote' | 'delay' | null>(null);
  const [formDate, setFormDate] = useState('2026-06-30');
  const [formSession, setFormSession] = useState<'all' | 'am' | 'pm'>('all');
  const [formReason, setFormReason] = useState('');

  // Delay task form states
  const myOpenTasks = tasks.filter(t => t.assignee === currentUser.name && t.status !== 'Done');
  const [delayTaskId, setDelayTaskId] = useState('');
  const [delayNewDeadline, setDelayNewDeadline] = useState('2026-07-05');
  const [delayReason, setDelayReason] = useState('');

  useEffect(() => {
    if (myOpenTasks.length > 0 && !delayTaskId) {
      setDelayTaskId(myOpenTasks[0].id);
    }
  }, [myOpenTasks, delayTaskId]);

  useEffect(() => {
    async function loadHistory() {
      if (!currentUser?.email) return;
      try {
        const res = await fetchAxios(`/api/ai/chat?email=${encodeURIComponent(currentUser.email)}&name=${encodeURIComponent(currentUser.name)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.status === 'success' && Array.isArray(json.history) && json.history.length > 0) {
            const mapped = json.history.map((m: any) => ({
              id: m.id,
              sender: m.role === 'user' ? 'user' : 'ai',
              text: m.text
            }));
            setMsgs(mapped);
            return;
          }
        }
      } catch (e) {
        console.error("Lỗi load history Letta cho widget:", e);
      }
      setMsgs([
        { id: '1', sender: 'ai', text: `Chào ${currentUser.name}! Tôi là trợ lý AI thông minh kết nối với dữ liệu dự án của bạn. Tôi có thể giúp bạn truy vấn trạng thái công việc, xin nghỉ phép hoặc cập nhật thời hạn công việc (delay task).` }
      ]);
    }
    loadHistory();
  }, [currentUser]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  async function handleConfirmAction() {
    if (!pendingAction) return;
    const { action, payload } = pendingAction;
    setLoading(true);
    try {
      if (action === 'update_task' && onUpdate) {
        const targetTask = tasks.find(t => t.id === payload.id);
        if (targetTask) {
          onUpdate({ ...targetTask, ...payload });
          setMsgs(prev => [...prev, {
            id: Date.now().toString(),
            sender: 'ai',
            text: `✅ **Đã xác nhận cập nhật thành công công việc ${payload.id}!**`
          }]);
        }
      } else if (action === 'create_task' && onCreateTask) {
        onCreateTask(
          payload.title || 'Task mới từ AI',
          payload.assignee || currentUser.name,
          payload.estimate || 4,
          payload.priority || 'Medium'
        );
        setMsgs(prev => [...prev, {
          id: Date.now().toString(),
          sender: 'ai',
          text: `✅ **Đã xác nhận tạo công việc mới "${payload.title}" thành công!**`
        }]);
      } else if (action === 'leave_request') {
        try {
          const membersData = await coreApiClient.get(API_ROUTES.HR.TEAM_MEMBERS);
          if (membersData.status === 'success') {
            const member = membersData.data?.find((m: any) => (m?.email || '').toLowerCase() === (currentUser?.email || '').toLowerCase());
            if (member) {
              await coreApiClient.post(API_ROUTES.HR.LEAVE_REQUESTS, {
                memberId: member.id,
                leaveType: payload.leaveType,
                startDate: payload.startDate,
                endDate: payload.endDate,
                reason: payload.reason || 'Nghỉ phép qua AI'
              });
              setMsgs(prev => [...prev, {
                id: Date.now().toString(),
                sender: 'ai',
                text: `✅ **Đăng ký nghỉ phép thành công!**\n• Loại phép: *${payload.leaveType}*\n• Thời gian: *${payload.startDate}* đến *${payload.endDate}*`
              }]);
            }
          }
        } catch (err) {
          throw new Error('Lỗi gửi yêu cầu phép lên Core API');
        }
      }
      setPendingAction(null);
    } catch (err) {
      console.error(err);
      setMsgs(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: `❌ Gặp lỗi khi thực hiện hành động.` }]);
    }
    setLoading(false);
  }

  function handleCancelAction() {
    if (!pendingAction) return;
    setMsgs(prev => [...prev, {
      id: Date.now().toString(),
      sender: 'ai',
      text: `❌ **Đã hủy yêu cầu.**`
    }]);
    setPendingAction(null);
  }

  async function send(customText?: string) {
    const textToSend = customText || input;
    if (!textToSend.trim() || loading) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), sender: 'user', text: textToSend };
    setMsgs(prev => [...prev, userMsg]);
    if (!customText) setInput('');
    setLoading(true);

    try {
      const res = await fetchAxios('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          tasks: tasks,
          projects: [],
          currentUser: currentUser,
          config: omniConfig,
          companyRules: filterRelevantRules(textToSend, rawMarkdownRules || '')
        })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success') {
          const replyId = (Date.now() + 1).toString();
          const aiMsg: ChatMessage = { id: replyId, sender: 'ai', text: json.data.reply };
          setMsgs(prev => [...prev, aiMsg]);
          
          if (json.log && onAddRoutingLog) {
            const sent = textToSend.length * 0.75 + 1500;
            onAddRoutingLog(json.log, sent);
          }

          if (['update_task', 'create_task', 'leave_request'].includes(json.data.action)) {
            setPendingAction({
              action: json.data.action,
              payload: json.data.action === 'leave_request' ? json.data.leavePayload : json.data.taskPayload,
              replyId: replyId
            });
          }
        }
      } else {
        throw new Error('API error');
      }
    } catch (err) {
      console.error(err);
      const reply = generateLocalReply(textToSend, currentUser);
      setMsgs(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: reply }]);
    }
    setLoading(false);
  }

  function generateLocalReply(msg: string, user: TeamMember): string {
    const m = msg.toLowerCase();
    if (m.includes('task') || m.includes('công việc')) {
      const myTasks = tasks.filter(t => t.assignee === user.name && t.status !== 'Done');
      if (!myTasks.length) return `Bạn không có task nào đang mở 🎉`;
      return `Danh sách task của bạn:\n${myTasks.map(t => `• **${t.id}** - ${t.title} (${t.status})`).join('\n')}`;
    }
    if (m.includes('nghỉ') || m.includes('leave')) return `Đã ghi nhận yêu cầu xin nghỉ của bạn. Đang thông báo cho quản lý... ⏳`;
    if (m.includes('remote')) return `Đã ghi nhận yêu cầu làm remote của bạn. Trợ lý AI đang lập đề xuất duyệt phép... ⏳`;
    if (m.includes('hoãn') || m.includes('delay') || m.includes('lùi')) return `Đã cập nhật gia hạn hạn chót cho task của bạn trên Kanban.`;
    if (m.includes('báo cáo') || m.includes('tiến độ')) return `Tiến độ chung của team đang đạt **62%**. Cần hoàn thành các task In Progress.`;
    if (m.includes('chào') || m.includes('hello')) return `Chào ${user.name}! Tôi đây, bạn cần giúp gì không?`;
    return `Tôi đã nhận yêu cầu của bạn. Hãy mô tả chi tiết hơn để tôi xử lý chính xác nhé.`;
  }

  function startRecording() {
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'vi-VN'; rec.continuous = false; rec.interimResults = false;
    rec.onresult = (e: any) => setInput(e.results[0][0].transcript);
    rec.onend = () => setRecording(false);
    rec.start();
    recognitionRef.current = rec;
    setRecording(true);
  }

  function stopRecording() { recognitionRef.current?.stop(); setRecording(false); }

  function formatMsg(text: string) {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>');
  }

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden', background: 'transparent' }}>
      {/* LEFT SIDEBAR: QUICK ACTIONS (RỘNG 50PX) */}
      <div
        style={{
          width: 50,
          height: '100%',
          background: 'rgba(15,15,17,0.98)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '16px 0',
          gap: 16,
          flexShrink: 0
        }}
      >
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <Bot size={14} color="white" />
        </div>

        <button
          onClick={() => setShowRequestForm(prev => prev === 'leave' ? null : 'leave')}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: 'none',
            background: showRequestForm === 'leave' ? 'rgba(245,158,11,0.12)' : 'transparent',
            color: showRequestForm === 'leave' ? '#f59e0b' : '#71717a',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          title="Đăng ký Nghỉ phép"
        >
          <Calendar size={15} />
        </button>

        <button
          onClick={() => setShowRequestForm(prev => prev === 'remote' ? null : 'remote')}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: 'none',
            background: showRequestForm === 'remote' ? 'rgba(139,92,246,0.12)' : 'transparent',
            color: showRequestForm === 'remote' ? '#a78bfa' : '#71717a',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          title="Đăng ký Làm Remote"
        >
          <Laptop size={15} />
        </button>

        <button
          onClick={() => setShowRequestForm(prev => prev === 'delay' ? null : 'delay')}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: 'none',
            background: showRequestForm === 'delay' ? 'rgba(239,68,68,0.12)' : 'transparent',
            color: showRequestForm === 'delay' ? '#ef4444' : '#71717a',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          title="Xin hoãn Task (Delay)"
        >
          <Clock size={15} />
        </button>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => setChatLayout(chatLayout === 'popup' ? 'sidebar' : 'popup')}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: 'none',
            background: 'rgba(255,255,255,0.04)',
            color: '#71717a',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          title={chatLayout === 'popup' ? 'Chuyển sang Sidebar' : 'Chuyển sang Hộp thoại nổi'}
        >
          {chatLayout === 'popup' ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
        </button>
      </div>

      {/* RIGHT SIDE: CHAT AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: '#121214' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.01)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#fafafa' }}>Trợ lý AI Storymee</div>
            <div style={{ fontSize: 11, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
              Chế độ {chatLayout === 'sidebar' ? 'Bên rìa (Sidebar)' : 'Cửa sổ nổi'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', padding: 4 }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {msgs.map(m => (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: m.sender === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ display: 'flex', gap: 10, justifyContent: m.sender === 'user' ? 'flex-end' : 'flex-start', width: '100%' }}>
                {m.sender === 'ai' && (
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Bot size={14} />
                  </div>
                )}
                <div
                  style={{
                    maxWidth: '75%',
                    padding: '10px 14px',
                    borderRadius: 14,
                    fontSize: 13,
                    lineHeight: 1.4,
                    background: m.sender === 'user' ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'rgba(255,255,255,0.03)',
                    border: m.sender === 'user' ? 'none' : '1px solid rgba(255,255,255,0.04)',
                    color: m.sender === 'user' ? 'white' : '#fafafa'
                  }}
                  dangerouslySetInnerHTML={{ __html: formatMsg(m.text) }}
                />
              </div>

              {pendingAction && pendingAction.replyId === m.id && (
                <div style={{
                  marginLeft: 38,
                  marginTop: 4,
                  padding: 12,
                  borderRadius: 10,
                  background: 'rgba(139,92,246,0.06)',
                  border: '1px solid rgba(139,92,246,0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  maxWidth: '70%'
                }}>
                  <div style={{ fontSize: 10, color: '#a78bfa', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>💡</span> YÊU CẦU XÁC NHẬN HÀNH ĐỘNG
                  </div>
                  <div style={{ fontSize: 11, color: '#e4e4e7', lineHeight: 1.4 }}>
                    {pendingAction.action === 'leave_request' ? (
                      <>
                        Bạn muốn đăng ký nghỉ phép:
                        <ul style={{ margin: '4px 0', paddingLeft: 16, color: '#a1a1aa' }}>
                          <li>Loại phép: <strong>{pendingAction.payload.leaveType === 'sick' ? 'Nghỉ ốm' : pendingAction.payload.leaveType === 'annual' ? 'Nghỉ phép năm' : 'Nghỉ việc riêng'}</strong></li>
                          <li>Thời gian: <strong>{pendingAction.payload.startDate}</strong> đến <strong>{pendingAction.payload.endDate}</strong></li>
                          <li>Lý do: <em>{pendingAction.payload.reason || 'Nghỉ phép qua AI'}</em></li>
                        </ul>
                      </>
                    ) : pendingAction.action === 'update_task' ? (
                      <>
                        Bạn muốn cập nhật task <strong>{pendingAction.payload.id}</strong>:
                        <ul style={{ margin: '4px 0', paddingLeft: 16, color: '#a1a1aa' }}>
                          {pendingAction.payload.status && <li>Trạng thái: <strong>{pendingAction.payload.status}</strong></li>}
                          {pendingAction.payload.assignee && <li>Phụ trách: <strong>{pendingAction.payload.assignee}</strong></li>}
                          {pendingAction.payload.deadline && <li>Hạn chót: <strong>{pendingAction.payload.deadline}</strong></li>}
                        </ul>
                      </>
                    ) : (
                      <>
                        Bạn muốn tạo task mới <strong>{pendingAction.payload.title}</strong>:
                        <ul style={{ margin: '4px 0', paddingLeft: 16, color: '#a1a1aa' }}>
                          <li>Phụ trách: <strong>{pendingAction.payload.assignee || currentUser.name}</strong></li>
                          <li>Ước tính: <strong>{pendingAction.payload.estimate || 4}h</strong></li>
                          <li>Độ ưu tiên: <strong>{pendingAction.payload.priority || 'Medium'}</strong></li>
                        </ul>
                      </>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button
                      onClick={handleConfirmAction}
                      style={{
                        flex: 1,
                        padding: '6px 12px',
                        borderRadius: 6,
                        background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                        color: 'white',
                        fontSize: 11,
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'opacity 0.2s'
                      }}
                    >
                      Xác nhận
                    </button>
                    <button
                      onClick={handleCancelAction}
                      style={{
                        flex: 1,
                        padding: '6px 12px',
                        borderRadius: 6,
                        background: 'rgba(255,255,255,0.06)',
                        color: '#e4e4e7',
                        fontSize: 11,
                        border: '1px solid rgba(255,255,255,0.1)',
                        cursor: 'pointer'
                      }}
                    >
                      Hủy bỏ
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Bot size={14} />
              </div>
              <div style={{ padding: '10px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#71717a', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                {[0, 1, 2].map(i => (
                  <span key={i} className="dot-blink" style={{ width: 5, height: 5, borderRadius: '50%', background: '#71717a', animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {showRequestForm && (
          <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {showRequestForm === 'delay' ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={13} /> Đề xuất gia hạn deadline task
                  </span>
                  <button onClick={() => setShowRequestForm(null)} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: 11 }}>Đóng</button>
                </div>
                
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1.2 }}>
                    <span style={{ fontSize: 9, color: '#71717a' }}>Chọn task cần lùi</span>
                    <select className="input-dark" value={delayTaskId} onChange={e => setDelayTaskId(e.target.value)} style={{ padding: '6px 8px', fontSize: 11, borderRadius: 6, background: '#18181b', color: '#fafafa', width: '100%' }}>
                      {myOpenTasks.map(t => (
                        <option key={t.id} value={t.id}>{t.id} – {t.title.slice(0, 20)}...</option>
                      ))}
                      {myOpenTasks.length === 0 && <option value="">Không có task mở</option>}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 0.8 }}>
                    <span style={{ fontSize: 9, color: '#71717a' }}>Hạn chót mới</span>
                    <input type="date" className="input-dark" value={delayNewDeadline} onChange={e => setDelayNewDeadline(e.target.value)} style={{ padding: '6px 8px', fontSize: 11, borderRadius: 6 }} />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 9, color: '#71717a' }}>Lý do chậm tiến độ</span>
                  <input className="input-dark" placeholder="Mô tả lý do..." value={delayReason} onChange={e => setDelayReason(e.target.value)} style={{ padding: '6px 8px', fontSize: 11, borderRadius: 6 }} />
                </div>

                <button
                  className="btn-primary"
                  onClick={() => {
                    if (!delayTaskId) return;
                    const formattedDate = delayNewDeadline.split('-').reverse().join('/');
                    const promptMsg = `Xin lùi deadline task ${delayTaskId} sang ngày ${formattedDate}. Lý do: ${delayReason || 'Gặp khó khăn kỹ thuật ngoài dự kiến'}.`;
                    send(promptMsg);
                    setShowRequestForm(null);
                    setDelayReason('');
                  }}
                  style={{ padding: '6px 12px', fontSize: 11, alignSelf: 'flex-end', background: '#ef4444', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'white' }}
                >
                  Gửi đề xuất
                </button>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: showRequestForm === 'leave' ? '#f59e0b' : '#8b5cf6', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {showRequestForm === 'leave' ? <Calendar size={13} /> : <Laptop size={13} />}
                    Đăng ký {showRequestForm === 'leave' ? 'Nghỉ phép' : 'Làm Remote'}
                  </span>
                  <button onClick={() => setShowRequestForm(null)} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: 11 }}>Đóng</button>
                </div>
                
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                    <span style={{ fontSize: 9, color: '#71717a' }}>Chọn ngày</span>
                    <input type="date" className="input-dark" value={formDate} onChange={e => setFormDate(e.target.value)} style={{ padding: '6px 8px', fontSize: 11, borderRadius: 6 }} />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                    <span style={{ fontSize: 9, color: '#71717a' }}>Khung giờ</span>
                    <select className="input-dark" value={formSession} onChange={e => setFormSession(e.target.value as any)} style={{ padding: '6px 8px', fontSize: 11, borderRadius: 6, background: '#18181b', color: '#fafafa' }}>
                      <option value="all">Cả ngày (1.0)</option>
                      <option value="am">Sáng (0.5)</option>
                      <option value="pm">Chiều (0.5)</option>
                    </select>
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 9, color: '#71717a' }}>Lý do cụ thể</span>
                  <input className="input-dark" placeholder="Nhập lý do..." value={formReason} onChange={e => setFormReason(e.target.value)} style={{ padding: '6px 8px', fontSize: 11, borderRadius: 6 }} />
                </div>
                
                <button
                  className="btn-primary"
                  onClick={() => {
                    const typeText = showRequestForm === 'leave' ? 'nghỉ phép' : 'làm remote';
                    const sessionText = formSession === 'all' ? 'Cả ngày' : formSession === 'am' ? 'buổi Sáng' : 'buổi Chiều';
                    const promptMsg = `Đăng ký ${typeText} ${sessionText} ngày ${formDate.split('-').reverse().join('/')}. Lý do: ${formReason || 'Giải quyết công việc cá nhân'}.`;
                    send(promptMsg);
                    setShowRequestForm(null);
                    setFormReason('');
                  }}
                  style={{ padding: '6px 12px', fontSize: 11, alignSelf: 'flex-end', background: '#6366f1', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'white' }}
                >
                  Gửi yêu cầu
                </button>
              </>
            )}
          </div>
        )}

        <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(0,0,0,0.15)' }}>
          <input
            className="input-dark"
            style={{ flex: 1, borderRadius: 10 }}
            placeholder="Nhập yêu cầu..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { if (e.nativeEvent.isComposing) return; e.preventDefault(); send(); } }}
          />
          <button onClick={recording ? stopRecording : startRecording} style={{ width: 34, height: 34, borderRadius: 8, background: recording ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${recording ? '#ef4444' : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {recording ? <MicOff size={13} color="#ef4444" /> : <Mic size={13} color="#71717a" />}
          </button>
          <button onClick={() => send()} disabled={!input.trim() || loading} style={{ width: 34, height: 34, borderRadius: 8, background: input.trim() ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : 'rgba(255,255,255,0.05)', border: 'none', cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Send size={13} color={input.trim() ? 'white' : '#52525b'} />
          </button>
        </div>
      </div>
    </div>
  );
}
