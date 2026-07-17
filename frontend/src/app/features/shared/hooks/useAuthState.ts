import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { TeamMember, TEAM } from '../../../constants';
import { coreApiClient, API_ROUTES } from '@/lib/apiClient';
import { isAccountActive, isTeamAdmin } from '@/lib/teamAuth';

function mapMember(m: any): TeamMember {
  return {
    ...m,
    name: m.fullName || m.name,
    fullName: m.fullName || m.name,
    skills: m.skills || [],
    color: m.color || '#6366f1',
    annualLeaveLimit: m.annualLeaveLimit ?? 12,
    annualLeaveUsed: m.annualLeaveUsed ?? 0,
    remoteLimit: m.remoteLimit ?? 4,
    remoteUsed: m.remoteUsed ?? 0,
    salaryGross: m.salaryGross ?? 0,
    dependentCount: m.dependentCount ?? 0,
    bankName: m.bankName || '',
    bankAccount: m.bankAccount || '',
    telegramUsername: m.telegramUsername || '',
  };
}

export function useAuthState() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  const [activeUser, setActiveUser] = useState<TeamMember>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('st_user');
      if (stored) {
        try {
          const u = JSON.parse(stored);
          const found = TEAM.find(
            (m) => (m?.email || '').toLowerCase() === (u?.email || '').toLowerCase()
          );
          if (found) return { ...found, ...u, name: u.name || found.name };
          return mapMember({
            id: u.id || 'local',
            fullName: u.name,
            email: u.email,
            role: u.role,
            accountStatus: u.accountStatus || 'active',
          });
        } catch {}
      }
    }
    return TEAM[0];
  });

  // After login cookie: hydrate full profile from DB (active only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('st_user');
    if (!stored) {
      router.push('/login');
      return;
    }
    let email = '';
    try {
      email = JSON.parse(stored).email || '';
    } catch {
      router.push('/login');
      return;
    }

    (async () => {
      try {
        const res: any = await coreApiClient.get(
          `${API_ROUTES.HR.AUTH_LOOKUP}?q=${encodeURIComponent(email)}`
        );
        if ((res.status === 'success' || res.success) && res.data) {
          const m = mapMember(res.data);
          setActiveUser(m);
          localStorage.setItem(
            'st_user',
            JSON.stringify({
              id: m.id,
              email: m.email,
              name: m.name,
              role: m.role,
              accountStatus: m.accountStatus || 'active',
              color: m.color,
            })
          );
          setAuthReady(true);
          return;
        }
      } catch (err: any) {
        const code = err?.data?.code || err?.status;
        if (err?.status === 403 || String(code).startsWith('ACCOUNT_')) {
          toast.error(err?.data?.message || 'Tài khoản chưa được duyệt / đã khoá.');
          localStorage.removeItem('st_user');
          router.push('/login');
          return;
        }
        // Network fallback: allow session if stored, mark ready
        console.warn('[useAuthState] lookup failed, using stored session', err);
      }
      setAuthReady(true);
    })();
  }, [router]);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('st_user');
      router.push('/login');
    }
  };

  const handleSaveMyProfile = async (myMember: TeamMember) => {
    try {
      const isSelf =
        (myMember.email || '').toLowerCase() === (activeUser?.email || '').toLowerCase();
      const admin = isTeamAdmin(activeUser);

      // Admin editing anyone (incl. self with HR fields) → full upsert so leave/remote limits persist
      if (admin) {
        await coreApiClient.post(API_ROUTES.HR.TEAM_MEMBERS, {
          email: myMember.email,
          fullName: myMember.name || myMember.fullName,
          role: myMember.role,
          phone: myMember.phone,
          telegramUsername: myMember.telegramUsername,
          telegramChatId: myMember.telegramChatId,
          bankName: myMember.bankName,
          bankAccount: myMember.bankAccount,
          skills: myMember.skills || [],
          workArrangement: myMember.workArrangement || 'office',
          annualLeaveLimit: myMember.annualLeaveLimit,
          annualLeaveUsed: myMember.annualLeaveUsed,
          remoteLimit: myMember.remoteLimit,
          remoteUsed: myMember.remoteUsed,
          salaryGross: myMember.salaryGross,
          dependentCount: myMember.dependentCount,
          isActive: myMember.isActive,
          actorEmail: activeUser.email,
        });
      } else if (isSelf) {
        await coreApiClient.post(API_ROUTES.HR.TEAM_MEMBERS, {
          mode: 'self',
          actorEmail: activeUser.email,
          email: myMember.email,
          fullName: myMember.name || myMember.fullName,
          role: myMember.role,
          phone: myMember.phone,
          telegramUsername: myMember.telegramUsername,
          bankName: myMember.bankName,
          bankAccount: myMember.bankAccount,
          skills: myMember.skills || [],
          workArrangement: myMember.workArrangement,
        });
      } else {
        toast.error('Chỉ Admin mới sửa hồ sơ người khác');
        return;
      }
      toast.success('Đã cập nhật hồ sơ (hình thức làm việc / hạn mức phép được lưu DB)');
      if (isSelf) {
        setActiveUser({ ...myMember, name: myMember.name || myMember.fullName || '' });
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.data?.message || err?.message || 'Không thể kết nối máy chủ');
    }
  };

  return {
    authReady,
    setAuthReady,
    activeUser,
    setActiveUser,
    showUserMenu,
    setShowUserMenu,
    selectedTask,
    setSelectedTask,
    handleLogout,
    handleSaveMyProfile,
    isAdmin: isTeamAdmin(activeUser),
    isActiveAccount: isAccountActive(activeUser),
  };
}
