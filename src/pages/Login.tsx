import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useImmersiveMode } from '../hooks/useImmersiveMode';
import Card from '../components/Card';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnonymousLoading, setIsAnonymousLoading] = useState(false);
  const { immersiveMode } = useImmersiveMode();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      toast.error('请填写完整信息');
      return;
    }

    setIsLoading(true);

    try {
      // 基于认证事件触发导航，避免竞态
      const {
        data: { subscription }
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          toast.success('登录成功！');
          navigate('/', { replace: true });
          subscription.unsubscribe();
        }
      });

      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      });

      if (error) {
        toast.error(`登录失败: ${error.message}`);
        subscription.unsubscribe();
      } else if (data.user) {
        // 由 onAuthStateChange 的 SIGNED_IN 事件完成导航
      }
    } catch (error) {
      console.error('登录过程中发生错误:', error);
      toast.error('登录过程中发生错误');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div
      className={`min-h-screen p-4 bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pt-safe-area-top-only ${
        immersiveMode ? 'pt-12 sm:pt-16' : ''}`}>
      <div className='mx-auto px-4 lg:px-8 max-w-full sm:max-w-2xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1400px] flex items-center justify-center'>
        <div className='w-full max-w-md'>
          {/* Logo和标题 */}
          <div className='mb-8 text-center'>
            <div className='inline-flex justify-center items-center mb-6 w-20 h-20 bg-gradient-to-br from-purple-500 via-purple-600 to-blue-600 rounded-2xl shadow-lg dark:from-purple-600 dark:via-purple-700 dark:to-blue-700 shadow-purple-500/25 dark:shadow-purple-600/20'>
              <img src='/icon-192.png' alt='心流日记' className='object-contain w-full h-full' />
            </div>
            <h1 className='mb-3 text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400'>
              欢迎使用
            </h1>
            <p className='text-lg text-gray-600 dark:text-gray-300'>心流日记</p>
          </div>

          {/* 登录表单 */}
          <Card variant='default' padding='lg'>
            <form onSubmit={handleSubmit} className='space-y-4'>
              {/* 邮箱输入 */}
              <div>
                <label className='block mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300'>邮箱地址</label>
                <div className='relative group'>
                  <Mail className='absolute left-4 top-1/2 w-5 h-5 text-gray-400 transition-colors duration-200 transform -translate-y-1/2 dark:text-gray-500 group-focus-within:text-purple-500 dark:group-focus-within:text-purple-400' />
                  <input
                    type='email'
                    name='email'
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder='请输入邮箱地址'
                    className='py-4 pr-4 pl-12 w-full placeholder-gray-500 text-gray-900 rounded-2xl border-2 transition-all duration-200 form-input bg-white/70 dark:bg-theme-gray-700/70 border-gray-200/50 dark:border-theme-gray-600/50 focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 dark:focus:border-purple-400 dark:text-gray-100 dark:placeholder-gray-400 hover:border-purple-300 dark:hover:border-purple-500'
                    required
                  />
                </div>
              </div>

              {/* 密码输入 */}
              <div>
                <label className='block mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300'>密码</label>
                <div className='relative group'>
                  <Lock className='absolute left-4 top-1/2 w-5 h-5 text-gray-400 transition-colors duration-200 transform -translate-y-1/2 dark:text-gray-500 group-focus-within:text-purple-500 dark:group-focus-within:text-purple-400' />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name='password'
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder='请输入密码'
                    className='py-4 pr-14 pl-12 w-full placeholder-gray-500 text-gray-900 rounded-2xl border-2 transition-all duration-200 form-input bg-white/70 dark:bg-theme-gray-700/70 border-gray-200/50 dark:border-theme-gray-600/50 focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 dark:focus:border-purple-400 dark:text-gray-100 dark:placeholder-gray-400 hover:border-purple-300 dark:hover:border-purple-500'
                    required
                  />
                  <button
                    type='button'
                    onClick={() => setShowPassword(!showPassword)}
                    className='absolute right-4 top-1/2 p-1 text-gray-400 rounded-lg transition-colors duration-200 transform -translate-y-1/2 dark:text-gray-500 hover:text-purple-500 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'>
                    {showPassword ? <EyeOff className='w-5 h-5' /> : <Eye className='w-5 h-5' />}
                  </button>
                </div>
              </div>

              {/* 忘记密码 */}
              <div className='text-right'>
                <button
                  type='button'
                  onClick={() => navigate('/forgot-password')}
                  className='px-2 py-1 text-sm font-medium text-purple-600 rounded-lg transition-colors duration-200 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:underline hover:bg-purple-50 dark:hover:bg-purple-900/20'>
                  忘记密码？
                </button>
              </div>

              {/* 登录按钮 */}
              <button
                type='submit'
                disabled={isLoading}
                className='btn btn-primary w-full bg-gradient-to-r from-purple-500 via-purple-600 to-blue-600 dark:from-purple-600 dark:via-purple-700 dark:to-blue-700 text-white py-4 rounded-2xl font-semibold hover:from-purple-600 hover:via-purple-700 hover:to-blue-700 dark:hover:from-purple-700 dark:hover:via-purple-800 dark:hover:to-blue-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg shadow-purple-500/25 dark:shadow-purple-600/20 hover:shadow-xl hover:shadow-purple-500/30 dark:hover:shadow-purple-600/25 transform hover:scale-[1.02] active:scale-[0.98]'>
                {isLoading ? (
                  <>
                    <div className='w-5 h-5 rounded-full border-2 border-white animate-spin border-t-transparent' />
                    <span>登录中...</span>
                  </>
                ) : (
                  <span>登录</span>
                )}
              </button>
            </form>

            {/* 分割线 */}
              <div className='flex items-center my-8'>
              <div className='flex-1 border-t border-gray-200/60 dark:border-theme-gray-600/60'></div>
              <span className='px-6 text-sm font-medium text-gray-500 rounded-full dark:text-gray-400 bg-white/50 dark:bg-theme-gray-800/50'>
                或
              </span>
              <div className='flex-1 border-t border-gray-200/60 dark:border-theme-gray-600/60'></div>
              </div>

            {/* 快速登录 */}
            <button
              type='button'
              onClick={async () => {
                setIsAnonymousLoading(true);
                try {
                  // 使用测试账户登录
                  const testEmail = 'mike652638@qq.com';
                  const testPassword = 'Qyfl1@Rymz';

                  const {
                    data: { subscription }
                  } = supabase.auth.onAuthStateChange((event, session) => {
                    if (event === 'SIGNED_IN' && session?.user) {
                      toast.success('快速体验开始！');
                      navigate('/', { replace: true });
                      subscription.unsubscribe();
                    }
                  });

                  const { data, error } = await supabase.auth.signInWithPassword({
                    email: testEmail,
                    password: testPassword
                  });

                  if (error) {
                    toast.error('快速体验功能暂时不可用，请使用邮箱注册登录');
                    subscription.unsubscribe();
                    return;
                  }

                  if (data.user) {
                    // 由 onAuthStateChange 的 SIGNED_IN 事件完成导航
                  }
                } catch (error) {
                  console.error('快速体验登录过程中发生错误:', error);
                  toast.error('快速体验功能暂时不可用，请使用邮箱注册登录');
                } finally {
                  setIsAnonymousLoading(false);
                }
              }}
              disabled={isLoading || isAnonymousLoading}
              className='btn btn-ghost w-full bg-white/80 dark:bg-theme-gray-700/80 text-gray-700 dark:text-gray-300 py-4 rounded-2xl font-semibold border-2 border-gray-200/50 dark:border-theme-gray-600/50 hover:bg-white/95 dark:hover:bg-theme-gray-700/95 hover:border-purple-300 dark:hover:border-purple-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3 shadow-md hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98]'>
              {isAnonymousLoading ? (
                <>
                  <div className='w-4 h-4 rounded-full border-2 border-gray-600 animate-spin dark:border-theme-gray-300 border-t-transparent' />
                  <span>启动体验中...</span>
                </>
              ) : (
                <>
                  <span className='text-xl'>🚀</span>
                  <span>快速体验（无需注册）</span>
                </>
              )}
            </button>

            {/* 注册链接 */}
            <div className='mt-8 text-center'>
              <span className='text-gray-600 dark:text-gray-400'>还没有账户？</span>
              <Link
                to='/register'
                className='px-3 py-1 ml-2 font-semibold text-purple-600 rounded-lg transition-colors duration-200 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20'>
                立即注册
              </Link>
            </div>
          </Card>

          {/* 底部说明 */}
          <div className='mt-8 text-sm text-center text-gray-500 dark:text-gray-400'>
            <p className='mb-2'>登录即表示同意我们的</p>
            <div className='space-x-3'>
              <button
                type='button'
                className='px-2 py-1 font-medium text-purple-600 rounded-lg transition-colors duration-200 cursor-pointer dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:underline hover:bg-purple-50 dark:hover:bg-purple-900/20'
                onClick={e => {
                  e.preventDefault();
                  navigate('/terms');
                }}>
                服务条款
              </button>
              <span>和</span>
              <button
                type='button'
                className='px-2 py-1 font-medium text-purple-600 rounded-lg transition-colors duration-200 cursor-pointer dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:underline hover:bg-purple-50 dark:hover:bg-purple-900/20'
                onClick={e => {
                  e.preventDefault();
                  navigate('/privacy');
                }}>
                隐私政策
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
