'use client';
import React, { useState } from 'react';
import { Task } from '../../../constants';

interface TaskReviewPanelProps {
  task: Task;
  isAdmin: boolean;
  activeUser?: any;
  onSubmitForReview?: (task: Task, content: string, urls: string[], submitterId: string, onRefresh: () => void) => Promise<void>;
  onReviewDecision?: (taskId: string, taskDbId: string, decision: 'approve' | 'reject', reviewerId: string, note: string, onRefresh: () => void) => Promise<void>;
  onRefresh?: () => void;
  onClose?: () => void;
  onOpenSubmitPanel?: (open: boolean) => void;
  showSubmitPanel?: boolean;
}

export default function TaskReviewPanel({
  task, isAdmin, activeUser,
  onSubmitForReview, onReviewDecision, onRefresh, onClose,
  onOpenSubmitPanel, showSubmitPanel = false,
}: TaskReviewPanelProps) {
  const [submitContent, setSubmitContent] = useState('');
  const [submitUrls, setSubmitUrls] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const isInReview = task.status === 'In Review';

  return (
    <>
      {showSubmitPanel && !isInReview && (
        <div style={{ borderRadius: 10, border: '1px solid rgba(99,102,241,0.5)', background: 'rgba(99,102,241,0.05)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#818cf8' }}>📤 Nộp Output &amp; Gửi Review</span>
            <button onClick={() => onOpenSubmitPanel?.(false)} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer' }}>✕</button>
          </div>
          <label style={{ fontSize: 11, color: '#a1a1aa' }}>📝 Mô tả kết quả (bắt buộc):</label>
          <textarea className="input-dark" placeholder="Tôi đã hoàn thành..." value={submitContent} onChange={e => setSubmitContent(e.target.value)} rows={3} style={{ width: '100%', padding: '8px', fontSize: 12, borderRadius: 8, resize: 'vertical' }} />
          <label style={{ fontSize: 11, color: '#a1a1aa' }}>🔗 Links đính kèm (mỗi dòng 1 link):</label>
          <textarea className="input-dark" placeholder="https://figma.com/..." value={submitUrls} onChange={e => setSubmitUrls(e.target.value)} rows={2} style={{ width: '100%', padding: '8px', fontSize: 12, borderRadius: 8, resize: 'vertical', fontFamily: 'monospace' }} />
          <button disabled={!submitContent.trim() || submitLoading}
            onClick={async () => {
              if (!submitContent.trim() || !onSubmitForReview) return;
              setSubmitLoading(true);
              try {
                const urls = submitUrls.split('\n').map(u => u.trim()).filter(Boolean);
                await onSubmitForReview(task, submitContent, urls, activeUser?.id || '', onRefresh || (() => {}));
                onOpenSubmitPanel?.(false);
              } catch { alert('❌ Lỗi khi nộp output.'); }
              finally { setSubmitLoading(false); }
            }}
            style={{ padding: '9px', borderRadius: 8, background: submitContent.trim() ? 'linear-gradient(135deg,#4f46e5,#6366f1)' : '#3f3f46', color: 'white', border: 'none', fontWeight: 700, fontSize: 13, cursor: submitContent.trim() ? 'pointer' : 'not-allowed' }}>
            {submitLoading ? '⏳ Đang gửi...' : '✅ Gửi Output & Chuyển In Review'}
          </button>
        </div>
      )}

      {isInReview && !isAdmin && (
        <div style={{ borderRadius: 10, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.04)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#818cf8' }}>⏳ Đang chờ Admin duyệt output...</span>
          {task.outputContent && <div style={{ fontSize: 12, color: '#d4d4d8', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: 6, whiteSpace: 'pre-wrap' }}>{task.outputContent}</div>}
          {Array.isArray(task.outputUrls) && task.outputUrls.map((u, i) => (
            <a key={i} href={u} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#818cf8' }}>🔗 {u}</a>
          ))}
          {task.submittedAt && <div style={{ fontSize: 10, color: '#71717a' }}>Nộp lúc: {new Date(task.submittedAt).toLocaleString('vi-VN')}</div>}
        </div>
      )}

      {isAdmin && isInReview && (
        <div style={{ borderRadius: 10, border: '2px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.06)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>👔 ADMIN REVIEW — Kiểm tra &amp; Phê duyệt</span>
          {task.outputContent && <div style={{ fontSize: 12, color: '#fafafa', background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: 6, whiteSpace: 'pre-wrap', maxHeight: 100, overflowY: 'auto' }}>{task.outputContent}</div>}
          {Array.isArray(task.outputUrls) && task.outputUrls.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {task.outputUrls.map((u, i) => (
                <a key={i} href={u} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 11, color: '#818cf8', padding: '3px 8px', background: 'rgba(99,102,241,0.1)', borderRadius: 5, textDecoration: 'none' }}>🔗 {u}</a>
              ))}
            </div>
          )}
          {task.submittedAt && <div style={{ fontSize: 10, color: '#71717a' }}>Nộp bởi: <strong style={{ color: '#d4d4d8' }}>{task.assignee}</strong> lúc {new Date(task.submittedAt).toLocaleString('vi-VN')}</div>}
          <input className="input-dark" type="text" placeholder="Ghi chú (bắt buộc nếu REJECT)" value={reviewNote} onChange={e => setReviewNote(e.target.value)} style={{ padding: '7px 12px', fontSize: 12, borderRadius: 8 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={reviewLoading} onClick={async () => {
              if (!onReviewDecision || !window.confirm(`APPROVE task "${task.title}"?`)) return;
              setReviewLoading(true);
              try { await onReviewDecision(task.id, task.dbId || task.id, 'approve', activeUser?.id || '', reviewNote, onRefresh || (() => {})); onClose?.(); }
              catch { alert('❌ Lỗi duyệt.'); } finally { setReviewLoading(false); }
            }} style={{ flex: 1, padding: '9px', borderRadius: 8, background: 'linear-gradient(135deg,#16a34a,#22c55e)', color: 'white', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>✅ APPROVE</button>
            <button disabled={reviewLoading} onClick={async () => {
              if (!onReviewDecision) return;
              if (!reviewNote.trim()) { alert('Nhập lý do từ chối.'); return; }
              if (!window.confirm(`Từ chối task "${task.title}"?\nLý do: ${reviewNote}`)) return;
              setReviewLoading(true);
              try { await onReviewDecision(task.id, task.dbId || task.id, 'reject', activeUser?.id || '', reviewNote, onRefresh || (() => {})); onClose?.(); }
              catch { alert('❌ Lỗi từ chối.'); } finally { setReviewLoading(false); }
            }} style={{ flex: 1, padding: '9px', borderRadius: 8, background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>❌ REJECT</button>
          </div>
          {reviewLoading && <div style={{ fontSize: 12, color: '#71717a', textAlign: 'center' }}>⏳ Đang xử lý...</div>}
        </div>
      )}
    </>
  );
}
