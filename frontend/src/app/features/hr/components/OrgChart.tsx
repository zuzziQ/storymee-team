import React, { useMemo, useState } from 'react';
import { TeamMember, Task, getInitials } from '../../../constants';
import { coreApiClient, API_ROUTES } from '../../../../lib/apiClient';
import { accountStatusLabel, isTeamAdmin } from '@/lib/teamAuth';

export type AccountFilter = 'active' | 'hidden' | 'all';

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
  /** active = only working roster; hidden = suspended/rejected/inactive; all = everything */
  accountFilter?: AccountFilter;
  setAccountFilter?: (f: AccountFilter) => void;
}

function isVisibleActive(m: TeamMember): boolean {
  const st = (m.accountStatus || 'active').toLowerCase();
  return st === 'active' && m.isActive !== false;
}

function isHiddenAccount(m: TeamMember): boolean {
  const st = (m.accountStatus || 'active').toLowerCase();
  return st === 'suspended' || st === 'rejected' || st === 'pending' || m.isActive === false;
}

function matchesDept(m: TeamMember, hrDeptFilter: string): boolean {
  if (hrDeptFilter === 'all') return true;
  const role = (m.role || '').toLowerCase();
  if (hrDeptFilter === 'Giám đốc') return role.includes('ceo') || role.includes('founder') || role.includes('director');
  if (hrDeptFilter === 'Tech') return ['cto', 'developer', 'designer', 'it', 'admin'].some((k) => role.includes(k));
  if (hrDeptFilter === 'Nội dung')
    return ['content', 'media', 'editor', 'trợ lý', 'writer', 'biên'].some((k) => role.includes(k));
  if (hrDeptFilter === 'Marketing') return role.includes('marketing');
  return true;
}

function matchesSearch(m: TeamMember, q: string): boolean {
  if (!q) return true;
  const s = q.toLowerCase();
  return (
    (m.name || m.fullName || '').toLowerCase().includes(s) ||
    (m.role || '').toLowerCase().includes(s) ||
    (m.email || '').toLowerCase().includes(s) ||
    (m.telegramUsername || '').toLowerCase().includes(s)
  );
}

const LEAD_EMAILS = {
  ceo: 'kimngan151091@gmail.com',
  cto: 'lehuyducanh.vn@gmail.com',
  lead: 'thanhtutran08@gmail.com',
  techKids: ['zuzzivn@gmail.com', 'phqhuong.0510@gmail.com'],
  content: [
    'jeantran.creative@gmail.com',
    'nguyenductrungdung.2005@gmail.com',
    'huongiiiang@gmail.com',
    'daulinh110124@gmail.com',
    'lanthao1792003@gmail.com',
  ],
};

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
  tasks,
  accountFilter: accountFilterProp,
  setAccountFilter: setAccountFilterProp,
}: OrgChartProps) {
  const [localFilter, setLocalFilter] = useState<AccountFilter>('active');
  const accountFilter = accountFilterProp ?? localFilter;
  const setAccountFilter = setAccountFilterProp ?? setLocalFilter;

  const [showAddModal, setShowAddModal] = useState(false);
  const [newMember, setNewMember] = useState<Partial<TeamMember>>({
    name: '',
    role: 'Nhân sự mới',
    email: '',
    color: '#10b981',
    skills: [],
    telegramUsername: '',
  });

  const filtered = useMemo(() => {
    return teamMembers.filter((m) => {
      if (accountFilter === 'active' && !isVisibleActive(m)) return false;
      if (accountFilter === 'hidden' && !isHiddenAccount(m)) return false;
      // all: show everyone (admin), non-admin still only active
      if (accountFilter === 'all' && !isAdmin && !isVisibleActive(m)) return false;
      if (!matchesSearch(m, hrSearchQuery)) return false;
      if (!matchesDept(m, hrDeptFilter)) return false;
      return true;
    });
  }, [teamMembers, accountFilter, hrSearchQuery, hrDeptFilter, isAdmin]);

  const counts = useMemo(() => {
    const active = teamMembers.filter(isVisibleActive).length;
    const hidden = teamMembers.filter(isHiddenAccount).length;
    return { active, hidden, all: teamMembers.length };
  }, [teamMembers]);

  const emailIn = (m: TeamMember, list: string[]) =>
    list.includes((m.email || '').toLowerCase());

  const renderCard = (m: TeamMember, opts?: { wide?: boolean; glow?: string }) => {
    const isSelected = selectedMemberId === m.id;
    const st = (m.accountStatus || 'active').toLowerCase();
    const muted = !isVisibleActive(m);
    return (
      <div
        key={m.id}
        onClick={() => {
          if (isAdmin) setSelectedMemberId(m.id);
        }}
        className="glass"
        style={{
          padding: opts?.wide ? '14px 18px' : '10px 14px',
          width: opts?.wide ? 220 : '100%',
          maxWidth: opts?.wide ? 220 : 220,
          display: 'flex',
          alignItems: opts?.wide ? 'center' : 'center',
          flexDirection: opts?.wide ? 'column' : 'row',
          gap: 10,
          border: isSelected
            ? '2px solid #a78bfa'
            : opts?.glow
              ? `1px solid ${opts.glow}`
              : '1px solid var(--border)',
          boxShadow: isSelected ? '0 0 12px rgba(167,139,250,0.25)' : 'none',
          cursor: isAdmin ? 'pointer' : 'default',
          opacity: muted ? 0.55 : 1,
          position: 'relative',
          textAlign: opts?.wide ? 'center' : 'left',
        }}
      >
        <div
          className="avatar"
          style={{
            background: (m.color || '#6366f1') + '25',
            color: m.color || '#6366f1',
            width: opts?.wide ? 44 : 32,
            height: opts?.wide ? 44 : 32,
            fontSize: opts?.wide ? 15 : 11,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {getInitials(m.name || m.fullName || '?')}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: opts?.wide ? 13 : 12, color: '#fafafa' }}>
            {m.name || m.fullName}
          </div>
          <div style={{ fontSize: 9, color: '#71717a' }}>{m.role}</div>
          {muted && (
            <div style={{ fontSize: 9, color: st === 'pending' ? '#fbbf24' : '#f87171', marginTop: 2 }}>
              {accountStatusLabel(st)}
              {m.isActive === false ? ' · ẩn' : ''}
            </div>
          )}
          {isTeamAdmin(m) && !muted && (
            <div style={{ fontSize: 8, color: '#a78bfa', marginTop: 2 }}>ADMIN</div>
          )}
        </div>
      </div>
    );
  };

  const byEmail = (email: string) =>
    filtered.filter((m) => (m.email || '').toLowerCase() === email);

  const known = new Set([
    LEAD_EMAILS.ceo,
    LEAD_EMAILS.cto,
    LEAD_EMAILS.lead,
    ...LEAD_EMAILS.techKids,
    ...LEAD_EMAILS.content,
  ]);
  const others = filtered.filter((m) => !known.has((m.email || '').toLowerCase()));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 4,
            background: 'rgba(0,0,0,0.2)',
            padding: 3,
            borderRadius: 8,
            border: '1px solid var(--border)',
          }}
        >
          <button
            onClick={() => setHrProfileView('chart')}
            className="btn-ghost"
            style={{
              padding: '5px 12px',
              fontSize: 11,
              borderRadius: 6,
              border: 'none',
              background: hrProfileView === 'chart' ? 'rgba(255,255,255,0.06)' : 'transparent',
              color: hrProfileView === 'chart' ? 'white' : '#71717a',
              cursor: 'pointer',
              fontWeight: hrProfileView === 'chart' ? 600 : 400,
            }}
          >
            🌿 Sơ đồ cấu trúc
          </button>
          <button
            onClick={() => setHrProfileView('list')}
            className="btn-ghost"
            style={{
              padding: '5px 12px',
              fontSize: 11,
              borderRadius: 6,
              border: 'none',
              background: hrProfileView === 'list' ? 'rgba(255,255,255,0.06)' : 'transparent',
              color: hrProfileView === 'list' ? 'white' : '#71717a',
              cursor: 'pointer',
              fontWeight: hrProfileView === 'list' ? 600 : 400,
            }}
          >
            📋 Danh sách
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Account visibility filter */}
          {isAdmin && (
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
              {(
                [
                  { id: 'active', label: `Đang làm (${counts.active})` },
                  { id: 'hidden', label: `Ẩn/khoá (${counts.hidden})` },
                  { id: 'all', label: `Tất cả (${counts.all})` },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setAccountFilter(f.id)}
                  style={{
                    padding: '5px 10px',
                    fontSize: 10,
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    background:
                      accountFilter === f.id ? 'rgba(167,139,250,0.2)' : 'transparent',
                    color: accountFilter === f.id ? '#c4b5fd' : '#71717a',
                    fontWeight: accountFilter === f.id ? 600 : 400,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

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
            className="input-dark"
            placeholder="Tìm tên / email / @telegram..."
            value={hrSearchQuery}
            onChange={(e) => setHrSearchQuery(e.target.value)}
            style={{
              padding: '6px 12px',
              fontSize: 11,
              borderRadius: 8,
              width: 180,
              background: '#18181b',
              border: '1px solid var(--border)',
              color: 'white',
            }}
          />
          <select
            value={hrDeptFilter}
            onChange={(e) => setHrDeptFilter(e.target.value)}
            style={{
              background: '#18181b',
              border: '1px solid var(--border)',
              color: '#fafafa',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: 11,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">Tất cả ban</option>
            <option value="Giám đốc">Ban Giám Đốc</option>
            <option value="Tech">Công nghệ & SP</option>
            <option value="Nội dung">Nội dung & Media</option>
            <option value="Marketing">Marketing</option>
          </select>
        </div>
      </div>

      {accountFilter === 'active' && (
        <div style={{ fontSize: 11, color: '#52525b' }}>
          Chỉ hiện tài khoản <strong style={{ color: '#34d399' }}>đang hoạt động</strong>. Bật
          filter <em>Ẩn/khoá</em> để xem nghỉ việc / suspended / pending.
        </div>
      )}
      {accountFilter === 'hidden' && (
        <div style={{ fontSize: 11, color: '#fbbf24' }}>
          Đang xem tài khoản ẩn / khoá / pending / rejected ({filtered.length}).
        </div>
      )}

      {/* Chart — tree for active roster */}
      {hrProfileView === 'chart' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            padding: '12px 0',
            overflowX: 'auto',
            width: '100%',
          }}
        >
          {accountFilter === 'hidden' || accountFilter === 'all' ? (
            // Flat grid when showing hidden/all — no fake hierarchy for inactive
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 12,
                width: '100%',
              }}
            >
              {filtered.length === 0 ? (
                <div style={{ color: '#52525b', fontSize: 12, gridColumn: '1/-1', textAlign: 'center', padding: 24 }}>
                  Không có tài khoản khớp filter.
                </div>
              ) : (
                filtered.map((m) => renderCard(m))
              )}
            </div>
          ) : (
            <>
              {byEmail(LEAD_EMAILS.ceo).map((m) => (
                <div key={m.id} style={{ position: 'relative' }}>
                  <div
                    style={{
                      position: 'absolute',
                      top: -8,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#f59e0b',
                      color: '#111',
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 10,
                      zIndex: 1,
                    }}
                  >
                    BOARD
                  </div>
                  {renderCard(m, { wide: true, glow: 'rgba(245,158,11,0.4)' })}
                </div>
              ))}

              {byEmail(LEAD_EMAILS.ceo).length > 0 && (
                <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
              )}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 24,
                  width: '100%',
                  maxWidth: 920,
                }}
              >
                {/* Tech column */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  {byEmail(LEAD_EMAILS.cto).map((m) => renderCard(m, { glow: 'rgba(99,102,241,0.35)' }))}
                  {byEmail(LEAD_EMAILS.cto).length > 0 && (
                    <div style={{ width: 1, height: 12, background: 'var(--border)' }} />
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                    {filtered
                      .filter((m) => emailIn(m, LEAD_EMAILS.techKids))
                      .map((m) => renderCard(m))}
                  </div>
                </div>

                {/* Content column */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  {byEmail(LEAD_EMAILS.lead).map((m) =>
                    renderCard(m, { glow: 'rgba(236,72,153,0.35)' })
                  )}
                  {byEmail(LEAD_EMAILS.lead).length > 0 && (
                    <div style={{ width: 1, height: 12, background: 'var(--border)' }} />
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                    {filtered
                      .filter((m) => emailIn(m, LEAD_EMAILS.content))
                      .map((m) => renderCard(m))}
                  </div>
                </div>

                {/* Others */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#a1a1aa',
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                    }}
                  >
                    Nhân sự khác
                  </div>
                  {others.length === 0 ? (
                    <div style={{ fontSize: 11, color: '#52525b' }}>—</div>
                  ) : (
                    others.map((m) => renderCard(m))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* List view */}
      {hrProfileView === 'list' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 12,
          }}
        >
          {filtered.length === 0 && (
            <div style={{ color: '#52525b', fontSize: 12, gridColumn: '1/-1', textAlign: 'center', padding: 30 }}>
              Không có nhân sự khớp filter.
            </div>
          )}
          {filtered.map((m) => {
            const myTasks = tasks.filter(
              (t) => t.assignee === m.name && t.status !== 'Done'
            );
            const isSelected = selectedMemberId === m.id;
            const st = (m.accountStatus || 'active').toLowerCase();
            const muted = !isVisibleActive(m);
            return (
              <div
                key={m.id}
                onClick={() => {
                  if (isAdmin) setSelectedMemberId(m.id);
                }}
                className="glass"
                style={{
                  padding: 14,
                  border: isSelected ? '2px solid #a78bfa' : '1px solid var(--border)',
                  cursor: isAdmin ? 'pointer' : 'default',
                  opacity: muted ? 0.65 : 1,
                  boxShadow: isSelected ? '0 0 10px rgba(167,139,250,0.2)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div
                    className="avatar"
                    style={{
                      background: (m.color || '#6366f1') + '25',
                      color: m.color || '#6366f1',
                      width: 36,
                      height: 36,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {getInitials(m.name || m.fullName || '?')}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#fafafa' }}>
                      {m.name || m.fullName}{' '}
                      <span
                        style={{
                          fontSize: 9,
                          color:
                            st === 'active'
                              ? '#34d399'
                              : st === 'pending'
                                ? '#fbbf24'
                                : '#f87171',
                        }}
                      >
                        {accountStatusLabel(st)}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: '#71717a' }}>{m.role}</div>
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 10,
                    color: '#71717a',
                    borderTop: '1px solid var(--border)',
                    paddingTop: 8,
                  }}
                >
                  <span>@{m.telegramUsername || '—'}</span>
                  <span>{myTasks.length} task mở</span>
                </div>
                {isAdmin && (
                  <div style={{ fontSize: 9, color: '#a78bfa', marginTop: 6 }}>
                    Click → hồ sơ · duyệt / khoá / xoá
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            className="glass"
            style={{
              width: 400,
              padding: 24,
              borderRadius: 16,
              background: '#18181b',
              border: '1px solid var(--border)',
            }}
          >
            <h3 style={{ margin: '0 0 16px 0', color: '#fafafa', fontSize: 16 }}>
              Thêm nhân sự mới
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                className="input-dark"
                value={newMember.name}
                onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', fontSize: 12, borderRadius: 8 }}
                placeholder="Họ tên"
              />
              <input
                className="input-dark"
                value={newMember.email}
                onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', fontSize: 12, borderRadius: 8 }}
                placeholder="email@company.com"
              />
              <input
                className="input-dark"
                value={newMember.role}
                onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', fontSize: 12, borderRadius: 8 }}
                placeholder="Chức vụ"
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  className="btn"
                  onClick={() => setShowAddModal(false)}
                  style={{ padding: '8px 14px', fontSize: 12 }}
                >
                  Huỷ
                </button>
                <button
                  className="btn-primary"
                  onClick={async () => {
                    if (!newMember.name || !newMember.email) return;
                    try {
                      await coreApiClient.post(API_ROUTES.HR.TEAM_MEMBERS, {
                        fullName: newMember.name,
                        email: newMember.email,
                        role: newMember.role,
                        telegramUsername: newMember.telegramUsername,
                        workArrangement: newMember.workArrangement || 'office',
                      });
                      setShowAddModal(false);
                      window.location.reload();
                    } catch (e) {
                      alert('Không tạo được nhân sự');
                    }
                  }}
                  style={{ padding: '8px 14px', fontSize: 12 }}
                >
                  Tạo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
