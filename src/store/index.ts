import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useMemo } from 'react';
import type { User, MoodRecord, AppState, MoodType, TrendDataPoint } from '../types';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: SupabaseUser) => void;
  logout: () => void;
  setUser: (user: User) => void;
}

interface MoodState {
  records: MoodRecord[];
  currentRecord: Partial<MoodRecord> | null;
  isLoading: boolean;
  error: string | null;
  addRecord: (record: Omit<MoodRecord, 'id' | 'created_at' | 'updated_at'>) => void;
  updateRecord: (id: string, updates: Partial<MoodRecord>) => void;
  deleteRecord: (id: string) => void;
  setCurrentRecord: (record: Partial<MoodRecord> | null) => void;
  setRecords: (records: MoodRecord[]) => void;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

interface UIState {
  theme: 'light' | 'dark';
  themeMode: 'system' | 'light' | 'dark' | 'auto';
  sidebarOpen: boolean;
  notifications: boolean;
  language: 'zh' | 'en';
  // 主题自动化设置
  autoThemeEnabled: boolean;
  autoThemeStart: string; // HH:mm
  autoThemeEnd: string; // HH:mm
  followSystemTheme: boolean;
  setTheme: (theme: 'light' | 'dark') => void;
  setThemeMode: (mode: 'system' | 'light' | 'dark' | 'auto') => void;
  setSidebarOpen: (open: boolean) => void;
  setNotifications: (enabled: boolean) => void;
  setLanguage: (language: 'zh' | 'en') => void;
  // 主题自动化设置的 setter
  setAutoThemeEnabled: (enabled: boolean) => void;
  setAutoThemeStart: (start: string) => void;
  setAutoThemeEnd: (end: string) => void;
  setFollowSystemTheme: (enabled: boolean) => void;
}

// 认证状态管理
export const useAuthStore = create<AuthState>()(
  persist(
    set => ({
      user: null,
      isAuthenticated: false,
      login: supabaseUser => {
        const user: User = {
          id: supabaseUser.id,
          email: supabaseUser.email || '',
          name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User',
          avatar_url: supabaseUser.user_metadata?.avatar_url,
          preferences: {
            theme: 'light' as const,
            notifications: true,
            dataRetention: 365,
            exportFormat: 'json' as const
          },
          created_at: supabaseUser.created_at || new Date().toISOString(),
          updated_at: supabaseUser.updated_at || new Date().toISOString()
        };
        set({ user, isAuthenticated: true });
      },
      logout: () => set({ user: null, isAuthenticated: false }),
      setUser: user => set({ user })
    }),
    {
      name: 'auth-storage'
    }
  )
);

// 情绪记录状态管理
export const useMoodStore = create<MoodState>()(
  persist(
    set => ({
      records: [],
      currentRecord: null,
      isLoading: false,
      error: null,

      addRecord: recordData => {
        const newRecord: MoodRecord = {
          ...recordData,
          id: Date.now().toString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        set(state => ({
          records: [newRecord, ...state.records]
        }));
      },

      updateRecord: (id, updates) => {
        set(state => ({
          records: state.records.map(record =>
            record.id === id ? { ...record, ...updates, updated_at: new Date().toISOString() } : record
          )
        }));
      },

      deleteRecord: id => {
        set(state => ({
          records: state.records.filter(record => record.id !== id)
        }));
      },

      setCurrentRecord: record => set({ currentRecord: record }),

      setRecords: records => set({ records }),

      clearError: () => set({ error: null }),

      setLoading: loading => set({ isLoading: loading })
    }),
    {
      name: 'mood-storage'
    }
  )
);

// UI状态管理
export const useUIStore = create<UIState>()(
  persist(
    set => ({
      theme: 'light',
      themeMode: 'system',
      sidebarOpen: false,
      notifications: true,
      language: 'zh',
      autoThemeEnabled: false,
      autoThemeStart: '22:00',
      autoThemeEnd: '07:00',
      followSystemTheme: false,

      setTheme: theme => set({ theme }),
      setThemeMode: mode => set({ themeMode: mode }),
      setSidebarOpen: open => set({ sidebarOpen: open }),
      setNotifications: enabled => set({ notifications: enabled }),
      setLanguage: language => set({ language }),
      setAutoThemeEnabled: enabled => set({ autoThemeEnabled: enabled }),
      setAutoThemeStart: start => set({ autoThemeStart: start }),
      setAutoThemeEnd: end => set({ autoThemeEnd: end }),
      setFollowSystemTheme: enabled => set({ followSystemTheme: enabled })
    }),
    {
      name: 'ui-storage'
    }
  )
);

// 组合状态选择器
export const useAppState = (): AppState => {
  const auth = useAuthStore();
  const mood = useMoodStore();
  const ui = useUIStore();

  return {
    user: auth.user,
    isAuthenticated: auth.isAuthenticated,
    records: mood.records,
    currentRecord: mood.currentRecord,
    currentMoodRecord: mood.currentRecord,
    moodRecords: mood.records,
    isLoading: mood.isLoading,
    error: mood.error,
    theme: ui.theme,
    notifications: ui.notifications,
    language: ui.language
  };
};

// 情绪统计数据
export const useMoodStats = (days: number = 30) => {
  const records = useMoodStore(state => state.records);

  const stats = useMemo(() => {
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const filteredRecords = records.filter(record => new Date(record.created_at) >= startDate);

    const moodCounts: Record<MoodType, number> = {
      happy: 0,
      excited: 0,
      moved: 0,
      fulfilled: 0,
      confident: 0,
      calm: 0,
      sad: 0,
      angry: 0,
      anxious: 0,
      stressed: 0,
      panic: 0,
      depressed: 0
    };

    let totalIntensity = 0;

    filteredRecords.forEach(record => {
      moodCounts[record.mood_type]++;
      totalIntensity += record.mood_intensity;
    });

    const avgIntensity = filteredRecords.length > 0 ? totalIntensity / filteredRecords.length : 0;

    return {
      totalRecords: filteredRecords.length,
      avgIntensity: Math.round(avgIntensity * 10) / 10,
      moodCounts,
      mostCommonMood: Object.entries(moodCounts).reduce((a, b) =>
        moodCounts[a[0] as MoodType] > moodCounts[b[0] as MoodType] ? a : b
      )[0] as MoodType
    };
  }, [records, days]);

  return stats;
};

// 今日记录获取
export const useTodayRecords = (): MoodRecord[] => {
  const records = useMoodStore(state => state.records);
  const today = new Date().toDateString();

  return records.filter(record => new Date(record.created_at).toDateString() === today);
};

// 最近记录获取
export const useRecentRecords = (days: number = 7): MoodRecord[] => {
  const records = useMoodStore(state => state.records);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  return records
    .filter(record => new Date(record.created_at) >= cutoffDate)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

// 情绪趋势数据
export const useMoodTrend = (days: number = 30) => {
  const records = useMoodStore(state => state.records);

  const trendData = useMemo(() => {
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const filteredRecords = records.filter(record => new Date(record.created_at) >= startDate);

    // 按日期分组
    const groupedByDate = filteredRecords.reduce((acc, record) => {
      const date = new Date(record.created_at).toDateString();
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(record);
      return acc;
    }, {} as Record<string, MoodRecord[]>);

    // 计算每日平均情绪强度
    const trendPoints: TrendDataPoint[] = Object.entries(groupedByDate)
      .map(([date, dayRecords]) => {
        const avgIntensity = dayRecords.reduce((sum, record) => sum + record.mood_intensity, 0) / dayRecords.length;
        return {
          date,
          value: Math.round(avgIntensity * 10) / 10,
          count: dayRecords.length
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return trendPoints;
  }, [records, days]);

  return trendData;
};

// 标签统计
export const useTagStats = () => {
  const records = useMoodStore(state => state.records);

  const tagStats = useMemo(() => {
    const tagCount: Record<string, number> = {};

    records.forEach(record => {
      if (record.tags) {
        record.tags.forEach(tag => {
          tagCount[tag] = (tagCount[tag] || 0) + 1;
        });
      }
    });

    return Object.entries(tagCount)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // 只返回前20个标签
  }, [records]);

  return tagStats;
};

// 初始化示例数据
export const initializeSampleData = () => {
  const { records, addRecord } = useMoodStore.getState();

  // 如果已有数据，不重复初始化
  if (records.length > 0) return;

  const now = new Date();
  const sampleRecords = [
    // 今天的记录
    {
      user_id: 'sample-user',
      mood_type: 'happy' as const,
      mood_intensity: 8,
      diary_content: '今天和朋友一起看了电影，心情特别好！阳光明媚的一天，感觉生活充满了希望。',
      tags: ['朋友', '电影', '开心', '阳光']
    },
    {
      user_id: 'sample-user',
      mood_type: 'calm' as const,
      mood_intensity: 7,
      diary_content: '早上做了冥想，感觉内心很平静。今天的工作也很顺利。',
      tags: ['冥想', '平静', '工作']
    },
    // 昨天的记录
    {
      user_id: 'sample-user',
      mood_type: 'excited' as const,
      mood_intensity: 9,
      diary_content: '收到了心仪公司的面试邀请，太兴奋了！',
      tags: ['面试', '兴奋', '机会', '工作']
    },
    {
      user_id: 'sample-user',
      mood_type: 'calm' as const,
      mood_intensity: 6,
      diary_content: '晚上做了瑜伽，听着轻音乐，感觉很宁静。',
      tags: ['瑜伽', '音乐', '宁静', '放松']
    },
    // 前天的记录
    {
      user_id: 'sample-user',
      mood_type: 'anxious' as const,
      mood_intensity: 7,
      diary_content: '明天有重要的会议，有点紧张。不过已经准备得很充分了。',
      tags: ['工作', '会议', '紧张', '准备']
    },
    {
      user_id: 'sample-user',
      mood_type: 'sad' as const,
      mood_intensity: 4,
      diary_content: '看了一部感人的电影，哭得稀里哗啦的。有时候哭一场也挺好的。',
      tags: ['电影', '感动', '哭泣', '释放']
    },
    // 三天前的记录
    {
      user_id: 'sample-user',
      mood_type: 'angry' as const,
      mood_intensity: 8,
      diary_content: '地铁上遇到了很不礼貌的人，真的很生气。深呼吸，告诉自己要保持冷静。',
      tags: ['地铁', '不礼貌', '生气', '冷静']
    },
    {
      user_id: 'sample-user',
      mood_type: 'happy' as const,
      mood_intensity: 7,
      diary_content: '和家人一起吃饭，聊了很多有趣的话题。家人的陪伴总是让人感到温暖。',
      tags: ['家人', '吃饭', '聊天', '温暖']
    },
    // 一周前的记录
    {
      user_id: 'sample-user',
      mood_type: 'stressed' as const,
      mood_intensity: 9,
      diary_content: '项目截止日期临近，压力山大。但是团队合作得很好，相信能够按时完成。',
      tags: ['项目', '截止日期', '压力', '团队合作']
    },
    {
      user_id: 'sample-user',
      mood_type: 'calm' as const,
      mood_intensity: 8,
      diary_content: '周末去了公园散步，看到了美丽的樱花。大自然总是能让人心情平静。',
      tags: ['公园', '散步', '樱花', '大自然']
    }
  ];

  // 添加示例记录，分散在不同时间
  sampleRecords.forEach((record, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - Math.floor(index / 2));
    date.setHours(Math.floor(Math.random() * 24));

    addRecord({
      ...record
    });
  });

  // 设置示例用户
  const mockSupabaseUser: SupabaseUser = {
    id: 'sample-user',
    email: 'demo@example.com',
    user_metadata: {
      name: '演示用户'
    },
    created_at: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    updated_at: new Date().toISOString(),
    aud: 'authenticated',
    app_metadata: {},
    role: 'authenticated'
  };
  useAuthStore.getState().login(mockSupabaseUser);
};
