import React from 'react';
import { TeamMember, Task } from '../../constants';
import ProfileForm from './components/ProfileForm';
import OrgChart from './components/OrgChart';
import AttendanceSheet from './components/AttendanceSheet';
import LeaveApprovals from './components/LeaveApprovals';
import PayrollTabContent from './components/PayrollTabContent';
import RulesEditor from './components/RulesEditor';

interface TeamHRTabProps {
  attendanceList: any[];
  handleCheckinOffice: (memberId: string, notes?: string, workType?: string) => Promise<void>;
  handleCheckoutOffice: (memberId: string, notes?: string) => Promise<void>;
  hrSubTab: 'profile' | 'attendance' | 'leaves' | 'payroll' | 'importer';
  setHrSubTab: (subTab: 'profile' | 'attendance' | 'leaves' | 'payroll' | 'importer') => void;
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
  
  rawMarkdownRules: string;
  setRawMarkdownRules: (rules: string) => void;
  
  selectedMemberId: string;
  setSelectedMemberId: (id: string) => void;
  handleSaveMyProfile: (myMember: TeamMember) => void;
}

const HR_SUB_TABS = [
  { id: 'profile', label: '👤 Hồ sơ & Đội ngũ' },
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
  handleSaveMyProfile
}: TeamHRTabProps) {
  const isAdmin = ['kimngan151091@gmail.com', 'lehuyducanh.vn@gmail.com', 'zuzzivn@gmail.com'].includes(activeUser?.email?.toLowerCase() || '');
  const myMember = teamMembers.find(m => m.id === selectedMemberId) 
    || teamMembers.find(m => m.email?.toLowerCase() === activeUser?.email?.toLowerCase()) 
    || teamMembers[0] 
    || activeUser;
  const isEditingSelf = myMember?.email?.toLowerCase() === activeUser?.email?.toLowerCase();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Sub-tab Switcher Header */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 10, flexWrap: 'wrap' }}>
        {HR_SUB_TABS.map(st => {
          const isLead = ['lehuyducanh.vn@gmail.com', 'kimngan151091@gmail.com', 'zuzzivn@gmail.com'].includes(activeUser?.email?.toLowerCase() || '');
          if (st.id === 'importer' && !isLead) return null;
          return (
            <button
              key={st.id}
              onClick={() => setHrSubTab(st.id)}
              className={`tab-btn ${hrSubTab === st.id ? 'active' : ''}`}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                borderRadius: 8,
                cursor: 'pointer',
                border: 'none',
                background: hrSubTab === st.id ? 'rgba(167,139,250,0.12)' : 'transparent',
                color: hrSubTab === st.id ? '#a78bfa' : '#71717a',
                fontWeight: hrSubTab === st.id ? 600 : 400,
                transition: 'all 0.2s'
              }}
            >
              {st.label}
            </button>
          );
        })}
      </div>

      {/* Sub-tab 1: Hồ sơ cá nhân & Đội ngũ (2 cột) */}
      {hrSubTab === 'profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16 }}>
          {/* CỘT TRÁI: BIỂU MẪU CẬP NHẬT HỒ SƠ */}
          <ProfileForm
            myMember={myMember}
            isEditingSelf={isEditingSelf}
            setTeamMembers={setTeamMembers}
            handleSaveMyProfile={handleSaveMyProfile}
            isAdmin={isAdmin}
          />

          {/* CỘT PHẢI: SƠ ĐỒ TỔ CHỨC & ĐỘI NGŨ */}
          <OrgChart
            hrProfileView={hrProfileView}
            setHrProfileView={setHrProfileView}
            hrSearchQuery={hrSearchQuery}
            setHrSearchQuery={setHrSearchQuery}
            hrDeptFilter={hrDeptFilter}
            setHrDeptFilter={setHrDeptFilter}
            teamMembers={teamMembers}
            selectedMemberId={selectedMemberId}
            setSelectedMemberId={setSelectedMemberId}
            isAdmin={isAdmin}
            tasks={tasks}
          />
        </div>
      )}

      {/* Sub-tab 2: Chấm công tự động */}
      {hrSubTab === 'attendance' && (
        <AttendanceSheet
          teamMembers={teamMembers}
          attendanceList={attendanceList}
          handleCheckinOffice={handleCheckinOffice}
          handleCheckoutOffice={handleCheckoutOffice}
          activeUser={activeUser}
        />
      )}

      {/* Sub-tab 3: Quản lý Phép */}
      {hrSubTab === 'leaves' && (
        <LeaveApprovals
          leavesPending={leavesPending}
          handleApproveLeave={handleApproveLeave}
          handleRejectLeave={handleRejectLeave}
        />
      )}

      {/* Sub-tab 4: Bảng lương */}
      {hrSubTab === 'payroll' && (
        <PayrollTabContent
          currentUser={activeUser}
          teamMembers={teamMembers}
        />
      )}

      {/* Sub-tab 5: Huấn luyện Quy chế AI */}
      {hrSubTab === 'importer' && (
        <RulesEditor
          rawMarkdownRules={rawMarkdownRules}
          setRawMarkdownRules={setRawMarkdownRules}
        />
      )}
    </div>
  );
}
