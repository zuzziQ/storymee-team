/**
 * useAppState — Orchestrator Hook
 * 
 * Kết hợp tất cả domain hooks thành một interface duy nhất.
 * Mỗi hook con xử lý một domain riêng biệt:
 *   - useAuthState     → Auth, user, logout
 *   - useHrState       → HR members, attendance, leaves
 *   - useTaskState     → Plane issues / tasks
 *   - useProjectState  → Projects, AI insights
 *   - useChatState     → AI chat, OmniRouter
 *   - useSocketState   → WebSocket real-time events
 */
import { useEffect } from 'react';
import { useAuthState } from './useAuthState';
import { useHrState } from './useHrState';
import { useTaskState } from './useTaskState';
import { useProjectState } from './useProjectState';
import { useChatState } from './useChatState';
import { useSocketState } from './useSocketState';

import { useState as useReactState } from 'react';

export function useAppState() {
  const [tab, setTab] = useReactState<string>('kanban');
  const [overviewSubTab, setOverviewSubTab] = useReactState<'all' | 'mine' | 'team'>('all');
  const auth = useAuthState();
  const hr = useHrState();
  const taskState = useTaskState();
  const projectState = useProjectState();
  const chat = useChatState();

  // --- fetchDbData: gọi 3 domains song song ---
  const fetchDbData = async () => {
    await Promise.all([
      hr.fetchHrData(auth.setActiveUser, auth.activeUser?.email),
      taskState.fetchTasksData(),
      projectState.fetchProjectsData(),
    ]);
  };

  const socket = useSocketState(auth.authReady, auth.activeUser, fetchDbData);

  // --- Fetch khi auth xong ---
  useEffect(() => {
    if (auth.authReady) {
      fetchDbData();
      chat.fetchServerLogs();
      socket.fetchServerAnnouncements();
      socket.fetchServerMeetings();
    }
  }, [auth.authReady]);

  // --- Socket is primary; polling is a low-frequency recovery path. ---
  useEffect(() => {
    if (!auth.authReady) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchDbData();
        chat.fetchServerLogs();
        socket.fetchServerAnnouncements();
        socket.fetchServerMeetings();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchDbData();
      }
    }, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [auth.authReady, auth.activeUser]);

  // --- Wrapper handlers: bind deps từ các hooks ---
  const handleUpdateTask = (task: any) => {
    taskState.handleUpdateTask(task, hr.teamMembers, fetchDbData);
    if (auth.selectedTask?.id === task.id) {
      auth.setSelectedTask(task);
    }
  };

  const handleCreateTask = (title: string, assignee: string, estimate: number, priority: any, status?: string) => {
    // Priority for project:
    // 1) Header filter when a real project is selected
    // 2) Projects-tab active project (quick-add under that project)
    // 3) Inbox DFLT — never silent StorymeeTeam / first project
    const sel = projectState.selectedProjectId;
    const active = projectState.activeProjectId;
    const projects = projectState.projects || [];
    const isRealProject = (id?: string) =>
      !!id &&
      id !== 'all' &&
      id !== 'default_no_project' &&
      id !== 'p4' &&
      projects.some((p: any) => p.id === id);

    let projectForCreate = 'default_no_project';
    if (isRealProject(sel)) projectForCreate = sel;
    else if (isRealProject(active)) projectForCreate = active;

    return taskState.handleCreateTask(
      title,
      assignee,
      estimate,
      priority,
      projectForCreate,
      hr.teamMembers,
      projects,
      fetchDbData,
      status
    );
  };

  const handleCreateSubtask = (title: string, parentTaskId: string, projectId: string) =>
    taskState.handleCreateSubtask(title, parentTaskId, projectId, fetchDbData);

  const handleUpdateSubtaskState = (subtaskId: string, isDone: boolean) =>
    taskState.handleUpdateSubtaskState(subtaskId, isDone, fetchDbData);

  const handleArchiveTaskDirect = (task: { id: string; dbId?: string; title?: string }) =>
    taskState.handleArchiveTaskDirect(task, fetchDbData);

  const handleDeleteTaskHard = (task: { id: string; dbId?: string; title?: string }) =>
    taskState.handleDeleteTaskHard(
      task,
      { id: auth.activeUser?.id, email: auth.activeUser?.email },
      fetchDbData
    );

  const handleRequestArchive = (task: { id: string; dbId?: string }, reason: string) =>
    taskState.handleRequestArchive(task, reason, fetchDbData);

  const handleSubmitForReview = (task: any, content: string, urls: string[], submitterId: string, onRefresh: () => void) =>
    taskState.handleSubmitForReview(task, content, urls, submitterId, onRefresh || fetchDbData);

  const handleReviewDecision = (taskId: string, taskDbId: string, decision: 'approve' | 'reject', reviewerId: string, note: string, onRefresh: () => void) =>
    taskState.handleReviewDecision(taskId, taskDbId, decision, reviewerId, note, onRefresh || fetchDbData);

  const handleAddProject = () => projectState.handleAddProject(fetchDbData);
  const handleDeleteProject = (id: string) => projectState.handleDeleteProject(id, fetchDbData);
  const handleUpdateProject = (id: string, updates: Partial<any>) => projectState.handleUpdateProject(id, updates, fetchDbData);
  const handleAnalyzeProject = (id: string) =>
    projectState.handleAnalyzeProject(id, taskState.tasks, hr.teamMembers, chat.omniConfig);

  const handleApproveLeave = (id: string) => hr.handleApproveLeave(id, fetchDbData);
  const handleRejectLeave = (id: string) => hr.handleRejectLeave(id, fetchDbData);

  const handleSendAiChat = (customText?: string) =>
    chat.handleSendAiChat(customText, {
      tasks: taskState.tasks,
      projects: projectState.projects,
      activeUser: auth.activeUser,
      omniCfg: chat.omniConfig,
      rules: chat.rawMarkdownRules
    });

  const handleAutoSendChat = (customText: string) => handleSendAiChat(customText);

  const handleSaveMyProfile = async (myMember: any) => {
    await auth.handleSaveMyProfile(myMember);
    await fetchDbData();
  };

  const handleCheckinOffice = async (memberId: string, notes?: string, workType?: string) => {
    await hr.handleCheckinOffice(memberId, notes, workType);
    await fetchDbData();
  };

  const handleCheckoutOffice = async (memberId: string, notes?: string) => {
    await hr.handleCheckoutOffice(memberId, notes);
    await fetchDbData();
  };

  // --- Merge selectedTask lên auth ---
  const { selectedTask, setSelectedTask } = auth;
  const setTasks = (updater: any) => {
    taskState.setTasks(updater);
  };

  return {
    // Auth
    authReady: auth.authReady,
    activeUser: auth.activeUser,
    setActiveUser: auth.setActiveUser,
    showUserMenu: auth.showUserMenu,
    setShowUserMenu: auth.setShowUserMenu,
    selectedTask,
    setSelectedTask,
    handleLogout: auth.handleLogout,
    handleSaveMyProfile,

    // HR
    teamMembers: hr.teamMembers,
    setTeamMembers: hr.setTeamMembers,
    attendanceList: hr.attendanceList,
    setAttendanceList: hr.setAttendanceList,
    leavesPending: hr.leavesPending,
    setLeavesPending: hr.setLeavesPending,
    selectedMemberId: hr.selectedMemberId,
    setSelectedMemberId: hr.setSelectedMemberId,
    hrSubTab: hr.hrSubTab,
    setHrSubTab: hr.setHrSubTab,
    hrProfileView: hr.hrProfileView,
    setHrProfileView: hr.setHrProfileView,
    hrSearchQuery: hr.hrSearchQuery,
    setHrSearchQuery: hr.setHrSearchQuery,
    hrDeptFilter: hr.hrDeptFilter,
    setHrDeptFilter: hr.setHrDeptFilter,
    handleCheckinOffice,
    handleCheckoutOffice,
    handleApproveLeave,
    handleRejectLeave,

    // Tasks
    tasks: taskState.tasks,
    setTasks,
    handleUpdateTask,
    handleCreateTask,
    handleCreateSubtask,
    handleUpdateSubtaskState,
    handleArchiveTaskDirect,
    handleDeleteTaskHard,
    handleRequestArchive,
    handleSubmitForReview,
    handleReviewDecision,
    fetchDbData,

    // Projects
    projects: projectState.projects,
    setProjects: projectState.setProjects,
    activeProjectId: projectState.activeProjectId,
    setActiveProjectId: projectState.setActiveProjectId,
    selectedProjectId: projectState.selectedProjectId,
    setSelectedProjectId: projectState.setSelectedProjectId,
    timeFilter: projectState.timeFilter,
    setTimeFilter: projectState.setTimeFilter,
    showAddProjectModal: projectState.showAddProjectModal,
    setShowAddProjectModal: projectState.setShowAddProjectModal,
    newProjectName: projectState.newProjectName,
    setNewProjectName: projectState.setNewProjectName,
    newProjectDesc: projectState.newProjectDesc,
    setNewProjectDesc: projectState.setNewProjectDesc,
    newProjectColor: projectState.newProjectColor,
    setNewProjectColor: projectState.setNewProjectColor,
    aiAnalyzing: projectState.aiAnalyzing,
    aiProjectInsights: projectState.aiProjectInsights,
    aiSuccessRate: projectState.aiSuccessRate,
    aiPredictedDate: projectState.aiPredictedDate,
    handleAddProject,
    handleDeleteProject,
    handleUpdateProject,
    handleAnalyzeProject,

    // Chat
    aiChatMessages: chat.aiChatMessages,
    aiChatInput: chat.aiChatInput,
    setAiChatInput: chat.setAiChatInput,
    aiChatLoading: chat.aiChatLoading,
    chatEndRef: chat.chatEndRef,
    chatOpen: chat.chatOpen,
    setChatOpen: chat.setChatOpen,
    chatLayout: chat.chatLayout,
    setChatLayout: chat.setChatLayout,
    omniConfig: chat.omniConfig,
    setOmniConfig: chat.setOmniConfig,
    routingLogs: chat.routingLogs,
    setRoutingLogs: chat.setRoutingLogs,
    tokenStats: chat.tokenStats,
    setTokenStats: chat.setTokenStats,
    rawMarkdownRules: chat.rawMarkdownRules,
    setRawMarkdownRules: chat.setRawMarkdownRules,
    handleSendAiChat,
    handleAutoSendChat,

    // Socket / Notifications
    appNotifications: socket.appNotifications,
    setAppNotifications: socket.setAppNotifications,
    showNotifications: socket.showNotifications,
    setShowNotifications: socket.setShowNotifications,
    announcements: socket.announcements,
    setAnnouncements: socket.setAnnouncements,
    fetchServerAnnouncements: socket.fetchServerAnnouncements,
    meetings: socket.meetings,
    setMeetings: socket.setMeetings,
    fetchServerMeetings: socket.fetchServerMeetings,

    // Meta
    dbError: hr.dbError || taskState.dbTaskError,
    tab, setTab,
    overviewSubTab, setOverviewSubTab,
  };
}
