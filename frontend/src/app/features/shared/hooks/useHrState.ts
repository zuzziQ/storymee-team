import { useState } from 'react';
import { TeamMember } from '../../../constants';
import { coreApiClient } from '../../../../lib/apiClient';
import { API_ROUTES } from '@/lib/apiClient';

export function useHrState() {
  const [dbError, setDbError] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [leavesPending, setLeavesPending] = useState<any[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('m2');
  const [hrSubTab, setHrSubTab] = useState<'profile' | 'attendance' | 'leaves' | 'payroll' | 'importer'>('profile');
  const [hrProfileView, setHrProfileView] = useState<'chart' | 'list'>('chart');
  const [hrSearchQuery, setHrSearchQuery] = useState('');
  const [hrDeptFilter, setHrDeptFilter] = useState('all');

  const fetchHrData = async (
    setActiveUser: (u: TeamMember) => void,
    activeUserEmail?: string
  ) => {
    try {
      setDbError(null);
      const membersData = await coreApiClient.get(API_ROUTES.HR.TEAM_MEMBERS);
      if ((membersData.status === 'success' || membersData.success === true) && Array.isArray(membersData.data)) {
        const mappedMembers = membersData.data.map((m: any) => ({ ...m, name: m.fullName }));
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
      const attendanceData = await coreApiClient.get(API_ROUTES.HR.ATTENDANCE);
      if ((attendanceData.status === 'success' || attendanceData.success === true) && Array.isArray(attendanceData.data)) {
        setAttendanceList(attendanceData.data);
      }
    } catch (err) {
      console.error('Lỗi fetch attendance:', err);
    }

    try {
      const leavesData = await coreApiClient.get(API_ROUTES.HR.LEAVE_REQUESTS);
      if ((leavesData.status === 'success' || leavesData.success === true) && Array.isArray(leavesData.data)) {
        const mappedLeaves = leavesData.data.map((l: any) => ({
          id: l.id,
          name: l.member?.fullName || 'Không rõ',
          type: l.leaveType === 'remote' ? 'Remote' : l.leaveType === 'annual' ? 'Leave' : l.leaveType,
          date: l.startDate ? new Date(l.startDate).toLocaleDateString('vi-VN') : '',
          dateEnd: l.endDate ? new Date(l.endDate).toLocaleDateString('vi-VN') : '',
          reason: l.reason || '',
          handover: '',
          days: l.endDate && l.startDate
            ? Math.max(1, Math.round((new Date(l.endDate).getTime() - new Date(l.startDate).getTime()) / (1000 * 3600 * 24)))
            : 1,
          status: l.status === 'approved' ? 'Approved' : l.status === 'rejected' ? 'Rejected' : 'Pending',
          memberId: l.memberId
        }));
        setLeavesPending(mappedLeaves);
      }
    } catch (err) {
      console.error('Lỗi fetch leave requests:', err);
    }
  };

  const handleCheckinOffice = async (memberId: string, notes?: string, workType?: string) => {
    try {
      const res: any = await coreApiClient.post(API_ROUTES.HR.ATTENDANCE_CHECKIN, {
        memberId,
        notes: notes || 'Check-in từ Web Portal',
        workType: workType || 'office'
      });
      if (res?.status === 'already_checked_in') {
        alert('⚠️ Bạn đã check-in rồi!');
        return;
      }
      alert('✅ Check-in thành công!');
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
      alert('🎉 Đã phê duyệt đơn nghỉ phép/remote thành công trên Database!');
      onSuccess?.();
    } catch (err) {
      console.error('Lỗi duyệt phép:', err);
      alert('Không thể kết nối đến máy chủ để duyệt phép.');
    }
  };

  const handleRejectLeave = async (id: string, onSuccess?: () => void) => {
    try {
      await coreApiClient.post(`${API_ROUTES.HR.LEAVE_REQUESTS}/${id}/approve`, { status: 'rejected' });
      alert('❌ Đã từ chối đơn nghỉ phép/remote thành công!');
      onSuccess?.();
    } catch (err) {
      console.error('Lỗi từ chối phép:', err);
      alert('Không thể kết nối đến máy chủ để từ chối phép.');
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
