'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, AlertCircle, Loader2, LogIn } from 'lucide-react';
import { coreApiClient } from '../../lib/apiClient';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [statusText, setStatusText] = useState('');
  
  // States for the new Login Form
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true);

  // 1. Logic tự động đăng nhập nếu có Token trên URL
  useEffect(() => {
    async function checkToken() {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const token = params.get('token');
      
      if (!token) {
        setIsCheckingToken(false);
        return;
      }

      setStatusText('Đang xác thực Token từ Telegram...');
      window.history.replaceState(null, '', window.location.pathname);
      try {
        const auth: any = await coreApiClient.post('/auth/one-time/exchange', { token });
        if ((auth.status === 'success' || auth.success === true) && auth.data?.accessToken && auth.data?.member) {
              const u = auth.data.member;
              setStatusText(`Xác thực thành công. Đang chuyển hướng cho ${u.fullName}...`);
              localStorage.setItem('st_team_token', auth.data.accessToken);
              localStorage.setItem('st_user', JSON.stringify({
                id: u.id,
                email: u.email,
                name: u.fullName,
                role: u.role || 'Nhân sự mới',
                accountStatus: u.accountStatus || 'active',
                color: u.color || '#6366f1'
              }));
              setTimeout(() => router.push('/'), 800);
        } else {
          throw new Error('Invalid exchange response');
        }
      } catch (e: any) {
        console.error('One-time login exchange failed:', e);
        setError(e?.data?.message || '⚠️ Liên kết đăng nhập không hợp lệ, đã dùng hoặc đã hết hạn.');
        setIsCheckingToken(false);
      }
    }
    checkToken();
  }, [router]);

  // 2. Logic xử lý Đăng Nhập Thủ Công (Form Submit)
  const handleDirectLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) {
      setError('Vui lòng nhập Email hoặc @telegram_username');
      return;
    }
    setError('');
    setIsSubmitting(true);
    setStatusText('Đang gửi yêu cầu đăng nhập...');
    
    try {
      const res: any = await coreApiClient.post('/auth/one-time/request', { identifier: inputValue });
      if (res.status === 'success' || res.success) {
        setStatusText(res.message || 'Đã gửi link đăng nhập qua Telegram! Vui lòng kiểm tra tin nhắn.');
        // Don't set isSubmitting(false) so it stays on the success message state, or user can refresh.
      } else {
        setError(res.message || 'Không thể gửi yêu cầu đăng nhập');
        setIsSubmitting(false);
      }
    } catch (e: any) {
      console.error('Login request failed:', e);
      setError(e?.data?.message || 'Không tìm thấy tài khoản hoặc tài khoản chưa liên kết Telegram.');
      setIsSubmitting(false);
    }
  };

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
          
          {isCheckingToken ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <Loader2 size={32} color="#a78bfa" className="spin-animation" style={{ animation: 'spin 1s linear infinite' }} />
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: '#fafafa', margin: '0 0 4px 0' }}>Đang xác thực</h2>
                <p style={{ fontSize: 13, color: '#a1a1aa', margin: 0 }}>{statusText}</p>
              </div>
            </div>
          ) : isSubmitting ? (
             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <Loader2 size={32} color="#a78bfa" className="spin-animation" style={{ animation: 'spin 1s linear infinite' }} />
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: '#fafafa', margin: '0 0 4px 0' }}>Đang đăng nhập</h2>
                <p style={{ fontSize: 13, color: '#a1a1aa', margin: 0 }}>{statusText}</p>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
                  <AlertCircle size={20} color="#ef4444" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#ef4444' }}>{error}</span>
                </div>
              )}

              <form onSubmit={handleDirectLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ textAlign: 'left' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#d4d4d8', marginBottom: 8 }}>
                    Tài khoản nội bộ
                  </label>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Email hoặc @telegram_username"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'rgba(0,0,0,0.2)',
                      color: '#fafafa',
                      fontSize: 14,
                      outline: 'none',
                      transition: 'all 0.2s ease'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                  />
                </div>

                <button 
                  type="submit" 
                  className="btn-primary" 
                  style={{ width: '100%', padding: '12px', fontSize: 14, fontWeight: 600, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}
                >
                  <LogIn size={18} />
                  Đăng Nhập
                </button>
              </form>
              
              <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
                <p style={{ fontSize: 12, color: '#71717a', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                  Tài khoản mới: đăng ký trên Telegram bot → <strong style={{ color: '#a1a1aa' }}>Admin duyệt</strong> → mới đăng nhập được.
                </p>
                <a href="https://t.me/StoryMeeBot" target="_blank" rel="noreferrer" className="btn" style={{ display: 'inline-block', width: '100%', padding: '10px', fontSize: 13, borderRadius: 8, textDecoration: 'none', background: 'rgba(255,255,255,0.05)', color: '#fafafa', border: '1px solid var(--border)' }}>
                  Mở Telegram Bot (đăng ký / token)
                </a>
              </div>
            </>
          )}

          <style>{`
            @keyframes spin { 100% { transform: rotate(360deg); } }
            input::placeholder { color: #52525b; }
          `}</style>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#3f3f46', marginTop: 24 }}>
          © 2026 AIFA Holding · StorymeeTeam Internal Portal
        </p>
      </div>
    </div>
  );
}
