import { fetchAxios } from '@/lib/fetchAxios';
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Calendar, Clock, X, Paperclip, MoreVertical, Search, CheckCircle2, Circle, Bot, AlertCircle, FileText, ExternalLink, Activity, Type, ListTodo, ChevronDown, Check, Plus, Trash2, Edit3, Globe } from 'lucide-react';
import {
  Task, SubTask, TeamMember, Priority, TaskStatus, Project,
  getInitials, getMemberColor, renderFormattedText, getStatusClass
} from '../../../constants';
import { coreApiClient } from '../../../../lib/apiClient';
import { API_ROUTES } from '@/lib/apiClient';
import TaskReviewPanel from './TaskReviewPanel';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL === '/api' || process.env.NEXT_PUBLIC_API_URL === '/' || (process.env.NEXT_PUBLIC_API_URL || '').includes('//hub.storymee.com') || !process.env.NEXT_PUBLIC_API_URL ? 'https://dev-hub.storymee.com' : process.env.NEXT_PUBLIC_API_URL) || 'http://localhost:4500';

// Initialize socket outside component to prevent multiple connections
let socket: ReturnType<typeof io> | null = null;
if (typeof window !== 'undefined') {
  socket = io(API_BASE, {
    path: '/internal/v1/team/socket.io',
    autoConnect: false
  });
}

interface Note { id: string; text: string; author: string; time: string; }
interface Attachment { id: string; type: 'link' | 'file'; label: string; url: string; }

export default function TaskDetailModal({
  task,
  onClose,
  onUpdate,
  tasks,
  teamMembers,
  projects,
  onAddRoutingLog,
  omniConfig,
  activeUser,
  onSubmitForReview,
  onReviewDecision,
  onRefresh,
}: {
  task: Task;
  onClose: () => void;
  onUpdate: (t: Task) => void;
  tasks: Task[];
  teamMembers: TeamMember[];
  projects: Project[];
  onAddRoutingLog?: (log: any, sentTokens: number) => void;
  omniConfig?: any;
  activeUser?: any;
  onSubmitForReview?: (task: Task, content: string, urls: string[], submitterId: string, onRefresh: () => void) => Promise<void>;
  onReviewDecision?: (taskId: string, taskDbId: string, decision: 'approve' | 'reject', reviewerId: string, note: string, onRefresh: () => void) => Promise<void>;
  onRefresh?: () => void;
}) {
  const [subtasks, setSubtasks] = useState<SubTask[]>(task.subtasks);
  const [aiLoading, setAiLoading] = useState(false);
  const [handoverTarget, setHandoverTarget] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newLink, setNewLink] = useState('');
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [commitInput, setCommitInput] = useState('');
  const [activeSection, setActiveSection] = useState<'subtasks' | 'notes' | 'resources' | 'activities'>('subtasks');
  const [taskDescription, setTaskDescription] = useState(task.description || '');
  const [taskOutput, setTaskOutput] = useState(task.outputSuggested || '');
  const [showSubmitPanel, setShowSubmitPanel] = useState(false);

  // Admin check: role chứa Founder hoặc IT Admin
  const isAdmin = !!(activeUser?.role && (
    activeUser.role.includes('Founder') ||
    activeUser.role.includes('IT Admin')
  ));
  const isInReview = task.status === 'In Review';
  
  const [notes, setNotes] = useState<Note[]>([
    { id: 'n1', text: 'Cần review lại với team trước khi submit.', author: task.assignee, time: '29/06 08:30' }
  ]);
  const [attachments, setAttachments] = useState<Attachment[]>([
    { id: 'a1', type: 'link', label: 'Figma Design Reference', url: 'https://figma.com' }
  ]);
  const [activities, setActivities] = useState<any[]>([]);

  // Load activities from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storageKey = `task_activities_${task.id}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          setActivities(JSON.parse(stored));
          return;
        } catch {}
      }
      
      const dateStr = task.deadline || new Date().toISOString().split('T')[0];
      const initialLog = [
        {
          id: 'init',
          user: 'Hệ thống',
          action: 'Công việc được khởi tạo trên hệ thống.',
          timestamp: `${dateStr} 09:00`
        }
      ];
      setActivities(initialLog);
      localStorage.setItem(storageKey, JSON.stringify(initialLog));
    }
  }, [task.id]);

  // Realtime Socket.io Subscription for Subtasks
  useEffect(() => {
    if (!socket) return;
    
    socket.connect();
    
    const handleIssueUpdated = (data: any) => {
      // If the updated issue belongs to the current task
      if (data.parentId === task.id || data.parentId === task.dbId) {
        setSubtasks(prev => {
          const index = prev.findIndex(s => s.dbId === data.id || s.id === data.id);
          if (index !== -1) {
            const updatedSubtasks = [...prev];
            // Determine status based on returned stateId/status (simplification)
            const isDone = data.State ? data.State.group === 'completed' : (data.status === 'done' || data.status === 'completed'); 
            let newStatus = updatedSubtasks[index].status;
            if (data.State) {
                if (data.State.group === 'unstarted') newStatus = 'pending';
                if (data.State.group === 'started') newStatus = 'working';
                if (data.State.group === 'completed') newStatus = 'done';
            } else if (data.status) {
                newStatus = data.status;
            }

            updatedSubtasks[index] = { 
              ...updatedSubtasks[index], 
              title: data.title || updatedSubtasks[index].title,
              isDone: isDone,
              status: newStatus,
              priority: data.priority || updatedSubtasks[index].priority,
              assignee: data.assigneeId || updatedSubtasks[index].assignee
            };
            return updatedSubtasks;
          }
          // New subtask added by someone else
          return [...prev, { 
            id: data.id, 
            dbId: data.id, 
            title: data.title, 
            isDone: false,
            priority: data.priority,
            assignee: data.assigneeId
          }];
        });
      }
    };
    
    socket.on('issue_updated', handleIssueUpdated);
    
    return () => {
      socket?.off('issue_updated', handleIssueUpdated);
      socket?.disconnect();
    };
  }, [task.id, task.dbId]);

  const logActivity = (actionText: string) => {
    let currentUser = 'Lê Quang Minh';
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('st_user');
      if (storedUser) {
        try {
          currentUser = JSON.parse(storedUser).fullName || currentUser;
        } catch {}
      }
    }
    
    const now = new Date();
    const timeStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    setActivities(prev => {
      const newAct = {
        id: `act-${Date.now()}`,
        user: currentUser,
        action: actionText,
        timestamp: timeStr
      };
      const updated = [newAct, ...prev];
      if (typeof window !== 'undefined') {
        localStorage.setItem(`task_activities_${task.id}`, JSON.stringify(updated));
      }
      return updated;
    });
  };

  const handleTaskUpdate = (updatedFields: Partial<Task>) => {
    if (updatedFields.status !== undefined && updatedFields.status !== task.status) {
      logActivity(`Đã chuyển trạng thái từ "${task.status}" sang "${updatedFields.status}"`);
    }
    if (updatedFields.assignee !== undefined && updatedFields.assignee !== task.assignee) {
      logActivity(`Thay đổi người phụ trách thành "${updatedFields.assignee}"`);
    }
    if (updatedFields.priority !== undefined && updatedFields.priority !== task.priority) {
      logActivity(`Cập nhật độ ưu tiên từ "${task.priority}" sang "${updatedFields.priority}"`);
    }
    if (updatedFields.estimate !== undefined && updatedFields.estimate !== task.estimate) {
      logActivity(`Cập nhật thời gian ước tính thành ${updatedFields.estimate}h`);
    }
    if (updatedFields.deadline !== undefined && updatedFields.deadline !== task.deadline) {
      logActivity(`Cập nhật hạn chót thành ${updatedFields.deadline}`);
    }
    
    onUpdate({ ...task, ...updatedFields });
  };

  // Tải danh sách checklist từ localStorage khi mở task và merge với subtasks từ DB (AI tạo)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const dbItems = task.subtasks || [];
      let localItems: SubTask[] = [];
      const saved = localStorage.getItem(`subtasks_checklist_${task.id}`);
      if (saved) {
        try {
          localItems = JSON.parse(saved);
        } catch (e) {}
      }
      
      if (dbItems.length === 0 && localItems.length === 0) {
        setSubtasks([]);
        return;
      }

      // Merge: ưu tiên giữ trạng thái isDone của local, nhưng bổ sung các item mới từ DB
      const mergedMap = new Map<string, SubTask>();
      localItems.forEach(item => mergedMap.set(item.id, item));
      
      dbItems.forEach(item => {
        if (mergedMap.has(item.id)) {
          // Update title if DB changed, but keep local isDone state
          const existing = mergedMap.get(item.id)!;
          mergedMap.set(item.id, { ...existing, title: item.title });
        } else {
          // New subtask from DB (e.g. AI generated)
          mergedMap.set(item.id, item);
        }
      });
      const currentMergedMap = Array.from(mergedMap.values());
      setSubtasks(currentMergedMap);
    }
  }, [task.id, task.subtasks]);

  // Lưu danh sách checklist vào localStorage khi thay đổi
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`subtasks_checklist_${task.id}`, JSON.stringify(subtasks));
    }
  }, [subtasks, task.id]);

  const col = getMemberColor(task.assignee);

  const handleAddSubtask = async (title: string) => {
    if (!title.trim()) return;
    
    const tempId = `sub-${Date.now()}`;
    const newSub: SubTask = {
      id: tempId,
      title: title.trim(),
      isDone: false
    };
    
    setSubtasks([...subtasks, newSub]);
    
    try {
      const response = await coreApiClient.post(API_ROUTES.PLANE.ISSUES, {
        title: title.trim(),
        parentId: task.dbId || task.id,
        projectId: task.projectId,
        priority: 'medium'
      });
      
      if ((response.success || response.status === 'success') && response.data) {
        const realId = response.data.id;
        const mappedSub = { ...newSub, id: realId, dbId: realId };
        
        setSubtasks(prev => prev.map(s => s.id === tempId ? mappedSub : s));
        handleTaskUpdate({ subtasks: [...subtasks, mappedSub] });
      }
    } catch (err) {
      console.error("Lỗi tạo Subtask lên Plane DB:", err);
      setSubtasks(prev => prev.filter(s => s.id !== tempId));
    }
  };

  const toggleSubtask = (id: string) => {
    const sub = subtasks.find(s => s.id === id);
    if (!sub) return;
    handleUpdateSubtaskStatus(id, sub.isDone ? 'pending' : 'done');
  };

  const handleUpdateSubtaskStatus = async (id: string, newStatus: string) => {
    const isDone = newStatus === 'done' || newStatus === 'completed';
    const newSubtasks = subtasks.map(s => s.id === id ? { ...s, isDone, status: newStatus } : s);
    setSubtasks(newSubtasks);
    
    const sub = subtasks.find(s => s.id === id);
    if (sub && (sub.dbId || sub.id.length > 20)) { // Assuming dbId exists or id is UUID
      try {
        await coreApiClient.patch(`${API_ROUTES.PLANE.ISSUES}/${sub.dbId || sub.id}`, { status: newStatus });
      } catch (err) {
        console.error("Failed to update subtask status", err);
      }
    }
    
    // Call handleTaskUpdate AFTER the API request completes to prevent race conditions with fetchDbData()
    handleTaskUpdate({ subtasks: newSubtasks });
  };

  const addNote = () => {
    if (!newNote.trim()) return;
    setNotes([...notes, { id: `n-${Date.now()}`, text: newNote.trim(), author: 'Bạn', time: 'Vừa xong' }]);
    setNewNote('');
  };

  const addLink = () => {
    if (!newLink.trim()) return;
    setAttachments([...attachments, { id: `at-${Date.now()}`, type: 'link', label: newLinkLabel.trim() || newLink, url: newLink }]);
    setNewLink('');
    setNewLinkLabel('');
  };

  const handleAIBreakdown = async () => {
    setAiLoading(true);
    try {
      const res = await fetchAxios('/api/ai/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: task.title,
          description: task.description || '',
          config: omniConfig
        })
      });
      if (res.ok) {
        const json = await res.json();
        // API trả về mảng {id, title, isDone} hoặc {title}
        const rawList = json.data?.subtasks || json.subtasks || [];
        if (Array.isArray(rawList) && rawList.length > 0) {
          const titles = rawList.map((s: any) =>
            typeof s === 'string' ? s : (s.title || s.name || '')
          ).filter(Boolean);

          // Save to DB immediately
          let finalUiList: SubTask[] = [];
          if (task.dbId || task.id) {
            const promises = titles.map(async (title: string, idx: number) => {
              try {
                const res: any = await coreApiClient.post(API_ROUTES.PLANE.ISSUES, {
                  title: title,
                  parentId: task.dbId || task.id,
                  projectId: task.projectId,
                  priority: 'medium'
                });
                if (res.success || res.status === 'success') {
                  return {
                    id: res.data.id,
                    dbId: res.data.id,
                    title,
                    isDone: false,
                    status: 'pending'
                  };
                }
              } catch (e) {
                console.error("Failed to save AI subtask to DB", e);
              }
              // Fallback if failed
              return {
                id: `sub-ai-${Date.now()}-${idx}`,
                title,
                isDone: false,
                status: 'pending'
              };
            });
            
            finalUiList = await Promise.all(promises);
          } else {
             finalUiList = titles.map((title: string, idx: number) => ({
                id: `sub-ai-${Date.now()}-${idx}`,
                title,
                isDone: false,
                status: 'pending'
             }));
          }

          setSubtasks([...subtasks, ...finalUiList]);
          
          try {
            handleTaskUpdate({ subtasks: [...subtasks, ...finalUiList] });
          } catch (e) { /* silent fail */ }
          
          logActivity(`Đã tạo ${finalUiList.length} subtask bằng AI.`);
          if (json.log && onAddRoutingLog) {
            onAddRoutingLog(json.log, task.title.length * 0.75 + 1800);
          }
        }
      }
    } catch (err) {
      console.error('AI Breakdown error:', err);
    }
    setAiLoading(false);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="glass modal-content" style={{ width: 850, height: 660, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Header modal */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#71717a', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 4 }}>{task.id}</span>
                <span className={`badge ${getStatusClass(task.status)}`} style={{ fontSize: 10 }}>{task.status}</span>
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fafafa', margin: 0 }}>{task.title}</h2>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', padding: 4 }}>
              <X size={18} />
            </button>
          </div>

          {/* Status Pipeline Step Tracker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255, 255, 255, 0.02)', padding: '5px 8px', borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.04)', width: 'fit-content' }}>
              {(['Backlog', 'Todo', 'In Progress', 'In Review', 'Done'] as TaskStatus[]).map((status, index, arr) => {
                const isActive = task.status === status;
                const isPassed = arr.indexOf(task.status) >= index;
                const isBlocked = task.status === 'In Review' && status === 'Done' && !isAdmin;
                return (
                  <React.Fragment key={status}>
                    <button
                      onClick={() => {
                        if (isBlocked) { alert('⚠️ Chỉ Admin mới có thể duyệt task sang Done.'); return; }
                        if (status === 'In Review' && task.status === 'In Progress') { setShowSubmitPanel(true); return; }
                        handleTaskUpdate({ status });
                      }}
                      style={{ padding: '5px 10px', fontSize: '11px', fontWeight: 600, borderRadius: '6px', border: 'none', background: isActive ? 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' : 'transparent', color: isActive ? '#ffffff' : isPassed ? '#22c55e' : isBlocked ? '#52525b' : '#71717a', cursor: isBlocked ? 'not-allowed' : 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      {isPassed && !isActive && <Check size={11} color="#22c55e" />}
                      {isBlocked && '🔒'} {status}
                    </button>
                    {index < arr.length - 1 && (<span style={{ color: '#3f3f46', fontSize: '11px', userSelect: 'none' }}>➔</span>)}
                  </React.Fragment>
                );
              })}
            </div>

            <TaskReviewPanel
              task={task}
              isAdmin={isAdmin}
              activeUser={activeUser}
              onSubmitForReview={onSubmitForReview}
              onReviewDecision={onReviewDecision}
              onRefresh={onRefresh}
              onClose={onClose}
              showSubmitPanel={showSubmitPanel}
              onOpenSubmitPanel={setShowSubmitPanel}
            />
          </div>
        </div>

        {/* Body modal: 2 cột */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', overflow: 'hidden' }}>
          
          {/* CỘT TRÁI: CHI TIẾT & TAB NỘI DUNG */}
          <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', overflowY: 'auto' }}>
            {/* Menu Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.015)' }}>
              {[
                { id: 'subtasks', label: `📌 Subtasks (${subtasks.length})` },
                { id: 'notes', label: `💬 Bình luận (${notes.length})` },
                { id: 'attachments', label: `📎 Tài liệu & Kết quả (${attachments.length})` },
                { id: 'activities', label: '⏳ Lịch sử' }
              ].map(sec => (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id as any)}
                  style={{
                    flex: 1,
                    padding: '14px 10px',
                    fontSize: '12px',
                    fontWeight: activeSection === sec.id ? 600 : 500,
                    border: 'none',
                    borderBottom: activeSection === sec.id ? '3px solid #818cf8' : '3px solid transparent',
                    background: 'transparent',
                    color: activeSection === sec.id ? '#ffffff' : '#a1a1aa',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {sec.label}
                </button>
              ))}
            </div>

            {/* Tab content area */}
            <div style={{ padding: 24, flex: 1 }}>
              
              {/* SUBTASKS */}
              {activeSection === 'subtasks' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Danh sách Checklist</span>
                    <button
                      onClick={handleAIBreakdown}
                      disabled={aiLoading}
                      className="btn-primary"
                      style={{
                        padding: '6px 12px',
                        fontSize: 10,
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        background: 'linear-gradient(135deg, #a78bfa 0%, #6366f1 100%)',
                        border: 'none',
                        color: 'white',
                        fontWeight: 600,
                        cursor: aiLoading ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <span>🤖</span> {aiLoading ? 'AI Đang phân rã...' : 'Phân rã nhanh bằng AI'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {subtasks.map(sub => (
                      <div key={sub.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-muted)', borderRadius: 10, border: '1px solid var(--border)', gap: 12 }}>
                        
                        {/* Checkbox & Title */}
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1, minWidth: 0 }}>
                          <input
                            type="checkbox"
                            checked={sub.isDone || sub.status === 'done' || sub.status === 'completed'}
                            onChange={(e) => handleUpdateSubtaskStatus(sub.id, e.target.checked ? 'done' : 'pending')}
                            style={{ width: 14, height: 14, accentColor: '#6366f1', flexShrink: 0 }}
                          />
                          <span style={{ fontSize: 13, color: (sub.isDone || sub.status === 'done' || sub.status === 'completed' || sub.status === 'cancelled') ? '#71717a' : '#fafafa', textDecoration: (sub.isDone || sub.status === 'done' || sub.status === 'completed' || sub.status === 'cancelled') ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub.title}</span>
                        </label>
                        
                        {/* Assignee, Priority, Deadline Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          
                          {/* Priority */}
                          <select
                             value={sub.priority || 'Medium'}
                             onChange={(e) => {
                               const p = e.target.value as Priority;
                               const newSubs = subtasks.map(s => s.id === sub.id ? { ...s, priority: p } : s);
                               setSubtasks(newSubs);
                               if (sub.dbId) coreApiClient.patch(`${API_ROUTES.PLANE.ISSUES}/${sub.dbId}`, { priority: p.toLowerCase() }).catch(() => {});
                               handleTaskUpdate({ subtasks: newSubs });
                             }}
                             style={{ fontSize: 10, padding: '2px 4px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: sub.priority === 'Urgent' ? '#ef4444' : sub.priority === 'High' ? '#f97316' : '#a1a1aa', outline: 'none', cursor: 'pointer' }}
                          >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Urgent">Urgent</option>
                          </select>

                          {/* Assignee */}
                          <select
                            value={sub.assignee || ''}
                            onChange={(e) => {
                               const a = e.target.value;
                               const newSubs = subtasks.map(s => s.id === sub.id ? { ...s, assignee: a } : s);
                               setSubtasks(newSubs);
                               if (sub.dbId) coreApiClient.patch(`${API_ROUTES.PLANE.ISSUES}/${sub.dbId}`, { assigneeId: a }).catch(() => {}); // Note: Requires mapping name to member ID on backend if needed, but standard behavior sends string name for now
                               handleTaskUpdate({ subtasks: newSubs });
                            }}
                            style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: sub.assignee ? getMemberColor(sub.assignee) : '#71717a', outline: 'none', cursor: 'pointer', maxWidth: 90 }}
                          >
                            <option value="">👤 Assign</option>
                            {teamMembers.map(m => (
                              <option key={m.id} value={m.name}>{m.name.split(' ').pop()}</option>
                            ))}
                          </select>
                          
                          {/* Status */}
                          <select 
                             value={sub.status || (sub.isDone ? 'done' : 'pending')}
                             onChange={(e) => handleUpdateSubtaskStatus(sub.id, e.target.value)}
                             style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: sub.status === 'done' ? 'rgba(34,197,94,0.2)' : sub.status === 'working' ? 'rgba(99,102,241,0.2)' : 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: sub.status === 'done' ? '#4ade80' : sub.status === 'working' ? '#818cf8' : '#fafafa', outline: 'none', cursor: 'pointer', fontWeight: 500 }}
                          >
                            <option value="pending">Todo</option>
                            <option value="working">In Progress</option>
                            <option value="in_review">In Review</option>
                            <option value="done">Done</option>
                            <option value="cancelled">Huỷ</option>
                          </select>
                        </div>
                      </div>
                    ))}
                    {subtasks.length === 0 && (
                      <div style={{ textAlign: 'center', color: '#52525b', padding: '40px 0', fontSize: 12 }}>
                        Chưa có subtask. Bấm nút *Phân rã nhanh bằng AI* để tự động phân rã công việc hoặc thêm thủ công bên dưới.
                      </div>
                    )}
                  </div>

                  {/* Add manual subtask */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <input
                      id="new-subtask-input"
                      type="text"
                      className="input-dark"
                      placeholder="Thêm subtask thủ công..."
                      style={{ flex: 1, padding: '6px 12px', fontSize: 12, borderRadius: 8 }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const el = document.getElementById('new-subtask-input') as HTMLInputElement;
                          if (el) {
                            handleAddSubtask(el.value);
                            el.value = '';
                          }
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        const el = document.getElementById('new-subtask-input') as HTMLInputElement;
                        if (el && el.value.trim()) {
                          handleAddSubtask(el.value);
                          el.value = '';
                        }
                      }}
                      className="btn-primary"
                      style={{ padding: '6px 12px', borderRadius: 8 }}
                    >
                      Thêm
                    </button>
                  </div>
                </div>
              )}

              {/* NOTES */}
              {activeSection === 'notes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 250, overflowY: 'auto', paddingRight: 6 }}>
                    {notes.map(n => (
                      <div key={n.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--bg-muted)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#71717a' }}>
                          <span style={{ fontWeight: 600, color: '#fafafa' }}>{n.author}</span>
                          <span>{n.time}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: '#d4d4d8', lineHeight: 1.4 }}>{n.text}</p>
                      </div>
                    ))}
                  </div>
                  
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <input
                      type="text"
                      className="input-dark"
                      placeholder="Viết bình luận..."
                      value={newNote}
                      onChange={e => setNewNote(e.target.value)}
                      style={{ flex: 1, padding: '6px 12px', fontSize: 12, borderRadius: 8 }}
                      onKeyDown={e => { if (e.key === 'Enter') addNote(); }}
                    />
                    <button onClick={addNote} className="btn-primary" style={{ padding: '6px 14px', borderRadius: 8 }}>Gửi</button>
                  </div>
                </div>
              )}

              {/* RESOURCES (ATTACHMENTS & GIT COMMITS & CONTENT) */}
              {activeSection === 'resources' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxHeight: 380, overflowY: 'auto', paddingRight: 6 }}>
                  
                  {/* Task Content / Description */}
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 10 }}>📝 Nội dung Task</span>
                    <textarea
                      className="input-dark"
                      placeholder="Nhập nội dung chi tiết của task..."
                      value={taskDescription}
                      onChange={(e) => setTaskDescription(e.target.value)}
                      onBlur={() => {
                        if (taskDescription !== task.description) {
                          handleTaskUpdate({ description: taskDescription });
                        }
                      }}
                      style={{ width: '100%', minHeight: 80, padding: '10px', fontSize: 12, borderRadius: 8, resize: 'vertical' }}
                    />
                  </div>

                  {/* Task Output */}
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 10 }}>🎯 Output dự kiến</span>
                    <textarea
                      className="input-dark"
                      placeholder="Nhập kết quả đầu ra (output) yêu cầu..."
                      value={taskOutput}
                      onChange={(e) => setTaskOutput(e.target.value)}
                      onBlur={() => {
                        if (taskOutput !== task.outputSuggested) {
                          handleTaskUpdate({ outputSuggested: taskOutput });
                        }
                      }}
                      style={{ width: '100%', minHeight: 60, padding: '10px', fontSize: 12, borderRadius: 8, resize: 'vertical' }}
                    />
                  </div>
                  
                  <div style={{ borderBottom: '1px solid var(--border)', margin: '4px 0' }} />

                  {/* Attachments Section */}
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 10 }}>📎 Tài liệu liên kết</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                      {attachments.map(at => (
                        <a key={at.id} href={at.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-muted)', borderRadius: 10, border: '1px solid var(--border)', textDecoration: 'none', color: '#fafafa' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 16 }}>🔗</span>
                            <div>
                              <span style={{ fontSize: 12, fontWeight: 600, display: 'block' }}>{at.label}</span>
                              <span style={{ fontSize: 10, color: '#71717a' }}>{at.url}</span>
                            </div>
                          </div>
                          <span style={{ fontSize: 11, color: '#a78bfa' }}>Mở liên kết ↗</span>
                        </a>
                      ))}
                      {attachments.length === 0 && (
                        <p style={{ fontSize: 12, color: '#52525b', margin: '4px 0 10px' }}>Chưa có tài liệu nào được liên kết.</p>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexDirection: 'column', background: 'rgba(255,255,255,0.01)', padding: 12, borderRadius: 10, border: '1px dashed var(--border)' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          id="new-link-label"
                          type="text"
                          className="input-dark"
                          placeholder="Tên tài liệu (Figma, PRD...)"
                          value={newLinkLabel}
                          onChange={e => setNewLinkLabel(e.target.value)}
                          style={{ flex: 1, padding: '6px 12px', fontSize: 12, borderRadius: 8 }}
                        />
                        <input
                          id="new-link-url"
                          type="text"
                          className="input-dark"
                          placeholder="Đường dẫn (https://...)"
                          value={newLink}
                          onChange={e => setNewLink(e.target.value)}
                          style={{ flex: 1.5, padding: '6px 12px', fontSize: 12, borderRadius: 8 }}
                        />
                      </div>
                      <button 
                        onClick={() => {
                          if (!newLink.trim()) return;
                          const label = newLinkLabel.trim() || newLink;
                          logActivity(`Đã liên kết tài liệu: "${label}"`);
                          setAttachments([...attachments, { id: `at-${Date.now()}`, type: 'link', label, url: newLink }]);
                          setNewLink('');
                          setNewLinkLabel('');
                        }} 
                        className="btn-primary" 
                        style={{ padding: '6px 12px', borderRadius: 8, alignSelf: 'flex-end', fontSize: 11 }}
                      >
                        Liên kết tài liệu
                      </button>
                    </div>
                  </div>

                  <div style={{ borderBottom: '1px solid var(--border)', margin: '4px 0' }} />

                  {/* Git Commits Section */}
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 10 }}>💻 Git Commits liên kết</span>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <input
                        type="text"
                        className="input-dark"
                        placeholder="Mã commit hoặc commit message..."
                        value={commitInput}
                        onChange={e => setCommitInput(e.target.value)}
                        style={{ flex: 1, padding: '6px 12px', fontSize: 12, borderRadius: 8 }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && commitInput.trim()) {
                            logActivity(`Đã liên kết Git Commit: "${commitInput.trim()}"`);
                            handleTaskUpdate({ commits: [...(task.commits || []), commitInput.trim()] });
                            setCommitInput('');
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          if (commitInput.trim()) {
                            logActivity(`Đã liên kết Git Commit: "${commitInput.trim()}"`);
                            handleTaskUpdate({ commits: [...(task.commits || []), commitInput.trim()] });
                            setCommitInput('');
                          }
                        }}
                        className="btn-primary"
                        style={{ padding: '6px 14px', borderRadius: 8, fontSize: 11, whiteSpace: 'nowrap' }}
                      >
                        Liên kết Commit
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(task.commits || []).map((com, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 10 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Globe size={13} color="#818cf8" />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: '#fafafa', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{com}</div>
                            <div style={{ fontSize: 10, color: '#52525b' }}>commit SHA: {Math.random().toString(16).substring(2, 9)} · main branch</div>
                          </div>
                          <button
                            onClick={() => {
                              alert(`[CODE DIFF SIMULATION]\n\nShowing diff for: ${com}\n\n- src/app/page.tsx (L134-142)\n+ src/app/page.tsx (L134-146)\n\nReviewer: AI Assistant. Code meets quality standards!`);
                            }}
                            className="btn-ghost"
                            style={{ fontSize: 10, color: '#a78bfa', padding: '4px 8px', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 6, cursor: 'pointer' }}
                          >
                            Xem diff
                          </button>
                        </div>
                      ))}
                      {(task.commits || []).length === 0 && (
                        <p style={{ fontSize: 12, color: '#52525b', textAlign: 'center', padding: '10px 0' }}>Chưa có Git Commit nào được liên kết.</p>
                      )}
                    </div>
                  </div>

                </div>
              )}

              {/* ACTIVITIES (HISTORIES) */}
              {activeSection === 'activities' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 380, overflowY: 'auto', paddingRight: 6 }}>
                  {activities.map(act => (
                    <div key={act.id} style={{ display: 'flex', gap: 10, fontSize: 12, color: '#a1a1aa', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: 8 }}>
                      <span style={{ fontSize: 11, color: '#71717a', width: 110, fontFamily: 'monospace', flexShrink: 0 }}>{act.timestamp}</span>
                      <strong style={{ color: '#fafafa', flexShrink: 0 }}>{act.user}</strong>
                      <span style={{ flex: 1 }}>{act.action}</span>
                    </div>
                  ))}
                  {activities.length === 0 && (
                    <p style={{ fontSize: 12, color: '#52525b', textAlign: 'center', padding: 20 }}>Chưa ghi nhận hoạt động nào trên task này.</p>
                  )}
                </div>
              )}

            </div>
          </div>

          {/* CỘT PHẢI: METADATA & PHÂN BỔ */}
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, background: 'rgba(255,255,255,0.01)', overflowY: 'auto', minWidth: 0 }}>
            
            {/* Project */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, width: '100%' }}>
              <span style={{ fontSize: 10, color: '#71717a', textTransform: 'uppercase', fontWeight: 600 }}>Dự án</span>
              <select
                value={task.projectId || 'default_no_project'}
                onChange={e => handleTaskUpdate({ projectId: e.target.value })}
                style={{
                  background: 'var(--bg-muted)',
                  border: '1px solid var(--border)',
                  color: '#fafafa',
                  fontSize: 13,
                  fontWeight: 500,
                  padding: '6px 10px',
                  borderRadius: 8,
                  outline: 'none',
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, width: '100%' }}>
              <span style={{ fontSize: 10, color: '#71717a', textTransform: 'uppercase', fontWeight: 600 }}>Người phụ trách</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, width: '100%' }}>
                <div className="avatar" style={{ background: col + '30', color: col, width: 28, height: 28, fontSize: 11, flexShrink: 0 }}>
                  {getInitials(task.assignee)}
                </div>
                <select
                  value={task.assignee}
                  onChange={e => handleTaskUpdate({ assignee: e.target.value })}
                  style={{
                    background: 'var(--bg-muted)',
                    border: '1px solid var(--border)',
                    color: '#fafafa',
                    fontSize: 13,
                    fontWeight: 500,
                    padding: '6px 10px',
                    borderRadius: 8,
                    outline: 'none',
                    cursor: 'pointer',
                    flex: 1,
                    minWidth: 0,
                    maxWidth: 'calc(100% - 38px)'
                  }}
                >
                  {teamMembers.map(m => (
                    <option key={m.id} value={m.name}>{m.name} ({m.role.split(' - ')[0]})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Status */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#71717a', textTransform: 'uppercase', fontWeight: 600 }}>Trạng thái</span>
              <select
                value={task.status}
                onChange={e => {
                  const val = e.target.value as any;
                  if (val === 'Done' && !isAdmin) {
                    // Tự động chuyển sang In Review thay vì block
                    handleTaskUpdate({ status: 'In Review' });
                    setTimeout(() => alert('ℹ️ Đã chuyển sang "In Review".\nVui lòng nộp kết quả trong tab bên trái để Admin duyệt.'), 100);
                    return;
                  }
                  handleTaskUpdate({ status: val });
                }}
                style={{
                  background: 'var(--bg-muted)',
                  border: '1px solid var(--border)',
                  color: '#fafafa',
                  fontSize: 13,
                  fontWeight: 500,
                  padding: '6px 10px',
                  borderRadius: 8,
                  outline: 'none',
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                <option value="Backlog">Backlog</option>
                <option value="Todo">Todo</option>
                <option value="In Progress">In Progress</option>
                <option value="In Review">In Review</option>
                <option value="Done">Done</option>
              </select>
            </div>

            {/* Priority */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#71717a', textTransform: 'uppercase', fontWeight: 600 }}>Độ ưu tiên</span>
              <select
                value={task.priority}
                onChange={e => handleTaskUpdate({ priority: e.target.value as any })}
                style={{
                  background: 'var(--bg-muted)',
                  border: '1px solid var(--border)',
                  color: '#fafafa',
                  fontSize: 13,
                  fontWeight: 500,
                  padding: '6px 10px',
                  borderRadius: 8,
                  outline: 'none',
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            {/* Estimate */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#71717a', textTransform: 'uppercase', fontWeight: 600 }}>Thời gian ước tính (Hours)</span>
              <input
                type="number"
                className="input-dark"
                value={task.estimate}
                onChange={e => handleTaskUpdate({ estimate: Math.max(0, parseInt(e.target.value) || 0) })}
                style={{ padding: '6px 12px', fontSize: 13, borderRadius: 8 }}
              />
            </div>

            {/* Deadline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#71717a', textTransform: 'uppercase', fontWeight: 600 }}>Hạn chót (Deadline)</span>
              <input
                type="date"
                className="input-dark"
                value={task.deadline}
                onChange={e => handleTaskUpdate({ deadline: e.target.value })}
                style={{ padding: '6px 12px', fontSize: 13, borderRadius: 8 }}
              />
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
