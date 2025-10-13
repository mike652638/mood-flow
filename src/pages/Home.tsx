import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  Calendar,
  TrendingUp,
  Heart,
  Sparkles,
  ArrowRight,
  Sun,
  Moon,
  Shuffle,
  Settings as SettingsIcon,
  HeartHandshake,
  PenTool,
  BarChart3
} from 'lucide-react';
import Card from '../components/Card';
import Container from '../components/Container';
import Header from '../components/Header';
import { toast } from 'sonner';
import { getMoodOption, MOOD_OPTIONS } from '../constants/moods';
import { MoodRecord, MoodType } from '../types';
import { useImmersiveMode } from '../hooks/useImmersiveMode';

// 心理学专家寄语类型与数据（模块级）：避免 hooks 依赖警告，并便于复用
type ExpertQuote = { text: string; author: string; source: string };
const expertQuotes: ExpertQuote[] = [
  {
    text: '人可以被夺走一切，唯独不能被夺走选择态度的自由。',
    author: '维克多·弗兰克尔',
    source: '《活出生命的意义》· 1946'
  },
  {
    text: '奇妙的悖论是：当我接受自己如其所是时，我才开始改变。',
    author: '卡尔·罗杰斯',
    source: '《成为一个人》· 1961'
  },
  { text: '一个人可以通过改变态度来改变人生。', author: '威廉·詹姆斯', source: '《心理学原理》· 1890' },
  { text: '如果你唯一的工具是锤子，你会把一切都看成钉子。', author: '亚伯拉罕·马斯洛', source: '《动机与人格》· 1954' },
  { text: '把注意力放在可控的事情上，情绪就会更稳。', author: '亚伦·贝克', source: '《认知疗法与情绪障碍》· 1976' },
  { text: '乐观不是否认问题，而是相信自己能找到解决方案。', author: '马丁·塞利格曼', source: '《习得性乐观》· 1990' },
  { text: '在困难时刻练习自我同情，对恢复力至关重要。', author: '克里斯汀·内夫', source: '《Self‑Compassion》· 2011' },
  { text: '情绪是信息，它提醒我们需要被关注的事情。', author: '保罗·埃克曼', source: '《Emotions Revealed》· 2003' },
  {
    text: '焦虑源自对不确定性的抗拒，练习与不确定共处。',
    author: '大卫·巴洛',
    source: '《Anxiety and Its Disorders》· 2002'
  },
  {
    text: '把“发生了什么”转化为“我能做什么”，是改变的起点。',
    author: 'Steve de Shazer',
    source: '《Keys to Solution in Brief Therapy》· 1985'
  },
  { text: '意义感让我们承受几乎任何艰难。', author: '维克多·弗兰克尔', source: '《活出生命的意义》· 1946' },
  { text: '治愈不是抹去痛苦，而是学会带着痛继续前行。', author: '欧文·亚隆', source: '《存在主义心理治疗》· 1980' }
];

// 模拟今日数据
const mockTodayRecords: MoodRecord[] = [
  {
    id: 'today-1',
    user_id: 'user1',
    mood_type: 'happy',
    mood_intensity: 8,
    diary_content: '刚在看书学习，感觉挺充实！',
    tags: ['学习', '充实'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'today-2',
    user_id: 'user1',
    mood_type: 'calm',
    mood_intensity: 7,
    diary_content: '刚才外出散步，感觉很平静。',
    tags: ['散步', '平静'],
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2小时前
    updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  }
];

const Home = () => {
  const { immersiveMode } = useImmersiveMode();
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const [quickNote, setQuickNote] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const today = new Date();
  const todayStr = format(today, 'yyyy年MM月dd日', { locale: zhCN });

  // 计算今日统计
  const todayStats = useMemo(() => {
    const totalRecords = mockTodayRecords.length;
    const avgIntensity =
      totalRecords > 0 ? mockTodayRecords.reduce((sum, record) => sum + record.mood_intensity, 0) / totalRecords : 0;
    const dominantMood =
      totalRecords > 0
        ? mockTodayRecords.reduce((prev, current) =>
            mockTodayRecords.filter(r => r.mood_type === current.mood_type).length >
            mockTodayRecords.filter(r => r.mood_type === prev.mood_type).length
              ? current
              : prev
          ).mood_type
        : 'calm';

    return {
      totalRecords,
      avgIntensity: Math.round(avgIntensity * 10) / 10,
      dominantMood
    };
  }, []);

  const handleQuickRecord = async () => {
    if (!selectedMood) {
      toast.error('请选择一个情绪');
      return;
    }

    setIsRecording(true);

    // 模拟保存过程
    await new Promise(resolve => setTimeout(resolve, 1000));

    toast.success('情绪记录已保存！');
    setSelectedMood(null);
    setQuickNote('');
    setIsRecording(false);
  };

  const getTimeGreeting = () => {
    const hour = today.getHours();
    if (hour < 6) return { text: '夜深了', icon: Moon };
    if (hour < 12) return { text: '早上好', icon: Sun };
    if (hour < 18) return { text: '下午好', icon: Sun };
    if (hour < 22) return { text: '晚上好', icon: Moon };
    return { text: '夜深了', icon: Moon };
  };

  const greeting = getTimeGreeting();
  const GreetingIcon = greeting.icon;
  const showTopMeta = false; // 暂时隐藏首页顶部日期与时间问候语

  // 每次进入页面随机选择一条寄语：去除 useMemo 缓存，用 useState 初始值随机
  const [dailyQuote, setDailyQuote] = useState<ExpertQuote>(() => {
    const idx = Math.floor(Math.random() * expertQuotes.length);
    return expertQuotes[idx];
  });

  // 获取不与当前重复的随机寄语
  const getRandomQuote = (exclude?: ExpertQuote) => {
    if (expertQuotes.length <= 1) return expertQuotes[0];
    let next: ExpertQuote | undefined = undefined;
    do {
      next = expertQuotes[Math.floor(Math.random() * expertQuotes.length)];
    } while (exclude && next.text === exclude.text);
    return next;
  };

  // 效果常量（便于微调缩放与微光持续时间与强度）
  const TRANSITION = 'transition-all duration-300';
  const HOVER_SCALE = 'hover:scale-[1.01]';
  const ACTIVE_SCALE = 'scale-[1.02]';
  const ACTIVE_RING = 'ring-2 ring-pink-300/30';
  const ACTIVE_SHADOW = 'shadow-2xl';
  const CONTENT_PADDING_TOP = 'pt-14 sm:pt-16 md:pt-12'; // 为按钮留出更充足空间，避免遮挡

  // 切换节流与反馈效果
  const SWITCH_COOLDOWN_MS = 1000; // 1秒节流
  const [isSwitching, setIsSwitching] = useState(false);
  const [announceText, setAnnounceText] = useState('');
  const switchQuote = () => {
    if (isSwitching) return; // 节流：切换期间忽略点击
    setIsSwitching(true);
    setDailyQuote(getRandomQuote(dailyQuote));
    setAnnounceText('已切换寄语');
    setTimeout(() => setAnnounceText(''), 1000);
    setTimeout(() => setIsSwitching(false), SWITCH_COOLDOWN_MS);
  };

  return (
    <>
      <Header title='心流日记' immersiveMode={immersiveMode} />
      <Container spacing='normal'>
        {/* 日期显示 */}
        <div className='page-sections'>
          {/* 励志语句 - 移动到首页顶部 */}
          <Card variant='default' padding='md' className='p-4 sm:p-6 lg:p-8 xl:p-10'>
            <div className='flex items-center space-x-3 sm:space-x-4 lg:space-x-6 mb-4 sm:mb-6 lg:mb-8'>
              <div className='w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 xl:w-20 xl:h-20 bg-pink-500 rounded-full flex items-center justify-center shadow-lg'>
                <Heart className='w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 xl:w-10 xl:h-10 text-white' />
              </div>
              <div>
                <h3 className='text-lg sm:text-xl lg:text-2xl xl:text-3xl font-semibold text-gray-800 dark:text-gray-200'>
                  今日寄语
                </h3>
                <p className='text-sm sm:text-base lg:text-lg text-gray-600 dark:text-gray-400'>温暖的话语</p>
              </div>
            </div>

            <Card
              variant='glass'
              padding='md'
              onClick={switchQuote}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  switchQuote();
                }
              }}
              role='button'
              tabIndex={0}
              aria-label='换一句寄语'
              aria-keyshortcuts='Enter Space'
              aria-describedby='switch-hint'
              title='点击或按 Enter/Space 切换随机寄语'
              className={`relative fade-in rounded-3xl ring-1 ring-white/10 dark:ring-black/20 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/35 dark:to-purple-900/35 shadow-inner max-w-xl sm:max-w-2xl mx-auto cursor-pointer ${TRANSITION} ${
                isSwitching ? `${ACTIVE_SCALE} ${ACTIVE_SHADOW} ${ACTIVE_RING}` : `${HOVER_SCALE} hover:shadow-xl`
              } ${CONTENT_PADDING_TOP}`}>
              {/* 无障碍：键盘可达性提示与播报区域 */}
              <span id='switch-hint' className='sr-only'>
                按 Enter 或 空格 键切换寄语
              </span>
              <span className='sr-only' aria-live='polite'>
                {announceText}
              </span>
              {/* 右下角“换一句”按钮（行内布局，避免遮挡内容） */}
              <div className='mb-3 sm:mb-4 flex justify-end'>
                <button
                  type='button'
                  onClick={e => {
                    e.stopPropagation();
                    switchQuote();
                  }}
                  aria-label='换一句寄语'
                  aria-keyshortcuts='Enter Space'
                  aria-describedby='switch-hint'
                  disabled={isSwitching}
                  className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs sm:text-sm bg-white/85 dark:bg-gray-800/85 backdrop-blur-md border border-gray-200 dark:border-gray-700 shadow-md hover:bg-white dark:hover:bg-gray-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white'>
                  {/* 更换为 Shuffle 图标，提升语义与辨识度 */}
                  <Shuffle className='inline w-3 h-3 sm:w-4 sm:h-4 text-pink-600 dark:text-pink-400' />
                  换一句
                </button>
              </div>

              <blockquote
                key={dailyQuote.text}
                className='fade-in text-base sm:text-lg lg:text-xl xl:text-2xl text-gray-700 dark:text-gray-300 italic leading-relaxed text-center font-medium'>
                “{dailyQuote.text}”
              </blockquote>
              <div className='mt-4 sm:mt-6 lg:mt-8 flex flex-wrap items-center justify-center gap-x-2 gap-y-1'>
                <div className='flex space-x-1'>
                  {[...Array(3)].map((_, i) => (
                    <Sparkles key={i} className='w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-yellow-400 fill-current' />
                  ))}
                </div>
                <span className='text-sm sm:text-base lg:text-lg text-gray-600 dark:text-gray-400'>
                  — {dailyQuote.author}
                </span>
                <span className='mt-1 text-xs sm:text-sm text-gray-400 dark:text-gray-500'>{dailyQuote.source}</span>
              </div>
            </Card>
          </Card>

          {showTopMeta && (
            <div className='flex justify-center'>
              <Card
                variant='glass'
                padding='sm'
                className='inline-flex items-center px-6 lg:px-8 py-3 lg:py-4 rounded-3xl shadow-xl hover:shadow-2xl dark:shadow-black/30 border border-white/20 dark:border-gray-700/20'>
                <Calendar className='w-5 h-5 lg:w-6 lg:h-6 text-purple-600 dark:text-purple-400 mr-3 lg:mr-4' />
                <span className='text-lg lg:text-xl xl:text-2xl font-semibold text-gray-900 dark:text-white'>
                  {todayStr}
                </span>
              </Card>
            </div>
          )}

          {/* 时间问候语 - 暂时隐藏 */}
          {showTopMeta && (
            <div className='text-center'>
              <h1 className='text-2xl sm:text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 lg:mb-6'>
                <div className='flex items-center justify-center space-x-2 sm:space-x-3 lg:space-x-4'>
                  <GreetingIcon className='w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-purple-600 dark:text-purple-400' />
                  <span>{greeting.text}</span>
                </div>
              </h1>
              <p className='text-base sm:text-lg lg:text-xl xl:text-2xl text-gray-700 dark:text-gray-200 leading-relaxed max-w-2xl mx-auto px-4 text-center'>
                记录每一刻的心情，感受生活的美好
              </p>
            </div>
          )}

          {/* 今日概览 */}
          <Card variant='gradient' padding='md'>
            <h3 className='text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6 lg:mb-8 flex items-center'>
              <div className='p-2 sm:p-3 lg:p-4 bg-gradient-to-r from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 rounded-lg sm:rounded-xl lg:rounded-2xl xl:rounded-3xl mr-2 sm:mr-3 lg:mr-6 shadow-lg'>
                <Calendar className='w-4 h-4 sm:w-5 sm:h-5 lg:w-7 lg:h-7 xl:w-8 xl:h-8 text-white' />
              </div>
              今日概览
            </h3>

            <div className='grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-8 xl:gap-10 2xl:gap-12 mb-4 sm:mb-6 lg:mb-8'>
              <Card
                variant='glass'
                padding='md'
                className='text-center rounded-3xl shadow-md hover:shadow-xl ring-1 ring-white/10 dark:ring-black/20 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/40 dark:to-purple-800/40 transition-all duration-300 transform hover:scale-[1.02]'>
                <div className='flex flex-col items-center space-y-2 sm:space-y-3 lg:space-y-4'>
                  <div className='w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 xl:w-20 xl:h-20 bg-purple-500 rounded-full flex items-center justify-center shadow-lg'>
                    <Calendar className='w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 xl:w-10 xl:h-10 text-white' />
                  </div>
                  <div>
                    <div className='text-xl sm:text-2xl lg:text-4xl xl:text-5xl font-bold text-purple-600 dark:text-purple-400 mb-1'>
                      {todayStats.totalRecords}
                    </div>
                    <div className='text-xs sm:text-sm lg:text-base xl:text-lg text-purple-700 dark:text-purple-300 font-medium'>
                      记录次数
                    </div>
                  </div>
                </div>
              </Card>
              <Card
                variant='glass'
                padding='md'
                className='text-center rounded-3xl shadow-md hover:shadow-xl ring-1 ring-white/10 dark:ring-black/20 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/40 dark:to-blue-800/40 transition-all duration-300 transform hover:scale-[1.02]'>
                <div className='flex flex-col items-center space-y-2 sm:space-y-3 lg:space-y-4'>
                  <div className='w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 xl:w-20 xl:h-20 bg-blue-500 rounded-full flex items-center justify-center shadow-lg'>
                    <TrendingUp className='w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 xl:w-10 xl:h-10 text-white' />
                  </div>
                  <div>
                    <div className='text-xl sm:text-2xl lg:text-4xl xl:text-5xl font-bold text-blue-600 dark:text-blue-400 mb-1'>
                      {todayStats.avgIntensity}
                    </div>
                    <div className='text-xs sm:text-sm lg:text-base xl:text-lg text-blue-700 dark:text-blue-300 font-medium'>
                      平均强度
                    </div>
                  </div>
                </div>
              </Card>
              <Card
                variant='glass'
                padding='md'
                className='text-center rounded-3xl shadow-md hover:shadow-xl ring-1 ring-white/10 dark:ring-black/20 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/40 dark:to-emerald-800/40 transition-all duration-300 transform hover:scale-[1.02]'>
                <div className='flex flex-col items-center space-y-2 sm:space-y-3 lg:space-y-4'>
                  <div className='w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 xl:w-20 xl:h-20 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg'>
                    <Heart className='w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 xl:w-10 xl:h-10 text-white' />
                  </div>
                  <div>
                    <div className='text-lg sm:text-xl lg:text-3xl xl:text-4xl font-bold text-emerald-600 dark:text-emerald-400 mb-1'>
                      {getMoodOption(todayStats.dominantMood).label}
                    </div>
                    <div className='text-xs sm:text-sm lg:text-base xl:text-lg text-emerald-700 dark:text-emerald-300 font-medium'>
                      主要情绪
                    </div>
                  </div>
                </div>
              </Card>
              <Card
                variant='glass'
                padding='md'
                className='text-center rounded-3xl shadow-md hover:shadow-xl ring-1 ring-white/10 dark:ring-black/20 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/40 dark:to-orange-800/40 transition-all duration-300 transform hover:scale-[1.02]'>
                <div className='flex flex-col items-center space-y-2 sm:space-y-3 lg:space-y-4'>
                  <div className='w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 xl:w-20 xl:h-20 bg-orange-500 rounded-full flex items-center justify-center shadow-lg'>
                    <Sparkles className='w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 xl:w-10 xl:h-10 text-white' />
                  </div>
                  <div>
                    <div className='text-xl sm:text-2xl lg:text-4xl xl:text-5xl font-bold text-orange-600 dark:text-orange-400 mb-1'>
                      7
                    </div>
                    <div className='text-xs sm:text-sm lg:text-base xl:text-lg text-orange-700 dark:text-orange-300 font-medium'>
                      连续天数
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* 今日记录列表 */}
            {mockTodayRecords.length > 0 && (
              <div className='space-y-4 lg:space-y-6'>
                <h4 className='text-lg lg:text-xl xl:text-2xl font-semibold text-gray-800 dark:text-gray-200 flex items-center'>
                  <div className='w-2 h-2 lg:w-3 lg:h-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full mr-3 lg:mr-4'></div>
                  今日记录
                </h4>
                {mockTodayRecords.slice(0, 2).map(record => {
                  const moodOption = getMoodOption(record.mood_type);
                  const time = format(new Date(record.created_at), 'HH:mm');

                  return (
                    <Card
                      key={record.id}
                      variant='default'
                      padding='md'
                      className='backdrop-blur-md rounded-3xl shadow-md ring-1 ring-white/10 dark:ring-black/20 flex flex-col sm:flex-row items-start space-y-3 sm:space-y-0 sm:space-x-4 lg:space-x-5 xl:space-x-6 hover:shadow-2xl hover:shadow-purple-500/20 dark:hover:shadow-purple-600/20 transition-all duration-500 hover:border-purple-300/60 dark:hover:border-purple-600/60 group hover:scale-[1.01] active:scale-[0.99]'>
                      {/* 移动端：表情符号和标题在同一行 */}
                      <div className='flex items-center w-full sm:w-auto sm:flex-col sm:items-start'>
                        <div className='flex-shrink-0 mr-3 xs:mr-4 sm:mr-0 sm:mb-2 lg:mb-3'>
                          <div className='text-2xl xs:text-3xl sm:text-4xl lg:text-5xl p-2 xs:p-3 sm:p-4 lg:p-5 bg-gradient-to-br from-gray-50/90 via-white to-gray-100/90 dark:from-gray-600/80 dark:via-gray-650/80 dark:to-gray-700/80 rounded-xl xs:rounded-2xl sm:rounded-3xl shadow-md group-hover:shadow-lg group-hover:shadow-purple-500/10 dark:group-hover:shadow-purple-600/10 transition-all duration-500 group-hover:scale-110 border border-gray-200/50 dark:border-gray-600/50'>
                            {moodOption.emoji}
                          </div>
                        </div>
                        {/* 移动端：标题和时间在表情符号右侧 */}
                        <div className='flex-1 sm:hidden'>
                          <div className='flex items-center justify-between mb-1 xs:mb-2'>
                            <span className='text-base xs:text-lg font-bold text-gray-800 dark:text-gray-100 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors duration-300'>
                              {moodOption.label}
                            </span>
                            <div className='text-xs xs:text-sm font-bold text-purple-600 dark:text-purple-400 bg-gradient-to-r from-purple-50/90 via-purple-100/90 to-purple-50/90 dark:from-purple-900/50 dark:via-purple-800/50 dark:to-purple-900/50 px-2 xs:px-3 py-1 xs:py-1.5 rounded-full border border-purple-200/60 dark:border-purple-700/60 shadow-sm group-hover:shadow-md group-hover:shadow-purple-500/20 dark:group-hover:shadow-purple-600/20 transition-all duration-300'>
                              {time}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 桌面端：优化布局 */}
                      <div className='hidden sm:flex flex-1 min-w-0 space-y-3 lg:space-y-4 flex-col'>
                        <div className='flex items-center justify-between'>
                          <div className='flex items-center space-x-3 lg:space-x-4'>
                            <span className='text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 dark:text-gray-100 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors duration-300'>
                              {moodOption.label}
                            </span>
                          </div>
                          <div className='flex-shrink-0'>
                            <div className='text-sm lg:text-base font-bold text-purple-600 dark:text-purple-400 bg-gradient-to-r from-purple-50/90 via-purple-100/90 to-purple-50/90 dark:from-purple-900/50 dark:via-purple-800/50 dark:to-purple-900/50 px-4 lg:px-5 py-2 lg:py-2.5 rounded-full border border-purple-200/60 dark:border-purple-700/60 shadow-sm group-hover:shadow-md group-hover:shadow-purple-500/20 dark:group-hover:shadow-purple-600/20 transition-all duration-300'>
                              {time}
                            </div>
                          </div>
                        </div>
                        <p className='text-base lg:text-lg text-gray-700 dark:text-gray-200 line-clamp-2 leading-relaxed font-medium group-hover:text-gray-800 dark:group-hover:text-gray-100 transition-colors duration-300'>
                          {record.diary_content}
                        </p>
                      </div>

                      {/* 移动端：日记内容单独一行 */}
                      <div className='w-full sm:hidden mt-3 xs:mt-4'>
                        <p className='text-sm xs:text-base text-gray-700 dark:text-gray-200 line-clamp-3 leading-relaxed font-medium group-hover:text-gray-800 dark:group-hover:text-gray-100 transition-colors duration-300'>
                          {record.diary_content}
                        </p>
                      </div>
                    </Card>
                  );
                })}

                {mockTodayRecords.length > 2 && (
                  <div className='block text-center text-sm text-purple-600 dark:text-purple-400 font-semibold py-3 px-6 bg-purple-50 dark:bg-purple-900/20 rounded-2xl border border-purple-200/50 dark:border-purple-700/50 opacity-60 cursor-not-allowed'>
                    即将上线：AI 伴侣
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* 情绪快速记录 */}
          <Card
            variant='default'
            padding='lg'
            className='bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-700'>
            <h3 className='text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-6 lg:mb-8 flex items-center'>
              <div className='p-2 lg:p-3 bg-gradient-to-r from-rose-500 to-pink-600 dark:from-rose-600 dark:to-pink-700 rounded-xl lg:rounded-2xl mr-3 lg:mr-4 shadow-lg'>
                <Heart className='w-6 h-6 lg:w-7 lg:h-7 text-white' />
              </div>
              快速记录
            </h3>

            <div className='grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 xl:gap-6 mb-6 lg:mb-8'>
              {MOOD_OPTIONS.map(mood => (
                <button
                  key={mood.type}
                  onClick={() => setSelectedMood(mood.type)}
                  className={`group relative p-2 xs:p-3 sm:p-4 md:p-5 lg:p-6 xl:p-7 rounded-xl xs:rounded-2xl sm:rounded-3xl lg:rounded-[1.5rem] xl:rounded-[2rem] transition-all duration-500 transform hover:scale-[1.03] xs:hover:scale-[1.05] sm:hover:scale-[1.08] lg:hover:scale-[1.10] active:scale-95 border-2 overflow-hidden min-h-[70px] xs:min-h-[80px] sm:min-h-[90px] md:min-h-[100px] lg:min-h-[110px] xl:min-h-[120px] 2xl:min-h-[130px] flex flex-col items-center justify-center cursor-pointer ${
                    selectedMood === mood.type
                      ? 'bg-gradient-to-br from-purple-100/95 via-purple-50/95 to-purple-200/95 dark:from-purple-900/70 dark:via-purple-800/60 dark:to-purple-700/70 border-purple-500/80 dark:border-purple-400/80 shadow-2xl shadow-purple-500/40 dark:shadow-purple-600/35 ring-2 xs:ring-3 sm:ring-4 lg:ring-[5px] ring-purple-200/60 dark:ring-purple-600/40 backdrop-blur-md'
                      : 'bg-gradient-to-br from-white/95 via-white/90 to-gray-50/95 dark:from-theme-gray-700/95 dark:via-theme-gray-700/90 dark:to-theme-gray-800/95 border-gray-200/70 dark:border-theme-gray-600/70 hover:border-purple-300/80 dark:hover:border-purple-600/80 shadow-lg hover:shadow-2xl hover:shadow-purple-500/20 dark:hover:shadow-purple-600/20 backdrop-blur-md hover:bg-gradient-to-br hover:from-purple-50/30 hover:via-white/90 hover:to-purple-100/30 dark:hover:from-theme-gray-600/95 dark:hover:via-theme-gray-700/90 dark:hover:to-theme-gray-750/95'
                  }`}>
                  {/* 背景装饰 */}
                  <div
                    className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-500 ${
                      selectedMood === mood.type
                        ? 'bg-gradient-to-br from-purple-200/30 via-purple-100/20 to-purple-300/30 dark:from-purple-600/15 dark:via-purple-700/10 dark:to-purple-800/15'
                        : 'bg-gradient-to-br from-purple-50/40 via-white/20 to-purple-100/40 dark:from-purple-900/15 dark:via-purple-800/10 dark:to-purple-700/15'
                    }`}></div>

                  {/* 选中时的光晕效果 */}
                  {selectedMood === mood.type && (
                    <div className='absolute inset-0 bg-gradient-to-br from-purple-400/10 via-transparent to-purple-600/10 dark:from-purple-500/10 dark:via-transparent dark:to-purple-700/10 animate-pulse'></div>
                  )}

                  {/* 表情符号 */}
                  <div className='relative z-10 mb-1 xs:mb-1.5 sm:mb-2 md:mb-2.5 lg:mb-3'>
                    <div
                      className={`text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl transition-all duration-500 group-hover:scale-110 sm:group-hover:scale-115 lg:group-hover:scale-120 ${
                        selectedMood === mood.type
                          ? 'drop-shadow-xl filter brightness-110'
                          : 'group-hover:drop-shadow-lg group-hover:filter group-hover:brightness-105'
                      } ${selectedMood === mood.type ? 'animate-bounce' : ''}`}>
                      {mood.emoji}
                    </div>
                  </div>

                  {/* 标签文字 */}
                  <div className='relative z-10'>
                    <div
                      className={`text-xs xs:text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl font-bold transition-all duration-500 text-center leading-tight ${
                        selectedMood === mood.type
                          ? 'text-purple-700 dark:text-purple-200 drop-shadow-sm'
                          : 'text-gray-700 dark:text-gray-200 group-hover:text-purple-600 dark:group-hover:text-purple-300 group-hover:drop-shadow-sm'
                      } ${selectedMood === mood.type ? 'font-extrabold' : 'group-hover:font-extrabold'}`}>
                      {mood.label}
                    </div>
                  </div>

                  {/* 选中指示器 */}
                  {selectedMood === mood.type && (
                    <div className='absolute top-1 xs:top-2 sm:top-3 right-1 xs:right-2 sm:right-3 w-2 xs:w-3 sm:w-4 h-2 xs:h-3 sm:h-4 bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-400 dark:to-purple-500 rounded-full shadow-xl shadow-purple-500/50 dark:shadow-purple-400/50 animate-pulse border-2 border-white/80 dark:border-theme-gray-800/80'></div>
                  )}

                  {/* 悬停指示器 */}
                  <div
                    className={`absolute top-1 xs:top-2 sm:top-3 right-1 xs:right-2 sm:right-3 w-1.5 xs:w-2 sm:w-3 h-1.5 xs:h-2 sm:h-3 bg-gradient-to-br from-purple-400/60 to-purple-500/60 dark:from-purple-300/60 dark:to-purple-400/60 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-all duration-300 scale-75 group-hover:scale-100 ${
                      selectedMood === mood.type ? 'hidden' : ''
                    }`}></div>
                </button>
              ))}
            </div>

            {/* 快速备注 */}
            <div className='mb-4 sm:mb-6 lg:mb-8'>
              <textarea
                value={quickNote}
                onChange={e => setQuickNote(e.target.value)}
                placeholder='简单记录一下现在的感受...'
                className='form-input w-full h-24 sm:h-32 lg:h-40 xl:h-44 p-3 sm:p-4 lg:p-5 xl:p-6 border-2 border-gray-200/50 dark:border-theme-gray-600/50 rounded-lg sm:rounded-xl lg:rounded-2xl xl:rounded-3xl bg-white/80 dark:bg-theme-gray-700/80 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 lg:focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 dark:focus:border-purple-400 resize-none transition-all duration-300 shadow-sm hover:shadow-md backdrop-blur-sm text-sm sm:text-base lg:text-lg leading-relaxed'
                rows={3}
              />
            </div>

            {/* 保存按钮 */}
            <button
              onClick={handleQuickRecord}
              disabled={!selectedMood || isRecording}
              className='btn btn-primary w-full px-6 sm:px-8 lg:px-10 xl:px-12 py-4 sm:py-5 lg:py-6 xl:py-7 2xl:py-8 bg-gradient-to-r from-purple-500 via-purple-600 to-blue-600 dark:from-purple-600 dark:via-purple-700 dark:to-blue-700 text-white rounded-lg sm:rounded-xl lg:rounded-2xl xl:rounded-3xl font-semibold hover:from-purple-600 hover:via-purple-700 hover:to-blue-700 dark:hover:from-purple-700 dark:hover:via-purple-800 dark:hover:to-blue-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 sm:space-x-3 lg:space-x-4 shadow-lg shadow-purple-500/25 dark:shadow-purple-600/20 hover:shadow-xl hover:shadow-purple-500/30 dark:hover:shadow-purple-600/25 transform hover:scale-[1.02] active:scale-[0.98] text-sm sm:text-base lg:text-lg xl:text-xl min-h-[48px] sm:min-h-[56px] lg:min-h-[64px] xl:min-h-[72px] 2xl:min-h-[80px]'>
              {isRecording ? (
                <>
                  <div className='w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin' />
                  <span>记录中...</span>
                </>
              ) : (
                <>
                  <Heart className='w-4 h-4 sm:w-5 sm:h-5' />
                  <span>记录心情</span>
                </>
              )}
            </button>
          </Card>

          {/* 功能导航 */}
          <Card variant='default' padding='md' className='p-4 sm:p-6 lg:p-8 xl:p-10'>
            <div className='flex items-center space-x-3 sm:space-x-4 lg:space-x-6 mb-4 sm:mb-6 lg:mb-8'>
              <div className='w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 xl:w-20 xl:h-20 bg-green-500 rounded-full flex items-center justify-center shadow-lg'>
                <ArrowRight className='w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 xl:w-10 xl:h-10 text-white' />
              </div>
              <div>
                <h3 className='text-lg sm:text-xl lg:text-2xl xl:text-3xl font-semibold text-gray-800 dark:text-gray-200'>
                  功能导航
                </h3>
                <p className='text-sm sm:text-base lg:text-lg text-gray-600 dark:text-gray-400'>探索更多功能</p>
              </div>
            </div>

            <div className='grid grid-cols-2 gap-3 sm:gap-4 lg:gap-6 xl:gap-8'>
              <Card
                variant='glass'
                padding='md'
                className='rounded-3xl shadow-md hover:shadow-xl ring-1 ring-white/10 dark:ring-black/20 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/40 dark:to-purple-800/40 transition-all duration-300 group hover:scale-105'>
                <Link to='/record' className='block'>
                  <div className='flex flex-col items-center text-center'>
                    <div className='w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 xl:w-20 xl:h-20 bg-purple-500 rounded-full flex items-center justify-center mb-3 sm:mb-4 lg:mb-6 group-hover:scale-110 transition-transform shadow-lg'>
                      <PenTool className='w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 xl:w-10 xl:h-10 text-white' />
                    </div>
                    <h4 className='text-sm sm:text-base lg:text-lg xl:text-xl font-medium text-gray-800 dark:text-gray-200 mb-1 sm:mb-2 lg:mb-3'>
                      详细记录
                    </h4>
                    <p className='text-xs sm:text-sm lg:text-base text-gray-600 dark:text-gray-400'>记录详细心情</p>
                  </div>
                </Link>
              </Card>

              <Card
                variant='glass'
                padding='md'
                className='rounded-3xl shadow-md hover:shadow-xl ring-1 ring-white/10 dark:ring-black/20 bg-gradient-to-br from-pink-50 to-purple-100 dark:from-purple-900/40 dark:to-purple-800/40 transition-all duration-300 group hover:scale-105'>
                <Link to='/mentor' className='block'>
                  <div className='flex flex-col items-center text-center'>
                    <div className='w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 xl:w-20 xl:h-20 bg-purple-500 rounded-full flex items-center justify-center mb-3 sm:mb-4 lg:mb-6 group-hover:scale-110 transition-transform shadow-lg'>
                      <HeartHandshake className='w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 xl:w-10 xl:h-10 text-white' />
                    </div>
                    <h4 className='text-sm sm:text-base lg:text-lg xl:text-xl font-medium text-gray-800 dark:text-gray-200 mb-1 sm:mb-2 lg:mb-3'>
                      AI 伴侣
                    </h4>
                    <p className='text-xs sm:text-sm lg:text-base text-gray-600 dark:text-gray-400'>
                      对话疏导与自助练习
                    </p>
                  </div>
                </Link>
              </Card>

              <Card
                variant='glass'
                padding='md'
                className='rounded-3xl shadow-md hover:shadow-xl ring-1 ring-white/10 dark:ring-black/20 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/40 dark:to-green-800/40 transition-all duration-300 group hover:scale-105'>
                <Link to='/analytics' className='block'>
                  <div className='flex flex-col items-center text-center'>
                    <div className='w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 xl:w-20 xl:h-20 bg-green-500 rounded-full flex items-center justify-center mb-3 sm:mb-4 lg:mb-6 group-hover:scale-110 transition-transform shadow-lg'>
                      <BarChart3 className='w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 xl:w-10 xl:h-10 text-white' />
                    </div>
                    <h4 className='text-sm sm:text-base lg:text-lg xl:text-xl font-medium text-gray-800 dark:text-gray-200 mb-1 sm:mb-2 lg:mb-3'>
                      趋势分析
                    </h4>
                    <p className='text-xs sm:text-sm lg:text-base text-gray-600 dark:text-gray-400'>分析情绪趋势</p>
                  </div>
                </Link>
              </Card>

              <Card
                variant='glass'
                padding='md'
                className='rounded-3xl shadow-md hover:shadow-xl ring-1 ring-white/10 dark:ring-black/20 bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/40 dark:to-indigo-800/40 transition-all duration-300 group hover:scale-105'>
                <Link to='/settings' className='block'>
                  <div className='flex flex-col items-center text-center'>
                    <div className='w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 xl:w-20 xl:h-20 bg-indigo-500 rounded-full flex items-center justify-center mb-3 sm:mb-4 lg:mb-6 group-hover:scale-110 transition-transform shadow-lg'>
                      <SettingsIcon className='w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 xl:w-10 xl:h-10 text-white' />
                    </div>
                    <h4 className='text-sm sm:text-base lg:text-lg xl:text-xl font-medium text-gray-800 dark:text-gray-200 mb-1 sm:mb-2 lg:mb-3'>
                      设置管理
                    </h4>
                    <p className='text-xs sm:text-sm lg:text-base text-gray-600 dark:text-gray-400'>进行设置管理</p>
                  </div>
                </Link>
              </Card>
            </div>
          </Card>
        </div>
      </Container>
    </>
  );
};

export default Home;
