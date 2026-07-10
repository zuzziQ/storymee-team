import React from 'react';
import { Plus, Bell, LogOut, ChevronDown, Check, User } from 'lucide-react';
import { TeamMember, Project, Announcement, getInitials } from '../../../constants';

interface HeaderBarProps {
  tab: string;
  tabLabel: string;
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  projects: Project[];
  setShowAddProjectModal: (show: boolean) => void;
  showNotifications: boolean;
  setShowNotifications: (show: boolean) => void;
  appNotifications?: any[];
  setAppNotifications?: (notifs: any[]) => void;
  announcements: Announcement[];
  setAnnouncements: React.Dispatch<React.SetStateAction<Announcement[]>>;
  activeUser: TeamMember;
  handleLogout: () => void;
  showUserMenu: boolean;
  setShowUserMenu: (show: boolean) => void;
  setActiveUser: (user: TeamMember) => void;
  teamMembers: TeamMember[];
  setSelectedMemberId: (id: string) => void;
  setTab: (tab: string) => void;
  setHrSubTab: (subTab: 'profile' | 'attendance' | 'leaves' | 'payroll' | 'importer') => void;
  handleCheckinOffice: (memberId: string, notes?: string, workType?: string) => Promise<void>;
  handleCheckoutOffice: (memberId: string, notes?: string) => Promise<void>;
  attendanceList: any[];
}

export default function HeaderBar({
  tab,
  tabLabel,
  selectedProjectId,
  setSelectedProjectId,
  projects,
  setShowAddProjectModal,
  showNotifications,
  setShowNotifications,
  announcements,
  setAnnouncements,
  activeUser,
  handleLogout,
  showUserMenu,
  setShowUserMenu,
  setActiveUser,
  teamMembers,
  setSelectedMemberId,
  setTab,
  setHrSubTab,
  handleCheckinOffice,
  handleCheckoutOffice,
  attendanceList
}: HeaderBarProps) {
  const unreadAnnouncements = announcements.filter(a => !a.readBy.includes(activeUser.id));

  // Determine today's attendance status for active user
  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecord = attendanceList?.find(a => a.memberId === activeUser.id && a.date?.startsWith(todayStr));
  const hasCheckedIn = !!todayRecord?.checkIn;
  const hasCheckedOut = !!todayRecord?.checkOut;
  
  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <header style={{ height: 56, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', background: 'var(--bg-surface)', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: '#fafafa' }}>{tabLabel}</span>
        
        {/* Project Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-muted)', padding: '2px 8px', borderRadius: 8, border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 11, color: '#71717a' }}>Dự án:</span>
          <select
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fafafa',
              fontSize: 12,
              fontWeight: 500,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all">📂 Tất cả dự án</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          
          <button 
            onClick={() => setShowAddProjectModal(true)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#818cf8',
              display: 'flex',
              alignItems: 'center',
              padding: 2,
              borderRadius: 4
            }}
            title="Tạo Dự án mới"
          >
            <Plus size={14} />
          </button>
        </div>
        
        <span style={{ fontSize: 12, color: '#52525b', padding: '2px 8px', background: 'var(--bg-muted)', borderRadius: 6 }}>Sprint 1</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Quick Check-in/out Header Widget */}
        {hasCheckedOut ? (
           <button
             disabled
             style={{
               padding: '6px 12px', fontSize: 11, fontWeight: 600, borderRadius: 8, border: 'none',
               background: 'rgba(161,161,170,0.1)', color: '#a1a1aa', cursor: 'default',
               display: 'flex', alignItems: 'center', gap: 6
             }}
           >
             <span>👋</span> Đã Check-out ({formatTime(todayRecord.checkIn)} - {formatTime(todayRecord.checkOut)})
           </button>
        ) : hasCheckedIn ? (
           <button
             onClick={async () => {
               if (activeUser) {
                 await handleCheckoutOffice(activeUser.id, 'Check-out từ Header Bar');
               }
             }}
             style={{
               padding: '6px 12px', fontSize: 11, fontWeight: 600, borderRadius: 8, border: 'none',
               background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', cursor: 'pointer',
               display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s'
             }}
           >
             <span>🏃</span> Check-out ({formatTime(todayRecord.checkIn)} - --:--)
           </button>
        ) : (
           <button
             onClick={async () => {
               if (activeUser) {
                 await handleCheckinOffice(activeUser.id, 'Check-in từ Header Bar', 'office');
               }
             }}
             style={{
               padding: '6px 12px', fontSize: 11, fontWeight: 600, borderRadius: 8, border: 'none',
               background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white', cursor: 'pointer',
               display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s'
             }}
           >
             <span>🕒</span> Check-in Văn phòng
           </button>
        )}

        {/* Announcement Bell */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: unreadAnnouncements.length > 0 ? '#a78bfa' : '#71717a',
              padding: 6,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}
            className={unreadAnnouncements.length > 0 ? 'pulse-glow' : ''}
            title="Thông báo công ty"
          >
            <Bell size={16} />
            {(unreadAnnouncements.length > 0 || appNotifications?.some(n => !n.read)) && (
              <span style={{ position: 'absolute', top: 2, right: 2, width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
            )}
          </button>

          {/* Notification Dropdown Panel */}
          {showNotifications && (
            <div style={{ position: 'absolute', top: '120%', right: 0, width: 320, background: 'rgba(24,24,27,0.98)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, zIndex: 100, boxShadow: '0 16px 40px rgba(0,0,0,0.6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#fafafa' }}>Thông báo ({appNotifications.length + announcements.length})</span>
                <button onClick={() => setShowNotifications(false)} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: 11 }}>Đóng</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto' }}>
                {/* System Notifications */}
                {appNotifications.map(notif => (
                    <div key={notif.id} style={{ padding: 8, borderRadius: 8, background: notif.read ? 'transparent' : 'rgba(99,102,241,0.06)', border: `1px solid ${notif.read ? 'rgba(255,255,255,0.03)' : 'rgba(99,102,241,0.15)'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: notif.type === 'error' ? '#ef4444' : notif.type === 'success' ? '#22c55e' : '#fafafa' }}>{notif.title}</span>
                        {!notif.read && (
                          <button
                            onClick={() => {
                              if (setAppNotifications) {
                                setAppNotifications(appNotifications.map(n => n.id === notif.id ? { ...n, read: true } : n));
                              }
                            }}
                            style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: 9, fontWeight: 500 }}
                          >
                            Đã đọc
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: '#a1a1aa', lineHeight: 1.4, marginBottom: 4 }}>{notif.message}</div>
                      <div style={{ fontSize: 9, color: '#52525b', textAlign: 'right' }}>
                         {notif.timestamp ? new Date(notif.timestamp).toLocaleTimeString('vi-VN') : ''}
                      </div>
                    </div>
                ))}
                
                {/* Announcements */}
                {announcements.map(ann => {
                  const isRead = ann.readBy.includes(activeUser.id);
                  return (
                    <div key={ann.id} style={{ padding: 8, borderRadius: 8, background: isRead ? 'transparent' : 'rgba(99,102,241,0.06)', border: `1px solid ${isRead ? 'rgba(255,255,255,0.03)' : 'rgba(99,102,241,0.15)'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#fafafa' }}>{ann.title}</span>
                        {!isRead && (
                          <button
                            onClick={() => {
                              setAnnouncements(prev => prev.map(a => a.id === ann.id ? { ...a, readBy: [...a.readBy, activeUser.id] } : a));
                            }}
                            style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: 9, fontWeight: 500 }}
                          >
                            Đã đọc
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: '#a1a1aa', lineHeight: 1.4, marginBottom: 4 }}>{ann.content}</div>
                      <div style={{ fontSize: 9, color: '#52525b', textAlign: 'right' }}>{ann.sender} · {ann.date}</div>
                    </div>
                  );
                })}
                {announcements.length === 0 && appNotifications.length === 0 && (
                  <div style={{ fontSize: 11, color: '#52525b', textAlign: 'center', padding: 20 }}>Không có thông báo nào</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Logout */}
        <button onClick={handleLogout} className="btn-ghost" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <LogOut size={13} />Đăng xuất
        </button>

        {/* User Selector */}
        <div style={{ position: 'relative' }}>
          <button className="user-select" onClick={() => setShowUserMenu(!showUserMenu)}>
            <div className="avatar" style={{ background: activeUser.color + '30', color: activeUser.color, width: 24, height: 24, fontSize: 10 }}>
              {getInitials(activeUser.name)}
            </div>
            <span style={{ fontSize: 12, fontWeight: 500 }}>{activeUser.name}</span>
            <ChevronDown size={12} color="#71717a" />
          </button>
          {showUserMenu && (
            <div style={{ position: 'absolute', top: '110%', right: 0, width: 220, background: 'rgba(18,18,20,0.98)', border: '1px solid var(--border)', borderRadius: 12, padding: 6, zIndex: 100, boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>
              <button onClick={() => { setTab('hr'); setHrSubTab('profile'); setSelectedMemberId(activeUser.id); setShowUserMenu(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: 'none', background: 'rgba(167,139,250,0.12)', cursor: 'pointer', color: '#a78bfa', transition: 'all 0.15s', marginBottom: 6 }}>
                <User size={14} color="#a78bfa" />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>Hồ sơ của tôi</div>
                  <div style={{ fontSize: 9, color: 'rgba(167,139,250,0.7)' }}>Xem & Cập nhật thông tin</div>
                </div>
              </button>
              <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
              
              <div style={{ fontSize: 9, color: '#52525b', padding: '6px 10px 4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Xem với tư cách</div>
              {teamMembers.map(m => (
                <button key={m.id} onClick={() => { setActiveUser(m); localStorage.setItem('st_user', JSON.stringify({ email: m.email, name: m.name, role: m.role })); setShowUserMenu(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: 'none', background: activeUser.id === m.id ? 'rgba(99,102,241,0.12)' : 'transparent', cursor: 'pointer', color: '#fafafa', transition: 'all 0.15s' }}>
                  <div className="avatar" style={{ background: m.color + '30', color: m.color, width: 26, height: 26, fontSize: 11 }}>{getInitials(m.name)}</div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{m.name}</div>
                    <div style={{ fontSize: 10, color: '#71717a' }}>{m.role.split(' - ')[1] || m.role}</div>
                  </div>
                  {activeUser.id === m.id && <Check size={12} color="#6366f1" style={{ marginLeft: 'auto' }} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
