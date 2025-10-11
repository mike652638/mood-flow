/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    screens: {
      'xs': '475px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        // 奶白色系
        cream: {
          50: '#fefcf8',
          100: '#fdf9f0',
          200: '#fbf2e1',
          300: '#f7e8d0',
          400: '#f1d9b8',
          500: '#e8c79f',
          600: '#dab185',
          700: '#c89968',
          800: '#b07d4f',
          900: '#8f6240'
        },
        // 雾紫色系
        lavender: {
          50: '#f9f7ff',
          100: '#f3f0ff',
          200: '#e9e4ff',
          300: '#ddd4ff',
          400: '#cbb8ff',
          500: '#b599ff',
          600: '#9d7aff',
          700: '#8b5cf6',
          800: '#7c3aed',
          900: '#6d28d9'
        },
        // 淡蓝色系
        sky: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e'
        },
        // 温暖灰调
        'warm-gray': {
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917'
        },
        // 主题变量映射（暗色主题下复用 indigo 与灰阶）
        theme: {
          indigo: 'rgb(var(--theme-indigo-300) / <alpha-value>)',
          gray: {
            700: 'rgb(var(--theme-gray-700) / <alpha-value>)',
            800: 'rgb(var(--theme-gray-800) / <alpha-value>)',
            900: 'rgb(var(--theme-gray-900) / <alpha-value>)'
          }
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif']
      },
      boxShadow: {
        soft: '0 4px 20px rgba(139, 92, 246, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)',
        'soft-lg': '0 10px 40px rgba(139, 92, 246, 0.12), 0 4px 6px rgba(0, 0, 0, 0.05)',
        mood: '0 8px 25px rgba(139, 92, 246, 0.15)',
        'mood-selected': '0 8px 25px rgba(139, 92, 246, 0.2)',
        // 复用主题阴影透明度（用于卡片等场景）
        'theme-card': '0 0 0 1px rgba(0,0,0,var(--shadow-border)), 0 10px 20px rgba(0,0,0,var(--shadow-strong))'
      },
      backgroundImage: {
        'gradient-healing': 'linear-gradient(135deg, #fefcf8 0%, #f9f7ff 50%, #f0f9ff 100%)',
        'gradient-card': 'linear-gradient(145deg, rgba(255, 255, 255, 0.9) 0%, rgba(243, 240, 255, 0.7) 100%)',
        'gradient-primary': 'linear-gradient(135deg, #b599ff 0%, #0ea5e9 100%)',
        'gradient-mood': 'linear-gradient(135deg, #f9f7ff 0%, #f0f9ff 100%)'
      },
      backdropBlur: {
        xs: '2px'
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in',
        'slide-in': 'slideIn 0.3s ease-out',
        'bounce-soft': 'bounce 1s infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideIn: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' }
        }
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem'
      },
      spacing: {
        18: '4.5rem',
        88: '22rem'
      }
    }
  },
  plugins: [require('@tailwindcss/typography')]
};
