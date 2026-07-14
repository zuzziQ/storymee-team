import React, { useState } from 'react';
import { TeamMember, Task, getInitials } from '../../../constants';

interface OrgChartProps {
  hrProfileView: 'chart' | 'list';
  setHrProfileView: (view: 'chart' | 'list') => void;
  hrSearchQuery: string;
  setHrSearchQuery: (query: string) => void;
  hrDeptFilter: string;
  setHrDeptFilter: (dept: string) => void;
  teamMembers: TeamMember[];
  setTeamMembers?: React.Dispatch<React.SetStateAction<TeamMember[]>>;
  selectedMemberId: string;
  setSelectedMemberId: (id: string) => void;
  isAdmin: boolean;
  tasks: Task[];
}

export default function OrgChart({
  hrProfileView,
  setHrProfileView,
  hrSearchQuery,
  setHrSearchQuery,
  hrDeptFilter,
  setHrDeptFilter,
  teamMembers,
  setTeamMembers,
  selectedMemberId,
  setSelectedMemberId,
  isAdmin,
  tasks
}: OrgChartProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMember, setNewMember] = useState<Partial<TeamMember>>({
    name: '', role: 'Nhân sự mới', email: '', color: '#10b981', skills: [], telegramUsername: ''
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.2)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
          <button
            onClick={() => setHrProfileView('chart')}
            className='btn-ghost'
            style={{
              padding: '5px 12px',
              fontSize: 11,
              borderRadius: 6,
              border: 'none',
              background: hrProfileView === 'chart' ? 'rgba(255,255,255,0.06)' : 'transparent',
              color: hrProfileView === 'chart' ? 'white' : '#71717a',
              cursor: 'pointer',
              fontWeight: hrProfileView === 'chart' ? 600 : 400
            }}
          >
            🌿 Sơ đồ cấu trúc
          </button>
          <button
            onClick={() => setHrProfileView('list')}
            className='btn-ghost'
            style={{
              padding: '5px 12px',
              fontSize: 11,
              borderRadius: 6,
              border: 'none',
              background: hrProfileView === 'list' ? 'rgba(255,255,255,0.06)' : 'transparent',
              color: hrProfileView === 'list' ? 'white' : '#71717a',
              cursor: 'pointer',
              fontWeight: hrProfileView === 'list' ? 600 : 400
            }}
          >
            📋 Danh sách phẳng
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {isAdmin && (
            <button
              className="btn-primary"
              onClick={() => setShowAddModal(true)}
              style={{ padding: '6px 12px', fontSize: 11, borderRadius: 8, whiteSpace: 'nowrap' }}
            >
              + Tạo nhân sự
            </button>
          )}
          <input
            className='input-dark'
            placeholder='Tìm nhân sự...'
            value={hrSearchQuery}
            onChange={e => setHrSearchQuery(e.target.value)}
            style={{ padding: '6px 12px', fontSize: 11, borderRadius: 8, width: 140, background: '#18181b', border: '1px solid var(--border)', color: 'white' }}
          />
          <select
            value={hrDeptFilter}
            onChange={e => setHrDeptFilter(e.target.value)}
            style={{ background: '#18181b', border: '1px solid var(--border)', color: '#fafafa', borderRadius: 8, padding: '6px 10px', fontSize: 11, outline: 'none', cursor: 'pointer' }}
          >
            <option value='all'>Tất cả ban</option>
            <option value='Giám đốc'>Ban Giám Đốc</option>
            <option value='Tech'>Công nghệ & SP</option>
            <option value='Nội dung'>Nội dung & Media</option>
            <option value='Marketing'>Marketing</option>
          </select>
        </div>
      </div>

      {hrProfileView === 'chart' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '20px 0', overflowX: 'auto', width: '100%' }}>
          {teamMembers.filter(m => m.isActive !== false && (m?.email || '').toLowerCase() === 'kimngan151091@gmail.com' && (hrSearchQuery === '' || m.name.toLowerCase().includes(hrSearchQuery.toLowerCase()))).map(m => {
            const isSelected = selectedMemberId === m.id;
            return (
              <div
                key={m.id}
                onClick={() => { if (isAdmin) setSelectedMemberId(m.id); }}
                className='glass'
                style={{
                  padding: '14px 18px',
                  width: 220,
                  border: isSelected ? '2px solid #a78bfa' : '1px solid #f59e0b',
                  boxShadow: isSelected ? '0 0 15px rgba(167, 139, 250, 0.3)' : '0 0 15px rgba(245, 158, 11, 0.15)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  alignItems: 'center',
                  textAlign: 'center',
                  cursor: isAdmin ? 'pointer' : 'default',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ position: 'absolute', top: -8, background: '#f59e0b', color: '#111', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>BOARD OF DIRECTORS</div>
                <div className='avatar' style={{ background: m.color + '25', color: m.color, width: 44, height: 44, fontSize: 16, fontWeight: 700, border: '2px solid ' + m.color }}>
                  {getInitials(m.name)}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#fafafa' }}>{m.name}</div>
                  <div style={{ fontSize: 10, color: '#71717a', marginTop: 1 }}>{m.role}</div>
                </div>
                <div style={{ fontSize: 10, color: '#a78bfa', background: 'rgba(167,139,250,0.08)', padding: '2px 8px', borderRadius: 4 }}>
                  @{m.telegramUsername}
                </div>
                {isAdmin && <div style={{ fontSize: 8, color: '#a78bfa', fontWeight: 600 }}>⚡ Click để chỉnh sửa</div>}
              </div>
            );
          })}

          <div style={{ width: 1, height: 18, background: 'var(--border)' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 30, width: '100%', maxWidth: 900, position: 'relative' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              {teamMembers.filter(m => m.isActive !== false && (m?.email || '').toLowerCase() === 'lehuyducanh.vn@gmail.com' && (hrSearchQuery === '' || m.name.toLowerCase().includes(hrSearchQuery.toLowerCase()))).map(m => {
                const isSelected = selectedMemberId === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => { if (isAdmin) setSelectedMemberId(m.id); }}
                    className='glass'
                    style={{
                      padding: '12px 16px',
                      width: 200,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      border: isSelected ? '2px solid #a78bfa' : '1px solid rgba(99,102,241,0.3)',
                      cursor: isAdmin ? 'pointer' : 'default',
                      transition: 'all 0.2s',
                      boxShadow: isSelected ? '0 0 10px rgba(167, 139, 250, 0.2)' : 'none'
                    }}
                  >
                    <div className='avatar' style={{ background: m.color + '25', color: m.color, width: 34, height: 34, fontSize: 12 }}>{getInitials(m.name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 12, color: '#fafafa', textOverflow: 'ellipsis', overflow: 'hidden' }}>{m.name}</div>
                      <div style={{ fontSize: 9, color: '#71717a' }}>{m.role}</div>
                    </div>
                  </div>
                );
              })}

              <div style={{ width: 1, height: 14, background: 'var(--border)' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
                {teamMembers.filter(m => m.isActive !== false && ['zuzzivn@gmail.com', 'phqhuong.0510@gmail.com'].includes((m?.email || '').toLowerCase()) && (hrSearchQuery === '' || m.name.toLowerCase().includes(hrSearchQuery.toLowerCase()))).map(m => {
                  const isSelected = selectedMemberId === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => { if (isAdmin) setSelectedMemberId(m.id); }}
                      className='glass'
                      style={{
                        padding: '10px 14px',
                        marginLeft: 15,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        border: isSelected ? '2px solid #a78bfa' : '1px solid var(--border)',
                        cursor: isAdmin ? 'pointer' : 'default',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div className='avatar' style={{ background: m.color + '20', color: m.color, width: 28, height: 28, fontSize: 11 }}>{getInitials(m.name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: 11, color: '#fafafa' }}>{m.name}</div>
                        <div style={{ fontSize: 9, color: '#71717a' }}>{m.role}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              {teamMembers.filter(m => m.isActive !== false && (m?.email || '').toLowerCase() === 'thanhtutran08@gmail.com' && (hrSearchQuery === '' || m.name.toLowerCase().includes(hrSearchQuery.toLowerCase()))).map(m => {
                const isSelected = selectedMemberId === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => { if (isAdmin) setSelectedMemberId(m.id); }}
                    className='glass'
                    style={{
                      padding: '12px 16px',
                      width: 200,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      border: isSelected ? '2px solid #a78bfa' : '1px solid rgba(236,72,153,0.3)',
                      cursor: isAdmin ? 'pointer' : 'default',
                      transition: 'all 0.2s',
                      boxShadow: isSelected ? '0 0 10px rgba(167, 139, 250, 0.2)' : 'none'
                    }}
                  >
                    <div className='avatar' style={{ background: m.color + '25', color: m.color, width: 34, height: 34, fontSize: 12 }}>{getInitials(m.name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 12, color: '#fafafa', textOverflow: 'ellipsis', overflow: 'hidden' }}>{m.name}</div>
                      <div style={{ fontSize: 9, color: '#71717a' }}>{m.role}</div>
                    </div>
                  </div>
                );
              })}

              <div style={{ width: 1, height: 14, background: 'var(--border)' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
                {teamMembers.filter(m => m.isActive !== false && ['jeantran.creative@gmail.com', 'nguyenductrungdung.2005@gmail.com', 'huongiiiang@gmail.com', 'daulinh110124@gmail.com', 'lanthao1792003@gmail.com'].includes((m?.email || '').toLowerCase()) && (hrSearchQuery === '' || m.name.toLowerCase().includes(hrSearchQuery.toLowerCase()))).map(m => {
                  const isSelected = selectedMemberId === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => { if (isAdmin) setSelectedMemberId(m.id); }}
                      className='glass'
                      style={{
                        padding: '10px 14px',
                        marginLeft: 15,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        border: isSelected ? '2px solid #a78bfa' : '1px solid var(--border)',
                        cursor: isAdmin ? 'pointer' : 'default',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div className='avatar' style={{ background: m.color + '20', color: m.color, width: 28, height: 28, fontSize: 11 }}>{getInitials(m.name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: 11, color: '#fafafa' }}>{m.name}</div>
                        <div style={{ fontSize: 9, color: '#71717a' }}>{m.role}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Nhân sự khác</div>
              {teamMembers.filter(m => m.isActive !== false && !['kimngan151091@gmail.com', 'lehuyducanh.vn@gmail.com', 'zuzzivn@gmail.com', 'phqhuong.0510@gmail.com', 'thanhtutran08@gmail.com', 'jeantran.creative@gmail.com', 'nguyenductrungdung.2005@gmail.com', 'huongiiiang@gmail.com', 'daulinh110124@gmail.com', 'lanthao1792003@gmail.com'].includes((m?.email || '').toLowerCase()) && (hrSearchQuery === '' || m.name.toLowerCase().includes(hrSearchQuery.toLowerCase()))).map(m => {
                const isSelected = selectedMemberId === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => { if (isAdmin) setSelectedMemberId(m.id); }}
                    className='glass'
                    style={{
                      padding: '12px 16px',
                      width: 200,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      border: isSelected ? '2px solid #a78bfa' : '1px solid var(--border)',
                      cursor: isAdmin ? 'pointer' : 'default',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div className='avatar' style={{ background: m.color + '25', color: m.color, width: 34, height: 34, fontSize: 12 }}>{getInitials(m.name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 12, color: '#fafafa', textOverflow: 'ellipsis', overflow: 'hidden' }}>{m.name}</div>
                      <div style={{ fontSize: 9, color: '#71717a' }}>{m.role}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {hrProfileView === 'list' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {teamMembers
            .filter(m => {
              if (m.isActive === false && !isAdmin) return false;
              const matchesSearch = m.name.toLowerCase().includes(hrSearchQuery.toLowerCase()) || m.role.toLowerCase().includes(hrSearchQuery.toLowerCase());
              let matchesDept = true;
              if (hrDeptFilter !== 'all') {
                if (hrDeptFilter === 'Giám đốc') matchesDept = m.role.includes('CEO');
                else if (hrDeptFilter === 'Tech') matchesDept = ['CTO', 'Developer', 'Designer', 'IT'].some(keyword => m.role.includes(keyword));
                else if (hrDeptFilter === 'Nội dung') matchesDept = ['Content', 'Media', 'Editor', 'Trợ lý'].some(keyword => m.role.includes(keyword));
                else if (hrDeptFilter === 'Marketing') matchesDept = m.role.includes('Marketing');
              }
              return matchesSearch && matchesDept;
            })
            .map(m => {
              const myTasks = tasks.filter(t => t.assignee === m.name && t.status !== 'Done');
              const isSelected = selectedMemberId === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => { if (isAdmin) setSelectedMemberId(m.id); }}
                  className='glass'
                  style={{
                    padding: 16,
                    border: isSelected ? '2px solid #a78bfa' : '1px solid var(--border)',
                    cursor: isAdmin ? 'pointer' : 'default',
                    transition: 'all 0.2s',
                    boxShadow: isSelected ? '0 0 10px rgba(167, 139, 250, 0.2)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, opacity: m.isActive === false ? 0.5 : 1 }}>
                    <div className='avatar' style={{ background: m.color + '25', color: m.color, width: 36, height: 36, fontSize: 12, fontWeight: 700, border: '2px solid ' + m.color + '40' }}>
                      {getInitials(m.name)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#fafafa' }}>
                        {m.name} {m.isActive === false && <span style={{ color: '#ef4444', fontSize: 10, marginLeft: 4 }}>(Đã nghỉ)</span>}
                      </div>
                      <div style={{ fontSize: 10, color: '#71717a' }}>{m.role}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
                    {m.skills.slice(0, 3).map(s => (
                      <span key={s} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: m.color + '15', color: m.color, border: '1px solid ' + m.color + '30' }}>{s}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#71717a', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                    <span>@{m.telegramUsername}</span>
                    <span style={{ color: myTasks.length > 3 ? '#ef4444' : '#a1a1aa' }}>{myTasks.length} task mở</span>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass" style={{ width: 400, padding: 24, borderRadius: 16, background: '#18181b', border: '1px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#fafafa', fontSize: 16 }}>Thêm nhân sự mới</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: '#a1a1aa', display: 'block', marginBottom: 4 }}>Họ tên</label>
                <input
                  className="input-dark"
                  value={newMember.name}
                  onChange={e => setNewMember({ ...newMember, name: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', fontSize: 12, borderRadius: 8 }}
                  placeholder="Nhập họ tên"
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#a1a1aa', display: 'block', marginBottom: 4 }}>Chức vụ</label>
                <input
                  className="input-dark"
                  value={newMember.role}
                  onChange={e => setNewMember({ ...newMember, role: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', fontSize: 12, borderRadius: 8 }}
                  placeholder="Ví dụ: Giám đốc, Tech, Marketing..."
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#a1a1aa', display: 'block', marginBottom: 4 }}>Telegram Username</label>
                <input
                  className="input-dark"
                  value={newMember.telegramUsername}
                  onChange={e => setNewMember({ ...newMember, telegramUsername: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', fontSize: 12, borderRadius: 8 }}
                  placeholder="@username"
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#a1a1aa', display: 'block', marginBottom: 4 }}>Hình thức làm việc</label>
                <select
                  className="input-dark"
                  value={newMember.workArrangement || 'office'}
                  onChange={e => setNewMember({ ...newMember, workArrangement: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', fontSize: 12, borderRadius: 8, marginBottom: 12 }}
                >
                  <option value="office">Full-time (Tại văn phòng)</option>
                  <option value="remote">Làm từ xa (Remote)</option>
                  <option value="freelance">Tự do (Freelance)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#a1a1aa', display: 'block', marginBottom: 4 }}>Màu đại diện</label>
                <input
                  type="color"
                  value={newMember.color}
                  onChange={e => setNewMember({ ...newMember, color: e.target.value })}
                  style={{ width: '100%', height: 36, border: 'none', background: 'transparent', cursor: 'pointer' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <button
                className="btn-ghost"
                onClick={() => setShowAddModal(false)}
                style={{ padding: '8px 16px', fontSize: 12, borderRadius: 8 }}
              >
                Hủy
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  if (setTeamMembers && newMember.name) {
                    const added = {
                      id: 'new-' + Date.now(),
                      name: newMember.name,
                      role: newMember.role,
                      email: newMember.email,
                      color: newMember.color,
                      skills: newMember.skills || [],
                      telegramUsername: newMember.telegramUsername || '',
                      workArrangement: newMember.workArrangement || 'office',
                      isActive: true
                    } as any;
                    setTeamMembers(prev => [...prev, added]);
                    setShowAddModal(false);
                    setNewMember({ name: '', role: 'Nhân sự mới', email: '', color: '#10b981', skills: [], telegramUsername: '' });
                  }
                }}
                style={{ padding: '8px 16px', fontSize: 12, borderRadius: 8 }}
              >
                Tạo mới
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
