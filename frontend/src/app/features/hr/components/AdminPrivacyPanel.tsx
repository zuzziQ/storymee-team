'use client';

import React, { useEffect, useState } from 'react';
import { TeamMember } from '../../../constants';
import { coreApiClient, API_ROUTES } from '../../../../lib/apiClient';
import {
  DEFAULT_PRIVACY,
  PrivacySettings,
  isTeamAdmin,
} from '@/lib/teamAuth';

interface Props {
  activeUser: TeamMember;
  teamMembers: TeamMember[];
  setTeamMembers: React.Dispatch<React.SetStateAction<TeamMember[]>>;
  onRefresh?: () => void;
}

/**
 * Admin-only: configure team privacy + grant/revoke isTeamAdmin flag.
 */
export default function AdminPrivacyPanel({
  activeUser,
  teamMembers,
  setTeamMembers,
  onRefresh,
}: Props) {
  const [privacy, setPrivacy] = useState<PrivacySettings>(DEFAULT_PRIVACY);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res: any = await coreApiClient.get(API_ROUTES.HR.SETTINGS_PRIVACY);
        if (res?.data) setPrivacy({ ...DEFAULT_PRIVACY, ...res.data });
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  if (!isTeamAdmin(activeUser)) {
    return (
      <div className="glass" style={{ padding: 20, color: '#a1a1aa', fontSize: 13 }}>
        Chỉ Admin mới truy cập cấu hình quyền & privacy.
      </div>
    );
  }

  const togglePrivacy = async (key: keyof PrivacySettings) => {
    const next = { ...privacy, [key]: !privacy[key] };
    setPrivacy(next);
    setLoading(true);
    try {
      await coreApiClient.patch(API_ROUTES.HR.SETTINGS_PRIVACY, {
        ...next,
        actorId: activeUser.id,
        actorEmail: activeUser.email,
      });
      setMsg('Đã lưu privacy settings');
    } catch (e: any) {
      setMsg(e?.data?.message || e?.message || 'Lỗi lưu privacy');
      setPrivacy(privacy);
    } finally {
      setLoading(false);
    }
  };

  const setAdminFlag = async (member: TeamMember, flag: boolean) => {
    if (member.id === activeUser.id && !flag) {
      if (!window.confirm('Bạn đang tự gỡ quyền Admin của chính mình. Tiếp tục?')) return;
    }
    setLoading(true);
    try {
      const res: any = await coreApiClient.post(API_ROUTES.HR.memberSetAdmin(member.id), {
        actorId: activeUser.id,
        actorEmail: activeUser.email,
        isTeamAdmin: flag,
      });
      setTeamMembers((prev) =>
        prev.map((m) =>
          m.id === member.id ? { ...m, isTeamAdmin: flag } : m
        )
      );
      setMsg(res?.message || (flag ? 'Đã cấp Admin' : 'Đã thu hồi Admin'));
      onRefresh?.();
    } catch (e: any) {
      setMsg(e?.data?.message || e?.message || 'Lỗi gán Admin');
    } finally {
      setLoading(false);
    }
  };

  const rows: { key: keyof PrivacySettings; label: string; desc: string }[] = [
    {
      key: 'hideSalaryFromPeers',
      label: 'Ẩn lương Gross với đồng nghiệp',
      desc: 'User thường chỉ xem lương của chính mình; Admin xem full.',
    },
    {
      key: 'hideBankFromPeers',
      label: 'Ẩn ngân hàng / STK',
      desc: 'STK nhận lương không hiển thị khi xem hồ sơ người khác.',
    },
    {
      key: 'hideAttendanceFromPeers',
      label: 'Ẩn chấm công đồng nghiệp',
      desc: 'User chỉ xem chấm công của mình; Admin xem toàn team.',
    },
    {
      key: 'hidePhoneFromPeers',
      label: 'Ẩn số điện thoại',
      desc: 'Tuỳ chọn — ẩn SĐT khi xem hồ sơ người khác.',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {msg && (
        <div
          style={{
            fontSize: 12,
            color: '#a78bfa',
            padding: '8px 12px',
            background: 'rgba(167,139,250,0.08)',
            borderRadius: 8,
          }}
        >
          {msg}
        </div>
      )}

      <div className="glass" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, color: '#fafafa' }}>🔒 Privacy đội ngũ</h3>
          <p style={{ margin: '6px 0 0', fontSize: 11, color: '#71717a' }}>
            Bảo vệ thông tin nhạy cảm (lương, chấm công, STK). Mặc định bật ẩn với peers.
          </p>
        </div>
        {rows.map((r) => (
          <label
            key={r.key}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'rgba(0,0,0,0.2)',
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={!!privacy[r.key]}
              disabled={loading}
              onChange={() => togglePrivacy(r.key)}
              style={{ marginTop: 3 }}
            />
            <span>
              <strong style={{ fontSize: 12, color: '#e4e4e7', display: 'block' }}>{r.label}</strong>
              <span style={{ fontSize: 10, color: '#71717a' }}>{r.desc}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="glass" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, color: '#fafafa' }}>👑 Phân quyền Admin</h3>
          <p style={{ margin: '6px 0 0', fontSize: 11, color: '#71717a' }}>
            Cờ DB <code>is_team_admin</code> + email allowlist + role keywords. Admin có quyền xoá
            task, duyệt review, xem full HR.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
          {teamMembers
            .filter((m) => (m as any).accountStatus !== 'pending' && (m as any).accountStatus !== 'rejected')
            .map((m) => {
              const admin = isTeamAdmin(m);
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: admin ? 'rgba(167,139,250,0.06)' : 'rgba(0,0,0,0.15)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, color: '#fafafa', fontWeight: 600 }}>
                      {m.name}{' '}
                      {admin && (
                        <span
                          style={{
                            fontSize: 9,
                            color: '#a78bfa',
                            marginLeft: 6,
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: 'rgba(167,139,250,0.15)',
                          }}
                        >
                          ADMIN
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: '#71717a' }}>
                      {m.email} · {m.role}
                    </div>
                  </div>
                  <button
                    disabled={loading}
                    onClick={() => setAdminFlag(m, !admin)}
                    className="btn"
                    style={{
                      fontSize: 11,
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: admin ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
                      color: admin ? '#f87171' : '#4ade80',
                      cursor: 'pointer',
                    }}
                  >
                    {admin ? 'Thu hồi Admin' : 'Cấp Admin'}
                  </button>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
