import React from 'react';
import { LayoutDashboard, Layers, KanbanSquare, Bot, Users, Zap, Settings, Sparkles, Calendar } from 'lucide-react';
import { TeamMember } from '../../../constants';
import { isTeamAdmin } from '@/lib/teamAuth';

interface SidebarNavProps {
  tab: string;
  setTab: (tab: string) => void;
  hrSubTab: 'profile' | 'attendance' | 'leaves' | 'payroll' | 'importer' | 'accounts';
  setHrSubTab: (subTab: 'profile' | 'attendance' | 'leaves' | 'payroll' | 'importer' | 'accounts') => void;
  activeUser: TeamMember;
}

const TABS = [
  { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'projects', label: 'Dự án lớn', icon: Layers },
  { id: 'kanban', label: 'Kanban', icon: KanbanSquare },
  { id: 'chat', label: 'Trợ lý AI', icon: Bot },
  { id: 'hr', label: 'Nhân sự', icon: Users },
  { id: 'meetings', label: 'Lịch họp', icon: Calendar },
  { id: 'omnirouter', label: 'OmniRouter', icon: Zap },
];

export default function SidebarNav({
  tab,
  setTab,
  hrSubTab,
  setHrSubTab,
  activeUser
}: SidebarNavProps) {
  const isAdmin = isTeamAdmin(activeUser);

  return (
    <aside style={{ width: 240, borderRight: '1px solid var(--border)', background: 'var(--bg-surface)', padding: 16, display: 'flex', flexDirection: 'column', gap: 20, flexShrink: 0 }}>
      {/* Brand Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px' }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={16} color="white" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#fafafa' }}>StorymeeTeam</div>
          <div style={{ fontSize: 10, color: '#52525b' }}>AIFA Holding</div>
        </div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {TABS.map(t => {
          if (t.id === 'omnirouter') {
            if (!isAdmin) return null;
          }
          if (t.id === 'hr') {
            const hrSubItems = [
              { id: 'profile', label: '🌿 Hồ sơ & Đội ngũ' },
              { id: 'attendance', label: '📅 Chấm công tự động' },
              { id: 'leaves', label: '🌴 Quản lý Phép & Remote' },
              { id: 'payroll', label: '💳 Bảng lương' },
              { id: 'importer', label: '🧠 Huấn luyện Quy chế AI' }
            ];
            const isHrActive = tab === 'hr';
            return (
              <div key={t.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <button
                  className={`sidebar-item ${isHrActive ? 'active' : ''}`}
                  onClick={() => {
                    setTab('hr');
                    if (!hrSubTab) setHrSubTab('profile');
                  }}
                  style={{ width: '100%', textAlign: 'left', border: 'none' }}
                >
                  <t.icon size={15} />
                  {t.label}
                </button>
                
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  paddingLeft: 12,
                  gap: 2,
                  marginTop: 2,
                  marginBottom: 4,
                  borderLeft: '1px solid rgba(255,255,255,0.04)',
                  marginLeft: 20
                }}>
                  {hrSubItems.map(st => {
                    if (st.id === 'importer' && !isAdmin) return null;
                    const isSubActive = isHrActive && hrSubTab === st.id;
                    return (
                      <button
                        key={st.id}
                        onClick={() => {
                          setTab('hr');
                          setHrSubTab(st.id as any);
                        }}
                        className="sidebar-sub-btn"
                        style={{
                          padding: '6px 12px',
                          fontSize: 11,
                          textAlign: 'left',
                          background: isSubActive ? 'rgba(167,139,250,0.08)' : 'transparent',
                          color: isSubActive ? '#a78bfa' : '#71717a',
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        {st.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          }
          return (
            <button key={t.id} className={`sidebar-item ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)} style={{ width: '100%', textAlign: 'left', border: 'none' }}>
              <t.icon size={15} />
              {t.label}
            </button>
          );
        })}
      </nav>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 }}>
        <div className="sidebar-item" style={{ fontSize: 12 }}>
          <Settings size={14} />
          Cài đặt
        </div>
      </div>
    </aside>
  );
}
