import React, { useMemo } from 'react';
import { Clock, Users, AlertTriangle, CheckCircle2, ListTodo, Calendar } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import {
  Task,
  TeamMember,
  Announcement,
  Meeting,
  getPriorityDot,
  getStatusClass,
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
  meetings?: Meeting[];
  attendanceList: any[];
  setSelectedTask: (task: Task) => void;
  setTab: (tab: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  Backlog: '#71717a',
  Todo: '#3b82f6',
  'In Progress': '#f59e0b',
  'In Review': '#a78bfa',
  Done: '#22c55e',
};

export default function DashboardTab({
  overviewSubTab,
  setOverviewSubTab,
  timeFilter,
  setTimeFilter,
  activeUser,
  teamMembers,
  tasks,
  leavesPending,
  announcements,
  meetings = [],
  attendanceList,
  setSelectedTask,
  setTab,
}: DashboardTabProps) {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayLabel = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  const todayVn = new Date(Date.now() + 7 * 3600 * 1000).toISOString().substring(0, 10);

  const todayAttendance = attendanceList.filter((a) => a.date?.startsWith(todayStr));
  const officeCount = todayAttendance.filter((a) => a.workType === 'office').length;
  const remoteCount = todayAttendance.filter((a) => a.workType === 'remote').length;

  const myTasks = useMemo(
    () => tasks.filter((t) => t.assignee === activeUser.name || t.assigneeId === activeUser.id),
    [tasks, activeUser]
  );

  const openTasks = useMemo(
    () => tasks.filter((t) => t.status !== 'Done' && t.status !== 'Backlog'),
    [tasks]
  );

  const overdueAll = useMemo(
    () =>
      openTasks.filter((t) => {
        if (!t.deadline || t.deadline === 'None') return false;
        return t.deadline.split('T')[0] < todayVn;
      }),
    [openTasks, todayVn]
  );

  const dueToday = useMemo(
    () =>
      openTasks.filter((t) => t.deadline && t.deadline.split('T')[0] === todayVn),
    [openTasks, todayVn]
  );

  const statusChart = useMemo(() => {
    const order = ['Todo', 'In Progress', 'In Review', 'Done', 'Backlog'];
    return order.map((s) => ({
      name: s === 'In Progress' ? 'Doing' : s === 'In Review' ? 'Review' : s,
      full: s,
      count: tasks.filter((t) => t.status === s).length,
    }));
  }, [tasks]);

  const workloadChart = useMemo(() => {
    const activeMembers = teamMembers.filter(
      (m) => m.isActive !== false && (m.accountStatus || 'active') === 'active'
    );
    return activeMembers
      .map((m) => {
        const open = tasks.filter(
          (t) =>
            (t.assignee === m.name || t.assigneeId === m.id) &&
            t.status !== 'Done'
        ).length;
        return { name: (m.name || '').split(' ').slice(-1)[0] || m.name, full: m.name, open };
      })
      .filter((r) => r.open > 0)
      .sort((a, b) => b.open - a.open)
      .slice(0, 8);
  }, [teamMembers, tasks]);

  const myProgress = myTasks.filter((t) => t.status === 'In Progress').length;
  const myReview = myTasks.filter((t) => t.status === 'In Review').length;
  const myDone = myTasks.filter((t) => t.status === 'Done').length;
  const myOverdue = myTasks.filter(
    (t) => t.status !== 'Done' && t.deadline && t.deadline.split('T')[0] < todayVn
  ).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div
        className="glass"
        style={{
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fafafa' }}>
            Tổng quan · {todayLabel}
          </div>
          <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>
            Công việc, deadline & hoạt động team — không phụ thuộc estimate giờ.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              gap: 3,
              background: 'rgba(0,0,0,0.25)',
              padding: 3,
              borderRadius: 8,
              border: '1px solid var(--border)',
            }}
          >
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'mine', label: 'Của tôi' },
              { id: 'team', label: 'Team' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setOverviewSubTab(opt.id as any)}
                style={{
                  padding: '6px 12px',
                  fontSize: 11,
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background:
                    overviewSubTab === opt.id ? 'rgba(167,139,250,0.2)' : 'transparent',
                  color: overviewSubTab === opt.id ? '#e9d5ff' : '#71717a',
                  fontWeight: overviewSubTab === opt.id ? 600 : 400,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as any)}
            style={{
              background: 'var(--bg-muted)',
              border: '1px solid var(--border)',
              color: '#fafafa',
              fontSize: 12,
              padding: '6px 12px',
              borderRadius: 8,
              outline: 'none',
            }}
          >
            <option value="sprint">Sprint</option>
            <option value="week">Tuần này</option>
            <option value="next-week">Tuần sau</option>
          </select>
        </div>
      </div>

      {/* KPI cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
        }}
      >
        {[
          {
            label: 'Task mở (team)',
            value: openTasks.length,
            color: '#6366f1',
            icon: <ListTodo size={16} />,
            onClick: () => setTab('kanban'),
          },
          {
            label: 'Quá hạn',
            value: overdueAll.length,
            color: '#ef4444',
            icon: <AlertTriangle size={16} />,
            onClick: () => setTab('kanban'),
          },
          {
            label: 'Deadline hôm nay',
            value: dueToday.length,
            color: '#f59e0b',
            icon: <Clock size={16} />,
            onClick: () => setTab('kanban'),
          },
          {
            label: 'Check-in hôm nay',
            value: officeCount + remoteCount,
            color: '#22c55e',
            icon: <Users size={16} />,
            onClick: () => setTab('hr'),
          },
          {
            label: 'Đơn phép pending',
            value: leavesPending.filter((l) => l.status === 'pending' || !l.status).length,
            color: '#a78bfa',
            icon: <Calendar size={16} />,
            onClick: () => setTab('hr'),
          },
          {
            label: 'Của tôi · Doing',
            value: myProgress,
            color: '#38bdf8',
            icon: <CheckCircle2 size={16} />,
            onClick: () => setOverviewSubTab('mine'),
          },
        ].map((c) => (
          <button
            key={c.label}
            type="button"
            className="glass"
            onClick={c.onClick}
            style={{
              padding: '14px 16px',
              textAlign: 'left',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              background: 'transparent',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#71717a' }}>
              <span style={{ fontSize: 11 }}>{c.label}</span>
              <span style={{ color: c.color }}>{c.icon}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: c.color, marginTop: 6 }}>
              {c.value}
            </div>
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: overviewSubTab === 'all' ? '1.1fr 0.9fr' : '1fr',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* LEFT — my work */}
        {(overviewSubTab === 'all' || overviewSubTab === 'mine') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa', letterSpacing: '0.04em' }}>
              👤 CỦA TÔI · {activeUser.name}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[
                { l: 'Doing', v: myProgress, c: '#f59e0b' },
                { l: 'Review', v: myReview, c: '#a78bfa' },
                { l: 'Done', v: myDone, c: '#22c55e' },
                { l: 'Quá hạn', v: myOverdue, c: '#ef4444' },
              ].map((x) => (
                <div key={x.l} className="glass" style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, color: '#71717a' }}>{x.l}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: x.c, marginTop: 4 }}>{x.v}</div>
                </div>
              ))}
            </div>

            <div className="glass" style={{ padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fafafa', marginBottom: 10 }}>
                Hạn mức phép / remote
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#a1a1aa' }}>
                    <span>Phép năm</span>
                    <span>
                      {activeUser.annualLeaveUsed ?? 0}/{activeUser.annualLeaveLimit ?? 12}
                    </span>
                  </div>
                  <div className="progress-bar" style={{ height: 4, marginTop: 6 }}>
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${Math.min(
                          100,
                          ((activeUser.annualLeaveUsed || 0) / (activeUser.annualLeaveLimit || 12)) * 100
                        )}%`,
                        background: '#f59e0b',
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#a1a1aa' }}>
                    <span>Remote</span>
                    <span>
                      {activeUser.workArrangement === 'remote'
                        ? 'Full remote'
                        : `${activeUser.remoteUsed ?? 0}/${activeUser.remoteLimit ?? 4}`}
                    </span>
                  </div>
                  <div className="progress-bar" style={{ height: 4, marginTop: 6 }}>
                    <div
                      className="progress-bar-fill"
                      style={{
                        width:
                          activeUser.workArrangement === 'remote'
                            ? '100%'
                            : `${Math.min(
                                100,
                                ((activeUser.remoteUsed || 0) / (activeUser.remoteLimit || 4)) * 100
                              )}%`,
                        background: '#8b5cf6',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* My open tasks by urgency */}
            {(() => {
              const open = myTasks.filter((t) => t.status !== 'Done');
              const overdue = open.filter(
                (t) => t.deadline && t.deadline.split('T')[0] < todayVn
              );
              const today = open.filter((t) => t.deadline && t.deadline.split('T')[0] === todayVn);
              const rest = open.filter(
                (t) =>
                  !t.deadline ||
                  t.deadline === 'None' ||
                  t.deadline.split('T')[0] > todayVn
              );
              const render = (title: string, list: Task[], color: string) =>
                list.length === 0 ? null : (
                  <div key={title} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color, marginBottom: 6 }}>
                      {title} ({list.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {list.slice(0, 6).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTask(t)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '8px 10px',
                            background: 'var(--bg-muted)',
                            borderRadius: 8,
                            border: '1px solid var(--border)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            width: '100%',
                            color: 'inherit',
                          }}
                        >
                          <span
                            style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0 }}
                            className={getPriorityDot(t.priority)}
                          />
                          <span
                            style={{
                              flex: 1,
                              fontSize: 12,
                              color: '#fafafa',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {t.title}
                          </span>
                          <span className={`badge ${getStatusClass(t.status)}`} style={{ fontSize: 9 }}>
                            {t.status}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              return (
                <div className="glass" style={{ padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#fafafa' }}>
                    Việc của tôi
                  </div>
                  {open.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#52525b', padding: 20, fontSize: 12 }}>
                      Không có task mở 🎉
                    </div>
                  ) : (
                    <>
                      {render('⚠️ Quá hạn', overdue, '#ef4444')}
                      {render('🔥 Hôm nay', today, '#f59e0b')}
                      {render('📌 Đang mở', rest, '#818cf8')}
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* RIGHT — team */}
        {(overviewSubTab === 'all' || overviewSubTab === 'team') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#818cf8', letterSpacing: '0.04em' }}>
              👥 TEAM
            </div>

            {/* Status distribution — replaces burndown */}
            <div className="glass" style={{ padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa', marginBottom: 4 }}>
                Phân bố trạng thái task
              </div>
              <div style={{ fontSize: 10, color: '#52525b', marginBottom: 10 }}>
                Theo số lượng issue (không dùng estimate giờ)
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={statusChart} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fill: '#71717a', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      background: '#18181b',
                      border: '1px solid #333',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {statusChart.map((e) => (
                      <Cell key={e.full} fill={STATUS_COLORS[e.full] || '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Workload by person */}
            <div className="glass" style={{ padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa', marginBottom: 4 }}>
                Workload (task mở / người)
              </div>
              <div style={{ fontSize: 10, color: '#52525b', marginBottom: 10 }}>
                Top người đang giữ nhiều việc nhất
              </div>
              {workloadChart.length === 0 ? (
                <div style={{ color: '#52525b', fontSize: 12, textAlign: 'center', padding: 16 }}>
                  Chưa có task mở
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart
                    data={workloadChart}
                    layout="vertical"
                    margin={{ top: 0, right: 12, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis type="number" allowDecimals={false} tick={{ fill: '#71717a', fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={56}
                      tick={{ fill: '#a1a1aa', fontSize: 10 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#18181b',
                        border: '1px solid #333',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="open" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Attendance today */}
            <div className="glass" style={{ padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa', marginBottom: 10 }}>
                Hoạt động hôm nay ({todayLabel})
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e' }}>{officeCount}</div>
                  <div style={{ fontSize: 10, color: '#71717a' }}>Văn phòng</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', borderLeft: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#8b5cf6' }}>{remoteCount}</div>
                  <div style={{ fontSize: 10, color: '#71717a' }}>Remote</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', borderLeft: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b' }}>
                    {leavesPending.filter((l) => (l.status || 'pending') === 'pending').length}
                  </div>
                  <div style={{ fontSize: 10, color: '#71717a' }}>Phép chờ</div>
                </div>
              </div>
            </div>

            {meetings && meetings.length > 0 && (
              <div className="glass" style={{ padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa', marginBottom: 10 }}>
                  📅 Lịch họp gần
                </div>
                {meetings.slice(0, 4).map((m: any) => {
                  const start = new Date(m.startTime);
                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        fontSize: 12,
                      }}
                    >
                      <span style={{ color: '#fafafa' }}>{m.title}</span>
                      <span style={{ color: '#818cf8', flexShrink: 0 }}>
                        {start.toLocaleString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {announcements && announcements.length > 0 && (
              <div className="glass" style={{ padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa', marginBottom: 8 }}>
                  📢 Thông báo
                </div>
                {announcements.slice(0, 3).map((a: any) => (
                  <div key={a.id} style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 6 }}>
                    <strong style={{ color: '#e4e4e7' }}>{a.title}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
