'use client';

import React from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { getMemberColor, getInitials, TeamMember } from '../../../constants';
import LeaveRequestForm from './LeaveRequestForm';
import { isTeamAdmin } from '@/lib/teamAuth';

interface LeaveApprovalsProps {
  leavesPending: any[];
  handleApproveLeave: (id: string) => void;
  handleRejectLeave: (id: string) => void;
  activeUser: TeamMember;
  onLeaveSubmitted: () => void;
}

export default function LeaveApprovals({
  leavesPending,
  handleApproveLeave,
  handleRejectLeave,
  activeUser,
  onLeaveSubmitted,
}: LeaveApprovalsProps) {
  const admin = isTeamAdmin(activeUser);
  const pending = leavesPending.filter((l) => l.status === 'Pending');
  const mine = leavesPending.filter(
    (l) =>
      l.memberId === activeUser.id ||
      (l.name || '').toLowerCase() === (activeUser.name || activeUser.fullName || '').toLowerCase()
  );
  const listForAdmin = leavesPending;
  const listForEmployee = mine;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <LeaveRequestForm activeUser={activeUser} onSubmitted={onLeaveSubmitted} />

      <div style={{ fontWeight: 600, fontSize: 13, color: '#e4e4e7' }}>
        {admin ? `📋 Tất cả đơn (${listForAdmin.length})` : `📋 Đơn của tôi (${listForEmployee.length})`}
        {admin && pending.length > 0 && (
          <span style={{ marginLeft: 8, color: '#f59e0b', fontSize: 12 }}>
            · {pending.length} chờ duyệt
          </span>
        )}
      </div>

      {(admin ? listForAdmin : listForEmployee).map((l) => (
        <div
          key={l.id}
          className="glass"
          style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16 }}
        >
          <div
            className="avatar"
            style={{
              background: getMemberColor(l.name) + '25',
              color: getMemberColor(l.name),
              width: 40,
              height: 40,
            }}
          >
            {getInitials(l.name)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {l.name} · {l.type} · {l.date}
              {l.dateEnd && l.dateEnd !== l.date ? ` → ${l.dateEnd}` : ''} · {l.days} ngày
              <span
                style={{
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background:
                    l.status === 'Pending'
                      ? 'rgba(245,158,11,0.12)'
                      : l.status === 'Approved'
                        ? 'rgba(34,197,94,0.12)'
                        : 'rgba(239,68,68,0.12)',
                  color:
                    l.status === 'Pending'
                      ? '#f59e0b'
                      : l.status === 'Approved'
                        ? '#22c55e'
                        : '#ef4444',
                  fontWeight: 600,
                }}
              >
                {l.status}
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 4 }}>
              Lý do: <strong style={{ color: '#e4e4e7' }}>{l.reason || '—'}</strong>
            </div>
          </div>
          {admin && l.status === 'Pending' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => handleApproveLeave(l.id)}
                className="btn-primary"
                style={{
                  padding: '8px 16px',
                  fontSize: 12,
                  background: '#22c55e',
                  border: 'none',
                  color: 'white',
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <ThumbsUp size={12} /> Duyệt
              </button>
              <button
                onClick={() => handleRejectLeave(l.id)}
                className="btn-ghost"
                style={{
                  padding: '8px 16px',
                  fontSize: 12,
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <ThumbsDown size={12} /> Từ chối
              </button>
            </div>
          )}
        </div>
      ))}

      {(admin ? listForAdmin : listForEmployee).length === 0 && (
        <div className="glass" style={{ padding: 40, textAlign: 'center', color: '#52525b', fontSize: 13 }}>
          Chưa có đơn nào. Gửi form phía trên hoặc dùng bot Telegram.
        </div>
      )}
    </div>
  );
}
