import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { MessageSquare, ShieldAlert, Send, Fingerprint } from 'lucide-react';
import { toast } from 'sonner';
import Card from '../components/Card';
import Container from '../components/Container';
import Header from '../components/Header';
import Modal from '../components/Modal';
import Button from '../components/Button';
import { useImmersiveMode } from '../hooks/useImmersiveMode';
import { useMoodStats, useMoodTrend, useTodayRecords } from '../store';

import { deepseekChat, deepseekChatWithRetry, buildMentorSystemPrompt, buildReframePrompt } from '../lib/llm';
import { useNetworkStatus } from '../hooks/useMobile';
import { cn } from '../utils/cn';
import { chatPresetGroups } from '../constants/presets';

const personaPrompt = `
角色：温暖、稳重的 AI 情绪疏导师。你的目标是在当下帮助用户缓解情绪、获得清晰，并形成可持续的自助练习与反思。

原则：
- 使用中文、短句、友善且不评判；先共情再给建议。
- 不进行医疗诊断或治疗承诺；不讨论药物或替代专业治疗。
- 若出现自伤/他伤/严重危机信号，温柔提醒联系当地紧急热线或可信任的人，并建议立即寻求线下帮助。

回应结构（按序）：
1) 共情与归纳：用 1–2 句准确复述用户的核心感受/困扰。
2) 微建议或练习：从“呼吸练习”“正念冥想”“感官回归”“认知重构”“情绪日记”中挑选最贴切的 1 项，给出 2–5 步的简明操作与预计时长（如 3 分钟）。可提示“点击下方按钮开始”。
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

const MessageItem = React.memo(
  ({
    m,
    hasConversation,
    onStartBreath,
    onStartReframe,
    onStartGrounding
  }: {
    m: ChatBubble;
    hasConversation: boolean;
    onStartBreath: (seconds: number, pace: { inhale: number; hold: number; exhale: number }) => void;
    onStartReframe: () => void;
    onStartGrounding: (initial: number) => void;
  }) => {
    return (
      <div
        className={
          m.role === 'assistant'
            ? `${
                hasConversation
                  ? 'max-w-full sm:max-w-[90%] md:max-w-[85%] lg:max-w-[80%] xl:max-w-[75%] 2xl:max-w-[70%]'
                  : 'max-w-full sm:max-w-[96%] md:max-w-[94%] lg:max-w-[92%] xl:max-w-[90%] 2xl:max-w-[88%]'
              } bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-theme-gray-700/60 ring-1 ring-white/25 dark:ring-theme-gray-700/60 rounded-2xl p-3 shadow-sm dark:shadow-none`
            : `ml-auto ${
                hasConversation
                  ? 'max-w-full sm:max-w-[90%] md:max-w-[85%] lg:max-w-[80%] xl:max-w-[75%] 2xl:max-w-[70%]'
                  : 'max-w-full sm:max-w-[96%] md:max-w-[94%] lg:max-w-[92%] xl:max-w-[90%] 2xl:max-w-[88%]'
              } bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-theme-gray-700/60 ring-1 ring-white/25 dark:ring-theme-gray-700/60 rounded-2xl p-3 shadow-sm dark:shadow-none`
        }>
        <div className='text-sm sm:text-base lg:text-lg text-gray-800 dark:text-gray-200'>
          {m.content.split(/\n\n+/).map((seg, i) => (
            <p key={i} className='mb-2 whitespace-pre-wrap leading-relaxed xl:leading-loose'>
              {seg}
            </p>
          ))}
        </div>
        {m.streaming && (
          <div className='mt-2 text-xs sm:text-sm text-gray-400 dark:text-gray-500'>
            正在生成...{' '}
            {(() => {
              const target = 800;
              const start = m.streamStartAt ?? Date.now();
              const elapsedSec = Math.max(1, (Date.now() - start) / 1000);
              const rate = Math.max(8, m.content.length / elapsedSec);
              const remainingChars = Math.max(0, target - m.content.length);
              const estSec = Math.round(remainingChars / rate);
              const mm = Math.floor(estSec / 60);
              const ss = estSec % 60;
              return `预计剩余 ${mm > 0 ? `${mm}分${ss}秒` : `${ss}秒`}`;
            })()}
          </div>
        )}
        {m.streaming && (
          <div
            className='mt-2 h-1.5 sm:h-2 w-20 sm:w-24 rounded-full bg-gray-200 dark:bg-theme-gray-700 animate-pulse motion-reduce:animate-none'
            aria-hidden='true'
            aria-busy='true'
          />
        )}
        {m.role === 'assistant' && (
          <div className='mt-3 flex flex-wrap gap-2'>
            <button
              onClick={() => onStartBreath(180, { inhale: 4, hold: 4, exhale: 6 })}
              className='h-8 sm:h-9 px-2 py-1 rounded-lg text-sm bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800/40 text-blue-700 dark:text-blue-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700 active:scale-95'>
              呼吸练习 · 3分钟
            </button>
            <button
              onClick={() => onStartBreath(300, { inhale: 5, hold: 5, exhale: 7 })}
              className='h-8 sm:h-9 px-2 py-1 rounded-lg text-sm bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800/40 text-blue-700 dark:text-blue-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700 active:scale-95'>
              呼吸练习 · 5分钟（慢）
            </button>
            <button
              onClick={onStartReframe}
              className='h-8 sm:h-9 px-2 py-1 rounded-lg text-sm bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-800/40 text-purple-700 dark:text-purple-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-700 active:scale-95'>
              认知重构练习
            </button>
            <button
              onClick={() => onStartGrounding(15)}
              className='h-8 sm:h-9 px-2 py-1 rounded-lg text-sm bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-800/40 text-emerald-700 dark:text-emerald-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-300 dark:focus:ring-emerald-700 active:scale-95'>
              锚定练习（每步15秒）
            </button>
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

// 正念冥想组件
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
  }, [isActive, timeLeft, steps]);

  const footerButtons = (
    <>
      <button
        onClick={() => setIsActive(!isActive)}
        className='order-1 col-span-1 btn btn-primary px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-300 dark:focus:ring-emerald-500 active:scale-95 shadow-lg'>
        {isActive ? '暂停' : '开始'}
      </button>
      <button
        onClick={() => {
          setTimeLeft(600);
          setIsActive(false);
          setPhase('prepare');
          setCurrentStep(0);
        }}
        className='order-2 col-span-1 justify-self-end btn btn-danger px-6 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600 active:scale-95'>
        重置
      </button>
      {/* 完成阶段不再提供保存到日记按钮 */}
    </>
  );

  return (
    <Modal
      title='正念冥想'
      onClose={onClose}
      footer={footerButtons}
      footerClassName='w-full grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:flex-wrap sm:justify-between sm:items-center'
      className='max-w-md'
    >
      <div className='text-center space-y-6'>
        <div className='text-5xl sm:text-6xl mb-4 font-mono text-emerald-600 dark:text-emerald-300'>
          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
        </div>

        <div className='space-y-3'>
          <div className='text-2xl sm:text-3xl font-semibold text-gray-800 dark:text-gray-100'>
            {steps[currentStep]?.title}
          </div>
          <div className='text-base text-gray-600 dark:text-gray-300 leading-relaxed'>{steps[currentStep]?.desc}</div>
        </div>

        {/* 进度条 */}
        <div className='w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2'>
          <div
            className='bg-emerald-500 h-2 rounded-full transition-all duration-1000'
            style={{ width: `${((600 - timeLeft) / 600) * 100}%` }}
          />
        </div>

        {/* 步骤指示器 */}
        <div className='flex justify-center space-x-2'>
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`w-3 h-3 rounded-full transition-colors duration-300 ${
                idx === currentStep
                  ? 'bg-emerald-500'
                  : idx < currentStep
                  ? 'bg-emerald-300'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
};

// 情绪日记组件
const EmotionJournal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [currentEmotion, setCurrentEmotion] = useState('');
  const [intensity, setIntensity] = useState(5);
  const [trigger, setTrigger] = useState('');
  const [thoughts, setThoughts] = useState('');
  const [bodyResponse, setBodyResponse] = useState('');
  const [coping, setCoping] = useState('');

  const emotions = [
    '开心',
    '平静',
    '兴奋',
    '满足',
    '感激',
    '焦虑',
    '担心',
    '紧张',
    '恐惧',
    '不安',
    '愤怒',
    '烦躁',
    '失望',
    '沮丧',
    '无助',
    '孤独',
    '困惑',
    '羞愧',
    '内疚',
    '嫉妒'
  ];

  const footerButtons = (
    <>
      <button
        onClick={onClose}
        className='px-5 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-500 active:scale-95'>
        关闭
      </button>
    </>
  );

  return (
    <Modal title='情绪日记' onClose={onClose} footer={footerButtons} className='max-w-2xl'>
      <div className='space-y-6'>
        <div>
          <label className='block text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3'>当前情绪</label>
          <div className='grid grid-cols-3 sm:grid-cols-5 gap-2'>
            {emotions.map(emotion => (
              <button
                key={emotion}
                onClick={() => setCurrentEmotion(emotion)}
                className={`p-2 rounded-lg text-sm transition-all duration-200 ${
                  currentEmotion === emotion
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-theme-gray-700 hover:bg-gray-200 dark:hover:bg-theme-gray-600 text-gray-700 dark:text-gray-200'
                }`}>
                {emotion}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className='block text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2'>
            情绪强度：{intensity}/10
          </label>
          <input
            type='range'
            min={1}
            max={10}
            value={intensity}
            onChange={e => setIntensity(Number(e.target.value))}
            className='w-full slider'
          />
        </div>

        <div>
          <label className='block text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2'>触发事件</label>
          <textarea
            value={trigger}
            onChange={e => setTrigger(e.target.value)}
            placeholder='是什么引发了这种情绪？'
            rows={2}
            className='w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white/80 dark:bg-gray-800/90 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-500'
          />
        </div>

        <div>
          <label className='block text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2'>想法</label>
          <textarea
            value={thoughts}
            onChange={e => setThoughts(e.target.value)}
            placeholder='当时你在想什么？'
            rows={2}
            className='w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white/80 dark:bg-gray-800/90 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-500'
          />
        </div>

        <div>
          <label className='block text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2'>身体反应</label>
          <textarea
            value={bodyResponse}
            onChange={e => setBodyResponse(e.target.value)}
            placeholder='身体有什么感觉？（如心跳加速、肌肉紧张等）'
            rows={2}
            className='w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white/80 dark:bg-gray-800/90 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-500'
          />
        </div>

        <div>
          <label className='block text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2'>应对方式</label>
          <textarea
            value={coping}
            onChange={e => setCoping(e.target.value)}
            placeholder='你是如何处理这种情绪的？或者计划如何处理？'
            rows={2}
            className='w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white/80 dark:bg-gray-800/90 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-500'
          />
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
      const prompt = buildReframePrompt({ scene, automaticThought, evidenceFor, evidenceAgainst });
      const result = await deepseekChatWithRetry([{ role: 'user', content: prompt }], { temperature: 0.7 });

      if ('content' in result) {
        const newReframes = result.content.split('\n').filter(line => line.trim());
        setReframes(newReframes);
        setSelectedVersion(0);
      }
    } catch (error) {
      console.error('生成重构失败:', error);
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
            className='order-1 col-span-1 btn btn-primary px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-500 active:scale-95 disabled:cursor-not-allowed'>
            {isGenerating ? '生成中...' : '生成重构'}
          </button>
          <button
            onClick={onClose}
            className='order-2 col-span-1 justify-self-end btn btn-ghost px-5 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-500 active:scale-95'>
            取消
          </button>
          {reframes.length > 0 && (
            <button
              onClick={() => generateReframe()}
              disabled={isGenerating}
              className='order-3 col-span-2 w-full sm:w-auto btn btn-ghost px-5 py-3 rounded-xl bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800/40 text-blue-700 dark:text-blue-200 font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-500 active:scale-95'>
              生成新版本
            </button>
          )}
        </>
      }
      footerClassName='w-full grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:flex-wrap sm:justify-between sm:items-center'
    >
      <div className='space-y-6'>
        <div>
          <label className='block text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2'>情境描述</label>
          <input
            value={scene}
            onChange={e => setScene(e.target.value)}
            placeholder='描述让你困扰的具体情境...'
            className='form-input w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white/80 dark:bg-gray-800/90 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-500 focus:border-transparent transition-all duration-200'
          />
        </div>

        <div>
          <label className='block text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2'>自动化思维</label>
          <textarea
            value={automaticThought}
            onChange={e => setAutomaticThought(e.target.value)}
            placeholder='写下你的第一反应和负面想法...'
            rows={3}
            className='form-input w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white/80 dark:bg-gray-800/90 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-500 focus:border-transparent transition-all duration-200 resize-none'
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
              className='form-input w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white/80 dark:bg-gray-800/90 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-500 focus:border-transparent transition-all duration-200 resize-none'
            />
          </div>
          <div>
            <label className='block text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2'>反对证据</label>
            <textarea
              value={evidenceAgainst}
              onChange={e => setEvidenceAgainst(e.target.value)}
              placeholder='有什么证据反对这个想法？'
              rows={3}
              className='form-input w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white/80 dark:bg-gray-800/90 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-500 focus:border-transparent transition-all duration-200 resize-none'
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

        {/* 底部操作统一到 Modal.footer */}

        {reframes.length > 0 && (
          <div className='space-y-4'>
            <div className='flex items-center gap-3'>
              <label className='text-sm font-semibold text-gray-800 dark:text-gray-100'>选择版本：</label>
              <select
                aria-label='选择认知重构版本'
                value={selectedVersion}
                onChange={e => setSelectedVersion(Number(e.target.value))}
                className='form-input px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-500 transition-all duration-200'>
                {reframes.map((_, idx) => (
                  <option key={idx} value={idx}>
                    版本 {idx + 1}
                  </option>
                ))}
              </select>
            </div>

            <div className='p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50'>
              <div className='text-sm font-semibold text-green-800 dark:text-green-300 mb-2'>重构后的想法：</div>
              <div className='text-green-700 dark:text-green-200 leading-relaxed'>{reframes[selectedVersion]}</div>
            </div>
          </div>
        )}

        {/* 取消/保存统一移至 Modal.footer */}
      </div>
    </Modal>
  );
};

// 感官回归（原 5-4-3-2-1 Grounding）组件
const Grounding54321: React.FC<{
  onClose: () => void;
  initialStepDuration?: number;
}> = ({ onClose, initialStepDuration = 10 }) => {
  const [five, setFive] = useState('');
  const [four, setFour] = useState('');
  const [three, setThree] = useState('');
  const [two, setTwo] = useState('');
  const [one, setOne] = useState('');
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

  const _buildText = () =>
    [
      '【感官回归 复盘】',
      `看到的 5 样东西：${five || '（未填写）'}`,
      `触摸到的 4 样东西：${four || '（未填写）'}`,
      `听到的 3 种声音：${three || '（未填写）'}`,
      `闻到的 2 种味道：${two || '（未填写）'}`,
      `尝到的 1 种味道：${one || '（未填写）'}`
    ].join('\n');

  return (
    <Modal
      title='感官回归'
      onClose={onClose}
      footer={
        <div className='flex gap-2'>
          <button
            onClick={onClose}
            className='btn btn-ghost px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-100'>
            取消
          </button>
          {/* 已移除“保存到日记”按钮 */}
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
              className='form-input w-full p-2 rounded-lg border border-gray-200 dark:border-theme-gray-600 bg-white dark:bg-theme-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 dark:focus:ring-emerald-500'
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
            className='w-full sm:w-56 slider'
          />
          <span className='whitespace-nowrap'>{stepDuration}s</span>
        </div>
      </div>
    </Modal>
  );
};

const Mentor: React.FC = () => {
  const { immersiveMode } = useImmersiveMode();
  const todayRecords = useTodayRecords();
  const stats7d = useMoodStats(7);
  const _trend7d = useMoodTrend(7);

  const { isOnline, connectionType } = useNetworkStatus();

  const [showBreath, setShowBreath] = useState(false);
  const [breathParams, setBreathParams] = useState<{
    totalSeconds: number;
    pace: { inhale: number; hold: number; exhale: number };
  } | null>(null);
  const [showReframe, setShowReframe] = useState(false);
  const [showGrounding, setShowGrounding] = useState(false);
  const [groundingInitial, setGroundingInitial] = useState<number | null>(null);
  const [showMindfulness, setShowMindfulness] = useState(false);
  const [showEmotionJournal, setShowEmotionJournal] = useState(false);
  const [input, setInput] = useState('');
  // 统一改用 Toast 提示，无需额外输入提示状态
  const [abortCtrl, setAbortCtrl] = useState<AbortController | null>(null);
  const [_progress, setProgress] = useState(0);
  const [_sendStartAt, setSendStartAt] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<ChatBubble[]>([
    {
      id: 'm0',
      role: 'assistant',
      content:
        '您好，我是 AI 情绪疏导师，很高兴遇见你 ✨ 无论此刻心情如何，我都在这里陪伴。想聊聊今天发生的事情吗？或者试试下方的放松练习也很不错～'
    }
  ]);
  const [activeTab, setActiveTab] = useState<'chat' | 'exercises'>('chat');
  const [isSending, setIsSending] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  // 从配置文件读取分组数据
  const presetGroups = chatPresetGroups;
  const [presetOpen, setPresetOpen] = useState(true);
  // 暂时隐藏情绪日记练习板块
  const JOURNAL_ENABLED = false;
  const [hasStoredPreference, setHasStoredPreference] = useState(false);

  // 记忆折叠状态：从 localStorage 读取并写入
  useEffect(() => {
    const saved = localStorage.getItem('mentorPresetOpen');
    if (saved !== null) {
      setPresetOpen(saved === 'true');
      setHasStoredPreference(true);
    }
  }, []);
  useEffect(() => {
    localStorage.setItem('mentorPresetOpen', String(presetOpen));
  }, [presetOpen]);

  // 练习区折叠与进度状态
  type ExerciseKey = 'breath' | 'reframe' | 'grounding' | 'mindfulness' | 'journal';
  type ExerciseStatus = 'idle' | 'in_progress' | 'completed';
  const [exerciseOpen, setExerciseOpen] = useState<Record<ExerciseKey, boolean>>({
    breath: true,
    reframe: true,
    grounding: true,
    mindfulness: true,
    journal: true
  });
  const [exerciseStatus, setExerciseStatus] = useState<Record<ExerciseKey, ExerciseStatus>>({
    breath: 'idle',
    reframe: 'idle',
    grounding: 'idle',
    mindfulness: 'idle',
    journal: 'idle'
  });
  const toggleExercise = (key: ExerciseKey) => setExerciseOpen(prev => ({ ...prev, [key]: !prev[key] }));
  const markInProgress = (key: ExerciseKey) => setExerciseStatus(prev => ({ ...prev, [key]: 'in_progress' }));
  const _markCompleted = (key: ExerciseKey) => setExerciseStatus(prev => ({ ...prev, [key]: 'completed' }));
  const markIdle = (key: ExerciseKey) => setExerciseStatus(prev => ({ ...prev, [key]: 'idle' }));

  const StatusBadge: React.FC<{ status: ExerciseStatus }> = ({ status }) => {
    const map = {
      idle: { label: '未开始', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200' },
      in_progress: { label: '进行中', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-800/40 dark:text-blue-200' },
      completed: {
        label: '已完成',
        cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-800/40 dark:text-emerald-200'
      }
    } as const;
    const { label, cls } = map[status];
    return <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
  };

  // 已移除未使用的 suggestions 变量，避免潜在编译告警

  const systemPrompt = useMemo(() => {
    const base = buildMentorSystemPrompt({
      avg7d: stats7d.avgIntensity,
      mostMood: stats7d.mostCommonMood as string,
      todayCount: todayRecords.length
    });
    return personaPrompt + '\n' + base;
  }, [stats7d.avgIntensity, stats7d.mostCommonMood, todayRecords.length]);

  // 自动滚动优化：仅在接近底部或用户刚发送时滚动
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const last = messages[messages.length - 1];
    const userJustSent = !!last && last.role === 'user';
    if (atBottom || userJustSent) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      if (userJustSent) {
        const card = document.getElementById('chat-card');
        card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [messages, atBottom]);

  // 监听滚动计算是否在底部
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => {
      const threshold = 80; // 离底部阈值
      const isAt = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
      setAtBottom(isAt);
    };
    const opts: AddEventListenerOptions = { passive: true };
    el.addEventListener('scroll', handler, opts);
    handler();
    return () => el.removeEventListener('scroll', handler);
  }, [scrollRef]);

  // 初始对话仅有引导语时收缩聊天卡片尺寸；开始对话后再扩展
  const hasConversation = useMemo(() => {
    const moreThanGreeting =
      messages.length > 1 || messages.some(m => m.role === 'user') || messages.some(m => m.streaming);
    return moreThanGreeting;
  }, [messages]);

  // 虚拟化：仅在开始对话后启用（变量高度，动态测量）
  const rowVirtualizer = useVirtualizer({
    count: hasConversation ? messages.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 120,
    overscan: 8
  });

  // 一旦开始对话，默认折叠预设问题（用户可手动展开）
  useEffect(() => {
    if (hasConversation && !hasStoredPreference) setPresetOpen(false);
  }, [hasConversation, hasStoredPreference]);

  const onSend = async () => {
    const text = input.trim();
    if (isSending) return;
    if (!text) {
      toast.error('请输入内容后再发送');
      return;
    }
    setIsSending(true);
    const controller = new AbortController();
    setAbortCtrl(controller);
    setProgress(0);
    setSendStartAt(Date.now());
    setLastError(null);
    setLastPrompt(text);
    const userMsg: ChatBubble = { id: `u-${Date.now()}`, role: 'user', content: text };
    setMessages(prev => [
      ...prev,
      userMsg,
      { id: `a-${Date.now()}`, role: 'assistant', content: '', streaming: true, streamStartAt: Date.now() }
    ]);
    setInput('');

    const history: { role: 'user' | 'assistant' | 'system'; content: string }[] = messages.map(m => ({
      role: m.role,
      content: m.content
    }));
    let gen: Awaited<ReturnType<typeof deepseekChat>>;
    try {
      gen = await deepseekChat([...history, { role: 'user', content: text }], {
        stream: true,
        systemPrompt,
        signal: controller.signal
      });
    } catch (e) {
      setIsSending(false);
      setLastError(String(e));
      setMessages(prev =>
        prev.map(m => (m.streaming ? { ...m, streaming: false, content: '抱歉，生成被中断或发生错误。' } : m))
      );
      return;
    }
    // 流式产出
    if (typeof (gen as AsyncGenerator<string>)[Symbol.asyncIterator] === 'function') {
      try {
        for await (const chunk of gen as AsyncGenerator<string>) {
          setMessages(prev => {
            const next = [...prev];
            const idx = next.findIndex(m => m.streaming);
            if (idx >= 0) {
              next[idx] = { ...next[idx], content: next[idx].content + chunk };
            }
            return next;
          });
          setProgress(prev => prev + chunk.length);
        }
        // 结束流式
        setMessages(prev => prev.map(m => (m.streaming ? { ...m, streaming: false } : m)));
      } catch (_e) {
        // 处理中断
        setLastError(String(_e));
        setMessages(prev => prev.map(m => (m.streaming ? { ...m, streaming: false } : m)));
      }
    } else {
      // 非流式响应
      if ('content' in gen) {
        const res = gen as { content: string };
        setMessages(prev => prev.map(m => (m.streaming ? { ...m, streaming: false, content: res.content } : m)));
      }
    }
    setIsSending(false);
    setAbortCtrl(null);
  };

  // 预设问题快速发送（不依赖输入框状态）
  const sendPreset = async (preset: string) => {
    if (isSending) return;
    const text = preset.trim();
    if (!text) {
      toast.error('请输入内容后再发送');
      return;
    }
    setIsSending(true);
    const controller = new AbortController();
    setAbortCtrl(controller);
    setProgress(0);
    setSendStartAt(Date.now());
    setLastError(null);
    setLastPrompt(text);
    const userMsg: ChatBubble = { id: `u-${Date.now()}`, role: 'user', content: text };
    setMessages(prev => [
      ...prev,
      userMsg,
      { id: `a-${Date.now()}`, role: 'assistant', content: '', streaming: true, streamStartAt: Date.now() }
    ]);

    const history: { role: 'user' | 'assistant' | 'system'; content: string }[] = messages.map(m => ({
      role: m.role,
      content: m.content
    }));
    let gen: Awaited<ReturnType<typeof deepseekChat>>;
    try {
      gen = await deepseekChat([...history, { role: 'user', content: text }], {
        stream: true,
        systemPrompt,
        signal: controller.signal
      });
    } catch (e) {
      setIsSending(false);
      setLastError(String(e));
      setMessages(prev =>
        prev.map(m => (m.streaming ? { ...m, streaming: false, content: '抱歉，生成被中断或发生错误。' } : m))
      );
      return;
    }
    // 流式产出
    if (typeof (gen as AsyncGenerator<string>)[Symbol.asyncIterator] === 'function') {
      try {
        for await (const chunk of gen as AsyncGenerator<string>) {
          setMessages(prev => {
            const next = [...prev];
            const idx = next.findIndex(m => m.streaming);
            if (idx >= 0) {
              next[idx] = { ...next[idx], content: next[idx].content + chunk };
            }
            return next;
          });
          setProgress(prev => prev + chunk.length);
        }
        // 结束流式
        setMessages(prev => prev.map(m => (m.streaming ? { ...m, streaming: false } : m)));
      } catch (_e) {
        // 处理中断
        setLastError(String(_e));
        setMessages(prev => prev.map(m => (m.streaming ? { ...m, streaming: false } : m)));
      }
    } else {
      // 非流式响应
      if ('content' in gen) {
        const res = gen as { content: string };
        setMessages(prev => prev.map(m => (m.streaming ? { ...m, streaming: false, content: res.content } : m)));
      }
    }
    setIsSending(false);
    setAbortCtrl(null);
  };

  const stopStreaming = () => {
    abortCtrl?.abort();
  };

  // 文本域自适应高度
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const adjustInputHeight = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const max = 240; // 最大高度约 240px
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  };

  return (
    <>
      <Header title='AI 情绪疏导师' immersiveMode={immersiveMode} />
      <Container className='pb-0'>
        <div className='page-sections space-y-6'>
          {/* 标签页导航（对齐设置页样式） */}
          <Card variant='default' padding='sm' className='overflow-hidden p-2 sm:p-3'>
            <div
              role='tablist'
              aria-label='导师功能切换'
              aria-orientation='horizontal'
              className='flex space-x-2 sm:space-x-3 lg:space-x-4 xl:space-x-5 2xl:space-x-6 overflow-x-auto scrollbar-hide p-1 snap-x snap-mandatory'>
              <button
                role='tab'
                aria-selected={activeTab === 'chat'}
                onClick={() => setActiveTab('chat')}
                className={`flex-1 flex flex-row items-center justify-center gap-2 px-3 sm:px-3 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm lg:text-base xl:text-lg transition-all duration-200 min-w-0 font-semibold snap-start ${
                  activeTab === 'chat'
                    ? 'bg-purple-500 text-white shadow-lg transform scale-[1.02]'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:shadow-md hover:scale-[1.01]'
                }`}>
                <MessageSquare className='w-4 h-4 xl:w-5 xl:h-5 flex-shrink-0' />
                <span className='text-sm sm:text-base lg:text-lg xl:text-xl font-bold truncate whitespace-nowrap'>
                  AI 伴聊
                </span>
              </button>
              <button
                role='tab'
                aria-selected={activeTab === 'exercises'}
                onClick={() => setActiveTab('exercises')}
                className={`flex-1 flex flex-row items-center justify-center gap-2 px-3 sm:px-3 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm lg:text-base xl:text-lg transition-all duration-200 min-w-0 font-semibold snap-start ${
                  activeTab === 'exercises'
                    ? 'bg-purple-500 text-white shadow-lg transform scale-[1.02]'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:shadow-md hover:scale-[1.01]'
                }`}>
                <Fingerprint className='w-4 h-4 xl:w-5 xl:h-5 flex-shrink-0' />
                <span className='text-sm sm:text-base lg:text-lg xl:text-xl font-bold truncate whitespace-nowrap'>
                  疏导练习
                </span>
              </button>
            </div>
          </Card>
          <div className='mt-4'></div>
          {/* 根据标签页显示不同的布局 */}
          {activeTab === 'exercises' && (
            <div className='space-y-6'>
              {/* 疏导练习区 */}
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6'>
                {/* 呼吸练习 */}
                <Card variant='default' padding='md'>
                  <div className='flex items-center justify-between mb-3'>
                    <h3 className='text-lg lg:text-xl xl:text-2xl font-semibold text-gray-900 dark:text-gray-50'>
                      呼吸练习
                    </h3>
                    <div className='flex items-center gap-2'>
                      <StatusBadge status={exerciseStatus.breath} />
                      <button
                        onClick={() => toggleExercise('breath')}
                        aria-expanded={exerciseOpen.breath}
                        className='text-xs px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors'>
                        {exerciseOpen.breath ? '收起' : '展开'}
                      </button>
                    </div>
                  </div>
                  {exerciseOpen.breath && (
                    <>
                      <p className='text-sm text-gray-700 dark:text-gray-200 mb-3'>
                        通过节律呼吸快速调节身心，降低紧张与压力。
                      </p>
                      <div className='flex flex-wrap gap-2'>
                        <button
                          onClick={() => {
                            setBreathParams({ totalSeconds: 180, pace: { inhale: 4, hold: 4, exhale: 6 } });
                            markInProgress('breath');
                            setShowBreath(true);
                          }}
                          className='h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-300 dark:focus:ring-emerald-500 active:scale-95'>
                          启动 3 分钟呼吸
                        </button>
                        <button
                          onClick={() => {
                            setBreathParams({ totalSeconds: 300, pace: { inhale: 5, hold: 5, exhale: 7 } });
                            markInProgress('breath');
                            setShowBreath(true);
                          }}
                          className='h-9 px-3 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-800/40 text-emerald-700 dark:text-emerald-200 text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-300 dark:focus:ring-emerald-500 active:scale-95'>
                          5 分钟·慢节律
                        </button>
                      </div>
                    </>
                  )}
                </Card>

                {/* 正念冥想（调整至第二位） */}
                <Card variant='default' padding='md'>
                  <div className='flex items-center justify-between mb-3'>
                    <h3 className='text-lg lg:text-xl xl:text-2xl font-semibold text-gray-900 dark:text-gray-50'>
                      正念冥想
                    </h3>
                    <div className='flex items-center gap-2'>
                      <StatusBadge status={exerciseStatus.mindfulness} />
                      <button
                        onClick={() => toggleExercise('mindfulness')}
                        aria-expanded={exerciseOpen.mindfulness}
                        className='text-xs px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors'>
                        {exerciseOpen.mindfulness ? '收起' : '展开'}
                      </button>
                    </div>
                  </div>
                  {exerciseOpen.mindfulness && (
                    <>
                      <p className='text-sm text-gray-700 dark:text-gray-200 mb-3'>
                        通过引导冥想培养当下觉察，提升情绪调节能力。
                      </p>
                      <button
                        onClick={() => {
                          markInProgress('mindfulness');
                          setShowMindfulness(true);
                        }}
                        className='h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500 active:scale-95'>
                        开始 10 分钟冥想
                      </button>
                    </>
                  )}
                </Card>

                {/* 感官回归 */}
                <Card variant='default' padding='md'>
                  <div className='flex items-center justify-between mb-3'>
                    <h3 className='text-lg lg:text-xl xl:text-2xl font-semibold text-gray-900 dark:text-gray-50'>
                      感官回归
                    </h3>
                    <div className='flex items-center gap-2'>
                      <StatusBadge status={exerciseStatus.grounding} />
                      <button
                        onClick={() => toggleExercise('grounding')}
                        aria-expanded={exerciseOpen.grounding}
                        className='text-xs px-2 py-1 rounded-md bg-gray-100 dark:bg-theme-gray-700 text-gray-600 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-theme-gray-600 transition-colors'>
                        {exerciseOpen.grounding ? '收起' : '展开'}
                      </button>
                    </div>
                  </div>
                  {exerciseOpen.grounding && (
                    <>
                      <p className='text-sm text-gray-700 dark:text-gray-200 mb-3'>
                        通过感官觉察快速回到当下，缓解焦虑与恐慌。
                      </p>
                      <div className='flex flex-wrap gap-2'>
                        <button
                          onClick={() => {
                            setGroundingInitial(15);
                            markInProgress('grounding');
                            setShowGrounding(true);
                          }}
                          className='h-9 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-300 dark:focus:ring-teal-500 active:scale-95'>
                          快速版 (15秒)
                        </button>
                        <button
                          onClick={() => {
                            setGroundingInitial(30);
                            markInProgress('grounding');
                            setShowGrounding(true);
                          }}
                          className='h-9 px-3 rounded-lg bg-teal-100 dark:bg-teal-900/30 hover:bg-teal-200 dark:hover:bg-teal-800/40 text-teal-700 dark:text-teal-200 text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-300 dark:focus:ring-teal-500 active:scale-95'>
                          标准版 (30秒)
                        </button>
                      </div>
                    </>
                  )}
                </Card>

                {/* 认知重构（调整至第四位） */}
                <Card variant='default' padding='md'>
                  <div className='flex items-center justify-between mb-3'>
                    <h3 className='text-lg lg:text-xl xl:text-2xl font-semibold text-gray-900 dark:text-gray-50'>
                      认知重构
                    </h3>
                    <div className='flex items-center gap-2'>
                      <StatusBadge status={exerciseStatus.reframe} />
                      <button
                        onClick={() => toggleExercise('reframe')}
                        aria-expanded={exerciseOpen.reframe ? 'true' : 'false'}
                        className='text-xs px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors'>
                        {exerciseOpen.reframe ? '收起' : '展开'}
                      </button>
                    </div>
                  </div>
                  {exerciseOpen.reframe && (
                    <>
                      <p className='text-sm text-gray-700 dark:text-gray-200 mb-3'>
                        识别自动化想法，生成更平衡的替代陈述，缓解负面情绪。
                      </p>
                      <button
                        onClick={() => {
                          markInProgress('reframe');
                          setShowReframe(true);
                        }}
                        className='h-9 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-500 active:scale-95'>
                        开始认知重构
                      </button>
                    </>
                  )}
                </Card>

                {/* 情绪日记（暂时隐藏） */}
                {JOURNAL_ENABLED && (
                  <Card variant='default' padding='md'>
                    <div className='flex items-center justify-between mb-3'>
                      <h3 className='text-lg lg:text-xl xl:text-2xl font-semibold text-gray-900 dark:text-gray-50'>
                        情绪日记
                      </h3>
                      <div className='flex items-center gap-2'>
                        <StatusBadge status={exerciseStatus.journal} />
                        <button
                          onClick={() => toggleExercise('journal')}
                          aria-expanded={exerciseOpen.journal}
                          className='text-xs px-2 py-1 rounded-md bg-gray-100 dark:bg-theme-gray-700 text-gray-600 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-theme-gray-600 transition-colors'>
                          {exerciseOpen.journal ? '收起' : '展开'}
                        </button>
                      </div>
                    </div>
                    {exerciseOpen.journal && (
                      <>
                        <p className='text-sm text-gray-700 dark:text-gray-200 mb-3'>
                          记录当前情绪状态，识别触发因素和应对策略。
                        </p>
                        <button
                          onClick={() => {
                            markInProgress('journal');
                            setShowEmotionJournal(true);
                          }}
                          className='h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-500 active:scale-95'>
                          写情绪日记
                        </button>
                      </>
                    )}
                  </Card>
                )}
              </div>

              {/* 安全与免责声明 */}
              <Card variant='default' padding='md'>
                <div className='flex items-center gap-2 text-red-600 mb-2'>
                  <ShieldAlert className='w-4 h-4 sm:w-5 sm:h-5' />
                  <span className='text-sm sm:text-base font-semibold'>安全与免责声明</span>
                </div>
                <p className='text-sm sm:text-base text-gray-500 leading-relaxed'>
                  本页面提供一般性自助支持与练习，不构成医疗建议。若你处于危机或有自伤他伤等紧急风险，请立即联系当地专业医疗或心理咨询机构。
                </p>
              </Card>
            </div>
          )}
        </div>

        {/* 右侧：对话区（仅在 AI 伴聊标签显示） */}
        {activeTab === 'chat' && (
          <div className='space-y-6'>
            {lastError && !isSending && (
              <Card
                variant='default'
                padding='sm'
                role='alert'
                aria-live='assertive'
                className='border border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-900/20'>
                <div className='text-sm sm:text-base text-red-700 dark:text-red-300'>发生错误：{lastError}</div>
                <div className='text-sm text-gray-500 dark:text-gray-400 mt-1'>
                  网络：{isOnline ? connectionType || 'unknown' : '离线'}
                </div>
                <div className='mt-2'>
                  <Button
                    variant='primary'
                    size='sm'
                    onClick={() => {
                      if (lastPrompt) {
                        setInput(lastPrompt);
                        onSend();
                      }
                    }}
                  >
                    重试
                  </Button>
                </div>
              </Card>
            )}
            <Card
              id='chat-card'
              variant='default'
              padding='md'
              className={
                hasConversation
                  ? 'relative flex-1 min-h-[55svh] sm:min-h-[60svh] lg:min-h-[420px]'
                  : 'relative mx-auto w-full min-h-[220px]'
              }>
              <div
                ref={scrollRef}
                id='chat-log'
                role='log'
                aria-live='polite'
                aria-relevant='additions'
                aria-busy={isSending || messages.some(m => m.streaming)}
                className={
                  (hasConversation
                    ? 'h-[55svh] sm:h-[60svh] lg:h-[62svh] xl:h-[56svh] 2xl:h-[52svh] overflow-y-auto overscroll-y-contain'
                    : 'h-auto max-h-[40vh] overflow-y-visible flex items-center justify-center px-2 sm:px-3 lg:px-4 xl:px-6') +
                  ' pr-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent'
                }>
                {hasConversation ? (
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
                        }}
                      >
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
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  messages.map(m => (
                    <MessageItem
                      key={m.id}
                      m={m}
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
                    />
                  ))
                )}
              </div>
              {hasConversation && !atBottom && (
                <div className='absolute bottom-4 right-4'>
                  <Button
                    variant='primary'
                    size='sm'
                    aria-label='回到最新消息'
                    aria-controls='chat-log'
                    onClick={() => {
                      const el = scrollRef.current;
                      if (!el) return;
                      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
                      setAtBottom(true);
                    }}
                  >
                    回到底部
                  </Button>
                </div>
              )}
            </Card>

            {/* 已将“预计剩余”合并至消息内的“正在生成...”区域 */}

            

            <div className='flex flex-col sm:flex-row items-stretch sm:items-center'>
              <Card variant='default' padding='sm' className='flex-1 min-w-0 order-1 sm:order-none'>
                <textarea
                  ref={inputRef}
                  rows={2}
                  value={input}
                  onChange={e => {
                    const v = e.target.value;
                    setInput(v);
                    adjustInputHeight();
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey && !isSending) {
                      e.preventDefault();
                      onSend();
                    }
                  }}
                  placeholder='分享你的想法、感受，或任何想说的话...'
                  className='w-full bg-white/80 dark:bg-gray-800/90 outline-none text-sm xl:text-base placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 rounded-md px-3 py-2 xl:px-4 xl:py-3 transition-all duration-200 border border-gray-200 dark:border-gray-700 shadow-sm focus:shadow-md resize-none overflow-y-auto min-h-[64px] max-h-[240px]'
                  disabled={isSending}
                />
                {/* 输入区操作按钮：左侧“停止/重试”，右侧“发送”；移动端堆叠显示 */}
                <div className='mt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3' style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                  <div className='flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full'>
                    {isSending && (
                      <button
                        onClick={stopStreaming}
                        aria-label='停止生成'
                        aria-controls='chat-log'
                        className='w-full sm:w-auto h-11 sm:h-12 xl:h-12 px-3 sm:px-4 xl:px-5 py-2.5 sm:py-3 xl:py-3.5 rounded-2xl bg-gradient-to-r from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-800/20 hover:from-red-200 hover:to-red-100 dark:hover:from-red-800/40 dark:hover:to-red-700/30 text-red-700 dark:text-red-300 font-medium flex items-center justify-center gap-2 transition-all duration-300 hover:scale-105 hover:shadow-md focus:outline-none focus:ring-3 focus:ring-red-300/50 dark:focus:ring-red-600/50 active:scale-95 text-sm sm:text-base xl:text-lg border border-red-200/50 dark:border-red-700/30 min-w-[70px] sm:min-w-[80px] xl:min-w-[90px]'>
                        <div className='w-2 h-2 xl:w-2.5 xl:h-2.5 bg-red-500 rounded-sm' />
                        <span className='hidden xs:inline sm:inline'>停止</span>
                      </button>
                    )}
                    {lastError && lastPrompt && !isSending && (
                      <button
                        onClick={() => {
                          setInput(lastPrompt);
                          onSend();
                        }}
                        className='w-full sm:w-auto h-11 sm:h-12 xl:h-12 px-3 sm:px-4 xl:px-5 py-2.5 sm:py-3 xl:py-3.5 rounded-2xl bg-gradient-to-r from-amber-100 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-800/20 hover:from-amber-200 hover:to-yellow-100 dark:hover:from-amber-800/40 dark:hover:to-yellow-700/30 text-amber-700 dark:text-amber-300 font-medium transition-all duration-300 hover:scale-105 hover:shadow-md focus:outline-none focus:ring-3 focus:ring-amber-300/50 dark:focus:ring-amber-600/50 active:scale-95 text-sm sm:text-base xl:text-lg border border-amber-200/50 dark:border-amber-700/30 flex items-center justify-center gap-2 min-w-[70px] sm:min-w-[80px] xl:min-w-[90px]'>
                        <div className='w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin' />
                        <span className='hidden xs:inline sm:inline'>重试</span>
                      </button>
                    )}
                  </div>
                  <button
                    onClick={onSend}
                    disabled={isSending}
                    aria-disabled={isSending}
                    aria-label='发送消息'
                    aria-controls='chat-log'
                    className='w-full sm:w-auto group relative h-11 sm:h-12 xl:h-12 px-4 sm:px-5 xl:px-6 py-2.5 sm:py-3 xl:py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25 focus:outline-none focus:ring-3 focus:ring-purple-500/50 active:scale-95 flex items-center justify-center gap-2 min-w-[100px] sm:min-w-[110px] xl:min-w-[140px] whitespace-nowrap'>
                    {isSending ? (
                      <>
                        <div className='w-4 h-4 xl:w-5 xl:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin motion-reduce:animate-none' />
                        <span className='text-sm sm:text-base xl:text-lg font-medium whitespace-nowrap'>发送中...</span>
                      </>
                    ) : (
                      <>
                        <Send className='w-4 h-4 sm:w-5 sm:h-5 xl:w-6 xl:h-6 transition-transform group-hover:translate-x-0.5' />
                        <span className='text-sm sm:text-base xl:text-lg font-medium whitespace-nowrap'>发送</span>
                      </>
                    )}
                    {/* 发送按钮光效 */}
                    <div className='absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-400/0 via-white/20 to-purple-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none' />
                  </button>
                </div>
              </Card>

              <div className='flex items-center justify-center sm:justify-start gap-2 sm:gap-3 flex-shrink-0 order-2 sm:order-none'></div>
            </div>

            {/* 预设问题：输入框下方常驻，可折叠，分组展示 */}
            <Card variant='default' padding='sm' className='overflow-hidden'>
              <div className='flex items-center justify-between'>
                <div className='text-sm sm:text-base text-gray-600 dark:text-gray-300'>试试这些问题：</div>
                <button
                  onClick={() => setPresetOpen(prev => !prev)}
                  aria-expanded={presetOpen}
                  className='text-sm px-2 py-1 rounded-md bg-gray-100 dark:bg-theme-gray-800 text-gray-600 dark:text-gray-300'>
                  {presetOpen ? '收起' : '展开'}
                </button>
              </div>
              <div
                className={cn(
                  'mt-2 sm:mt-3 transition-all duration-300 ease-in-out overflow-hidden',
                  presetOpen ? 'max-h-[900px] opacity-100' : 'max-h-0 opacity-0'
                )}
                aria-hidden={!presetOpen}>
                <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2 sm:gap-3 xl:gap-4 2xl:gap-5'>
                  {presetGroups.map(group => (
                    <div key={group.label} className='rounded-lg p-2 sm:p-3 xl:p-4'>
                      <div className='flex items-center gap-1.5 mb-1'>
                        <span
                          className={cn(
                            'inline-flex items-center justify-center w-5 h-5 xl:w-6 xl:h-6 rounded-md text-[13px] xl:text-sm select-none',
                            group.accentClasses.bg,
                            group.accentClasses.text
                          )}>
                          {group.icon}
                        </span>
                        <span className={cn('text-sm xl:text-base font-semibold', group.accentClasses.text)}>
                          {group.label}
                        </span>
                      </div>
                      <div
                        role='group'
                        aria-label={`${group.label} 预设问题`}
                        className='flex flex-wrap gap-1.5 sm:gap-2 xl:gap-2.5'>
                        {group.items.map((q, idx) => (
                          <button
                            key={idx}
                            onClick={() => sendPreset(q)}
                            className='h-8 sm:h-9 xl:h-10 px-2 xl:px-3 py-1 rounded-lg text-sm xl:text-base bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 active:scale-95'>
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>


            {/* 移动端安全声明 */}
            <Card variant='default' padding='sm' className='xl:hidden'>
              <div className='flex items-center gap-2 text-red-600 mb-2'>
                <ShieldAlert className='w-4 h-4 sm:w-5 sm:h-5' />
                <span className='text-sm sm:text-base font-semibold'>安全与免责声明</span>
              </div>
              <p className='text-sm sm:text-base text-gray-500 leading-relaxed'>
                本页面提供一般性自助支持与练习，不构成医疗建议。若你处于危机或有自伤他伤等紧急风险，请立即联系当地专业医疗或心理咨询机构。
              </p>
            </Card>
          </div>
        )}
      </Container>

      {showBreath && (
        <BreathingGuide
          onClose={() => {
            setShowBreath(false);
            markIdle('breath');
          }}
          totalSeconds={breathParams?.totalSeconds}
          pace={breathParams?.pace}
        />
      )}
      {showReframe && (
        <CognitiveReframe
          onClose={() => {
            setShowReframe(false);
            markIdle('reframe');
          }}
        />
      )}
      {showGrounding && (
        <Grounding54321
          onClose={() => {
            setShowGrounding(false);
            markIdle('grounding');
          }}
          initialStepDuration={groundingInitial ?? 10}
        />
      )}
      {showMindfulness && (
        <MindfulnessMeditation
          onClose={() => {
            setShowMindfulness(false);
            markIdle('mindfulness');
          }}
        />
      )}
      {JOURNAL_ENABLED && showEmotionJournal && (
        <EmotionJournal
          onClose={() => {
            setShowEmotionJournal(false);
            markIdle('journal');
          }}
        />
      )}
    </>
  );
};

export default Mentor;
