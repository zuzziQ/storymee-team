import React from 'react';
import { TeamMember, getInitials } from '../../../constants';

interface ProfileFormProps {
  myMember: TeamMember;
  isEditingSelf: boolean;
  setTeamMembers: React.Dispatch<React.SetStateAction<TeamMember[]>>;
  handleSaveMyProfile: (member: TeamMember) => void;
  isAdmin?: boolean;
}

export default function ProfileForm({
  myMember,
  isEditingSelf,
  setTeamMembers,
  handleSaveMyProfile,
  isAdmin
}: ProfileFormProps) {
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

        {/* Bank Name */}
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

        {/* Bank Account */}
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
          
          {isAdmin && (
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

          {isAdmin && (
            <div style={{ marginTop: 12, padding: 12, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <strong style={{ fontSize: 12, color: '#ef4444', display: 'block' }}>Vô hiệu hóa nhân sự</strong>
                <span style={{ fontSize: 10, color: '#71717a' }}>Nhân sự này sẽ bị ẩn khỏi sơ đồ tổ chức.</span>
              </div>
              <button
                className="btn-ghost"
                onClick={() => {
                  const newStatus = myMember.isActive === false ? true : false;
                  const updated = { ...myMember, isActive: newStatus };
                  setTeamMembers(prev => prev.map(m => m.id === myMember.id ? updated : m));
                  handleSaveMyProfile(updated);
                }}
                style={{ padding: '6px 12px', fontSize: 11, borderRadius: 6, border: '1px solid #ef4444', color: '#ef4444', background: myMember.isActive === false ? '#ef444420' : 'transparent', fontWeight: 600, cursor: 'pointer' }}
              >
                {myMember.isActive === false ? 'Đã vô hiệu hóa (Nhấn để Khôi phục)' : 'Vô hiệu hóa (Nghỉ việc)'}
              </button>
            </div>
          )}

      </div>
    </div>
  );
}
