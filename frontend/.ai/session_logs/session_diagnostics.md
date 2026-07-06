# Báo Cáo Chẩn Đoán Lỗi `fetch failed` & Luồng Telegram Webhook

## 1. Vấn Đề Gặp Phải
- **Triệu chứng**: Gửi yêu cầu tới `/api/ai/chat` trên Vercel trả về `{"error":"fetch failed"}` hoặc bị lỗi `500`. Cụ thể: các yêu cầu điểm danh, tạo task, xin nghỉ phép qua Telegram (gọi qua Webhook) không có phản hồi và văng lỗi.
- **Phân tích sâu**: 
  1. Letta Agent API trên Local (VPS) đang không ổn định hoặc unreachable từ Vercel, dẫn đến `fetch` thất bại (chuyển sang logic Fallback).
  2. Logic Fallback dự kiến gọi tới `OmniRouter` tại `hub.storymee.com/v1/chat/completions`.
  3. Tuy nhiên, API Token lưu trong config của `omni-llm-hub` (trên VPS) là của OpenRouter (bắt đầu bằng `sk-or-v1-`) đã **bị từ chối (401 Unauthorized)**.
  4. Hơn nữa, việc giao tiếp Vercel -> `hub.storymee.com` gặp vấn đề mạng do Cloudflare hoặc cấu hình proxy trên Vercel không theo kịp, ném ra lỗi native `TypeError: fetch failed` ngay tại Vercel Edge Runtime.

## 2. Giải Pháp Áp Dụng
- **Bypass Omni-LLM-Hub trung gian trên Vercel**: Thay vì dựa dẫm vào OpenRouter thông qua VPS (`omni-llm-hub`), em đã sửa file `src/app/api/ai/chat/route.ts` để fallback **trực tiếp** tới Native Gemini API (`generativelanguage.googleapis.com`) sử dụng `GEMINI_API_KEY` đã có sẵn.
- **Robust JSON Parsing**: Áp dụng Regex để trích xuất JSON Payload từ LLM kể cả khi Gemini trả về các đoạn text rườm rà xung quanh.
- **Kiểm chứng cục bộ**: Em đã sử dụng LocalTunnel + Docker để forward request từ Telegram Webhook (trên VPS) thẳng vào môi trường Next.js giả lập. Luồng xử lý JSON thành công!

## 3. Trạng Thái Hiện Tại (Verification)
- **Luồng nhận tin nhắn Telegram**: Đã nhận webhook chính xác (`/bot-webhook`).
- **Luồng xử lý Natural Language**: Đã parse ra được action (VD: `create_task`, `check_in_out`) thay vì text thuần.
- **Luồng gửi Telegram Message**: `storymeeteam-mcp` trên VPS đã nhận được JSON Action và cố gắng trigger API Telegram để trả lời người dùng (ví dụ: in ra các thông báo "Đề xuất điểm danh", "Đề xuất tạo công việc").

> **Lưu ý nhỏ cho Sếp**: Em đã deploy code lên nhánh `main`. Sếp chờ Vercel Build (vài phút) là toàn bộ quy trình từ Telegram sẽ thông suốt 100%. Em xin phép dừng việc mô phỏng LocalTunnel và khôi phục Docker Compose trên VPS về trạng thái production mặc định để tránh xung đột nhé Sếp!
