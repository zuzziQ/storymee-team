'use client';

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { TeamMember } from '../../../constants';
import { coreApiClient, API_ROUTES } from '@/lib/apiClient';
import {
  buildLeaveDateRange,
  mapUiLeaveType,
  LeaveSession,
} from '@/lib/leaveApi';

interface Props {
  activeUser: TeamMember;
  onSubmitted: () => void;
}

/**
 * Submit leave — same payload as Telegram MCP tool `submit_leave_request`.
 */
export default function LeaveRequestForm({ activeUser, onSubmitted }: Props) {
  const [leaveKind, setLeaveKind] = useState<'leave' | 'remote' | 'sick'>('leave');
  const [session, setSession] = useState<LeaveSession>('all');
  const [date, setDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const remainingAnnual = Math.max(
    0,
    (activeUser.annualLeaveLimit ?? 12) - (activeUser.annualLeaveUsed ?? 0)
  );
  const remainingRemote = Math.max(
    0,
    (activeUser.remoteLimit ?? 4) - (activeUser.remoteUsed ?? 0)
  );

  const submit = async () => {
    if (!activeUser?.id) {
      toast.error('Chưa xác định user DB — đăng nhập lại');
      return;
    }
    if (!date) {
      toast.error('Chọn ngày bắt đầu');
      return;
    }
    if (!reason.trim()) {
      toast.error('Nhập lý do');
      return;
    }

    const { startDate, endDate: endIso } = buildLeaveDateRange(
      date,
      session,
      endDate || undefined
    );
    const leaveType = mapUiLeaveType(leaveKind);

    setSaving(true);
    try {
      const res: any = await coreApiClient.post(API_ROUTES.HR.LEAVE_REQUESTS, {
        memberId: activeUser.id,
        leaveType,
        startDate,
        endDate: endIso,
        reason: reason.trim(),
      });
      if (res?.status === 'success') {
        toast.success('Đã gửi đơn — chờ Admin duyệt (Telegram + web)');
        setReason('');
        setDate('');
        setEndDate('');
        onSubmitted();
      } else {
        toast.error(res?.message || 'Gửi đơn thất bại');
      }
    } catch (e: any) {
      toast.error(e?.data?.message || e?.message || 'Lỗi API nghỉ phép');
    }
    setSaving(false);
  };

  return (
    <div className="glass" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 14, color: '#fafafa' }}>📝 Xin nghỉ / Remote</div>
      <div style={{ fontSize: 11, color: '#71717a' }}>
        Cùng API với bot Telegram · Phép còn: <strong style={{ color: '#a78bfa' }}>{remainingAnnual}</strong> ngày ·
        Remote còn: <strong style={{ color: '#a78bfa' }}>{remainingRemote}</strong> ngày
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <label style={{ fontSize: 11, color: '#a1a1aa' }}>
          Loại
          <select
            value={leaveKind}
            onChange={(e) => setLeaveKind(e.target.value as any)}
            style={inputStyle}
          >
            <option value="leave">Nghỉ phép năm</option>
            <option value="remote">Làm remote</option>
            <option value="sick">Nghỉ ốm</option>
          </select>
        </label>
        <label style={{ fontSize: 11, color: '#a1a1aa' }}>
          Buổi
          <select
            value={session}
            onChange={(e) => setSession(e.target.value as LeaveSession)}
            style={inputStyle}
          >
            <option value="all">Cả ngày</option>
            <option value="am">Sáng</option>
            <option value="pm">Chiều</option>
          </select>
        </label>
        <label style={{ fontSize: 11, color: '#a1a1aa' }}>
          Từ ngày *
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ fontSize: 11, color: '#a1a1aa' }}>
          Đến ngày (tuỳ chọn)
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={inputStyle}
          />
        </label>
      </div>

      <label style={{ fontSize: 11, color: '#a1a1aa' }}>
        Lý do *
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Ví dụ: khám bệnh, việc gia đình..."
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </label>

      <button
        className="btn-primary"
        disabled={saving}
        onClick={submit}
        style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13 }}
      >
        {saving ? 'Đang gửi…' : 'Gửi đơn xin phép'}
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'rgba(0,0,0,0.25)',
  color: '#fafafa',
  fontSize: 12,
};
