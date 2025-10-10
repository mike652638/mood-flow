import React, { useState, useRef } from 'react';
import { Camera, Mic, Plus, X, Play, Pause, Trash2, Save } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import Card from '../components/Card';
import Container from '../components/Container';
import Header from '../components/Header';

import { useImmersiveMode } from '../hooks/useImmersiveMode';
import { MOOD_OPTIONS } from '../constants/moods';
import type { MoodType } from '../types';
import { useMoodStore, useAuthStore } from '../store';

const Record = () => {
  const { immersiveMode } = useImmersiveMode();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const addRecord = useMoodStore(state => state.addRecord);
  const user = useAuthStore(state => state.user);
  const [selectedMood, setSelectedMood] = useState<string>('');
  const [intensity, setIntensity] = useState(5);
  const [diaryContent, setDiaryContent] = useState('');
  // 结构化情绪细节（可选）
  const [triggerEvent, setTriggerEvent] = useState('');
  const [thoughts, setThoughts] = useState('');
  const [bodyResponse, setBodyResponse] = useState('');
  const [coping, setCoping] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [audioRecordings, setAudioRecordings] = useState<{ file: Blob; url: string; duration: number }[]>([]);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingAudio, setPlayingAudio] = useState<number | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ mood: boolean; diary: boolean }>({
    mood: false,
    diary: false
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const takePhotoBtnRef = useRef<HTMLButtonElement>(null);
  const [showPhotoCTA, setShowPhotoCTA] = useState(false);
  const [highlightPhotoBtn, setHighlightPhotoBtn] = useState(false);

  const ensureScrollToMedia = () => {
    const el =
      (document.querySelector('[data-section="media"]') as HTMLElement | null) ||
      (document.getElementById('media') as HTMLElement | null);
    if (!el) return;

    const getScrollableAncestor = (node: HTMLElement | null): HTMLElement | null => {
      let cur: HTMLElement | null = node?.parentElement ?? null;
      while (cur && cur !== document.body && cur !== document.documentElement) {
        const style = window.getComputedStyle(cur);
        const canScrollY = /(auto|scroll|overlay)/.test(style.overflowY);
        const hasScroll = cur.scrollHeight > cur.clientHeight + 2;
        if (canScrollY && hasScroll) return cur;
        cur = cur.parentElement;
      }
      return null;
    };

    const header = document.querySelector('header') as HTMLElement | null;
    const headerH = header ? header.getBoundingClientRect().height : 64;
    // 计算固定底部导航高度，避免遮挡
    const fixedNavH = (() => {
      const navs = Array.from(document.querySelectorAll('nav')) as HTMLElement[];
      for (const n of navs) {
        const style = window.getComputedStyle(n);
        if (style.position === 'fixed') {
          return n.getBoundingClientRect().height;
        }
      }
      return 0;
    })();

    const viewportH = window.innerHeight || document.documentElement.clientHeight;

    const isVisible = () => {
      const r = el.getBoundingClientRect();
      const topOK = r.top >= headerH + 4; // 顶部不被 Header 遮挡
      const bottomOK = r.bottom <= viewportH - fixedNavH - 4; // 底部不被底部导航遮挡
      return topOK && bottomOK;
    };

    // 利用 scroll-margin-top 让 block:'start' 时避开固定头部
    try {
      el.style.scrollMarginTop = `${headerH + 8}px`;
    } catch (error) {
      // 忽略样式设置错误，不影响核心功能
      console.error('Failed to set scroll margin:', error);
    }

    const container = getScrollableAncestor(el);
    const main = document.querySelector('main') as HTMLElement | null;
    const scrollRoot =
      (document.scrollingElement as HTMLElement | null) || (document.documentElement as HTMLElement | null);

    const candidates: Array<HTMLElement | 'window' | null> = [
      container,
      main,
      scrollRoot,
      document.documentElement as HTMLElement,
      document.body as HTMLElement,
      'window'
    ];

    const getScrollTop = (c: HTMLElement | 'window' | null) => {
      if (c === 'window' || !c) return window.scrollY || (document.scrollingElement?.scrollTop ?? 0);
      return c.scrollTop;
    };

    const scrollIn = (c: HTMLElement | 'window' | null, smooth: boolean) => {
      const rect = el.getBoundingClientRect();
      if (c === 'window' || !c) {
        const scrollTop = document.scrollingElement?.scrollTop ?? window.scrollY ?? document.body.scrollTop ?? 0;
        const targetTop = rect.top + scrollTop - Math.max(0, headerH - 8);
        try {
          window.scrollTo({ top: targetTop, behavior: smooth ? 'smooth' : 'auto' });
        } catch (error) {
          console.error('Failed to scroll window:', error);
        }
        try {
          (document.documentElement as Element & { scrollTo?: (options: ScrollToOptions) => void }).scrollTo?.({
            top: targetTop,
            behavior: smooth ? 'smooth' : 'auto'
          });
        } catch (error) {
          console.error('Failed to scroll document element:', error);
        }
        try {
          document.body.scrollTo?.({ top: targetTop, behavior: smooth ? 'smooth' : 'auto' });
        } catch (error) {
          console.error('Failed to scroll body:', error);
        }
        return;
      }
      const cRect = c.getBoundingClientRect();
      const current = c.scrollTop;
      const targetTop = rect.top - cRect.top + current - Math.max(0, headerH - 8);
      try {
        c.scrollTo({ top: targetTop, behavior: smooth ? 'smooth' : 'auto' });
      } catch {
        c.scrollTop = targetTop;
      }
    };

    // 先尝试浏览器内置滚动
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      console.error('Failed to scroll into view:', error);
    }

    let tries = 0;
    const maxTries = 8;
    const attempt = () => {
      if (isVisible()) return;
      // 逐个候选滚动根尝试，直到检测到 scrollTop 发生变化或可见
      for (const c of candidates) {
        const before = getScrollTop(c);
        scrollIn(c, true);
        // 下一帧检测变化
        try {
          requestAnimationFrame(() => {
            const after = getScrollTop(c);
            if (isVisible() || Math.abs((after ?? 0) - (before ?? 0)) > 1) {
              // 若已可见或滚动根发生位移，则停止当前轮次，等待下一次可见检测
              // 不直接 return，交由最外层 isVisible 判定
            }
          });
        } catch (error) {
          console.error('Failed to scroll in container:', error);
        }
      }

      tries++;
      if (!isVisible() && tries < maxTries) {
        setTimeout(attempt, 140);
      } else if (!isVisible()) {
        // 最后兜底：非 smooth 再尝试一次，并使用 hash 锚点滚动兜底
        for (const c of candidates) {
          scrollIn(c, false);
        }
        // 使用锚点兜底（需要元素具备 id="media"）
        try {
          const originalHash = window.location.hash;
          if (originalHash !== '#media') {
            window.location.hash = 'media';
          }
        } catch (error) {
          console.error('Failed to set hash anchor:', error);
        }
      }
    };

    requestAnimationFrame(attempt);
  };

  React.useEffect(() => {
    const quick = (searchParams.get('quick') || '').toLowerCase();
    if (!quick) return;

    // 每次 quick 改变都滚动到媒体区域
    ensureScrollToMedia();

    if (quick === 'photo') {
      if (Capacitor.isNativePlatform()) {
        setTimeout(async () => {
          await handleTakePhoto();
          navigate('/record', { replace: true });
        }, 120);
      } else {
        // Web 环境：展示 CTA 引导用户点击以开启相机
        setShowPhotoCTA(true);
        setHighlightPhotoBtn(true);
        setTimeout(() => setHighlightPhotoBtn(false), 1600);
        // 延长 URL 清理时间，避免滚动被重置
        setTimeout(() => navigate('/record', { replace: true }), 800);
      }
    } else if (quick === 'audio') {
      setTimeout(async () => {
        if (!isRecording) {
          await startRecording();
        }
        // 再次滚动，确保录音控件可见
        ensureScrollToMedia();
        // 延长 URL 清理时间，避免滚动被重置
        setTimeout(() => navigate('/record', { replace: true }), 800);
      }, 120);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // 获取情绪强度标签
  const getIntensityLabel = (intensity: number) => {
    if (intensity <= 2) return '轻微';
    if (intensity <= 4) return '较轻';
    if (intensity <= 6) return '中等';
    if (intensity <= 8) return '较强';
    return '强烈';
  };

  // 预设标签
  const availableTags = ['工作', '学习', '运动', '休息', '家庭', '朋友', '健康', '旅行', '爱好', '其他'];

  // 统一显示验证错误的 Toast，支持换行与列表样式
  const showValidationErrors = (errs: string[]) => {
    if (!errs || errs.length === 0) return;
    if (errs.length === 1) {
      toast.error(errs[0]);
      return;
    }
    toast.error(
      <div className='text-left'>
        <p className='font-medium mb-1'>请完成以下必填项：</p>
        <ul className='list-disc list-inside space-y-1'>
          {errs.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      </div>,
      { duration: 4000 }
    );
  };

  // 处理disabled按钮点击
  const handleDisabledButtonClick = () => {
    const errors = [];
    const newValidationErrors = { mood: false, diary: false };

    if (!selectedMood) {
      errors.push('请先选择今天的心情');
      newValidationErrors.mood = true;
    }

    if (!diaryContent.trim()) {
      errors.push('请填写详细描述');
      newValidationErrors.diary = true;
    } else if (diaryContent.trim().length < 10) {
      errors.push('详细描述至少需要10个字符');
      newValidationErrors.diary = true;
    }

    // 更新验证错误状态
    setValidationErrors(newValidationErrors);

    // 显示友好提示
    if (errors.length > 0) {
      showValidationErrors(errors);

      // 滚动到第一个未完成的必填项
      if (!selectedMood) {
        document.querySelector('[data-section="mood"]')?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      } else if (!diaryContent.trim() || diaryContent.trim().length < 10) {
        document.querySelector('[data-section="diary"]')?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  };

  const handleSave = async () => {
    // 表单验证
    const errors = [];
    const newValidationErrors = { mood: false, diary: false };

    if (!selectedMood) {
      errors.push('请先选择今天的心情');
      newValidationErrors.mood = true;
    }

    if (!diaryContent.trim()) {
      errors.push('请填写详细描述');
      newValidationErrors.diary = true;
    } else if (diaryContent.trim().length < 10) {
      errors.push('详细描述至少需要10个字符');
      newValidationErrors.diary = true;
    }

    // 更新验证错误状态
    setValidationErrors(newValidationErrors);

    // 如果有验证错误，显示友好提示
    if (errors.length > 0) {
      showValidationErrors(errors);

      // 滚动到第一个未完成的必填项
      if (!selectedMood) {
        document.querySelector('[data-section="mood"]')?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      } else if (!diaryContent.trim() || diaryContent.trim().length < 10) {
        document.querySelector('[data-section="diary"]')?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }

      return;
    }

    // 清除验证错误状态
    setValidationErrors({ mood: false, diary: false });

    // 合并可选的情绪日记细节到日记正文
    const composedDiary = [
      `今天发生了什么：\n${diaryContent.trim()}`,
      triggerEvent.trim() && `触发事件：\n${triggerEvent.trim()}`,
      thoughts.trim() && `当时想法：\n${thoughts.trim()}`,
      bodyResponse.trim() && `身体反应：\n${bodyResponse.trim()}`,
      coping.trim() && `应对方式：\n${coping.trim()}`
    ]
      .filter(Boolean)
      .join('\n\n');

    setDiaryContent(composedDiary);

    setIsLoading(true);
    try {
      // 模拟保存过程
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 保存到本地 store（含新字段）
      addRecord({
        user_id: user?.id || 'sample-user',
        mood_type: (selectedMood as MoodType) || 'calm',
        mood_intensity: intensity,
        diary_content: composedDiary,
        tags,
        trigger_event: triggerEvent || undefined,
        thoughts: thoughts || undefined,
        body_response: bodyResponse || undefined,
        coping: coping || undefined
      });

      // 清理媒体文件的URL对象
      photos.forEach(photo => {
        if (photo instanceof File) {
          URL.revokeObjectURL(URL.createObjectURL(photo));
        }
      });
      audioRecordings.forEach(recording => {
        URL.revokeObjectURL(recording.url);
      });

      toast.success('记录保存成功！');
      navigate('/home');
    } catch {
      toast.error('保存失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 组件卸载时清理资源
  React.useEffect(() => {
    return () => {
      // 清理录音计时器
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      // 清理媒体URL
      audioRecordings.forEach(recording => {
        URL.revokeObjectURL(recording.url);
      });
    };
  }, [audioRecordings]);

  const toggleTag = (tag: string) => {
    if (tags.includes(tag)) {
      setTags(tags.filter(t => t !== tag));
    } else {
      setTags([...tags, tag]);
    }
  };

  const addCustomTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  // 处理照片上传
  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newPhotos = Array.from(files).filter(file => file.type.startsWith('image/'));
      setPhotos(prev => [...prev, ...newPhotos]);
      toast.success(`已添加 ${newPhotos.length} 张照片`);
    }
  };

  // 处理拍照功能
  const handleTakePhoto = async () => {
    try {
      // 检查是否在原生环境中运行
      if (Capacitor.isNativePlatform()) {
        // 原生环境：使用 Capacitor Camera
        const image = await CapacitorCamera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera
        });

        if (image.dataUrl) {
          // 将DataUrl转换为File对象
          const response = await fetch(image.dataUrl);
          const blob = await response.blob();
          const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });

          setPhotos(prev => [...prev, file]);
          toast.success('照片拍摄成功');
        }
      } else {
        // Web 环境：触发文件输入框（相机模式）
        if (cameraInputRef.current) {
          cameraInputRef.current.click();
        }
      }
    } catch (error) {
      console.error('拍照失败:', error);
      // 在 Web 环境下，如果 PWA Elements 不可用，降级到文件选择
      if (!Capacitor.isNativePlatform()) {
        toast.error('相机功能不可用，请使用"添加照片"功能');
        if (fileInputRef.current) {
          fileInputRef.current.click();
        }
      } else {
        toast.error('拍照失败，请检查相机权限设置');
      }
    }
  };

  const handleCameraCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files[0]) {
      setPhotos(prev => [...prev, files[0]]);
      toast.success('照片拍摄成功');
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    toast.success('照片已删除');
  };

  // 处理录音功能
  const startRecording = async () => {
    try {
      const { ensureMicrophonePermission } = await import('../utils/permissions');
      const permissionResult = await ensureMicrophonePermission();
      if (!permissionResult.granted) {
        toast.error(permissionResult.message || '麦克风权限被拒绝');
        return;
      }

      // 原生平台使用插件录音，Web 使用 MediaRecorder
      if (Capacitor.isNativePlatform()) {
        const { VoiceRecorder } = await import('@langx/capacitor-voice-recorder');
        try {
          const perm = await VoiceRecorder.hasAudioRecordingPermission().catch(() => ({ value: undefined }));
          const can = await VoiceRecorder.canDeviceVoiceRecord().catch(() => ({ value: undefined }));
          console.info(
            '[VoiceRecorder] hasAudioRecordingPermission:',
            perm?.value,
            'canDeviceVoiceRecord:',
            can?.value
          );
          const res = await VoiceRecorder.startRecording();
          console.info('[VoiceRecorder] startRecording result:', res?.value);
        } catch (err: unknown) {
          console.error('开始录音失败(原生):', err);
          const code: string =
            (err as { code?: string; message?: string })?.code ||
            (err as { code?: string; message?: string })?.message ||
            '';
          if (code === 'MISSING_PERMISSION') {
            // 自动请求权限并重试
            try {
              const req = await VoiceRecorder.requestAudioRecordingPermission();
              console.info('[VoiceRecorder] requestAudioRecordingPermission:', req?.value);
              if (req?.value) {
                const res2 = await VoiceRecorder.startRecording();
                console.info('[VoiceRecorder] startRecording after request:', res2?.value);
              } else {
                toast.error('麦克风权限被拒绝，请在系统设置中开启后重试');
                return;
              }
            } catch (e2: unknown) {
              const code2: string =
                (e2 as { code?: string; message?: string })?.code ||
                (e2 as { code?: string; message?: string })?.message ||
                '';
              console.error('二次尝试开始录音失败:', e2);
              let msg2 = '录音失败';
              if (code2 === 'MICROPHONE_BEING_USED') msg2 = '麦克风被其他应用占用，请关闭其他使用麦克风的应用后重试';
              toast.error(msg2);
              return;
            }
          } else {
            let msg = '录音失败';
            if (code === 'MICROPHONE_BEING_USED') {
              msg = '麦克风被其他应用占用，请关闭其他使用麦克风的应用后重试';
            } else if (code === 'DEVICE_CANNOT_VOICE_RECORD') {
              msg = '设备不支持录音或当前环境不支持';
            }
            toast.error(msg);
            return;
          }
        }
        setIsRecording(true);
        setRecordingTime(0);
        if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
        toast.success('开始录音');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = event => {
        chunks.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const duration = recordingTime;
        setAudioRecordings(prev => [...prev, { file: blob, url, duration }]);
        stopRecording();
      };
      mediaRecorder.stream.getTracks().forEach(track => {
        track.onended = () => {};
      });
      setIsRecording(true);
      setRecordingTime(0);
      mediaRecorder.start();
      setMediaRecorder(mediaRecorder);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
      toast.success('开始录音');
    } catch (error: unknown) {
      console.error('开始录音失败:', error);
      let errorMessage = '录音失败';
      const name = (error as { name?: string }).name;
      if (name === 'NotAllowedError') {
        errorMessage = '麦克风权限被拒绝，请在系统设置中开启权限后重试';
      } else if (name === 'NotFoundError') {
        errorMessage = '未找到麦克风设备';
      } else if (name === 'NotReadableError') {
        errorMessage = '麦克风设备被其他应用占用';
      }
      toast.error(errorMessage);
    }
  };

  const stopRecording = async () => {
    // 原生平台停止插件录音并保存
    if (Capacitor.isNativePlatform() && isRecording) {
      const { VoiceRecorder } = await import('@langx/capacitor-voice-recorder');
      try {
        const result: unknown = await VoiceRecorder.stopRecording();
        const value = (result as { value?: unknown })?.value || result; // 兼容不同返回结构
        const durationMs: number = (value as { msDuration?: number })?.msDuration ?? recordingTime * 1000;
        const mimeType: string = (value as { mimeType?: string })?.mimeType || 'audio/mpeg';
        let url = '';
        let file: Blob = new Blob([], { type: mimeType });
        if ((value as { recordDataBase64?: string })?.recordDataBase64) {
          const base64 = (value as { recordDataBase64: string }).recordDataBase64;
          const byteChars = atob(base64);
          const byteNumbers = new Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
          const byteArray = new Uint8Array(byteNumbers);
          file = new Blob([byteArray], { type: mimeType });
          url = URL.createObjectURL(file);
        } else if ((value as { path?: string })?.path) {
          url = Capacitor.convertFileSrc((value as { path: string }).path);
        }
        const duration = Math.round(durationMs / 1000);
        setAudioRecordings(prev => [...prev, { file, url, duration }]);
      } catch (e) {
        console.error('停止录音失败:', e);
        toast.error('停止录音失败');
      } finally {
        setIsRecording(false);
        setMediaRecorder(null);
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }
      }
      return;
    }

    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const playAudio = (index: number) => {
    if (audioRef.current) {
      if (playingAudio === index) {
        audioRef.current.pause();
        setPlayingAudio(null);
      } else {
        audioRef.current.src = audioRecordings[index].url;
        audioRef.current.play();
        setPlayingAudio(index);
        audioRef.current.onended = () => setPlayingAudio(null);
      }
    }
  };

  const removeAudio = (index: number) => {
    URL.revokeObjectURL(audioRecordings[index].url);
    setAudioRecordings(prev => prev.filter((_, i) => i !== index));
    if (playingAudio === index) {
      setPlayingAudio(null);
    }
    toast.success('录音已删除');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <Header title='记录心情' showBackButton onBack={() => navigate(-1)} immersiveMode={immersiveMode} />
      <Container spacing='normal'>
        <div className='page-sections'>
          {/* 情绪选择 */}
          <Card
            variant='default'
            padding='md'
            data-section='mood'
            className={validationErrors.mood ? 'ring-2 ring-red-500 border-red-500' : ''}>
            <h3
              className={`text-xl lg:text-2xl xl:text-3xl font-semibold mb-6 lg:mb-8 ${
                validationErrors.mood ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-white'
              }`}>
              今天的心情如何？ <span className='text-red-500'>*</span>
            </h3>
            {validationErrors.mood && <p className='text-red-500 text-sm mb-4'>请先选择今天的心情</p>}
            <div className='grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-4 lg:gap-6 xl:gap-8'>
              {MOOD_OPTIONS.map(mood => (
                <button
                  key={mood.type}
                  onClick={() => {
                    setSelectedMood(mood.type);
                    // 清除情绪选择的验证错误
                    if (validationErrors.mood) {
                      setValidationErrors(prev => ({ ...prev, mood: false }));
                    }
                  }}
                  aria-label={`选择情绪: ${mood.label}`}
                  className={`p-4 lg:p-6 xl:p-8 rounded-lg lg:rounded-xl xl:rounded-2xl border-2 transition-all duration-200 hover:scale-105 ${
                    selectedMood === mood.type
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-lg'
                      : validationErrors.mood
                      ? 'border-red-300 bg-red-50 dark:bg-red-900/20 hover:border-red-400'
                      : 'border-gray-200 dark:border-theme-gray-700 hover:border-purple-300 dark:hover:border-purple-600'
                  }`}>
                  <div className='text-3xl lg:text-4xl xl:text-5xl mb-2 lg:mb-3'>{mood.emoji}</div>
                  <div className='text-sm lg:text-base xl:text-lg font-medium text-gray-700 dark:text-gray-300'>
                    {mood.label}
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* 情绪强度 */}
          {selectedMood && (
            <Card variant='default' padding='md' className='mt-8 lg:mt-10 xl:mt-12'>
              <h3 className='text-xl lg:text-2xl xl:text-3xl font-semibold mb-6 lg:mb-8 text-gray-800 dark:text-white'>
                情绪强度：{getIntensityLabel(intensity)}
              </h3>
              <div className='space-y-6 lg:space-y-8'>
                <div className='flex justify-between text-base lg:text-lg xl:text-xl text-gray-600 dark:text-gray-300'>
                  <span>轻微</span>
                  <span className='font-semibold text-purple-600 dark:text-purple-400'>{intensity}/10</span>
                  <span>强烈</span>
                </div>
                <input
                  type='range'
                  min='1'
                  max='10'
                  value={intensity}
                  onChange={e => setIntensity(Number(e.target.value))}
                  aria-label='情绪强度滑块，范围1到10'
                  className='w-full h-3 lg:h-4 xl:h-5 bg-gray-200 dark:bg-theme-gray-700 rounded-lg appearance-none cursor-pointer slider'
                />
                <div className='flex justify-between text-xs text-gray-500 dark:text-gray-400'>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                    <span
                      key={num}
                      className={intensity === num ? 'text-purple-600 dark:text-purple-400 font-semibold' : ''}>
                      {num}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* 日记内容 */}
          <Card variant='default' padding='md' className='p-6 lg:p-8 xl:p-10' data-section='diary'>
            <h3
              className={`text-lg sm:text-xl lg:text-2xl xl:text-3xl font-semibold mb-4 sm:mb-6 lg:mb-8 ${
                validationErrors.diary ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-white'
              }`}>
              今天发生了什么？ <span className='text-red-500'>*</span>
            </h3>
            <textarea
              value={diaryContent}
              onChange={e => setDiaryContent(e.target.value)}
              placeholder='分享你的想法和感受...'
              rows={3}
              className={`form-input w-full px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-6 border rounded-lg lg:rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-theme-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 resize-none text-sm sm:text-base lg:text-lg leading-relaxed ${
                validationErrors.diary
                  ? 'border-red-500 dark:border-red-500'
                  : 'border-gray-300 dark:border-theme-gray-600'
              }`}
            />
            {validationErrors.diary && (
              <p className='text-red-500 text-sm mt-2'>
                {!diaryContent.trim() ? '请填写详细描述' : '详细描述至少需要10个字符'}
              </p>
            )}
          </Card>

          {/* 情绪细节（可选） */}
          <Card variant='default' padding='md' className='p-6 lg:p-8 xl:p-10'>
            <h3 className='text-lg sm:text-xl lg:text-2xl xl:text-3xl font-semibold mb-4 sm:mb-6 lg:mb-8 text-gray-800 dark:text-white'>
              情绪细节（可选）
            </h3>
            <div className='space-y-6'>
              <div>
                <div className='flex items-center justify-between mb-2'>
                  <label className='block text-sm font-semibold text-gray-800 dark:text-gray-200'>触发事件</label>
                  {triggerEvent.length > 0 && (
                    <span className='text-xs text-gray-500 dark:text-gray-400'>已输入 {triggerEvent.length} 字</span>
                  )}
                </div>
                <textarea
                  value={triggerEvent}
                  onChange={e => setTriggerEvent(e.target.value)}
                  placeholder='例如：与同事产生分歧、项目延期、临近考试等'
                  rows={2}
                  className='form-input w-full p-3 rounded-xl border border-gray-200 dark:border-theme-gray-700 bg-white/80 dark:bg-theme-gray-800/80 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600'
                />
              </div>

              <div>
                <div className='flex items-center justify-between mb-2'>
                  <label className='block text-sm font-semibold text-gray-800 dark:text-gray-200'>当时想法</label>
                  {thoughts.length > 0 && (
                    <span className='text-xs text-gray-500 dark:text-gray-400'>已输入 {thoughts.length} 字</span>
                  )}
                </div>
                <textarea
                  value={thoughts}
                  onChange={e => setThoughts(e.target.value)}
                  placeholder='例如：怕自己做不好、觉得对方不尊重我、担心会失败'
                  rows={2}
                  className='form-input w-full p-3 rounded-xl border border-gray-200 dark:border-theme-gray-700 bg-white/80 dark:bg-theme-gray-800/80 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600'
                />
              </div>

              <div>
                <div className='flex items-center justify-between mb-2'>
                  <label className='block text-sm font-semibold text-gray-800 dark:text-gray-200'>身体反应</label>
                  {bodyResponse.length > 0 && (
                    <span className='text-xs text-gray-500 dark:text-gray-400'>已输入 {bodyResponse.length} 字</span>
                  )}
                </div>
                <textarea
                  value={bodyResponse}
                  onChange={e => setBodyResponse(e.target.value)}
                  placeholder='例如：心跳加速、胃部紧绷、肩颈发硬、出汗'
                  rows={2}
                  className='form-input w-full p-3 rounded-xl border border-gray-200 dark:border-theme-gray-700 bg-white/80 dark:bg-theme-gray-800/80 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600'
                />
              </div>

              <div>
                <div className='flex items-center justify-between mb-2'>
                  <label className='block text-sm font-semibold text-gray-800 dark:text-gray-200'>应对方式</label>
                  {coping.length > 0 && (
                    <span className='text-xs text-gray-500 dark:text-gray-400'>已输入 {coping.length} 字</span>
                  )}
                </div>
                <textarea
                  value={coping}
                  onChange={e => setCoping(e.target.value)}
                  placeholder='例如：做3分钟呼吸、与朋友交流、列出行动计划、暂停一下'
                  rows={2}
                  className='form-input w-full p-3 rounded-xl border border-gray-200 dark:border-theme-gray-700 bg-white/80 dark:bg-theme-gray-800/80 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600'
                />
              </div>
            </div>
          </Card>

          {/* 标签 */}
          <Card variant='default' padding='md' className='mt-6 sm:mt-8 lg:mt-10 xl:mt-12'>
            <h3 className='text-lg sm:text-xl lg:text-2xl xl:text-3xl font-semibold mb-4 sm:mb-6 lg:mb-8 text-gray-800 dark:text-white'>
              添加标签（可选）
            </h3>
            <div className='space-y-4 sm:space-y-6 lg:space-y-8'>
              <div className='flex flex-wrap gap-2 sm:gap-3 lg:gap-4'>
                {availableTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    aria-label={`切换标签: ${tag}`}
                    className={`px-3 sm:px-4 lg:px-6 py-2 lg:py-3 rounded-full text-sm sm:text-base lg:text-lg font-medium transition-all duration-200 ${
                      tags.includes(tag)
                        ? 'bg-purple-500 text-white shadow-md'
                        : 'bg-gray-100 dark:bg-theme-gray-700 text-gray-700 dark:text-gray-300 hover:bg-purple-100 dark:hover:bg-purple-900/30'
                    }`}>
                    {tag}
                  </button>
                ))}
              </div>

              {/* 自定义标签输入 */}
              <div className='grid grid-cols-[1fr_auto] items-stretch gap-2 sm:gap-3 lg:gap-4'>
                <input
                  type='text'
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && addCustomTag()}
                  placeholder='添加自定义标签'
                  className='form-input w-full min-w-0 px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-sm sm:text-base lg:text-lg border border-gray-200 dark:border-theme-gray-600 rounded-lg lg:rounded-xl bg-white dark:bg-theme-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent'
                />
                <button
                  onClick={addCustomTag}
                  aria-label='添加自定义标签'
                  className='btn btn-primary flex-shrink-0 px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 bg-purple-500 text-white rounded-lg lg:rounded-xl hover:bg-purple-600 transition-colors duration-200 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm lg:text-lg leading-none whitespace-nowrap min-w-[88px] sm:min-w-[96px] max-w-[45%] sm:max-w-none overflow-hidden'>
                  <Plus size={20} strokeWidth={2.25} className='w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 shrink-0' />
                  <span>添加</span>
                </button>
              </div>

              {/* 已选择的标签 */}
              {tags.length > 0 && (
                <div className='space-y-2'>
                  <p className='text-sm font-medium text-gray-600 dark:text-gray-300'>已选择的标签：</p>
                  <div className='flex flex-wrap gap-2'>
                    {tags.map(tag => (
                      <span
                        key={tag}
                        className='inline-flex items-center px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium'>
                        {tag}
                        <button
                          onClick={() => removeTag(tag)}
                          aria-label={`移除标签: ${tag}`}
                          className='ml-2 text-purple-500 hover:text-purple-700 transition-colors'>
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* 媒体上传 */}
          <Card variant='default' padding='md' className='mt-8 lg:mt-10 xl:mt-12' data-section='media' id='media'>
            <h3 className='text-xl lg:text-2xl xl:text-3xl font-semibold mb-6 lg:mb-8 text-gray-800 dark:text-white'>
              添加照片或语音（可选）
            </h3>
            {showPhotoCTA && (
              <div className='mb-4 p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 flex items-center justify-between'>
                <span className='text-sm text-purple-700 dark:text-purple-300'>需要你的确认才能开启相机</span>
                <button
                  onClick={async () => {
                    ensureScrollToMedia();
                    await handleTakePhoto();
                    setShowPhotoCTA(false);
                  }}
                  className='btn btn-primary ml-3 px-3 py-1.5 text-sm rounded-md bg-purple-500 text-white hover:bg-purple-600 active:scale-[0.98]'>
                  立即拍照
                </button>
              </div>
            )}
            <div className='grid grid-cols-2 gap-3 sm:gap-6 lg:gap-8 mb-6 lg:mb-8'>
              <div className='relative'>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  aria-label='添加照片'
                  className='w-full flex flex-col items-center justify-center p-4 sm:p-6 lg:p-10 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl lg:rounded-2xl hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all duration-300 group'>
                  <Camera className='w-10 h-10 lg:w-12 lg:h-12 text-gray-400 group-hover:text-purple-500 mb-3 lg:mb-4 transition-colors' />
                  <span className='text-base lg:text-lg font-medium text-gray-600 dark:text-gray-300 group-hover:text-purple-600 transition-colors'>
                    添加照片
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  type='file'
                  accept='image/*'
                  multiple
                  onChange={handlePhotoSelect}
                  aria-label='选择照片文件'
                  className='hidden'
                />
              </div>
              <div className='relative'>
                <button
                  ref={takePhotoBtnRef}
                  onClick={handleTakePhoto}
                  aria-label='拍照'
                  className={`w-full flex flex-col items-center justify-center p-4 sm:p-6 lg:p-10 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl lg:rounded-2xl hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all duration-300 group ${
                    highlightPhotoBtn ? 'ring-2 ring-purple-400 animate-pulse' : ''
                  }`}>
                  <Camera className='w-10 h-10 lg:w-12 lg:h-12 text-gray-400 group-hover:text-purple-500 mb-3 lg:mb-4 transition-colors' />
                  <span className='text-base lg:text-lg font-medium text-gray-600 dark:text-gray-300 group-hover:text-purple-600 transition-colors'>
                    拍照
                  </span>
                </button>
                <input
                  ref={cameraInputRef}
                  type='file'
                  accept='image/*'
                  {...(typeof window !== 'undefined' && 'capture' in document.createElement('input')
                    ? { capture: 'environment' }
                    : {})}
                  onChange={handleCameraCapture}
                  aria-label='拍照上传'
                  className='hidden'
                />
              </div>
            </div>

            {/* 录音控制 */}
            <div className='mb-4'>
              <button
                onClick={isRecording ? stopRecording : startRecording}
                aria-label={isRecording ? '停止录音' : '开始录音'}
                className={`w-full flex flex-col items-center justify-center p-8 lg:p-10 border-2 border-dashed rounded-xl lg:rounded-2xl transition-all duration-200 ${
                  isRecording
                    ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                    : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 hover:border-purple-400 dark:hover:border-purple-500'
                }`}>
                <Mic className={`w-10 h-10 lg:w-12 lg:h-12 mb-3 lg:mb-4 ${isRecording ? 'animate-pulse' : ''}`} />
                <span className='text-base lg:text-lg text-center'>{isRecording ? '点击停止录音' : '录制语音'}</span>
                {isRecording && (
                  <span className='text-sm lg:text-base mt-2 font-mono'>{formatTime(recordingTime)}</span>
                )}
              </button>
            </div>

            {/* 已添加的照片 */}
            {photos.length > 0 && (
              <div className='mb-6 lg:mb-8'>
                <h4 className='text-lg lg:text-xl font-medium text-gray-700 dark:text-gray-300 mb-4 lg:mb-6'>
                  已添加的照片 ({photos.length})
                </h4>
                <div className='grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 lg:gap-4'>
                  {photos.map((photo, index) => (
                    <div key={index} className='relative group'>
                      <img
                        src={URL.createObjectURL(photo)}
                        alt={`照片 ${index + 1}`}
                        className='w-full h-24 lg:h-28 xl:h-32 object-cover rounded-lg lg:rounded-xl'
                      />
                      <button
                        onClick={() => removePhoto(index)}
                        aria-label={`删除第${index + 1}张照片`}
                        className='btn btn-danger absolute -top-2 -right-2 w-7 h-7 lg:w-8 lg:h-8 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600'>
                        <X size={14} className='lg:w-4 lg:h-4' />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 已录制的语音 */}
            {audioRecordings.length > 0 && (
              <div>
                <h4 className='text-lg lg:text-xl font-medium text-gray-700 dark:text-gray-300 mb-4 lg:mb-6'>
                  已录制的语音 ({audioRecordings.length})
                </h4>
                <div className='space-y-3 lg:space-y-4'>
                  {audioRecordings.map((recording, index) => (
                    <div
                      key={index}
                      className='flex items-center justify-between p-4 lg:p-5 bg-gray-50 dark:bg-gray-700 rounded-lg lg:rounded-xl'>
                      <div className='flex items-center space-x-4 lg:space-x-5'>
                        <button
                          onClick={() => playAudio(index)}
                          aria-label={playingAudio === index ? '暂停播放' : '播放录音'}
                          className='w-10 h-10 lg:w-12 lg:h-12 bg-purple-500 text-white rounded-full flex items-center justify-center hover:bg-purple-600 transition-colors'>
                          {playingAudio === index ? (
                            <Pause size={16} className='lg:w-5 lg:h-5' />
                          ) : (
                            <Play size={16} className='lg:w-5 lg:h-5' />
                          )}
                        </button>
                        <span className='text-base lg:text-lg text-gray-600 dark:text-gray-300'>
                          语音 {index + 1} ({formatTime(recording.duration)})
                        </span>
                      </div>
                      <button
                        onClick={() => removeAudio(index)}
                        aria-label={`删除第${index + 1}个录音`}
                        className='btn btn-danger w-10 h-10 lg:w-12 lg:h-12 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors'>
                        <Trash2 size={16} className='lg:w-5 lg:h-5' />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 隐藏的音频元素用于播放 */}
            <audio ref={audioRef} className='hidden' />
          </Card>

          {/* 底部按钮 */}
          <div className='flex gap-3 sm:gap-6 lg:gap-8 mt-6 sm:mt-10 lg:mt-12 xl:mt-16'>
            <button
              onClick={() => navigate(-1)}
              aria-label='取消记录'
              className='btn btn-ghost flex-1 px-4 sm:px-8 lg:px-10 xl:px-12 py-3 sm:py-4 lg:py-5 xl:py-6 inline-flex items-center justify-center gap-2 rounded-lg sm:rounded-xl lg:rounded-2xl border border-gray-300 dark:border-gray-600 bg-white/80 dark:bg-gray-700/60 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-all duration-200 text-sm sm:text-base lg:text-lg xl:text-xl'>
              <X className='w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6' />
              <span>取消</span>
            </button>
            <button
              onClick={
                !selectedMood || diaryContent.trim().length < 10 || isLoading ? handleDisabledButtonClick : handleSave
              }
              aria-label='保存情绪记录'
              disabled={isLoading}
              className={`btn btn-primary flex-1 px-4 sm:px-8 lg:px-10 xl:px-12 py-3 sm:py-4 lg:py-5 xl:py-6 rounded-lg sm:rounded-xl lg:rounded-2xl font-semibold inline-flex items-center justify-center gap-2 sm:gap-3 lg:gap-4 text-sm sm:text-base lg:text-lg xl:text-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-all duration-200 ${
                !selectedMood || diaryContent.trim().length < 10 || isLoading
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-500 via-purple-600 to-blue-600 dark:from-purple-600 dark:via-purple-700 dark:to-blue-700 text-white shadow-sm hover:shadow-md hover:brightness-105 active:brightness-95'
              }`}>
              <Save className='w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6' />
              <span>{isLoading ? '保存中...' : '保存记录'}</span>
            </button>
          </div>
        </div>
      </Container>
    </>
  );
};

export default Record;
