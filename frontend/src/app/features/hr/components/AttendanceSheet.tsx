import React, { useState, useMemo, useEffect } from 'react';
import { TeamMember } from '../../../constants';
import { isTeamAdmin } from '@/lib/teamAuth';

interface AttendanceSheetProps {
  teamMembers: TeamMember[];
  attendanceList: any[];
  handleCheckinOffice: (memberId: string, notes?: string, workType?: string) => Promise<void>;
  handleCheckoutOffice: (memberId: string, notes?: string) => Promise<void>;
  activeUser: TeamMember;
}

export default function AttendanceSheet({
  teamMembers,
  attendanceList,
  handleCheckinOffice,
  handleCheckoutOffice,
  activeUser
}: AttendanceSheetProps) {
  const [notesInput, setNotesInput] = useState('');
  const [workType, setWorkType] = useState<'office' | 'remote'>('office');
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'mine' | 'all'>('mine');
  const [monthOffset, setMonthOffset] = useState(0); // 0 = hiện tại, -1 = tháng trước

  const isAdmin = isTeamAdmin(activeUser);

  const myMember = teamMembers.find(m => (m?.email || '').toLowerCase() === (activeUser?.email || '').toLowerCase());
  const isFullRemote = (myMember?.workArrangement || 'office') === 'remote';

  // Full remote: luôn remote; office: default office
  useEffect(() => {
    if (isFullRemote) setWorkType('remote');
    else setWorkType('office');
  }, [isFullRemote, myMember?.id]);

  const now = new Date();
  const targetMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const targetYear = targetMonth.getFullYear();
  const targetMonthNum = targetMonth.getMonth();

  // Ngày hôm nay (local)
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const todayRecord = myMember
    ? attendanceList.find(a => {
        const aDate = a.date ? a.date.split('T')[0] : '';
        return a.memberId === myMember.id && aDate === todayStr;
      })
    : null;

  const hasCheckedIn = !!todayRecord?.checkIn;
  const hasCheckedOut = !!todayRecord?.checkOut;

  const handleCheckin = async () => {
    if (!myMember) return;
    setLoading(true);
    try {
      await handleCheckinOffice(myMember.id, notesInput || undefined, workType);
      setNotesInput('');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!myMember) return;
    setLoading(true);
    try {
      await handleCheckoutOffice(myMember.id, notesInput || undefined);
      setNotesInput('');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '--:--';
    return new Date(timeStr).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const monthLabel = targetMonth.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

  // Filter records theo tháng và user
  const filteredRecords = useMemo(() => {
    return attendanceList
      .filter(a => {
        const d = new Date(a.date);
        const sameMonth = d.getFullYear() === targetYear && d.getMonth() === targetMonthNum;
        if (!sameMonth) return false;
        if (!isAdmin || viewMode === 'mine') {
          return myMember ? a.memberId === myMember.id : false;
        }
        return true; // admin + viewMode=all
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [attendanceList, targetYear, targetMonthNum, viewMode, isAdmin, myMember]);

  // Tổng hợp tháng
  const summary = useMemo(() => {
    const myRecords = attendanceList.filter(a => {
      const d = new Date(a.date);
      return myMember &&
        a.memberId === myMember.id &&
        d.getFullYear() === targetYear &&
        d.getMonth() === targetMonthNum;
    });
    const totalDays = myRecords.filter(r => r.status !== 'absent').length;
    const totalHours = myRecords.reduce((s, r) => s + (r.totalHours || 0), 0);
    const remoteDays = myRecords.filter(r => r.workType === 'remote').length;
    const lateDays = myRecords.filter(r => r.status === 'late').length;
    return { totalDays, totalHours: Math.round(totalHours * 10) / 10, remoteDays, lateDays };
  }, [attendanceList, myMember, targetYear, targetMonthNum]);

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      present: { label: 'Đúng giờ', color: '#22c55e' },
      late: { label: 'Đi muộn', color: '#f59e0b' },
      absent: { label: 'Vắng', color: '#ef4444' }
    };
    const s = map[status] || { label: status, color: '#71717a' };
    return (
      <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: s.color + '15', color: s.color, border: `1px solid ${s.color}30` }}>
        {s.label}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ===== PHẦN CHECKIN / CHECKOUT CÁ NHÂN ===== */}
      <div className="glass" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fafafa' }}>⏱️ CHẤM CÔNG HÔM NAY</h4>
            <span style={{ fontSize: 11, color: '#71717a' }}>{new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
          {/* Trạng thái hôm nay */}
          {hasCheckedIn && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#71717a' }}>Giờ vào: <span style={{ color: '#22c55e', fontWeight: 600 }}>{formatTime(todayRecord.checkIn)}</span></div>
              {hasCheckedOut && <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>Giờ ra: <span style={{ color: '#f59e0b', fontWeight: 600 }}>{formatTime(todayRecord.checkOut)}</span></div>}
              {hasCheckedOut && todayRecord.totalHours && (
                <div style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700, marginTop: 2 }}>✅ {todayRecord.totalHours}h làm việc</div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* Chọn loại công — full remote bị khoá Remote theo HR workArrangement */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 11, color: '#a1a1aa', fontWeight: 600 }}>
              Loại công
              {isFullRemote && (
                <span style={{ marginLeft: 8, color: '#22c55e', fontWeight: 700 }}>· Full remote (HR)</span>
              )}
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['office', 'remote'] as const).map(wt => {
                const lockedOut = isFullRemote && wt === 'office';
                return (
                <button
                  key={wt}
                  onClick={() => {
                    if (lockedOut || hasCheckedIn) return;
                    setWorkType(wt);
                  }}
                  disabled={hasCheckedIn || lockedOut}
                  title={lockedOut ? 'Nhân sự full remote — không chấm Văn phòng' : undefined}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8,
                    cursor: (hasCheckedIn || lockedOut) ? 'not-allowed' : 'pointer',
                    opacity: lockedOut ? 0.4 : 1,
                    background: workType === wt ? (wt === 'office' ? 'rgba(99,102,241,0.2)' : 'rgba(34,197,94,0.15)') : 'rgba(255,255,255,0.04)',
                    color: workType === wt ? (wt === 'office' ? '#818cf8' : '#22c55e') : '#71717a',
                    border: workType === wt ? `1px solid ${wt === 'office' ? '#6366f130' : '#22c55e30'}` : '1px solid rgba(255,255,255,0.06)',
                    fontWeight: workType === wt ? 700 : 400, fontSize: 12, transition: 'all 0.2s'
                  }}
                >
                  {wt === 'office' ? '🏢 Văn phòng' : '🏠 Remote'}
                </button>
              );})}
            </div>
            {isFullRemote && (
              <div style={{ fontSize: 10, color: '#86efac' }}>
                Cấu hình HR: Làm từ xa — hệ thống luôn ghi nhận loại công Remote.
              </div>
            )}
            <input
              type="text"
              placeholder="Ghi chú (tuỳ chọn)..."
              value={notesInput}
              onChange={e => setNotesInput(e.target.value)}
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '7px 12px', color: 'white', fontSize: 11, outline: 'none' }}
            />
          </div>

          {/* Nút Check-in / Check-out */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={handleCheckin}
              disabled={loading || hasCheckedIn}
              style={{
                padding: '12px 0', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 13,
                cursor: hasCheckedIn ? 'not-allowed' : 'pointer',
                background: hasCheckedIn ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, #22c55e, #15803d)',
                color: hasCheckedIn ? '#52525b' : 'white',
                transition: 'all 0.2s'
              }}
            >
              {hasCheckedIn ? '✅ Đã Check-in' : loading ? '⏳ Đang gửi...' : '✅ Check-in'}
            </button>
            <button
              onClick={handleCheckout}
              disabled={loading || !hasCheckedIn || hasCheckedOut}
              style={{
                padding: '12px 0', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 13,
                cursor: (!hasCheckedIn || hasCheckedOut) ? 'not-allowed' : 'pointer',
                background: hasCheckedOut ? 'rgba(255,255,255,0.04)' : !hasCheckedIn ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: (!hasCheckedIn || hasCheckedOut) ? '#52525b' : 'white',
                transition: 'all 0.2s'
              }}
            >
              {hasCheckedOut ? '🏁 Đã Check-out' : !hasCheckedIn ? '🔒 Check-in trước' : loading ? '⏳ Đang gửi...' : '🏁 Check-out'}
            </button>
          </div>
        </div>

        {/* Hướng dẫn remote */}
        {!hasCheckedIn && (
          <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', fontSize: 11, color: '#a1a1aa' }}>
            📲 <strong style={{ color: '#818cf8' }}>Remote qua Telegram:</strong> Gõ <code style={{ background: 'rgba(0,0,0,0.2)', padding: '1px 5px', borderRadius: 3, color: '#818cf8' }}>check-in remote</code> hoặc <code style={{ background: 'rgba(0,0,0,0.2)', padding: '1px 5px', borderRadius: 3, color: '#f59e0b' }}>check-out</code> trong bot StoryMee
          </div>
        )}
      </div>

      {/* ===== THỐNG KÊ THÁNG CÁ NHÂN ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          { label: 'Ngày công', value: `${summary.totalDays} ngày`, color: '#22c55e', icon: '📅' },
          { label: 'Tổng giờ làm', value: `${summary.totalHours}h`, color: '#6366f1', icon: '⏱️' },
          { label: 'Ngày remote', value: `${summary.remoteDays} ngày`, color: '#38bdf8', icon: '🏠' },
          { label: 'Đi muộn', value: `${summary.lateDays} lần`, color: summary.lateDays > 0 ? '#f59e0b' : '#22c55e', icon: '⚠️' }
        ].map(s => (
          <div key={s.label} className="glass" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: '#71717a', fontWeight: 600, marginBottom: 4 }}>{s.icon} {s.label.toUpperCase()}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: '#52525b', marginTop: 2 }}>{monthLabel}</div>
          </div>
        ))}
      </div>

      {/* ===== BẢNG NHẬT KÝ CHẤM CÔNG ===== */}
      <div className="glass" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#fafafa' }}>📋 NHẬT KÝ CHẤM CÔNG — {monthLabel.toUpperCase()}</h4>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Chọn tháng */}
            <button onClick={() => setMonthOffset(v => v - 1)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: '#a1a1aa', cursor: 'pointer', fontSize: 12 }}>◀ Tháng trước</button>
            {monthOffset < 0 && <button onClick={() => setMonthOffset(v => v + 1)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: '#a1a1aa', cursor: 'pointer', fontSize: 12 }}>Tháng sau ▶</button>}
            {/* Admin toggle xem tất cả */}
            {isAdmin && (
              <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 3 }}>
                {(['mine', 'all'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setViewMode(v)}
                    style={{
                      padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                      background: viewMode === v ? '#6366f1' : 'transparent',
                      color: viewMode === v ? 'white' : '#71717a'
                    }}
                  >
                    {v === 'mine' ? '👤 Của tôi' : '👥 Toàn team'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, color: '#e4e4e7', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)' }}>
                {(isAdmin && viewMode === 'all') && <th style={{ padding: '10px 12px', color: '#71717a', fontWeight: 600 }}>NHÂN SỰ</th>}
                <th style={{ padding: '10px 12px', color: '#71717a', fontWeight: 600 }}>NGÀY</th>
                <th style={{ padding: '10px 12px', color: '#71717a', fontWeight: 600 }}>LOẠI CÔNG</th>
                <th style={{ padding: '10px 12px', color: '#71717a', fontWeight: 600 }}>GIỜ VÀO</th>
                <th style={{ padding: '10px 12px', color: '#71717a', fontWeight: 600 }}>GIỜ RA</th>
                <th style={{ padding: '10px 12px', color: '#71717a', fontWeight: 600, textAlign: 'right' }}>GIỜ LÀM</th>
                <th style={{ padding: '10px 12px', color: '#71717a', fontWeight: 600, textAlign: 'center' }}>TRẠNG THÁI</th>
                <th style={{ padding: '10px 12px', color: '#71717a', fontWeight: 600 }}>GHI CHÚ</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '30px 12px', textAlign: 'center', color: '#52525b' }}>
                    Chưa có dữ liệu chấm công cho {monthLabel}.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((item, idx) => {
                  const isToday = item.date?.split('T')[0] === todayStr;
                  return (
                    <tr
                      key={item.id || idx}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.02)',
                        background: isToday ? 'rgba(99,102,241,0.05)' : 'transparent'
                      }}
                    >
                      {(isAdmin && viewMode === 'all') && (
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{item.member?.fullName || 'N/A'}</td>
                      )}
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: isToday ? '#818cf8' : '#e4e4e7' }}>
                        {formatDate(item.date)}{isToday && <span style={{ marginLeft: 4, fontSize: 9, color: '#818cf8', fontWeight: 700 }}> HÔM NAY</span>}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                          background: item.workType === 'remote' ? 'rgba(56,189,248,0.1)' : 'rgba(99,102,241,0.1)',
                          color: item.workType === 'remote' ? '#38bdf8' : '#818cf8',
                          border: `1px solid ${item.workType === 'remote' ? '#38bdf820' : '#6366f120'}`
                        }}>
                          {item.workType === 'remote' ? '🏠 Remote' : '🏢 Office'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#22c55e', fontWeight: 500 }}>{formatTime(item.checkIn)}</td>
                      <td style={{ padding: '10px 12px', color: item.checkOut ? '#f59e0b' : '#52525b', fontWeight: 500 }}>
                        {item.checkOut ? formatTime(item.checkOut) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: item.totalHours ? '#a78bfa' : '#52525b' }}>
                        {item.totalHours ? `${item.totalHours}h` : (item.checkIn && !item.checkOut ? '⏳ Đang làm' : '—')}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {statusBadge(item.status)}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#71717a', fontStyle: 'italic', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.notes || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
