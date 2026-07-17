import { useState } from 'react';
import toast from 'react-hot-toast';
import { TeamMember } from '../../../constants';
import { coreApiClient } from '../../../../lib/apiClient';
import { API_ROUTES } from '@/lib/apiClient';
import { mapLeaveFromApi } from '@/lib/leaveApi';

export function useHrState() {
  const [dbError, setDbError] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [leavesPending, setLeavesPending] = useState<any[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('m2');
  const [hrSubTab, setHrSubTab] = useState<'profile' | 'attendance' | 'leaves' | 'payroll' | 'importer' | 'accounts' | 'settings'>('profile');
  const [hrProfileView, setHrProfileView] = useState<'chart' | 'list'>('chart');
  const [hrSearchQuery, setHrSearchQuery] = useState('');
  const [hrDeptFilter, setHrDeptFilter] = useState('all');

  const fetchHrData = async (
    setActiveUser: (u: TeamMember) => void,
    activeUserEmail?: string
  ) => {
    let viewerQ = '';
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('st_user');
        if (stored) {
          const u = JSON.parse(stored);
          if (u?.email) viewerQ = `&viewerEmail=${encodeURIComponent(u.email)}`;
          else if (u?.id) viewerQ = `&viewerId=${encodeURIComponent(u.id)}`;
        }
      } catch {}
    }
    if (!viewerQ && activeUserEmail) {
      viewerQ = `&viewerEmail=${encodeURIComponent(activeUserEmail)}`;
    }

    try {
      setDbError(null);
      const membersData = await coreApiClient.get(
        `${API_ROUTES.HR.TEAM_MEMBERS}?status=all${viewerQ}`
      );
      if ((membersData.status === 'success' || membersData.success === true) && Array.isArray(membersData.data)) {
        const mappedMembers = membersData.data.map((m: any) => ({
          ...m,
          name: m.fullName || m.name,
          accountStatus: m.accountStatus || (m.isActive === false ? 'suspended' : 'active'),
          isTeamAdmin: m.isTeamAdmin === true,
        }));
        setTeamMembers(mappedMembers);

        let targetEmail = activeUserEmail;
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem('st_user');
          if (stored) {
            try { targetEmail = JSON.parse(stored).email; } catch {}
          }
        }
        const updatedActive = mappedMembers.find(
          (m: any) => (m?.email || '').toLowerCase() === (targetEmail || '').toLowerCase()
        );
        if (updatedActive) {
          setActiveUser(updatedActive);
          setSelectedMemberId(prev => {
            if (prev && mappedMembers.some((m: any) => m.id === prev)) return prev;
            return updatedActive.id;
          });
        }
      } else {
        setDbError('Không thể tải danh sách nhân sự từ Core API.');
      }
    } catch (err) {
      console.error('Lỗi fetch HR members:', err);
    }

    try {
      const attendanceData = await coreApiClient.get(
        `${API_ROUTES.HR.ATTENDANCE}${viewerQ ? `?${viewerQ.slice(1)}` : ''}`
      );
      if ((attendanceData.status === 'success' || attendanceData.success === true) && Array.isArray(attendanceData.data)) {
        setAttendanceList(attendanceData.data);
      }
    } catch (err) {
      console.error('Lỗi fetch attendance:', err);
    }

    try {
      const leavesData = await coreApiClient.get(API_ROUTES.HR.LEAVE_REQUESTS);
      if ((leavesData.status === 'success' || leavesData.success === true) && Array.isArray(leavesData.data)) {
        setLeavesPending(leavesData.data.map(mapLeaveFromApi));
      }
    } catch (err) {
      console.error('Lỗi fetch leave requests:', err);
    }
  };

  const handleCheckinOffice = async (memberId: string, notes?: string, workType?: string) => {
    try {
      // Prefer explicit workType; if missing, derive from member workArrangement.
      // API still enforces: full remote + approved remote leave → remote.
      const member = teamMembers.find((m) => m.id === memberId);
      const resolved =
        workType ||
        (member?.workArrangement === 'remote' ? 'remote' : 'office');
      const res: any = await coreApiClient.post(API_ROUTES.HR.ATTENDANCE_CHECKIN, {
        memberId,
        notes: notes || (resolved === 'remote' ? 'Check-in Remote từ Web Portal' : 'Check-in từ Web Portal'),
        workType: resolved,
      });
      if (res?.status === 'already_checked_in') {
        alert('⚠️ Bạn đã check-in rồi!');
        return;
      }
      const wt = res?.resolvedWorkType || res?.data?.workType || resolved;
      const why = res?.resolveReason;
      alert(
        `✅ Check-in thành công (${wt === 'remote' ? '🏠 Remote' : '🏢 Office'})` +
          (why === 'approved_remote_leave' ? '\n(Đơn remote đã duyệt hôm nay)' : '') +
          (why === 'full_remote_hr' ? '\n(Full remote theo HR)' : '')
      );
    } catch (err: any) {
      console.error('Lỗi check-in từ web portal:', err);
      if (err?.data?.status === 'already_checked_in') {
        alert('⚠️ Bạn đã check-in rồi!');
      } else {
        alert('❌ Lỗi check-in: ' + (err?.data?.message || err?.message || 'Không xác định'));
      }
    }
  };

  const handleCheckoutOffice = async (memberId: string, notes?: string) => {
    try {
      await coreApiClient.post(API_ROUTES.HR.ATTENDANCE_CHECKOUT, {
        memberId,
        notes: notes || 'Check-out từ Web Portal'
      });
      alert('✅ Check-out thành công!');
    } catch (err: any) {
      console.error('Lỗi check-out:', err);
      alert('❌ Lỗi check-out: ' + (err?.data?.message || err?.message || 'Chưa check-in hoặc đã check-out rồi'));
    }
  };

  const handleApproveLeave = async (id: string, onSuccess?: () => void) => {
    try {
      await coreApiClient.post(`${API_ROUTES.HR.LEAVE_REQUESTS}/${id}/approve`, { status: 'approved' });
      toast.success('Đã duyệt đơn nghỉ/remote');
      setLeavesPending((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status: 'Approved' } : l))
      );
      onSuccess?.();
    } catch (err: any) {
      console.error('Lỗi duyệt phép:', err);
      toast.error(err?.data?.message || 'Không duyệt được đơn');
    }
  };

  const handleRejectLeave = async (id: string, onSuccess?: () => void) => {
    try {
      await coreApiClient.post(`${API_ROUTES.HR.LEAVE_REQUESTS}/${id}/approve`, { status: 'rejected' });
      toast.success('Đã từ chối đơn');
      setLeavesPending((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status: 'Rejected' } : l))
      );
      onSuccess?.();
    } catch (err: any) {
      console.error('Lỗi từ chối phép:', err);
      toast.error(err?.data?.message || 'Không từ chối được đơn');
    }
  };

  return {
    dbError,
    setDbError,
    teamMembers,
    setTeamMembers,
    attendanceList,
    setAttendanceList,
    leavesPending,
    setLeavesPending,
    selectedMemberId,
    setSelectedMemberId,
    hrSubTab,
    setHrSubTab,
    hrProfileView,
    setHrProfileView,
    hrSearchQuery,
    setHrSearchQuery,
    hrDeptFilter,
    setHrDeptFilter,
    fetchHrData,
    handleCheckinOffice,
    handleCheckoutOffice,
    handleApproveLeave,
    handleRejectLeave,
  };
}
