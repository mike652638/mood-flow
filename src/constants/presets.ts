export interface PresetGroup {
  label: string;
  icon: string; // 组图标（emoji 简洁可靠）
  accentClasses: { bg: string; text: string };
  items: string[];
}

export const chatPresetGroups: PresetGroup[] = [
  {
    label: '舒缓与放松',
    icon: '🌿',
    accentClasses: {
      bg: 'bg-teal-50 dark:bg-teal-900/20',
      text: 'text-teal-700 dark:text-teal-200'
    },
    items: ['我有些焦虑，能引导我放松吗？', '请引导我做一次3分钟呼吸练习']
  },
  {
    label: '认知重构',
    icon: '🧠',
    accentClasses: {
      bg: 'bg-indigo-50 dark:bg-indigo-900/20',
      text: 'text-indigo-700 dark:text-indigo-200'
    },
    items: ['帮我用认知重构看待今天的困扰', '我习惯性地负面思考，怎么办？']
  },
  {
    label: '睡眠与作息',
    icon: '🌙',
    accentClasses: {
      bg: 'bg-violet-50 dark:bg-violet-900/20',
      text: 'text-violet-700 dark:text-violet-200'
    },
    items: ['我最近入睡困难，有什么建议？', '我想改善入睡前的焦虑']
  },
  {
    label: '工作与压力',
    icon: '💼',
    accentClasses: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      text: 'text-amber-700 dark:text-amber-200'
    },
    items: ['我对工作感到压力大，如何缓解？', '我担心工作做不好，怎么办？']
  }
];
