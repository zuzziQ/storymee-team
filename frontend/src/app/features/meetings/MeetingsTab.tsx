import React, { useState } from 'react';
import { Meeting, TeamMember } from '../../constants';
import { coreApiClient, API_ROUTES } from '../../../lib/apiClient';

interface MeetingsTabProps {
  meetings: Meeting[];
  setMeetings: React.Dispatch<React.SetStateAction<Meeting[]>>;
  teamMembers?: TeamMember[];
}

export default function MeetingsTab({ meetings, setMeetings, teamMembers = [] }: MeetingsTabProps) {
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(meetings.length > 0 ? meetings[0].id : null);
  const [isEditingDocs, setIsEditingDocs] = useState(false);
  const [docInputs, setDocInputs] = useState<{ title: string; url: string }[]>([]);
  
  const [isEditingOutputs, setIsEditingOutputs] = useState(false);
  const [outputInputs, setOutputInputs] = useState<{ title: string; url: string }[]>([]);

  const [saving, setSaving] = useState(false);

  const nowMs = Date.now();
  
  const sortedMeetings = [...meetings].sort((a, b) => {
    const startA = new Date(a.startTime).getTime();
    const endA = a.endTime ? new Date(a.endTime).getTime() : startA + 3600000;
    const startB = new Date(b.startTime).getTime();
    const endB = b.endTime ? new Date(b.endTime).getTime() : startB + 3600000;

    const isPastA = endA < nowMs;
    const isPastB = endB < nowMs;

    if (isPastA && !isPastB) return 1;
    if (!isPastA && isPastB) return -1;
    if (isPastA && isPastB) return startB - startA; // past meetings: newer first
    return startA - startB; // upcoming: sooner first
  });
  
  const selected = sortedMeetings.find(m => m.id === selectedMeetingId) || null;

  const handleEditDocs = () => {
    setDocInputs(selected?.documents || [{ title: '', url: '' }]);
    setIsEditingDocs(true);
  };

  const handleSaveDocs = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const validDocs = docInputs.filter(d => d.title.trim() && d.url.trim());
      await coreApiClient.patch(`${API_ROUTES.HR.MEETINGS}/${selected.id}`, { documents: validDocs });
      setMeetings(prev => prev.map(m => m.id === selected.id ? { ...m, documents: validDocs } : m));
      setIsEditingDocs(false);
    } catch (e) {
      alert('Lỗi khi lưu tài liệu');
    }
    setSaving(false);
  };

  const handleEditOutputs = () => {
    setOutputInputs(selected?.outputUrls || [{ title: '', url: '' }]);
    setIsEditingOutputs(true);
  };

  const handleSaveOutputs = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const validOutputs = outputInputs.filter(o => o.title.trim() && o.url.trim());
      await coreApiClient.patch(`${API_ROUTES.HR.MEETINGS}/${selected.id}`, { outputUrls: validOutputs });
      setMeetings(prev => prev.map(m => m.id === selected.id ? { ...m, outputUrls: validOutputs } : m));
      setIsEditingOutputs(false);
    } catch (e) {
      alert('Lỗi khi lưu kết quả (output)');
    }
    setSaving(false);
  };

  const getAttendeeNames = (attendeeIds: string[]) => {
    if (!attendeeIds || attendeeIds.length === 0) return 'Không có';
    return attendeeIds.map(id => {
      const tm = teamMembers.find(t => t.id === id);
      return tm ? tm.fullName : 'Thành viên Ẩn';
    }).join(', ');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, height: '100%' }}>
      {/* CỘT TRÁI: DANH SÁCH LỊCH HỌP */}
      <div className='glass' style={{ padding: 24, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <h2 style={{ fontSize: 18, color: '#fafafa', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>📅</span> Lịch họp & Sự kiện
        </h2>
        
        {sortedMeetings.length === 0 ? (
          <div style={{ color: '#71717a', fontSize: 13 }}>Không có lịch họp nào.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sortedMeetings.map(m => {
              const startMs = new Date(m.startTime).getTime();
              const endMs = m.endTime ? new Date(m.endTime).getTime() : startMs + 3600000;
              const isPast = endMs < nowMs;
              const date = new Date(m.startTime).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
              const time = new Date(m.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
              const isSelected = selectedMeetingId === m.id;
              
              return (
                <div 
                  key={m.id}
                  onClick={() => { setSelectedMeetingId(m.id); setIsEditingDocs(false); setIsEditingOutputs(false); }}
                  style={{
                    padding: '16px 20px',
                    borderRadius: 12,
                    background: isSelected ? 'rgba(167, 139, 250, 0.1)' : 'rgba(255,255,255,0.02)',
                    border: isSelected ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    transition: 'all 0.2s',
                    boxShadow: isSelected ? '0 0 10px rgba(167, 139, 250, 0.15)' : 'none',
                    opacity: isPast ? 0.6 : 1
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: 8, minWidth: 65 }}>
                    <span style={{ fontSize: 11, color: isPast ? '#71717a' : '#a78bfa', fontWeight: 600, textTransform: 'uppercase' }}>{date.split(',')[0]}</span>
                    <span style={{ fontSize: 16, color: isPast ? '#a1a1aa' : '#fafafa', fontWeight: 700 }}>{date.split(',')[1]?.trim().split('/')[0] || ''}</span>
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: isPast ? '#a1a1aa' : '#fafafa', marginBottom: 4 }}>{m.title}</div>
                    <div style={{ fontSize: 12, color: '#a1a1aa', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>⏰ {time}</span>
                      <span>🎤 Host: {m.host?.name || m.host?.fullName || 'Storymee'}</span>
                      {m.attendees && m.attendees.length > 0 && (
                        <span>👥 {m.attendees.length} người tham dự</span>
                      )}
                    </div>
                  </div>
                  
                  {!isPast && m.status === 'upcoming' && (
                    <span style={{ fontSize: 10, padding: '4px 8px', background: '#3b82f620', color: '#60a5fa', borderRadius: 4, fontWeight: 600, flexShrink: 0 }}>Sắp tới</span>
                  )}
                  {!isPast && m.status === 'happening' && (
                    <span style={{ fontSize: 10, padding: '4px 8px', background: '#10b98120', color: '#34d399', borderRadius: 4, fontWeight: 600, flexShrink: 0 }}>Đang diễn ra</span>
                  )}
                  {isPast && (
                    <span style={{ fontSize: 10, padding: '4px 8px', background: 'rgba(255,255,255,0.05)', color: '#a1a1aa', borderRadius: 4, fontWeight: 600, flexShrink: 0 }}>Đã qua</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CỘT PHẢI: CHI TIẾT */}
      {selected ? (
        <div className='glass' style={{ padding: 24, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <h3 style={{ fontSize: 16, color: '#fafafa', margin: '0 0 8px 0' }}>{selected.title}</h3>
          
          <div style={{ display: 'flex', gap: 8, fontSize: 12, color: '#a1a1aa', marginBottom: 20 }}>
            <span>{new Date(selected.startTime).toLocaleString('vi-VN')}</span>
          </div>
          
          {selected.description && (
            <div style={{ fontSize: 13, color: '#d4d4d8', marginBottom: 20, padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
              {selected.description}
            </div>
          )}

          <div style={{ marginBottom: 24 }}>
            <h4 style={{ margin: 0, fontSize: 13, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span>👥</span> Thành phần tham dự
            </h4>
            <div style={{ fontSize: 13, color: '#d4d4d8', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
              {getAttendeeNames(selected.attendees)}
            </div>
          </div>

          {selected.meetLink && (
            <div style={{ marginBottom: 24 }}>
              <a 
                href={selected.meetLink} 
                target="_blank" 
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13
                }}
              >
                🎥 Tham gia Google Meet
              </a>
            </div>
          )}

          {/* TÀI LIỆU */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontSize: 13, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📎</span> Tài liệu chuẩn bị
              </h4>
              {!isEditingDocs && (
                <button className='btn-ghost' onClick={handleEditDocs} style={{ fontSize: 11, padding: '4px 8px' }}>Chỉnh sửa</button>
              )}
            </div>
            
            {isEditingDocs ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {docInputs.map((doc, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8 }}>
                    <input 
                      className='input-dark' 
                      placeholder='Tên tài liệu...' 
                      value={doc.title} 
                      onChange={e => { const v = [...docInputs]; v[idx].title = e.target.value; setDocInputs(v); }}
                      style={{ flex: 1, padding: '6px 10px', fontSize: 12, borderRadius: 6 }} 
                    />
                    <input 
                      className='input-dark' 
                      placeholder='Link (Google Drive/Docs)...' 
                      value={doc.url} 
                      onChange={e => { const v = [...docInputs]; v[idx].url = e.target.value; setDocInputs(v); }}
                      style={{ flex: 2, padding: '6px 10px', fontSize: 12, borderRadius: 6 }} 
                    />
                    <button 
                      className='btn-ghost' 
                      onClick={() => setDocInputs(docInputs.filter((_, i) => i !== idx))}
                      style={{ padding: '6px 10px', fontSize: 12, color: '#ef4444' }}
                    >×</button>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <button className='btn-ghost' onClick={() => setDocInputs([...docInputs, { title: '', url: '' }])} style={{ fontSize: 11 }}>+ Thêm Link</button>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className='btn-ghost' onClick={() => setIsEditingDocs(false)} style={{ fontSize: 11 }}>Hủy</button>
                    <button className='btn-primary' onClick={handleSaveDocs} disabled={saving} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6 }}>Lưu</button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(!selected.documents || selected.documents.length === 0) ? (
                  <div style={{ fontSize: 12, color: '#71717a', fontStyle: 'italic' }}>Chưa có tài liệu nào</div>
                ) : (
                  selected.documents.map((d: any, idx: number) => (
                    <a key={idx} href={d.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#60a5fa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>📄</span> {d.title}
                    </a>
                  ))
                )}
              </div>
            )}
          </div>

          {/* KẾT QUẢ OUTPUT */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontSize: 13, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>✅</span> Kết quả & Output
              </h4>
              {!isEditingOutputs && (
                <button className='btn-ghost' onClick={handleEditOutputs} style={{ fontSize: 11, padding: '4px 8px' }}>Chập nhật</button>
              )}
            </div>
            
            {isEditingOutputs ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {outputInputs.map((out, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8 }}>
                    <input 
                      className='input-dark' 
                      placeholder='Tên kết quả...' 
                      value={out.title} 
                      onChange={e => { const v = [...outputInputs]; v[idx].title = e.target.value; setOutputInputs(v); }}
                      style={{ flex: 1, padding: '6px 10px', fontSize: 12, borderRadius: 6 }} 
                    />
                    <input 
                      className='input-dark' 
                      placeholder='Link (Docs/File)...' 
                      value={out.url} 
                      onChange={e => { const v = [...outputInputs]; v[idx].url = e.target.value; setOutputInputs(v); }}
                      style={{ flex: 2, padding: '6px 10px', fontSize: 12, borderRadius: 6 }} 
                    />
                    <button 
                      className='btn-ghost' 
                      onClick={() => setOutputInputs(outputInputs.filter((_, i) => i !== idx))}
                      style={{ padding: '6px 10px', fontSize: 12, color: '#ef4444' }}
                    >×</button>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <button className='btn-ghost' onClick={() => setOutputInputs([...outputInputs, { title: '', url: '' }])} style={{ fontSize: 11 }}>+ Thêm Link</button>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className='btn-ghost' onClick={() => setIsEditingOutputs(false)} style={{ fontSize: 11 }}>Hủy</button>
                    <button className='btn-primary' onClick={handleSaveOutputs} disabled={saving} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, background: '#10b981', color: '#111' }}>Lưu</button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(!selected.outputUrls || selected.outputUrls.length === 0) ? (
                  <div style={{ fontSize: 12, color: '#71717a', fontStyle: 'italic' }}>Chưa có kết quả sau cuộc họp</div>
                ) : (
                  selected.outputUrls.map((d: any, idx: number) => (
                    <a key={idx} href={d.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#34d399', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>🔗</span> {d.title}
                    </a>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className='glass' style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717a', fontSize: 14 }}>
          Chọn một cuộc họp để xem chi tiết
        </div>
      )}
    </div>
  );
}
