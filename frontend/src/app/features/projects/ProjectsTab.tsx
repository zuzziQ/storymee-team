import React, { useState } from 'react';
import { Sparkles, Layers, Activity, Users, DollarSign, Calendar, Zap, AlertCircle, Trash2, Edit3 } from 'lucide-react';
import {
  Project, Task, TeamMember,
  renderFormattedText
} from '../../constants';
import EditProjectModal from '../shared/components/EditProjectModal';

interface ProjectsTabProps {
  projects: Project[];
  tasks: Task[];
  activeProjectId: string;
  setActiveProjectId: (id: string) => void;
  aiProjectInsights: Record<string, string>;
  aiAnalyzing: boolean;
  aiSuccessRate: Record<string, number>;
  aiPredictedDate: Record<string, string>;
  handleAnalyzeProject: (projId: string) => void;
  handleDeleteProject?: (id: string) => void;
  handleUpdateProject?: (id: string, updates: Partial<Project>) => void;
  handleCreateTask?: (title: string, assignee: string, estimate: number, priority: any) => Promise<void>;
  teamMembers: TeamMember[];
  onSelectTask?: (task: Task) => void;
  
  showAddProjectModal: boolean;
  setShowAddProjectModal: (show: boolean) => void;
  newProjectName: string;
  setNewProjectName: (name: string) => void;
  newProjectDesc: string;
  setNewProjectDesc: (desc: string) => void;
  newProjectColor: string;
  setNewProjectColor: (color: string) => void;
  handleAddProject: () => void;
}

export default function ProjectsTab({
  projects,
  tasks,
  activeProjectId,
  setActiveProjectId,
  aiProjectInsights,
  aiAnalyzing,
  aiSuccessRate,
  aiPredictedDate,
  handleAnalyzeProject,
  handleDeleteProject,
  handleUpdateProject,
  teamMembers,
  showAddProjectModal,
  setShowAddProjectModal,
  newProjectName,
  setNewProjectName,
  newProjectDesc,
  setNewProjectDesc,
  newProjectColor,
  setNewProjectColor,
  handleAddProject,
  handleCreateTask,
  onSelectTask
}: ProjectsTabProps) {
  const proj = projects.find(p => p.id === activeProjectId);
  const projTasks = proj ? tasks.filter(t => t.projectId === proj.id) : [];
  
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const doneTasks = projTasks.filter(t => t.status === 'Done');
  const inProgressTasks = projTasks.filter(t => t.status === 'In Progress');
  const todoTasks = projTasks.filter(t => t.status === 'Todo' || t.status === 'Backlog' || t.status === 'In Review');
  const totalH = projTasks.reduce((s, t) => s + t.estimate, 0);
  const pct = projTasks.length ? Math.round((doneTasks.length / projTasks.length) * 100) : 0;
  const assignees = Array.from(new Set(projTasks.map(t => t.assignee).filter(Boolean)));
  // Tính trạng thái active từ tasks (không dùng proj.status vì field này không có trong DB)
  const isProjectActive = projTasks.length === 0 || projTasks.some(t => t.status !== 'Done');

  return (
    <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 120px)', overflow: 'hidden' }}>
      {/* Left Column: Project list */}
      <div className="glass" style={{ width: 280, display: 'flex', flexDirection: 'column', padding: '16px 14px', gap: 10, overflowY: 'auto', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>Danh sách Dự án lớn</span>
          <button 
            onClick={() => setShowAddProjectModal(true)} 
            className="btn-primary" 
            style={{ padding: '4px 8px', fontSize: 10, borderRadius: 6 }}
          >
            + Dự án
          </button>
        </div>
        {projects.map(p => {
          const pTasks = tasks.filter(t => t.projectId === p.id);
          const pDone = pTasks.filter(t => t.status === 'Done').length;
          const pPct = pTasks.length ? Math.round((pDone / pTasks.length) * 100) : 0;
          return (
            <button
              key={p.id}
              onClick={() => setActiveProjectId(p.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '12px 14px',
                background: activeProjectId === p.id ? 'rgba(255,255,255,0.06)' : 'transparent',
                border: activeProjectId === p.id ? `1px solid ${p.color}50` : '1px solid rgba(255,255,255,0.04)',
                borderRadius: 12,
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                flexDirection: 'column',
                gap: 6
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: activeProjectId === p.id ? '#fafafa' : '#d4d4d8' }}>{p.name}</span>
              </div>
              <div style={{ fontSize: 11, color: '#71717a', lineHeight: 1.3 }}>{p.description.slice(0, 50)}...</div>
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#71717a', marginBottom: 2 }}>
                  <span>Tiến độ</span>
                  <span>{pPct}%</span>
                </div>
                <div className="progress-bar" style={{ height: 4 }}>
                  <div className="progress-bar-fill" style={{ width: `${pPct}%`, background: p.color }} />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Right Column: Project details & AI Dashboard */}
      {!proj ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717a' }}>
          Vui lòng chọn một dự án
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', paddingRight: 6 }}>
          {/* Project Header */}
          <div className="glass" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: proj.color }} />
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fafafa' }}>{proj.name}</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {handleUpdateProject && proj.id !== 'default_no_project' && (
                  <button
                    onClick={() => setEditingProject(proj)}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fafafa',
                      padding: '8px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Sửa dự án"
                  >
                    <Edit3 size={14} />
                  </button>
                )}
                {handleDeleteProject && proj.id !== 'default_no_project' && (
                  <button
                    onClick={() => {
                      if (window.confirm('Bạn có chắc chắn muốn xóa dự án này? Các task bên trong sẽ bị chuyển về Không thuộc dự án.')) {
                        handleDeleteProject(proj.id);
                      }
                    }}
                    style={{
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      color: '#ef4444',
                      padding: '8px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Xóa dự án"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <button
                  disabled={aiAnalyzing}
                  onClick={() => handleAnalyzeProject(proj.id)}
                  className="btn-primary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    background: 'linear-gradient(135deg, #a78bfa 0%, #6366f1 100%)',
                    border: 'none',
                    color: 'white',
                    cursor: aiAnalyzing ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Sparkles size={14} />
                  {aiAnalyzing ? 'Trợ lý AI đang quét...' : 'Quét Tiến độ bằng AI'}
                </button>
              </div>
            </div>
            <p style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.4 }}>{proj.description}</p>

            <div style={{ display: 'flex', gap: 24, marginTop: 14, flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: 10, color: '#71717a', textTransform: 'uppercase' }}>Trạng thái</span>
                <div style={{ fontSize: 14, fontWeight: 600, color: isProjectActive ? '#10b981' : '#71717a', marginTop: 2 }}>{isProjectActive ? 'Đang chạy' : 'Đã hoàn thành'}</div>
              </div>
              <div>
                <span style={{ fontSize: 10, color: '#71717a', textTransform: 'uppercase' }}>Tổng khối lượng</span>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fafafa', marginTop: 2 }}>{totalH} giờ ước tính ({projTasks.length} tasks)</div>
              </div>
              <div>
                <span style={{ fontSize: 10, color: '#71717a', textTransform: 'uppercase' }}>Cá nhân tham gia</span>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fafafa', marginTop: 2 }}>{assignees.length} thành viên</div>
              </div>
            </div>
          </div>

          {/* AI Project Insights */}
          <div className="glass" style={{ padding: '20px 24px', border: '1px solid rgba(167,139,250,0.2)', background: 'linear-gradient(135deg, rgba(167,139,250,0.02) 0%, rgba(99,102,241,0.02) 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Sparkles size={16} color="#a78bfa" />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fafafa' }}>Phân tích dự đoán tiến độ (Trợ lý AI)</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20 }}>
              <div style={{ fontSize: 13, color: '#d4d4d8', lineHeight: 1.6 }}>
                {aiProjectInsights[proj.id] ? (
                  renderFormattedText(aiProjectInsights[proj.id])
                ) : (
                  <div style={{ color: '#71717a', fontSize: 12 }}>
                    Chưa có phân tích cho dự án này. Bấm nút *Quét Tiến độ bằng AI* ở góc trên để chạy mô hình chẩn đoán rủi ro và ước tính ngày hoàn thành.
                  </div>
                )}
              </div>

              {aiProjectInsights[proj.id] && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingLeft: 20, borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="glass" style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.01)' }}>
                    <span style={{ fontSize: 10, color: '#71717a', display: 'flex', alignItems: 'center', gap: 4 }}><Activity size={10} /> Khả năng đúng hạn (AI)</span>
                    <div style={{ fontSize: 24, fontWeight: 700, color: aiSuccessRate[proj.id] >= 80 ? '#22c55e' : aiSuccessRate[proj.id] >= 60 ? '#f59e0b' : '#ef4444', marginTop: 4 }}>
                      {aiSuccessRate[proj.id]}%
                    </div>
                  </div>
                  <div className="glass" style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.01)' }}>
                    <span style={{ fontSize: 10, color: '#71717a', display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={10} /> Dự báo ngày xong (AI)</span>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#fafafa', marginTop: 4 }}>
                      {aiPredictedDate[proj.id]}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Project tasks list */}
          <div className="glass" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa', marginBottom: 14 }}>Trạng thái các đầu việc chi tiết</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {projTasks.map(t => {
                const finished = t.subtasks.filter(s => s.isDone).length;
                return (
                  <div key={t.id} onClick={() => onSelectTask && onSelectTask(t)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-muted)', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                      <span style={{ fontSize: 11, color: '#71717a', fontFamily: 'monospace', width: 55 }}>{t.id}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#fafafa' }}>{t.title}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <span style={{ fontSize: 11, color: '#a1a1aa' }}>{t.assignee}</span>
                      <span style={{ fontSize: 11, color: '#71717a' }}>{finished}/{t.subtasks.length} subtasks</span>
                      <span className={`badge ${t.status === 'Done' ? 'badge-done' : t.status === 'In Progress' ? 'badge-inprogress' : 'badge-todo'}`} style={{ fontSize: 10 }}>{t.status}</span>
                    </div>
                  </div>
                );
              })}
              {projTasks.length === 0 && (
                <div style={{ textAlign: 'center', color: '#71717a', padding: '30px 0', fontSize: 12 }}>Dự án này chưa có task nào được tạo.</div>
              )}
              
              {/* Quick Add Task */}
              {handleCreateTask && activeProjectId && (
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <input
                    type="text"
                    placeholder="Nhập tên task mới..."
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.nativeEvent.isComposing) return;
                      if (e.key === 'Enter' && newTaskTitle.trim()) {
                        handleCreateTask(newTaskTitle.trim(), 'Chưa phân công', 4, 'Medium');
                        setNewTaskTitle('');
                      }
                    }}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-muted)', color: '#fafafa', fontSize: 13 }}
                  />
                  <button 
                    className="btn btn-primary"
                    style={{ padding: '0 16px', fontSize: 12, borderRadius: 6 }}
                    onClick={() => {
                      if (newTaskTitle.trim()) {
                        handleCreateTask(newTaskTitle.trim(), 'Chưa phân công', 4, 'Medium');
                        setNewTaskTitle('');
                      }
                    }}
                  >
                    Tạo Task
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Project Modal */}
      {showAddProjectModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass modal-content" style={{ width: 450, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fafafa' }}>Tạo dự án lớn mới</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, color: '#a1a1aa' }}>Tên dự án</label>
              <input 
                value={newProjectName} 
                onChange={e => setNewProjectName(e.target.value)} 
                type="text" 
                placeholder="Nhập tên dự án..." 
                style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: 8, color: 'white', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, color: '#a1a1aa' }}>Mô tả ngắn</label>
              <textarea 
                value={newProjectDesc} 
                onChange={e => setNewProjectDesc(e.target.value)} 
                rows={3} 
                placeholder="Nhập mô tả dự án..." 
                style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: 8, color: 'white', outline: 'none', resize: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, color: '#a1a1aa' }}>Màu sắc nhận diện</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input 
                  type="color" 
                  value={newProjectColor} 
                  onChange={e => setNewProjectColor(e.target.value)} 
                  style={{ width: 40, height: 30, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                />
                <span style={{ fontSize: 12, color: '#71717a' }}>Màu biểu thị tiến độ trên biểu đồ và Kanban</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <button 
                onClick={() => setShowAddProjectModal(false)} 
                className="btn-ghost" 
                style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, border: 'none', color: '#71717a', cursor: 'pointer' }}
              >
                Hủy
              </button>
              <button 
                onClick={handleAddProject} 
                className="btn-primary" 
                style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', color: 'white', cursor: 'pointer' }}
              >
                Tạo dự án
              </button>
            </div>
          </div>
        </div>
      )}

      {editingProject && handleUpdateProject && (
        <EditProjectModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onUpdateProject={handleUpdateProject}
        />
      )}
    </div>
  );
}
