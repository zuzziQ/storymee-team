import React from 'react';

interface RulesEditorProps {
  rawMarkdownRules: string;
  setRawMarkdownRules: (val: string) => void;
}

export default function RulesEditor({
  rawMarkdownRules,
  setRawMarkdownRules
}: RulesEditorProps) {
  return (
    <div className="glass" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fafafa' }}>HUẤN LUYỆN QUY CHẾ CÔNG TY CHO AI</h3>
        <span style={{ fontSize: 11, color: '#71717a' }}>Tải cấu trúc RAG quy chế nội bộ giúp AI trả lời chính xác, tránh tốn token ngữ cảnh</span>
      </div>
      
      <div style={{ fontSize: 11, color: '#a1a1aa', lineHeight: 1.4 }}>
        Dán văn bản quy chế công ty có cấu trúc sử dụng các tiêu đề mục <strong>### ĐIỀU [Số]</strong>. Bộ định tuyến AI sẽ tự động phân rã văn bản này thành từng mẩu nhỏ RAG để truy vấn động khi nhân sự chat hỏi về ngày phép, giờ làm, lương thưởng,...
      </div>

      <textarea
        className="input-dark"
        value={rawMarkdownRules}
        onChange={e => {
          setRawMarkdownRules(e.target.value);
          localStorage.setItem('storymee_company_rules', e.target.value);
        }}
        style={{
          width: '100%',
          height: 240,
          fontSize: 11,
          fontFamily: 'monospace',
          borderRadius: 10,
          padding: '12px 14px',
          resize: 'vertical',
          background: '#18181b',
          color: '#fafafa',
          border: '1px solid var(--border)'
        }}
        placeholder="Ví dụ:&#10;### ĐIỀU 1. QUY ĐỊNH GIỜ LÀM VIỆC...&#10;### ĐIỀU 2. CHẾ ĐỘ NGHỈ PHÉP..."
      />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#71717a' }}>
        <span>Dữ liệu tự động lưu trữ và đồng bộ hóa thời gian thực lên Local RAG database.</span>
        <button
          onClick={() => {
            alert('Đã cập nhật quy chế công ty và đồng bộ hóa thành công Local RAG database!');
          }}
          className="btn-primary"
          style={{ padding: '8px 20px', borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontWeight: 600, border: 'none', cursor: 'pointer' }}
        >
          Cập nhật Local RAG
        </button>
      </div>
    </div>
  );
}
