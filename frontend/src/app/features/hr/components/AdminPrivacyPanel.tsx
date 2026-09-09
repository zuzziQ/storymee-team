'use client';

import React, { useEffect, useState } from 'react';
import { TeamMember } from '../../../constants';
import { coreApiClient, API_ROUTES } from '../../../../lib/apiClient';
import {
  DEFAULT_PRIVACY,
  PrivacySettings,
  isTeamAdmin,
} from '@/lib/teamAuth';
import HolidaySettingsModal from './HolidaySettingsModal';

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
  const [showHolidayModal, setShowHolidayModal] = useState(false);

  const [officeIps, setOfficeIps] = useState<string[]>([]);
  const [networkEnabled, setNetworkEnabled] = useState<boolean>(true);
  const [clientIp, setClientIp] = useState<string>('');
  const [newIpInput, setNewIpInput] = useState<string>('');
  const [networkLoading, setNetworkLoading] = useState<boolean>(false);
  const [networkMsg, setNetworkMsg] = useState<string>('');

  const fetchOfficeNetwork = async () => {
    try {
      const res: any = await coreApiClient.get(API_ROUTES.HR.SETTINGS_OFFICE_NETWORK);
      const data = res?.data || res;
      if (data) {
        if (Array.isArray(data.officeIps)) setOfficeIps(data.officeIps);
        if (typeof data.enabled === 'boolean') setNetworkEnabled(data.enabled);
        if (data.clientIp) setClientIp(data.clientIp);
      }
    } catch (e: any) {
      console.error('Failed to fetch office network settings', e);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res: any = await coreApiClient.get(API_ROUTES.HR.SETTINGS_PRIVACY);
        if (res?.data) setPrivacy({ ...DEFAULT_PRIVACY, ...res.data });
      } catch (e) {
        console.error(e);
      }
    })();
    fetchOfficeNetwork();
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

  const saveOfficeNetwork = async (newIps: string[], enabledVal: boolean) => {
    setNetworkLoading(true);
    setNetworkMsg('');
    try {
      const res: any = await coreApiClient.post(API_ROUTES.HR.SETTINGS_OFFICE_NETWORK, {
        actorId: activeUser.id,
        actorEmail: activeUser.email,
        officeIps: newIps,
        enabled: enabledVal,
      });
      const data = res?.data || res;
      if (data) {
        if (Array.isArray(data.officeIps)) setOfficeIps(data.officeIps);
        if (typeof data.enabled === 'boolean') setNetworkEnabled(data.enabled);
      }
      setNetworkMsg('Đã lưu cấu hình mạng văn phòng thành công!');
    } catch (e: any) {
      setNetworkMsg(e?.data?.message || e?.message || 'Lỗi cập nhật mạng văn phòng');
    } finally {
      setNetworkLoading(false);
    }
  };

  const handleAddCurrentIp = async () => {
    if (!clientIp) return;
    if (officeIps.includes(clientIp)) {
      setNetworkMsg('IP hiện tại đã có trong danh sách whitelist.');
      return;
    }
    const updated = [...officeIps, clientIp];
    setOfficeIps(updated);
    await saveOfficeNetwork(updated, networkEnabled);
  };

  const handleAddManualIp = async () => {
    const trimmed = newIpInput.trim();
    if (!trimmed) return;
    if (officeIps.includes(trimmed)) {
      setNetworkMsg('IP/Subnet này đã tồn tại trong danh sách whitelist.');
      return;
    }
    const updated = [...officeIps, trimmed];
    setOfficeIps(updated);
    setNewIpInput('');
    await saveOfficeNetwork(updated, networkEnabled);
  };

  const handleRemoveIp = async (ipToRemove: string) => {
    const updated = officeIps.filter((ip) => ip !== ipToRemove);
    setOfficeIps(updated);
    await saveOfficeNetwork(updated, networkEnabled);
  };

  const handleToggleNetworkEnabled = async () => {
    const nextVal = !networkEnabled;
    setNetworkEnabled(nextVal);
    await saveOfficeNetwork(officeIps, nextVal);
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

      <div className="glass" style={{ padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>🏖️</span>
            <h3 style={{ margin: 0, fontSize: 14, color: '#fafafa' }}>Lịch Nghỉ Lễ & Tính Công Lễ</h3>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 11, color: '#71717a' }}>
            Quản lý các ngày nghỉ lễ trong năm. Ngày lễ tự động được cộng vào ngày công hưởng lương trong bảng chấm công.
          </p>
        </div>
        <button
          onClick={() => setShowHolidayModal(true)}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            color: 'white',
            border: 'none',
            fontWeight: 600,
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 4px 12px rgba(99,102,241,0.25)',
          }}
        >
          <span>🏖️</span> Quản lý Lịch Nghỉ Lễ
        </button>
      </div>

      <HolidaySettingsModal
        isOpen={showHolidayModal}
        onClose={() => setShowHolidayModal(false)}
        isAdmin={true}
        onUpdated={() => onRefresh?.()}
      />

      {/* 📶 Cấu hình Mạng Wi-Fi Văn Phòng (IP Whitelist) */}
      <div className="glass" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16 }}>📶</span>
              <h3 style={{ margin: 0, fontSize: 14, color: '#fafafa' }}>Cấu hình Mạng Wi-Fi Văn Phòng (IP Whitelist)</h3>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 11, color: '#71717a' }}>
              Xác thực IP văn phòng khi nhân sự check-in/check-out. Chỉ IP hoặc dải mạng (Subnet) trong danh sách này mới được ghi nhận là làm việc tại văn phòng.
            </p>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: networkLoading ? 'wait' : 'pointer', fontSize: 12, color: '#e4e4e7' }}>
            <input
              type="checkbox"
              checked={networkEnabled}
              disabled={networkLoading}
              onChange={handleToggleNetworkEnabled}
              style={{ cursor: 'pointer' }}
            />
            <span>Bật xác thực IP văn phòng</span>
          </label>
        </div>

        {networkMsg && (
          <div
            style={{
              fontSize: 12,
              color: networkMsg.includes('Lỗi') ? '#f87171' : '#34d399',
              padding: '8px 12px',
              background: networkMsg.includes('Lỗi') ? 'rgba(239,68,68,0.1)' : 'rgba(52,211,153,0.1)',
              borderRadius: 8,
              border: `1px solid ${networkMsg.includes('Lỗi') ? 'rgba(239,68,68,0.2)' : 'rgba(52,211,153,0.2)'}`,
            }}
          >
            {networkMsg}
          </div>
        )}

        {/* Current IP & 1-chạm button */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 10,
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#a1a1aa' }}>IP hiện tại của bạn:</span>
            <code
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#fafafa',
                background: 'rgba(255,255,255,0.06)',
                padding: '2px 8px',
                borderRadius: 6,
                fontFamily: 'monospace',
              }}
            >
              {clientIp || 'Đang xác định...'}
            </code>
            {clientIp && (
              officeIps.includes(clientIp) ? (
                <span
                  style={{
                    fontSize: 10,
                    color: '#4ade80',
                    background: 'rgba(34,197,94,0.15)',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontWeight: 600,
                  }}
                >
                  ✓ Đã Whitelist
                </span>
              ) : (
                <span
                  style={{
                    fontSize: 10,
                    color: '#fbbf24',
                    background: 'rgba(251,191,36,0.15)',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontWeight: 600,
                  }}
                >
                  ⚠️ Mạng ngoài (Chưa whitelist)
                </span>
              )
            )}
          </div>

          <button
            type="button"
            disabled={!clientIp || officeIps.includes(clientIp) || networkLoading}
            onClick={handleAddCurrentIp}
            style={{
              padding: '6px 14px',
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 8,
              border: 'none',
              background:
                !clientIp || officeIps.includes(clientIp) || networkLoading
                  ? 'rgba(255,255,255,0.05)'
                  : 'linear-gradient(135deg, #10b981, #059669)',
              color:
                !clientIp || officeIps.includes(clientIp) || networkLoading
                  ? '#71717a'
                  : 'white',
              cursor:
                !clientIp || officeIps.includes(clientIp) || networkLoading
                  ? 'not-allowed'
                  : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s',
            }}
          >
            <span>➕</span> Thêm IP hiện tại ({clientIp || '...'}) vào Wi-Fi văn phòng
          </button>
        </div>

        {/* Input nhập IP / Subnet thủ công */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            className="input-dark"
            value={newIpInput}
            onChange={(e) => setNewIpInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddManualIp();
              }
            }}
            placeholder="vd: 123.24.197.102 hoặc 2001:ee0:40c1:6875::/64"
            disabled={networkLoading}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: 12,
              borderRadius: 8,
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border)',
              color: '#fafafa',
              fontFamily: 'monospace',
            }}
          />
          <button
            type="button"
            disabled={!newIpInput.trim() || networkLoading}
            onClick={handleAddManualIp}
            className="btn-primary"
            style={{
              padding: '8px 16px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 8,
              cursor: !newIpInput.trim() || networkLoading ? 'not-allowed' : 'pointer',
              opacity: !newIpInput.trim() || networkLoading ? 0.6 : 1,
            }}
          >
            + Thêm IP
          </button>
        </div>

        {/* Danh sách các IP/Prefix đang whitelist kèm nút xoá */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#a1a1aa' }}>
            DANH SÁCH IP / SUBNET VĂN PHÒNG ({officeIps.length}):
          </div>
          {officeIps.length === 0 ? (
            <div style={{ fontSize: 11, color: '#71717a', fontStyle: 'italic', padding: '8px 0' }}>
              Chưa có IP nào được cấu hình.
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                maxHeight: 220,
                overflowY: 'auto',
              }}
            >
              {officeIps.map((ip) => {
                const isCurrent = ip === clientIp;
                return (
                  <div
                    key={ip}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: isCurrent ? 'rgba(167,139,250,0.08)' : 'rgba(0,0,0,0.2)',
                      border: `1px solid ${
                        isCurrent ? 'rgba(167,139,250,0.3)' : 'var(--border)'
                      }`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <code style={{ fontSize: 12, color: '#e4e4e7', fontFamily: 'monospace' }}>
                        {ip}
                      </code>
                      {isCurrent && (
                        <span
                          style={{
                            fontSize: 9,
                            color: '#a78bfa',
                            background: 'rgba(167,139,250,0.15)',
                            padding: '1px 6px',
                            borderRadius: 4,
                            fontWeight: 600,
                          }}
                        >
                          IP HIỆN TẠI
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={networkLoading}
                      onClick={() => handleRemoveIp(ip)}
                      style={{
                        padding: '4px 8px',
                        fontSize: 11,
                        borderRadius: 6,
                        border: '1px solid rgba(239,68,68,0.2)',
                        background: 'rgba(239,68,68,0.08)',
                        color: '#f87171',
                        cursor: networkLoading ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      title="Xoá IP khỏi danh sách"
                    >
                      <span>🗑️</span> Xoá
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

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
