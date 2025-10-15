import React from 'react';
import Header from '../components/Header';
import Container from '../components/Container';
import Card from '../components/Card';
import { useImmersiveMode } from '../hooks/useImmersiveMode';

const Terms = () => {
  const { immersiveMode } = useImmersiveMode();

  return (
    <>
      <Header title='服务条款' showBackButton={true} immersiveMode={immersiveMode} />
      <Container className={`${immersiveMode ? 'pt-safe-area-and-header-policy' : 'pt-policy-pages-fallback'}`}>
        <div className='mb-4 space-y-6 lg:space-y-8 pt-4 sm:pt-6'>
          {/* 内容 */}
          <Card variant='default' padding='lg'>
            <div className='prose prose-gray max-w-none'>
              <h2 className='text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4'>1. 服务说明</h2>
              <p className='text-gray-700 dark:text-gray-300 mb-6'>
                心流日记是一款帮助用户记录和管理情绪的应用程序。我们致力于为用户提供安全、私密的情绪记录和分析服务。
              </p>

              <h2 className='text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4'>2. 用户责任</h2>
              <ul className='text-gray-700 dark:text-gray-300 mb-6 space-y-2'>
                <li>• 用户应提供真实、准确的注册信息</li>
                <li>• 用户应妥善保管账户信息，不得与他人共享</li>
                <li>• 用户应合理使用服务，不得进行恶意操作</li>
                <li>• 用户对其发布的内容承担全部责任</li>
              </ul>

              <h2 className='text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4'>3. 隐私保护</h2>
              <p className='text-gray-700 dark:text-gray-300 mb-6'>
                我们高度重视用户隐私，所有情绪记录和个人信息都将严格保密。我们不会向第三方泄露用户的个人信息和情绪数据。
              </p>

              <h2 className='text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4'>4. 服务变更</h2>
              <p className='text-gray-700 dark:text-gray-300 mb-6'>
                我们保留随时修改或终止服务的权利。如有重大变更，我们将提前通知用户。
              </p>

              <h2 className='text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4'>5. 免责声明</h2>
              <p className='text-gray-700 dark:text-gray-300 mb-6'>
                本应用仅供情绪记录和自我管理使用，不能替代专业的心理咨询或医疗服务。如需专业帮助，请咨询相关专业人士。
              </p>

              <h2 className='text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4'>6. 联系我们</h2>
              <p className='text-gray-700 dark:text-gray-300'>如有任何问题或建议，请通过应用内反馈功能联系我们。</p>
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

export default Terms;
