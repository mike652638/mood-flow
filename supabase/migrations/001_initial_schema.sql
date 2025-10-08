-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建情绪记录表
CREATE TABLE IF NOT EXISTS mood_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  mood_type TEXT NOT NULL CHECK (mood_type IN ('happy', 'calm', 'excited', 'peaceful', 'sad', 'anxious', 'angry', 'stressed')),
  mood_intensity INTEGER NOT NULL CHECK (mood_intensity >= 1 AND mood_intensity <= 10),
  diary_content TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建媒体文件表
CREATE TABLE IF NOT EXISTS media_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  mood_record_id UUID,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  public_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_mood_records_user_id ON mood_records(user_id);
CREATE INDEX IF NOT EXISTS idx_mood_records_created_at ON mood_records(created_at);
CREATE INDEX IF NOT EXISTS idx_mood_records_mood_type ON mood_records(mood_type);
CREATE INDEX IF NOT EXISTS idx_media_files_user_id ON media_files(user_id);
CREATE INDEX IF NOT EXISTS idx_media_files_mood_record_id ON media_files(mood_record_id);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 为所有表添加更新时间触发器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mood_records_updated_at BEFORE UPDATE ON mood_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_media_files_updated_at BEFORE UPDATE ON media_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 启用行级安全策略 (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_files ENABLE ROW LEVEL SECURITY;

-- 用户表的RLS策略
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 情绪记录表的RLS策略
CREATE POLICY "Users can view own mood records" ON mood_records
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mood records" ON mood_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mood records" ON mood_records
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own mood records" ON mood_records
  FOR DELETE USING (auth.uid() = user_id);

-- 媒体文件表的RLS策略
CREATE POLICY "Users can view own media files" ON media_files
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own media files" ON media_files
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own media files" ON media_files
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own media files" ON media_files
  FOR DELETE USING (auth.uid() = user_id);

-- 创建存储桶（如果不存在）
INSERT INTO storage.buckets (id, name, public)
VALUES ('mood-media', 'mood-media', true)
ON CONFLICT (id) DO NOTHING;

-- 存储桶的RLS策略
CREATE POLICY "Users can upload own media" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'mood-media' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own media" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'mood-media' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own media" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'mood-media' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- 授予权限给anon和authenticated角色
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON mood_records TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON media_files TO anon, authenticated;

-- 授予序列权限
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 插入示例数据
INSERT INTO users (id, email, name) VALUES 
  ('00000000-0000-0000-0000-000000000001', 'demo@example.com', '演示用户')
ON CONFLICT (id) DO NOTHING;

INSERT INTO mood_records (id, user_id, mood_type, mood_intensity, diary_content, tags, created_at) VALUES 
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'happy', 8, '今天工作很顺利，完成了一个重要项目，心情特别好！', '{"工作","成就感","开心"}', NOW() - INTERVAL '1 day'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'calm', 7, '晚上和朋友喝茶聊天，感觉很放松。', '{"朋友","放松","茶"}', NOW() - INTERVAL '2 days'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'excited', 9, '收到了心仪已久的书，迫不及待想要阅读！', '{"阅读","兴奋","书籍"}', NOW() - INTERVAL '3 days'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'peaceful', 6, '在公园里散步，看到夕阳西下，内心很宁静。', '{"散步","自然","宁静"}', NOW() - INTERVAL '4 days'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'sad', 4, '想起了一些往事，有点难过，但也是成长的一部分。', '{"回忆","成长","反思"}', NOW() - INTERVAL '5 days')
ON CONFLICT (id) DO NOTHING;