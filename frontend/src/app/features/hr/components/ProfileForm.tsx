import React, { useState } from 'react';
import { TeamMember, getInitials } from '../../../constants';
import {
  accountStatusLabel,
  canViewPrivateFields,
  DEFAULT_PRIVACY,
  isTeamAdmin,
} from '@/lib/teamAuth';
import { runMemberAccountAction } from './MemberApprovals';

interface ProfileFormProps {
  myMember: TeamMember;
  isEditingSelf: boolean;
  setTeamMembers: React.Dispatch<React.SetStateAction<TeamMember[]>>;
  handleSaveMyProfile: (member: TeamMember) => void;
  isAdmin?: boolean;
  /** Viewer (logged-in user) for privacy checks when viewing peers */
  viewer?: TeamMember | null;
  onRefreshHr?: () => void;
}

export default function ProfileForm({
  myMember,
  isEditingSelf,
  setTeamMembers,
  handleSaveMyProfile,
  isAdmin,
  viewer,
  onRefreshHr,
}: ProfileFormProps) {
  const [busy, setBusy] = useState(false);
  const priv = canViewPrivateFields(viewer || (isEditingSelf ? myMember : null), myMember, DEFAULT_PRIVACY);
  const showBank = isEditingSelf || !!isAdmin || priv.bank;
  const showSalary = !!isAdmin || isEditingSelf || priv.salary;
  const st = (myMember.accountStatus || 'active').toLowerCase();
  const statusColor =
    st === 'active' ? '#34d399' : st === 'pending' ? '#fbbf24' : '#f87171';

  const accountAction = async (action: 'approve' | 'reject' | 'suspend' | 'delete') => {
    if (!viewer || !isAdmin) return;
    setBusy(true);
    try {
      await runMemberAccountAction(myMember.id, action, viewer, () => onRefreshHr?.());
    } catch (e: any) {
      alert(e?.data?.message || e?.message || 'Thao tác thất bại');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className='glass' style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, height: 'fit-content' }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#fafafa' }}>
          {isEditingSelf ? 'HỒ SƠ CÁ NHÂN CỦA BẠN' : 'QUẢN LÝ HỒ SƠ: ' + myMember.name.toUpperCase()}
        </h3>
        <span style={{ fontSize: 11, color: '#71717a' }}>
          {isEditingSelf ? 'Cập nhật thông tin định danh và tài khoản nhận lương' : 'Quyền hạn Admin: Chỉnh sửa hồ sơ cho ' + myMember.name}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Avatar và Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)' }}>
          <div className='avatar' style={{ background: myMember.color + '25', color: myMember.color, width: 40, height: 40, fontSize: 14, fontWeight: 700 }}>
            {getInitials(myMember.name)}
          </div>
          <div>
            <strong style={{ fontSize: 13, color: '#fafafa', display: 'block' }}>{myMember.name}</strong>
            <span style={{ fontSize: 10, color: '#71717a' }}>{myMember.role}</span>
          </div>
        </div>

        {/* Name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10, color: '#71717a', fontWeight: 500 }}>Họ và Tên</span>
          <input
            className='input-dark'
            value={myMember.name}
            disabled={isEditingSelf}
            onChange={e => {
              const val = e.target.value;
              setTeamMembers(prev => prev.map(m => m.id === myMember.id ? { ...m, name: val } : m));
            }}
            style={{ padding: '8px 12px', fontSize: 12, borderRadius: 8, opacity: isEditingSelf ? 0.6 : 1, cursor: isEditingSelf ? 'not-allowed' : 'text' }}
          />
        </div>

        {/* Role */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10, color: '#71717a', fontWeight: 500 }}>Chức vụ / Vai trò</span>
          <input
            className='input-dark'
            value={myMember.role}
            disabled={isEditingSelf}
            onChange={e => {
              const val = e.target.value;
              setTeamMembers(prev => prev.map(m => m.id === myMember.id ? { ...m, role: val } : m));
            }}
            style={{ padding: '8px 12px', fontSize: 12, borderRadius: 8, opacity: isEditingSelf ? 0.6 : 1, cursor: isEditingSelf ? 'not-allowed' : 'text' }}
          />
        </div>

        {/* Email */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10, color: '#71717a', fontWeight: 500 }}>Email chính thức</span>
          <input className='input-dark' value={myMember.email} disabled style={{ padding: '8px 12px', fontSize: 12, borderRadius: 8, opacity: 0.6, cursor: 'not-allowed' }} />
        </div>

        {/* Phone */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10, color: '#71717a', fontWeight: 500 }}>Số điện thoại</span>
          <input
            className='input-dark'
            placeholder='Nhập số điện thoại liên lạc...'
            value={myMember.phone || ''}
            onChange={e => {
              const val = e.target.value;
              setTeamMembers(prev => prev.map(m => m.id === myMember.id ? { ...m, phone: val } : m));
            }}
            style={{ padding: '8px 12px', fontSize: 12, borderRadius: 8 }}
          />
        </div>

        {/* Telegram Username */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10, color: '#a78bfa', fontWeight: 600 }}>Username Telegram (Định danh Bot)</span>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: 12, fontSize: 12, color: '#71717a' }}>@</span>
            <input
              className='input-dark'
              placeholder='Username viết liền không dấu...'
              value={myMember.telegramUsername || ''}
              onChange={e => {
                const val = e.target.value.replace(/^@/, '');
                setTeamMembers(prev => prev.map(m => m.id === myMember.id ? { ...m, telegramUsername: val } : m));
              }}
              style={{ padding: '8px 12px 8px 24px', fontSize: 12, borderRadius: 8, border: '1px solid #a78bfa' }}
            />
          </div>
        </div>

        {/* Telegram Chat ID */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10, color: '#a78bfa', fontWeight: 600 }}>Telegram Chat ID (Nhận thông báo)</span>
          <input
            type='number'
            className='input-dark'
            placeholder='Nhập ID chat Telegram...'
            value={myMember.telegramChatId ? Number(myMember.telegramChatId) : ''}
            onChange={e => {
              const val = e.target.value ? Number(e.target.value) : undefined;
              setTeamMembers(prev => prev.map(m => m.id === myMember.id ? { ...m, telegramChatId: val } : m));
            }}
            style={{ padding: '8px 12px', fontSize: 12, borderRadius: 8 }}
          />
          <span style={{ fontSize: 9, color: '#71717a' }}>Dùng ID chat Telegram để nhận thông báo trực tiếp từ bot.</span>
        </div>

        {/* Bank — privacy: self or admin only by default */}
        {showBank ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, color: '#71717a', fontWeight: 500 }}>Ngân hàng nhận lương</span>
              <input
                className='input-dark'
                placeholder='Ví dụ: Techcombank, Vietcombank...'
                value={myMember.bankName || ''}
                onChange={e => {
                  const val = e.target.value;
                  setTeamMembers(prev => prev.map(m => m.id === myMember.id ? { ...m, bankName: val } : m));
                }}
                style={{ padding: '8px 12px', fontSize: 12, borderRadius: 8 }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, color: '#71717a', fontWeight: 500 }}>Số tài khoản ngân hàng</span>
              <input
                className='input-dark'
                placeholder='Nhập số tài khoản nhận lương...'
                value={myMember.bankAccount || ''}
                onChange={e => {
                  const val = e.target.value;
                  setTeamMembers(prev => prev.map(m => m.id === myMember.id ? { ...m, bankAccount: val } : m));
                }}
                style={{ padding: '8px 12px', fontSize: 12, borderRadius: 8 }}
              />
            </div>
          </>
        ) : (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px dashed var(--border)',
              fontSize: 11,
              color: '#71717a',
            }}
          >
            🔒 Thông tin ngân hàng được ẩn (privacy đội ngũ). Chỉ Admin hoặc chủ hồ sơ xem được.
          </div>
        )}

        {/* HR Configuration */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px', background: 'rgba(236,72,153,0.05)', border: '1px solid rgba(236,72,153,0.2)', borderRadius: 10, marginTop: 8 }}>
          <h4 style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#ec4899' }}>⚙️ CẤU HÌNH NHÂN SỰ {isAdmin ? '(ADMIN)' : '(CHỈ XEM)'}</h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, color: '#71717a', fontWeight: 500 }}>Hình thức làm việc</span>
            <select
              className='input-dark'
              value={myMember.workArrangement || 'office'}
              disabled={!isAdmin}
              onChange={e => {
                if (!isAdmin) return;
                const val = e.target.value;
                setTeamMembers(prev => prev.map(m => m.id === myMember.id ? { ...m, workArrangement: val } : m));
              }}
              style={{ padding: '8px 12px', fontSize: 12, borderRadius: 8, opacity: !isAdmin ? 0.6 : 1, cursor: !isAdmin ? 'not-allowed' : 'pointer' }}
            >
              <option value="office">Full-time (Tại văn phòng)</option>
              <option value="remote">Làm từ xa (Remote)</option>
              <option value="freelance">Tự do (Freelance)</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, color: '#71717a', fontWeight: 500 }}>Hạn mức phép năm (ngày)</span>
              <input
                type='number'
                className='input-dark'
                value={myMember.annualLeaveLimit || 12}
                disabled={!isAdmin}
                onChange={e => {
                  if (!isAdmin) return;
                  const val = Number(e.target.value);
                  setTeamMembers(prev => prev.map(m => m.id === myMember.id ? { ...m, annualLeaveLimit: val } : m));
                }}
                style={{ padding: '8px 12px', fontSize: 12, borderRadius: 8, opacity: !isAdmin ? 0.6 : 1, cursor: !isAdmin ? 'not-allowed' : 'text' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, color: '#71717a', fontWeight: 500 }}>Hạn mức Remote (ngày/tháng)</span>
              {myMember.workArrangement === 'remote' ? (
                <div style={{ padding: '8px 12px', fontSize: 12, borderRadius: 8, color: '#a1a1aa', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', height: 33, display: 'flex', alignItems: 'center' }}>
                  Không áp dụng (Full Remote)
                </div>
              ) : (
                <input
                  type='number'
                  className='input-dark'
                  value={myMember.remoteLimit || 4}
                  disabled={!isAdmin}
                  onChange={e => {
                    if (!isAdmin) return;
                    const val = Number(e.target.value);
                    setTeamMembers(prev => prev.map(m => m.id === myMember.id ? { ...m, remoteLimit: val } : m));
                  }}
                  style={{ padding: '8px 12px', fontSize: 12, borderRadius: 8, opacity: !isAdmin ? 0.6 : 1, cursor: !isAdmin ? 'not-allowed' : 'text' }}
                />
              )}
            </div>
          </div>
          
          {showSalary && isAdmin && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, color: '#71717a', fontWeight: 500 }}>Lương Gross (VNĐ)</span>
                <input
                  type='number'
                  className='input-dark'
                  value={myMember.salaryGross || 0}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setTeamMembers(prev => prev.map(m => m.id === myMember.id ? { ...m, salaryGross: val } : m));
                  }}
                  style={{ padding: '8px 12px', fontSize: 12, borderRadius: 8 }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, color: '#71717a', fontWeight: 500 }}>Người phụ thuộc</span>
                <input
                  type='number'
                  className='input-dark'
                  value={myMember.dependentCount || 0}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setTeamMembers(prev => prev.map(m => m.id === myMember.id ? { ...m, dependentCount: val } : m));
                  }}
                  style={{ padding: '8px 12px', fontSize: 12, borderRadius: 8 }}
                />
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => handleSaveMyProfile(myMember)}
          className='btn-primary'
          style={{ padding: '10px', fontSize: 12, borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', color: 'white', fontWeight: 600, cursor: 'pointer', marginTop: 8 }}
        >
          Lưu hồ sơ {isEditingSelf ? 'cá nhân' : 'nhân sự'}
        </button>

        {/* Account lifecycle — merged from "Tài khoản nội bộ" */}
        {isAdmin && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              border: '1px solid rgba(167,139,250,0.25)',
              background: 'rgba(167,139,250,0.06)',
              borderRadius: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div>
              <strong style={{ fontSize: 12, color: '#c4b5fd', display: 'block' }}>
                🔐 Quản lý tài khoản
              </strong>
              <span style={{ fontSize: 10, color: '#71717a' }}>
                Trạng thái DB:{' '}
                <span style={{ color: statusColor, fontWeight: 600 }}>
                  {accountStatusLabel(st)}
                </span>
                {isTeamAdmin(myMember) ? ' · ADMIN' : ''}
                {myMember.isActive === false ? ' · ẩn sơ đồ' : ''}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {st !== 'active' && (
                <button
                  disabled={busy}
                  onClick={() => accountAction('approve')}
                  style={{
                    fontSize: 11,
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid rgba(52,211,153,0.4)',
                    color: '#34d399',
                    background: 'rgba(52,211,153,0.08)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {st === 'pending' ? 'Duyệt' : 'Kích hoạt lại'}
                </button>
              )}
              {st === 'pending' && (
                <button
                  disabled={busy}
                  onClick={() => accountAction('reject')}
                  style={{
                    fontSize: 11,
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid rgba(248,113,113,0.4)',
                    color: '#f87171',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Từ chối
                </button>
              )}
              {st === 'active' && !isEditingSelf && (
                <button
                  disabled={busy}
                  onClick={() => accountAction('suspend')}
                  style={{
                    fontSize: 11,
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid rgba(251,191,36,0.4)',
                    color: '#fbbf24',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Khoá tài khoản
                </button>
              )}
              {!isEditingSelf && (
                <button
                  disabled={busy}
                  onClick={() => accountAction('delete')}
                  style={{
                    fontSize: 11,
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid rgba(239,68,68,0.4)',
                    color: '#ef4444',
                    background: 'rgba(239,68,68,0.06)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Xoá / Khoá mềm
                </button>
              )}
            </div>
            <div style={{ fontSize: 9, color: '#52525b' }}>
              Duyệt/Khoá/Xoá gộp tại hồ sơ — không cần tab Tài khoản riêng.
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
