'use client';

import React from 'react';
import { useAppState } from './features/shared/hooks/useAppState';
import DashboardTab from './features/dashboard/DashboardTab';
import KanbanTab from './features/kanban/KanbanTab';
import ProjectsTab from './features/projects/ProjectsTab';
import TeamHRTab from './features/hr/TeamHRTab';
import OmnirouterTab from './features/omnirouter/OmnirouterTab';
import AiChatSidebar from './features/chat/AiChatSidebar';
import { ChatWidgetContent } from './features/chat/components/ChatWidgetContent';
import TaskDetailModal from './features/shared/components/TaskDetailModal';
import FullPageChatTab from './features/chat/FullPageChatTab';
import SidebarNav from './features/shared/components/SidebarNav';
import HeaderBar from './features/shared/components/HeaderBar';
import AddProjectModal from './features/shared/components/AddProjectModal';
import { TEAM, getInitials } from './constants';

const TABS = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'projects', label: 'Dự án lớn' },
  { id: 'kanban', label: 'Kanban' },
  { id: 'chat', label: 'Trợ lý AI' },
  { id: 'hr', label: 'Nhân sự' },
  { id: 'omnirouter', label: 'OmniRouter' },
];

export default function StorymeeTeamPage() {
  const {
    tasks,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    showAddProjectModal,
    setShowAddProjectModal,
    newProjectName,
    setNewProjectName,
    newProjectDesc,
    setNewProjectDesc,
    newProjectColor,
    setNewProjectColor,
    timeFilter,
    setTimeFilter,
    activeProjectId,
    setActiveProjectId,
    aiProjectInsights,
    aiAnalyzing,
    aiSuccessRate,
    aiPredictedDate,
    omniConfig,
    setOmniConfig,
    routingLogs,
    setRoutingLogs,
    tokenStats,
    setTokenStats,
    rawMarkdownRules,
    setRawMarkdownRules,
    tab,
    setTab,
    attendanceList,
    handleCheckinOffice,
    hrSubTab,
    setHrSubTab,
    hrProfileView,
    setHrProfileView,
    overviewSubTab,
    setOverviewSubTab,
    hrSearchQuery,
    setHrSearchQuery,
    hrDeptFilter,
    setHrDeptFilter,
    teamMembers,
    setTeamMembers,
    leavesPending,
    setLeavesPending,
    announcements,
    setAnnouncements,
    selectedMemberId,
    setSelectedMemberId,
    showNotifications,
    setShowNotifications,
    aiChatMessages,
    aiChatInput,
    setAiChatInput,
    aiChatLoading,
    chatEndRef,
    chatOpen,
    setChatOpen,
    chatLayout,
    setChatLayout,
    activeUser,
    setActiveUser,
    showUserMenu,
    setShowUserMenu,
    selectedTask,
    setSelectedTask,
    authReady,
    handleLogout,
    handleSaveMyProfile,
    handleUpdateTask,
    handleDeleteProject,
    handleCreateTask,
    handleSendAiChat,
    handleAutoSendChat,
    handleApproveLeave,
    handleRejectLeave,
    handleAddProject,
    handleAnalyzeProject,
    handleArchiveTaskDirect,
    handleRequestArchive,
    handleCheckoutOffice,
    dbError
  } = useAppState();

  const ADMIN_EMAILS = ['kimngan151091@gmail.com', 'lehuyducanh.vn@gmail.com', 'zuzzivn@gmail.com'];
  const isAdmin = ADMIN_EMAILS.includes(activeUser?.email?.toLowerCase() || '');

  if (!authReady) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', color: '#71717a', fontSize: 14 }}>
        Đang tải...
      </div>
    );
  }

  const filteredTasks = tasks.filter(t => {
    if (selectedProjectId !== 'all' && t.projectId !== selectedProjectId) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-base)', overflow: 'hidden' }}>
      {/* ===== SIDEBAR ===== */}
      <SidebarNav
        tab={tab}
        setTab={setTab}
        hrSubTab={hrSubTab}
        setHrSubTab={setHrSubTab}
        activeUser={activeUser}
      />

      {/* ===== MAIN ===== */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <HeaderBar
          tab={tab}
          tabLabel={TABS.find(t => t.id === tab)?.label || 'Storymee'}
          selectedProjectId={selectedProjectId}
          setSelectedProjectId={setSelectedProjectId}
          projects={projects}
          setShowAddProjectModal={setShowAddProjectModal}
          showNotifications={showNotifications}
          setShowNotifications={setShowNotifications}
          announcements={announcements}
          setAnnouncements={setAnnouncements}
          activeUser={activeUser}
          handleLogout={handleLogout}
          showUserMenu={showUserMenu}
          setShowUserMenu={setShowUserMenu}
          setActiveUser={setActiveUser}
          teamMembers={teamMembers}
          setSelectedMemberId={setSelectedMemberId}
          setTab={setTab}
          setHrSubTab={setHrSubTab}
        />

        {/* ===== DATABASE CONNECTION ERROR BANNER ===== */}
        {dbError && (
          <div
            style={{
              background: 'linear-gradient(90deg, rgba(239,68,68,0.2) 0%, rgba(220,38,38,0.2) 100%)',
              borderBottom: '1px solid rgba(220,38,38,0.4)',
              padding: '10px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexShrink: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13 }}>⚠️</span>
              <div style={{ fontSize: 12, color: '#fca5a5', fontWeight: 600 }}>
                {dbError}
              </div>
            </div>
          </div>
        )}

        {/* ===== ANNOUNCEMENT BANNER ===== */}
        {announcements.filter(a => !a.readBy.includes(activeUser.id)).map(ann => (
          <div
            key={ann.id}
            style={{
              background: 'linear-gradient(90deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.15) 100%)',
              borderBottom: '1px solid rgba(139,92,246,0.3)',
              padding: '10px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexShrink: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 13, display: 'flex', alignItems: 'center' }}>📢</span>
              <div style={{ fontSize: 12, color: '#fafafa', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                <strong style={{ color: '#c084fc' }}>{ann.title}:</strong> {ann.content}
              </div>
              <span style={{ fontSize: 10, color: '#71717a', flexShrink: 0 }}>— đăng bởi {ann.sender}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => {
                  setAnnouncements(prev => prev.map(a => a.id === ann.id ? { ...a, readBy: [...a.readBy, activeUser.id] } : a));
                }}
                className="btn-primary"
                style={{
                  padding: '4px 12px',
                  fontSize: 11,
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'white',
                  fontWeight: 500
                }}
              >
                Xác nhận đã đọc
              </button>
            </div>
          </div>
        ))}

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }} onClick={() => { setShowUserMenu(false); setShowNotifications(false); }}>

          {/* ===== OVERVIEW ===== */}
          {tab === 'overview' && (
            <DashboardTab
              overviewSubTab={overviewSubTab}
              setOverviewSubTab={setOverviewSubTab}
              timeFilter={timeFilter}
              setTimeFilter={setTimeFilter}
              activeUser={activeUser}
              teamMembers={teamMembers}
              tasks={tasks}
              filteredTasks={filteredTasks}
              leavesPending={leavesPending}
              announcements={announcements}
              attendanceList={attendanceList}
              setSelectedTask={setSelectedTask}
              setTab={setTab}
            />
          )}

          {/* ===== KANBAN ===== */}
          {tab === 'kanban' && (
            <KanbanTab
              filteredTasks={filteredTasks}
              projects={projects}
              setSelectedTask={setSelectedTask}
              onUpdateTask={handleUpdateTask}
              isAdmin={isAdmin}
              activeUserEmail={activeUser?.email || ''}
              onArchiveTaskDirect={handleArchiveTaskDirect}
              onRequestArchive={(task) => handleRequestArchive(task, '')}
              handleCreateTask={handleCreateTask}
            />
          )}

          {/* ===== PROJECTS (DỰ ÁN LỚN) ===== */}
          {tab === 'projects' && (
            <ProjectsTab
              projects={projects}
              tasks={tasks}
              activeProjectId={activeProjectId}
              setActiveProjectId={setActiveProjectId}
              aiProjectInsights={aiProjectInsights}
              aiAnalyzing={aiAnalyzing}
              aiSuccessRate={aiSuccessRate}
              aiPredictedDate={aiPredictedDate}
              handleAnalyzeProject={handleAnalyzeProject}
              handleDeleteProject={handleDeleteProject}
              teamMembers={teamMembers}
              showAddProjectModal={showAddProjectModal}
              setShowAddProjectModal={setShowAddProjectModal}
              newProjectName={newProjectName}
              setNewProjectName={setNewProjectName}
              newProjectDesc={newProjectDesc}
              setNewProjectDesc={setNewProjectDesc}
              newProjectColor={newProjectColor}
              setNewProjectColor={setNewProjectColor}
              handleAddProject={handleAddProject}
            />
          )}

          {/* ===== AI ASSISTANT FULL-PAGE ===== */}
          {tab === 'chat' && (
            <FullPageChatTab
              aiChatMessages={aiChatMessages}
              aiChatInput={aiChatInput}
              setAiChatInput={setAiChatInput}
              aiChatLoading={aiChatLoading}
              handleSendAiChat={handleSendAiChat}
              handleAutoSendChat={handleAutoSendChat}
              chatEndRef={chatEndRef}
            />
          )}

          {/* ===== PHÂN HỆ NHÂN SỰ TOÀN DIỆN (HRM) ===== */}
          {tab === 'hr' && (
            <TeamHRTab
              attendanceList={attendanceList}
              handleCheckinOffice={handleCheckinOffice}
              handleCheckoutOffice={handleCheckoutOffice}
              hrSubTab={hrSubTab}
              setHrSubTab={setHrSubTab}
              hrProfileView={hrProfileView}
              setHrProfileView={setHrProfileView}
              hrSearchQuery={hrSearchQuery}
              setHrSearchQuery={setHrSearchQuery}
              hrDeptFilter={hrDeptFilter}
              setHrDeptFilter={setHrDeptFilter}
              teamMembers={teamMembers}
              setTeamMembers={setTeamMembers}
              activeUser={activeUser}
              tasks={tasks}
              leavesPending={leavesPending}
              setLeavesPending={setLeavesPending}
              handleApproveLeave={handleApproveLeave}
              handleRejectLeave={handleRejectLeave}
              rawMarkdownRules={rawMarkdownRules}
              setRawMarkdownRules={setRawMarkdownRules}
              selectedMemberId={selectedMemberId}
              setSelectedMemberId={setSelectedMemberId}
              handleSaveMyProfile={handleSaveMyProfile}
            />
          )}

          {/* ===== OMNIROUTER ===== */}
          {tab === 'omnirouter' && (
            <OmnirouterTab
              config={omniConfig}
              setConfig={setOmniConfig}
              logs={routingLogs}
              stats={tokenStats}
            />
          )}

          {/* ===== WORKLOAD ===== */}
          {tab === 'workload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {TEAM.map(m => {
                const hrs = filteredTasks.filter(t => t.assignee === m.name && t.status !== 'Done').reduce((s, t) => s + t.estimate, 0);
                const pct = Math.min(Math.round((hrs / 40) * 100), 100);
                const color = pct > 75 ? '#ef4444' : pct > 40 ? '#f59e0b' : '#22c55e';
                return (
                  <div key={m.id} className="glass glass-hover" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div className="avatar" style={{ background: m.color + '25', color: m.color, width: 36, height: 36, fontSize: 13 }}>{getInitials(m.name)}</div>
                    <div style={{ minWidth: 100 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: '#71717a' }}>{m.role.split(' - ')[0]}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="progress-bar" style={{ height: 6 }}>
                        <div className="progress-bar-fill" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                    <div style={{ minWidth: 80, textAlign: 'right' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color }}>{hrs}h</span>
                      <span style={{ fontSize: 11, color: '#71717a' }}> / 40h</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color, minWidth: 36 }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </main>

      {/* ===== CHAT ASSISTANT DẠNG SIDEBAR TRƯỢT ===== */}
      {chatOpen && chatLayout === 'sidebar' && (
        <div style={{ width: 400, borderLeft: '1px solid var(--border)', background: 'var(--bg-surface)', height: '100%', display: 'flex', flexShrink: 0 }}>
          <ChatWidgetContent
            currentUser={activeUser}
            tasks={tasks}
            onUpdate={handleUpdateTask}
            onCreateTask={handleCreateTask}
            onClose={() => setChatOpen(false)}
            chatLayout={chatLayout}
            setChatLayout={setChatLayout}
            onAddRoutingLog={(log, sentTokens) => {
              setRoutingLogs(prev => [log, ...prev]);
              const saved = omniConfig.useCompression ? sentTokens * 0.8 : 0;
              setTokenStats(prev => ({
                totalTokens: Math.round(prev.totalTokens + sentTokens),
                compressedTokens: Math.round(prev.compressedTokens + saved)
              }));
            }}
            omniConfig={omniConfig}
            rawMarkdownRules={rawMarkdownRules}
          />
        </div>
      )}

      {/* ===== FLOATING CHAT WIDGET (Popup or Button) ===== */}
      <AiChatSidebar
        currentUser={activeUser}
        tasks={tasks}
        onUpdate={handleUpdateTask}
        onCreateTask={handleCreateTask}
        chatOpen={chatOpen}
        setChatOpen={setChatOpen}
        chatLayout={chatLayout}
        setChatLayout={setChatLayout}
        onAddRoutingLog={(log, sentTokens) => {
          setRoutingLogs(prev => [log, ...prev]);
          const saved = omniConfig.useCompression ? sentTokens * 0.8 : 0;
          setTokenStats(prev => ({
            totalTokens: Math.round(prev.totalTokens + sentTokens),
            compressedTokens: Math.round(prev.compressedTokens + saved)
          }));
        }}
        omniConfig={omniConfig}
        rawMarkdownRules={rawMarkdownRules}
      />

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleUpdateTask}
          tasks={tasks}
          teamMembers={teamMembers}
          omniConfig={omniConfig}
          onAddRoutingLog={(log, sentTokens) => {
            setRoutingLogs(prev => [log, ...prev]);
            const saved = omniConfig.useCompression ? sentTokens * 0.8 : 0;
            setTokenStats(prev => ({
              totalTokens: Math.round(prev.totalTokens + sentTokens),
              compressedTokens: Math.round(prev.compressedTokens + saved)
            }));
          }}
        />
      )}

      {/* Add Project Modal */}
      <AddProjectModal
        showAddProjectModal={showAddProjectModal}
        setShowAddProjectModal={setShowAddProjectModal}
        newProjectName={newProjectName}
        setNewProjectName={setNewProjectName}
        newProjectDesc={newProjectDesc}
        setNewProjectDesc={setNewProjectDesc}
        newProjectColor={newProjectColor}
        setNewProjectColor={setNewProjectColor}
        handleAddProject={handleAddProject}
      />
    </div>
  );
}
