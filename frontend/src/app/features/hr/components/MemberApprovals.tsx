'use client';

import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { TeamMember } from '../../../constants';
import { coreApiClient, API_ROUTES } from '@/lib/apiClient';
import { accountStatusLabel, isTeamAdmin } from '@/lib/teamAuth';

interface Props {
  teamMembers: TeamMember[];
  activeUser: TeamMember;
  onRefresh: () => void;
  /** When true: only pending banner + compact (embedded in profile) */
  embedded?: boolean;
  /** Highlight / scroll to this member id */
  selectedMemberId?: string;
  onSelectMember?: (id: string) => void;
}

export async function runMemberAccountAction(
  id: string,
  action: 'approve' | 'reject' | 'suspend' | 'delete',
  activeUser: TeamMember,
  onRefresh: () => void
) {
  if (action === 'approve') {
    await coreApiClient.post(API_ROUTES.HR.memberApprove(id), {
      reviewerId: activeUser.id,
      note: 'Duyệt trên StorymeeTeam',
    });
    toast.success('Đã duyệt / kích hoạt tài khoản');
  } else if (action === 'reject') {
    const note = window.prompt('Lý do từ chối (tuỳ chọn):') || 'Từ chối trên web';
    await coreApiClient.post(API_ROUTES.HR.memberReject(id), {
      reviewerId: activeUser.id,
      note,
    });
    toast.success('Đã từ chối');
  } else if (action === 'suspend') {
    const note = window.prompt('Lý do khoá:') || 'Khoá trên web';
    await coreApiClient.post(API_ROUTES.HR.memberSuspend(id), {
      reviewerId: activeUser.id,
      note,
    });
    toast.success('Đã khoá tài khoản');
  } else if (action === 'delete') {
    const soft = window.confirm(
      'OK = Khoá (xoá mềm).\nCancel = huỷ.\n\nMuốn xoá VĨNH VIỄN? Chọn Cancel rồi OK ở hộp tiếp theo.'
    );
    if (soft) {
      await coreApiClient.post(API_ROUTES.HR.memberSuspend(id), {
        reviewerId: activeUser.id,
        note: 'Xoá mềm từ UI',
      });
      toast.success('Đã khoá (xoá mềm)');
    } else if (
      window.confirm('Xoá VĨNH VIỄN khỏi DB? Có thể lỗi nếu còn task/chấm công.')
    ) {
      await coreApiClient.delete(API_ROUTES.HR.memberDelete(id, true), {
        reviewerId: activeUser.id,
      });
      toast.success('Đã gửi yêu cầu xoá vĩnh viễn');
    } else {
      return;
    }
  }
  onRefresh();
}

export default function MemberApprovals({
  teamMembers,
  activeUser,
  onRefresh,
  embedded = false,
  selectedMemberId,
  onSelectMember,
}: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const admin = isTeamAdmin(activeUser);

  const pending = useMemo(
    () => teamMembers.filter((m) => (m.accountStatus || 'active') === 'pending'),
    [teamMembers]
  );
  const sorted = useMemo(() => {
    const rank = (s: string) =>
      s === 'pending' ? 0 : s === 'active' ? 1 : s === 'suspended' ? 2 : 3;
    return [...teamMembers].sort((a, b) => {
      const sa = (a.accountStatus || 'active').toLowerCase();
      const sb = (b.accountStatus || 'active').toLowerCase();
      if (rank(sa) !== rank(sb)) return rank(sa) - rank(sb);
      return (a.name || a.fullName || '').localeCompare(b.name || b.fullName || '', 'vi');
    });
  }, [teamMembers]);

  const nonActive = useMemo(
    () =>
      teamMembers.filter((m) => {
        const s = (m.accountStatus || 'active').toLowerCase();
        return s !== 'active' || m.isActive === false;
      }),
    [teamMembers]
  );

  if (!admin) {
    if (embedded) return null;
    return (
      <div className="glass" style={{ padding: 16, fontSize: 13, color: '#71717a' }}>
        Chỉ Admin mới xem và duyệt đăng ký tài khoản nội bộ.
      </div>
    );
  }

  const run = async (id: string, action: 'approve' | 'reject' | 'suspend' | 'delete') => {
    setBusyId(id);
    try {
      await runMemberAccountAction(id, action, activeUser, onRefresh);
    } catch (e: any) {
      toast.error(e?.data?.message || e?.message || 'Thao tác thất bại');
    } finally {
      setBusyId(null);
    }
  };

  const statusColor = (st: string) =>
    st === 'active' ? '#34d399' : st === 'pending' ? '#fbbf24' : '#f87171';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: embedded ? 12 : 16 }}>
      {/* Pending always on top */}
      <div
        className="glass"
        style={{
          padding: embedded ? 12 : 16,
          border: pending.length ? '1px solid rgba(251,191,36,0.35)' : '1px solid var(--border)',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#fafafa' }}>
          📝 Chờ duyệt đăng ký ({pending.length})
        </div>
        {pending.length === 0 ? (
          <div style={{ fontSize: 12, color: '#71717a' }}>Không có yêu cầu pending.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pending.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  padding: 10,
                  borderRadius: 10,
                  border: '1px solid rgba(251,191,36,0.25)',
                  background: 'rgba(251,191,36,0.06)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#fafafa' }}>
                    {m.name || m.fullName}
                  </div>
                  <div style={{ fontSize: 10, color: '#a1a1aa' }}>
                    {m.email} · @{m.telegramUsername || '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn-primary"
                    disabled={busyId === m.id}
                    onClick={() => run(m.id, 'approve')}
                    style={{ fontSize: 11, padding: '5px 10px' }}
                  >
                    Duyệt
                  </button>
                  <button
                    className="btn"
                    disabled={busyId === m.id}
                    onClick={() => run(m.id, 'reject')}
                    style={{ fontSize: 11, padding: '5px 10px', color: '#f87171' }}
                  >
                    Từ chối
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full roster — always all members, scrollable */}
      <div className="glass" style={{ padding: embedded ? 12 : 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 8,
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 13, color: '#fafafa' }}>
            👥 Toàn bộ tài khoản ({teamMembers.length})
          </div>
          <div style={{ fontSize: 10, color: '#71717a' }}>
            Active {teamMembers.length - nonActive.length} · Không active {nonActive.length}
          </div>
        </div>
        <div style={{ fontSize: 10, color: '#52525b', marginBottom: 8 }}>
          Gồm pending / active / suspended / rejected — cuộn để xem hết. Click dòng để mở hồ sơ.
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            maxHeight: embedded ? 280 : 420,
            overflow: 'auto',
          }}
        >
          {sorted.map((m) => {
            const st = (m.accountStatus || 'active').toLowerCase();
            const selected = selectedMemberId === m.id;
            return (
              <div
                key={m.id}
                onClick={() => onSelectMember?.(m.id)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: selected
                    ? '1px solid rgba(167,139,250,0.55)'
                    : '1px solid rgba(255,255,255,0.06)',
                  background: selected ? 'rgba(167,139,250,0.08)' : 'transparent',
                  cursor: onSelectMember ? 'pointer' : 'default',
                  opacity: st === 'active' ? 1 : 0.85,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#e4e4e7' }}>
                    {m.name || m.fullName}{' '}
                    <span style={{ fontSize: 10, fontWeight: 500, color: statusColor(st) }}>
                      · {accountStatusLabel(st)}
                      {m.isActive === false && st === 'active' ? ' (ẩn sơ đồ)' : ''}
                    </span>
                    {isTeamAdmin(m) && (
                      <span
                        style={{
                          fontSize: 9,
                          marginLeft: 6,
                          color: '#a78bfa',
                          background: 'rgba(167,139,250,0.12)',
                          padding: '1px 5px',
                          borderRadius: 4,
                        }}
                      >
                        ADMIN
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: '#71717a' }}>
                    {m.email} · {m.role || '—'}
                  </div>
                </div>
                <div
                  style={{ display: 'flex', gap: 6, flexShrink: 0 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {st !== 'active' && st !== 'rejected' && (
                    <button
                      className="btn"
                      style={{ fontSize: 11, padding: '4px 8px', color: '#34d399' }}
                      disabled={busyId === m.id}
                      onClick={() => run(m.id, 'approve')}
                    >
                      Active
                    </button>
                  )}
                  {st === 'rejected' && (
                    <button
                      className="btn"
                      style={{ fontSize: 11, padding: '4px 8px', color: '#34d399' }}
                      disabled={busyId === m.id}
                      onClick={() => run(m.id, 'approve')}
                    >
                      Duyệt lại
                    </button>
                  )}
                  {st === 'active' && m.id !== activeUser.id && (
                    <button
                      className="btn"
                      style={{ fontSize: 11, padding: '4px 8px', color: '#fbbf24' }}
                      disabled={busyId === m.id}
                      onClick={() => run(m.id, 'suspend')}
                    >
                      Khoá
                    </button>
                  )}
                  {m.id !== activeUser.id && (
                    <button
                      className="btn"
                      style={{ fontSize: 11, padding: '4px 8px', color: '#f87171' }}
                      disabled={busyId === m.id}
                      onClick={() => run(m.id, 'delete')}
                    >
                      Xoá
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
