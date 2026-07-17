import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { TeamMember, Task } from '../../constants';
import ProfileForm from './components/ProfileForm';
import OrgChart from './components/OrgChart';
import AttendanceSheet from './components/AttendanceSheet';
import LeaveApprovals from './components/LeaveApprovals';
import PayrollTabContent from './components/PayrollTabContent';
import RulesEditor from './components/RulesEditor';
import AdminPrivacyPanel from './components/AdminPrivacyPanel';
import { isTeamAdmin } from '@/lib/teamAuth';
import type { AccountFilter } from './components/OrgChart';
import { runMemberAccountAction } from './components/MemberApprovals';

interface TeamHRTabProps {
  attendanceList: any[];
  handleCheckinOffice: (memberId: string, notes?: string, workType?: string) => Promise<void>;
  handleCheckoutOffice: (memberId: string, notes?: string) => Promise<void>;
  hrSubTab: 'profile' | 'attendance' | 'leaves' | 'payroll' | 'importer' | 'accounts' | 'settings';
  setHrSubTab: (subTab: 'profile' | 'attendance' | 'leaves' | 'payroll' | 'importer' | 'accounts' | 'settings') => void;
  onRefreshHr?: () => void;
  hrProfileView: 'chart' | 'list';
  setHrProfileView: (view: 'chart' | 'list') => void;
  hrSearchQuery: string;
  setHrSearchQuery: (query: string) => void;
  hrDeptFilter: string;
  setHrDeptFilter: (dept: string) => void;
  
  teamMembers: TeamMember[];
  setTeamMembers: React.Dispatch<React.SetStateAction<TeamMember[]>>;
  activeUser: TeamMember;
  tasks: Task[];
  
  leavesPending: any[];
  setLeavesPending: React.Dispatch<React.SetStateAction<any[]>>;
  handleApproveLeave: (id: string) => void;
  handleRejectLeave: (id: string) => void;
  /** refresh leaves after submit from form */
  
  rawMarkdownRules: string;
  setRawMarkdownRules: (rules: string) => void;
  
  selectedMemberId: string;
  setSelectedMemberId: (id: string) => void;
  handleSaveMyProfile: (myMember: TeamMember) => void;
}

const HR_SUB_TABS = [
  { id: 'profile', label: '👤 Hồ sơ & Đội ngũ' },
  { id: 'settings', label: '⚙️ Quyền & Privacy' },
  { id: 'attendance', label: '📅 Chấm công' },
  { id: 'leaves', label: '✉️ Đơn xin phép' },
  { id: 'payroll', label: '💵 Bảng lương' },
  { id: 'importer', label: '🧠 Cấu hình RAG' }
] as const;

export default function TeamHRTab({
  attendanceList,
  handleCheckinOffice,
  handleCheckoutOffice,
  hrSubTab,
  setHrSubTab,
  hrProfileView,
  setHrProfileView,
  hrSearchQuery,
  setHrSearchQuery,
  hrDeptFilter,
  setHrDeptFilter,
  teamMembers,
  setTeamMembers,
  activeUser,
  tasks,
  leavesPending,
  setLeavesPending,
  handleApproveLeave,
  handleRejectLeave,
  rawMarkdownRules,
  setRawMarkdownRules,
  selectedMemberId,
  setSelectedMemberId,
  handleSaveMyProfile,
  onRefreshHr
}: TeamHRTabProps) {
  const isAdmin = isTeamAdmin(activeUser);
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('active');
  const myMember = teamMembers.find(m => m.id === selectedMemberId) 
    || teamMembers.find(m => m.email?.toLowerCase() === activeUser?.email?.toLowerCase()) 
    || teamMembers[0] 
    || activeUser;
  const isEditingSelf = myMember?.email?.toLowerCase() === activeUser?.email?.toLowerCase();

  const pending = useMemo(
    () => teamMembers.filter((m) => (m.accountStatus || 'active') === 'pending'),
    [teamMembers]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Sub-tab Switcher Header */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 10, flexWrap: 'wrap' }}>
        {HR_SUB_TABS.map(st => {
          // Legacy: accounts tab merged into profile
          const active =
            hrSubTab === st.id || (hrSubTab === 'accounts' && st.id === 'profile');
          if ((st.id === 'importer' || st.id === 'payroll' || st.id === 'settings') && !isAdmin) return null;
          return (
            <button
              key={st.id}
              onClick={() => setHrSubTab(st.id as any)}
              className={`tab-btn ${active ? 'active' : ''}`}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                borderRadius: 8,
                cursor: 'pointer',
                border: 'none',
                background: active ? 'rgba(167,139,250,0.12)' : 'transparent',
                color: active ? '#a78bfa' : '#71717a',
                fontWeight: active ? 600 : 400,
                transition: 'all 0.2s'
              }}
            >
              {st.label}
            </button>
          );
        })}
      </div>

      {(hrSubTab === 'profile' || hrSubTab === 'accounts') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Pending only — full roster lives in org chart + filters */}
          {isAdmin && pending.length > 0 && (
            <div
              className="glass"
              style={{
                padding: 12,
                border: '1px solid rgba(251,191,36,0.35)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>
                📝 Chờ duyệt đăng ký ({pending.length})
              </div>
              {pending.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'rgba(251,191,36,0.06)',
                    border: '1px solid rgba(251,191,36,0.2)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#fafafa' }}>
                      {m.name || m.fullName}
                    </div>
                    <div style={{ fontSize: 10, color: '#a1a1aa' }}>{m.email}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ fontSize: 11, padding: '5px 10px' }}
                      onClick={async () => {
                        try {
                          await runMemberAccountAction(m.id, 'approve', activeUser, () =>
                            onRefreshHr?.()
                          );
                        } catch (e: any) {
                          toast.error(e?.message || 'Lỗi duyệt');
                        }
                      }}
                    >
                      Duyệt
                    </button>
                    <button
                      type="button"
                      className="btn"
                      style={{ fontSize: 11, padding: '5px 10px', color: '#f87171' }}
                      onClick={async () => {
                        try {
                          await runMemberAccountAction(m.id, 'reject', activeUser, () =>
                            onRefreshHr?.()
                          );
                        } catch (e: any) {
                          toast.error(e?.message || 'Lỗi từ chối');
                        }
                      }}
                    >
                      Từ chối
                    </button>
                    <button
                      type="button"
                      className="btn"
                      style={{ fontSize: 11, padding: '5px 10px' }}
                      onClick={() => setSelectedMemberId(m.id)}
                    >
                      Hồ sơ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(300px, 360px) 1fr',
              gap: 16,
              alignItems: 'start',
            }}
          >
            <ProfileForm
              myMember={myMember}
              isEditingSelf={isEditingSelf}
              setTeamMembers={setTeamMembers}
              handleSaveMyProfile={handleSaveMyProfile}
              isAdmin={isAdmin}
              viewer={activeUser}
              onRefreshHr={onRefreshHr}
            />
            <OrgChart
              hrProfileView={hrProfileView}
              setHrProfileView={setHrProfileView}
              hrSearchQuery={hrSearchQuery}
              setHrSearchQuery={setHrSearchQuery}
              hrDeptFilter={hrDeptFilter}
              setHrDeptFilter={setHrDeptFilter}
              teamMembers={teamMembers}
              setTeamMembers={setTeamMembers}
              selectedMemberId={selectedMemberId}
              setSelectedMemberId={setSelectedMemberId}
              isAdmin={isAdmin}
              tasks={tasks}
              accountFilter={accountFilter}
              setAccountFilter={setAccountFilter}
            />
          </div>
        </div>
      )}

      {hrSubTab === 'settings' && (
        <AdminPrivacyPanel
          activeUser={activeUser}
          teamMembers={teamMembers}
          setTeamMembers={setTeamMembers}
          onRefresh={() => onRefreshHr?.()}
        />
      )}

      {hrSubTab === 'attendance' && (
        <AttendanceSheet
          teamMembers={teamMembers}
          attendanceList={attendanceList}
          handleCheckinOffice={handleCheckinOffice}
          handleCheckoutOffice={handleCheckoutOffice}
          activeUser={activeUser}
        />
      )}

      {hrSubTab === 'leaves' && (
        <LeaveApprovals
          leavesPending={leavesPending}
          handleApproveLeave={handleApproveLeave}
          handleRejectLeave={handleRejectLeave}
          activeUser={activeUser}
          onLeaveSubmitted={() => onRefreshHr?.()}
        />
      )}

      {hrSubTab === 'payroll' && (
        <PayrollTabContent
          currentUser={activeUser}
          teamMembers={teamMembers}
        />
      )}

      {hrSubTab === 'importer' && (
        <RulesEditor
          rawMarkdownRules={rawMarkdownRules}
          setRawMarkdownRules={setRawMarkdownRules}
        />
      )}
    </div>
  );
}
