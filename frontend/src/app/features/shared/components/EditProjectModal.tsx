import React, { useState, useEffect } from 'react';
import { Project } from '../../../constants';

interface EditProjectModalProps {
  project: Project;
  onClose: () => void;
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
}

export default function EditProjectModal({
  project,
  onClose,
  onUpdateProject
}: EditProjectModalProps) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [color, setColor] = useState(project.color || '#6366f1');

  useEffect(() => {
    setName(project.name);
    setDescription(project.description || '');
    setColor(project.color || '#6366f1');
  }, [project]);

  const handleSave = () => {
    if (!name.trim()) return;
    onUpdateProject(project.id, {
      name: name.trim(),
      description: description.trim(),
      color
    });
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 460, background: '#111113', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 24 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fafafa', marginBottom: 16 }}>Sửa Dự án</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#71717a' }}>Tên dự án</span>
            <input className="input-dark" placeholder="Nhập tên dự án lớn..." value={name} onChange={e => setName(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8 }} />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#71717a' }}>Mô tả</span>
            <textarea className="input-dark" placeholder="Mô tả mục tiêu dự án..." value={description} onChange={e => setDescription(e.target.value)} style={{ minHeight: 80, resize: 'none', padding: '8px 12px', borderRadius: 8 }} />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#71717a' }}>Màu sắc đại diện</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'].map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: c,
                    border: color === c ? '2px solid white' : 'none',
                    cursor: 'pointer',
                    padding: 0
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose} style={{ padding: '8px 16px', fontSize: 13, background: 'transparent', border: 'none', cursor: 'pointer', color: '#71717a' }}>Huỷ</button>
          <button className="btn-primary" onClick={handleSave} style={{ padding: '8px 20px', fontSize: 13, background: '#6366f1', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Lưu</button>
        </div>
      </div>
    </div>
  );
}
