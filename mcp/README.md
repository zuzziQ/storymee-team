---
type: docs
title: README
description: OKF standardized document for README in project storymeeteam-mcp.
tags: [storymeeteam-mcp]
related_files: [file:////Users/imam/storymee/2-MCP-Core/storymeeteam-mcp/README.md]
---

# StorymeeTeam Custom MCP Server

Máy chủ Model Context Protocol (MCP) chuyên trách cung cấp công cụ tự động hóa công việc, Kanban, nghỉ phép, tra cứu bảng lương và cập nhật thông tin cá nhân cho nhân sự Storymee.

---

## 🛡️ 1. Nguyên Tắc Phân Quyền & Bảo Mật (Access Control List)

Để đảm bảo an toàn thông tin, hệ thống tự động kiểm tra định danh người dùng gọi Tool dựa trên hai biến môi trường bắt buộc:
* **`STORYMEE_USER_EMAIL`**: Email chính thức của nhân viên tại công ty.
* **`STORYMEE_USER_TOKEN`**: Mã bảo mật cá nhân (nếu có, hoặc token xác thực).

### Phân quyền chi tiết:
1. **Ban Giám Đốc & IT Admin (Kim Ngân, Đức Anh, Quang Minh):**
   * Quyền: Toàn quyền truy cập. Tra cứu lương bất kỳ ai, tạo/bàn giao task bất kỳ, tự động duyệt phép.
2. **Nhân viên thông thường (Thanh Tú, Trung Dũng, Hương Giang...):**
   * **Task:** Chỉ được thay đổi trạng thái và bàn giao các task do chính mình phụ trách (`assignee === user.name`).
   * **Nghỉ phép/Remote:** Chỉ được nộp đơn cho chính mình.
   * **Bảng lương:** Chỉ được xem phiếu lương của chính mình. Mọi hành vi tra cứu email của người khác sẽ bị máy chủ MCP từ chối và báo lỗi **`Permission Denied`** lập tức.

---

## 💻 2. Hướng Dẫn Tự Kết Nối MCP Vào IDE (Dành Cho Từng Nhân Sự)

Nhân viên có thể tích hợp trực tiếp máy chủ MCP này vào **VSCode (Extension Antigravity / Codex)** hoặc **Cursor** để điều khiển, ra lệnh bằng giọng nói/ngôn ngữ tự nhiên ngay khi đang code.

### Bước 1: Build mã nguồn trên máy
Chạy các lệnh sau trong thư mục dự án:
```bash
npm install
npm run build
```

### Bước 2: Cấu hình IDE

#### A. Cấu hình cho VSCode (Antigravity hoặc Codex Extension)
1. Mở file cấu hình MCP của VSCode (thường nằm ở `~/.vscode/mcp-config.json` hoặc trong settings của extension).
2. Dán đoạn cấu hình sau và **thay đổi Email tương ứng của bạn**:
```json
{
  "mcpServers": {
    "storymeeteam-mcp": {
      "command": "node",
      "args": ["/Users/imam/storymee/2-MCP-Core/storymeeteam-mcp/build/index.js"],
      "env": {
        "STORYMEE_USER_EMAIL": "zuzzivn@gmail.com",
        "NODE_ENV": "production"
      }
    }
  }
}
```

#### B. Cấu hình cho Cursor IDE
1. Mở **Cursor Settings** ➔ **Features** ➔ **MCP**.
2. Bấm **+ Add New MCP Server**.
3. Điền các thông tin:
   * **Name:** `storymeeteam-mcp`
   * **Type:** `command`
   * **Command:** `node /Users/imam/storymee/2-MCP-Core/storymeeteam-mcp/build/index.js`
4. Để cấu hình email cá nhân, bạn có thể truyền biến môi trường qua script shell khởi động Cursor hoặc sửa file cấu hình JSON của Cursor tại:
   * macOS: `~/Library/Application Support/Cursor/User/globalStorage/moose.cursor-vip/mcpjson.json` (hoặc tương đương)
   * Windows: `%APPDATA%\Cursor\User\globalStorage\moose.cursor-vip\mcpjson.json`

---

## 💬 3. Các Câu Lệnh Mẫu Để Ra Lệnh Cho AI (Antigravity/Codex)

Sau khi kết nối thành công, bạn có thể chat trực tiếp trong IDE:
* *"Báo cáo cho tôi danh sách task mình cần làm"* $\rightarrow$ AI tự động gọi tool `get_my_tasks`.
* *"Tôi đã code xong task T-103, chuyển sang Done giúp tôi"* $\rightarrow$ AI tự động gọi tool `update_task_status`.
* *"Xin nghỉ remote ngày mai thứ ba buổi sáng vì đi khám bệnh"* $\rightarrow$ AI tự động phân tích và gọi `submit_leave_request` chính xác.
* *"Xem bảng lương tháng này của tôi nhận được bao nhiêu tiền"* $\rightarrow$ AI tự động gọi `get_my_payroll_slip`.
* *"Cập nhật số tài khoản nhận lương của tôi là 0123456789 tại Techcombank"* $\rightarrow$ AI tự động gọi `update_personal_info`.
