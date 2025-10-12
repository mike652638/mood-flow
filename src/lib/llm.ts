// 定义 ChatMessage 接口
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// 运行时配置优先（生产环境可通过 window.__RUNTIME_CONFIG__ 注入密钥，避免打包泄露）
declare global {
  interface Window {
    __RUNTIME_CONFIG__?: {
      DEEPSEEK_BASE_URL?: string;
      DEEPSEEK_API_KEY?: string;
      DEEPSEEK_MODEL?: string;
    };
    Capacitor?: {
      isNativePlatform?: () => boolean;
    };
  }
}

const getRuntime = () => window.__RUNTIME_CONFIG__ || {};

// 获取配置值的函数，添加调试信息
const getConfig = () => {
  const runtime = getRuntime();
  const envApiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
  const envBaseUrl = import.meta.env.VITE_DEEPSEEK_BASE_URL;
  const envModel = import.meta.env.VITE_DEEPSEEK_MODEL;

  return {
    BASE_URL: runtime.DEEPSEEK_BASE_URL || envBaseUrl || 'https://api.deepseek.com',
    API_KEY: runtime.DEEPSEEK_API_KEY || envApiKey || '',
    MODEL: runtime.DEEPSEEK_MODEL || envModel || 'deepseek-chat'
  };
};

export interface ChatOptions {
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  systemPrompt?: string;
  signal?: AbortSignal;
}

export interface ChatResult {
  content: string;
}

/**
 * 调用 DeepSeek Chat Completions
 * 文档参考：https://api.deepseek.com/
 */
export async function deepseekChat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<ChatResult | AsyncGenerator<string>> {
  // 动态获取最新配置，确保在移动端环境中能正确读取
  const currentConfig = getConfig();

  if (!currentConfig.API_KEY) {
    const errorMsg = `DeepSeek API Key 未配置。请在 .env.local 中设置 VITE_DEEPSEEK_API_KEY
    
调试信息：
- 运行环境: ${typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() ? '移动端原生' : 'Web浏览器'}
- 配置来源: ${window.__RUNTIME_CONFIG__ ? '运行时配置' : '环境变量'}
- API Key 状态: ${currentConfig.API_KEY ? '已配置' : '未配置'}`;

    console.error('[DeepSeek API Error]', errorMsg);
    throw new Error(errorMsg);
  }

  const body = {
    model: currentConfig.MODEL,
    messages: buildMessages(messages, options.systemPrompt),
    stream: !!options.stream,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens ?? 512
  };

  const url = `${currentConfig.BASE_URL}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${currentConfig.API_KEY}`
  };

  if (options.stream) {
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: options.signal });
    if (!response.ok || !response.body) {
      const text = await response.text();
      throw new Error(`DeepSeek 请求失败: ${response.status} ${text}`);
    }

    // 解析 SSE 流，产出 content 增量
    async function* streamGenerator() {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const l = line.trim();
          if (!l.startsWith('data:')) continue;
          const payload = l.slice(5).trim();
          if (payload === '[DONE]') {
            return;
          }
          try {
            const json = JSON.parse(payload);
            const delta = json?.choices?.[0]?.delta?.content ?? '';
            if (delta) {
              yield delta as string;
            }
          } catch {
            // 忽略解析异常的片段
          }
        }
      }
    }

    return streamGenerator();
  } else {
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: options.signal });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`DeepSeek 请求失败: ${response.status} ${text}`);
    }
    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content ?? '';
    return { content };
  }
}

// 简易重试封装：对非流或流式首包失败场景进行指数退避重试
export async function deepseekChatWithRetry(
  messages: ChatMessage[],
  options: ChatOptions = {},
  maxRetries: number = 2
): Promise<ChatResult | AsyncGenerator<string>> {
  let attempt = 0;
  let lastError: unknown = null;
  const baseDelay = 500;
  while (attempt <= maxRetries) {
    try {
      return await deepseekChat(messages, options);
    } catch (e) {
      lastError = e;
      if (attempt === maxRetries) break;
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(res => setTimeout(res, delay));
      attempt++;
    }
  }
  throw lastError ?? new Error('重试后仍然失败');
}

function buildMessages(messages: ChatMessage[], systemPrompt?: string) {
  const final = [...messages];
  if (systemPrompt) {
    final.unshift({ role: 'system', content: systemPrompt } as ChatMessage);
  }
  return final.map(m => ({ role: m.role, content: m.content }));
}

// 提示工程模板：个性化约束与输出要求
export function buildMentorSystemPrompt(params: { avg7d: number; mostMood: string; todayCount: number }): string {
  return [
    '你是一位温暖、稳重的 AI 伴侣。',
    '请遵循：',
    '1) 不提供医疗诊断或治疗承诺；使用一般性健康建议。',
    '2) 优先给出可执行的短练习（呼吸、正念、认知重构、grounding）。',
    '3) 用分段输出（每段≤3行），适合移动端阅读。',
    '4) 保持共情、尊重与不评判。',
    '5) 若出现危机或自伤他伤风险，提醒联系当地紧急热线。',
    '',
    `参考数据：近7天平均强度=${params.avg7d}，高频情绪=${params.mostMood}，今日记录数=${params.todayCount}。`,
    '在回答中结合这些信息，给出具体、温和、分点的建议。'
  ].join('\n');
}

// 认知重构草案提示
export function buildReframePrompt(input: {
  scene?: string;
  automaticThought?: string;
  evidenceFor?: string;
  evidenceAgainst?: string;
}): string {
  const lines = [
    '你是一位认知疗法风格的导师。请基于下述信息，生成“更平衡的替代陈述”草案，语气温和，避免医疗宣称。',
    '输出要求：',
    '1) 先简短共情；',
    '2) 给出1-2条更客观的替代陈述；',
    '3) 最后提供一个可执行的小练习（例如记录证据、呼吸或grounding）；',
    '',
    `场景：${input.scene || '（未提供）'}`,
    `自动化想法：${input.automaticThought || '（未提供）'}`,
    `支持证据：${input.evidenceFor || '（未提供）'}`,
    `反对证据：${input.evidenceAgainst || '（未提供）'}`
  ];
  return lines.join('\n');
}
