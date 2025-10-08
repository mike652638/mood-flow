import { createClient } from '@supabase/supabase-js';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Database } from '../types/database';

const supabaseUrl = 'https://scwmgkybeutarschxcpe.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjd21na3liZXV0YXJzY2h4Y3BlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTQwNzMsImV4cCI6MjA3NDM5MDA3M30.sdak8_4ABePHGjHTVpNloyoHFEnBimo_dQtyBg_1Dq4';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// 认证相关函数
export const auth = {
  // 注册
  signUp: async (email: string, password: string, userData?: { name?: string }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData
      }
    });
    return { data, error };
  },

  // 登录
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { data, error };
  },

  // 登出
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  // 获取当前用户
  getCurrentUser: async () => {
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();
    return { user, error };
  },

  // 监听认证状态变化
  onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
    return supabase.auth.onAuthStateChange(callback);
  }
};

// 情绪记录相关函数
export const moodRecords = {
  // 获取用户的情绪记录
  getRecords: async (userId: string, limit?: number) => {
    let query = supabase
      .from('mood_records')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    return { data, error };
  },

  // 创建情绪记录
  createRecord: async (record: {
    user_id: string;
    mood_type: string;
    mood_intensity: number;
    diary_content?: string;
    tags?: string[];
  }) => {
    const { data, error } = await supabase.from('mood_records').insert([record]).select().single();
    return { data, error };
  },

  // 更新情绪记录
  updateRecord: async (
    id: string,
    updates: Partial<{
      mood_type: string;
      mood_intensity: number;
      diary_content: string;
      tags: string[];
    }>
  ) => {
    const { data, error } = await supabase.from('mood_records').update(updates).eq('id', id).select().single();
    return { data, error };
  },

  // 删除情绪记录
  deleteRecord: async (id: string) => {
    const { error } = await supabase.from('mood_records').delete().eq('id', id);
    return { error };
  },

  // 按日期范围获取记录
  getRecordsByDateRange: async (userId: string, startDate: string, endDate: string) => {
    const { data, error } = await supabase
      .from('mood_records')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  // 获取情绪统计
  getMoodStats: async (userId: string, days: number = 30) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('mood_records')
      .select('mood_type, mood_intensity, created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    return { data, error };
  }
};

// 媒体文件相关函数
export const mediaFiles = {
  // 上传文件
  uploadFile: async (file: File, userId: string, recordId?: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage.from('mood-media').upload(fileName, file);

    if (error) return { data: null, error };

    // 获取公共URL
    const {
      data: { publicUrl }
    } = supabase.storage.from('mood-media').getPublicUrl(fileName);

    // 保存文件记录到数据库
    const { data: fileRecord, error: dbError } = await supabase
      .from('media_files')
      .insert([
        {
          user_id: userId,
          mood_record_id: recordId,
          file_name: file.name,
          file_path: fileName,
          file_type: file.type,
          file_size: file.size,
          public_url: publicUrl
        }
      ])
      .select()
      .single();

    return { data: fileRecord, error: dbError };
  },

  // 删除文件
  deleteFile: async (filePath: string, fileId: string) => {
    // 从存储中删除文件
    const { error: storageError } = await supabase.storage.from('mood-media').remove([filePath]);

    if (storageError) return { error: storageError };

    // 从数据库中删除记录
    const { error: dbError } = await supabase.from('media_files').delete().eq('id', fileId);

    return { error: dbError };
  },

  // 获取用户的媒体文件
  getUserFiles: async (userId: string) => {
    const { data, error } = await supabase
      .from('media_files')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return { data, error };
  }
};

// 实时订阅
export const subscriptions = {
  // 订阅情绪记录变化
  subscribeMoodRecords: (userId: string, callback: (payload: unknown) => void) => {
    return supabase
      .channel('mood_records')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mood_records',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe();
  },

  // 取消订阅
  unsubscribe: (subscription: unknown) => {
    return supabase.removeChannel(subscription as RealtimeChannel);
  }
};

export default supabase;
