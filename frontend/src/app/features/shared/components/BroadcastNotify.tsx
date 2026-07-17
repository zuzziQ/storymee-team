'use client';

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Megaphone } from 'lucide-react';
import { TeamMember } from '../../../constants';
import { coreApiClient, API_ROUTES } from '@/lib/apiClient';
import { isTeamAdmin } from '@/lib/teamAuth';

interface Props {
  activeUser: TeamMember;
  onCreated?: () => void;
}

/** Admin: gửi thông báo tới toàn team (omni_announcements). */
export default function BroadcastNotify({ activeUser, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isTeamAdmin(activeUser)) return null;

  const submit = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Cần tiêu đề và nội dung');
      return;
    }
    setSaving(true);
    try {
      const res: any = await coreApiClient.post(API_ROUTES.HR.ANNOUNCEMENTS, {
        title: title.trim(),
        content: content.trim(),
        senderId: activeUser.id,
        // targetUserId omitted = notify all
      });
      if (res?.status === 'success') {
        toast.success('Đã gửi thông báo toàn team');
        setTitle('');
        setContent('');
        setOpen(false);
        onCreated?.();
      } else {
        toast.error(res?.message || 'Gửi thất bại');
      }
    } catch (e: any) {
      toast.error(e?.data?.message || e?.message || 'Lỗi gửi thông báo');
    }
    setSaving(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn"
        title="Thông báo toàn team"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          borderRadius: 8,
          fontSize: 12,
          border: '1px solid var(--border)',
          background: open ? 'rgba(167,139,250,0.15)' : 'transparent',
          color: '#e4e4e7',
          cursor: 'pointer',
        }}
      >
        <Megaphone size={14} />
        Notify all
      </button>
      {open && (
        <div
          className="glass"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: 320,
            zIndex: 50,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>📢 Thông báo toàn team</div>
          <input
            placeholder="Tiêu đề"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              padding: 8,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'rgba(0,0,0,0.3)',
              color: '#fafafa',
              fontSize: 12,
            }}
          />
          <textarea
            placeholder="Nội dung gửi mọi người..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            style={{
              padding: 8,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'rgba(0,0,0,0.3)',
              color: '#fafafa',
              fontSize: 12,
              resize: 'vertical',
            }}
          />
          <button
            className="btn-primary"
            disabled={saving}
            onClick={submit}
            style={{ padding: 8, borderRadius: 8, fontSize: 12 }}
          >
            {saving ? 'Đang gửi…' : 'Gửi ngay'}
          </button>
        </div>
      )}
    </div>
  );
}
