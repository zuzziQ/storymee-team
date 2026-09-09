import React, { useState, useMemo, useEffect } from 'react';
import { TeamMember } from '../../../constants';
import { isTeamAdmin } from '@/lib/teamAuth';
import { coreApiClient } from '../../../../lib/apiClient';
import HolidaySettingsModal from './HolidaySettingsModal';

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
  const [selectedMemberId, setSelectedMemberId] = useState<string>('all');
  const [subView, setSubView] = useState<'overview' | 'log'>('overview');
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [networkInfo, setNetworkInfo] = useState<{ clientIp?: string; isOfficeNetwork?: boolean } | null>(null);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [showHolidayModal, setShowHolidayModal] = useState(false);

  useEffect(() => {
    coreApiClient.get('/hr/attendance/network-status').then((res: any) => {
      if (res?.status === 'success' && res?.data) {
        setNetworkInfo(res.data);
      } else if (res?.clientIp) {
        setNetworkInfo(res);
      }
    }).catch((err) => {
      console.warn('Failed to get network status', err);
    });
  }, []);

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

  const fetchHolidays = () => {
    coreApiClient.get(`/hr/settings/holidays?year=${targetYear}`).then((res: any) => {
      setHolidays(res?.data || res || []);
    }).catch(err => {
      console.warn('Failed to get holidays', err);
    });
  };

  useEffect(() => {
    fetchHolidays();
  }, [targetYear]);

  // Danh sách các ngày lễ trong tháng được chọn
  const monthHolidays = useMemo(() => {
    return holidays.filter(h => {
      if (!h.date) return false;
      const parts = h.date.split('-');
      if (parts.length < 3) return false;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      return y === targetYear && m === targetMonthNum;
    });
  }, [holidays, targetYear, targetMonthNum]);

  // Số ngày công tính cho nghỉ lễ trong tháng (Thứ 2 - Thứ 6: 1.0 công, Thứ 7: 0.5 công, CN: 0)
  const holidayWorkUnits = useMemo(() => {
    return monthHolidays.reduce((acc, h) => {
      if (h.paid === false) return acc;
      const [y, m, d] = h.date.split('-').map(Number);
      const dayOfWeek = new Date(y, m - 1, d).getDay();
      if (dayOfWeek === 0) return acc;
      if (dayOfWeek === 6) return acc + 0.5;
      return acc + 1.0;
    }, 0);
  }, [monthHolidays]);

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

  // Filter records theo tháng và user (kèm chèn ngày nghỉ lễ nếu xem cá nhân/từng người)
  const filteredRecords = useMemo(() => {
    const list = attendanceList
      .filter(a => {
        const d = new Date(a.date);
        const sameMonth = d.getFullYear() === targetYear && d.getMonth() === targetMonthNum;
        if (!sameMonth) return false;
        if (!isAdmin || viewMode === 'mine') {
          return myMember ? a.memberId === myMember.id : false;
        }
        if (selectedMemberId !== 'all') {
          return a.memberId === selectedMemberId;
        }
        return true; 
      });

    // Nếu đang xem cá nhân hoặc 1 nhân sự cụ thể, interleave các ngày lễ
    const isSingleMemberView = viewMode === 'mine' || (isAdmin && selectedMemberId !== 'all');
    if (!isSingleMemberView || monthHolidays.length === 0) {
      return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    // Map existing records by YYYY-MM-DD
    const existingDates = new Set(list.map(r => r.date ? r.date.split('T')[0] : ''));
    
    // Add holiday rows for holidays that do not have attendance record
    const holidayRows: any[] = [];
    monthHolidays.forEach(h => {
      const hDate = h.date;
      if (!existingDates.has(hDate)) {
        const [y, m, d] = hDate.split('-').map(Number);
        const dayOfWeek = new Date(y, m - 1, d).getDay();
        if (dayOfWeek !== 0) { // Không tính chủ nhật
          holidayRows.push({
            id: `hol-${h.id || h.date}`,
            date: hDate,
            workType: 'holiday',
            checkIn: null,
            checkOut: null,
            totalHours: dayOfWeek === 6 ? 3.5 : 8.0,
            status: 'holiday',
            notes: `🎉 ${h.name} (Hưởng nguyên lương)`,
            isHolidayRow: true,
            holidayName: h.name
          });
        }
      }
    });

    return [...list, ...holidayRows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [attendanceList, targetYear, targetMonthNum, viewMode, isAdmin, myMember, selectedMemberId, monthHolidays]);

  // Tổng hợp tháng (theo myMember hoặc theo selectedMemberId)
  const summary = useMemo(() => {
    const records = attendanceList.filter(a => {
      const d = new Date(a.date);
      const sameMonth = d.getFullYear() === targetYear && d.getMonth() === targetMonthNum;
      if (!sameMonth) return false;
      
      if (viewMode === 'mine') return myMember && a.memberId === myMember.id;
      if (selectedMemberId !== 'all') return a.memberId === selectedMemberId;
      return true;
    });
    const actualDays = records.filter(r => r.status === 'present' || r.status === 'late').length;
    const leaveDays = records.filter(r => r.status === 'leave' || r.workType === 'leave').length;
    const absentDays = records.filter(r => r.status === 'absent').length;
    const isSingleMemberView = viewMode === 'mine' || selectedMemberId !== 'all';
    const holidayDays = isSingleMemberView ? holidayWorkUnits : 0;
    const totalDays = actualDays + holidayDays + leaveDays;
    const totalHours = records.reduce((s, r) => s + (r.totalHours || 0), 0);
    const remoteDays = records.filter(r => r.workType === 'remote').length;
    const lateDays = records.filter(r => r.status === 'late').length;
    return { actualDays, holidayDays, leaveDays, absentDays, totalDays, totalHours: Math.round(totalHours * 10) / 10, remoteDays, lateDays };
  }, [attendanceList, myMember, targetYear, targetMonthNum, viewMode, selectedMemberId, holidayWorkUnits]);

  // Dữ liệu bảng tổng hợp toàn team
  const overviewData = useMemo(() => {
    if (!isAdmin || viewMode !== 'all' || subView !== 'overview') return [];
    return teamMembers.map(member => {
      const mRecords = attendanceList.filter(a => {
        const d = new Date(a.date);
        return a.memberId === member.id && d.getFullYear() === targetYear && d.getMonth() === targetMonthNum;
      });
      const actualDays = mRecords.filter(r => r.status === 'present' || r.status === 'late').length;
      const leaveDays = mRecords.filter(r => r.status === 'leave' || r.workType === 'leave').length;
      const absentDays = mRecords.filter(r => r.status === 'absent').length;
      const holidayDays = holidayWorkUnits;
      const totalDays = actualDays + holidayDays + leaveDays;
      const totalHours = mRecords.reduce((s, r) => s + (r.totalHours || 0), 0);
      const remoteDays = mRecords.filter(r => r.workType === 'remote').length;
      const lateDays = mRecords.filter(r => r.status === 'late').length;
      const tRec = mRecords.find(a => a.date?.split('T')[0] === todayStr);
      
      return {
        member,
        actualDays,
        holidayDays,
        leaveDays,
        absentDays,
        totalDays,
        totalHours: Math.round(totalHours * 10) / 10,
        remoteDays,
        lateDays,
        todayRecord: tRec
      };
    });
  }, [teamMembers, attendanceList, targetYear, targetMonthNum, todayStr, isAdmin, viewMode, subView, holidayWorkUnits]);

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      present: { label: 'Đúng giờ', color: '#22c55e' },
      late: { label: 'Đi muộn', color: '#f59e0b' },
      leave: { label: '🏖️ Có phép', color: '#38bdf8' },
      absent: { label: '❌ Không phép', color: '#ef4444' },
      holiday: { label: '🏖️ Nghỉ lễ', color: '#c084fc' }
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

      {/* ===== PHẦN TÙY CHỌN & LỊCH NGHỈ LỄ ===== */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: -4, gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={() => setShowHolidayModal(true)}
          style={{
            padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(168,85,247,0.3)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: 'rgba(168,85,247,0.1)', color: '#c084fc', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          🏖️ Lịch nghỉ lễ ({holidays.length})
        </button>
        {isAdmin && (
          <>
            <button
              onClick={async () => {
                if (window.confirm("Thực hiện tự động chốt giờ ra cho các ca quên checkout và đối soát đơn xin nghỉ phép (tự động phân loại Có phép vs Không phép)?")) {
                  try {
                    await coreApiClient.post('/hr/attendance/auto-checkout');
                    alert("✅ Đã chốt ca và kiểm toán công ngày thành công!");
                    window.location.reload();
                  } catch (err: any) {
                    alert("❌ Lỗi: " + (err?.message || 'Không thể chốt ca'));
                  }
                }
              }}
              style={{
                padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(245,158,11,0.3)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: 'rgba(245,158,11,0.1)', color: '#fbbf24', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              ⚡ Chốt công ngày (Auto-Audit)
            </button>
            <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 3 }}>
              {(['mine', 'all'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => { 
                    setViewMode(v); 
                    if (v === 'mine') { 
                      setSubView('log'); 
                      setSelectedMemberId('all'); 
                    } 
                  }}
                  style={{
                    padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    background: viewMode === v ? '#6366f1' : 'transparent',
                    color: viewMode === v ? 'white' : '#71717a',
                    transition: 'all 0.2s'
                  }}
                >
                  {v === 'mine' ? '👤 Xem cá nhân' : '👥 Xem toàn team'}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ===== PHẦN SUBVIEW CHO ALL ===== */}
      {isAdmin && viewMode === 'all' && (
        <div className="glass" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 3 }}>
            <button 
              onClick={() => setSubView('overview')} 
              style={{ padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: subView === 'overview' ? 'rgba(99,102,241,0.2)' : 'transparent', color: subView === 'overview' ? '#818cf8' : '#71717a', transition: 'all 0.2s' }}
            >
              👥 Tổng hợp nhân sự
            </button>
            <button 
              onClick={() => setSubView('log')} 
              style={{ padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: subView === 'log' ? 'rgba(99,102,241,0.2)' : 'transparent', color: subView === 'log' ? '#818cf8' : '#71717a', transition: 'all 0.2s' }}
            >
              📋 Nhật ký chi tiết
            </button>
          </div>

          {subView === 'log' && (
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setShowMemberDropdown(!showMemberDropdown)}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
              >
                {selectedMemberId === 'all' ? '👥 Tất cả nhân sự' : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: teamMembers.find(m => m.id === selectedMemberId)?.color || '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 8 }}>
                      {(teamMembers.find(m => m.id === selectedMemberId)?.fullName || teamMembers.find(m => m.id === selectedMemberId)?.name || '?').charAt(0)}
                    </div>
                    <span>{teamMembers.find(m => m.id === selectedMemberId)?.fullName || teamMembers.find(m => m.id === selectedMemberId)?.name}</span>
                  </div>
                )}
                <span style={{ fontSize: 10, color: '#a1a1aa' }}>▼</span>
              </button>
              
              {showMemberDropdown && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setShowMemberDropdown(false)}></div>
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, zIndex: 10, maxHeight: 300, overflow: 'auto', width: 220, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }}>
                    <div 
                      onClick={() => { setSelectedMemberId('all'); setShowMemberDropdown(false); }} 
                      style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #27272a', fontSize: 12, color: selectedMemberId === 'all' ? '#818cf8' : '#e4e4e7', background: selectedMemberId === 'all' ? 'rgba(99,102,241,0.1)' : 'transparent', fontWeight: selectedMemberId === 'all' ? 600 : 400 }}
                    >
                      👥 Tất cả nhân sự
                    </div>
                    {teamMembers.map(m => {
                      const isActive = selectedMemberId === m.id;
                      return (
                        <div 
                          key={m.id} 
                          onClick={() => { setSelectedMemberId(m.id); setShowMemberDropdown(false); }}
                          style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, borderBottom: '1px solid #27272a', color: isActive ? '#818cf8' : '#e4e4e7', background: isActive ? 'rgba(99,102,241,0.1)' : 'transparent' }}
                        >
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: m.color || '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 10 }}>
                            {(m.fullName || m.name || '?').charAt(0)}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: isActive ? 600 : 400 }}>{m.fullName || m.name}</span>
                            <span style={{ fontSize: 10, color: '#71717a' }}>{m.role}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== PHẦN CHECKIN / CHECKOUT CÁ NHÂN ===== */}
      {viewMode === 'mine' && (
        <div className="glass" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fafafa' }}>⏱️ CHẤM CÔNG HÔM NAY</h4>
              <span style={{ fontSize: 11, color: '#71717a' }}>{new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
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

          {/* HIỂN THỊ BANNER/BADGE MẠNG */}
          {networkInfo && (
            <div style={{ marginBottom: 14 }}>
              {networkInfo.isOfficeNetwork ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', fontSize: 12, fontWeight: 600 }}>
                  <span>📶</span>
                  <span>Wi-Fi Văn phòng ({networkInfo.clientIp || 'Đã xác thực'})</span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24', fontSize: 12, fontWeight: 500 }}>
                  <span style={{ fontSize: 14 }}>⚠️</span>
                  <span>Bạn đang dùng 4G / Mạng ngoài ({networkInfo.clientIp}). Vui lòng kết nối Wi-Fi văn phòng để điểm danh Văn phòng, hoặc chọn 'Remote'.</span>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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
                      if (wt === 'office' && networkInfo && networkInfo.isOfficeNetwork === false) {
                        alert("⚠️ Bạn đang kết nối mạng di động / 4G. Vui lòng kết nối Wi-Fi văn phòng để chấm công Office, hoặc chọn hình thức Remote.");
                        return;
                      }
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

          {!hasCheckedIn && (
            <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', fontSize: 11, color: '#a1a1aa' }}>
              📲 <strong style={{ color: '#818cf8' }}>Remote qua Telegram:</strong> Gõ <code style={{ background: 'rgba(0,0,0,0.2)', padding: '1px 5px', borderRadius: 3, color: '#818cf8' }}>check-in remote</code> hoặc <code style={{ background: 'rgba(0,0,0,0.2)', padding: '1px 5px', borderRadius: 3, color: '#f59e0b' }}>check-out</code> trong bot StoryMee
            </div>
          )}
        </div>
      )}

      {/* ===== THỐNG KÊ THÁNG CÁ NHÂN HOẶC ĐƯỢC CHỌN ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {/* Card 1: Ngày công */}
        <div className="glass" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: '#71717a', fontWeight: 600, marginBottom: 4 }}>📅 NGÀY CÔNG</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#22c55e' }}>{summary.totalDays} ngày</span>
            <span style={{ fontSize: 10, color: '#a1a1aa' }}>
              ({summary.actualDays} làm + ${summary.holidayDays} lễ + ${summary.leaveDays} phép)
            </span>
          </div>
          <div style={{ fontSize: 10, color: '#52525b', marginTop: 2 }}>{monthLabel}</div>
        </div>

        {/* Card 2: Tổng giờ làm */}
        <div className="glass" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: '#71717a', fontWeight: 600, marginBottom: 4 }}>⏱️ TỔNG GIỜ LÀM</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#6366f1' }}>{summary.totalHours}h</span>
          </div>
          <div style={{ fontSize: 10, color: '#52525b', marginTop: 2 }}>{monthLabel}</div>
        </div>

        {/* Card 3: Nghỉ phép */}
        <div className="glass" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: '#71717a', fontWeight: 600, marginBottom: 4 }}>🏖️ NGHỈ PHÉP</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#38bdf8' }}>{summary.leaveDays} có phép</span>
            {summary.absentDays > 0 && (
              <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>
                · {summary.absentDays} không phép
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, color: '#52525b', marginTop: 2 }}>{monthLabel}</div>
        </div>

        {/* Card 4: Đi muộn */}
        <div className="glass" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: '#71717a', fontWeight: 600, marginBottom: 4 }}>⚠️ ĐI MUỘN</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: summary.lateDays > 0 ? '#f59e0b' : '#22c55e' }}>{summary.lateDays} lần</span>
          </div>
          <div style={{ fontSize: 10, color: '#52525b', marginTop: 2 }}>{monthLabel}</div>
        </div>
      </div>

      {/* ===== BẢNG TỔNG HỢP / NHẬT KÝ CHẤM CÔNG ===== */}
      {viewMode === 'all' && subView === 'overview' ? (
        <div className="glass" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#fafafa' }}>👥 BẢNG TỔNG HỢP NHÂN SỰ — {monthLabel.toUpperCase()}</h4>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setMonthOffset(v => v - 1)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: '#a1a1aa', cursor: 'pointer', fontSize: 12 }}>◀ Tháng trước</button>
              {monthOffset < 0 && <button onClick={() => setMonthOffset(v => v + 1)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: '#a1a1aa', cursor: 'pointer', fontSize: 12 }}>Tháng sau ▶</button>}
            </div>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, color: '#e4e4e7', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)' }}>
                  <th style={{ padding: '10px 12px', color: '#71717a', fontWeight: 600 }}>NHÂN SỰ</th>
                  <th style={{ padding: '10px 12px', color: '#71717a', fontWeight: 600 }}>HÔM NAY</th>
                  <th style={{ padding: '10px 12px', color: '#71717a', fontWeight: 600, textAlign: 'center' }}>NGÀY CÔNG</th>
                  <th style={{ padding: '10px 12px', color: '#71717a', fontWeight: 600, textAlign: 'center' }}>TỔNG GIỜ</th>
                  <th style={{ padding: '10px 12px', color: '#71717a', fontWeight: 600, textAlign: 'center' }}>NGHỈ PHÉP</th>
                  <th style={{ padding: '10px 12px', color: '#71717a', fontWeight: 600, textAlign: 'center' }}>REMOTE</th>
                  <th style={{ padding: '10px 12px', color: '#71717a', fontWeight: 600, textAlign: 'center' }}>ĐI MUỘN</th>
                  <th style={{ padding: '10px 12px', color: '#71717a', fontWeight: 600, textAlign: 'center' }}>HÀNH ĐỘNG</th>
                </tr>
              </thead>
              <tbody>
                {overviewData.map(row => {
                   let todayStatus = <span style={{ color: '#71717a' }}>Chưa điểm danh</span>;
                   if (row.todayRecord) {
                      if (row.todayRecord.checkIn && !row.todayRecord.checkOut) {
                         todayStatus = <span style={{ color: '#38bdf8' }}>⏳ Đang làm ({formatTime(row.todayRecord.checkIn)})</span>;
                      } else if (row.todayRecord.checkIn && row.todayRecord.checkOut) {
                         todayStatus = <span style={{ color: '#22c55e' }}>✅ Đã tan ca ({row.todayRecord.totalHours}h)</span>;
                      }
                   }
                   return (
                    <tr key={row.member.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: row.member.color || '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 11 }}>
                            {(row.member.fullName || row.member.name || '?').charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 12 }}>{row.member.fullName || row.member.name}</div>
                            <div style={{ fontSize: 10, color: '#71717a' }}>{row.member.role}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>{todayStatus}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>
                        <span style={{ fontSize: 12, color: '#fafafa' }}>{row.totalDays}</span>
                        <div style={{ fontSize: 9, color: '#a1a1aa', fontWeight: 400 }}>
                          (+{row.holidayDays} lễ, +{row.leaveDays} phép)
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#a78bfa' }}>{row.totalHours}h</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                          <span style={{
                            padding: '2px 7px',
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 600,
                            background: 'rgba(56,189,248,0.12)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56,189,248,0.25)'
                          }}>
                            ✓ {row.leaveDays} có phép
                          </span>
                          {row.absentDays > 0 && (
                            <span style={{
                              padding: '2px 7px',
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 600,
                              background: 'rgba(239,68,68,0.12)',
                              color: '#ef4444',
                              border: '1px solid rgba(239,68,68,0.25)'
                            }}>
                              ❌ {row.absentDays} không phép
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>{row.remoteDays}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>
                        {row.lateDays > 0 ? (
                          <span style={{ padding: '2px 6px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', borderRadius: 4 }}>{row.lateDays}</span>
                        ) : (
                          <span style={{ color: '#e4e4e7' }}>0</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <button 
                          onClick={() => { setSelectedMemberId(row.member.id); setSubView('log'); }}
                          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#e4e4e7', cursor: 'pointer', fontSize: 11, transition: 'all 0.2s' }}
                          onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                          onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        >
                          🔍 Xem
                        </button>
                      </td>
                    </tr>
                   );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#fafafa' }}>
                📋 NHẬT KÝ CHẤM CÔNG — {monthLabel.toUpperCase()}
              </h4>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => setMonthOffset(v => v - 1)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: '#a1a1aa', cursor: 'pointer', fontSize: 12 }}>◀ Tháng trước</button>
              {monthOffset < 0 && <button onClick={() => setMonthOffset(v => v + 1)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: '#a1a1aa', cursor: 'pointer', fontSize: 12 }}>Tháng sau ▶</button>}
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
                    const itemDateStr = item.date?.split('T')[0] || '';
                    const isToday = itemDateStr === todayStr;
                    const holidayMatch = monthHolidays.find(h => h.date === itemDateStr);
                    const isOvertimeHoliday = !item.isHolidayRow && !!holidayMatch;
                    const isLeave = item.status === 'leave' || item.workType === 'leave';
                    const isAbsent = item.status === 'absent';
                    const itemDate = new Date(item.date);
                    const isSaturday = itemDate.getDay() === 6;
                    const leaveHoursDisplay = isSaturday ? '3.5h (Công phép)' : '8.0h (Công phép)';

                    return (
                      <tr
                        key={item.id || idx}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.02)',
                          background: item.isHolidayRow
                            ? 'rgba(168,85,247,0.06)'
                            : isLeave
                            ? 'rgba(56,189,248,0.05)'
                            : isAbsent
                            ? 'rgba(239,68,68,0.05)'
                            : isToday
                            ? 'rgba(99,102,241,0.05)'
                            : 'transparent'
                        }}
                      >
                        {(isAdmin && viewMode === 'all') && (
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 16, height: 16, borderRadius: '50%', background: item.member?.color || '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 8 }}>
                                {(item.member?.fullName || item.member?.name || '?').charAt(0)}
                              </div>
                              {item.member?.fullName || item.member?.name || 'N/A'}
                            </div>
                          </td>
                        )}
                        <td style={{
                          padding: '10px 12px',
                          fontFamily: 'monospace',
                          color: item.isHolidayRow ? '#c084fc' : isLeave ? '#38bdf8' : isAbsent ? '#ef4444' : isToday ? '#818cf8' : '#e4e4e7'
                        }}>
                          {formatDate(item.date)}{isToday && <span style={{ marginLeft: 4, fontSize: 9, color: '#818cf8', fontWeight: 700 }}> HÔM NAY</span>}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {item.isHolidayRow ? (
                            <span style={{
                              padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                              background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)'
                            }}>
                              🎉 Nghỉ lễ
                            </span>
                          ) : isLeave ? (
                            <span style={{
                              padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                              background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)'
                            }}>
                              🏖️ Nghỉ có phép
                            </span>
                          ) : isAbsent ? (
                            <span style={{
                              padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                              background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)'
                            }}>
                              ❌ Vắng mặt
                            </span>
                          ) : (
                            <span style={{
                              padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                              background: item.workType === 'remote' ? 'rgba(56,189,248,0.1)' : 'rgba(99,102,241,0.1)',
                              color: item.workType === 'remote' ? '#38bdf8' : '#818cf8',
                              border: `1px solid ${item.workType === 'remote' ? '#38bdf820' : '#6366f120'}`
                            }}>
                              {item.workType === 'remote' ? '🏠 Remote' : '🏢 Office'}
                            </span>
                          )}
                          {item.workType === 'remote' && item.notes?.includes('Vượt hạn mức Remote') && (
                            <span style={{ display: 'inline-block', marginLeft: 6, padding: '2px 6px', background: 'rgba(168,85,247,0.15)', color: '#c084fc', borderRadius: 4, fontSize: 9, fontWeight: 700, border: '1px solid rgba(168,85,247,0.3)' }}>
                              ⚠️ Vượt quota
                            </span>
                          )}
                          {isOvertimeHoliday && (
                            <span style={{ display: 'inline-block', marginLeft: 6, padding: '2px 6px', background: 'rgba(236,72,153,0.15)', color: '#f472b6', borderRadius: 4, fontSize: 9, fontWeight: 700, border: '1px solid rgba(236,72,153,0.3)' }}>
                              🎉 Làm lễ ({holidayMatch.name})
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', color: (item.isHolidayRow || isLeave || isAbsent) ? '#71717a' : '#22c55e', fontWeight: 500 }}>
                          {(item.isHolidayRow || isLeave || isAbsent) ? '—' : formatTime(item.checkIn)}
                        </td>
                        <td style={{ padding: '10px 12px', color: (item.isHolidayRow || isLeave || isAbsent) ? '#71717a' : (item.checkOut ? '#f59e0b' : '#52525b'), fontWeight: 500 }}>
                          {(item.isHolidayRow || isLeave || isAbsent) ? '—' : (item.checkOut ? formatTime(item.checkOut) : '—')}
                          {(!item.isHolidayRow && !isLeave && !isAbsent) && (item.notes?.includes('Quên chấm công') || item.notes?.includes('tự động chốt ca')) && (
                            <span style={{ display: 'inline-block', marginLeft: 6, padding: '2px 6px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', borderRadius: 4, fontSize: 9, fontWeight: 700, border: '1px solid rgba(245,158,11,0.3)' }}>
                              ⚠️ Quên check-out
                            </span>
                          )}
                        </td>
                        <td style={{
                          padding: '10px 12px',
                          textAlign: 'right',
                          fontWeight: 700,
                          color: item.isHolidayRow ? '#c084fc' : isLeave ? '#38bdf8' : isAbsent ? '#ef4444' : (item.totalHours ? '#a78bfa' : '#52525b')
                        }}>
                          {item.isHolidayRow
                            ? `${item.totalHours}h`
                            : isLeave
                            ? leaveHoursDisplay
                            : isAbsent
                            ? '0.0h'
                            : (item.totalHours ? `${item.totalHours}h` : (item.checkIn && !item.checkOut ? '⏳ Đang làm' : '—'))}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          {statusBadge(isLeave ? 'leave' : isAbsent ? 'absent' : item.status)}
                        </td>
                        <td style={{
                          padding: '10px 12px',
                          color: item.isHolidayRow ? '#c084fc' : isLeave ? '#38bdf8' : isAbsent ? '#ef4444' : '#71717a',
                          fontStyle: (item.isHolidayRow || isLeave || isAbsent) ? 'normal' : 'italic',
                          maxWidth: 180,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {isAbsent
                            ? (item.notes || '⚠️ Không điểm danh & không có đơn xin nghỉ phép')
                            : isLeave
                            ? (item.notes || '🏖️ Nghỉ phép có đơn phê duyệt')
                            : (item.notes || '—')}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== MODAL QUẢN LÝ LỊCH NGHỈ LỄ ===== */}
      <HolidaySettingsModal
        isOpen={showHolidayModal}
        onClose={() => setShowHolidayModal(false)}
        onUpdated={() => {
          fetchHolidays();
        }}
        isAdmin={isAdmin}
      />
    </div>
  );
}
