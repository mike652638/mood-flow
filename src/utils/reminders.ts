import { Capacitor } from '@capacitor/core';

export interface QuietHoursConfig {
  enabled: boolean;
  start: string; // HH:mm
  end: string; // HH:mm
}

export interface ReminderOptions {
  title?: string;
  body?: string;
  quiet?: QuietHoursConfig;
}

const REMINDER_NOTIFICATION_ID = 1001;

export async function requestReminderPermission(): Promise<boolean> {
  try {
    if (!Capacitor.isNativePlatform()) return false;
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const res = await LocalNotifications.requestPermissions();
    return (res as { display?: 'granted' | 'denied' }).display === 'granted';
  } catch (e) {
    console.warn('请求通知权限失败：', e);
    return false;
  }
}

export async function cancelDailyReminder(): Promise<void> {
  try {
    if (!Capacitor.isNativePlatform()) return;
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: [{ id: REMINDER_NOTIFICATION_ID }] });
  } catch (e) {
    console.warn('取消每日提醒失败：', e);
  }
}

function parseHHmm(hhmm: string): { h: number; m: number } {
  const [hStr, mStr] = (hhmm || '21:00').split(':');
  const h = Math.max(0, Math.min(23, Number(hStr)));
  const m = Math.max(0, Math.min(59, Number(mStr)));
  return { h, m };
}

function isWithinQuiet(nowTime: { h: number; m: number }, quiet?: QuietHoursConfig): boolean {
  if (!quiet?.enabled) return false;
  const { h: qh, m: qm } = parseHHmm(quiet.start || '22:00');
  const { h: eh, m: em } = parseHHmm(quiet.end || '07:00');
  const toMinutes = (t: { h: number; m: number }) => t.h * 60 + t.m;
  const nowMin = toMinutes(nowTime);
  const startMin = toMinutes({ h: qh, m: qm });
  const endMin = toMinutes({ h: eh, m: em });
  if (startMin <= endMin) {
    // 同日静音窗口（例如 12:00-18:00）
    return nowMin >= startMin && nowMin < endMin;
  } else {
    // 跨夜静音窗口（例如 22:00-07:00）
    return nowMin >= startMin || nowMin < endMin;
  }
}

function computeNextFire(timeHHmm: string, quiet?: QuietHoursConfig): Date {
  const { h, m } = parseHHmm(timeHHmm);
  const now = new Date();
  const next = new Date(now);
  next.setHours(h, m, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);

  // 如果提醒时间处于静音窗口内，则移动到静音结束时间的下一次可触发点
  if (quiet?.enabled) {
    const proposed = { h, m };
    if (isWithinQuiet(proposed, quiet)) {
      const end = parseHHmm(quiet.end || '07:00');
      next.setHours(end.h, end.m, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
    }
  }

  return next;
}

export async function scheduleDailyReminder(timeHHmm: string, options?: ReminderOptions): Promise<void> {
  try {
    if (!Capacitor.isNativePlatform()) return;
    const { LocalNotifications } = await import('@capacitor/local-notifications');

    const granted = await requestReminderPermission();
    if (!granted) {
      console.warn('用户未授予通知权限，跳过每日提醒调度');
      return;
    }
    const next = computeNextFire(timeHHmm, options?.quiet);
    const { h: hour, m: minute } = parseHHmm(timeHHmm);

    await LocalNotifications.schedule({
      notifications: [
        {
          id: REMINDER_NOTIFICATION_ID,
          title: options?.title || '心流日记提醒',
          body: options?.body || '记录今天的心情与想法',
          smallIcon: 'ic_stat_name',
          schedule: {
            at: next,
            repeats: true,
            every: 'day'
          }
        }
      ]
    });
    console.info('每日提醒已调度：', { hour, minute, next, quiet: options?.quiet });
  } catch (e) {
    console.warn('调度每日提醒失败：', e);
  }
}

export async function rescheduleDailyReminder(
  enabled: boolean,
  timeHHmm: string,
  options?: ReminderOptions
): Promise<void> {
  try {
    if (!Capacitor.isNativePlatform()) return;
    await cancelDailyReminder();
    if (enabled) {
      await scheduleDailyReminder(timeHHmm, options);
    }
  } catch (e) {
    console.warn('重置每日提醒失败：', e);
  }
}