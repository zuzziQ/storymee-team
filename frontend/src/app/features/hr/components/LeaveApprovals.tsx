import React from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { getMemberColor, getInitials } from '../../../constants';

interface LeaveApprovalsProps {
  leavesPending: any[];
  handleApproveLeave: (id: string) => void;
  handleRejectLeave: (id: string) => void;
}

export default function LeaveApprovals({
  leavesPending,
  handleApproveLeave,
  handleRejectLeave
}: LeaveApprovalsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {leavesPending.map((l, i) => (
        <div key={i} className="glass" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="avatar" style={{ background: getMemberColor(l.name) + '25', color: getMemberColor(l.name), width: 40, height: 40 }}>{getInitials(l.name)}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              {l.name} · {l.type} · {l.date} · {l.days} ngày
              <span style={{
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 4,
                background: l.status === 'Pending' ? 'rgba(245,158,11,0.12)' : l.status === 'Approved' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                color: l.status === 'Pending' ? '#f59e0b' : l.status === 'Approved' ? '#22c55e' : '#ef4444',
                fontWeight: 600
              }}>
                {l.status}
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 4 }}>Lý do: <strong>{l.task}</strong></div>
            <div style={{ fontSize: 11, color: '#71717a' }}>Đề xuất bàn giao công việc: <span style={{ color: '#818cf8' }}>{l.handover}</span></div>
          </div>
          {l.status === 'Pending' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => handleApproveLeave(l.id)} className="btn-primary" style={{ padding: '8px 16px', fontSize: 12, background: '#22c55e', border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ThumbsUp size={12} /> Duyệt
              </button>
              <button onClick={() => handleRejectLeave(l.id)} className="btn-ghost" style={{ padding: '8px 16px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ThumbsDown size={12} /> Từ chối
              </button>
            </div>
          )}
        </div>
      ))}
      {leavesPending.length === 0 && (
        <div className="glass" style={{ padding: '40px', textAlign: 'center', color: '#52525b', fontSize: 13 }}>
          Không có đơn xin phép nào khác đang chờ duyệt ✓
        </div>
      )}
    </div>
  );
}
