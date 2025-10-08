// 情绪类型定义
export type MoodType = 'happy' | 'excited' | 'moved' | 'fulfilled' | 'confident' | 'calm' | 'sad' | 'angry' | 'anxious' | 'stressed' | 'panic' | 'depressed';

// 用户接口
export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  preferences: UserPreferences;
  created_at: string;
  updated_at: string;
}

// 情绪记录接口
export interface MoodRecord {
  id: string;
  user_id: string;
  mood_type: MoodType;
  mood_intensity: number; // 1-10
  diary_content?: string;
  // 结构化情绪细节（可选，便于分析）
  trigger_event?: string;
  thoughts?: string;
  body_response?: string;
  coping?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  media_files?: MediaFile[];
}

// 媒体文件接口
export interface MediaFile {
  id: string;
  mood_record_id: string;
  file_type: 'image' | 'audio';
  file_path: string;
  file_name: string;
  file_size?: number;
  created_at: string;
}

// 情绪统计数据
export interface MoodStats {
  mood_type: MoodType;
  count: number;
  average_intensity: number;
  percentage: number;
}

// 趋势数据点
export interface TrendDataPoint {
  date: string;
  value: number;
  count: number;
}

// 词云数据
export interface WordCloudData {
  text: string;
  value: number;
}

// 情绪选项配置
export interface MoodOption {
  type: MoodType;
  label: string;
  emoji: string;
  color: string;
  description: string;
}

// 应用状态接口
export interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  records: MoodRecord[];
  currentRecord: Partial<MoodRecord> | null;
  currentMoodRecord: Partial<MoodRecord> | null;
  moodRecords: MoodRecord[];
  isLoading: boolean;
  error: string | null;
  theme: string;
  notifications: boolean;
  language: string;
}

// API响应接口
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

// 筛选选项
export interface FilterOptions {
  startDate?: string;
  endDate?: string;
  moodTypes?: MoodType[];
  intensityRange?: [number, number];
  searchText?: string;
}

// 用户偏好设置
export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  notifications: boolean;
  reminderTime?: string;
  dataRetention: number; // 天数
  exportFormat: 'json' | 'csv';
}