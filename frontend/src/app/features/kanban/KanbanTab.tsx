import React, { useState } from 'react';
import { Clock, GripVertical, Trash2, Archive } from 'lucide-react';
import {
  Task, Project, TaskStatus,
  getPriorityDot, getStatusClass, getMemberColor, getInitials
} from '../../constants';

// ===================== KANBAN CARD =====================
function TaskCard({
  task, onClick, onDragStart, onDragEnd, projects, isAdmin, activeUserEmail, onArchiveDirect, onRequestArchive
}: {
  task: Task;
  onClick: () => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  projects: Project[];
  isAdmin: boolean;
  activeUserEmail: string;
  onArchiveDirect: (task: Task) => void;
  onRequestArchive: (task: Task) => void;
}) {
  const [canDrag, setCanDrag] = useState(false);
  const [hovered, setHovered] = useState(false);
  const done = task.subtasks.filter(s => s.isDone).length;
  const col = getMemberColor(task.assignee);
  const proj = projects.find(p => p.id === task.projectId);
  return (
    <div
      draggable={canDrag}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        onDragStart(task.id);
      }}
      onDragEnd={() => {
        setCanDrag(false);
        onDragEnd();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); if (canDrag) setCanDrag(false); }}
      className="glass glass-hover"
      style={{
        padding: '8px 10px',
        marginBottom: 8,
        cursor: canDrag ? 'grabbing' : 'default',
        position: 'relative',
        transition: 'all 0.2s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {/* Drag Handle */}
          <div
            onMouseDown={() => setCanDrag(true)}
            style={{
              cursor: 'grab',
              padding: '2px',
              borderRadius: 4,
              color: '#71717a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.05)',
            }}
            title="Kéo để di chuyển"
          >
            <GripVertical size={13} />
          </div>

          <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0 }} className={getPriorityDot(task.priority)} />
          <span style={{ fontSize: 10, color: '#71717a', fontFamily: 'monospace' }}>{task.id}</span>
          
          {proj && (
            <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: proj.color + '15', color: proj.color, border: `1px solid ${proj.color}30`, fontWeight: 500 }} title={proj.name}>
              {proj.name.length > 15 ? proj.name.slice(0, 15) + '...' : proj.name}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Action buttons (shown on hover) */}
          {hovered && (
            isAdmin ? (
              <button
                onClick={(e) => { e.stopPropagation(); onArchiveDirect(task); }}
                title="Lưu trữ task (Admin)"
                style={{
                  padding: '2px 5px', borderRadius: 4, border: 'none', cursor: 'pointer',
                  background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
                  display: 'flex', alignItems: 'center', gap: 2, fontSize: 9, fontWeight: 600
                }}
              >
                <Archive size={10} /> Lưu trữ
              </button>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); onRequestArchive(task); }}
                title="Yêu cầu archive task (chờ Admin duyệt)"
                style={{
                  padding: '2px 5px', borderRadius: 4, border: 'none', cursor: 'pointer',
                  background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
                  display: 'flex', alignItems: 'center', gap: 2, fontSize: 9, fontWeight: 600
                }}
              >
                <Archive size={10} /> Archive
              </button>
            )
          )}
          <span style={{ fontSize: 10, color: '#71717a', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Clock size={10} />{task.deadline ? task.deadline.replace('T', ' ') : ''}
          </span>
        </div>
      </div>
      
      {/* Click vào phần thân card để mở popup */}
      <div onClick={onClick} style={{ cursor: 'pointer' }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#fafafa', marginBottom: 6, lineHeight: 1.4 }}>{task.title}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="avatar" style={{ background: col + '30', color: col, width: 20, height: 20, fontSize: 9 }}>
              {getInitials(task.assignee)}
            </div>
            <span style={{ fontSize: 10, color: '#a1a1aa' }}>{task.assignee}</span>
          </div>
          {task.subtasks.length > 0 && (
            <span style={{ fontSize: 10, color: '#52525b' }}>{done}/{task.subtasks.length}</span>
          )}
        </div>
        {task.subtasks.length > 0 && (
          <div className="progress-bar" style={{ marginTop: 6, height: 4 }}>
            <div className="progress-bar-fill" style={{ width: `${(done/task.subtasks.length)*100}%`, background: done === task.subtasks.length ? '#22c55e' : '#6366f1' }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ===================== KANBAN TAB =====================
const KANBAN_COLS: TaskStatus[] = ['Backlog', 'Todo', 'In Progress', 'In Review', 'Done'];

interface KanbanTabProps {
  filteredTasks: Task[];
  projects: Project[];
  setSelectedTask: (task: Task) => void;
  onUpdateTask: (task: Task) => void;
  isAdmin: boolean;
  activeUserEmail: string;
  onArchiveTaskDirect: (task: Task) => void;
  onRequestArchive: (task: Task) => void;
  handleUpdateTaskStatus?: (id: string, status: string) => void;
  handleCreateTask?: (title: string, assignee: string, estimate: number, priority: any, status?: string) => Promise<void> | void;
}


export default function KanbanTab({
  filteredTasks,
  projects,
  setSelectedTask,
  onUpdateTask,
  isAdmin,
  activeUserEmail,
  onArchiveTaskDirect,
  onRequestArchive,
  handleCreateTask
}: KanbanTabProps) {
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [creatingInCol, setCreatingInCol] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const handleDragStart = (id: string) => {
    setDraggingId(id);
  };

  const handleDragOver = (e: React.DragEvent, col: string) => {
    e.preventDefault();
    setDragOverCol(col);
  };

  const handleDrop = (col: TaskStatus) => {
    if (!draggingId) return;
    const targetTask = filteredTasks.find(t => t.id === draggingId);
    if (targetTask) {
      if (col === 'Done' && !isAdmin) {
        // Tự động chuyển sang In Review thay vì block
        onUpdateTask({ ...targetTask, status: 'In Review' });
        setTimeout(() => alert('ℹ️ Công việc đã được chuyển sang "In Review".\nVui lòng click vào task để nộp kết quả. Admin sẽ xem xét và xác nhận Done cho bạn.'), 100);
      } else {
        onUpdateTask({ ...targetTask, status: col });
      }
    }
    setDraggingId(null);
    setDragOverCol(null);
  };

  const handleRequestArchiveWithPrompt = (task: Task) => {
    const reason = window.prompt(`Lý do yêu cầu archive task ${task.id}?`, '');
    if (reason !== null) onRequestArchive(task);
  };

  const submitNewTask = (col: string) => {
    if (newTaskTitle.trim() && handleCreateTask) {
      handleCreateTask(newTaskTitle.trim(), 'Chưa phân công', 4, 'Medium', col);
    }
    setCreatingInCol(null);
    setNewTaskTitle('');
  };

  return (
    <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 16, height: '100%' }}>
      {KANBAN_COLS.map(col => {
        const colTasks = filteredTasks.filter(t => t.status === col);
        const totalH = colTasks.reduce((s, t) => s + t.estimate, 0);
        const isOver = dragOverCol === col;
        return (
          <div
            key={col}
            className="kanban-col"
            onDragOver={(e) => handleDragOver(e, col)}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={() => handleDrop(col)}
            style={{
              minWidth: 235,
              maxWidth: 280,
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              border: isOver ? '1px dashed #6366f1' : '1px solid transparent',
              background: isOver ? 'rgba(99,102,241,0.02)' : 'transparent',
              borderRadius: 12,
              transition: 'all 0.2s'
            }}
          >
            <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#fafafa' }}>{col}</span>
                <span style={{ fontSize: 11, background: 'var(--bg-muted)', color: '#71717a', padding: '1px 7px', borderRadius: 10 }}>{colTasks.length}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {handleCreateTask && (
                  <button
                    onClick={() => {
                      setCreatingInCol(col);
                      setNewTaskTitle('');
                    }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#a1a1aa', display: 'flex', alignItems: 'center',
                      padding: 4, borderRadius: 4
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                    title="Tạo Issue mới"
                  >
                    <span style={{ fontSize: 16, fontWeight: 300 }}>+</span>
                  </button>
                )}
                {totalH > 0 && <span style={{ fontSize: 10, color: '#52525b' }}>{totalH}h</span>}
              </div>
            </div>
            <div style={{ padding: '10px 10px', overflowY: 'auto', flex: 1, minHeight: 150 }}>
              {colTasks.map(t => (
                <div
                  key={t.id}
                  style={{
                    opacity: draggingId === t.id ? 0.4 : 1,
                    transition: 'opacity 0.2s'
                  }}
                >
                  <TaskCard
                    task={t}
                    onClick={() => setSelectedTask(t)}
                    onDragStart={handleDragStart}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOverCol(null);
                    }}
                    projects={projects}
                    isAdmin={isAdmin}
                    activeUserEmail={activeUserEmail}
                    onArchiveDirect={onArchiveTaskDirect}
                    onRequestArchive={handleRequestArchiveWithPrompt}
                  />
                </div>
              ))}
              {creatingInCol === col && (
                <div style={{ 
                  background: 'var(--bg-card)', padding: '10px', 
                  borderRadius: 6, border: '1px solid var(--border)', 
                  marginBottom: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                  <input
                    autoFocus
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.nativeEvent.isComposing) return;
                      if (e.key === 'Enter') submitNewTask(col);
                      if (e.key === 'Escape') setCreatingInCol(null);
                    }}
                    onBlur={() => submitNewTask(col)}
                    placeholder="Tên Issue mới..."
                    style={{
                      width: '100%', background: 'transparent', border: 'none',
                      color: '#fff', fontSize: 13, outline: 'none'
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6, gap: 4 }}>
                    <span style={{ fontSize: 10, color: '#71717a' }}>Enter để lưu, Esc để huỷ</span>
                  </div>
                </div>
              )}
              {colTasks.length === 0 && creatingInCol !== col && (
                <div style={{ textAlign: 'center', color: '#3f3f46', padding: '30px 0', fontSize: 12 }}>Không có task</div>
              )}
              
              {handleCreateTask && (
                <button
                  onClick={() => { setCreatingInCol(col); setNewTaskTitle(''); }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '8px 10px', marginTop: 4,
                    background: 'transparent', border: 'none', color: '#71717a', fontSize: 12,
                    cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: 14 }}>+</span> Thêm Issue
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
