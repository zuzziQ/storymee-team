import { fetchAxios } from '@/lib/fetchAxios';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Task, Project, TeamMember, Announcement, ChatMessage, Priority, TaskStatus,
  TASKS_DEFAULT, PROJECTS_DEFAULT, ANNOUNCEMENTS_DEFAULT, COMPANY_RULES, TEAM
} from '../../../constants';
import { filterRelevantRules } from '../../chat/components/ChatWidgetContent';
import { coreApiClient } from '../../../../lib/apiClient';
import { API_ROUTES } from '@/lib/apiClient';

const API_BASE = '';

export function useAppState() {
  const router = useRouter();
  const [dbError, setDbError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('#6366f1');

  // AI & Time Filter & Project Tracker states
  const [timeFilter, setTimeFilter] = useState<'week' | 'next-week' | 'sprint'>('sprint');
  const [activeProjectId, setActiveProjectId] = useState<string>('p4');
  const [aiProjectInsights, setAiProjectInsights] = useState<Record<string, string>>({
    p4: 'Dự án **Phát triển WebApp StorymeeTeam** đang hoạt động với tiến độ rất tốt (44% công việc hoàn thành). \n\n* **Điểm mạnh:** Cả Đức Anh và Quỳnh Hương đều hoàn thành sớm các task thiết kế và cấu hình ban đầu. \n* **Rủi ro:** Quang Minh đang có 2 công việc In Progress là Drag & Drop và tích hợp API. Trợ lý AI ước tính khả năng hoàn thành đúng hạn đạt 90%. \n* **Đề xuất:** Cần phân bổ Kim Ngân hỗ trợ chuẩn bị tài liệu hoặc test sớm giao diện sau khi Minh tích hợp xong API.'
  });
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiSuccessRate, setAiSuccessRate] = useState<Record<string, number>>({
    p1: 75, p2: 60, p3: 80, p4: 90
  });
  const [aiPredictedDate, setAiPredictedDate] = useState<Record<string, string>>({
    p1: '04/07/2026', p2: '09/07/2026', p3: '08/07/2026', p4: '05/07/2026'
  });

  const [omniConfig, setOmniConfig] = useState({
    useCloud: true,
    useFallback: true,
    useMasking: true,
    useCompression: true
  });

  const [routingLogs, setRoutingLogs] = useState<any[]>([]);

  const [tokenStats, setTokenStats] = useState({
    totalTokens: 0,
    compressedTokens: 0
  });

  const [rawMarkdownRules, setRawMarkdownRules] = useState<string>('');

  const [tab, setTab] = useState('overview');
  const [hrSubTab, setHrSubTab] = useState<'profile' | 'attendance' | 'leaves' | 'payroll' | 'importer'>('profile');
  const [hrProfileView, setHrProfileView] = useState<'chart' | 'list'>('chart');
  const [overviewSubTab, setOverviewSubTab] = useState<'all' | 'mine' | 'team'>('all');
  const [hrSearchQuery, setHrSearchQuery] = useState('');
  const [hrDeptFilter, setHrDeptFilter] = useState('all');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [leavesPending, setLeavesPending] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('m2');
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('storymee_company_rules');
    if (saved) {
      setRawMarkdownRules(saved);
    } else {
      setRawMarkdownRules(COMPANY_RULES);
      localStorage.setItem('storymee_company_rules', COMPANY_RULES);
    }
  }, []);

  // Load OmniRouter & Project AI states from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedConfig = localStorage.getItem('storymee_omni_config');
      if (savedConfig) setOmniConfig(JSON.parse(savedConfig));

      const savedLogs = localStorage.getItem('storymee_omni_logs');
      if (savedLogs) setRoutingLogs(JSON.parse(savedLogs));

      const savedStats = localStorage.getItem('storymee_omni_stats');
      if (savedStats) setTokenStats(JSON.parse(savedStats));

      const savedInsights = localStorage.getItem('storymee_ai_project_insights');
      if (savedInsights) setAiProjectInsights(JSON.parse(savedInsights));

      const savedRates = localStorage.getItem('storymee_ai_success_rate');
      if (savedRates) setAiSuccessRate(JSON.parse(savedRates));

      const savedDates = localStorage.getItem('storymee_ai_predicted_date');
      if (savedDates) setAiPredictedDate(JSON.parse(savedDates));
    }
  }, []);

  // Save OmniRouter & Project AI states to localStorage when changed
  useEffect(() => {
    localStorage.setItem('storymee_omni_config', JSON.stringify(omniConfig));
  }, [omniConfig]);

  useEffect(() => {
    localStorage.setItem('storymee_omni_stats', JSON.stringify(tokenStats));
  }, [tokenStats]);

  useEffect(() => {
    localStorage.setItem('storymee_ai_project_insights', JSON.stringify(aiProjectInsights));
  }, [aiProjectInsights]);

  useEffect(() => {
    localStorage.setItem('storymee_ai_success_rate', JSON.stringify(aiSuccessRate));
  }, [aiSuccessRate]);

  useEffect(() => {
    localStorage.setItem('storymee_ai_predicted_date', JSON.stringify(aiPredictedDate));
  }, [aiPredictedDate]);

  // Chatbot & Form states
  const [aiChatMessages, setAiChatMessages] = useState<ChatMessage[]>([
    { id: '1', sender: 'ai', text: 'Chào sếp và các nhân sự Storymee! Tôi là trợ lý AI thông minh kết nối với dữ liệu dự án của bạn. Tôi có thể giúp bạn truy vấn trạng thái công việc, xin nghỉ phép hoặc cập nhật thời hạn công việc (delay task).' }
  ]);
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Global Chat widget states
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLayout, setChatLayout] = useState<'popup' | 'sidebar'>('popup');

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
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const fetchServerLogs = async () => {
    try {
      const res = await fetchAxios('/api/ai/logs');
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success' && Array.isArray(json.data)) {
          setRoutingLogs(json.data);
          
          // Tự động tính toán tổng lượng token tiêu thụ từ danh sách logs của máy chủ
          let total = 0;
          let compressed = 0;
          json.data.forEach((l: any) => {
            if (l.tokens !== undefined) {
              total += l.tokens;
              compressed += l.compressed || 0;
            } else {
              // Ước lượng đối với các log cũ trước khi nâng cấp
              total += 2250;
              compressed += 1800;
            }
          });

          setTokenStats({
            totalTokens: total,
            compressedTokens: compressed
          });
        }
      }
    } catch (err) {
      console.error("Lỗi fetch logs từ server:", err);
    }
  };

  const fetchServerAnnouncements = async () => {
    try {
      const res = await fetchAxios('/api/ai/announcements');
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success' && Array.isArray(json.data)) {
          setAnnouncements(json.data);
        }
      }
    } catch (err) {
      console.error("Lỗi fetch announcements từ server:", err);
    }
  };

  const fetchDbData = async () => {
    try {
      setDbError(null);
      const membersData = await coreApiClient.get(API_ROUTES.HR.TEAM_MEMBERS);
      if (membersData.status === 'success' && Array.isArray(membersData.data)) {
        const mappedMembers = membersData.data.map((m: any) => ({
          ...m,
          name: m.fullName
        }));
        setTeamMembers(mappedMembers);
          
          let targetEmail = activeUser?.email;
          if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('st_user');
            if (stored) {
              try {
                targetEmail = JSON.parse(stored).email;
              } catch {}
            }
          }
          const updatedActive = mappedMembers.find((m: any) => (m?.email || '').toLowerCase() === (targetEmail || '').toLowerCase());
          if (updatedActive) {
            setActiveUser(updatedActive);
            setSelectedMemberId(prev => {
              if (prev && mappedMembers.some((m: any) => m.id === prev)) {
                return prev;
              }
              return updatedActive.id;
            });
          }
      } else {
        setDbError("Không thể tải danh sách nhân sự từ Core API.");
      }

      try {
        const attendanceData = await coreApiClient.get(API_ROUTES.HR.ATTENDANCE);
        if (attendanceData.status === 'success' && Array.isArray(attendanceData.data)) {
          setAttendanceList(attendanceData.data);
        }
      } catch (err) {
        console.error("Lỗi fetch attendance từ server:", err);
      }

      try {
        const projectsData = await coreApiClient.get(API_ROUTES.HR.PROJECTS);
        if (projectsData.status === 'success' && Array.isArray(projectsData.data)) {
          const mappedProjects = projectsData.data.map((p: any) => ({
            id: p.id,
            name: p.name,
            key: p.key || 'OMNI',
            description: p.description || '',
            color: p.color || '#6366f1',
            progress: 0,
            tasksCount: 0,
            completedCount: 0
          }));
          
          // Add default project if no project
          mappedProjects.unshift({
            id: 'default_no_project',
            name: 'Mặc định (Không thuộc dự án nào)',
            key: 'NO_PROJ',
            description: 'Các công việc chung, không thuộc dự án cụ thể.',
            color: '#a1a1aa',
            progress: 0,
            tasksCount: 0,
            completedCount: 0
          });

          setProjects(mappedProjects);
          if (mappedProjects.length > 0) {
            setActiveProjectId(prev => {
              if (prev && mappedProjects.some((p: any) => p.id === prev)) {
                return prev;
              }
              return mappedProjects[0].id;
            });
          }
        }
      } catch (err) {
        console.error("Lỗi fetch projects:", err);
      }

      try {
        const issuesData = await coreApiClient.get(API_ROUTES.PLANE.ISSUES);
        if (issuesData.status === 'success' && Array.isArray(issuesData.data)) {
          const dbIssues = issuesData.data;

          const mappedTasks: any[] = dbIssues.filter((issue: any) => !issue.parentId).map((issue: any) => {
            const statusName = issue.State?.name || 'Todo';
            const mappedStatus = statusName === 'Backlog' ? 'Backlog'
                               : statusName === 'Todo' ? 'Todo'
                               : statusName === 'In Progress' ? 'In Progress'
                               : statusName === 'In Review' ? 'In Review'
                               : statusName === 'Done' ? 'Done'
                               : 'Todo';

            const subtasks = (issue.subIssues || []).map((c: any) => ({
              id: c.id,
              dbId: c.id,
              title: c.title,
              isDone: c.State?.group === 'completed' || c.State?.name === 'Done',
              status: c.State?.name || 'Todo'
            }));

            return {
              id: issue.id,
              dbId: issue.id,
              title: issue.title,
              description: issue.description || '',
              assignee: issue.Assignee ? issue.Assignee.fullName : 'Chưa phân công',
              priority: (issue.priority.charAt(0).toUpperCase() + issue.priority.slice(1)),
              status: mappedStatus,
              deadline: issue.targetDate ? issue.targetDate.split('T')[0] : '',
              estimate: 0,
              parentTaskId: null,
              projectId: issue.projectId || 'default_no_project',
              outputSuggested: '',
              subtasks: subtasks
            };
          });
          
          setTasks(mappedTasks);
          setSelectedTask(prev => {
            if (!prev) return null;
            const fresh = mappedTasks.find(t => t.id === prev.id);
            return fresh || prev;
          });
        }
      } catch (err) {
        console.error("Lỗi fetch tasks:", err);
        setDbError("Không thể tải danh sách dự án & công việc từ Core API.");
      }
      try {
        const leavesData = await coreApiClient.get(API_ROUTES.HR.LEAVE_REQUESTS);
        if (leavesData.status === 'success' && Array.isArray(leavesData.data)) {
          const mappedLeaves = leavesData.data.map((l: any) => ({
            id: l.id,
            name: l.member?.fullName || 'Không rõ',
            type: l.leaveType === 'remote' ? 'Remote' : l.leaveType === 'annual' ? 'Leave' : l.leaveType,
            date: l.startDate ? new Date(l.startDate).toLocaleDateString('vi-VN') : '',
            dateEnd: l.endDate ? new Date(l.endDate).toLocaleDateString('vi-VN') : '',
            reason: l.reason || '',
            handover: '',
            days: l.endDate && l.startDate ? Math.max(1, Math.round((new Date(l.endDate).getTime() - new Date(l.startDate).getTime()) / (1000 * 3600 * 24))) : 1,
            status: l.status === 'approved' ? 'Approved' : l.status === 'rejected' ? 'Rejected' : 'Pending',
            memberId: l.memberId
          }));
          setLeavesPending(mappedLeaves);
        }
      } catch (err) {
        console.error('Lỗi fetch leave requests:', err);
      }
    } catch (err) {
      console.error('Fetch tasks error:', err);
      if (err instanceof Error) {
        setDbError(`Lỗi kết nối API Server: ${err.message}`);
      } else if (typeof err === 'object' && err !== null) {
        setDbError(`Lỗi kết nối API Server: ${JSON.stringify(err)}`);
      } else {
        setDbError(`Lỗi kết nối API Server: ${String(err)}`);
      }
    }
  };
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

  useEffect(() => {
    if (authReady) {
      fetchDbData();
      fetchServerLogs();
      fetchServerAnnouncements();
    }
  }, [authReady]);

  // Polling data every 15 seconds, only when document is visible
  useEffect(() => {
    if (!authReady) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchDbData();
        fetchServerLogs();
        fetchServerAnnouncements();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchDbData();
        fetchServerLogs();
        fetchServerAnnouncements();
      }
    }, 15000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [authReady, activeUser]);

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
      await fetchDbData();
    } catch (err) {
      console.error(err);
      alert('Không thể kết nối đến máy chủ.');
    }
  };

  const handleUpdateTask = async (task: Task) => {
    setTasks(prev => prev.map(t => t.id === task.id ? task : t));
    setSelectedTask(prev => prev && prev.id === task.id ? task : prev);
    try {
      const statusMapping: Record<string, string> = {
        'Backlog': 'backlog',
        'Todo': 'pending',
        'In Progress': 'working',   // DB dùng 'working' (không phải 'in_progress')
        'In Review': 'in_review',
        'Done': 'done'
      };
      
      const apiStatus = statusMapping[task.status] || 'pending';
      const matchedMember = teamMembers.find(m => m.name === task.assignee);
      const subtaskId = task.dbId || task.id;
      
      await coreApiClient.patch(`${API_ROUTES.PLANE.ISSUES}/${subtaskId}`, {
        stateId: undefined, // We'll need a way to map to actual stateIds if needed, but for now Plane backend will use status mapping internally or we rely on the backend patch
        priority: task.priority.toLowerCase()
      });

      await fetchDbData();
    } catch (err) {
      console.error("Lỗi cập nhật task lên Postgres:", err);
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await coreApiClient.delete(`${API_ROUTES.HR.PROJECTS}/${id}`);
      setProjects(prev => prev.filter(p => p.id !== id));
      if (activeProjectId === id) {
        setActiveProjectId(projects.find(p => p.id !== id)?.id || '');
      }
    } catch (err) {
      console.error("Lỗi xóa dự án:", err);
      alert('Không thể xóa dự án: ' + String(err));
    }
  };

  const handleCreateTask = async (title: string, assignee: string, estimate: number, priority: Priority) => {
    try {
      const matchedMember = teamMembers.find(m => m.name === assignee);
      const targetProjectId = projects.length > 1 && projects[1]?.id !== 'default_no_project' ? projects[1].id : null;
      if (!targetProjectId) {
        alert('Không tìm thấy dự án nào hợp lệ để tạo Issue.');
        return;
      }
      
      await coreApiClient.post(API_ROUTES.PLANE.ISSUES, {
        title,
        priority: priority.toLowerCase(),
        assigneeId: matchedMember ? matchedMember.id : null,
        projectId: targetProjectId
      });
      await fetchDbData();
    } catch (err) {
      console.error("Lỗi tạo subtask lên Postgres:", err);
      alert('Không thể tạo công việc: ' + (err as any)?.message || String(err));
    }
  };

  const handleSendAiChat = async (customText?: string) => {
    const textToSend = customText || aiChatInput;
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = { id: `m-${Date.now()}`, sender: 'user', text: textToSend };
    setAiChatMessages(prev => [...prev, userMsg]);
    if (!customText) setAiChatInput('');
    setAiChatLoading(true);

    try {
      const res = await fetchAxios('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: aiChatMessages.map(m => ({ role: m.sender === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })),
          tasks: tasks,
          projects: projects,
          currentUser: activeUser,
          config: omniConfig,
          companyRules: filterRelevantRules(textToSend, rawMarkdownRules)
        })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success') {
          const aiMsg: ChatMessage = { id: `m-${Date.now() + 1}`, sender: 'ai', text: json.data.reply };
          setAiChatMessages(prev => [...prev, aiMsg]);
          
          if (json.log) {
            setRoutingLogs(prev => [json.log, ...prev]);
            const sent = textToSend.length * 0.75 + 1500;
            const saved = omniConfig.useCompression ? sent * 0.8 : 0;
            setTokenStats(prev => ({
              totalTokens: Math.round(prev.totalTokens + sent),
              compressedTokens: Math.round(prev.compressedTokens + saved)
            }));
          }

          if (json.data.action === 'update_task' && json.data.taskPayload) {
            const payload = json.data.taskPayload;
            setTasks(prev => prev.map(t => t.id === payload.id ? { ...t, ...payload } : t));
          } else if (json.data.action === 'create_task' && json.data.taskPayload) {
            const payload = json.data.taskPayload;
            handleCreateTask(
              payload.title || 'Nhiệm vụ mới từ AI',
              payload.assignee || activeUser.name,
              payload.estimate || 4,
              payload.priority || 'Medium'
            );
          }
        }
      } else {
        throw new Error("Lỗi gọi API chat");
      }
    } catch (err) {
      console.error(err);
      const errorMsg: ChatMessage = { id: `m-${Date.now() + 1}`, sender: 'ai', text: 'Có lỗi xảy ra khi kết nối với trợ lý AI. Vui lòng kiểm tra lại API key hoặc kết nối internet.' };
      setAiChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setAiChatLoading(false);
    }
  };

  const handleAutoSendChat = (customText: string) => {
    handleSendAiChat(customText);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiChatMessages]);

  const handleApproveLeave = async (id: string) => {
    const leave = leavesPending.find(l => l.id === id);
    if (!leave) return;
    
    try {
      await coreApiClient.post(`${API_ROUTES.HR.LEAVE_REQUESTS}/${id}/approve`, { status: 'approved' });
      alert('🎉 Đã phê duyệt đơn nghỉ phép/remote thành công trên Database!');
      await fetchDbData();
    } catch (err) {
      console.error("Lỗi duyệt phép:", err);
      alert('Không thể kết nối đến máy chủ để duyệt phép.');
    }
  };

  const handleRejectLeave = async (id: string) => {
    try {
      await coreApiClient.post(`${API_ROUTES.HR.LEAVE_REQUESTS}/${id}/approve`, { status: 'rejected' });
      alert('❌ Đã từ chối đơn nghỉ phép/remote thành công!');
      await fetchDbData();
    } catch (err) {
      console.error("Lỗi từ chối phép:", err);
      alert('Không thể kết nối đến máy chủ để từ chối phép.');
    }
  };

  const handleAddProject = async () => {
    if (!newProjectName.trim()) return;
    const newProj: Project = {
      id: `p-${Date.now()}`,
      name: newProjectName.trim(),
      description: newProjectDesc.trim() || 'Dự án mới tạo',
      color: newProjectColor,
      status: 'Active'
    };
    
    // Optimistic UI update
    setProjects(prev => [...prev, newProj]);
    setShowAddProjectModal(false);
    setNewProjectName('');
    setNewProjectDesc('');
    
    try {
      await coreApiClient.post(API_ROUTES.OMNITASK.ROOT, {
        title: newProj.name,
        description: newProj.description,
        color: newProj.color,
        type: 'project'
      });
      // Re-fetch to get real ID from DB
      await fetchDbData();
    } catch (err) {
      console.error('Lỗi khi tạo dự án:', err);
      // Rollback UI (optional) or just alert
      alert('Không thể tạo dự án trên server.');
    }
  };

  const handleAnalyzeProject = async (id: string) => {
    setAiAnalyzing(true);
    try {
      const proj = projects.find(p => p.id === id);
      const res = await fetchAxios('/api/ai/project-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: proj,
          tasks: tasks.filter(t => t.projectId === id),
          team: teamMembers,
          config: omniConfig
        })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success') {
          setAiProjectInsights(prev => ({
            ...prev,
            [id]: json.data.insights
          }));
          setAiSuccessRate(prev => ({
            ...prev,
            [id]: json.data.successRate || 85
          }));
          setAiPredictedDate(prev => ({
            ...prev,
            [id]: json.data.predictedDeadline || '10/07/2026'
          }));
        }
      }
    } catch (err) {
      console.error("Lỗi phân tích dự án bằng AI:", err);
    }
    setAiAnalyzing(false);
  };

  const handleCheckinOffice = async (memberId: string, notes?: string, workType?: string) => {
    try {
      const res: any = await coreApiClient.post(API_ROUTES.HR.ATTENDANCE_CHECKIN, { memberId, notes: notes || 'Check-in từ Web Portal', workType: workType || 'office' });
      if (res?.status === 'already_checked_in') {
        alert('⚠️ Bạn đã check-in rồi!');
        return;
      }
      await fetchDbData();
      alert('✅ Check-in thành công!');
    } catch (err: any) {
      console.error("Lỗi check-in từ web portal:", err);
      if (err?.data?.status === 'already_checked_in') {
        alert('⚠️ Bạn đã check-in rồi!');
      } else {
        alert('❌ Lỗi check-in: ' + (err?.data?.message || err?.message || 'Không xác định'));
      }
    }
  };


  /** ADMIN: Lưu trữ task trực tiếp */
  const handleArchiveTaskDirect = async (task: { id: string; dbId?: string }) => {
    const dbId = task.dbId || task.id;
    if (!window.confirm(`Đưa task "${task.id}" vào Lưu trữ (Archive)?`)) return;
    try {
      await coreApiClient.patch(`${API_ROUTES.HR.SUBTASKS}/${dbId}`, { status: 'archived' });
      setTasks(prev => prev.filter(t => t.id !== task.id)); // Ẩn khỏi UI
      setSelectedTask(null);
    } catch (err) {
      console.error('Lỗi lưu trữ task:', err);
    }
  };

  /** EMPLOYEE: Yêu cầu archive task (chờ admin xác nhận) */
  const handleRequestArchive = async (task: { id: string; dbId?: string }, reason: string) => {
    const dbId = task.dbId || task.id;
    try {
      await coreApiClient.post(`${API_ROUTES.HR.TASKS}/${dbId}/request-archive`, { reason });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'In Review' as any } : t));
      setSelectedTask(null);
      alert('✅ Đã gửi yêu cầu archive. Admin sẽ xem xét và xác nhận.');
    } catch (err) {
      console.error('Lỗi gửi yêu cầu archive:', err);
    }
  };

  /** Check-out: Ghi nhận giờ ra cho nhân viên */
  const handleCheckoutOffice = async (memberId: string, notes?: string) => {
    try {
      const res: any = await coreApiClient.post(API_ROUTES.HR.ATTENDANCE_CHECKOUT, { memberId, notes: notes || 'Check-out từ Web Portal' });
      await fetchDbData();
      alert('✅ Check-out thành công!');
    } catch (err: any) {
      console.error('Lỗi check-out:', err);
      alert('❌ Lỗi check-out: ' + (err?.data?.message || err?.message || 'Chưa check-in hoặc đã check-out rồi'));
    }
  };

  return {
    attendanceList,
    handleCheckinOffice,
    handleCheckoutOffice,
    handleArchiveTaskDirect,
    handleRequestArchive,
    tasks,
    setTasks,
    projects,
    setProjects,
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
    dbError,
    tab,
    setTab,
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
    handleAnalyzeProject
  };
}
