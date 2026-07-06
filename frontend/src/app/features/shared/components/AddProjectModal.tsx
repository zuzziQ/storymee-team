import React from 'react';

interface AddProjectModalProps {
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

export default function AddProjectModal({
  showAddProjectModal,
  setShowAddProjectModal,
  newProjectName,
  setNewProjectName,
  newProjectDesc,
  setNewProjectDesc,
  newProjectColor,
  setNewProjectColor,
  handleAddProject
}: AddProjectModalProps) {
  if (!showAddProjectModal) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setShowAddProjectModal(false)}>
      <div style={{ width: '100%', maxWidth: 460, background: '#111113', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 24 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fafafa', marginBottom: 16 }}>Tạo Dự án Mới</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#71717a' }}>Tên dự án</span>
            <input className="input-dark" placeholder="Nhập tên dự án lớn..." value={newProjectName} onChange={e => setNewProjectName(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8 }} />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#71717a' }}>Mô tả</span>
            <textarea className="input-dark" placeholder="Mô tả mục tiêu dự án..." value={newProjectDesc} onChange={e => setNewProjectDesc(e.target.value)} style={{ minHeight: 80, resize: 'none', padding: '8px 12px', borderRadius: 8 }} />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#71717a' }}>Màu sắc đại diện</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'].map(color => (
                <button
                  key={color}
                  onClick={() => setNewProjectColor(color)}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: color,
                    border: newProjectColor === color ? '2px solid white' : 'none',
                    cursor: 'pointer',
                    padding: 0
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={() => setShowAddProjectModal(false)} style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: 'none', cursor: 'pointer', color: '#71717a' }}>Huỷ</button>
          <button className="btn-primary" onClick={handleAddProject} style={{ padding: '8px 20px', fontSize: 13, background: '#6366f1', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Tạo</button>
        </div>
      </div>
    </div>
  );
}
