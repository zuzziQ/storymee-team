import { NextResponse } from 'next/server';
import { routeLLMRequest } from '@/lib/omniRouter';
import { authenticateTeamRoute, teamRouteError } from '@/lib/teamRouteAuth';

export const maxDuration = 60; // Allow longer execution time for LLM

export async function POST(request: Request) {
  try {
    await authenticateTeamRoute(request, 'ai-breakdown', 15);
    const body = await request.json();
    const title = body.title || body.task?.title;
    const description = body.description || body.task?.description;
    const config = body.config;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const systemPrompt = `Bạn là một trợ lý quản lý dự án chuyên nghiệp.
Nhiệm vụ của bạn là phân rã công việc sau thành các công việc con (subtasks) cụ thể, thực tế và có thể thực hiện được ngay.

Hãy tạo ra từ 3 đến 7 subtasks rõ ràng, bằng tiếng Việt.
Trả về kết quả dưới dạng một mảng JSON các object, mỗi object chỉ chứa trường "title" mô tả ngắn gọn công việc con đó.`;

    const prompt = `**Tiêu đề công việc:** ${title}
**Mô tả chi tiết:** ${description || 'Không có mô tả chi tiết.'}`;

    const schema = {
      type: 'ARRAY',
      description: 'Danh sách các công việc con cần thực hiện',
      items: {
        type: 'OBJECT',
        properties: {
          title: {
            type: 'STRING',
            description: 'Tiêu đề của công việc con, viết bằng tiếng Việt',
          },
        },
        required: ['title'],
      },
    };

    // Gọi LLM thông qua cổng OmniRouter (sử dụng tier 'mid' -> Gemini Pro)
    const { reply, log } = await routeLLMRequest({
      prompt,
      systemPrompt,
      tier: 'mid',
      responseSchema: schema,
      temperature: 0.2,
      config
    });

    if (!reply) {
      throw new Error('No content returned from OmniRouter');
    }

    // Parse JSON string
    const subtaskTitles: { title: string }[] = JSON.parse(reply.trim());
    
    // Convert to the frontend SubTask format
    const subtasks = subtaskTitles.map((item, index) => ({
      id: `ai-${Date.now()}-${index}`,
      title: item.title,
      isDone: false,
    }));

    return NextResponse.json({
      status: 'success',
      data: { subtasks },
      log
    });
  } catch (error: any) {
    console.error('API Breakdown Error:', error);
    return teamRouteError(error);
  }
}
