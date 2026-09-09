import { fetchAxios } from '@/lib/fetchAxios';
import React, { useState, useEffect } from 'react';
import RulesEditor from '../hr/components/RulesEditor';

interface OmnirouterTabProps {
  config: { useCloud: boolean; useFallback: boolean; useMasking: boolean; useCompression: boolean; };
  setConfig: React.Dispatch<React.SetStateAction<{ useCloud: boolean; useFallback: boolean; useMasking: boolean; useCompression: boolean; }>>;
  logs: any[];
  stats: { totalTokens: number; compressedTokens: number; };
  rawMarkdownRules?: string;
  setRawMarkdownRules?: (rules: string) => void;
}

export default function OmnirouterTab({
  config,
  setConfig,
  logs,
  stats,
  rawMarkdownRules,
  setRawMarkdownRules,
}: OmnirouterTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'monitor' | 'rag'>('monitor');
  const [keysStatus, setKeysStatus] = useState<any[]>([]);
  const [modelsStatus, setModelsStatus] = useState<any>({});
  const [nvidiaModels, setNvidiaModels] = useState<string[]>([]);
  const [openRouterModels, setOpenRouterModels] = useState<string[]>([]);

  const fetchStatus = () => {
    fetchAxios('/api/ai/omni-status')
      .then(res => res.json())
      .then(data => {
        if (data.keys) setKeysStatus(data.keys);
        if (data.models) setModelsStatus(data.models);
        if (data.fallbackNvidiaModels) setNvidiaModels(data.fallbackNvidiaModels);
        if (data.fallbackOpenRouterModels) setOpenRouterModels(data.fallbackOpenRouterModels);
      })
      .catch(err => console.error("Lỗi fetch status:", err));
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Tự động làm mới mỗi 5 giây
    return () => clearInterval(interval);
  }, []);

  const formatNum = (n: number) => new Intl.NumberFormat().format(n);
  const compressedPercentage = stats.totalTokens > 0 
    ? Math.round((stats.compressedTokens / stats.totalTokens) * 100) 
    : 84;

  const estimatedSavingsUSD = (stats.compressedTokens * 0.000002).toFixed(2); // Giả lập $2 cho mỗi 1M tokens

  const renderModelList = (title: string, models: string[]) => (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 10, color: '#a1a1aa', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {models.map(m => {
          const tracker = modelsStatus[m] || { status: 'active', failureCount: 0 };
          const isCooldown = tracker.status === 'cooldown';
          return (
            <div key={m} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: 11, color: '#e4e4e7' }}>{m.split('/').pop()}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {tracker.failureCount > 0 && <span style={{ fontSize: 9, color: '#71717a' }}>Errors: {tracker.failureCount}</span>}
                <span style={{
                  fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                  background: isCooldown ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                  color: isCooldown ? '#ef4444' : '#22c55e'
                }}>
                  {isCooldown ? 'COOLDOWN' : 'OK'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Sub-tab Switcher */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
        <button
          onClick={() => setActiveSubTab('monitor')}
          className={`tab-btn ${activeSubTab === 'monitor' ? 'active' : ''}`}
          style={{
            padding: '6px 14px',
            fontSize: 12,
            borderRadius: 8,
            cursor: 'pointer',
            border: 'none',
            background: activeSubTab === 'monitor' ? 'rgba(167,139,250,0.12)' : 'transparent',
            color: activeSubTab === 'monitor' ? '#a78bfa' : '#71717a',
            fontWeight: activeSubTab === 'monitor' ? 600 : 400,
            transition: 'all 0.2s'
          }}
        >
          📊 Giám sát Token & Router
        </button>
        <button
          onClick={() => setActiveSubTab('rag')}
          className={`tab-btn ${activeSubTab === 'rag' ? 'active' : ''}`}
          style={{
            padding: '6px 14px',
            fontSize: 12,
            borderRadius: 8,
            cursor: 'pointer',
            border: 'none',
            background: activeSubTab === 'rag' ? 'rgba(167,139,250,0.12)' : 'transparent',
            color: activeSubTab === 'rag' ? '#a78bfa' : '#71717a',
            fontWeight: activeSubTab === 'rag' ? 600 : 400,
            transition: 'all 0.2s'
          }}
        >
          🧠 Cấu hình RAG & Prompt Rules
        </button>
      </div>

      {activeSubTab === 'rag' ? (
        <RulesEditor
          rawMarkdownRules={rawMarkdownRules || ''}
          setRawMarkdownRules={setRawMarkdownRules || (() => {})}
        />
      ) : (
        <>
          {/* Header section with reset button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', padding: '12px 18px', borderRadius: 12, border: '1px solid var(--border)' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fafafa' }}>Bộ định tuyến OmniRouter Dashboard</h2>
          <span style={{ fontSize: 11, color: '#71717a' }}>Giám sát lượng token tiêu thụ thật, độ trễ và nhật ký VPS thời gian thực</span>
        </div>
        <button
          onClick={() => {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('storymee_omni_logs');
              localStorage.removeItem('storymee_omni_stats');
              window.location.reload();
            }
          }}
          style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 8, color: '#ef4444', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 4 }}
          title="Xóa toàn bộ log rác cũ lưu trên cache trình duyệt của bạn"
        >
          <span>🗑️</span> Reset Local Logs & Stats
        </button>
      </div>
      
      {/* Routing Endpoints Info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div style={{ padding: '10px 14px', background: 'rgba(99,102,241,0.08)', borderRadius: 10, border: '1px solid rgba(99,102,241,0.2)' }}>
          <div style={{ fontSize: 10, color: '#a78bfa', fontWeight: 600, marginBottom: 3 }}>🔀 OMNIROUTER ENDPOINT</div>
          <div style={{ fontSize: 11, color: '#e4e4e7', fontFamily: 'monospace', wordBreak: 'break-all' }}>/api/ai/chat (Vercel → Letta)</div>
          <div style={{ fontSize: 10, color: '#52525b', marginTop: 2 }}>AI xử lý: Letta Agent (StoryMee)</div>
        </div>
        <div style={{ padding: '10px 14px', background: 'rgba(34,197,94,0.06)', borderRadius: 10, border: '1px solid rgba(34,197,94,0.15)' }}>
          <div style={{ fontSize: 10, color: '#22c55e', fontWeight: 600, marginBottom: 3 }}>🤖 LETTA AI ENGINE</div>
          <div style={{ fontSize: 11, color: '#e4e4e7', fontFamily: 'monospace', wordBreak: 'break-all' }}>VPS:8888/v1 (Self-hosted)</div>
          <div style={{ fontSize: 10, color: '#52525b', marginTop: 2 }}>Model: gemini-2.5-flash via Letta</div>
        </div>
        <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.06)', borderRadius: 10, border: '1px solid rgba(245,158,11,0.15)' }}>
          <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600, marginBottom: 3 }}>🗄️ CORE API (Postgres)</div>
          <div style={{ fontSize: 11, color: '#e4e4e7', fontFamily: 'monospace', wordBreak: 'break-all' }}>VPS:4500/api/hr</div>
          <div style={{ fontSize: 10, color: '#52525b', marginTop: 2 }}>DB: PostgreSQL (self-hosted)</div>
        </div>
      </div>

      {/* Analytics stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <div className="glass" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: '#71717a' }}>Tổng lượng Token tiêu thụ</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#fafafa' }}>{formatNum(stats.totalTokens)} <span style={{ fontSize: 11, color: '#71717a', fontWeight: 400 }}>tokens</span></span>
        </div>
        
        <div className="glass" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: '#71717a' }}>Độ nén Token (Tiết kiệm)</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#a78bfa' }}>
            {compressedPercentage}% <span style={{ fontSize: 11, color: '#71717a', fontWeight: 400 }}>({formatNum(stats.compressedTokens)} tokens)</span>
          </span>
          <div className="progress-bar" style={{ height: 4, marginTop: 4 }}>
            <div className="progress-bar-fill" style={{ width: `${compressedPercentage}%`, background: '#a78bfa' }} />
          </div>
        </div>

        <div className="glass" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: '#71717a' }}>Chi pháp tiết kiệm ước tính</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#22c55e' }}>${estimatedSavingsUSD} <span style={{ fontSize: 11, color: '#71717a', fontWeight: 400 }}>USD</span></span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 14 }}>
        {/* Left: Live Routing Logs */}
        <div className="glass" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fafafa' }}>NHẬT KÝ ĐỊNH TUYẾN THỜI GIAN THỰC (LIVE ROUTING LOGS)</h3>
            <span style={{ fontSize: 11, color: '#71717a' }}>Theo dõi các cuộc gọi và trễ mạng (latency) từ VPS</span>
          </div>

          <div style={{ maxHeight: '100%', minHeight: 420, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, color: '#a1a1aa', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)' }}>
                  <th style={{ padding: '8px 10px', color: '#71717a' }}>THỜI GIAN</th>
                  <th style={{ padding: '8px 10px', color: '#71717a' }}>PROVIDER</th>
                  <th style={{ padding: '8px 10px', color: '#71717a' }}>MODEL AI</th>
                  <th style={{ padding: '8px 10px', color: '#71717a' }}>ENDPOINT</th>
                  <th style={{ padding: '8px 10px', color: '#71717a', textAlign: 'right' }}>ĐỘ TRỄ</th>
                  <th style={{ padding: '8px 10px', color: '#71717a', textAlign: 'center' }}>TRẠNG THÁI</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{log.timestamp}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 600, color: '#a78bfa' }}>{log.provider || 'Gemini Native'}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 600, color: '#e4e4e7' }}>{log.model}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{
                        padding: '2px 7px',
                        borderRadius: 4,
                        fontSize: 9,
                        fontWeight: 600,
                        background: log.status?.includes('Letta') ? 'rgba(99,102,241,0.12)' : 'rgba(245,158,11,0.1)',
                        color: log.status?.includes('Letta') ? '#818cf8' : '#f59e0b'
                      }}>
                        {log.status?.includes('Letta') ? '🔀 OmniRouter' : '⚡ Gemini'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{log.latency} ms</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 9,
                        fontWeight: 600,
                        background: log.status.includes('Success') ? 'rgba(34, 197, 94, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                        color: log.status.includes('Success') ? '#22c55e' : '#f59e0b'
                      }}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: AI Engine Configurations & Cloud Token Pools */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="glass" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: 11, color: '#71717a', fontWeight: 600 }}>CẤU HÌNH BỘ ĐỊNH TUYẾN AI ENGINE</span>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#fafafa', cursor: 'pointer' }}>
                <span>Sử dụng OmniRoute Cloud</span>
                <input type="checkbox" checked={config.useCloud} onChange={e => setConfig(prev => ({ ...prev, useCloud: e.target.checked }))} style={{ width: 14, height: 14, accentColor: '#a78bfa' }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#fafafa', cursor: 'pointer' }}>
                <span>Tự động Fallback đứt cáp</span>
                <input type="checkbox" checked={config.useFallback} onChange={e => setConfig(prev => ({ ...prev, useFallback: e.target.checked }))} style={{ width: 14, height: 14, accentColor: '#a78bfa' }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#fafafa', cursor: 'pointer' }}>
                <span>Mã hóa ẩn danh (Data Masking)</span>
                <input type="checkbox" checked={config.useMasking} onChange={e => setConfig(prev => ({ ...prev, useMasking: e.target.checked }))} style={{ width: 14, height: 14, accentColor: '#a78bfa' }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#fafafa', cursor: 'pointer' }}>
                <span>Nén prompt tối cổ (Caveman)</span>
                <input type="checkbox" checked={config.useCompression} onChange={e => setConfig(prev => ({ ...prev, useCompression: e.target.checked }))} style={{ width: 14, height: 14, accentColor: '#a78bfa' }} />
              </label>
            </div>
          </div>
          
          <div className="glass" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: 11, color: '#71717a', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>DANH SÁCH XOAY VÒNG MODEL FREE</span>
              <button 
                onClick={fetchStatus}
                style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: 11 }}
              >
                🔄
              </button>
            </span>

            {renderModelList('NVIDIA (nvidia-auto)', nvidiaModels)}
            {renderModelList('OPENROUTER (openrouter-auto)', openRouterModels)}
            
            {(nvidiaModels.length === 0 && openRouterModels.length === 0) && (
              <div style={{ fontSize: 11, color: '#71717a', textAlign: 'center', padding: '10px 0' }}>Đang kết nối Omni Hub...</div>
            )}
          </div>
          
          <div className="glass" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: 11, color: '#71717a', fontWeight: 600 }}>TRẠNG THÁI API KEYS</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {keysStatus.map((m: any, i: number) => {
                const isCooldown = m.cooldownUntil && new Date(m.cooldownUntil).getTime() > Date.now();
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#fafafa' }}>{m.id}</span>
                      <span style={{
                        fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                        background: isCooldown ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                        color: isCooldown ? '#ef4444' : '#22c55e'
                      }}>
                        {isCooldown ? 'COOLDOWN' : 'ACTIVE'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: '#a1a1aa' }}>Provider: {m.provider.toUpperCase()}</span>
                      <span style={{ fontSize: 10, color: '#71717a' }}>Errors: {m.failureCount}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  )}
</div>
  );
}
