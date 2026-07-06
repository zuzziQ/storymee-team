import { NextResponse } from 'next/server';
import { routeLLMRequest } from '@/lib/omniRouter';

export async function POST(request: Request) {
  try {
    const { project, tasks, config } = await request.json();

    if (!project) {
      return NextResponse.json({ error: 'Project is required' }, { status: 400 });
    }

    const systemPrompt = `Bạn là chuyên gia phân tích dự án SRE kiêm trợ lý quản lý dự án AI.
Nhiệm vụ của bạn là phân tích sức khỏe, tiến độ và rủi ro trễ hạn của dự án dựa trên dữ liệu thật.

Hãy thực hiện phân tích:
1. Đánh giá tiến độ hiện tại (tỷ lệ hoàn thành công việc).
2. Chỉ ra các thế mạnh (điểm đã làm tốt, nhân sự hoàn thành sớm).
3. Phát hiện rủi ro trễ hạn (các task In Progress hoặc Todo có hạn chót cận kề, nhân sự bị quá tải công việc, VD: tổng ước tính vượt quá 30 giờ).
4. Đưa ra đề xuất điều phối cụ thể (bàn giao task, hỗ trợ kỹ thuật).
5. Dự báo:
   - Tỷ lệ khả năng hoàn thành dự án đúng hạn (successRate, số nguyên từ 0 đến 100).
   - Ngày dự kiến hoàn thành dự án (predictedCompletionDate, định dạng DD/MM/YYYY).`;

    const prompt = `Dữ liệu Dự án:
- Tên dự án: ${project.name}
- Mô tả: ${project.description}
- Các công việc thuộc dự án (tasks): ${JSON.stringify(tasks)}`;

    const schema = {
      type: 'OBJECT',
      properties: {
        successRate: { type: 'INTEGER', description: 'Phần trăm khả năng thành công dự báo (0-100)' },
        predictedCompletionDate: { type: 'STRING', description: 'Ngày hoàn thành dự báo dạng DD/MM/YYYY' },
        insights: { type: 'STRING', description: 'Nhận xét chi tiết viết bằng markdown' }
      },
      required: ['successRate', 'predictedCompletionDate', 'insights']
    };

    // Gọi LLM thông qua cổng OmniRouter (sử dụng tier 'high' -> Gemini Pro)
    const { reply, log } = await routeLLMRequest({
      prompt,
      systemPrompt,
      tier: 'high',
      responseSchema: schema,
      temperature: 0.2,
      config
    });

    if (!reply) {
      throw new Error('No content returned from OmniRouter');
    }

    const result = JSON.parse(reply.trim());
    return NextResponse.json({ status: 'success', data: result, log });
  } catch (error: any) {
    console.error('API Project Insights Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
