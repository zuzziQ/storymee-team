import { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../../../constants';
import { COMPANY_RULES } from '../../../constants';
import { filterRelevantRules } from '../../chat/components/ChatWidgetContent';
import { fetchAxios } from '@/lib/fetchAxios';

export function useChatState() {
  const [aiChatMessages, setAiChatMessages] = useState<ChatMessage[]>([
    { id: '1', sender: 'ai', text: 'Chào sếp và các nhân sự Storymee! Tôi là trợ lý AI thông minh kết nối với dữ liệu dự án của bạn. Tôi có thể giúp bạn truy vấn trạng thái công việc, xin nghỉ phép hoặc cập nhật thời hạn công việc (delay task).' }
  ]);
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLayout, setChatLayout] = useState<'popup' | 'sidebar'>('popup');

  const [omniConfig, setOmniConfig] = useState({
    useCloud: true, useFallback: true, useMasking: true, useCompression: true
  });
  const [routingLogs, setRoutingLogs] = useState<any[]>([]);
  const [tokenStats, setTokenStats] = useState({ totalTokens: 0, compressedTokens: 0 });
  const [rawMarkdownRules, setRawMarkdownRules] = useState<string>('');

  // Load from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('storymee_company_rules');
      setRawMarkdownRules(saved || COMPANY_RULES);
      if (!saved) localStorage.setItem('storymee_company_rules', COMPANY_RULES);

      const savedConfig = localStorage.getItem('storymee_omni_config');
      if (savedConfig) setOmniConfig(JSON.parse(savedConfig));

      const savedLogs = localStorage.getItem('storymee_omni_logs');
      if (savedLogs) setRoutingLogs(JSON.parse(savedLogs));

      const savedStats = localStorage.getItem('storymee_omni_stats');
      if (savedStats) setTokenStats(JSON.parse(savedStats));
    }
  }, []);

  useEffect(() => { localStorage.setItem('storymee_omni_config', JSON.stringify(omniConfig)); }, [omniConfig]);
  useEffect(() => { localStorage.setItem('storymee_omni_stats', JSON.stringify(tokenStats)); }, [tokenStats]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [aiChatMessages]);

  const handleSendAiChat = async (
    customText: string | undefined,
    { tasks, projects, activeUser, omniCfg, rules }: {
      tasks: any[]; projects: any[]; activeUser: any;
      omniCfg: typeof omniConfig; rules: string;
    }
  ) => {
    const textToSend = customText || aiChatInput;
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = { id: `m-${Date.now()}`, sender: 'user', text: textToSend };
    setAiChatMessages(prev => [...prev, userMsg]);
    if (!customText) setAiChatInput('');
    setAiChatLoading(true);

    try {
      const res = await fetchAxios('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: aiChatMessages.map(m => ({ role: m.sender === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })),
          tasks,
          projects,
          currentUser: activeUser,
          config: omniCfg,
          companyRules: filterRelevantRules(textToSend, rules)
        })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success' || json.success === true) {
          const aiMsg: ChatMessage = { id: `m-${Date.now() + 1}`, sender: 'ai', text: json.data.reply };
          setAiChatMessages(prev => [...prev, aiMsg]);
          if (json.log) {
            setRoutingLogs(prev => [json.log, ...prev]);
            const sent = textToSend.length * 0.75 + 1500;
            const saved = omniCfg.useCompression ? sent * 0.8 : 0;
            setTokenStats(prev => ({
              totalTokens: Math.round(prev.totalTokens + sent),
              compressedTokens: Math.round(prev.compressedTokens + saved)
            }));
          }
          return json.data; // Caller can handle AI actions
        }
      } else {
        throw new Error('Lỗi gọi API chat');
      }
    } catch (err) {
      console.error(err);
      const errorMsg: ChatMessage = {
        id: `m-${Date.now() + 1}`, sender: 'ai',
        text: 'Có lỗi xảy ra khi kết nối với trợ lý AI. Vui lòng kiểm tra lại API key hoặc kết nối internet.'
      };
      setAiChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setAiChatLoading(false);
    }
  };

  const fetchServerLogs = async () => {
    try {
      const res = await fetchAxios('/api/ai/logs');
      if (res.ok) {
        const json = await res.json();
        if ((json.status === 'success' || json.success === true) && Array.isArray(json.data)) {
          setRoutingLogs(json.data);
          let total = 0, compressed = 0;
          json.data.forEach((l: any) => {
            if (l.tokens !== undefined) { total += l.tokens; compressed += l.compressed || 0; }
            else { total += 2250; compressed += 1800; }
          });
          setTokenStats({ totalTokens: total, compressedTokens: compressed });
        }
      }
    } catch (err) {
      console.error('Lỗi fetch logs:', err);
    }
  };

  return {
    aiChatMessages,
    setAiChatMessages,
    aiChatInput,
    setAiChatInput,
    aiChatLoading,
    chatEndRef,
    chatOpen,
    setChatOpen,
    chatLayout,
    setChatLayout,
    omniConfig,
    setOmniConfig,
    routingLogs,
    setRoutingLogs,
    tokenStats,
    setTokenStats,
    rawMarkdownRules,
    setRawMarkdownRules,
    handleSendAiChat,
    fetchServerLogs,
  };
}
