import { useState, useEffect, useRef } from 'react';
import { Announcement, TeamMember, Meeting } from '../../../constants';
import { io, Socket } from 'socket.io-client';
import { coreApiClient } from '@/lib/apiClient';
import { isTeamAdmin } from '@/lib/teamAuth';

function mapAnnouncement(a: any): Announcement {
  return {
    id: a.id,
    title: a.title || '',
    content: a.content || '',
    sender: a.sender?.fullName || a.sender || 'Hệ thống',
    date: a.createdAt || a.date || new Date().toISOString(),
    readBy: Array.isArray(a.readBy) ? a.readBy : [],
    targetUserId: a.targetUserId || undefined,
  };
}

function mapMeeting(m: any): Meeting {
  return {
    ...m,
    host: m.host
      ? { id: m.host.id, name: m.host.fullName || m.host.name, fullName: m.host.fullName }
      : m.host,
    attendees: Array.isArray(m.attendees) ? m.attendees : [],
    documents: Array.isArray(m.documents) ? m.documents : [],
    outputUrls: Array.isArray(m.outputUrls) ? m.outputUrls : [],
  };
}

/** Socket URL: same host as team API (hub/dev-hub), not Next.js origin. */
function resolveSocketBase(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_CORE_API_URL ||
    'https://dev-hub.storymee.com';
  return raw.replace(/\/+$/, '').replace(/\/internal\/v1\/team\/?$/, '');
}

export function useSocketState(
  authReady: boolean,
  activeUser: TeamMember | null,
  fetchDbData: () => Promise<void>
) {
  const [appNotifications, setAppNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const fetchServerMeetings = async () => {
    try {
      const res: any = await coreApiClient.get('/hr/meetings');
      if (res?.status === 'success' && Array.isArray(res.data)) {
        setMeetings(res.data.map(mapMeeting));
      }
    } catch (err) {
      console.error('Lỗi fetch meetings:', err);
    }
  };

  const fetchServerAnnouncements = async () => {
    try {
      // coreApiClient returns body directly: { status, data }
      const res: any = await coreApiClient.get('/hr/announcements');
      if (res?.status === 'success' && Array.isArray(res.data)) {
        setAnnouncements(res.data.map(mapAnnouncement));
      } else if (Array.isArray(res?.data?.data)) {
        // defensive nested shape
        setAnnouncements(res.data.data.map(mapAnnouncement));
      }
    } catch (err) {
      console.error('Lỗi fetch announcements:', err);
    }
  };

  // Poll meetings mỗi 60s — nhắc ~15 phút trước
  useEffect(() => {
    if (!authReady || !activeUser) return;
    const notifiedIds = new Set<string>();

    const checkUpcomingMeetings = async () => {
      try {
        const res: any = await coreApiClient.get('/hr/meetings');
        if (res?.status !== 'success' || !Array.isArray(res.data)) return;
        const allMeetings: Meeting[] = res.data.map(mapMeeting);
        setMeetings(allMeetings);

        const nowMs = Date.now();
        allMeetings.forEach((m: any) => {
          const startMs = new Date(m.startTime || m.start_time || m.createdAt).getTime();
          if (Number.isNaN(startMs)) return;
          const diffMin = Math.floor((startMs - nowMs) / 60000);
          if (diffMin >= 14 && diffMin <= 16 && !notifiedIds.has(m.id)) {
            notifiedIds.add(m.id);
            const timeStr = new Date(startMs).toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
            });
            setAppNotifications((prev) => {
              const updated = [
                {
                  id: Date.now(),
                  title: '📅 Lịch họp sắp bắt đầu',
                  message: `"${m.title || 'Cuộc họp'}" lúc ${timeStr} — còn ~15 phút`,
                  type: 'meeting',
                  timestamp: new Date(),
                  read: false,
                },
                ...prev,
              ];
              localStorage.setItem('storymee_app_notifications', JSON.stringify(updated));
              return updated;
            });
            setShowNotifications(true);
          }
        });
      } catch {
        /* ignore poll errors */
      }
    };

    checkUpcomingMeetings();
    const interval = setInterval(checkUpcomingMeetings, 60_000);
    return () => clearInterval(interval);
  }, [authReady, activeUser]);

  useEffect(() => {
    if (!authReady || !activeUser) return;

    if (typeof window !== 'undefined') {
      const savedNotifs = localStorage.getItem('storymee_app_notifications');
      if (savedNotifs) {
        try {
          setAppNotifications(JSON.parse(savedNotifs));
        } catch {
          /* ignore */
        }
      }
    }

    fetchServerAnnouncements();
    fetchServerMeetings();

    const base = resolveSocketBase();
    const socket = io(base, {
      path: '/api/v1/team/socket.io',
      auth: { token: localStorage.getItem('st_team_token') || '' },
      transports: ['websocket', 'polling'],
      withCredentials: false,
    });
    socketRef.current = socket;

    const addNotif = (notif: any) => {
      setAppNotifications((prev) => {
        const updated = [{ ...notif, id: Date.now(), timestamp: new Date() }, ...prev].slice(0, 50);
        localStorage.setItem('storymee_app_notifications', JSON.stringify(updated));
        return updated;
      });
      setShowNotifications(true);
    };

    const admin = isTeamAdmin(activeUser);

    socket.on('connect', () => {
      console.log('[Socket] connected', socket.id);
    });

    socket.on('issue_updated', () => {
      fetchDbData();
    });

    // NATS core.team.announcement.created → subject mapped announcement_created
    socket.on('announcement_created', (data: any) => {
      const ann = data?.announcement || data;
      if (ann) {
        const mapped = mapAnnouncement(ann);
        setAnnouncements((prev) => {
          if (prev.some((p) => p.id === mapped.id)) return prev;
          return [mapped, ...prev];
        });
        if (!mapped.targetUserId || mapped.targetUserId === activeUser.id) {
          addNotif({
            title: '📢 Thông báo mới',
            message: mapped.title,
            type: 'announcement',
          });
        }
      }
      fetchServerAnnouncements();
    });

    socket.on('meeting_created', (data: any) => {
      fetchServerMeetings();
      const m = data?.meeting || data;
      if (m?.title) {
        addNotif({
          title: '📅 Lịch họp mới',
          message: m.title,
          type: 'meeting',
        });
      }
    });

    socket.on('meeting_updated', () => {
      fetchServerMeetings();
    });

    socket.on('task_request_approval', (data) => {
      if (admin) {
        addNotif({
          title: 'Yêu cầu duyệt Task',
          message: `Xin duyệt task ${data.task_id || data.task?.title || ''}`,
          action: 'request_approval',
          id_ref: data.task_id,
        });
      }
    });

    socket.on('leave_request', (data) => {
      if (admin) {
        addNotif({
          title: 'Yêu cầu nghỉ phép',
          message: data?.leaveRequest?.member?.fullName
            ? `${data.leaveRequest.member.fullName} xin nghỉ`
            : 'Có đơn nghỉ phép mới',
          action: 'leave_request',
        });
      }
    });

    // Hub may forward as leave_request_approval (legacy naming)
    socket.on('leave_request_approval', (data) => {
      if (admin) {
        addNotif({
          title: 'Yêu cầu nghỉ phép',
          message: `Nhân sự ${data.employee_name || ''} vừa xin nghỉ phép`,
          action: 'leave_request',
        });
      }
    });

    socket.on('leave_resolved', (data) => {
      const memberName = data?.leaveRequest?.member?.fullName || '';
      const leaveStatus = data?.leaveRequest?.status;
      fetchDbData();
      if (
        memberName &&
        (memberName === activeUser.name ||
          memberName === (activeUser as any).fullName)
      ) {
        if (leaveStatus === 'approved') {
          addNotif({
            title: '✅ Đơn nghỉ phép được duyệt',
            message: 'Admin đã phê duyệt đơn nghỉ phép của bạn.',
            type: 'success',
          });
        } else if (leaveStatus === 'rejected') {
          addNotif({
            title: '❌ Đơn nghỉ phép bị từ chối',
            message: 'Admin đã từ chối đơn nghỉ phép của bạn.',
            type: 'error',
          });
        }
      }
    });

    socket.on('account_registered', () => {
      if (admin) {
        addNotif({
          title: '🆕 Đăng ký tài khoản',
          message: 'Có yêu cầu đăng ký nội bộ mới — vào HR → Tài khoản nội bộ để duyệt.',
          type: 'account',
        });
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [authReady, activeUser?.id, activeUser?.email]);

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
