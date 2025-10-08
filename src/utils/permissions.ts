import { Capacitor } from '@capacitor/core';
import { VoiceRecorder } from '@langx/capacitor-voice-recorder';

// 权限状态枚举
export enum PermissionStatus {
  GRANTED = 'granted',
  DENIED = 'denied',
  PROMPT = 'prompt'
}

// 检查麦克风权限状态
export async function checkMicrophonePermission(): Promise<PermissionStatus> {
  try {
    // 在原生平台，优先使用插件的权限查询，避免 WebView 的 Permissions API 误判
    if (Capacitor.isNativePlatform()) {
      try {
        const res = await VoiceRecorder.hasAudioRecordingPermission();
        return res?.value ? PermissionStatus.GRANTED : PermissionStatus.DENIED;
      } catch (_e) {
        // 某些设备/首次查询可能抛错，视为需要用户确认
        console.warn('检查麦克风权限时抛出异常，视为需要用户确认:', _e);
        return PermissionStatus.PROMPT;
      }
    }

    // Web 环境优先通过 Permissions API 检查
    if (typeof navigator !== 'undefined' && 'permissions' in navigator && isSecureContext()) {
      const status = await (
        navigator as Navigator & {
          permissions: { query: (descriptor: { name: string }) => Promise<{ state: PermissionState }> };
        }
      ).permissions.query({ name: 'microphone' });
      const state = (status as { state: PermissionState }).state;
      if (state === 'granted') return PermissionStatus.GRANTED;
      if (state === 'denied') return PermissionStatus.DENIED;
      return PermissionStatus.PROMPT;
    }
  } catch (e: unknown) {
    console.warn('检查麦克风权限失败，降级处理:', e);
  }

  // Fallback：仅在 Web 环境通过 getUserMedia 尝试获取权限状态（原生平台避免占用麦克风）
  try {
    if (!Capacitor.isNativePlatform() && isGetUserMediaSupported() && isSecureContext()) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return PermissionStatus.GRANTED;
    }
  } catch (error: unknown) {
    const name = (error as { name?: string }).name;
    if (name === 'NotAllowedError' || name === 'SecurityError') return PermissionStatus.DENIED;
    if (name === 'NotFoundError') return PermissionStatus.DENIED;
    // 其他错误无法明确区分权限状态
    return PermissionStatus.PROMPT;
  }

  return PermissionStatus.PROMPT;
}

// 以下函数已被下方的统一实现替代，保留作为内部辅助函数
// function isSecureContextWeb(): boolean {
//   try {
//     return typeof window !== 'undefined' && (window.isSecureContext ?? location.protocol === 'https:');
//   } catch (_e) {
//     return false;
//   }
// }

// function isGetUserMediaSupportedWeb(): boolean {
//   try {
//     return typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';
//   } catch (_e) {
//     return false;
//   }
// }

// async function ensureMicrophonePermissionSimple(): Promise<PermissionStatus> {
//   try {
//     const status = await checkMicrophonePermission();
//     if (status === PermissionStatus.GRANTED) return status;
//     return await requestMicrophonePermissionWeb();
//   } catch (e: unknown) {
//     console.warn('ensureMicrophonePermission(Web-only) 异常:', e);
//     return PermissionStatus.PROMPT;
//   }
// }

/* duplicate removed: use the consolidated requestMicrophonePermission below (native + web) */

/* duplicate removed: prefer consolidated isSecureContext declared later to include native checks */

/* duplicate removed: prefer consolidated isGetUserMediaSupported declared later */

/* duplicate removed: use ensureMicrophonePermission that returns {granted,status,message} */

/* duplicate removed: requestMicrophonePermissionWeb - use requestMicrophonePermission instead */

// 请求麦克风权限
export const requestMicrophonePermission = async (): Promise<PermissionStatus> => {
  try {
    if (Capacitor.isNativePlatform()) {
      try {
        const res = await VoiceRecorder.requestAudioRecordingPermission();
        return res?.value ? PermissionStatus.GRANTED : PermissionStatus.DENIED;
      } catch (e: unknown) {
        const msg = (e as { message?: string }).message;
        console.warn('[permissions] requestAudioRecordingPermission error:', msg || e);
        // 无法请求或查询时按 DENIED 返回，让上层提示更清晰
        return PermissionStatus.DENIED;
      }
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return PermissionStatus.GRANTED;
  } catch (error: unknown) {
    const name = (error as { name?: string }).name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return PermissionStatus.DENIED;
    }
    throw error;
  }
};

// 检查是否在安全上下文中
export const isSecureContext = (): boolean => {
  const proto = location.protocol;
  const host = location.hostname;
  return (
    Capacitor.isNativePlatform() ||
    (typeof window !== 'undefined' && window.isSecureContext) ||
    proto === 'https:' ||
    proto === 'capacitor:' ||
    host === 'localhost'
  );
};

// 检查是否支持 getUserMedia
export const isGetUserMediaSupported = (): boolean => {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
};

// 综合权限检查和请求
export const ensureMicrophonePermission = async (): Promise<{
  granted: boolean;
  status: PermissionStatus;
  message?: string;
}> => {
  try {
    if (!isSecureContext()) {
      return {
        granted: false,
        status: PermissionStatus.DENIED,
        message: '应用需要在安全上下文（HTTPS/Capacitor）中运行才能使用麦克风功能'
      };
    }

    // Web 环境能力检测（原生平台不依赖 getUserMedia）
    if (!Capacitor.isNativePlatform() && !isGetUserMediaSupported()) {
      return {
        granted: false,
        status: PermissionStatus.DENIED,
        message: '当前环境不支持麦克风功能'
      };
    }

    // 先查询当前状态（在原生平台走插件查询）
    const currentStatus = await checkMicrophonePermission();
    if (currentStatus === PermissionStatus.GRANTED) {
      // 原生平台额外检查设备是否支持录音
      if (Capacitor.isNativePlatform()) {
        try {
          const can = await VoiceRecorder.canDeviceVoiceRecord().catch(() => ({ value: undefined }));
          if (can?.value === false) {
            return {
              granted: false,
              status: PermissionStatus.GRANTED,
              message: '设备不支持录音或当前环境不支持'
            };
          }
        } catch (_e) {
          // 忽略能力查询异常
          console.warn('检查麦克风能力时抛出异常，视为设备不支持录音:', _e);
        }
      }
      return { granted: true, status: PermissionStatus.GRANTED };
    }

    // 当前未授权或无法查询时，尝试发起请求（原生平台走插件权限请求）
    const requestStatus = await requestMicrophonePermission();

    if (requestStatus === PermissionStatus.GRANTED) {
      // 二次校验，避免部分机型上请求后状态未刷新（原生平台使用插件校验）
      let verifyStatus: PermissionStatus = PermissionStatus.PROMPT;
      if (Capacitor.isNativePlatform()) {
        // 某些设备上授权对话框返回后权限状态需要一点时间刷新
        await new Promise(resolve => setTimeout(resolve, 300));
        try {
          const res = await VoiceRecorder.hasAudioRecordingPermission();
          verifyStatus = res?.value ? PermissionStatus.GRANTED : PermissionStatus.DENIED;
        } catch (_e) {
          console.warn('二次校验麦克风权限时抛出异常，视为权限状态刷新延迟:', _e);
          verifyStatus = PermissionStatus.PROMPT;
        }
      } else {
        verifyStatus = await checkMicrophonePermission();
      }

      if (verifyStatus === PermissionStatus.GRANTED) {
        return { granted: true, status: PermissionStatus.GRANTED };
      }
      return {
        granted: false,
        status: verifyStatus,
        message: '麦克风权限请求后仍未生效'
      };
    }

    return {
      granted: false,
      status: requestStatus,
      message:
        requestStatus === PermissionStatus.DENIED
          ? '麦克风权限被拒绝，请在系统设置中手动开启权限'
          : '麦克风权限需要用户确认，请允许应用访问麦克风'
    };
  } catch (error: unknown) {
    console.error('确保麦克风权限时出错:', error);
    return {
      granted: false,
      status: PermissionStatus.DENIED,
      message: '检查麦克风权限时发生错误'
    };
  }
};
