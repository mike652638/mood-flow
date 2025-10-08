import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import react from 'eslint-plugin-react';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'android/**'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'react': react,
      'jsx-a11y': jsxA11y
    },
    settings: {
      react: {
        version: 'detect'
      }
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // 允许必要的内联样式，特别是动态样式
      'react/forbid-dom-props': ['error', {
        forbid: []
      }],
      // 关闭内联样式警告，因为我们需要动态样式
      'react/no-unknown-property': ['error', { 
        ignore: ['style'] 
      }],
      // 关闭jsx-a11y中可能的内联样式相关规则
      'jsx-a11y/no-inline-styles': 'off',
      // TypeScript 常见规则优化：减少无关紧要警告
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // React + TS 项目无需 PropTypes
      'react/prop-types': 'off',
      // 允许某些组件缺少 displayName（TSX 中不必要）
      'react/display-name': 'off',
      // 控制台输出允许 warn/error，其他级别警告
      'no-console': ['warn', { allow: ['warn', 'error', 'info', 'log'] }],
      // 外链安全性提示保留为警告，避免误报
      'react/jsx-no-target-blank': ['warn', { enforceDynamicLinks: 'never' }],
      // 调试器调用提示为警告
      'no-debugger': 'warn'
    }
  },
  // 针对 contexts 目录的覆盖：关闭 react-refresh 组件导出限制，避免误报
  {
    files: ['src/contexts/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off'
    }
  }
);
