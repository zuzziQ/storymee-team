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
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      
      if (!token) {
        setIsCheckingToken(false);
        return;
      }

      setStatusText('Đang xác thực Token từ Telegram...');
      try {
        const json = await coreApiClient.get('/hr/team-members');
        if ((json.status === 'success' || json.success === true) && Array.isArray(json.data)) {
          const matchedUser = json.data.find(
            (u: any) => u.lettaConversationId === token || `conv-${u.id}` === token
          );

          if (matchedUser) {
            setStatusText(`Xác thực thành công. Đang chuyển hướng cho ${matchedUser.fullName}...`);
            localStorage.setItem('st_user', JSON.stringify({
              email: matchedUser.email,
              name: matchedUser.fullName,
              role: matchedUser.role || 'Nhân sự mới',
              color: matchedUser.color || '#6366f1'
            }));
            setTimeout(() => {
              router.push('/');
            }, 1000);
          } else {
            setError('⚠️ Token đăng nhập từ Telegram không hợp lệ hoặc đã hết hạn.');
            setIsCheckingToken(false);
            setStatusText('');
          }
        } else {
           setIsCheckingToken(false);
        }
      } catch (e) {
        console.error("Lỗi fetch members từ DB:", e);
        setError('⚠️ Không thể kết nối tới hệ thống xác thực.');
        setIsCheckingToken(false);
      }
    }
    checkToken();
  }, [router]);

  // 2. Logic xử lý Đăng Nhập Thủ Công (Form Submit)
  const handleDirectLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = inputValue.trim().toLowerCase();
    
    if (!val) {
      setError('Vui lòng nhập Email hoặc Telegram Username.');
      return;
    }
    
    // Loại bỏ ký tự @ nếu người dùng gõ @username
    const searchVal = val.startsWith('@') ? val.substring(1) : val;

    setError('');
    setIsSubmitting(true);
    setStatusText('Đang kiểm tra tài khoản nội bộ...');

    try {
      const json = await coreApiClient.get('/hr/team-members');
      if ((json.status === 'success' || json.success === true) && Array.isArray(json.data)) {
        // Tìm kiếm linh hoạt: Khớp Email hoặc Telegram Username
        const matchedUser = json.data.find((u: any) => 
          (u.email && u.email.toLowerCase() === searchVal) || 
          (u.telegramUsername && u.telegramUsername.toLowerCase() === searchVal)
        );

        if (matchedUser) {
          setStatusText(`Đăng nhập thành công! Xin chào ${matchedUser.fullName}`);
          localStorage.setItem('st_user', JSON.stringify({
            email: matchedUser.email,
            name: matchedUser.fullName,
            role: matchedUser.role || 'Nhân sự mới',
            color: matchedUser.color || '#6366f1'
          }));
          setTimeout(() => {
            router.push('/');
          }, 1000);
        } else {
          setError('Tài khoản không tồn tại. Vui lòng kiểm tra lại Email/Nick Telegram.');
          setIsSubmitting(false);
          setStatusText('');
        }
      } else {
        setError('Hệ thống đang bảo trì, vui lòng thử lại sau.');
        setIsSubmitting(false);
        setStatusText('');
      }
    } catch (e) {
      console.error("Lỗi đăng nhập thủ công:", e);
      setError('⚠️ Không thể kết nối tới hệ thống xác thực.');
      setIsSubmitting(false);
      setStatusText('');
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
                <p style={{ fontSize: 13, color: '#a1a1aa', margin: '0 0 12px 0' }}>Hoặc truy cập bằng Token bảo mật</p>
                <a href="https://t.me/StoryMeeBot" target="_blank" rel="noreferrer" className="btn" style={{ display: 'inline-block', width: '100%', padding: '10px', fontSize: 13, borderRadius: 8, textDecoration: 'none', background: 'rgba(255,255,255,0.05)', color: '#fafafa', border: '1px solid var(--border)' }}>
                  Mở Telegram Bot
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
