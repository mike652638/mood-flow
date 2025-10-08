import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Wordcloud } from '@visx/wordcloud';
import { scaleOrdinal } from '@visx/scale';
import {
  format,
  subDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  TrendingUp,
  PieChart as PieChartIcon,
  Cloud,
  BarChart3,
  Calendar,
  Search,
  List,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Card from '../components/Card';
import Container from '../components/Container';
import Header from '../components/Header';
import { getMoodOption, MOOD_COLORS, MOOD_OPTIONS } from '../constants/moods';
import { MoodRecord, MoodStats, TrendDataPoint, WordCloudData, MoodType } from '../types';
import { useImmersiveMode } from '../hooks/useImmersiveMode';
import { initDynamicStylesObserver } from '../utils/dynamicStyles';
import '../styles/analytics.scss';
import { cn } from '../lib/utils';

// 将十六进制颜色转换为 rgba 以便用于 box-shadow 等带透明度的效果
const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.substring(0, 2), 16);
  const g = parseInt(normalized.substring(2, 4), 16);
  const b = parseInt(normalized.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// 更真实、稳定的演示数据（带趋势、周末/工作日差异、可复现随机）
const createStableRng = (seed = 202410) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const pick = <T,>(arr: T[], rnd: () => number) => arr[Math.floor(rnd() * arr.length)];
const gaussian = (rnd: () => number, mean = 0, std = 1) => {
  let u = 0,
    v = 0;
  while (u === 0) u = rnd();
  while (v === 0) v = rnd();
  return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
};
const TAG_POOL = [
  '快乐',
  '平静',
  '兴奋',
  '宁静',
  '放松',
  '满足',
  '感恩',
  '希望',
  '成长',
  '反思',
  '治愈',
  '温暖',
  '焦虑',
  '压力',
  '疲惫',
  '孤独',
  '愤怒',
  '沮丧',
  '困惑',
  '担心',
  '喜悦',
  '安心',
  '舒适',
  '自由',
  '充实',
  '幸福',
  '乐观',
  '积极'
];
const DIARY_POOL = [
  '今天进行了深呼吸练习，感觉更安稳',
  '与朋友聊天收获支持与温暖',
  '工作推进顺利，心情轻松不少',
  '傍晚散步让思绪更清晰',
  '读书的一小时带来宁静',
  '练习冥想后压力缓解',
  '忙碌但可控，对自己满意',
  '小目标完成，感到满足与自信'
];
const mockRecords: MoodRecord[] = (() => {
  const rnd = createStableRng(13579);
  const moodTypes = MOOD_OPTIONS.map(o => o.type) as MoodType[];
  const DAYS = 45; // 覆盖一个半月，保证日历视图更丰满
  const records: MoodRecord[] = [];
  for (let i = 0; i < DAYS; i++) {
    const date = subDays(new Date(), i);
    const isWeekend = [0, 6].includes(date.getDay());
    // 基于周末/工作日的记录数与强度基线
    const baseCount = isWeekend ? 2.2 : 1.6;
    const countNoise = gaussian(rnd, 0, 0.9);
    const recordsCount = clamp(Math.round(baseCount + countNoise), 0, 5);
    const intensityBase = isWeekend ? 5.2 : 5.8;
    for (let j = 0; j < recordsCount; j++) {
      // 轻微趋势：越接近今天，强度略微下降，体现近期平稳
      const trendShift = (i / DAYS) * -0.8;
      const intensity = clamp(Math.round(intensityBase + trendShift + gaussian(rnd, 0, 1.4)), 1, 10);
      const mood = pick(moodTypes, rnd);
      const tagsCount = clamp(Math.round(1 + rnd() * 2), 1, 3);
      const tags = Array.from({ length: tagsCount }, () => pick(TAG_POOL, rnd));
      const timeOffsetMinutes = Math.floor(rnd() * (12 * 60)); // 随机在当天的前12小时
      const created = new Date(date.getTime() - timeOffsetMinutes * 60 * 1000);
      records.push({
        id: `record-${i}-${j}`,
        user_id: 'user1',
        mood_type: mood,
        mood_intensity: intensity,
        diary_content: pick(DIARY_POOL, rnd),
        tags,
        created_at: created.toISOString(),
        updated_at: created.toISOString()
      });
    }
  }
  return records.sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
})();

const Analytics = () => {
  const { immersiveMode } = useImmersiveMode();
  // 主趋势图时间窗口（与迷你趋势联动），默认30天
  const [trendWindow] = useState<number>(30);
  // 历史记录视图状态与搜索
  const [historyViewMode, setHistoryViewMode] = useState<'calendar' | 'list'>('calendar');
  const [historySearchText, setHistorySearchText] = useState('');
  const [historyCurrentDate, setHistoryCurrentDate] = useState(new Date());
  const [historySelectedDate, setHistorySelectedDate] = useState<Date | null>(null);
  // 列表视图无限滚动（增量渲染）
  const LIST_BATCH = 15;
  const [historyVisibleCount, setHistoryVisibleCount] = useState<number>(LIST_BATCH);
  const historyListSentinelRef = useRef<HTMLDivElement | null>(null);
  // 计算趋势数据
  const trendData: TrendDataPoint[] = useMemo(() => {
    const days = Array.from({ length: trendWindow }, (_, i) => {
      const date = subDays(new Date(), trendWindow - 1 - i);
      const dayRecords = mockRecords.filter(
        record => format(new Date(record.created_at), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      );

      const avgIntensity =
        dayRecords.length > 0
          ? dayRecords.reduce((sum, record) => sum + record.mood_intensity, 0) / dayRecords.length
          : 0;

      return {
        date: format(date, 'MM/dd'),
        value: Math.round(avgIntensity * 10) / 10,
        count: dayRecords.length
      };
    });

    return days;
  }, [trendWindow]);

  // 历史记录过滤（使用本页的 mockRecords 数据源）
  const filteredHistoryRecords = useMemo(() => {
    const q = historySearchText.trim().toLowerCase();
    const result = mockRecords.filter(record => {
      if (q === '') return true;
      return record.diary_content.toLowerCase().includes(q) || record.tags.some(tag => tag.toLowerCase().includes(q));
    });
    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return result;
  }, [historySearchText]);

  // 搜索或视图切换时重置可见数量
  useEffect(() => {
    setHistoryVisibleCount(LIST_BATCH);
  }, [historySearchText, historyViewMode]);

  // 观察底部哨兵，自动加载更多（仅在列表视图）
  useEffect(() => {
    if (historyViewMode !== 'list') return;
    const sentinel = historyListSentinelRef.current;
    if (!sentinel) return;
    const hasMore = historyVisibleCount < filteredHistoryRecords.length;
    if (!hasMore) return;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setHistoryVisibleCount(prev => Math.min(prev + LIST_BATCH, filteredHistoryRecords.length));
          }
        });
      },
      { root: null, rootMargin: '200px', threshold: 0.01 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [historyViewMode, historyVisibleCount, filteredHistoryRecords.length]);

  // 历史记录日历：当前月份的所有日期
  const historyMonthDays = useMemo(() => {
    const start = startOfMonth(historyCurrentDate);
    const end = endOfMonth(historyCurrentDate);
    return eachDayOfInterval({ start, end });
  }, [historyCurrentDate]);

  const getRecordsForDate = (date: Date) => {
    return mockRecords.filter(record => isSameDay(new Date(record.created_at), date));
  };

  const selectedDateRecords = useMemo(() => {
    if (!historySelectedDate) return [];
    return getRecordsForDate(historySelectedDate);
  }, [historySelectedDate]);

  const goToPreviousMonth = () => setHistoryCurrentDate(subMonths(historyCurrentDate, 1));
  const goToNextMonth = () => setHistoryCurrentDate(addMonths(historyCurrentDate, 1));

  // 计算情绪统计（稳定显示12种情绪类别）
  const moodStats: MoodStats[] = useMemo(() => {
    const moodCounts: Record<string, { count: number; totalIntensity: number }> = {};

    mockRecords.forEach(record => {
      if (!moodCounts[record.mood_type]) {
        moodCounts[record.mood_type] = { count: 0, totalIntensity: 0 };
      }
      moodCounts[record.mood_type].count++;
      moodCounts[record.mood_type].totalIntensity += record.mood_intensity;
    });

    const totalRecords = mockRecords.length;

    // 基于 MOOD_OPTIONS 覆盖所有类别，缺失数据填零
    return MOOD_OPTIONS.map(option => {
      const data = moodCounts[option.type] || { count: 0, totalIntensity: 0 };
      const avg = data.count > 0 ? Math.round((data.totalIntensity / data.count) * 10) / 10 : 0;
      const pct = totalRecords > 0 ? Math.round((data.count / totalRecords) * 100) : 0;
      return {
        mood_type: option.type as MoodType,
        count: data.count,
        average_intensity: avg,
        percentage: pct
      };
    });
  }, []);

  // 已移除子卡片迷你趋势与箭头，以避免遮挡内容

  // 计算词云数据
  const wordCloudData: WordCloudData[] = useMemo(() => {
    const tagCounts: Record<string, number> = {};

    // 过滤掉非情绪相关的标签
    const filterNonEmotionTags = (tag: string): boolean => {
      // 过滤掉"标签"开头的非情绪标签
      if (tag.startsWith('标签')) return false;
      // 过滤掉纯数字标签
      if (/^\d+$/.test(tag)) return false;
      // 过滤掉其他非情绪相关的通用标签
      const nonEmotionTags = ['tag', 'label', '测试', 'test'];
      return !nonEmotionTags.some(nonTag => tag.toLowerCase().includes(nonTag.toLowerCase()));
    };

    mockRecords.forEach(record => {
      record.tags.forEach(tag => {
        if (filterNonEmotionTags(tag)) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      });
    });

    // 添加更多真实的情绪相关词汇
    const emotionWords = {
      快乐: 18,
      平静: 15,
      兴奋: 12,
      宁静: 10,
      放松: 16,
      满足: 13,
      感恩: 11,
      希望: 14,
      成长: 9,
      反思: 8,
      治愈: 19,
      温暖: 14,
      焦虑: 7,
      压力: 6,
      疲惫: 5,
      孤独: 4,
      愤怒: 3,
      沮丧: 4,
      困惑: 5,
      担心: 6,
      喜悦: 17,
      安心: 13,
      舒适: 11,
      自由: 10,
      充实: 12,
      幸福: 20,
      乐观: 9,
      积极: 15
    };

    Object.entries(emotionWords).forEach(([word, count]) => {
      tagCounts[word] = (tagCounts[word] || 0) + count;
    });

    return Object.entries(tagCounts)
      .map(([text, value]) => ({ text, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 50);
  }, []);

  // 优化的颜色方案 - 更符合页面设计风格
  const colorScale = scaleOrdinal({
    domain: wordCloudData.map(d => d.text),
    range: [
      '#8B5CF6', // 紫色 - 主色调
      '#06B6D4', // 青色
      '#10B981', // 绿色
      '#F59E0B', // 橙色
      '#EF4444', // 红色
      '#EC4899', // 粉色
      '#6366F1', // 靛蓝
      '#84CC16', // 青柠
      '#F97316', // 橙红
      '#8B5A2B' // 棕色
    ]
  });

  // 饼图响应式配置（基于容器宽度分档调整标签/半径）
  const [pieSize, setPieSize] = useState({ width: 400, height: 280 });
  const pieRef = useRef<HTMLDivElement>(null);
  const pieConfig = useMemo(() => {
    const w = pieSize.width;
    const isUltraSmall = w < 340; // 超小屏
    const isSmall = w < 420;
    const isLarge = w >= 720;
    const isDark = document.documentElement.classList.contains('dark');

    return {
      // 超小屏减少环形半径，小屏进一步减少，大屏适中
      innerRadiusPct: isUltraSmall ? 45 : isSmall ? 40 : isLarge ? 30 : 34,
      outerRadiusPct: isUltraSmall ? 70 : isSmall ? 75 : isLarge ? 82 : 80,
      labelFontSize: isUltraSmall ? 9 : isSmall ? 10 : isLarge ? 12 : 11,
      // 超小屏和小屏标签更外移，大屏增加引导线长度
      labelRadiusMultiplier: isUltraSmall ? 1.35 : isSmall ? 1.28 : isLarge ? 1.25 : 1.2,
      // 超小屏仅显示主要标签（>8%），小屏5%，大屏2%
      labelThreshold: isUltraSmall ? 0.08 : isSmall ? 0.05 : isLarge ? 0.02 : 0.03,
      lineDash: isUltraSmall ? '4 3' : isSmall ? '3 2' : '2 2',
      // 根据主题动态调整引导线颜色：深色模式使用更亮的紫色以提升对比度
      lineColor: isDark ? hexToRgba('#C4B5FD', 0.75) : hexToRgba('#8B5CF6', 0.35),
      lineWidth: isUltraSmall ? 1.5 : isSmall ? 1 : isLarge ? 1.2 : 1
    };
  }, [pieSize.width]);

  useEffect(() => {
    const updatePieSize = () => {
      if (pieRef.current) {
        const el = pieRef.current;
        setPieSize({ width: el.offsetWidth, height: el.offsetHeight });
      }
    };
    updatePieSize();
    window.addEventListener('resize', updatePieSize);
    return () => window.removeEventListener('resize', updatePieSize);
  }, []);

  // 饼图默认折线标签（自绘引导线，仅标签显示时绘制），并避免小屏顶部越界裁剪
  const RADIAN = Math.PI / 180;
  const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, payload }: any) => {
    if (percent < pieConfig.labelThreshold) return null;

    const w = pieSize.width;
    const h = pieSize.height;
    const isUltraSmall = w < 340;
    const isSmall = w < 420;
    const isLarge = w >= 720;

    const baseRadius = innerRadius + (outerRadius - innerRadius) * pieConfig.labelRadiusMultiplier;
    const rawX = cx + baseRadius * Math.cos(-midAngle * RADIAN);
    const rawY = cy + baseRadius * Math.sin(-midAngle * RADIAN);

    // 防止文本坐标越界（小屏顶部更容易被裁剪）
    const padding = Math.max(8, pieConfig.labelFontSize + 2);
    const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
    const x = clamp(rawX, padding, w - padding);
    const y = clamp(rawY + (isSmall ? 2 : 0), padding, h - padding);

    const textAnchor = x > cx ? 'start' : 'end';
    const isDark = document.documentElement.classList.contains('dark');
    const fill = isDark ? '#E5E7EB' : '#374151';
    const text = `${getMoodOption(payload.mood_type).label} ${Math.round(percent * 100)}%`;

    // 自绘引导线：仅当标签显示时绘制，避免“只有引导线无标签”的情况
    const sx = cx + outerRadius * Math.cos(-midAngle * RADIAN);
    const sy = cy + outerRadius * Math.sin(-midAngle * RADIAN);
    const extend = isLarge ? 6 : isUltraSmall ? 2 : 4; // 大屏线稍长
    const ex = x + (textAnchor === 'start' ? extend : -extend);
    const ey = y;

    return (
      <g>
        <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={pieConfig.lineColor} strokeWidth={pieConfig.lineWidth} strokeDasharray={pieConfig.lineDash} />
        <text
          x={x}
          y={y}
          fill={fill}
          textAnchor={textAnchor}
          dominantBaseline='central'
          fontSize={pieConfig.labelFontSize}
          fontWeight={600}
        >
          {text}
        </text>
      </g>
    );
  };

  // 响应式词云尺寸
  const [wordCloudSize, setWordCloudSize] = useState({ width: 400, height: 250 });
  const wordCloudRef = useRef<HTMLDivElement>(null);

  // Tooltip状态
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    word: string;
    count: number;
  }>({ visible: false, x: 0, y: 0, word: '', count: 0 });

  useEffect(() => {
    // 初始化动态样式观察器
    const observer = initDynamicStylesObserver();

    // 清理函数
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const updateSize = () => {
      if (wordCloudRef.current) {
        const container = wordCloudRef.current;
        const width = container.offsetWidth - 48; // 增加padding空间
        const height = container.offsetHeight - 48;
        setWordCloudSize({ width: Math.max(280, width), height: Math.max(180, height) });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return (
    <>
      <Header title='情绪分析' immersiveMode={immersiveMode} />
      <Container spacing='normal'>
        <div className='page-sections'>
          {/* 情绪趋势图 */}
          <Card
            variant='default'
            padding='lg'
            className='bg-gradient-to-br from-white/80 to-blue-50/60 dark:from-gray-800/80 dark:to-blue-900/20 backdrop-blur-sm rounded-2xl lg:rounded-3xl p-6 lg:p-8 xl:p-10 border border-white/30 dark:border-gray-700/30 shadow-lg xl:col-span-2'>
            <div className='flex items-center space-x-3 lg:space-x-4 mb-6 lg:mb-8'>
              <div className='p-2 lg:p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl lg:rounded-2xl shadow-md'>
                <TrendingUp className='w-6 h-6 lg:w-7 lg:h-7 text-white' />
              </div>
              <div>
                <h3 className='text-xl lg:text-2xl xl:text-3xl font-bold text-gray-800 dark:text-gray-200'>情绪趋势</h3>
                <p className='text-sm lg:text-base xl:text-lg text-gray-500 dark:text-gray-400'>
                  最近{trendWindow}天的情绪变化
                </p>
              </div>
            </div>
            <div className='h-72 bg-gradient-to-br from-white/50 to-blue-50/30 dark:from-gray-900/50 dark:to-blue-900/10 rounded-xl p-4 border border-blue-100/30 dark:border-blue-800/30'>
              <ResponsiveContainer width='100%' height='100%'>
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray='3 3'
                    stroke='rgba(139, 92, 246, 0.2)'
                    className='dark:stroke-purple-400/20'
                  />
                  <XAxis
                    dataKey='date'
                    stroke='#6B7280'
                    className='dark:stroke-gray-400'
                    fontSize={12}
                    tick={{ fill: '#6B7280' }}
                    axisLine={{ stroke: '#6B7280' }}
                    tickLine={{ stroke: '#6B7280' }}
                    height={20}
                  />
                  <YAxis
                    domain={[0, 10]}
                    stroke='#6B7280'
                    className='dark:stroke-gray-400'
                    fontSize={12}
                    tick={{ fill: '#6B7280' }}
                    axisLine={{ stroke: '#6B7280' }}
                    tickLine={{ stroke: '#6B7280' }}
                    width={15}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: '16px',
                      backdropFilter: 'blur(10px)',
                      color: '#374151',
                      boxShadow: '0 10px 25px rgba(139, 92, 246, 0.1)'
                    }}
                    formatter={(value: number) => [`${value}/10`, '情绪强度']}
                    labelStyle={{ color: '#6B7280', fontWeight: 'bold' }}
                  />
                  <Line
                    type='monotone'
                    dataKey='value'
                    stroke='url(#colorGradient)'
                    strokeWidth={4}
                    dot={{ fill: '#8B5CF6', strokeWidth: 3, r: 5, stroke: '#ffffff', strokeOpacity: 0.8 }}
                    activeDot={{ r: 8, stroke: '#8B5CF6', strokeWidth: 3, fill: '#ffffff' }}
                  />
                  <defs>
                    <linearGradient id='colorGradient' x1='0' y1='0' x2='1' y2='0'>
                      <stop offset='0%' stopColor='#8B5CF6' />
                      <stop offset='50%' stopColor='#EC4899' />
                      <stop offset='100%' stopColor='#06B6D4' />
                    </linearGradient>
                  </defs>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className='grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6'>
            {/* 情绪分布饼图 */}
            <Card
              variant='default'
              padding='lg'
              className='bg-gradient-to-br from-white/80 to-pink-50/60 dark:from-gray-800/80 dark:to-pink-900/20 backdrop-blur-sm rounded-2xl lg:rounded-3xl p-6 lg:p-8 xl:p-10 border border-white/30 dark:border-gray-700/30 shadow-lg'>
              <div className='flex items-center space-x-3 lg:space-x-4 mb-6 lg:mb-8'>
                <div className='p-2 lg:p-3 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl lg:rounded-2xl shadow-md'>
                  <PieChartIcon className='w-6 h-6 lg:w-7 lg:h-7 text-white' />
                </div>
                <div>
                  <h3 className='text-xl lg:text-2xl xl:text-3xl font-bold text-gray-800 dark:text-gray-200'>
                    情绪分布
                  </h3>
                  <p className='text-sm lg:text-base xl:text-lg text-gray-500 dark:text-gray-400'>
                    各种情绪类型的占比统计
                  </p>
                </div>
              </div>
              <div
                ref={pieRef}
                className='h-72 bg-gradient-to-br from-white/50 to-pink-50/30 dark:from-gray-900/50 dark:to-pink-900/10 rounded-xl border border-pink-100/30 dark:border-pink-800/30'>
                <ResponsiveContainer width='100%' height='100%'>
                  <PieChart>
                    <Pie
                      data={moodStats}
                      cx='50%'
                      cy='50%'
                      innerRadius={`${pieConfig.innerRadiusPct}%`}
                      outerRadius={`${pieConfig.outerRadiusPct}%`}
                      paddingAngle={2}
                      dataKey='count'
                      labelLine={false}
                      label={renderPieLabel}
                      stroke='rgba(255, 255, 255, 0.8)'
                      strokeWidth={2}>
                      {moodStats.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={MOOD_COLORS[entry.mood_type] || '#8B5CF6'}
                          className='hover:opacity-80 transition-opacity duration-200'
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid rgba(236, 72, 153, 0.3)',
                        borderRadius: '16px',
                        backdropFilter: 'blur(10px)',
                        color: '#374151',
                        boxShadow: '0 10px 25px rgba(236, 72, 153, 0.1)'
                      }}
                      formatter={(value: number, _name: string, props: { payload: MoodStats }) => [
                        `${value}%`,
                        getMoodOption(props.payload.mood_type).label
                      ]}
                      labelStyle={{ color: '#6B7280', fontWeight: 'bold' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* 关键词云 */}
            <Card variant='default' padding='lg'>
              <h3 className='text-lg lg:text-xl xl:text-2xl font-semibold text-gray-900 dark:text-white mb-4 lg:mb-6 flex items-center'>
                <Cloud className='w-5 h-5 lg:w-6 lg:h-6 xl:w-7 xl:h-7 mr-2 lg:mr-3 text-purple-600 dark:text-purple-400' />
                关键词云
              </h3>
              <div
                ref={wordCloudRef}
                className='h-64 lg:h-80 xl:h-96 bg-gradient-to-br from-purple-50/30 to-blue-50/30 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl relative overflow-hidden'>
                {wordCloudData.length > 0 ? (
                  <div className='w-full h-full flex items-center justify-center'>
                    <Wordcloud
                      words={wordCloudData}
                      width={wordCloudSize.width}
                      height={wordCloudSize.height}
                      fontSize={datum => {
                        // 优化的字体大小算法，确保更好的分布
                        const containerSize = Math.min(wordCloudSize.width, wordCloudSize.height);
                        const maxValue = Math.max(...wordCloudData.map(d => d.value));
                        const minValue = Math.min(...wordCloudData.map(d => d.value));

                        // 调整字体大小范围，避免过大导致布局问题
                        const baseSize = containerSize / 22; // 稍微减小基础尺寸
                        const minSize = Math.max(12, baseSize * 0.6); // 最小字体
                        const maxSize = Math.min(baseSize * 2.5, containerSize / 8); // 控制最大字体

                        // 根据词频进行缩放
                        const normalizedValue =
                          maxValue > minValue ? (datum.value - minValue) / (maxValue - minValue) : 0.5;

                        return minSize + (maxSize - minSize) * Math.pow(normalizedValue, 0.7);
                      }}
                      font='Inter, system-ui, sans-serif'
                      padding={5}
                      spiral='archimedean'
                      rotate={() => {
                        // 更均匀的旋转角度分布
                        const angles = [0, 0, 0, 90, -90, 45, -45]; // 增加水平词汇比例
                        return angles[Math.floor(Math.random() * angles.length)];
                      }}
                      random={() => 0.5}>
                      {cloudWords =>
                        cloudWords.map(w => (
                          <text
                            key={w.text}
                            className='wordcloud-text'
                            fill={colorScale(w.text)}
                            transform={`translate(${w.x}, ${w.y}) rotate(${w.rotate})`}
                            fontSize={w.size}
                            fontFamily={w.font}
                            onMouseEnter={e => {
                              const rect = wordCloudRef.current?.getBoundingClientRect();
                              if (rect) {
                                setTooltip({
                                  visible: true,
                                  x: e.clientX - rect.left,
                                  y: e.clientY - rect.top,
                                  word: w.text,
                                  count: wordCloudData.find(d => d.text === w.text)?.value || 0
                                });
                              }
                            }}
                            onMouseMove={e => {
                              const rect = wordCloudRef.current?.getBoundingClientRect();
                              if (rect && tooltip.visible) {
                                setTooltip(prev => ({
                                  ...prev,
                                  x: e.clientX - rect.left,
                                  y: e.clientY - rect.top
                                }));
                              }
                            }}
                            onMouseLeave={() => {
                              setTooltip(prev => ({ ...prev, visible: false }));
                            }}>
                            {w.text}
                          </text>
                        ))
                      }
                    </Wordcloud>
                  </div>
                ) : (
                  <div className='flex items-center justify-center h-full'>
                    <div className='text-center'>
                      <div className='w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-3 mx-auto'>
                        <Cloud className='w-6 h-6 text-purple-500' />
                      </div>
                      <p className='text-gray-500 dark:text-gray-400 text-sm'>暂无关键词数据</p>
                      <p className='text-xs text-gray-400 dark:text-gray-500 mt-1'>开始记录日记后将显示词云</p>
                    </div>
                  </div>
                )}

                {/* Tooltip */}
                {tooltip.visible && (
                  <div
                    className='wordcloud-tooltip'
                    data-tooltip-x={tooltip.x}
                    data-tooltip-y={tooltip.y}
                    data-tooltip-right={tooltip.x > wordCloudSize.width - 100 ? 'true' : 'false'}>
                    <div className='flex items-center gap-2'>
                      <span className='font-semibold'>{tooltip.word}</span>
                      <span className='text-gray-300 dark:text-gray-400'>·</span>
                      <span className='text-blue-300'>{tooltip.count} 次</span>
                    </div>
                    <div
                      className='tooltip-arrow'
                      data-arrow-right={tooltip.x > wordCloudSize.width - 100 ? 'true' : 'false'}></div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* 详细统计 */}
          <Card
            variant='default'
            padding='lg'
            className='bg-gradient-to-br from-white/80 to-indigo-50/60 dark:from-theme-gray-900/85 dark:to-theme-indigo/25 backdrop-blur-md rounded-2xl lg:rounded-3xl p-6 lg:p-8 xl:p-10 border border-white/30 dark:border-white/10 shadow-lg'>
            <div className='flex items-center space-x-3 lg:space-x-4 mb-6 lg:mb-8'>
              <div className='p-2 lg:p-3 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl lg:rounded-2xl shadow-md'>
                <BarChart3 className='w-6 h-6 lg:w-7 lg:h-7 text-white' />
              </div>
              <div>
                <h3 className='text-xl lg:text-2xl xl:text-3xl font-bold text-gray-800 dark:text-gray-200'>详细统计</h3>
                <p className='text-sm lg:text-base xl:text-lg text-gray-500 dark:text-gray-400'>
                  各情绪类型的深度分析数据
                </p>
              </div>
            </div>

            <div className='grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6'>
              {moodStats.map(stats => {
                const moodOption = getMoodOption(stats.mood_type);
                return (
                  <Card
                    key={stats.mood_type}
                    variant='default'
                    padding='md'
                    className='relative bg-white/60 dark:bg-theme-gray-800/70 dark:hover:bg-theme-gray-800/80 backdrop-blur-md rounded-xl lg:rounded-2xl border dark:border-theme-gray-700/60 transition-all duration-300 group hover:-translate-y-1'
                    style={{
                      borderColor: MOOD_COLORS[stats.mood_type] || '#E5E7EB',
                      backgroundImage: `linear-gradient(135deg, ${hexToRgba(
                        MOOD_COLORS[stats.mood_type] || '#F3F4F6',
                        0.25
                      )} 0%, rgba(255,255,255,0) 85%)`,
                      boxShadow: `0 0 0 1px ${hexToRgba(
                        MOOD_COLORS[stats.mood_type] || '#E5E7EB',
                        0.2
                      )}, 0 10px 20px rgba(0,0,0,var(--shadow-strong))`
                    }}>
                    {/* 已移除顶部强调条与右上角迷你趋势，避免遮挡 */}
                    <div className='text-center mb-4 lg:mb-6'>
                      <div className='text-3xl lg:text-4xl xl:text-5xl mb-2 lg:mb-3'>{moodOption.emoji}</div>
                      <h4 className='text-base lg:text-lg xl:text-xl font-semibold text-gray-800 dark:text-gray-200 mb-1'>
                        {moodOption.label}
                      </h4>
                      <p className='text-xs lg:text-sm text-gray-500 dark:text-gray-400'>情绪分析</p>
                    </div>

                    <div className='space-y-3 lg:space-y-4'>
                      <div className='flex justify-between items-center'>
                        <span className='text-sm lg:text-base text-gray-600 dark:text-gray-400'>记录次数</span>
                        <span className='text-lg lg:text-xl xl:text-2xl font-bold text-indigo-600 dark:text-indigo-300'>
                          {stats.count}
                        </span>
                      </div>

                      <div className='flex justify-between items-center'>
                        <span className='text-sm lg:text-base text-gray-600 dark:text-gray-400'>平均强度</span>
                        <span className='text-base lg:text-lg xl:text-xl font-semibold text-indigo-600 dark:text-theme-indigo'>
                          {stats.average_intensity.toFixed(1)}
                        </span>
                      </div>

                      <div className='space-y-2'>
                        <div className='flex justify-between items-center'>
                          <span className='text-sm lg:text-base text-gray-600 dark:text-gray-400'>占比</span>
                          <span className='text-base lg:text-lg xl:text-xl font-semibold text-indigo-600 dark:text-theme-indigo'>
                            {stats.percentage.toFixed(1)}%
                          </span>
                        </div>
                        <div className='w-full bg-gray-200 dark:bg-theme-gray-700/70 rounded-full h-2 lg:h-3'>
                          <div className='progress-bar-fill' data-width={stats.percentage}></div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </Card>

          {/* 历史记录 */}
          <Card
            variant='default'
            padding='lg'
            className='bg-gradient-to-br from-white/80 to-blue-50/60 dark:from-theme-gray-800/80 dark:to-theme-indigo/20 backdrop-blur-sm rounded-2xl lg:rounded-3xl p-6 lg:p-8 xl:p-10 border border-white/30 dark:border-theme-gray-700/30 shadow-lg'>
            <div className='flex items-center space-x-3 lg:space-x-4 mb-6 lg:mb-8'>
              <div className='p-2 lg:p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl lg:rounded-2xl shadow-md'>
                <Calendar className='w-6 h-6 lg:w-7 lg:h-7 text-white' />
              </div>
              <div>
                <h3 className='text-xl lg:text-2xl xl:text-3xl font-bold text-gray-800 dark:text-gray-200'>历史记录</h3>
                <p className='text-sm lg:text-base xl:text-lg text-gray-500 dark:text-gray-400'>查看过往情绪记录</p>
              </div>
            </div>

            {/* 视图切换与搜索 */}
            <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 sm:space-y-6 lg:space-y-0 lg:space-x-8 mb-4 sm:mb-6'>
              <div className='w-full lg:w-auto'>
                <div className='grid grid-cols-2 w-full lg:w-auto gap-2 bg-gray-100/80 dark:bg-theme-gray-700/80 rounded-xl p-2 ring-1 ring-gray-200 dark:ring-theme-gray-600 shadow-sm'>
                  <button
                    onClick={() => setHistoryViewMode('calendar')}
                    aria-label='切换到日历视图'
                    className={`btn flex items-center w-full px-4 lg:px-8 py-2.5 lg:py-4 rounded-xl transition-all duration-300 border ${
                      historyViewMode === 'calendar'
                        ? 'bg-white dark:bg-theme-gray-600 text-purple-600 dark:text-purple-400 shadow border-purple-300 dark:border-purple-500 dark:hover:bg-theme-gray-600/80 dark:hover:ring-1 dark:hover:ring-purple-500/40 dark:hover:shadow-md'
                        : 'text-gray-600 dark:text-gray-400 hover:text-purple-500 bg-transparent border-transparent dark:border-theme-gray-600/60 hover:bg-white/60 dark:hover:bg-theme-gray-700/60 dark:hover:text-purple-300 dark:hover:border-purple-600/60'
                    }`}>
                    <Calendar className='w-4 h-4 lg:w-6 lg:h-6 mr-2 lg:mr-4' />
                    日历视图
                  </button>
                  <button
                    onClick={() => setHistoryViewMode('list')}
                    aria-label='切换到列表视图'
                    className={`btn flex items-center w-full px-4 lg:px-8 py-2.5 lg:py-4 rounded-xl transition-all duration-300 border ${
                      historyViewMode === 'list'
                        ? 'bg-white dark:bg-theme-gray-600 text-purple-600 dark:text-purple-400 shadow border-purple-300 dark:border-purple-500 dark:hover:bg-theme-gray-600/80 dark:hover:ring-1 dark:hover:ring-purple-500/40 dark:hover:shadow-md'
                        : 'text-gray-600 dark:text-gray-400 hover:text-purple-500 bg-transparent border-transparent dark:border-theme-gray-600/60 hover:bg-white/60 dark:hover:bg-theme-gray-700/60 dark:hover:text-purple-300 dark:hover:border-purple-600/60'
                    }`}>
                    <List className='w-4 h-4 lg:w-6 lg:h-6 mr-2 lg:mr-4' />
                    列表视图
                  </button>
                </div>
              </div>

              {/* 搜索框 */}
              <div className='relative w-full lg:flex-1 lg:max-w-lg'>
                <Search className='absolute left-4 lg:left-5 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 lg:w-6 lg:h-6' />
                <input
                  type='text'
                  placeholder='搜索记录内容...'
                  value={historySearchText}
                  onChange={e => setHistorySearchText(e.target.value)}
                  className='form-input w-full pl-12 lg:pl-14 pr-6 lg:pr-8 py-3 lg:py-4 bg-gray-50 dark:bg-theme-gray-700 border border-gray-200 dark:border-theme-gray-600 rounded-xl lg:rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base lg:text-lg text-gray-900 dark:text-white'
                />
              </div>
            </div>

            {historyViewMode === 'calendar' ? (
              <div className='grid lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8 xl:gap-10'>
                {/* 日历视图 */}
                <div className='lg:col-span-2 xl:col-span-3'>
                  <Card variant='default' padding='md'>
                    {/* 月份导航 */}
                    <div className='grid grid-cols-3 items-center gap-2 sm:gap-3 mb-6 lg:mb-10'>
                      <button
                        onClick={goToPreviousMonth}
                        aria-label='上一个月'
                        className='btn btn-primary justify-self-start p-2.5 sm:p-3 lg:p-4 bg-purple-500 text-white rounded-xl lg:rounded-2xl hover:bg-purple-600 transition-all duration-300'>
                        <ChevronLeft className='w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7' />
                      </button>
                      <h2 className='text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-900 dark:text-white text-center'>
                        {format(historyCurrentDate, 'yyyy年MM月', { locale: zhCN })}
                      </h2>
                      <button
                        onClick={goToNextMonth}
                        aria-label='下一个月'
                        className='btn btn-primary justify-self-end p-2.5 sm:p-3 lg:p-4 bg-purple-500 text-white rounded-xl lg:rounded-2xl hover:bg-purple-600 transition-all duration-300'>
                        <ChevronRight className='w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7' />
                      </button>
                    </div>

                    {/* 星期标题 */}
                    <div className='grid grid-cols-7 gap-2 lg:gap-3 mb-4 lg:mb-6'>
                      {['日', '一', '二', '三', '四', '五', '六'].map(day => (
                        <div
                          key={day}
                          className='text-center py-2 sm:py-3 lg:py-4 text-base lg:text-lg xl:text-xl font-medium text-gray-500 dark:text-gray-400'>
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* 日期网格 */}
                    <div className='grid grid-cols-7 gap-2 lg:gap-3 xl:gap-4'>
                      {historyMonthDays.map(day => {
                        const dayRecords = getRecordsForDate(day);
                        const isSelected = historySelectedDate && isSameDay(day, historySelectedDate);
                        const isToday = isSameDay(day, new Date());

                        return (
                          <button
                            key={day.toISOString()}
                            onClick={() => setHistorySelectedDate(day)}
                            className={cn(
                              'relative min-h-[2rem] lg:min-h-[5rem] xl:min-h-[6rem] p-3 lg:p-4 xl:p-5 rounded-xl lg:rounded-2xl transition-all duration-300 border-2 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-0',
                              !isSameMonth(day, historyCurrentDate) &&
                                'bg-gray-50/50 dark:bg-theme-gray-800/50 text-gray-400 dark:text-gray-500 border-gray-100 dark:border-theme-gray-700 hover:bg-gray-100/70 dark:hover:bg-theme-gray-700/70',
                              isSameMonth(day, historyCurrentDate) &&
                                !isSelected &&
                                !isToday &&
                                'bg-white dark:bg-theme-gray-700 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-theme-gray-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 dark:hover:border-purple-600 shadow-sm hover:shadow-md',
                              isSelected &&
                                'bg-gradient-to-br from-purple-500 to-purple-600 text-white border-purple-400 shadow-lg ring-2 ring-purple-300 dark:ring-purple-500',
                              isToday &&
                                !isSelected &&
                                'bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 text-blue-700 dark:text-blue-300 border-blue-400 dark:border-blue-500 shadow-md ring-2 ring-blue-200 dark:ring-blue-700',
                              // 统一居中栈布局，避免日期数字在卡片内上下错位
                              'flex flex-col items-center justify-center gap-1.5 lg:gap-2'
                            )}>
                            <div
                              className={cn(
                                'font-semibold leading-none flex items-center justify-center w-full h-full',
                                'text-base lg:text-xl xl:text-2xl',
                                'min-w-[1.5rem] text-center tabular-nums',
                                'select-none antialiased',
                                isToday && !isSelected && 'text-blue-800 dark:text-blue-200',
                                isSelected && 'text-white drop-shadow-sm'
                              )}>
                              <span className='inline-block leading-none'>{format(day, 'd')}</span>
                            </div>
                            {dayRecords.length > 0 && (
                              <div className='flex justify-center items-center space-x-1 lg:space-x-1.5'>
                                {dayRecords.slice(0, 3).map((record, index) => {
                                  const moodOption = getMoodOption(record.mood_type);
                                  return (
                                    <div
                                      key={index}
                                      className={cn(
                                        'rounded-full transition-all duration-200',
                                        'w-2 h-2 lg:w-3 lg:h-3 xl:w-4 xl:h-4',
                                        isSelected
                                          ? 'bg-white/90 shadow-sm'
                                          : 'bg-purple-400 dark:bg-purple-500 hover:bg-purple-500 dark:hover:bg-purple-400'
                                      )}
                                      title={moodOption.label}
                                    />
                                  );
                                })}
                                {dayRecords.length > 3 && (
                                  <div
                                    className={cn(
                                      'font-medium leading-none ml-1.5 lg:ml-2',
                                      'text-xs lg:text-sm xl:text-base',
                                      isSelected
                                        ? 'text-white/95 drop-shadow-sm'
                                        : 'text-purple-600 dark:text-purple-400'
                                    )}>
                                    +{dayRecords.length - 3}
                                  </div>
                                )}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </Card>
                </div>

                {/* 选中日期的记录 */}
                <div className='space-y-6'>
                  <Card variant='default' padding='md'>
                    <div className='flex items-center space-x-3 lg:space-x-4 mb-4 lg:mb-6'>
                      <Calendar className='w-5 h-5 lg:w-6 lg:h-6 text-purple-500' />
                      <div>
                        <h4 className='text-lg lg:text-xl xl:text-2xl font-semibold text-gray-900 dark:text-white'>
                          {historySelectedDate ? format(historySelectedDate, 'MM月dd日', { locale: zhCN }) : '选择日期'}
                        </h4>
                        <p className='text-sm lg:text-base text-gray-500 dark:text-gray-400'>
                          {selectedDateRecords.length > 0 ? `共 ${selectedDateRecords.length} 条记录` : '暂无记录'}
                        </p>
                      </div>
                    </div>
                  </Card>

                  {selectedDateRecords.length > 0 ? (
                    <div className='space-y-3 lg:space-y-4'>
                      {selectedDateRecords.map(record => {
                        const moodOption = getMoodOption(record.mood_type);
                        return (
                          <Card
                            key={record.id}
                            variant='default'
                            padding='md'
                            className='hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1'>
                            <div className='flex items-start space-x-4 lg:space-x-6 xl:space-x-8'>
                              <div className='flex-shrink-0'>
                                <div className='text-3xl lg:text-4xl xl:text-5xl'>{moodOption.emoji}</div>
                              </div>
                              <div className='flex-1 min-w-0'>
                                <div className='flex items-center space-x-3 lg:space-x-4 xl:space-x-6 mb-3 lg:mb-4 xl:mb-6'>
                                  <span className='text-sm lg:text-base xl:text-lg text-gray-500 dark:text-gray-400 font-medium'>
                                    {format(new Date(record.created_at), 'MM月dd日 HH:mm', { locale: zhCN })}
                                  </span>
                                  <div className='flex items-center space-x-2'>
                                    <div className='w-2 h-2 lg:w-3 lg:h-3 bg-purple-400 rounded-full'></div>
                                    <span className='text-sm lg:text-base xl:text-lg text-purple-600 dark:text-purple-400 font-semibold'>
                                      强度 {record.mood_intensity}
                                    </span>
                                  </div>
                                </div>
                                <p className='text-gray-700 dark:text-gray-300 mb-4 lg:mb-5 xl:mb-6 leading-relaxed text-base lg:text-lg xl:text-xl line-height-loose'>
                                  {record.diary_content}
                                </p>
                                {record.tags && record.tags.length > 0 && (
                                  <div className='flex flex-wrap gap-2 lg:gap-3 xl:gap-4'>
                                    {record.tags.map(tag => (
                                      <span
                                        key={tag}
                                        className='text-xs lg:text-sm xl:text-base bg-gradient-to-r from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30 text-purple-700 dark:text-purple-300 px-3 lg:px-4 xl:px-5 py-1.5 lg:py-2 xl:py-2.5 rounded-full lg:rounded-xl font-medium shadow-sm'>
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <Card variant='default' padding='lg' className='text-center'>
                      <div className='text-6xl mb-4 opacity-40'>📅</div>
                      <p className='text-gray-500 dark:text-gray-400'>
                        {historySelectedDate ? '这一天还没有记录' : '点击日期查看记录'}
                      </p>
                    </Card>
                  )}
                </div>
              </div>
            ) : (
              /* 列表视图 */
              <div className='space-y-4 lg:space-y-6 xl:space-y-8'>
                {filteredHistoryRecords.length > 0 ? (
                  filteredHistoryRecords.slice(0, historyVisibleCount).map(record => {
                    const moodOption = getMoodOption(record.mood_type);
                    return (
                      <Card
                        key={record.id}
                        variant='default'
                        padding='lg'
                        className='hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1'>
                        <div className='flex items-start space-x-4 lg:space-x-6 xl:space-x-8'>
                          <div className='flex-shrink-0'>
                            <div className='text-3xl lg:text-4xl xl:text-5xl'>{moodOption.emoji}</div>
                          </div>
                          <div className='flex-1 min-w-0'>
                            <div className='flex items-center space-x-3 lg:space-x-4 xl:space-x-6 mb-3 lg:mb-4 xl:mb-6'>
                              <span className='text-sm lg:text-base xl:text-lg text-gray-500 dark:text-gray-400 font-medium'>
                                {format(new Date(record.created_at), 'MM月dd日 HH:mm', { locale: zhCN })}
                              </span>
                              <div className='flex items-center space-x-2'>
                                <div className='w-2 h-2 lg:w-3 lg:h-3 bg-purple-400 rounded-full'></div>
                                <span className='text-sm lg:text-base xl:text-lg text-purple-600 dark:text-purple-400 font-semibold'>
                                  强度 {record.mood_intensity}
                                </span>
                              </div>
                            </div>
                            <p className='text-gray-700 dark:text-gray-300 mb-4 lg:mb-5 xl:mb-6 leading-relaxed text-base lg:text-lg xl:text-xl line-height-loose'>
                              {record.diary_content}
                            </p>
                            {record.tags && record.tags.length > 0 && (
                              <div className='flex flex-wrap gap-2 lg:gap-3 xl:gap-4'>
                                {record.tags.map(tag => (
                                  <span
                                    key={tag}
                                    className='text-xs lg:text-sm xl:text-base bg-gradient-to-r from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30 text-purple-700 dark:text-purple-300 px-3 lg:px-4 xl:px-5 py-1.5 lg:py-2 xl:py-2.5 rounded-full lg:rounded-xl font-medium shadow-sm'>
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })
                ) : (
                  <Card variant='default' padding='lg' className='text-center'>
                    <div className='py-8 lg:py-12 xl:py-16'>
                      <div className='text-gray-400 dark:text-gray-500 mb-6 lg:mb-8'>
                        <Calendar className='w-16 h-16 lg:w-20 lg:h-20 xl:w-24 xl:h-24 mx-auto mb-4 lg:mb-6 opacity-50' />
                      </div>
                      <h3 className='text-lg lg:text-xl xl:text-2xl font-semibold text-gray-600 dark:text-gray-400 mb-2 lg:mb-3'>
                        暂无符合条件的记录
                      </h3>
                      <p className='text-sm lg:text-base xl:text-lg text-gray-500 dark:text-gray-500'>
                        尝试修改搜索关键词或创建新的心情记录
                      </p>
                    </div>
                  </Card>
                )}
                {/* 无限滚动哨兵与状态 */}
                <div ref={historyListSentinelRef} className='h-6' />
                {historyVisibleCount >= filteredHistoryRecords.length && filteredHistoryRecords.length > 0 && (
                  <div className='text-center text-sm text-gray-400 dark:text-gray-500 py-2'>已无更多</div>
                )}
              </div>
            )}
          </Card>
        </div>
      </Container>
    </>
  );
};

export default Analytics;
