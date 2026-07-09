'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { coreApiClient } from '../../lib/apiClient';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [statusText, setStatusText] = useState('Đang chờ xác thực từ Telegram...');

  useEffect(() => {
    async function loadMembersAndAutoLogin() {
      // Đọc login token từ URL (nếu mở từ link Telegram Bot)
      let token = '';
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        token = params.get('token') || '';
      }

      if (!token) {
        setError('Truy cập bị từ chối. Vui lòng sử dụng liên kết đăng nhập từ Bot Telegram nội bộ của AIFA Holding.');
        setStatusText('');
        return;
      }

      try {
        const json = await coreApiClient.get('/hr/team-members');
        if (json.status === 'success' && Array.isArray(json.data)) {
            const mapped = json.data.map((m: any) => ({
              email: m.email,
              name: m.fullName,
              role: m.role || 'Developer',
              color: m.color || '#6366f1',
              lettaConversationId: m.lettaConversationId
            }));

            // Xử lý tự động đăng nhập nếu có token hợp lệ
            if (token) {
              const matchedUser = mapped.find((u: any) => u.lettaConversationId === token);
              if (matchedUser) {
                setStatusText(`Xác thực thành công. Đang chuyển hướng cho ${matchedUser.name}...`);
                localStorage.setItem('st_user', JSON.stringify({
                  email: matchedUser.email,
                  name: matchedUser.name,
                  role: matchedUser.role,
                  color: matchedUser.color
                }));
                setTimeout(() => {
                  router.push('/');
                }, 1000);
              } else {
                setError('⚠️ Token đăng nhập từ Telegram không hợp lệ hoặc đã hết hạn.');
                setStatusText('');
              }
            }
          }
      } catch (e) {
        console.error("Lỗi fetch members từ DB:", e);
        setError('⚠️ Không thể kết nối tới hệ thống xác thực. Vui lòng thử lại sau.');
        setStatusText('');
      }
    }
    loadMembersAndAutoLogin();
  }, [router]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>
      {/* Background glow */}
      <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 300, background: 'radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 420, zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 0 32px rgba(99,102,241,0.35)' }}>
            <Sparkles size={24} color="white" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fafafa', margin: 0 }}>StorymeeTeam</h1>
          <p style={{ fontSize: 13, color: '#71717a', marginTop: 4 }}>Cổng quản trị nội bộ AIFA Holding</p>
        </div>

        {/* Form card */}
        <div className="glass" style={{ padding: '36px 28px', textAlign: 'center' }}>
          
          {error ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertCircle size={24} color="#ef4444" />
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: '#fafafa', margin: 0 }}>Truy cập thất bại</h2>
              <p style={{ fontSize: 13, color: '#a1a1aa', margin: 0, lineHeight: 1.5 }}>{error}</p>
              
              <a href="https://t.me/StoryMeeBot" target="_blank" rel="noreferrer" className="btn-primary" style={{ display: 'inline-block', padding: '10px 20px', fontSize: 13, marginTop: 16, borderRadius: 8, textDecoration: 'none', background: 'linear-gradient(135deg, #0ea5e9, #2563eb)' }}>
                Mở Telegram Bot
              </a>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <Loader2 size={32} color="#a78bfa" className="spin-animation" style={{ animation: 'spin 1s linear infinite' }} />
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: '#fafafa', margin: '0 0 4px 0' }}>Đang xác thực</h2>
                <p style={{ fontSize: 13, color: '#a1a1aa', margin: 0 }}>{statusText}</p>
              </div>
              <style>{`
                @keyframes spin { 100% { transform: rotate(360deg); } }
              `}</style>
            </div>
          )}

        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#3f3f46', marginTop: 24 }}>
          © 2026 AIFA Holding · StorymeeTeam Internal Portal
        </p>
      </div>
    </div>
  );
}
