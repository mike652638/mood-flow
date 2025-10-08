import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useImmersiveMode } from '../hooks/useImmersiveMode';
import Card from '../components/Card';

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { immersiveMode } = useImmersiveMode();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error('请输入邮箱地址');
      return;
    }

    // 简单的邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('请输入有效的邮箱地址');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) {
        toast.error(`发送重置邮件失败: ${error.message}`);
      } else {
        setEmailSent(true);
        toast.success('重置邮件已发送，请检查您的邮箱');
      }
    } catch (error) {
      console.error('发送重置邮件过程中发生错误:', error);
      toast.error('发送重置邮件过程中发生错误');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  if (emailSent) {
    return (
      <div
        className={`min-h-screen p-4 bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pt-safe-area-top-only ${
          immersiveMode ? 'pt-12 sm:pt-16' : ''
        }`}>
        <div className='mx-auto px-4 lg:px-8 max-w-full sm:max-w-2xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1400px] flex items-center justify-center'>
          <div className='w-full max-w-md'>
            {/* 成功状态 */}
            <div className='text-center mb-8'>
              <div className='inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 via-green-600 to-emerald-600 dark:from-green-600 dark:via-green-700 dark:to-emerald-700 rounded-2xl mb-6 shadow-lg shadow-green-500/25 dark:shadow-green-600/20'>
                <CheckCircle className='w-10 h-10 text-white' />
              </div>
              <h1 className='text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent mb-3'>
                邮件已发送
              </h1>
              <p className='text-gray-600 dark:text-gray-300 text-lg mb-4'>我们已向您的邮箱发送了密码重置链接</p>
              <p className='text-sm text-gray-500 dark:text-gray-400'>
                请检查您的邮箱（包括垃圾邮件文件夹）并点击重置链接
              </p>
            </div>

            {/* 操作按钮 */}
            <Card variant='default' padding='lg'>
              <div className='space-y-4'>
                <button
                  onClick={() => navigate('/login')}
                  className='btn btn-primary w-full bg-gradient-to-r from-purple-500 via-purple-600 to-blue-600 dark:from-purple-600 dark:via-purple-700 dark:to-blue-700 text-white py-4 rounded-2xl font-semibold hover:from-purple-600 hover:via-purple-700 hover:to-blue-700 dark:hover:from-purple-700 dark:hover:via-purple-800 dark:hover:to-blue-800 transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg shadow-purple-500/25 dark:shadow-purple-600/20 hover:shadow-xl hover:shadow-purple-500/30 dark:hover:shadow-purple-600/25 transform hover:scale-[1.02] active:scale-[0.98]'>
                  <span>返回登录</span>
                </button>

                <button
                  onClick={() => {
                    setEmailSent(false);
                    setEmail('');
                  }}
                  className='btn btn-ghost w-full bg-white/80 dark:bg-theme-gray-700/80 text-gray-700 dark:text-gray-300 py-4 rounded-2xl font-semibold border-2 border-gray-200/50 dark:border-theme-gray-600/50 hover:bg-white/95 dark:hover:bg-theme-gray-700/95 hover:border-purple-300 dark:hover:border-purple-500 transition-all duration-300 flex items-center justify-center space-x-2 shadow-md hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98]'>
                  <span>重新发送</span>
                </button>
              </div>
            </Card>

            {/* 提示信息 */}
            <div className='text-center mt-8 text-sm text-gray-500 dark:text-gray-400'>
              <p>没有收到邮件？请检查垃圾邮件文件夹</p>
              <p className='mt-2'>或者联系客服获取帮助</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen p-4 bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pt-safe-area-top-only ${
        immersiveMode ? 'pt-12 sm:pt-16' : ''
      }`}>
      <div className='mx-auto px-4 lg:px-8 max-w-full sm:max-w-2xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1400px] flex items-center justify-center'>
        <div className='w-full max-w-md'>
          {/* Logo和标题 */}
          <div className='text-center mb-8'>
            <div className='inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 via-purple-600 to-blue-600 dark:from-purple-600 dark:via-purple-700 dark:to-blue-700 rounded-2xl mb-6 shadow-lg shadow-purple-500/25 dark:shadow-purple-600/20'>
              <img src='/icon-192.png' alt='心流日记' className='w-full h-full object-contain' />
            </div>
            <h1 className='text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400 bg-clip-text text-transparent mb-3'>
              忘记密码
            </h1>
            <p className='text-gray-600 dark:text-gray-300 text-lg'>通过注册邮箱重置密码</p>
          </div>

          {/* 重置表单 */}
          <Card variant='default' padding='lg'>
            <form onSubmit={handleSubmit} className='space-y-6'>
              {/* 邮箱输入 */}
              <div>
                <label className='block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3'>邮箱地址</label>
                <div className='relative group'>
                  <Mail className='absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 group-focus-within:text-purple-500 dark:group-focus-within:text-purple-400 transition-colors duration-200' />
                  <input
                    type='email'
                    value={email}
                    onChange={handleInputChange}
                    placeholder='请输入注册邮箱地址'
                    className='form-input w-full pl-12 pr-4 py-4 bg-white/70 dark:bg-theme-gray-700/70 border-2 border-gray-200/50 dark:border-theme-gray-600/50 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 dark:focus:border-purple-400 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-200 hover:border-purple-300 dark:hover:border-purple-500'
                    required
                  />
                </div>
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-2'>
                  请确保正确输入注册时使用的邮箱地址，我们将向此邮箱发送重置密码链接
                </p>
              </div>

              {/* 发送按钮 */}
              <button
                type='submit'
                disabled={isLoading}
                className='btn btn-primary w-full bg-gradient-to-r from-purple-500 via-purple-600 to-blue-600 dark:from-purple-600 dark:via-purple-700 dark:to-blue-700 text-white py-4 rounded-2xl font-semibold hover:from-purple-600 hover:via-purple-700 hover:to-blue-700 dark:hover:from-purple-700 dark:hover:via-purple-800 dark:hover:to-blue-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg shadow-purple-500/25 dark:shadow-purple-600/20 hover:shadow-xl hover:shadow-purple-500/30 dark:hover:shadow-purple-600/25 transform hover:scale-[1.02] active:scale-[0.98]'>
                {isLoading ? (
                  <>
                    <div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin' />
                    <span>发送中...</span>
                  </>
                ) : (
                  <span>发送重置邮件</span>
                )}
              </button>
            </form>

            {/* 登录链接 */}
            <div className='text-center mt-8'>
              <span className='text-gray-600 dark:text-gray-400'>想起密码了？</span>
              <Link
                to='/login'
                className='ml-2 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-semibold transition-colors duration-200 px-3 py-1 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20'>
                立即登录
              </Link>
            </div>
          </Card>

          {/* 底部说明 */}
          <div className='text-center mt-8 text-sm text-gray-500 dark:text-gray-400'>
            <p>如果您没有收到邮件，请检查垃圾邮件文件夹</p>
            <p className='mt-2'>或者尝试使用其他邮箱地址注册新账户</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

