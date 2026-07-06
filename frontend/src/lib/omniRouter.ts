import { fetchAxios } from './fetchAxios';
import { TEAM } from '@/app/constants';

const USE_OMNIR_CLOUD = true;
const FALLBACK_TO_DIRECT_API = true;
const OMNIR_BASE_URL = process.env.OMNIR_BASE_URL || 'http://localhost:20128/v1';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyC7lBGGw_c2sM6RHif2k32E6mAiZBzCUyY';

// 1. Thuật toán nén ngữ cảnh Caveman cục bộ (Caveman Compression)
export function compressPromptCaveman(text: string): string {
  if (!text) return '';
  let clean = text.toLowerCase().trim();
  
  // Loại bỏ các từ đệm, từ nối tiếng Việt rác để tiết kiệm token
  const stopWords = [
    'ạ', 'nhé', 'giúp em', 'cho em', 'xin', 'với ạ', 'chào sếp', 'chào trợ lý', 
    'phiền bạn', 'làm ơn', 'cảm ơn', 'thân mến', 'vui lòng', 'hộ em', 'nhỉ'
  ];
  
  stopWords.forEach(word => {
    clean = clean.replaceAll(word, '');
  });

  // Tối giản hóa các cụm từ mệnh lệnh
  clean = clean
    .replace(/hoàn thành công việc|hoàn thành task/g, 'xong task')
    .replace(/chuyển trạng thái sang|kéo trạng thái sang/g, 'chuyển task')
    .replace(/người phụ trách cho/g, 'giao')
    .replace(/cập nhật hạn chót cho|lùi deadline cho/g, 'lùi deadline');

  return clean.replace(/\s+/g, ' ').trim();
}

// 2. Thuật toán cắt tỉa ngữ cảnh (Context Pruning)
export function pruneTaskPayload(tasks: any[], activeUser?: string): any[] {
  if (!tasks) return [];
  
  // Chỉ gửi các task chưa hoàn thành và liên quan trực tiếp đến user (hoặc gửi toàn bộ task chưa xong nếu là sếp)
  const isBoss = activeUser === 'Kim Ngân';
  const filtered = tasks.filter(t => {
    if (t.status === 'Done') return false; // Lọc bỏ các task đã xong
    if (isBoss) return true;
    return t.assignee === activeUser;
  });

  // Chỉ giữ lại các thuộc tính cốt lõi để nén dung lượng token gửi đi
  return filtered.map(t => ({
    id: t.id,
    title: t.title,
    assignee: t.assignee,
    status: t.status,
    deadline: t.deadline,
    estimate: t.estimate
  }));
}

// 3. Thuật toán mặt nạ bảo mật dữ liệu (Data Masking)
export function maskSensitiveData(text: string): { maskedText: string; mappings: Record<string, string> } {
  let maskedText = text;
  const mappings: Record<string, string> = {};
  
  // Ẩn danh tên nhân sự thành các mã Staff_A, Staff_B...
  const teamList = ['Kim Ngân', 'Quang Minh', 'Đức Anh', 'Quỳnh Hương', 'Hồng Nhung'];
  teamList.forEach((name, index) => {
    const placeholder = `Staff_${String.fromCharCode(65 + index)}`; // Staff_A, Staff_B...
    if (maskedText.includes(name)) {
      maskedText = maskedText.replaceAll(name, placeholder);
      mappings[placeholder] = name;
    }
  });

  // Ẩn danh các số tài khoản ngân hàng nếu có
  const bankMatch = maskedText.match(/\b\d{8,16}\b/g);
  if (bankMatch) {
    bankMatch.forEach((account, index) => {
      const placeholder = `Bank_Account_${index + 1}`;
      maskedText = maskedText.replaceAll(account, placeholder);
      mappings[placeholder] = account;
    });
  }

  return { maskedText, mappings };
}

// Giải mã ngược thông tin thực tế từ AI trả về
export function unmaskSensitiveData(text: string, mappings: Record<string, string>): string {
  let unmaskedText = text;
  Object.entries(mappings).forEach(([placeholder, realValue]) => {
    unmaskedText = unmaskedText.replaceAll(placeholder, realValue);
  });
  return unmaskedText;
}

// 4. Hàm định tuyến LLM chính (OmniRouter Controller)
export async function routeLLMRequest({
  prompt,
  systemPrompt = '',
  history = [],
  tier = 'low',
  responseSchema,
  temperature = 0.3,
  currentUser,
  config
}: {
  prompt: string;
  systemPrompt?: string;
  history?: any[];
  tier?: 'low' | 'mid' | 'high';
  responseSchema?: any;
  temperature?: number;
  currentUser?: string;
  config?: {
    useCloud?: boolean;
    useFallback?: boolean;
    useMasking?: boolean;
    useCompression?: boolean;
  }
}) {
  const startTime = Date.now();
  
  const useCloud = config?.useCloud ?? true;
  const useFallback = config?.useFallback ?? true;
  const useMasking = config?.useMasking ?? true;
  const useCompression = config?.useCompression ?? true;

  // Lựa chọn model tối ưu theo độ phức tạp tác vụ
  const model = tier === 'low' ? 'gemini/gemini-2.5-flash' : 'gemini/gemini-2.5-pro';

  // Áp dụng nén Caveman cho prompt đầu vào để tiết kiệm token
  const processedPrompt = useCompression ? compressPromptCaveman(prompt) : prompt;

  // Áp dụng mặt nạ ẩn danh bảo mật dữ liệu
  let maskedPrompt = processedPrompt;
  let maskedSystemPrompt = systemPrompt;
  let combinedMappings: Record<string, string> = {};

  if (useMasking) {
    const { maskedText: mPrompt, mappings: promptMappings } = maskSensitiveData(processedPrompt);
    const { maskedText: mSys, mappings: systemMappings } = maskSensitiveData(systemPrompt);
    maskedPrompt = mPrompt;
    maskedSystemPrompt = mSys;
    combinedMappings = { ...promptMappings, ...systemMappings };
  }

  // Xây dựng payload contents
  const contents = [
    {
      role: 'user',
      parts: [{ text: maskedSystemPrompt }]
    },
    ...history.map(h => ({
      role: h.role === 'model' ? 'model' : 'user',
      parts: [{ text: h.parts?.[0]?.text || '' }]
    })),
    {
      role: 'user',
      parts: [{ text: maskedPrompt }]
    }
  ];

  let rawReply = '';
  let status = 'Success';

  // Hướng 1: Gọi qua Cloud Gateway của OmniRoute
  if (useCloud) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.warn("OmniRoute Cloud Gateway timeout sau 5 giây!");
    }, 5000);

    try {
      const res = await fetchAxios(`${OMNIR_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer omnir-free-token-pool-key'
        },
        body: JSON.stringify({
          model: model,
          messages: contents.map(c => ({
            role: c.role === 'model' ? 'assistant' : 'user',
            content: c.parts[0].text
          })),
          temperature,
          stream: true,
          response_format: responseSchema ? { type: 'json_object' } : undefined
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        let accumulated = '';
        if (res.body) {
          for await (const chunk of res.body as any) {
            const text = typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
            const lines = text.split('\n');
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data: ')) {
                const dataStr = trimmed.substring(6);
                if (dataStr === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(dataStr);
                  const delta = parsed.choices?.[0]?.delta?.content || '';
                  accumulated += delta;
                } catch (e) {
                  // Ignore incomplete JSON chunks
                }
              }
            }
          }
        }
        rawReply = accumulated;
        status = 'Success (Cloud)';
      } else {
        throw new Error(`OmniRoute Cloud API error status: ${res.status}`);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.warn("Lỗi kết nối OmniRoute Cloud, tự động chuyển đổi sang dự phòng trực tiếp:", err.name === 'AbortError' ? 'Timeout 5s' : err.message);
      if (!useFallback) throw err;
      status = 'Fallback (Direct)';
    }
  }

  // Hướng 2: Gọi trực tiếp API chính thức của Google Gemini (Cục bộ/Dự phòng đứt cáp)
  if (!useCloud || status === 'Fallback (Direct)') {
    const directModel = model.includes('/') ? model.split('/')[1] : model;
    const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/${directModel}:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await fetchAxios(directUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          responseMimeType: responseSchema ? 'application/json' : 'text/plain',
          responseSchema: responseSchema || undefined,
          temperature
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Direct Gemini API Error: ${errText}`);
    }

    const data = await response.json();
    rawReply = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (status !== 'Fallback (Direct)') {
      status = 'Success (Direct)';
    }
  }

  const replyText = useMasking ? unmaskSensitiveData(rawReply, combinedMappings) : rawReply;
  const latency = Date.now() - startTime;

  return {
    reply: replyText,
    log: {
      timestamp: new Date().toLocaleTimeString('vi-VN'),
      model,
      latency,
      status
    }
  };
}
