import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Trả về danh sách announcements
export async function GET() {
  try {
    const file = path.join(process.cwd(), 'data', 'omni_announcements.json');
    let announcements = [];
    if (fs.existsSync(file)) {
      announcements = JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    return NextResponse.json({ status: 'success', data: announcements });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Thêm mới announcement (ví dụ bot Telegram gửi thông báo deadline cận kề)
export async function POST(request: Request) {
  try {
    const { title, content, sender } = await request.json();
    if (!title || !content) {
      return NextResponse.json({ error: 'Title và content là bắt buộc' }, { status: 400 });
    }

    const logDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const file = path.join(logDir, 'omni_announcements.json');
    let announcements = [];
    if (fs.existsSync(file)) {
      announcements = JSON.parse(fs.readFileSync(file, 'utf8'));
    }

    const newAnn = {
      id: `ann-auto-${Date.now()}`,
      title,
      content,
      sender: sender || 'Hệ thống tự động',
      date: new Date().toISOString().substring(0, 10),
      readBy: []
    };

    announcements.unshift(newAnn);
    
    // Giới hạn tối đa 50 thông báo gần nhất
    announcements = announcements.slice(0, 50);
    fs.writeFileSync(file, JSON.stringify(announcements, null, 2));

    return NextResponse.json({ status: 'success', data: newAnn });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
