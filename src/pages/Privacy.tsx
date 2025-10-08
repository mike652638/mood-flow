import React from 'react';
import Header from '../components/Header';
import Container from '../components/Container';
import Card from '../components/Card';
import { useImmersiveMode } from '../hooks/useImmersiveMode';

const Privacy = () => {
  const { immersiveMode } = useImmersiveMode();

  return (
    <>
      <Header title='隐私政策' showBackButton={true} immersiveMode={immersiveMode} />
      <Container
        className={`${
          immersiveMode ? 'pt-safe-area-and-header' : 'pt-16 sm:pt-20 md:pt-24 lg:pt-24 xl:pt-24 2xl:pt-24'
        }`}>
        <div className='mb-4 space-y-6 lg:space-y-8 pt-4 sm:pt-6'>
          {/* 内容 */}
          <Card variant='default' padding='lg'>
            <div className='prose prose-gray max-w-none'>
              <h2 className='text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4'>1. 信息收集</h2>
              <p className='text-gray-700 dark:text-gray-300 mb-6'>我们收集的信息包括：</p>
              <ul className='text-gray-700 dark:text-gray-300 mb-6 space-y-2'>
                <li>• 注册信息：邮箱地址、用户名等基本信息</li>
                <li>• 情绪数据：您记录的情绪状态、日记内容等</li>
                <li>• 使用数据：应用使用统计、功能偏好等</li>
                <li>• 设备信息：设备类型、操作系统版本等技术信息</li>
              </ul>

              <h2 className='text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4'>2. 信息使用</h2>
              <p className='text-gray-700 dark:text-gray-300 mb-6'>我们使用收集的信息用于：</p>
              <ul className='text-gray-700 dark:text-gray-300 mb-6 space-y-2'>
                <li>• 提供和改进服务功能</li>
                <li>• 生成个性化的情绪分析和建议</li>
                <li>• 保障账户安全</li>
                <li>• 优化用户体验</li>
              </ul>

              <h2 className='text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4'>3. 信息保护</h2>
              <p className='text-gray-700 dark:text-gray-300 mb-6'>我们采取以下措施保护您的信息：</p>
              <ul className='text-gray-700 dark:text-gray-300 mb-6 space-y-2'>
                <li>• 数据加密存储和传输</li>
                <li>• 严格的访问控制机制</li>
                <li>• 定期安全审计和更新</li>
                <li>• 员工隐私培训和保密协议</li>
              </ul>

              <h2 className='text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4'>4. 信息共享</h2>
              <p className='text-gray-700 dark:text-gray-300 mb-6'>我们承诺：</p>
              <ul className='text-gray-700 dark:text-gray-300 mb-6 space-y-2'>
                <li>• 不会向第三方出售您的个人信息</li>
                <li>• 不会与第三方共享您的情绪数据</li>
                <li>• 仅在法律要求或紧急情况下才会披露信息</li>
                <li>• 如需共享匿名统计数据，会事先征得同意</li>
              </ul>

              <h2 className='text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4'>5. 用户权利</h2>
              <p className='text-gray-700 dark:text-gray-300 mb-6'>您有权：</p>
              <ul className='text-gray-700 dark:text-gray-300 mb-6 space-y-2'>
                <li>• 查看和修改个人信息</li>
                <li>• 导出您的数据</li>
                <li>• 删除账户和相关数据</li>
                <li>• 撤回数据使用同意</li>
              </ul>

              <h2 className='text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4'>6. Cookie使用</h2>
              <p className='text-gray-700 dark:text-gray-300 mb-6'>
                我们使用Cookie来改善用户体验，包括记住登录状态、个性化设置等。您可以通过浏览器设置管理Cookie。
              </p>

              <h2 className='text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4'>7. 政策更新</h2>
              <p className='text-gray-700 dark:text-gray-300 mb-6'>
                我们可能会不时更新本隐私政策。重大变更时，我们会通过应用内通知或邮件方式告知您。
              </p>

              <h2 className='text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4'>8. 联系我们</h2>
              <p className='text-gray-700 dark:text-gray-300'>如对隐私政策有任何疑问，请通过应用内反馈功能联系我们。</p>
            </div>

            <div className='mt-8 pt-6 border-t border-gray-200 dark:border-theme-gray-600'>
              <p className='text-sm text-gray-500 dark:text-gray-400 text-center'>最后更新时间：2025年9月</p>
            </div>
          </Card>
        </div>
      </Container>
    </>
  );
};

export default Privacy;
