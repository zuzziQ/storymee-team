import { useState, useEffect } from 'react';
import { Announcement, TeamMember, Meeting } from '../../../constants';
import { io } from 'socket.io-client';
import { fetchAxios } from '@/lib/fetchAxios';
import { coreApiClient } from '@/lib/apiClient';

export function useSocketState(
  authReady: boolean,
  activeUser: TeamMember | null,
  fetchDbData: () => Promise<void>
) {
  const [appNotifications, setAppNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);


  const fetchServerMeetings = async () => {
    try {
      const res = await coreApiClient.get('/hr/meetings');
      if (res?.status === 'success') {
        setMeetings(res.data);
      }
    } catch (err) {
      console.error('Lỗi fetch meetings:', err);
    }
  };

  const fetchServerAnnouncements = async () => {
    try {
      const res = await coreApiClient.get('/hr/announcements');
      if (res.data?.status === 'success') {
        setAnnouncements(res.data.data);
      }
    } catch (err) {
      console.error('Lỗi fetch announcements:', err);
    }
  };

  // Poll meetings mỗi 30 giây và push notification khi sắp tới
  useEffect(() => {
    if (!authReady || !activeUser) return;
    const notifiedIds = new Set<string>();

    const checkUpcomingMeetings = async () => {
      try {
        const res = await coreApiClient.get('/hr/meetings');
        if (res?.status !== 'success') return;
        const allMeetings: Meeting[] = res.data;
        setMeetings(allMeetings);

        const nowMs = Date.now();
        allMeetings.forEach((m: any) => {
          const startMs = new Date(m.startTime || m.start_time || m.createdAt).getTime();
          const diffMin = Math.floor((startMs - nowMs) / 60000);
          // Nhắc khi còn 14–16 phút, chỉ nhắc 1 lần
          if (diffMin >= 14 && diffMin <= 16 && !notifiedIds.has(m.id)) {
            notifiedIds.add(m.id);
            const timeStr = new Date(startMs).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            setAppNotifications(prev => {
              const updated = [{
                id: Date.now(),
                title: '📅 Lịch họp sắp bắt đầu',
                message: `"${m.title || 'Cuộc họp'}" bắt đầu lúc ${timeStr} — còn 15 phút`,
                type: 'meeting',
                timestamp: new Date(),
                read: false,
              }, ...prev];
              localStorage.setItem('storymee_app_notifications', JSON.stringify(updated));
              return updated;
            });
            setShowNotifications(true);
          }
        });
      } catch {}
    };

    checkUpcomingMeetings();
    const interval = setInterval(checkUpcomingMeetings, 60_000); // mỗi 60 giây
    return () => clearInterval(interval);
  }, [authReady, activeUser]);

  useEffect(() => {
    if (!authReady || !activeUser) return;

    // Restore notifications from localStorage
    if (typeof window !== 'undefined') {
      const savedNotifs = localStorage.getItem('storymee_app_notifications');
      if (savedNotifs) {
        try { setAppNotifications(JSON.parse(savedNotifs)); } catch {}
      }
    }

    fetchServerAnnouncements();
    fetchServerMeetings();

    const socket = io('/internal/v1/team/socket.io', {
      path: '/internal/v1/team/socket.io',
      transports: ['websocket', 'polling']
    });

    const addNotif = (notif: any) => {
      setAppNotifications(prev => {
        const updated = [{ ...notif, id: Date.now(), timestamp: new Date() }, ...prev];
        localStorage.setItem('storymee_app_notifications', JSON.stringify(updated));
        return updated;
      });
      setShowNotifications(true);
    };

    const dismissNotifByAction = (action: string, taskIdOrLeaveId?: string) => {
      setAppNotifications(prev => {
        const updated = prev.map(n => {
          if (n.action === action && n.id_ref === taskIdOrLeaveId) {
            return { ...n, read: true };
          }
          return n;
        });
        localStorage.setItem('storymee_app_notifications', JSON.stringify(updated));
        return updated;
      });
    };

    // Task approval request (admin/manager only)
    socket.on('task_request_approval', (data) => {
      if (activeUser.role === 'admin' || activeUser.role === 'manager') {
        addNotif({
          title: 'Yêu cầu duyệt Task',
          message: `Nhân sự ${data.employee_name} vừa xin duyệt hoàn thành task ${data.task_id}`,
          action: 'request_approval',
          id_ref: data.task_id
        });
      }
    });

    // Real-time Kanban sync (NATS → Socket.io)
    socket.on('issue_updated', () => {
      fetchDbData();
    });

    // Leave request notification (admin/manager only)
    socket.on('leave_request_approval', (data) => {
      if (activeUser.role === 'admin' || activeUser.role === 'manager') {
        addNotif({
          title: 'Yêu cầu nghỉ phép',
          message: `Nhân sự ${data.employee_name} vừa xin nghỉ phép`,
          action: 'leave_request',
          id_ref: data.employee_name
        });
      }
    });

    // Task approved
    socket.on('task_approved', (data) => {
      dismissNotifByAction('request_approval', data.task_id);
      if (data.employee_name === activeUser.name) {
        addNotif({ title: 'Duyệt Task', message: `Task ${data.task_id} của bạn đã được DUYỆT!`, type: 'success' });
      }
    });

    // Task rejected
    socket.on('task_rejected', (data) => {
      dismissNotifByAction('request_approval', data.task_id);
      if (data.employee_name === activeUser.name) {
        addNotif({ title: 'Từ chối Task', message: `Task ${data.task_id} của bạn ĐÃ BỊ TỪ CHỐI!`, type: 'error' });
      }
    });

    // Leave approved (legacy event)
    socket.on('leave_approved', (data) => {
      dismissNotifByAction('leave_request', data.employee_name);
      if (data.employee_name === activeUser.name) {
        addNotif({ title: 'Duyệt Nghỉ phép', message: `Yêu cầu nghỉ phép của bạn đã được DUYỆT!`, type: 'success' });
      }
    });

    // Leave rejected (legacy event)
    socket.on('leave_rejected', (data) => {
      dismissNotifByAction('leave_request', data.employee_name);
      if (data.employee_name === activeUser.name) {
        addNotif({ title: 'Từ chối Nghỉ phép', message: `Yêu cầu nghỉ phép của bạn ĐÃ BỊ TỪ CHỐI!`, type: 'error' });
      }
    });

    // TC-L05: NATS emit 'core.team.leave.resolved' → Socket.io forward 'leave_resolved'
    socket.on('leave_resolved', (data) => {
      const memberName = data?.leaveRequest?.member?.fullName || '';
      const leaveStatus = data?.leaveRequest?.status;
      fetchDbData();
      if (memberName === activeUser.name) {
        if (leaveStatus === 'approved') {
          addNotif({ title: '✅ Đơn nghỉ phép được duyệt', message: 'Admin đã phê duyệt đơn nghỉ phép của bạn.', type: 'success' });
        } else if (leaveStatus === 'rejected') {
          addNotif({ title: '❌ Đơn nghỉ phép bị từ chối', message: 'Admin đã từ chối đơn nghỉ phép của bạn.', type: 'error' });
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [authReady, activeUser]);

  return {
    appNotifications,
    setAppNotifications,
    showNotifications,
    setShowNotifications,
    announcements,
    setAnnouncements,
    fetchServerAnnouncements,
    meetings,
    setMeetings,
    fetchServerMeetings,
  };
}
