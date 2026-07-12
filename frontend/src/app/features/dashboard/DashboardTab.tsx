import React from 'react';
import { Clock, Users, TrendingUp } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import {
  Task, TeamMember, Announcement, BURNDOWN,
  getPriorityDot, getStatusClass
} from '../../constants';

interface DashboardTabProps {
  overviewSubTab: string;
  setOverviewSubTab: (tab: 'all' | 'mine' | 'team') => void;
  timeFilter: 'week' | 'next-week' | 'sprint';
  setTimeFilter: (filter: 'week' | 'next-week' | 'sprint') => void;
  activeUser: TeamMember;
  teamMembers: TeamMember[];
  tasks: Task[];
  filteredTasks: Task[];
  leavesPending: any[];
  announcements: Announcement[];
  attendanceList: any[];
  setSelectedTask: (task: Task) => void;
  setTab: (tab: string) => void;
}

export default function DashboardTab({
  overviewSubTab,
  setOverviewSubTab,
  timeFilter,
  setTimeFilter,
  activeUser,
  teamMembers,
  tasks,
  filteredTasks,
  leavesPending,
  announcements,
  attendanceList,
  setSelectedTask,
  setTab
}: DashboardTabProps) {
  // Tính toán tình hình hôm nay từ dữ liệu thực tế
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayLabel = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

  const todayAttendance = attendanceList.filter(a => a.date?.startsWith(todayStr));
  const officeCount = todayAttendance.filter(a => a.workType === 'office').length;
  const remoteCount = todayAttendance.filter(a => a.workType === 'remote').length;
  const todayLeaveMembers = leavesPending.filter(l => {
    if (!l.date) return false;
    // date được format về dd/MM/yyyy từ fetchDbData
    const parts = l.date.split('/');
    if (parts.length !== 3) return false;
    const lDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    return lDate === todayStr;
  });
  const leaveCount = todayLeaveMembers.length;

  const remoteMemberNames = todayAttendance
    .filter(a => a.workType === 'remote')
    .map(a => a.member?.fullName || '?');
  const leaveMemberNames = todayLeaveMembers.map(l => l.name);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Overview Header & Filter / Sub-tab Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fafafa' }}>Chào sếp và các nhân sự Storymee!</div>
          <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>Trang tổng hợp nhanh công việc cá nhân và tiến trình của dự án.</div>
        </div>

        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Sub-selectors */}
          <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.2)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
            {[
              { id: 'all', label: '📊 Tất cả' },
              { id: 'mine', label: '👤 Của tôi' },
              { id: 'team', label: '👥 Của team' }
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setOverviewSubTab(opt.id as any)}
                className="btn-ghost"
                style={{
                  padding: '5px 12px',
                  fontSize: 11,
                  borderRadius: 6,
                  border: 'none',
                  background: overviewSubTab === opt.id ? 'rgba(255,255,255,0.06)' : 'transparent',
                  color: overviewSubTab === opt.id ? 'white' : '#71717a',
                  cursor: 'pointer',
                  fontWeight: overviewSubTab === opt.id ? 600 : 400
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#71717a' }}>Phạm vi:</span>
            <select
              value={timeFilter}
              onChange={e => setTimeFilter(e.target.value as any)}
              style={{
                background: 'var(--bg-muted)',
                border: '1px solid var(--border)',
                color: '#fafafa',
                fontSize: 12,
                fontWeight: 500,
                padding: '6px 12px',
                borderRadius: 8,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="sprint">📅 Cả Sprint 1 (25/06 – 09/07)</option>
              <option value="week">📅 Tuần này (Đến 05/07)</option>
              <option value="next-week">📅 Tuần sau (06/07 – 12/07)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: overviewSubTab === 'all' ? '1.2fr 0.8fr' : '1fr', 
        gap: 20, 
        alignItems: 'start' 
      }}>
        
        {/* LEFT COLUMN: GÓC CÁ NHÂN (MY WORKSPACE) */}
        {(overviewSubTab === 'all' || overviewSubTab === 'mine') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
              👤 Góc của tôi ({activeUser.name})
            </div>

            {/* Stats counters */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {(() => {
                const myTasks = tasks.filter(t => t.assignee === activeUser.name);
                const progress = myTasks.filter(t => t.status === 'In Progress').length;
                const review = myTasks.filter(t => t.status === 'In Review').length;
                const done = myTasks.filter(t => t.status === 'Done').length;
                return (
                  <>
                    <div className="glass" style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: 11, color: '#71717a' }}>Đang thực hiện</span>
                      <div style={{ fontSize: 22, fontWeight: 700, color: '#6366f1', marginTop: 4 }}>{progress}</div>
                    </div>
                    <div className="glass" style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: 11, color: '#71717a' }}>Chờ review</span>
                      <div style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b', marginTop: 4 }}>{review}</div>
                    </div>
                    <div className="glass" style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: 11, color: '#71717a' }}>Hoàn thành</span>
                      <div style={{ fontSize: 22, fontWeight: 700, color: '#22c55e', marginTop: 4 }}>{done}</div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* HRM Quotas */}
            <div className="glass" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>Hạn mức công & Phép cá nhân</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#a1a1aa', marginBottom: 4 }}>
                    <span>Nghỉ phép thường niên</span>
                    <span style={{ fontWeight: 600 }}>{activeUser.annualLeaveUsed} / {activeUser.annualLeaveLimit} ngày</span>
                  </div>
                  <div className="progress-bar" style={{ height: 4 }}>
                    <div className="progress-bar-fill" style={{ width: `${Math.min(100, (activeUser.annualLeaveUsed / (activeUser.annualLeaveLimit || 12)) * 100)}%`, background: '#f59e0b' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#a1a1aa', marginBottom: 4 }}>
                    <span>Làm việc từ xa (Remote)</span>
                    <span style={{ fontWeight: 600 }}>{activeUser.remoteUsed} / {activeUser.remoteLimit} ngày</span>
                  </div>
                  <div className="progress-bar" style={{ height: 4 }}>
                    <div className="progress-bar-fill" style={{ width: `${Math.min(100, (activeUser.remoteUsed / (activeUser.remoteLimit || 4)) * 100)}%`, background: '#8b5cf6' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* My Tasks List */}
            {(() => {
              const myWorkspaceTasks = tasks.filter(t => {
                const isMe = t.assignee === activeUser.name;
                let isTime = true;
                if (timeFilter === 'week') isTime = t.deadline <= '2026-07-05';
                else if (timeFilter === 'next-week') isTime = t.deadline > '2026-07-05' && t.deadline <= '2026-07-12';
                return isMe && isTime;
              });

              return (
                <div className="glass" style={{ padding: '20px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Nhiệm vụ cần tập trung trong kỳ lọc</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {myWorkspaceTasks.map(t => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-muted)', borderRadius: 8, border: '1px solid var(--border)', justifyContent: 'space-between' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0 }} className={getPriorityDot(t.priority)} />
                        <span style={{ fontSize: 10, color: '#52525b', fontFamily: 'monospace', width: 45 }}>{t.id}</span>
                        <span 
                          onClick={() => setSelectedTask(t)}
                          style={{ flex: 1, fontSize: 12, color: '#fafafa', fontWeight: 500, cursor: 'pointer' }}
                        >
                          {t.title}
                        </span>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className={`badge ${getStatusClass(t.status)}`} style={{ fontSize: 9, padding: '2px 6px' }}>{t.status}</span>
                          <span style={{ fontSize: 10, color: t.deadline <= '2026-07-02' ? '#ef4444' : '#71717a', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Clock size={10} /> {t.deadline.split('-').reverse().slice(0,2).join('/')}
                          </span>
                        </div>
                      </div>
                    ))}
                    
                    {myWorkspaceTasks.length === 0 && (
                      <div style={{ textAlign: 'center', color: '#52525b', padding: '30px 0', fontSize: 12 }}>
                        Tuyệt vời! Bạn không có nhiệm vụ nào tồn đọng trong khoảng thời gian này 🎉
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* RIGHT COLUMN: GÓC TẬP THỂ (TEAM DASHBOARD) */}
        {(overviewSubTab === 'all' || overviewSubTab === 'team') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={14} /> Góc của Team
            </div>

            {/* Team Status Today */}
            <div className="glass" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>Tình hình hoạt động hôm nay ({todayLabel})</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 8 }}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#22c55e' }}>{officeCount}</div>
                  <div style={{ fontSize: 9, color: '#71717a', marginTop: 2 }}>Tại văn phòng</div>
                </div>
                <div style={{ textAlign: 'center', flex: 1, borderLeft: '1px solid rgba(255,255,255,0.06)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#8b5cf6' }}>{remoteCount}</div>
                  <div style={{ fontSize: 9, color: '#71717a', marginTop: 2 }}>Làm remote</div>
                </div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b' }}>{leaveCount}</div>
                  <div style={{ fontSize: 9, color: '#71717a', marginTop: 2 }}>Nghỉ phép</div>
                </div>
              </div>

              {/* Detail members status */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
                {remoteMemberNames.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#a1a1aa' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#8b5cf6' }} />
                    <span>Remote:</span>
                    <span style={{ color: '#fafafa', fontWeight: 500 }}>{remoteMemberNames.join(', ')}</span>
                  </div>
                )}
                {leaveMemberNames.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#a1a1aa' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />
                    <span>Nghỉ phép:</span>
                    <span style={{ color: '#fafafa', fontWeight: 500 }}>{leaveMemberNames.join(', ')}</span>
                  </div>
                )}
                {officeCount === 0 && remoteCount === 0 && leaveCount === 0 && (
                  <div style={{ color: '#52525b', fontSize: 11 }}>Chưa có dữ liệu điểm danh hôm nay.</div>
                )}
              </div>
            </div>

            {/* Burndown Chart with simple explanation */}
            <div className="glass" style={{ padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={14} color="#6366f1" /> Biểu đồ Tiến độ Cháy việc (Đốt Task)
              </div>
              
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={BURNDOWN} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="day" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="ideal" stroke="#3f3f46" strokeDasharray="4 4" dot={false} strokeWidth={1.5} name="Lý tưởng" />
                  <Line type="monotone" dataKey="actual" stroke="#6366f1" dot={{ fill: '#6366f1', r: 3 }} strokeWidth={2} connectNulls={false} name="Thực tế" />
                </LineChart>
              </ResponsiveContainer>
              
              <div style={{ fontSize: 10, color: '#71717a', lineHeight: 1.4, background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
                💡 **Giải thích đơn giản:** Đường đứt nét màu xám thể hiện tiến độ chuẩn lý thuyết. Đường màu tím thể hiện tiến độ đốt task thực tế của team. Nếu đường màu tím **nằm dưới** đường đứt nét, nghĩa là team đang chạy nhanh hơn kế hoạch!
              </div>
            </div>

            {/* Workload Overload warnings */}
            {(() => {
              const overloaded = teamMembers.map(m => {
                const totalHrs = filteredTasks.filter(t => t.assignee === m.name && t.status !== 'Done').reduce((s, t) => s + t.estimate, 0);
                return { name: m.name, hrs: totalHrs, color: m.color };
              }).filter(x => x.hrs > 30);

              return overloaded.length > 0 ? (
                <div className="glass" style={{ padding: '14px 18px', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.02)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    ⚠️ Cảnh báo phân bổ quá tải (&gt;30h)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {overloaded.map(x => (
                      <div key={x.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span style={{ color: '#fafafa', fontWeight: 500 }}>{x.name}</span>
                        <span style={{ color: '#ef4444', fontWeight: 600 }}>{x.hrs}h việc đang mở</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

          </div>
        )}

      </div>
    </div>
  );
}
