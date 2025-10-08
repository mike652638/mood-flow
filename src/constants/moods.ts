import { MoodOption, MoodType } from '../types';

// 情绪选项配置
export const MOOD_OPTIONS: MoodOption[] = [
  {
    type: 'happy',
    label: '开心',
    emoji: '😊',
    color: 'bg-yellow-200 text-yellow-800',
    description: '感到快乐、愉悦、满足'
  },
  {
    type: 'excited',
    label: '兴奋',
    emoji: '🤩',
    color: 'bg-orange-200 text-orange-800',
    description: '充满活力、期待、热情'
  },
  {
    type: 'moved',
    label: '感动',
    emoji: '🥺',
    color: 'bg-pink-200 text-pink-800',
    description: '被触动、感激、温暖'
  },
  {
    type: 'fulfilled',
    label: '充实',
    emoji: '😌',
    color: 'bg-green-200 text-green-800',
    description: '满足、有成就感、充实'
  },
  {
    type: 'confident',
    label: '自信',
    emoji: '😎',
    color: 'bg-indigo-200 text-indigo-800',
    description: '自信、有把握、积极'
  },
  {
    type: 'calm',
    label: '平静',
    emoji: '😇',
    color: 'bg-blue-200 text-blue-800',
    description: '内心平和、放松、安宁'
  },
  {
    type: 'sad',
    label: '难过',
    emoji: '😢',
    color: 'bg-gray-200 text-gray-800',
    description: '感到悲伤、失落、沮丧'
  },
  {
    type: 'angry',
    label: '愤怒',
    emoji: '😠',
    color: 'bg-red-200 text-red-800',
    description: '生气、愤怒、不满'
  },
  {
    type: 'anxious',
    label: '焦虑',
    emoji: '😰',
    color: 'bg-purple-200 text-purple-800',
    description: '担心、紧张、不安'
  },
  {
    type: 'stressed',
    label: '压力',
    emoji: '😵',
    color: 'bg-rose-200 text-rose-800',
    description: '感到压力、疲惫、负担重'
  },
  {
    type: 'panic',
    label: '恐慌',
    emoji: '😱',
    color: 'bg-amber-200 text-amber-800',
    description: '恐慌、害怕、惊慌失措'
  },
  {
    type: 'depressed',
    label: '抑郁',
    emoji: '😞',
    color: 'bg-slate-200 text-slate-800',
    description: '抑郁、低落、消沉'
  }
];

// 根据情绪类型获取配置
export const getMoodOption = (moodType: MoodType): MoodOption => {
  return MOOD_OPTIONS.find(option => option.type === moodType) || MOOD_OPTIONS[0];
};

// 情绪强度标签
export const INTENSITY_LABELS = {
  1: '非常轻微',
  2: '轻微',
  3: '较轻',
  4: '轻度',
  5: '中等',
  6: '较强',
  7: '强烈',
  8: '很强烈',
  9: '极强',
  10: '最强烈'
};

// 获取情绪强度描述
export const getIntensityLabel = (intensity: number): string => {
  return INTENSITY_LABELS[intensity as keyof typeof INTENSITY_LABELS] || '未知';
};

// 情绪颜色映射（用于图表）
export const MOOD_COLORS: Record<MoodType, string> = {
  happy: '#FEF3C7',
  excited: '#FED7AA',
  moved: '#FCE7F3',
  fulfilled: '#D1FAE5',
  confident: '#E0E7FF',
  calm: '#DBEAFE',
  sad: '#F3F4F6',
  angry: '#FECACA',
  anxious: '#E9D5FF',
  stressed: '#FECDD3',
  panic: '#FEF3C7',
  depressed: '#F1F5F9'
};

// 获取情绪对应的图表颜色
export const getMoodColor = (moodType: MoodType): string => {
  return MOOD_COLORS[moodType] || '#F3F4F6';
};