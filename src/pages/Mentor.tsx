import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Send, Menu, Plus, X, Phone, RotateCcw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import Card from '../components/Card';
import Container from '../components/Container';
import Header from '../components/Header';
import Modal from '../components/Modal';
import { useImmersiveMode } from '../hooks/useImmersiveMode';

import { deepseekChatWithRetry, buildMentorSystemPrompt } from '../lib/llm';
import { useNetworkStatus, useIsMobile } from '../hooks/useMobile';
import { cn } from '../utils/cn';
import { chatPresetGroups } from '../constants/presets';

// personaPrompt（AI角色提示词）
const personaPrompt = `
角色：温暖、稳重的 AI 伴侣。你的目标是在当下帮助用户缓解情绪、获得清晰，并形成可持续的自助练习与反思。

原则：
- 使用中文、短句、友善且不评判；先共情再给建议。
- 不进行医疗诊断或治疗承诺；不讨论药物或替代专业治疗。
- 若出现自伤/他伤/严重危机信号，温柔提醒联系当地紧急热线或可信任的人，并建议立即寻求线下帮助。

回应结构（按序）：
1) 共情与归纳：用 1–2 句准确复述用户的核心感受/困扰。
2) 微建议或练习：从“呼吸练习”“正念冥想”“5-4-3-2-1锚定练习”“认知重构”中挑选最贴切的 1 项，给出 2–5 步的简明操作与预计时长（如 3 分钟）。可提示“点击下方按钮开始”。
3) 追问：提出一个具体的小问题，帮助澄清诱因、需求或边界。
4) 可保存要点：给出 1–3 条可记录到日记的关键词或句子。

风格与限制：
- 每次回复控制在 120–220 字；问题复杂时分段逐步推进。
- 避免夸大或不确定断言；不确定就诚实说明并给出可行替代。
- 不索取或存储敏感个人信息；尊重用户节奏与文化背景。
`;

interface ChatBubble {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  streamStartAt?: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatBubble[];
  createdAt: number;
  updatedAt: number;
}

// 智能判断是否显示练习按钮的函数
const shouldShowExerciseButton = (
  content: string,
  exerciseType: 'breathing' | 'reframe' | 'grounding' | 'mindfulness'
): boolean => {
  switch (exerciseType) {
    case 'breathing':
      return /呼吸|焦虑|紧张|压力|放松|冷静|深呼吸|breathing|anxiety|stress|relax|calm/i.test(content);
    case 'reframe':
      return /想法|思维|认知|重构|负面|消极|思考|perspective|thought|cognitive|reframe|negative/i.test(content);
    case 'grounding':
      return /感官|当下|专注|注意力|锚定|grounding|present|focus|attention|mindful/i.test(content);
    case 'mindfulness':
      return /正念|冥想|觉察|当下|专注呼吸|mindfulness|meditation/i.test(content);
    default:
      return false;
  }
};

// AI 头像组件（优先使用实际图片，失败时回退到内置样式）
const AIAvatar: React.FC = () => {
  const [imgError, setImgError] = useState(false);
  return (
    <div className='flex justify-center mb-6'>
      <div className='relative'>
        <div className='w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-800/30 dark:to-purple-700/20 border-2 border-white dark:border-gray-700 shadow-lg flex items-center justify-center'>
          {/* 优先显示实际头像图片，加载失败时回退到原“AI 头像”样式 */}
          {!imgError ? (
            <img
              src='/avatar-mentor.gif'
              alt='导师头像'
              className='w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover'
              onError={() => setImgError(true)}
            />
          ) : (
            <div className='w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center'>
              <div className='text-white text-2xl sm:text-3xl font-bold'>AI</div>
            </div>
          )}
        </div>
        {/* 通话图标 */}
        <div
          onClick={() =>
            toast.info('AI 伴侣语音通话功能正在开发中 ...', {
              description: '敬请期待后续版本的智能语音通话体验'
            })
          }
          role='button'
          title='语音通话'
          aria-label='AI 语音通话正在开发中'
          className='absolute bottom-0 right-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-700 shadow-md cursor-pointer hover:scale-105 active:scale-95 transition-transform'>
          <Phone className='w-4 h-4 text-white' />
        </div>
      </div>
    </div>
  );
};

// 预设问题组件
const PresetQuestions: React.FC<{
  questions: string[];
  onQuestionClick: (question: string) => void;
  onRefresh: () => void;
}> = ({ questions, onQuestionClick, onRefresh }) => {
  return (
    <div className='mb-6'>
      <div className='space-y-3 mb-4'>
        {questions.map((question, index) => (
          <button
            key={index}
            onClick={() => onQuestionClick(question)}
            className='w-full p-4 text-left bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-xl border border-blue-200/50 dark:border-blue-700/30 transition-all duration-200 text-blue-800 dark:text-blue-200 text-sm sm:text-base'>
            {question}
          </button>
        ))}
      </div>

      <button
        onClick={onRefresh}
        className='flex items-center gap-2 mx-auto px-4 py-2 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors duration-200'>
        <RotateCcw className='w-4 h-4' />
        <span className='text-sm'>换一换</span>
      </button>
    </div>
  );
};

// 历史会话抽屉组件
const HistoryDrawer: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onNewSession: () => void;
}> = ({ isOpen, onClose, sessions, currentSessionId, onSessionSelect, onNewSession }) => {
  if (!isOpen) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div className='fixed inset-0 bg-black/50 z-40 transition-opacity duration-300' onClick={onClose} />

      {/* 抽屉内容 */}
      <div className='fixed left-0 top-0 h-full w-80 bg-white dark:bg-gray-800 z-50 transform transition-transform duration-300 shadow-xl'>
        <div className='flex flex-col h-full'>
          {/* 抽屉头部 */}
          <div className='flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700'>
            <h2 className='text-lg font-semibold text-gray-800 dark:text-gray-200'>历史会话</h2>
            <button
              onClick={onNewSession}
              title='新建会话'
              aria-label='新建会话'
              className='p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 text-purple-600 dark:text-purple-400 transition-colors duration-200'>
              <Plus className='w-5 h-5' />
            </button>
          </div>

          {/* 会话列表 */}
          <div
            className='flex-1 overflow-y-auto p-4 space-y-2 pb-safe-area-inset-bottom'
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 80px)' }}>
            {sessions.length === 0 ? (
              <div className='text-center text-gray-500 dark:text-gray-400 py-8'>暂无历史会话</div>
            ) : (
              sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => {
                    onSessionSelect(session.id);
                    onClose();
                  }}
                  className={cn(
                    'w-full p-3 text-left rounded-lg transition-all duration-200',
                    currentSessionId === session.id
                      ? 'bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700'
                      : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
                  )}>
                  <div className='font-medium text-gray-800 dark:text-gray-200 text-sm truncate'>{session.title}</div>
                  <div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                    {new Date(session.updatedAt).toLocaleDateString()}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// 新会话界面组件
const NewSessionView: React.FC<{
  onQuestionSubmit: (question: string) => void;
  onStartExercise: () => void;
}> = ({ onQuestionSubmit, onStartExercise }) => {
  const [currentPresetIndex, setCurrentPresetIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');

  const currentPresets = useMemo(() => {
    const allPresets = chatPresetGroups.flatMap(group => group.items);
    const startIndex = (currentPresetIndex * 2) % allPresets.length;
    return allPresets.slice(startIndex, startIndex + 2);
  }, [currentPresetIndex]);

  const handleRefreshPresets = () => {
    setCurrentPresetIndex(prev => prev + 1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onQuestionSubmit(inputValue.trim());
      setInputValue('');
    }
  };

  const handlePresetClick = (preset: string) => {
    if (preset && preset.trim()) {
      onQuestionSubmit(preset);
    }
  };

  return (
    <div className='flex flex-col h-full min-h-0'>
      {/* 主要内容区域 - 可滚动 */}
      <div className='flex-1 flex flex-col justify-center px-4 pb-8 min-h-0 overflow-y-auto'>
        {/* AI 头像 */}
        <AIAvatar />

        {/* AI 简介 */}
        <div className='text-center mb-8'>
          <p className='text-gray-600 dark:text-gray-400 text-sm sm:text-base px-4'>
            我是您的专属 AI 伴侣，随时为您提供温暖的心理陪伴与温和的情绪疏导
          </p>
        </div>

        {/* 预设问题 */}
        <PresetQuestions
          questions={currentPresets}
          onQuestionClick={handlePresetClick}
          onRefresh={handleRefreshPresets}
        />
      </div>

      {/* 底部输入区域 - 固定在底部 */}
      <div className='flex-shrink-0 px-4 pb-4'>
        {/* 快捷按钮 */}
        <div className='flex justify-center mb-4'>
          <button
            onClick={onStartExercise}
            aria-label='打开疏导练习抽屉'
            className='group px-5 sm:px-6 py-2.5 sm:py-3 rounded-full bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-700 hover:to-purple-700 text-white text-sm sm:text-base font-semibold shadow-md hover:shadow-lg ring-2 ring-purple-200/60 dark:ring-purple-700/40 transition-all duration-200 active:scale-95 bg-[length:220%_220%] animate-[gradient-shift_6s_ease_infinite] motion-reduce:animate-none'>
            <span className='flex items-center gap-1.5 sm:gap-2'>
              <Sparkles className='w-4 h-4 sm:w-5 sm:h-5 animate-pulse' />
              <span>开始情绪疏导练习</span>
            </span>
          </button>
        </div>

        {/* 输入卡片 */}
        <Card className='p-4'>
          <form onSubmit={handleSubmit} className='flex gap-3'>
            <input
              type='text'
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder='输入您的问题或想法...'
              className='flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400'
            />
            <button
              type='submit'
              title='发送'
              aria-label='发送'
              disabled={!inputValue.trim()}
              className='p-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-xl transition-colors duration-200 disabled:cursor-not-allowed'>
              <Send className='w-5 h-5' />
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
};

// 消息项组件
const MessageItem = React.memo(
  ({
    m,
    hasConversation,
    onStartBreath,
    onStartReframe,
    onStartGrounding,
    onStartMindfulness,
    onCopyMessage,
    onRegenerateMessage,
    hoveredMessageId,
    onMessageHover
  }: {
    m: ChatBubble;
    hasConversation: boolean;
    onStartBreath: (seconds: number, pace: { inhale: number; hold: number; exhale: number }) => void;
    onStartReframe: () => void;
    onStartGrounding: (initial: number) => void;
    onStartMindfulness: () => void;
    onCopyMessage?: (content: string) => void;
    onRegenerateMessage?: (messageId: string) => void;
    hoveredMessageId?: string | null;
    onMessageHover?: (messageId: string | null) => void;
  }) => {
    const isHovered = hoveredMessageId === m.id;

    const mdComponents = React.useMemo(
      () => ({
        p: ({ children }: { children: React.ReactNode }) => (
          <p className='mb-2 whitespace-pre-wrap leading-relaxed xl:leading-loose'>{children}</p>
        ),
        code: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => {
          const inline = (props as { inline?: boolean }).inline;
          return inline ? (
            <code className='bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm' {...props}>
              {children}
            </code>
          ) : (
            <pre className='bg-gray-100 dark:bg-gray-800 p-3 rounded-lg overflow-x-auto'>
              <code {...props}>{children}</code>
            </pre>
          );
        },
        ul: ({ children }: { children: React.ReactNode }) => <ul className='mb-2 pl-4'>{children}</ul>,
        ol: ({ children }: { children: React.ReactNode }) => <ol className='mb-2 pl-4'>{children}</ol>,
        li: ({ children }: { children: React.ReactNode }) => <li className='mb-1'>{children}</li>,
        blockquote: ({ children }: { children: React.ReactNode }) => (
          <blockquote className='border-l-4 border-purple-500 bg-purple-50 dark:bg-purple-900/20 p-3 rounded-r-lg mb-2'>
            {children}
          </blockquote>
        ),
        h1: ({ children }: { children: React.ReactNode }) => (
          <h1 className='text-xl font-bold mb-2 mt-3'>{children}</h1>
        ),
        h2: ({ children }: { children: React.ReactNode }) => (
          <h2 className='text-lg font-bold mb-2 mt-3'>{children}</h2>
        ),
        h3: ({ children }: { children: React.ReactNode }) => (
          <h3 className='text-base font-bold mb-2 mt-3'>{children}</h3>
        )
      }),
      []
    );

    const estRemainingText = React.useMemo(() => {
      const target = 800;
      const start = m.streamStartAt ?? Date.now();
      const elapsedSec = Math.max(1, (Date.now() - start) / 1000);
      const rate = Math.max(8, m.content.length / elapsedSec);
      const remainingChars = Math.max(0, target - m.content.length);
      const estSec = Math.round(remainingChars / rate);
      const mm = Math.floor(estSec / 60);
      const ss = estSec % 60;
      return `预计剩余 ${mm > 0 ? `${mm}分${ss}秒` : `${ss}秒`}`;
    }, [m.content.length, m.streamStartAt]);

    return (
      <div
        className={
          m.role === 'assistant'
            ? `max-w-[100%] sm:max-w-[98%] md:max-w-[96%] lg:max-w-[94%] xl:max-w-[96%] 2xl:max-w-[98%] bg-gradient-to-br from-purple-50 to-purple-100/80 dark:from-purple-900/20 dark:to-purple-800/10 border border-purple-200/80 dark:border-purple-700/40 ring-1 ring-purple-100/50 dark:ring-purple-700/30 rounded-2xl p-3 sm:p-4 shadow-md hover:shadow-lg dark:shadow-purple-900/10 transition-all duration-300 animate-in slide-in-from-left-2 fade-in-0 relative group`
            : `ml-auto max-w-[100%] sm:max-w-[98%] md:max-w-[96%] lg:max-w-[94%] xl:max-w-[96%] 2xl:max-w-[98%] bg-gradient-to-br from-blue-50 to-blue-100/80 dark:from-blue-900/20 dark:to-blue-800/10 border border-blue-200/80 dark:border-blue-700/40 ring-1 ring-blue-100/50 dark:ring-blue-700/30 rounded-2xl p-3 sm:p-4 shadow-md hover:shadow-lg dark:shadow-blue-900/10 transition-all duration-300 animate-in slide-in-from-right-2 fade-in-0 relative group`
        }
        onMouseEnter={() => onMessageHover?.(m.id)}
        onMouseLeave={() => onMessageHover?.(null)}>
        {/* 消息操作按钮 */}
        {(isHovered || hasConversation) && onCopyMessage && (
          <div className='absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200'>
            <button
              onClick={() => onCopyMessage(m.content)}
              className='p-1.5 rounded-lg bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-all duration-200 shadow-sm hover:shadow-md'
              title='复制消息'>
              <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'
                />
              </svg>
            </button>
            {m.role === 'assistant' && onRegenerateMessage && (
              <button
                onClick={() => onRegenerateMessage(m.id)}
                className='p-1.5 rounded-lg bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-all duration-200 shadow-sm hover:shadow-md'
                title='重新生成'>
                <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                  />
                </svg>
              </button>
            )}
          </div>
        )}

        <div className='text-sm sm:text-base lg:text-lg text-gray-800 dark:text-gray-200 prose prose-sm sm:prose-base lg:prose-lg dark:prose-invert max-w-none prose-p:mb-2 prose-p:leading-relaxed xl:prose-p:leading-loose prose-headings:mb-2 prose-headings:mt-3 prose-ul:mb-2 prose-ol:mb-2 prose-li:mb-1 prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-pre:p-3 prose-pre:rounded-lg prose-blockquote:border-l-purple-500 prose-blockquote:bg-purple-50 dark:prose-blockquote:bg-purple-900/20 prose-blockquote:p-3 prose-blockquote:rounded-r-lg'>
          <ReactMarkdown components={mdComponents}>{m.content}</ReactMarkdown>
        </div>
        {m.streaming && (
          <div className='mt-3 flex items-center gap-3 p-2 rounded-lg bg-purple-100/50 dark:bg-purple-900/30 border border-purple-200/50 dark:border-purple-700/50'>
            <div className='flex items-center gap-2'>
              <div className='flex space-x-1'>
                <div className='w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.3s]'></div>
                <div className='w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]'></div>
                <div className='w-2 h-2 bg-purple-500 rounded-full animate-bounce'></div>
              </div>
              <span className='text-xs sm:text-sm text-purple-700 dark:text-purple-300 font-medium'>
                AI 正在思考...
              </span>
            </div>
            <div className='flex-1 text-right'>
              <span className='text-xs text-purple-600 dark:text-purple-400'>{estRemainingText}</span>
            </div>
          </div>
        )}
        {m.role === 'assistant' && !m.streaming && (
          <div className='mt-3 flex flex-wrap gap-1.5 sm:gap-2'>
            {/* 智能显示练习按钮 - 根据AI回复内容判断 */}
            {shouldShowExerciseButton(m.content, 'breathing') && (
              <>
                <button
                  onClick={() => onStartBreath(180, { inhale: 4, hold: 4, exhale: 6 })}
                  className='group h-8 sm:h-9 px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 hover:from-blue-200 hover:to-blue-100 dark:hover:from-blue-800/40 dark:hover:to-blue-700/30 text-blue-700 dark:text-blue-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700 active:scale-95 border border-blue-200/50 dark:border-blue-700/30 shadow-sm hover:shadow-md'>
                  <span className='flex items-center gap-1 sm:gap-1.5'>
                    <div className='w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 group-hover:animate-pulse'></div>
                    <span className='hidden xs:inline'>呼吸练习 · 3分钟</span>
                    <span className='xs:hidden'>呼吸3分</span>
                  </span>
                </button>
                <button
                  onClick={() => onStartBreath(300, { inhale: 5, hold: 5, exhale: 7 })}
                  className='group h-8 sm:h-9 px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 hover:from-blue-200 hover:to-blue-100 dark:hover:from-blue-800/40 dark:hover:to-blue-700/30 text-blue-700 dark:text-blue-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700 active:scale-95 border border-blue-200/50 dark:border-blue-700/30 shadow-sm hover:shadow-md'>
                  <span className='flex items-center gap-1 sm:gap-1.5'>
                    <div className='w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 group-hover:animate-pulse'></div>
                    <span className='hidden xs:inline'>呼吸练习 · 5分钟（慢）</span>
                    <span className='xs:hidden'>呼吸5分</span>
                  </span>
                </button>
              </>
            )}
            {shouldShowExerciseButton(m.content, 'reframe') && (
              <button
                onClick={onStartReframe}
                className='group h-8 sm:h-9 px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm bg-gradient-to-r from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/20 hover:from-purple-200 hover:to-purple-100 dark:hover:from-purple-800/40 dark:hover:to-purple-700/30 text-purple-700 dark:text-purple-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-700 active:scale-95 border border-purple-200/50 dark:border-purple-700/30 shadow-sm hover:shadow-md'>
                <span className='flex items-center gap-1 sm:gap-1.5'>
                  <div className='w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-purple-500 group-hover:animate-pulse'></div>
                  <span className='hidden xs:inline'>认知重构练习</span>
                  <span className='xs:hidden'>认知重构</span>
                </span>
              </button>
            )}
            {shouldShowExerciseButton(m.content, 'grounding') && (
              <button
                onClick={() => onStartGrounding(15)}
                className='group h-8 sm:h-9 px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm bg-gradient-to-r from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-800/20 hover:from-emerald-200 hover:to-emerald-100 dark:hover:from-emerald-800/40 dark:hover:to-emerald-700/30 text-emerald-700 dark:text-emerald-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-300 dark:focus:ring-emerald-700 active:scale-95 border border-emerald-200/50 dark:border-emerald-700/30 shadow-sm hover:shadow-md'>
                <span className='flex items-center gap-1 sm:gap-1.5'>
                  <div className='w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 group-hover:animate-pulse'></div>
                  <span className='hidden xs:inline'>锚定练习（每步15秒）</span>
                  <span className='xs:hidden'>锚定练习</span>
                </span>
              </button>
            )}
            {shouldShowExerciseButton(m.content, 'mindfulness') && (
              <button
                onClick={onStartMindfulness}
                className='group h-8 sm:h-9 px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/20 hover:from-amber-200 hover:to-amber-100 dark:hover:from-amber-800/40 dark:hover:to-amber-700/30 text-amber-700 dark:text-amber-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-300 dark:focus:ring-amber-700 active:scale-95 border border-amber-200/50 dark:border-amber-700/30 shadow-sm hover:shadow-md'>
                <span className='flex items-center gap-1 sm:gap-1.5'>
                  <div className='w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-500 group-hover:animate-pulse'></div>
                  <span className='hidden xs:inline'>正念冥想 · 10分钟</span>
                  <span className='xs:hidden'>正念冥想</span>
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  },
  (prev, next) =>
    prev.hasConversation === next.hasConversation &&
    prev.m.id === next.m.id &&
    prev.m.role === next.m.role &&
    prev.m.streaming === next.m.streaming &&
    prev.m.content === next.m.content
);

// 呼吸练习组件
const BreathingGuide: React.FC<{
  onClose: () => void;
  totalSeconds?: number;
  pace?: { inhale: number; hold: number; exhale: number };
}> = ({ onClose, totalSeconds = 180, pace = { inhale: 4, hold: 4, exhale: 6 } }) => {
  const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  const [timeLeft, setTimeLeft] = useState(totalSeconds);
  const [isActive, setIsActive] = useState(false);
  const [_phaseTime, setPhaseTime] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
        setPhaseTime(prev => {
          const newTime = prev + 1;
          if (phase === 'inhale' && newTime >= pace.inhale) {
            setPhase('hold');
            return 0;
          } else if (phase === 'hold' && newTime >= pace.hold) {
            setPhase('exhale');
            return 0;
          } else if (phase === 'exhale' && newTime >= pace.exhale) {
            setPhase('inhale');
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timeLeft, phase, pace]);

  const footerButtons = (
    <>
      <button
        onClick={() => setIsActive(!isActive)}
        className='px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600 active:scale-95 shadow-lg'>
        {isActive ? '暂停' : '开始'}
      </button>
      <button
        onClick={() => {
          setTimeLeft(totalSeconds);
          setIsActive(false);
          setPhase('inhale');
          setPhaseTime(0);
        }}
        className='px-6 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-500 active:scale-95'>
        重置
      </button>
    </>
  );

  return (
    <Modal title='呼吸练习' onClose={onClose} footer={footerButtons} className='max-w-md'>
      <div className='text-center'>
        <div className='text-6xl sm:text-7xl mb-4 font-mono text-blue-600 dark:text-blue-400'>
          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
        </div>
        <div className='text-2xl sm:text-3xl font-semibold mb-2 text-gray-800 dark:text-gray-200'>
          {phase === 'inhale' ? '吸气' : phase === 'hold' ? '屏息' : '呼气'}
        </div>
        <div className='text-lg text-gray-600 dark:text-gray-400'>
          {phase === 'inhale' ? pace.inhale : phase === 'hold' ? pace.hold : pace.exhale} 秒
        </div>
      </div>
    </Modal>
  );
};

// 正念冥想组件（10分钟引导，含阶段步骤与计时）
const MindfulnessMeditation: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [_phase, setPhase] = useState<'prepare' | 'breathing' | 'body' | 'thoughts' | 'complete'>('prepare');
  const [timeLeft, setTimeLeft] = useState(600); // 10分钟
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = useMemo(
    () => [
      { phase: 'prepare', title: '准备', desc: '找一个舒适的姿势，闭上眼睛', duration: 30 },
      { phase: 'breathing', title: '专注呼吸', desc: '感受呼吸的自然节律，不要控制', duration: 240 },
      { phase: 'body', title: '身体扫描', desc: '从头到脚感受身体各部位的感觉', duration: 180 },
      { phase: 'thoughts', title: '观察思绪', desc: '注意到想法出现，不评判，让它们自然流过', duration: 120 },
      { phase: 'complete', title: '结束', desc: '慢慢睁开眼睛，回到当下', duration: 30 }
    ],
    []
  );

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          const newTime = prev - 1;
          // 自动切换阶段
          const totalElapsed = 600 - newTime;
          let accumulated = 0;
          for (let i = 0; i < steps.length; i++) {
            accumulated += steps[i].duration;
            if (totalElapsed <= accumulated) {
              setCurrentStep(i);
              setPhase(steps[i].phase as 'prepare' | 'breathing' | 'body' | 'thoughts' | 'complete');
              break;
            }
          }
          return newTime;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timeLeft, steps, setPhase]);

  const footerButtons = (
    <>
      <button
        onClick={() => setIsActive(!isActive)}
        className='px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-300 dark:focus:ring-emerald-500 active:scale-95 shadow-lg'>
        {isActive ? '暂停' : '开始'}
      </button>
      <button
        onClick={() => {
          setTimeLeft(600);
          setIsActive(false);
          setPhase('prepare');
          setCurrentStep(0);
        }}
        className='px-6 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-500 active:scale-95'>
        重置
      </button>
    </>
  );

  return (
    <Modal title='正念冥想' onClose={onClose} footer={footerButtons} className='max-w-md'>
      <div className='space-y-4'>
        <div className='text-center'>
          <div className='text-5xl sm:text-6xl mb-2 font-mono text-emerald-600 dark:text-emerald-400'>
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </div>
          <div className='text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-200'>
            {steps[currentStep]?.title}
          </div>
          <div className='text-gray-600 dark:text-gray-400'>{steps[currentStep]?.desc}</div>
        </div>

        <div className='grid grid-cols-5 gap-2'>
          {steps.map((s, i) => (
            <div
              key={s.phase}
              className={'h-2 rounded-full ' + (i <= currentStep ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700')}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
};

// 认知重构组件
const CognitiveReframe: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [scene, setScene] = useState('');
  const [automaticThought, setAutomaticThought] = useState('');
  const [evidenceFor, setEvidenceFor] = useState('');
  const [evidenceAgainst, setEvidenceAgainst] = useState('');
  const [reframes, setReframes] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  const examples = [
    {
      scene: '工作汇报时紧张',
      thought: '我一定会搞砸，大家会觉得我很无能',
      evidenceFor: '之前有过紧张的经历',
      evidenceAgainst: '我准备充分，同事们都很友善'
    }
  ];

  const generateReframe = async () => {
    if (!scene || !automaticThought) return;

    setIsGenerating(true);
    try {
      // 简化的重构提示，不依赖外部函数
      const prompt = `请帮我重构这个负面想法：

情境：${scene}
负面想法：${automaticThought}
支持证据：${evidenceFor || '无'}
反对证据：${evidenceAgainst || '无'}

请提供3个更平衡、更现实的想法替代版本，每个版本一行。`;

      const result = await deepseekChatWithRetry([{ role: 'user', content: prompt }], { temperature: 0.7 });

      if ('content' in result) {
        const newReframes = result.content.split('\n').filter(line => line.trim());
        setReframes(newReframes);
        setSelectedVersion(0);
      }
    } catch (error) {
      console.error('生成重构失败:', error);
      toast.error('生成重构失败，请稍后重试');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Modal
      title='认知重构练习'
      onClose={onClose}
      footer={
        <>
          <button
            onClick={generateReframe}
            disabled={!scene || !automaticThought || isGenerating}
            className='px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-500 active:scale-95 disabled:cursor-not-allowed'>
            {isGenerating ? '生成中...' : '生成重构'}
          </button>
          <button
            onClick={onClose}
            className='px-5 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-500 active:scale-95'>
            关闭
          </button>
          {reframes.length > 0 && (
            <button
              onClick={() => generateReframe()}
              disabled={isGenerating}
              className='px-5 py-3 rounded-xl bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800/40 text-blue-700 dark:text-blue-200 font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-500 active:scale-95'>
              生成新版本
            </button>
          )}
        </>
      }>
      <div className='space-y-6'>
        <div>
          <label className='block text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2'>情境描述</label>
          <input
            value={scene}
            onChange={e => setScene(e.target.value)}
            placeholder='描述让你困扰的具体情境...'
            className='w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white/80 dark:bg-gray-800/90 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-500 focus:border-transparent transition-all duration-200'
          />
        </div>

        <div>
          <label className='block text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2'>自动化思维</label>
          <textarea
            value={automaticThought}
            onChange={e => setAutomaticThought(e.target.value)}
            placeholder='写下你的第一反应和负面想法...'
            rows={3}
            className='w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white/80 dark:bg-gray-800/90 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-500 focus:border-transparent transition-all duration-200 resize-none'
          />
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <div>
            <label className='block text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2'>支持证据</label>
            <textarea
              value={evidenceFor}
              onChange={e => setEvidenceFor(e.target.value)}
              placeholder='有什么证据支持这个想法？'
              rows={3}
              className='w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white/80 dark:bg-gray-800/90 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-500 focus:border-transparent transition-all duration-200 resize-none'
            />
          </div>
          <div>
            <label className='block text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2'>反对证据</label>
            <textarea
              value={evidenceAgainst}
              onChange={e => setEvidenceAgainst(e.target.value)}
              placeholder='有什么证据反对这个想法？'
              rows={3}
              className='w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white/80 dark:bg-gray-800/90 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-500 focus:border-transparent transition-all duration-200 resize-none'
            />
          </div>
        </div>

        <div className='flex flex-wrap gap-3'>
          {examples.map((example, idx) => (
            <button
              key={idx}
              onClick={() => {
                setScene(example.scene);
                setAutomaticThought(example.thought);
                setEvidenceFor(example.evidenceFor);
                setEvidenceAgainst(example.evidenceAgainst);
              }}
              className='px-4 py-2 rounded-lg text-sm bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-800/40 text-purple-700 dark:text-purple-200 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-500 active:scale-95'>
              示例：{example.scene}
            </button>
          ))}
        </div>

        {reframes.length > 0 && (
          <div className='space-y-4'>
            <div className='flex items-center gap-3'>
              <label className='text-sm font-semibold text-gray-800 dark:text-gray-100'>选择版本：</label>
              <select
                aria-label='选择认知重构版本'
                value={selectedVersion}
                onChange={e => setSelectedVersion(Number(e.target.value))}
                className='px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-500 transition-all duration-200'>
                {reframes.map((_, idx) => (
                  <option key={idx} value={idx}>
                    版本 {idx + 1}
                  </option>
                ))}
              </select>
            </div>

            <div className='p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200/50'>
              <div className='text-sm font-semibold text-green-800 dark:text-green-300 mb-2'>重构后的想法：</div>
              <div className='text-green-700 dark:text-green-200 leading-relaxed'>{reframes[selectedVersion]}</div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

// 疏导练习抽屉组件
const ExerciseDrawer: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onStartBreath: (seconds: number, pace: { inhale: number; hold: number; exhale: number }) => void;
  onStartReframe: () => void;
  onStartGrounding: (initial: number) => void;
  onStartMindfulness: () => void;
}> = ({ isOpen, onClose, onStartBreath, onStartReframe: _onStartReframe, onStartGrounding, onStartMindfulness }) => {
  if (!isOpen) return null;

  const exercises = [
    {
      id: 'breathing-3min',
      title: '3分钟呼吸练习',
      description: '通过深呼吸放松身心',
      icon: '🫁',
      color: 'from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20',
      hoverColor: 'hover:from-blue-200 hover:to-blue-100 dark:hover:from-blue-800/40 dark:hover:to-blue-700/30',
      textColor: 'text-blue-700 dark:text-blue-300',
      borderColor: 'border-blue-200/50 dark:border-blue-700/30',
      onClick: () => {
        onStartBreath(180, { inhale: 4, hold: 4, exhale: 6 });
        onClose();
      }
    },
    {
      id: 'breathing-5min',
      title: '5分钟呼吸练习',
      description: '更深层的呼吸放松练习',
      icon: '🫁',
      color: 'from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20',
      hoverColor: 'hover:from-blue-200 hover:to-blue-100 dark:hover:from-blue-800/40 dark:hover:to-blue-700/30',
      textColor: 'text-blue-700 dark:text-blue-300',
      borderColor: 'border-blue-200/50 dark:border-blue-700/30',
      onClick: () => {
        onStartBreath(300, { inhale: 5, hold: 5, exhale: 7 });
        onClose();
      }
    },
    {
      id: 'grounding',
      title: '5-4-3-2-1锚定练习',
      description: '通过感官觉察回到当下',
      icon: '⚓',
      color: 'from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-800/20',
      hoverColor:
        'hover:from-emerald-200 hover:to-emerald-100 dark:hover:from-emerald-800/40 dark:hover:to-emerald-700/30',
      textColor: 'text-emerald-700 dark:text-emerald-300',
      borderColor: 'border-emerald-200/50 dark:border-emerald-700/30',
      onClick: () => {
        onStartGrounding(15);
        onClose();
      }
    },
    {
      id: 'reframe',
      title: '认知重构练习',
      description: '识别并重构负面或不合理想法',
      icon: '🧠',
      color: 'from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/20',
      hoverColor: 'hover:from-purple-200 hover:to-purple-100 dark:hover:from-purple-800/40 dark:hover:to-purple-700/30',
      textColor: 'text-purple-700 dark:text-purple-300',
      borderColor: 'border-purple-200/50 dark:border-purple-700/30',
      onClick: () => {
        _onStartReframe();
        onClose();
      }
    },
    {
      id: 'mindfulness',
      title: '正念冥想（10分钟）',
      description: '跟随引导，温和地回到当下',
      icon: '🧘',
      color: 'from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/20',
      hoverColor: 'hover:from-amber-200 hover:to-amber-100 dark:hover:from-amber-800/40 dark:hover:to-amber-700/30',
      textColor: 'text-amber-700 dark:text-amber-300',
      borderColor: 'border-amber-200/50 dark:border-amber-700/30',
      onClick: () => {
        onStartMindfulness();
        onClose();
      }
    }
  ];

  return (
    <>
      {/* 遮罩层 */}
      <div className='fixed inset-0 bg-black/50 z-40 transition-opacity duration-300' onClick={onClose} />

      {/* 抽屉内容 */}
      <div className='fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 z-50 transform transition-transform duration-300 shadow-xl rounded-t-2xl'>
        <div className='flex flex-col max-h-[80vh]'>
          {/* 抽屉头部 */}
          <div className='flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700'>
            <h2 className='text-lg font-semibold text-gray-800 dark:text-gray-200'>选择练习</h2>
            <button
              onClick={onClose}
              title='关闭'
              aria-label='关闭'
              className='p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors duration-200'>
              <X className='w-5 h-5' />
            </button>
          </div>

          {/* 练习列表 */}
          <div
            className='flex-1 overflow-y-auto p-4 pb-safe-area-inset-bottom space-y-3'
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 80px)' }}>
            {exercises.map(exercise => (
              <button
                key={exercise.id}
                onClick={exercise.onClick}
                className={`w-full p-4 text-left rounded-xl transition-all duration-200 ${exercise.color} ${exercise.hoverColor} ${exercise.textColor} border ${exercise.borderColor} shadow-sm hover:shadow-md active:scale-95`}>
                <div className='flex items-center gap-3'>
                  <div className='text-2xl'>{exercise.icon}</div>
                  <div className='flex-1'>
                    <div className='font-semibold text-base mb-1'>{exercise.title}</div>
                    <div className='text-sm opacity-80'>{exercise.description}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

// 5-4-3-2-1锚定练习组件
const Grounding54321: React.FC<{
  onClose: () => void;
  initialStepDuration?: number;
}> = ({ onClose, initialStepDuration = 10 }) => {
  const [_five, setFive] = useState('');
  const [_four, setFour] = useState('');
  const [_three, setThree] = useState('');
  const [_two, setTwo] = useState('');
  const [_one, setOne] = useState('');
  const [step, setStep] = useState(0); // 0..4
  const [seconds, setSeconds] = useState(0);
  const [stepDuration, setStepDuration] = useState(initialStepDuration); // 可调每步时长（秒）
  const [running, setRunning] = useState(false);
  const timerRef = useRef<number | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playBeep = async () => {
    if (!audioEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current!;
      if (ctx.state === 'suspended') await ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      // 基于设备像素比调整频率与音量，增强在不同设备上的可感知度
      // dpr >= 3（高密屏）：频率略高、音量略低；dpr <= 1.5：频率略低、音量略高
      const dpr = typeof window !== 'undefined' ? Math.max(1, window.devicePixelRatio || 1) : 1;
      const freq = dpr >= 3 ? 1000 : dpr >= 2 ? 900 : 820;
      const vol = dpr >= 3 ? 0.028 : dpr >= 2 ? 0.03 : 0.035;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = vol;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => {
        osc.stop();
        osc.disconnect();
        gain.disconnect();
      }, 180);
    } catch {
      // 忽略音频错误
    }
  };

  const steps = [
    { label: '看到的 5 样东西', setter: setFive, placeholder: '例如：桌子、窗外的树、杯子...' },
    { label: '触摸到的 4 样东西', setter: setFour, placeholder: '例如：衣服、键盘、椅子...' },
    { label: '听到的 3 种声音', setter: setThree, placeholder: '例如：风声、键盘声、远处人声...' },
    { label: '闻到的 2 种味道', setter: setTwo, placeholder: '例如：咖啡香、空气清新剂...' },
    { label: '尝到的 1 种味道', setter: setOne, placeholder: '例如：茶的甘甜...' }
  ];

  const startGuide = () => {
    setRunning(true);
    setStep(0);
    setSeconds(stepDuration);
    playBeep();
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          if (step < steps.length - 1) {
            setStep(s => s + 1);
            playBeep();
            return stepDuration; // 使用可调每步时长
          } else {
            window.clearInterval(timerRef.current!);
            setRunning(false);
            return 0;
          }
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => () => timerRef.current && window.clearInterval(timerRef.current), []);

  return (
    <Modal
      title='5-4-3-2-1锚定练习'
      onClose={onClose}
      footer={
        <div className='flex gap-2'>
          <button
            onClick={onClose}
            className='px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-100'>
            关闭
          </button>
        </div>
      }>
      <div className='grid grid-cols-1 gap-3'>
        {steps.map((st, i) => (
          <div
            key={i}
            className={`p-3 rounded-xl border ${
              step === i && running
                ? 'border-emerald-400 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 animate-pulse'
                : 'border-gray-200 dark:border-gray-600'
            }`}>
            <div className='text-sm font-medium mb-2 text-gray-800 dark:text-gray-100'>{st.label}</div>
            <textarea
              className='w-full p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 dark:focus:ring-emerald-500'
              placeholder={st.placeholder}
              rows={2}
              onChange={e => st.setter(e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className='mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3'>
        <div className='flex items-center gap-3'>
          <button
            onClick={startGuide}
            className='px-4 py-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-800/40 text-emerald-700 dark:text-emerald-200 w-full sm:w-auto'>
            开始引导
          </button>
          {running && (
            <span className='text-sm text-emerald-700 dark:text-emerald-300 whitespace-nowrap'>
              剩余本步：{seconds}s
            </span>
          )}
        </div>

        <label className='flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300'>
          <input type='checkbox' checked={audioEnabled} onChange={e => setAudioEnabled(e.target.checked)} />
          步骤提示音
        </label>

        <div className='flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-gray-600 dark:text-gray-300 min-w-0'>
          <span className='whitespace-nowrap'>每步时长</span>
          <input
            type='range'
            min={5}
            max={20}
            value={stepDuration}
            onChange={e => setStepDuration(Number(e.target.value))}
            className='w-full sm:w-56'
          />
          <span className='whitespace-nowrap'>{stepDuration}s</span>
        </div>
      </div>
    </Modal>
  );
};

// 主Mentor组件
const Mentor: React.FC = () => {
  const { immersiveMode: _immersiveMode } = useImmersiveMode();
  const { isOnline, connectionType } = useNetworkStatus();
  const isMobile = useIsMobile();

  // 聊天状态
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);

  // 历史会话状态
  const [sessions, _setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // 练习状态
  const [showExerciseDrawer, setShowExerciseDrawer] = useState(false);
  const [showBreath, setShowBreath] = useState(false);
  const [showReframe, setShowReframe] = useState(false);
  const [showGrounding, setShowGrounding] = useState(false);
  const [showMindfulness, setShowMindfulness] = useState(false);
  const [breathParams, setBreathParams] = useState<{
    totalSeconds: number;
    pace: { inhale: number; hold: number; exhale: number };
  } | null>(null);
  const [groundingInitial, setGroundingInitial] = useState<number | null>(null);
  // 流式输出与打字机效果相关 refs
  const abortCtrlRef = useRef<AbortController | null>(null);
  const streamBufferRef = useRef<string>('');
  const typingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortedByUserRef = useRef<boolean>(false);
  const lastAssistantContentRef = useRef<string>('');
  // 修复闭包一致性：维护最新消息引用
  const messagesRef = useRef<ChatBubble[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // 虚拟化相关
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: messages.length > 0 ? messages.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 120,
    overscan: 8
  });

  // 其他状态
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);

  const hasConversation = messages.length > 0;

  // 发送消息（支持流式与打字机效果）
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isSending) return;

      const userMessage: ChatBubble = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: content.trim()
      };

      // 先插入用户消息与占位的助手消息（流式）
      const assistantId = `a-${Date.now() + 1}`;
      setMessages(prev => [
        ...prev,
        userMessage,
        { id: assistantId, role: 'assistant', content: '', streaming: true, streamStartAt: Date.now() }
      ]);
      setInput('');
      setIsSending(true);
      setLastError(null);
      setLastPrompt(content.trim());

      // 滚动到底部，保证用户能看到输出
      scrollToBottom();

      try {
        const baseSystem = buildMentorSystemPrompt({ avg7d: 5.0, mostMood: '平静', todayCount: 1 });
        const systemContent = `${personaPrompt}\n\n${baseSystem}`;
        const chatMessages = [...messagesRef.current, userMessage].map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }));

        // 创建可中断控制器
        const controller = new AbortController();
        abortCtrlRef.current = controller;

        const gen = await deepseekChatWithRetry([{ role: 'system', content: systemContent }, ...chatMessages], {
          stream: true,
          systemPrompt: systemContent,
          signal: controller.signal
        });

        // 如果是异步生成器，进行流式 + 打字机效果
        if (typeof (gen as AsyncGenerator<string>)[Symbol.asyncIterator] === 'function') {
          // 启动打字机调度器：支持代码块按行分段、可变节律
          if (!typingTimerRef.current) {
            const isInCodeBlock = (text: string) => {
              const fences = (text.match(/```/g) || []).length;
              return fences % 2 === 1;
            };

            const tick = () => {
              // 若无内容，稍后再检查缓冲
              if (!streamBufferRef.current.length) {
                typingTimerRef.current = setTimeout(tick, 30);
                return;
              }

              const preview = lastAssistantContentRef.current + streamBufferRef.current;
              const codeMode = isInCodeBlock(preview);

              let takeCount = codeMode ? 1 : 3;
              // 代码块分段：长缓冲时按行展示（每次到换行符）
              if (codeMode) {
                const newlineIdx = streamBufferRef.current.indexOf('\n');
                const longBuffer = streamBufferRef.current.length > 200;
                if (longBuffer && newlineIdx !== -1 && newlineIdx < 120) {
                  takeCount = newlineIdx + 1; // 到行末
                }
              }

              const consume = streamBufferRef.current.slice(0, takeCount);
              streamBufferRef.current = streamBufferRef.current.slice(takeCount);

              setMessages(prev => {
                const next = [...prev];
                const idx = next.findIndex(m => m.id === assistantId);
                if (idx >= 0) {
                  const updated = { ...next[idx], content: next[idx].content + consume };
                  next[idx] = updated;
                  lastAssistantContentRef.current = updated.content;
                }
                return next;
              });

              const delay = codeMode ? (consume.includes('\n') ? 60 : 35) : 25;
              typingTimerRef.current = setTimeout(tick, delay);
            };

            typingTimerRef.current = setTimeout(tick, 25);
          }

          try {
            for await (const chunk of gen as AsyncGenerator<string>) {
              streamBufferRef.current += chunk;
            }
          } finally {
            // 等待缓冲区清空
            const flush = async () => {
              return new Promise<void>(resolve => {
                const check = () => {
                  if (!streamBufferRef.current.length) resolve();
                  else setTimeout(check, 30);
                };
                check();
              });
            };
            await flush();

            // 结束打字机与流式标记
            if (typingTimerRef.current) {
              clearTimeout(typingTimerRef.current);
              typingTimerRef.current = null;
            }
            setMessages(prev => prev.map(m => (m.id === assistantId ? { ...m, streaming: false } : m)));
            scrollToBottom();
          }
        } else if ('content' in (gen as { content: string })) {
          const res = gen as { content: string };
          setMessages(prev =>
            prev.map(m => (m.id === assistantId ? { ...m, streaming: false, content: res.content } : m))
          );
          scrollToBottom();
        }
      } catch (error) {
        console.error('发送消息失败:', error);
        setLastError(error instanceof Error ? error.message : '发送失败');
        // 结束打字机定时器
        if (typingTimerRef.current) {
          clearTimeout(typingTimerRef.current);
          typingTimerRef.current = null;
        }
        // 结束占位消息并给出提示
        if (abortedByUserRef.current) {
          setMessages(prev => prev.map(m => (m.streaming ? { ...m, streaming: false, content: m.content } : m)));
          toast.info('已停止生成');
        } else {
          setMessages(prev =>
            prev.map(m => (m.streaming ? { ...m, streaming: false, content: '抱歉，生成被中断或发生错误。' } : m))
          );
          toast.error('生成失败', {
            description: '网络或服务异常，稍后可重试。',
            action: {
              label: '重试',
              onClick: () => {
                if (lastPrompt) {
                  setInput(lastPrompt);
                  sendMessage(lastPrompt);
                }
              }
            }
          });
        }
      } finally {
        setIsSending(false);
        abortCtrlRef.current = null;
        abortedByUserRef.current = false;
      }
    },
    [isSending, lastPrompt]
  );

  // 停止当前流式生成
  const stopStreaming = useCallback(() => {
    // 移动端震动反馈（若支持）
    if (isMobile) {
      try {
        const nav = navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean };
        nav.vibrate?.([20, 30, 20]);
      } catch {
        // 忽略不支持或被拒绝的情况
      }
    }
    abortedByUserRef.current = true;
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    abortCtrlRef.current?.abort();
    abortCtrlRef.current = null;
    setIsSending(false);
    setMessages(prev => prev.map(m => (m.streaming ? { ...m, streaming: false } : m)));
    toast.info('已停止生成');
  }, [isMobile]);

  // 处理表单提交
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // 开始新会话
  const startNewSession = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setInput('');
    setLastError(null);
  };

  // 复制消息
  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('已复制到剪贴板');
  };

  // 重新生成消息
  const regenerateMessage = (messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1 || messageIndex === 0) return;

    const previousMessage = messages[messageIndex - 1];
    if (previousMessage.role === 'user') {
      // 删除当前消息及之后的所有消息
      setMessages(prev => prev.slice(0, messageIndex));
      // 重新发送上一条用户消息
      sendMessage(previousMessage.content);
    }
  };

  // 滚动到底部
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  // 监听滚动位置
  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const threshold = 80; // 提升底部阈值，减少误判
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - threshold;
      setAtBottom(isAtBottom);
    };

    scrollElement.addEventListener('scroll', handleScroll);
    return () => scrollElement.removeEventListener('scroll', handleScroll);
  }, []);

  // 自动滚动到底部：靠近底部或用户刚发送时
  useEffect(() => {
    const last = messages[messages.length - 1];
    const userJustSent = !!last && last.role === 'user';
    if (atBottom || userJustSent) {
      scrollToBottom();
    }
  }, [messages, atBottom]);

  if (!hasConversation) {
    return (
      <div className='fixed inset-0 flex flex-col overflow-hidden bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pt-20 sm:pt-20 md:pt-24 lg:pt-24 xl:pt-24 2xl:pt-24 pb-20 sm:pb-24 md:pb-28 lg:pb-10 xl:pb-8 2xl:pb-8 min-h-screen'>
        <Header
          title='AI 伴侣'
          leftIcon={
            <button
              onClick={() => setShowHistory(true)}
              aria-label='历史会话'
              className='p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'>
              <Menu className='w-5 h-5' />
            </button>
          }
          rightIcon={
            <button
              onClick={startNewSession}
              aria-label='新建会话'
              className='p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'>
              <Plus className='w-5 h-5' />
            </button>
          }
        />

        <NewSessionView onQuestionSubmit={sendMessage} onStartExercise={() => setShowExerciseDrawer(true)} />

        {/* 历史会话抽屉 */}
        <HistoryDrawer
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSessionSelect={setCurrentSessionId}
          onNewSession={startNewSession}
        />

        {/* 疏导练习抽屉 */}
        <ExerciseDrawer
          isOpen={showExerciseDrawer}
          onClose={() => setShowExerciseDrawer(false)}
          onStartBreath={(seconds, pace) => {
            setBreathParams({ totalSeconds: seconds, pace });
            setShowBreath(true);
          }}
          onStartReframe={() => setShowReframe(true)}
          onStartGrounding={initial => {
            setGroundingInitial(initial);
            setShowGrounding(true);
          }}
          onStartMindfulness={() => setShowMindfulness(true)}
        />

        {/* 练习弹窗 */}
        {showBreath && breathParams && (
          <BreathingGuide
            onClose={() => setShowBreath(false)}
            totalSeconds={breathParams.totalSeconds}
            pace={breathParams.pace}
          />
        )}
        {showReframe && <CognitiveReframe onClose={() => setShowReframe(false)} />}
        {showGrounding && groundingInitial && (
          <Grounding54321 onClose={() => setShowGrounding(false)} initialStepDuration={groundingInitial} />
        )}
        {showMindfulness && <MindfulnessMeditation onClose={() => setShowMindfulness(false)} />}
      </div>
    );
  }

  return (
    <div className='fixed inset-0 flex flex-col overflow-hidden bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pb-20 sm:pb-24 md:pb-28 lg:pb-10 xl:pb-8 2xl:pb-8'>
      <Header
        title='AI 伴侣'
        leftIcon={
          <button
            onClick={() => setShowHistory(true)}
            className='p-1.5 sm:p-2 rounded-xl bg-white/80 dark:bg-theme-gray-700/80 hover:bg-white dark:hover:bg-theme-gray-600 text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200 hover:scale-110 active:scale-95 shadow-sm hover:shadow-md'
            aria-label='历史会话'>
            <Menu className='w-4 h-4 sm:w-5 sm:h-5' />
          </button>
        }
        rightIcon={
          <button
            onClick={startNewSession}
            className='p-1.5 sm:p-2 rounded-xl bg-white/80 dark:bg-theme-gray-700/80 hover:bg-white dark:hover:bg-theme-gray-600 text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200 hover:scale-110 active:scale-95 shadow-sm hover:shadow-md'
            aria-label='新建会话'>
            <Plus className='w-4 h-4 sm:w-5 sm:h-5' />
          </button>
        }
      />

      <Container className='flex-1 flex flex-col min-h-0 px-0 pt-20 sm:pt-20 md:pt-24 lg:pt-24 xl:pt-24 2xl:pt-24'>
        {/* 错误提示 */}
        {lastError && !isSending && (
          <Card
            variant='default'
            padding='sm'
            role='alert'
            aria-live='assertive'
            className='mb-3 sm:mb-4 mx-3 sm:mx-4 border border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-900/20 flex-shrink-0'>
            <div className='text-sm sm:text-base text-red-700 dark:text-red-300'>发生错误：{lastError}</div>
            <div className='text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1'>
              网络：{isOnline ? connectionType || 'unknown' : '离线'}
            </div>
            <div className='mt-2'>
              <button
                onClick={() => {
                  if (lastPrompt) {
                    setInput(lastPrompt);
                    sendMessage(lastPrompt);
                  }
                }}
                className='px-2 sm:px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm rounded-lg transition-colors duration-200'>
                重试
              </button>
            </div>
          </Card>
        )}
        {/* 聊天区域 */}
        <Card
          variant='default'
          padding='md'
          className='flex-1 flex flex-col min-h-0 mb-3 relative sm:mx-4 lg:mx-0 xl:mx-0'>
          <div
            id='chat-log'
            ref={scrollRef}
            role='log'
            aria-live='polite'
            aria-relevant='additions'
            aria-busy={isSending || messages.some(m => m.streaming)}
            className='flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent min-h-0'>
            <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
              {rowVirtualizer.getVirtualItems().map(item => (
                <div
                  key={messages[item.index].id}
                  data-index={item.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${item.start}px)`
                  }}>
                  <div className='mb-3 sm:mb-4'>
                    <MessageItem
                      m={messages[item.index]}
                      hasConversation={hasConversation}
                      onStartBreath={(sec, pace) => {
                        setBreathParams({ totalSeconds: sec, pace });
                        setShowBreath(true);
                      }}
                      onStartReframe={() => setShowReframe(true)}
                      onStartGrounding={initial => {
                        setGroundingInitial(initial);
                        setShowGrounding(true);
                      }}
                      onStartMindfulness={() => setShowMindfulness(true)}
                      onCopyMessage={copyMessage}
                      onRegenerateMessage={regenerateMessage}
                      hoveredMessageId={hoveredMessageId}
                      onMessageHover={setHoveredMessageId}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 滚动到底部按钮 */}
          {!atBottom && (
            <div className='absolute bottom-3 sm:bottom-4 right-3 sm:right-4'>
              <button
                onClick={scrollToBottom}
                title='滚动到底部'
                aria-label='滚动到底部'
                className='p-2 sm:p-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg transition-colors duration-200'>
                <svg className='w-4 h-4 sm:w-5 sm:h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 14l-7 7m0 0l-7-7m7 7V3' />
                </svg>
              </button>
            </div>
          )}
          {/* 免责声明（移动到聊天卡片底部） */}
          {messages.some(msg => msg.role === 'assistant') && (
            <div className='text-center mt-2 flex-shrink-0'>
              <p className='text-xs text-gray-500 dark:text-gray-400'>内容由 AI 生成，不构成医疗建议</p>
            </div>
          )}
        </Card>

        {/* 输入区域 - 固定在底部 */}
        <Card className='flex-shrink-0 px-3 sm:px-4 pb-3 sm:pb-4'>
          <form onSubmit={handleSubmit} className='flex gap-2 sm:gap-3'>
            <input
              type='text'
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  if (isSending) {
                    stopStreaming();
                  } else {
                    setInput('');
                  }
                }
              }}
              placeholder='输入您的问题或想法...'
              disabled={isSending}
              className='flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 disabled:opacity-50 text-sm sm:text-base'
            />
            {isSending && (
              <button
                type='button'
                onClick={stopStreaming}
                aria-label='停止生成'
                aria-controls='chat-log'
                className='p-2.5 sm:p-3 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors duration-200 flex items-center gap-2'>
                <div className='w-2 h-2 bg-white/90 rounded-sm' />
                <span className='hidden xs:inline sm:inline text-sm'>停止</span>
              </button>
            )}
            <button
              type='submit'
              title='发送'
              aria-label='发送'
              disabled={!input.trim() || isSending}
              className='p-2.5 sm:p-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-xl transition-colors duration-200 disabled:cursor-not-allowed flex-shrink-0'>
              <Send className='w-4 h-4 sm:w-5 sm:h-5' />
            </button>
          </form>
        </Card>
        {/* 免责声明已移动到聊天卡片底部 */}
      </Container>

      {/* 历史会话抽屉 */}
      <HistoryDrawer
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSessionSelect={setCurrentSessionId}
        onNewSession={startNewSession}
      />

      {/* 疏导练习抽屉 */}
      <ExerciseDrawer
        isOpen={showExerciseDrawer}
        onClose={() => setShowExerciseDrawer(false)}
        onStartBreath={(seconds, pace) => {
          setBreathParams({ totalSeconds: seconds, pace });
          setShowBreath(true);
        }}
        onStartReframe={() => setShowReframe(true)}
        onStartGrounding={initial => {
          setGroundingInitial(initial);
          setShowGrounding(true);
        }}
        onStartMindfulness={() => setShowMindfulness(true)}
      />

      {/* 练习弹窗 */}
      {showBreath && breathParams && (
        <BreathingGuide
          onClose={() => setShowBreath(false)}
          totalSeconds={breathParams.totalSeconds}
          pace={breathParams.pace}
        />
      )}
      {showReframe && <CognitiveReframe onClose={() => setShowReframe(false)} />}
      {showGrounding && groundingInitial && (
        <Grounding54321 onClose={() => setShowGrounding(false)} initialStepDuration={groundingInitial} />
      )}
      {showMindfulness && <MindfulnessMeditation onClose={() => setShowMindfulness(false)} />}
    </div>
  );
};

export default Mentor;
