export type MoodType = 'happy' | 'excited' | 'moved' | 'fulfilled' | 'confident' | 'calm' | 'sad' | 'angry' | 'anxious' | 'stressed' | 'panic' | 'depressed';

export interface MoodEntry {
  id: string;
  mood: MoodType;
  note: string;
  date: string;
  timestamp: number;
}

export interface MoodOption {
  value: MoodType;
  label: string;
  emoji: string;
  color: string;
}