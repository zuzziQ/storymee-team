import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TeamMember, TEAM } from '../../../constants';
import { coreApiClient } from '../../../../lib/apiClient';
import { API_ROUTES } from '@/lib/apiClient';

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
          const found = TEAM.find(m => (m?.email || '').toLowerCase() === (u?.email || '').toLowerCase());
          if (found) return found;
        } catch {}
      }
    }
    return TEAM[0];
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const user = localStorage.getItem('st_user');
      if (!user) {
        router.push('/login');
      } else {
        setAuthReady(true);
      }
    }
  }, [router]);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('st_user');
      router.push('/login');
    }
  };

  const handleSaveMyProfile = async (myMember: TeamMember) => {
    try {
      await coreApiClient.post(API_ROUTES.HR.TEAM_MEMBERS, {
        email: myMember.email,
        fullName: myMember.name,
        role: myMember.role,
        phone: myMember.phone,
        telegramUsername: myMember.telegramUsername,
        telegramChatId: myMember.telegramChatId ? Number(myMember.telegramChatId) : null,
        bankName: myMember.bankName,
        bankAccount: myMember.bankAccount,
        skills: myMember.skills || [],
        workArrangement: myMember.workArrangement,
        annualLeaveLimit: myMember.annualLeaveLimit,
        annualLeaveUsed: myMember.annualLeaveUsed,
        remoteLimit: myMember.remoteLimit,
        remoteUsed: myMember.remoteUsed,
        salaryGross: myMember.salaryGross,
        dependentCount: myMember.dependentCount
      });
      alert('🎉 Đã cập nhật hồ sơ thành công lên Database!');
    } catch (err) {
      console.error(err);
      alert('Không thể kết nối đến máy chủ.');
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
  };
}
