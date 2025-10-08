import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, User } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store';
import { useImmersiveMode } from '../hooks/useImmersiveMode';
import Card from '../components/Card';

const Register = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const { immersiveMode } = useImmersiveMode();

  const validateForm = () => {
    // 表单验证
    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      toast.error('请填写完整信息');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('两次输入的密码不一致');
      return false;
    }

    if (formData.password.length < 6) {
      toast.error('密码长度至少6位');
      return false;
    }

    if (!agreedToTerms) {
      toast.error('请同意服务条款和隐私政策');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name
          }
        }
      });

      if (error) {
        console.error('注册错误:', error);
        if (error.message.includes('email_address_invalid')) {
          toast.error('请使用真实有效的邮箱地址进行注册');
        } else {
          toast.error(`注册失败: ${error.message}`);
        }
      } else if (data.user) {
        if (!data.user.email_confirmed_at) {
          toast.success('注册成功！请检查邮箱并点击确认链接。');
          // 对于需要邮箱验证的用户，跳转到登录页面
          setTimeout(() => {
            navigate('/login', { replace: true });
          }, 2000);
        } else {
          // 如果邮箱已确认，直接登录并跳转
          login(data.user);
          toast.success('注册成功！');
          navigate('/', { replace: true });
        }
      }
    } catch (error) {
      console.error('注册异常:', error);
      toast.error('注册失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const getPasswordStrength = (password: string) => {
    if (password.length === 0) return { strength: 0, text: '', color: '' };
    if (password.length < 6) return { strength: 1, text: '弱', color: 'text-red-500' };
    if (password.length < 8) return { strength: 2, text: '中等', color: 'text-yellow-500' };
    if (password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)) {
      return { strength: 3, text: '强', color: 'text-green-500' };
    }
    return { strength: 2, text: '中等', color: 'text-yellow-500' };
  };

  const passwordStrength = getPasswordStrength(formData.password);

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-theme-gray-900 dark:via-purple-900/20 dark:to-blue-900/20 p-4 pt-safe-area-top-only ${
        immersiveMode ? 'pt-12 sm:pt-16' : ''
      }`}>
      <div className='mx-auto px-4 lg:px-8 max-w-full sm:max-w-2xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1400px] flex items-center justify-center'>
        <div className='w-full max-w-md'>
          {/* Logo和标题 */}
          <div className='text-center mb-10'>
            <div className='inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-purple-500 via-purple-600 to-blue-600 dark:from-purple-600 dark:via-purple-700 dark:to-blue-700 rounded-3xl mb-6 shadow-lg shadow-purple-500/25 dark:shadow-purple-600/20'>
              <img src='/icon-192.png' alt='心流日记' className='w-full h-full object-contain' />
            </div>
            <h1 className='text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400 bg-clip-text text-transparent mb-3'>
              创建账户
            </h1>
            <p className='text-gray-600 dark:text-gray-400 text-lg'>开始你的情绪疗愈之旅</p>
          </div>

          {/* 注册表单 */}
          <Card variant='default' padding='lg'>
            <form onSubmit={handleSubmit} className='space-y-4'>
              {/* 姓名输入 */}
              <div className='mb-6'>
                <label className='block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3'>姓名</label>
                <div className='relative group'>
                  <User className='absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 group-focus-within:text-purple-500 dark:group-focus-within:text-purple-400 transition-colors duration-200' />
                  <input
                    type='text'
                    name='name'
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder='请输入你的姓名'
                    className='form-input w-full pl-12 pr-4 py-4 bg-white/70 dark:bg-theme-gray-700/70 border-2 border-gray-200/50 dark:border-theme-gray-600/50 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 dark:focus:border-purple-400 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-200 hover:border-purple-300 dark:hover:border-purple-500'
                    required
                  />
                </div>
              </div>

              {/* 邮箱输入 */}
              <div className='mb-6'>
                <label className='block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3'>邮箱地址</label>
                <div className='relative group'>
                  <Mail className='absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 group-focus-within:text-purple-500 dark:group-focus-within:text-purple-400 transition-colors duration-200' />
                  <input
                    type='email'
                    name='email'
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder='请输入邮箱地址'
                    className='form-input w-full pl-12 pr-4 py-4 bg-white/70 dark:bg-theme-gray-700/70 border-2 border-gray-200/50 dark:border-theme-gray-600/50 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 dark:focus:border-purple-400 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-200 hover:border-purple-300 dark:hover:border-purple-500'
                    required
                  />
                </div>
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-2'>请使用真实邮箱地址，注册后需要验证邮箱</p>
              </div>

              {/* 密码输入 */}
              <div className='mb-6'>
                <label className='block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3'>密码</label>
                <div className='relative group'>
                  <Lock className='absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 group-focus-within:text-purple-500 dark:group-focus-within:text-purple-400 transition-colors duration-200' />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name='password'
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder='请输入密码'
                    className='form-input w-full pl-12 pr-14 py-4 bg-white/70 dark:bg-theme-gray-700/70 border-2 border-gray-200/50 dark:border-theme-gray-600/50 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 dark:focus:border-purple-400 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-200 hover:border-purple-300 dark:hover:border-purple-500'
                    required
                  />
                  <button
                    type='button'
                    onClick={() => setShowPassword(!showPassword)}
                    className='absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-purple-500 dark:hover:text-purple-400 transition-colors duration-200 p-1 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20'>
                    {showPassword ? <EyeOff className='w-5 h-5' /> : <Eye className='w-5 h-5' />}
                  </button>
                </div>
                {/* 密码强度指示器 */}
                {formData.password && (
                  <div className='mt-2'>
                    <div className='flex items-center space-x-2'>
                      <div className='flex-1 bg-gray-200 dark:bg-theme-gray-600 rounded-full h-2'>
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            passwordStrength.strength === 1
                              ? 'bg-red-500 w-1/3'
                              : passwordStrength.strength === 2
                              ? 'bg-yellow-500 w-2/3'
                              : passwordStrength.strength === 3
                              ? 'bg-green-500 w-full'
                              : 'w-0'
                          }`}
                        />
                      </div>
                      <span className={`text-xs font-medium ${passwordStrength.color}`}>{passwordStrength.text}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 确认密码输入 */}
              <div className='mb-6'>
                <label className='block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3'>确认密码</label>
                <div className='relative group'>
                  <Lock className='absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 group-focus-within:text-purple-500 dark:group-focus-within:text-purple-400 transition-colors duration-200' />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name='confirmPassword'
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder='请再次输入密码'
                    className='form-input w-full pl-12 pr-14 py-4 bg-white/70 dark:bg-theme-gray-700/70 border-2 border-gray-200/50 dark:border-theme-gray-600/50 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 dark:focus:border-purple-400 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-200 hover:border-purple-300 dark:hover:border-purple-500'
                    required
                  />
                  <button
                    type='button'
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className='absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-purple-500 dark:hover:text-purple-400 transition-colors duration-200 p-1 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20'>
                    {showConfirmPassword ? <EyeOff className='w-5 h-5' /> : <Eye className='w-5 h-5' />}
                  </button>
                </div>
                {/* 密码匹配提示 */}
                {formData.confirmPassword && (
                  <div className='mt-2'>
                    {formData.password === formData.confirmPassword ? (
                      <p className='text-xs text-green-600 dark:text-green-400'>✓ 密码匹配</p>
                    ) : (
                      <p className='text-xs text-red-600 dark:text-red-400'>✗ 密码不匹配</p>
                    )}
                  </div>
                )}
              </div>

              {/* 服务条款同意 */}
              <div className='flex items-start space-x-4 mb-8'>
                <div className='relative flex items-center mt-1'>
                  <input
                    type='checkbox'
                    id='terms'
                    checked={agreedToTerms}
                    onChange={e => setAgreedToTerms(e.target.checked)}
                    className='appearance-none w-5 h-5 border-2 border-gray-300 dark:border-theme-gray-500 rounded bg-white dark:bg-theme-gray-700 checked:bg-purple-600 checked:border-purple-600 focus:ring-4 focus:ring-purple-500/20 focus:ring-offset-0 cursor-pointer transition-all duration-200'
                  />
                  {agreedToTerms && (
                    <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
                      <svg className='w-3 h-3 text-white' fill='currentColor' viewBox='0 0 20 20'>
                        <path
                          fillRule='evenodd'
                          d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                          clipRule='evenodd'
                        />
                      </svg>
                    </div>
                  )}
                </div>
                <label
                  htmlFor='terms'
                  className='text-sm text-gray-600 dark:text-gray-400 cursor-pointer flex-1 leading-relaxed'>
                  我已阅读并同意
                  <button
                    type='button'
                    onClick={e => {
                      e.preventDefault();
                      navigate('/terms');
                    }}
                    className='text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:underline mx-1 font-medium cursor-pointer transition-colors duration-200 px-1 py-0.5 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20'>
                    服务条款
                  </button>
                  和
                  <button
                    type='button'
                    onClick={e => {
                      e.preventDefault();
                      navigate('/privacy');
                    }}
                    className='text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:underline mx-1 font-medium cursor-pointer transition-colors duration-200 px-1 py-0.5 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20'>
                    隐私政策
                  </button>
                </label>
              </div>

              {/* 注册按钮 */}
              <button
                type='submit'
                disabled={isLoading || !agreedToTerms}
                className='btn btn-primary w-full bg-gradient-to-r from-purple-500 via-purple-600 to-blue-600 dark:from-purple-600 dark:via-purple-700 dark:to-blue-700 text-white py-4 rounded-2xl font-semibold hover:from-purple-600 hover:via-purple-700 hover:to-blue-700 dark:hover:from-purple-700 dark:hover:via-purple-800 dark:hover:to-blue-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg shadow-purple-500/25 dark:shadow-purple-600/20 hover:shadow-xl hover:shadow-purple-500/30 dark:hover:shadow-purple-600/25 transform hover:scale-[1.02] active:scale-[0.98]'>
                {isLoading ? (
                  <>
                    <div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin' />
                    <span>注册中...</span>
                  </>
                ) : (
                  <span>创建账户</span>
                )}
              </button>
            </form>

            {/* 登录链接 */}
            <div className='text-center mt-8'>
              <span className='text-gray-600 dark:text-gray-400'>已有账户？</span>
              <Link
                to='/login'
                className='ml-2 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-semibold transition-colors duration-200 px-3 py-1 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20'>
                立即登录
              </Link>
            </div>
          </Card>

          {/* 底部说明 */}
          <div className='text-center mt-8 text-sm text-gray-500 dark:text-gray-400'>
            <p className='leading-relaxed'>🌸 开始记录你的情绪之旅</p>
            <p className='leading-relaxed'>让每一天都充满正能量</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
