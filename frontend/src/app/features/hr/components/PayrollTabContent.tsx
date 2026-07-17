import React, { useState } from 'react';
import { TeamMember, calculateNetSalary } from '../../../constants';
import { isTeamAdmin } from '@/lib/teamAuth';

interface PayrollTabContentProps {
  currentUser: TeamMember;
  teamMembers: TeamMember[];
}

export default function PayrollTabContent({
  currentUser,
  teamMembers
}: PayrollTabContentProps) {
  const [isApproved, setIsApproved] = useState(false);
  const [sendingLogs, setSendingLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activePayrollTab, setActivePayrollTab] = useState<'payslip' | 'overview'>('payslip');

  const isBoss = isTeamAdmin(currentUser);

  const payrollList = teamMembers.map(m => {
    const calc = calculateNetSalary(m.salaryGross, m.dependentCount);
    return {
      member: m,
      ...calc
    };
  });

  const totalGrossFund = payrollList.reduce((acc, curr) => acc + curr.member.salaryGross, 0);
  const totalNetFund = payrollList.reduce((acc, curr) => acc + curr.net, 0);

  const myCalc = calculateNetSalary(currentUser.salaryGross, currentUser.dependentCount);

  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  const handleApproveAndSendPayroll = () => {
    if (isLoading || isApproved) return;
    setIsLoading(true);
    setSendingLogs(['Bắt đầu quy trình tự động hóa phát lương tháng 6/2026...', 'Đang kết xuất tệp PDF Phiếu lương (Payslip)...']);

    setTimeout(() => {
      setSendingLogs(prev => [...prev, 'Đang gửi Email thông báo kèm Payslip mã hóa đến 9 nhân sự...']);
    }, 800);

    setTimeout(() => {
      setSendingLogs(prev => [...prev, 'Đang bắn tin nhắn Telegram Bot thông báo riêng tư cho từng nhân sự...']);
    }, 1600);

    setTimeout(() => {
      setSendingLogs(prev => [...prev, 'Phê duyệt & Phát lương hoàn tất thành công! 🚀']);
      setIsApproved(true);
      setIsLoading(false);
    }, 2400);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {isBoss && (
        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
          <button
            onClick={() => setActivePayrollTab('payslip')}
            className={`tab-btn ${activePayrollTab === 'payslip' ? 'active' : ''}`}
            style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer', border: 'none', background: activePayrollTab === 'payslip' ? 'rgba(255,255,255,0.05)' : 'transparent', color: activePayrollTab === 'payslip' ? 'white' : '#71717a' }}
          >
            Phiếu lương của tôi
          </button>
          <button
            onClick={() => setActivePayrollTab('overview')}
            className={`tab-btn ${activePayrollTab === 'overview' ? 'active' : ''}`}
            style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer', border: 'none', background: activePayrollTab === 'overview' ? 'rgba(255,255,255,0.05)' : 'transparent', color: activePayrollTab === 'overview' ? 'white' : '#71717a' }}
          >
            Quản lý lương toàn công ty
          </button>
        </div>
      )}

      {(activePayrollTab === 'payslip' || !isBoss) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 14 }}>
          <div className="glass" style={{ padding: '24px 30px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fafafa' }}>PHIẾU LƯƠNG ĐIỆN TỬ (PAYSLIP)</h3>
                <span style={{ fontSize: 11, color: '#71717a' }}>Kỳ tính lương: Tháng 06/2026</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 11, color: '#71717a', display: 'block' }}>Mã phiếu lương</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa' }}>PS-202606-{currentUser.id}</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12, color: '#a1a1aa' }}>
              <div>Họ và tên: <strong style={{ color: '#fafafa' }}>{currentUser.name}</strong></div>
              <div>Mã nhân viên: <strong style={{ color: '#fafafa' }}>EMP-00{currentUser.id}</strong></div>
              <div>Chức vụ: <strong style={{ color: '#fafafa' }}>{currentUser.role}</strong></div>
              <div>Email: <strong style={{ color: '#fafafa' }}>{currentUser.email}</strong></div>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginTop: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', background: 'rgba(255,255,255,0.02)', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#71717a', borderBottom: '1px solid var(--border)' }}>
                <span>KHOẢN MỤC</span>
                <span style={{ textAlign: 'right' }}>CÔNG THỨC</span>
                <span style={{ textAlign: 'right' }}>SỐ TIỀN</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#e4e4e7' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '10px 16px', borderBottom: '1px dashed rgba(255,255,255,0.05)' }}>
                  <span>I. Lương Gross thỏa thuận</span>
                  <span style={{ textAlign: 'right', color: '#71717a' }}>Thỏa thuận</span>
                  <span style={{ textAlign: 'right', fontWeight: 600 }}>{formatVND(currentUser.salaryGross)}</span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '10px 16px', borderBottom: '1px dashed rgba(255,255,255,0.05)' }}>
                  <span>II. Trích bảo hiểm (phần NLĐ đóng)</span>
                  <span style={{ textAlign: 'right', color: '#71717a' }}>10.5% (Tối thiểu)</span>
                  <span style={{ textAlign: 'right', color: '#ef4444' }}>-{formatVND(myCalc.totalInsurance)}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '10px 16px', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingLeft: 24, fontSize: 11, color: '#a1a1aa' }}>
                  <span>— BHXH (8%)</span>
                  <span style={{ textAlign: 'right' }}>Cơ sở: 5.31M</span>
                  <span style={{ textAlign: 'right' }}>-{formatVND(5310000 * 0.08)}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '10px 16px', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingLeft: 24, fontSize: 11, color: '#a1a1aa' }}>
                  <span>— BHYT (1.5%)</span>
                  <span style={{ textAlign: 'right' }}>Cơ sở: 5.31M</span>
                  <span style={{ textAlign: 'right' }}>-{formatVND(5310000 * 0.015)}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '10px 16px', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingLeft: 24, fontSize: 11, color: '#a1a1aa' }}>
                  <span>— BHTN (1%)</span>
                  <span style={{ textAlign: 'right' }}>Cơ sở: 5.31M</span>
                  <span style={{ textAlign: 'right' }}>-{formatVND(5310000 * 0.01)}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '10px 16px', borderBottom: '1px dashed rgba(255,255,255,0.05)' }}>
                  <span>III. Phụ cấp không chịu thuế</span>
                  <span style={{ textAlign: 'right', color: '#71717a' }}>Ăn trưa & xăng xe</span>
                  <span style={{ textAlign: 'right', color: '#22c55e' }}>+{formatVND(myCalc.allowance)}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '10px 16px', borderBottom: '1px dashed rgba(255,255,255,0.05)' }}>
                  <span>IV. Thuế thu nhập cá nhân (TNCN)</span>
                  <span style={{ textAlign: 'right', color: '#71717a' }}>Giảm trừ GT: {currentUser.dependentCount} người</span>
                  <span style={{ textAlign: 'right', color: '#ef4444' }}>-{formatVND(myCalc.tax)}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '12px 16px', background: 'rgba(167, 139, 250, 0.03)', fontSize: 13, fontWeight: 700 }}>
                  <span style={{ color: '#a78bfa' }}>V. LƯƠNG NET THỰC NHẬN</span>
                  <span style={{ textAlign: 'right', color: '#71717a', fontWeight: 400, fontSize: 11 }}>I - II + III - IV</span>
                  <span style={{ textAlign: 'right', color: '#a78bfa' }}>{formatVND(myCalc.net)}</span>
                </div>
              </div>
            </div>

            <p style={{ fontSize: 10, color: '#52525b', margin: 0, fontStyle: 'italic', textAlign: 'center' }}>
              * Đây là phiếu lương điện tử được mã hóa và bảo vệ bảo mật bởi StorymeeTeam OmniRouter. Không chia sẻ phiếu này với đồng nghiệp.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="glass" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontSize: 11, color: '#71717a', fontWeight: 600 }}>TÀI KHOẢN NHẬN LƯƠNG</span>
              <div style={{ background: 'rgba(255,255,255,0.01)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, color: '#71717a' }}>Ngân hàng thụ hưởng</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>{currentUser.bankName}</span>
                <span style={{ fontSize: 10, color: '#71717a', marginTop: 4 }}>Số tài khoản</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#fafafa', fontFamily: 'monospace' }}>{currentUser.bankAccount}</span>
                <span style={{ fontSize: 10, color: '#71717a', marginTop: 4 }}>Chủ tài khoản</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>{currentUser.name.toUpperCase()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {isBoss && activePayrollTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="glass" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(99,102,241,0.03) 0%, rgba(139,92,246,0.03) 100%)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fafafa' }}>TRUNG TÂM PHÊ DUYỆT LƯƠNG THÁNG 6/2026</h4>
              <span style={{ fontSize: 11, color: '#a1a1aa' }}>Tổng ngân quỹ Gross: <strong>{formatVND(totalGrossFund)}</strong> · Net thực trả: <strong>{formatVND(totalNetFund)}</strong></span>
            </div>
            
            <button
              disabled={isLoading || isApproved}
              onClick={handleApproveAndSendPayroll}
              className="btn-primary"
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                background: isApproved 
                  ? '#10b981' 
                  : 'linear-gradient(135deg, #6366f1 0%, #a78bfa 100%)',
                color: 'white',
                cursor: (isLoading || isApproved) ? 'not-allowed' : 'pointer'
              }}
            >
              {isApproved ? '✓ Đã Phê Duyệt & Giải Ngân' : isLoading ? 'Đang giải ngân...' : 'Phê duyệt & Phát lương'}
            </button>
          </div>

          {sendingLogs.length > 0 && (
            <div className="glass" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6, background: '#111', fontFamily: 'monospace', fontSize: 11, border: '1px solid rgba(255,255,255,0.05)' }}>
              {sendingLogs.map((log, i) => (
                <div key={i} style={{ color: log.includes('hoàn tất') ? '#10b981' : '#a1a1aa' }}>
                  {log.includes('hoàn tất') ? '➔ ' : '⚡ '} {log}
                </div>
              ))}
            </div>
          )}

          <div className="glass" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#fafafa' }}>Bảng chi tiết quỹ lương nhân sự</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left', color: '#e4e4e7' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, color: '#71717a', fontSize: 11, fontWeight: 600 }}>
                    <th style={{ padding: '10px 14px' }}>NHÂN SỰ</th>
                    <th style={{ padding: '10px 14px' }}>CHỨC VỤ</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>LƯƠNG GROSS</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>TRÍCH BẢO HIỂM</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>THUẾ TNCN</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>PHỤ CẤP</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>LƯƠNG NET THỰC NHẬN</th>
                    <th style={{ padding: '10px 14px' }}>TÀI KHOẢN NHẬN</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollList.map(item => {
                    const acc = item.member.bankAccount || '';
                    const maskedAccount = acc.length > 4 ? '*'.repeat(acc.length - 4) + acc.slice(-4) : acc;
                    return (
                      <tr key={item.member.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: '#fafafa' }}>{item.member.name}</td>
                        <td style={{ padding: '12px 14px', color: '#a1a1aa' }}>{item.member.role}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>{formatVND(item.member.salaryGross)}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', color: '#ef4444' }}>-{formatVND(item.totalInsurance)}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', color: '#ef4444' }}>-{formatVND(item.tax)}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', color: '#22c55e' }}>+{formatVND(item.allowance)}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#a78bfa' }}>{formatVND(item.net)}</td>
                        <td style={{ padding: '12px 14px', fontFamily: 'monospace' }}>{item.member.bankName} · {maskedAccount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
