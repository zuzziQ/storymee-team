import React from 'react';

// ===================== TYPES =====================
export type Priority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type TaskStatus = 'Backlog' | 'Todo' | 'In Progress' | 'In Review' | 'Done';

export interface SubTask {
  id: string;
  dbId?: string;
  title: string;
  isDone: boolean;
  status?: string; // 'pending' | 'working' | 'done' | 'failed' | 'cancelled'
  assignee?: string;
  priority?: Priority;
  targetDate?: string;
}
export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  status: 'Active' | 'Done';
}

export interface TaskActivity {
  id: string;
  user: string;
  action: string;
  timestamp: string;
}
export interface Announcement {
  id: string;
  title: string;
  content: string;
  sender: string;
  date: string;
  readBy: string[];
  targetUserId?: string;
}
export interface Task {
  id: string; title: string; description: string; assignee: string;
  priority: Priority; status: TaskStatus; deadline: string;
  estimate: number; subtasks: SubTask[]; sprintId: string;
  projectId: string;
  activities?: TaskActivity[];
  commits?: string[];
  dbId?: string;
  parentTaskId?: string;
  outputSuggested?: string;
  assigneeId?: string | null;
  createdAt?: string;
  // Review / Output Submission fields
  outputContent?: string;
  outputUrls?: string[];
  submittedAt?: string | null;
  reviewNote?: string;
  reviewedAt?: string | null;
}
export interface TeamMember {
  id: string; name: string; role: string; skills: string[];
  telegramUsername: string; email: string; color: string;
  workArrangement?: string;
  annualLeaveLimit: number;
  annualLeaveUsed: number;
  remoteLimit: number;
  remoteUsed: number;
  salaryGross: number;
  dependentCount: number;
  bankName: string;
  bankAccount: string;
  phone?: string;
  telegramChatId?: number;
  planeMemberId?: string;
  isActive?: boolean;
  /** pending | active | suspended | rejected — omni_team_members.account_status */
  accountStatus?: string;
  accountNote?: string | null;
  fullName?: string;
  /** Configurable admin flag (DB is_team_admin) */
  isTeamAdmin?: boolean;
}
export interface ChatMessage { id: string; sender: 'user' | 'ai'; text: string; }
export interface DraftTask {
  id: string; title: string; assignee: string;
  deadline: string; estimate: number; priority: Priority;
}

export const TEAM: TeamMember[] = [
  { id: '1', name: 'Trần Thị Kim Ngân', role: 'Founder - CEO', skills: ['Planning', 'Management', 'Leadership', 'Strategy'], telegramUsername: 'kimngan_ceo', email: 'kimngan151091@gmail.com', color: '#6366f1', annualLeaveLimit: 12, annualLeaveUsed: 2, remoteLimit: 4, remoteUsed: 1, salaryGross: 45000000, dependentCount: 1, bankName: 'TP Bank', bankAccount: '55591555888', phone: '0976915836' },
  { id: '2', name: 'Lê Huy Đức Anh', role: 'Founder - CTO', skills: ['TypeScript', 'NodeJS', 'DevOps', 'Docker'], telegramUsername: 'lehuyducanh', email: 'lehuyducanh.vn@gmail.com', color: '#8b5cf6', annualLeaveLimit: 12, annualLeaveUsed: 1, remoteLimit: 4, remoteUsed: 2, salaryGross: 35000000, dependentCount: 0, bankName: 'TECHCOMBANK', bankAccount: 'LE HUY DUC ANH', phone: '0889991120' },
  { id: '3', name: 'Trần Thanh Tú', role: 'Đạo diễn - Quản lý', skills: ['Directing', 'Planning', 'Creative Direction'], telegramUsername: 'thanhntu_director', email: 'thanhtutran08@gmail.com', color: '#ec4899', annualLeaveLimit: 12, annualLeaveUsed: 0, remoteLimit: 4, remoteUsed: 0, salaryGross: 25000000, dependentCount: 2, bankName: 'TECHCOMBANK', bankAccount: '19033953859013', phone: '0378808158' },
  { id: '4', name: 'Nguyễn Đức Trung Dũng', role: 'Biên kịch - Nhân viên', skills: ['Scriptwriting', 'Creative Writing', 'Content'], telegramUsername: 'dung_bienkich', email: 'nguyenductrungdung.2005@gmail.com', color: '#f59e0b', annualLeaveLimit: 12, annualLeaveUsed: 3, remoteLimit: 4, remoteUsed: 1, salaryGross: 18000000, dependentCount: 0, bankName: 'MB', bankAccount: '6410159009939', phone: '0963320861' },
  { id: '5', name: 'Nguyễn Thảo Lan', role: 'Trợ lý chung - Nhân viên', skills: ['Administration', 'Coordination', 'Documentation'], telegramUsername: 'lan_assistant', email: 'lanthao1792003@gmail.com', color: '#f43f5e', annualLeaveLimit: 12, annualLeaveUsed: 0, remoteLimit: 4, remoteUsed: 0, salaryGross: 12000000, dependentCount: 0, bankName: 'MB', bankAccount: '0347291402', phone: '034729401' },
  { id: '6', name: 'Bùi Hương Giang', role: 'Editor - Nhân viên', skills: ['Video Editing', 'Adobe Premiere', 'CapCut'], telegramUsername: 'giang_editor', email: 'huongiiiang@gmail.com', color: '#14b8a6', annualLeaveLimit: 12, annualLeaveUsed: 2, remoteLimit: 4, remoteUsed: 2, salaryGross: 18000000, dependentCount: 0, bankName: 'BIDV', bankAccount: '1241938009', phone: '0363218081' },
  { id: '7', name: 'Lê Quang Minh', role: 'IT Admin - Hệ thống', skills: ['TypeScript', 'NodeJS', 'Fastify', 'React', 'DevOps', 'System Security'], telegramUsername: 'mlq007', email: 'zuzzivn@gmail.com', color: '#3b82f6', annualLeaveLimit: 12, annualLeaveUsed: 1, remoteLimit: 4, remoteUsed: 1, salaryGross: 22000000, dependentCount: 0, bankName: 'Vietcombank', bankAccount: '0611001899845', phone: '0812723359' },
  { id: '8', name: 'Trần Hải Dương', role: 'Biên kịch - Nhân viên', skills: ['Scriptwriting', 'Creative Writing', 'Storytelling'], telegramUsername: 'duong_bienkich', email: 'jeantran.creative@gmail.com', color: '#10b981', annualLeaveLimit: 12, annualLeaveUsed: 0, remoteLimit: 4, remoteUsed: 3, salaryGross: 16000000, dependentCount: 1, bankName: 'VCB', bankAccount: '1020999727', phone: '0867813610' },
  { id: '9', name: 'Đậu Thị Linh', role: 'Trợ lý - Nhân viên', skills: ['Administration', 'Communication', 'Documentation'], telegramUsername: 'linh_trolychung', email: 'daulinh110124@gmail.com', color: '#f97316', annualLeaveLimit: 12, annualLeaveUsed: 4, remoteLimit: 4, remoteUsed: 0, salaryGross: 15000000, dependentCount: 0, bankName: 'VCB', bankAccount: '1031476834', phone: '0352288708' },
  { id: '10', name: 'Phạm Hoàng Quỳnh Hương', role: 'Designer - Nhân viên', skills: ['UI/UX', 'Figma', 'Design System', 'Branding'], telegramUsername: 'huong_designer', email: 'phqhuong.0510@gmail.com', color: '#a78bfa', annualLeaveLimit: 12, annualLeaveUsed: 1, remoteLimit: 4, remoteUsed: 1, salaryGross: 17000000, dependentCount: 0, bankName: 'MBBank', bankAccount: '0965098413', phone: '0965098413' },
];

export const COMPANY_RULES = `
QUY CHẾ LƯƠNG, THƯỞNG VÀ CHẾ ĐỘ ĐÃI NGỘ NHÂN SỰ — CÔNG TY CỔ PHẦN CÔNG NGHỆ VÀ SÁNG TẠO AIFA HOLDING (Số: 0806/2026/QC-AIFA)

ĐIỀU 3. THỜI GIAN LÀM VIỆC VÀ CHẾ ĐỘ REMOTE
- Lịch làm việc tiêu chuẩn: Từ Thứ Hai đến Thứ Sáu; nghỉ cách tuần vào Thứ Bảy.
- Giờ làm việc tiêu chuẩn: 8 giờ/ngày, 40 giờ/tuần.
  + Buổi sáng: 08h30 – 12h00
  + Buổi chiều: 13h30 – 18h00 (Không tính thời gian nghỉ trưa).
- Chế độ làm việc từ xa (Remote):
  + Hạn mức đăng ký: Tối đa 04 ngày/tháng.
  + Điều kiện: Đăng ký trước với Ban lãnh đạo hoặc quản lý trực tiếp và được phê duyệt.
  + Trách nhiệm trong ngày làm việc từ xa:
    * Check-in trên nhóm Telegram của Công ty vào lúc 08h30, ghi rõ các đầu việc dự kiến thực hiện trong ngày.
    * Duy trì trạng thái làm việc, phản hồi công việc và phối hợp với các bộ phận liên quan trong suốt thời gian làm việc.
    * Check-out trên nhóm Telegram của Công ty vào lúc 18h00, kèm báo cáo tóm tắt tiến độ, kết quả công việc đã hoàn thành và các nội dung còn tồn đọng nếu có.
  + Lưu ý: Trường hợp không thực hiện đúng quy định check-in/out, Công ty có quyền xem xét không ghi nhận ngày làm việc từ xa là ngày công hợp lệ.

ĐIỀU 4. KỲ TRẢ LƯƠNG
- Lương được thanh toán định kỳ hàng tháng, từ ngày 05 đến ngày 10 của tháng kế tiếp.
- Hình thức thanh toán: Chuyển khoản ngân hàng vào tài khoản cá nhân.
- Nếu ngày trả lương trùng vào ngày nghỉ lễ hoặc nghỉ cuối tuần, lương sẽ được thanh toán vào ngày làm việc liền trước.

ĐIỀU 5. CƠ CẤU TIỀN LƯƠNG, THỬ VIỆC & BẢO HIỂM
- Thời gian thử việc: Áp dụng 02 tháng (tùy vị trí). Mức lương thử việc bằng 85% mức lương Gross của vị trí chính thức.
- Trong thời gian thử việc, Công ty chưa thực hiện đóng bảo hiểm xã hội (BHXH), bảo hiểm y tế (BHYT), bảo hiểm thất nghiệp (BHTN). Nghĩa vụ bảo hiểm bắt buộc sẽ được thực hiện khi ký HĐLD chính thức.
- Mức đóng bảo hiểm làm căn cứ trích nộp: Áp dụng theo mức đóng tối thiểu của Pháp luật là 5.310.000 VNĐ/tháng.
- Trích nộp bảo hiểm phần người lao động: BHXH (8%), BHYT (1.5%), BHTN (1%). Tổng trích BH người lao động là 10.5% lương đóng BH (tương đương 557.550 VNĐ cho mức đóng tối thiểu).
- Phụ cấp không chịu thuế: Trợ cấp ăn trưa & xăng xe là 700.000 VNĐ/tháng cho nhân sự chính thức.

ĐIỀU 6. THƯỞNG VÀ CHẾ ĐỘ ĐÃI NGỘ
- Thưởng tháng 13 (Thưởng Tết):
  + Đối tượng: Người lao động có thời gian làm việc liên tục đủ 12 tháng trở lên (không tính thử việc) tính đến thời điểm chi trả.
  + Mức thưởng: Tương đương 01 tháng lương Gross theo hợp đồng hiện tại.
  + Thời điểm chi trả: Trước dịp Tết Nguyên Đán (thường vào tuần cuối tháng 01 Âm lịch).
  + Người lao động làm việc chưa đủ 12 tháng sẽ xét thưởng theo tỷ lệ số tháng làm việc thực tế.
- Thưởng hiệu suất (KPI): Đánh giá định kỳ hàng quý/năm dựa trên kết quả kinh doanh và tiêu chí KPI thống nhất đầu kỳ.
- Đãi ngộ khác: Tổ chức sinh nhật, teambuilding, hỗ trợ đào tạo nâng cao năng lực, tặng quà lễ lớn (30/4, Quốc khánh 2/9, v.v.).

ĐIỀU 7. CHẾ ĐỘ NGHỈ PHÉP
- Nghỉ lễ, Tết: Nghỉ 11 ngày/năm hưởng nguyên lương theo quy định Nhà nước.
- Nghỉ phép năm:
  + Người lao động làm đủ 12 tháng: 12 ngày phép/năm (có hưởng lương).
  + Người lao động làm chưa đủ 12 tháng: Tính theo tỷ lệ 1 ngày phép/tháng làm việc đủ.
  + Quy trình đăng ký: Có đơn xin phép và được phê duyệt trước ít nhất 3 ngày làm việc (trừ trường hợp khẩn cấp).
  + Chuyển phép sang năm sau: Ngày phép chưa sử dụng được chuyển sang năm sau tối đa 05 ngày.
`;

export const PROJECTS_DEFAULT: Project[] = [
  { id: 'p1', name: 'Sản xuất Tập 3 Series Storymee', description: 'Viết kịch bản, quay phim và dựng màu cho tập 3.', color: '#6366f1', status: 'Active' },
  { id: 'p2', name: 'Chiến dịch Marketing Tháng 7', description: 'Lên nội dung TikTok, bài viết PR và thiết kế poster.', color: '#ec4899', status: 'Active' },
  { id: 'p3', name: 'Tích hợp Trợ lý AI (Harness)', description: 'Tích hợp API Core và bộ não trí nhớ Letta.', color: '#10b981', status: 'Active' },
  { id: 'p4', name: 'Phát triển WebApp StorymeeTeam', description: 'Xây dựng frontend, tích hợp backend core-api và thiết lập bộ não trí nhớ Letta.', color: '#8b5cf6', status: 'Active' }
];

export const TASKS_DEFAULT: Task[] = [
  { id: 'T-001', title: 'Dựng kịch bản tập 3 series Storymee', description: 'Viết kịch bản chi tiết cho tập 3 của series phim Storymee, độ dài khoảng 8-10 phút.', assignee: 'Trung Dũng', priority: 'High', status: 'In Progress', deadline: '2026-07-05', estimate: 12, sprintId: 's1', projectId: 'p1', subtasks: [{ id: 's1', title: 'Outline kịch bản', isDone: true }, { id: 's2', title: 'Viết thoại nhân vật', isDone: false }, { id: 's3', title: 'Review và chỉnh sửa', isDone: false }] },
  { id: 'T-002', title: 'Thiết kế bộ nhận diện thương hiệu mới', description: 'Logo, color palette, typography guide cho thương hiệu Storymee 2.0.', assignee: 'Quỳnh Hương', priority: 'Urgent', status: 'Todo', deadline: '2026-07-08', estimate: 20, sprintId: 's1', projectId: 'p2', subtasks: [{ id: 's4', title: 'Nghiên cứu mood board', isDone: false }, { id: 's5', title: 'Sketch logo options', isDone: false }] },
  { id: 'T-003', title: 'Dựng phim tập 2 (color grading)', description: 'Chỉnh màu, âm thanh và xuất bản tập 2 theo tiêu chuẩn YouTube.', assignee: 'Hương Giang', priority: 'High', status: 'In Review', deadline: '2026-07-03', estimate: 8, sprintId: 's1', projectId: 'p1', subtasks: [{ id: 's6', title: 'Import footage vào Premiere', isDone: true }, { id: 's7', title: 'Color grading', isDone: true }, { id: 's8', title: 'Mix audio và xuất bản', isDone: false }] },
  { id: 'T-004', title: 'Tích hợp API backend core', description: 'Kết nối frontend StorymeeTeam với omni-core-api endpoint quản lý task.', assignee: 'Quang Minh', priority: 'High', status: 'In Progress', deadline: '2026-07-10', estimate: 16, sprintId: 's1', projectId: 'p3', subtasks: [{ id: 's9', title: 'Viết service layer API', isDone: true }, { id: 's10', title: 'Tích hợp auth header', isDone: false }] },
  { id: 'T-005', title: 'Lên kịch bản kênh TikTok tháng 7', description: 'Lập kế hoạch nội dung 20 video ngắn cho kênh TikTok Storymee tháng 7.', assignee: 'Hải Dương', priority: 'Medium', status: 'Backlog', deadline: '2026-07-15', estimate: 6, sprintId: 's2', projectId: 'p2', subtasks: [] },
  { id: 'T-006', title: 'Lập kế hoạch phát hành tháng 7', description: 'Lịch phát hành tập phim, deadline biên tập, lịch đăng mạng xã hội.', assignee: 'Kim Ngân', priority: 'Medium', status: 'Done', deadline: '2026-06-28', estimate: 4, sprintId: 's1', projectId: 'p1', subtasks: [{ id: 's11', title: 'Thu thập timeline từ các bộ phận', isDone: true }, { id: 's12', title: 'Tổng hợp và phân phối', isDone: true }] },
  { id: 'T-101', title: 'Thiết kế giao diện Dashboard & Kanban', description: 'Xây dựng UI layout CSS, bố cục chia bảng màu glassmorphism cao cấp.', assignee: 'Quỳnh Hương', priority: 'High', status: 'Done', deadline: '2026-06-28', estimate: 12, sprintId: 's1', projectId: 'p4', subtasks: [{ id: 's101-1', title: 'Vẽ moodboard màu tối', isDone: true }, { id: 's101-2', title: 'Export CSS tokens', isDone: true }] },
  { id: 'T-102', title: 'Cấu hình dev server & cài đặt dependencies', description: 'Cài đặt các gói npm, thiết lập typescript, Turbopack và port 3010.', assignee: 'Đức Anh', priority: 'Medium', status: 'Done', deadline: '2026-06-29', estimate: 4, sprintId: 's1', projectId: 'p4', subtasks: [] },
  { id: 'T-103', title: 'Triển khai Kanban Drag & Drop bằng Drag Handle', description: 'Sử dụng HTML5 Drag and Drop API, cô lập drag handle để tránh click nhầm mở popup.', assignee: 'Quang Minh', priority: 'High', status: 'In Progress', deadline: '2026-07-02', estimate: 8, sprintId: 's1', projectId: 'p4', subtasks: [], activities: [{ id: 'a1', user: 'Quỳnh Hương', action: 'Thiết kế xong Figma layout cho Kanban', timestamp: '29/06/2026 09:15' }, { id: 'a2', user: 'Quang Minh', action: 'Bắt đầu code logic Drag & Drop', timestamp: '29/06/2026 10:30' }], commits: ['feat(kanban): T-103 drag handle separation fix'] },
  { id: 'T-104', title: 'Tích hợp API phân rã task bằng Gemini Native', description: 'Thiết lập endpoint API Next.js gọi Google AI Studio sinh subtasks định dạng JSON.', assignee: 'Quang Minh', priority: 'High', status: 'In Progress', deadline: '2026-07-03', estimate: 10, sprintId: 's1', projectId: 'p4', subtasks: [] },
  { id: 'T-105', title: 'Xây dựng màn hình Quản lý Dự án & AI Insights', description: 'Tạo tab Projects, vẽ biểu đồ burndown, dự đoán khả năng hoàn thành dự án bằng AI.', assignee: 'Kim Ngân', priority: 'Urgent', status: 'Todo', deadline: '2026-07-05', estimate: 16, sprintId: 's1', projectId: 'p4', subtasks: [] },
  { id: 'T-106', title: 'Kết nối bộ não Letta Memory lưu lịch sử nhân sự', description: 'Đồng bộ đơn xin nghỉ, lịch sử hoàn thành task sang vector database của Letta Agent.', assignee: 'Đức Anh', priority: 'High', status: 'Todo', deadline: '2026-07-08', estimate: 20, sprintId: 's1', projectId: 'p4', subtasks: [] },
];

export const ANNOUNCEMENTS_DEFAULT: Announcement[] = [
  {
    id: 'ann-1',
    title: '📢 Lịch làm việc Remote bảo trì văn phòng',
    content: 'Ngày mai 30/06/2026, toàn bộ nhân sự công ty sẽ làm việc remote (từ xa) để văn phòng tiến hành phun khử khuẩn định kỳ và nâng cấp hệ thống điều hòa. Các sếp lưu ý duyệt phép remote cho nhân sự của mình.',
    sender: 'Kim Ngân (Founder & CEO)',
    date: '2026-06-29',
    readBy: []
  }
];

// Helper hiển thị chữ in đậm **text** thành HTML span
export function renderFormattedText(text: string) {
  if (!text) return '';
  const parts = text.split('**');
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return (
        <span key={i} style={{ fontWeight: 700, color: '#a78bfa' }}>
          {part}
        </span>
      );
    }
    return part;
  });
}

export function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export function getMemberColor(name: string) {
  return TEAM.find(m => m.name === name)?.color || '#6366f1';
}

export function getStatusClass(s: TaskStatus) {
  const m: Record<TaskStatus, string> = {
    'Backlog': 'badge-backlog', 'Todo': 'badge-todo',
    'In Progress': 'badge-inprogress', 'In Review': 'badge-review', 'Done': 'badge-done'
  };
  return m[s];
}

export function getPriorityDot(p: Priority) {
  const m: Record<Priority, string> = {
    'Urgent': 'dot-urgent', 'High': 'dot-high', 'Medium': 'dot-medium', 'Low': 'dot-low'
  };
  return m[p];
}

export function calculateNetSalary(gross: number, dependents: number) {
  const insuranceBase = 5310000;
  const bhxh = insuranceBase * 0.08;
  const bhyt = insuranceBase * 0.015;
  const bhtn = insuranceBase * 0.01;
  const totalInsurance = bhxh + bhyt + bhtn; // 557.550

  const allowance = 700000; // Trợ cấp ăn trưa + xăng xe (không chịu thuế)
  
  // Thu nhập chịu thuế = Gross - Bảo hiểm - Trợ cấp
  const taxableIncome = Math.max(0, gross - totalInsurance - allowance);
  
  // Giảm trừ gia cảnh: Bản thân 11M, người phụ thuộc 4.4M/người
  const familyDeduction = 11000000 + (dependents * 4400000);
  
  // Thu nhập tính thuế
  const assessedIncome = Math.max(0, taxableIncome - familyDeduction);
  
  // Thuế TNCN lũy tiến
  let tax = 0;
  if (assessedIncome <= 5000000) {
    tax = assessedIncome * 0.05;
  } else if (assessedIncome <= 10000000) {
    tax = assessedIncome * 0.1 - 250000;
  } else if (assessedIncome <= 18000000) {
    tax = assessedIncome * 0.15 - 750000;
  } else if (assessedIncome <= 32000000) {
    tax = assessedIncome * 0.2 - 1650000;
  } else if (assessedIncome <= 52000000) {
    tax = assessedIncome * 0.25 - 3250000;
  } else if (assessedIncome <= 80000000) {
    tax = assessedIncome * 0.3 - 5850000;
  } else {
    tax = assessedIncome * 0.35 - 9850000;
  }

  const net = gross - totalInsurance - tax + allowance;
  return {
    totalInsurance,
    tax,
    net,
    allowance
  };
}

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  hostId: string;
  host?: TeamMember;
  attendees?: any;
  meetLink?: string;
  status: string;
  documents?: any[];
  outputUrls?: any[];
}
