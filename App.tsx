import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SettingsModal } from './components/SettingsModal';
import { AdminSettingsPage } from './components/AdminSettingsPage';
import { RadioPage } from './components/RadioPage';
import { Song, GenerationParams, RadioSong } from './types';
import { generateApi, songsApi, getAudioUrl, radioApi } from './services/api';
import { useRadio } from './context/RadioContext';
import { Toast, ToastType } from './components/Toast';


type View = 'radio' | 'admin';

export default function App() {
  // Radio username (simplified - localStorage only)
  const [radioUsername, setRadioUsername] = useState<string | null>(() => {
    return localStorage.getItem('radio_username');
  });

  // Radio
  const radio = useRadio();
  // Track multiple concurrent generation jobs
  const activeJobsRef = useRef<Map<string, { tempId: string; pollInterval: ReturnType<typeof setInterval> }>>(new Map());
  const [activeJobCount, setActiveJobCount] = useState(0);

  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Navigation State
  const [currentView, setCurrentView] = useState<View>('radio');

  // Player State
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);

  // UI State
  const [isGenerating, setIsGenerating] = useState(false);

  // Settings Modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: ToastType; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false,
  });

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    setToast({ message, type, isVisible: true });
  }, []);

  const closeToast = useCallback(() => {
    setToast(prev => ({ ...prev, isVisible: false }));
  }, []);

  // Auto-connect to radio when we have a radio username
  useEffect(() => {
    if (radioUsername && !radio.isConnected) {
      radio.connect(radioUsername);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radioUsername]);

  // Sync audio playback with radio
  useEffect(() => {
    if (!radio.currentSong || !audioRef.current) {
      return;
    }

    const syncPlayback = () => {
      if (!audioRef.current || !radio.playbackStartTime) return;
      const elapsed = (Date.now() - radio.playbackStartTime) / 1000;
      const drift = Math.abs(audioRef.current.currentTime - elapsed);

      // Re-sync if drift > 2 seconds
      if (drift > 2 && elapsed < (radio.currentSong?.duration || Infinity)) {
        audioRef.current.currentTime = elapsed;
      }
    };

    // Update current song from radio
    const radioSong: Song = {
      id: radio.currentSong.id,
      title: radio.currentSong.title,
      lyrics: radio.currentSong.lyrics,
      style: radio.currentSong.style,
      coverUrl: radio.currentSong.coverUrl,
      audioUrl: radio.currentSong.audioUrl,
      duration: radio.currentSong.duration > 0
        ? `${Math.floor(radio.currentSong.duration / 60)}:${String(Math.floor(radio.currentSong.duration % 60)).padStart(2, '0')}`
        : '0:00',
      creator: radio.currentSong.creator,
      createdAt: new Date(radio.currentSong.createdAt),
      tags: [],
    };

    if (currentSong?.id !== radio.currentSong.id) {
      const audio = audioRef.current;
      const newAudioUrl = radio.currentSong.audioUrl;
      const fadeOutDuration = radio.settings.autoDjFadeOut ?? 3;
      const fadeInDuration = radio.settings.autoDjFadeIn ?? 2;
      const targetVolume = volume;

      // Cancel any in-progress fade
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      }

      const startNewSong = () => {
        setCurrentSong(radioSong);
        setSelectedSong(radioSong);

        const elapsed = (Date.now() - radio.playbackStartTime) / 1000;

        if (audio && newAudioUrl) {
          audio.src = newAudioUrl;
          audio.volume = 0;
          audio.currentTime = Math.max(0, elapsed);
          audio.play()
            .then(() => {
              // Fade in
              const fadeInSteps = Math.max(1, fadeInDuration * 20);
              const fadeInIncrement = targetVolume / fadeInSteps;
              let fadeInStep = 0;
              fadeIntervalRef.current = setInterval(() => {
                fadeInStep++;
                if (fadeInStep >= fadeInSteps || !audioRef.current) {
                  if (audioRef.current) audioRef.current.volume = targetVolume;
                  if (fadeIntervalRef.current) {
                    clearInterval(fadeIntervalRef.current);
                    fadeIntervalRef.current = null;
                  }
                } else {
                  audioRef.current!.volume = Math.min(targetVolume, fadeInIncrement * fadeInStep);
                }
              }, 50);
            })
            .catch((err) => {
              console.error('[Radio Sync] Playback failed:', err);
              audio.volume = targetVolume;
              setIsPlaying(false);
            });
          setIsPlaying(true);
        }
      };

      // Fade out current song if one is playing, otherwise start immediately
      if (audio && !audio.paused && audio.src && currentSong) {
        const fadeOutSteps = Math.max(1, fadeOutDuration * 20);
        const fadeOutDecrement = audio.volume / fadeOutSteps;
        let fadeOutStep = 0;
        fadeIntervalRef.current = setInterval(() => {
          fadeOutStep++;
          if (fadeOutStep >= fadeOutSteps || !audioRef.current) {
            if (fadeIntervalRef.current) {
              clearInterval(fadeIntervalRef.current);
              fadeIntervalRef.current = null;
            }
            startNewSong();
          } else {
            audioRef.current!.volume = Math.max(0, audioRef.current!.volume - fadeOutDecrement);
          }
        }, 50);
      } else {
        startNewSong();
      }
    }

    // Periodic sync every 10 seconds
    const interval = setInterval(syncPlayback, 10000);
    return () => clearInterval(interval);
  }, [radio.currentSong, radio.playbackStartTime]);

  // Cleanup active jobs on unmount
  useEffect(() => {
    return () => {
      activeJobsRef.current.forEach(({ pollInterval }) => {
        clearInterval(pollInterval);
      });
      activeJobsRef.current.clear();
    };
  }, []);

  // Theme Effect
  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // URL Routing Effect (simplified - only radio and admin)
  useEffect(() => {
    const handleUrlChange = () => {
      const path = window.location.pathname;
      if (path === '/admin') {
        setCurrentView('admin');
      } else {
        setCurrentView('radio');
      }
    };

    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  // Audio Setup
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.crossOrigin = "anonymous";
    const audio = audioRef.current;
    audio.volume = volume;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const applyPendingSeek = () => {
      if (pendingSeekRef.current === null) return;
      if (audio.seekable.length === 0) return;
      const target = pendingSeekRef.current;
      const safeTarget = Number.isFinite(audio.duration)
        ? Math.min(Math.max(target, 0), audio.duration)
        : Math.max(target, 0);
      audio.currentTime = safeTarget;
      setCurrentTime(safeTarget);
      pendingSeekRef.current = null;
    };

    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      applyPendingSeek();
    };
    const onCanPlay = () => applyPendingSeek();
    const onProgress = () => applyPendingSeek();
    const onEnded = () => { /* Radio handles song transitions */ };
    const onError = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('progress', onProgress);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      }
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('progress', onProgress);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, []);

  // Handle Playback State
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong?.audioUrl) return;

    const playAudio = async () => {
      try {
        await audio.play();
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error("Playback failed:", err);
          setIsPlaying(false);
        }
      }
    };

    if (audio.src !== currentSong.audioUrl) {
      audio.src = currentSong.audioUrl;
      audio.load();
      if (isPlaying) playAudio();
    } else {
      if (isPlaying) playAudio();
      else audio.pause();
    }
  }, [currentSong, isPlaying]);

  // Handle Volume (skip if a fade is in progress)
  useEffect(() => {
    if (audioRef.current && !fadeIntervalRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Helper to cleanup a job
  const cleanupJob = useCallback((jobId: string, tempId: string) => {
    const jobData = activeJobsRef.current.get(jobId);
    if (jobData) {
      clearInterval(jobData.pollInterval);
      activeJobsRef.current.delete(jobId);
    }

    setActiveJobCount(activeJobsRef.current.size);

    if (activeJobsRef.current.size === 0) {
      setIsGenerating(false);
    }
  }, []);

  // Generation handler
  const handleGenerate = async (params: GenerationParams) => {
    if (!radioUsername) return;

    setIsGenerating(true);

    // Create unique temp ID for this job
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const job = await generateApi.startGeneration({
        customMode: params.customMode,
        songDescription: params.songDescription,
        lyrics: params.lyrics,
        style: params.style,
        title: params.title,
        instrumental: params.instrumental,
        vocalLanguage: params.vocalLanguage,
        duration: params.duration,
        bpm: params.bpm,
        keyScale: params.keyScale,
        timeSignature: params.timeSignature,
        inferenceSteps: params.inferenceSteps,
        guidanceScale: params.guidanceScale,
        batchSize: params.batchSize,
        randomSeed: params.randomSeed,
        seed: params.seed,
        thinking: params.thinking,
        audioFormat: params.audioFormat,
        inferMethod: params.inferMethod,
        shift: params.shift,
        lmTemperature: params.lmTemperature,
        lmCfgScale: params.lmCfgScale,
        lmTopK: params.lmTopK,
        lmTopP: params.lmTopP,
        lmNegativePrompt: params.lmNegativePrompt,
        referenceAudioUrl: params.referenceAudioUrl,
        sourceAudioUrl: params.sourceAudioUrl,
        audioCodes: params.audioCodes,
        repaintingStart: params.repaintingStart,
        repaintingEnd: params.repaintingEnd,
        instruction: params.instruction,
        audioCoverStrength: params.audioCoverStrength,
        taskType: params.taskType,
        useAdg: params.useAdg,
        cfgIntervalStart: params.cfgIntervalStart,
        cfgIntervalEnd: params.cfgIntervalEnd,
        customTimesteps: params.customTimesteps,
        useCotMetas: params.useCotMetas,
        useCotCaption: params.useCotCaption,
        useCotLanguage: params.useCotLanguage,
        autogen: params.autogen,
        constrainedDecodingDebug: params.constrainedDecodingDebug,
        allowLmBatch: params.allowLmBatch,
        getScores: params.getScores,
        getLrc: params.getLrc,
        scoreScale: params.scoreScale,
        lmBatchChunkSize: params.lmBatchChunkSize,
        trackName: params.trackName,
        completeTrackClasses: params.completeTrackClasses,
        isFormatCaption: params.isFormatCaption,
        instructMode: params.instructMode,
        instructParams: params.instructParams,
        llmData: params.llmData,
      }, radioUsername);

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const status = await generateApi.getStatus(job.jobId, radioUsername);

          if (status.status === 'succeeded' && status.result) {
            cleanupJob(job.jobId, tempId);

            // Add completed song to radio queue
            if (status.result.audioUrls && status.result.audioUrls.length > 0) {
              try {
                const audioUrl = status.result.audioUrls[0];
                const songId = `gen_${Date.now()}`;
                const extendedParams = params as GenerationParams & {
                  instructMode?: boolean;
                  instructParams?: { effects: string[]; customInstruction?: string };
                  llmData?: { song_title?: string; prompt?: string; lyrics?: string; audio_duration?: number; bpm?: number; key_scale?: string; time_signature?: string };
                };
                const llmData = job.llmData || extendedParams.llmData;
                const radioSong: RadioSong = {
                  id: songId,
                  title: llmData?.song_title || params.title || 'Untitled',
                  lyrics: llmData?.lyrics || params.lyrics || '',
                  style: llmData?.prompt || params.style || '',
                  coverUrl: `https://picsum.photos/seed/${songId}/400/400`,
                  audioUrl: audioUrl,
                  duration: status.result.duration || 0,
                  creator: radioUsername,
                  createdAt: new Date(),
                };
                const genParams = {
                  customMode: llmData?.prompt ? true : params.customMode,
                  songDescription: params.songDescription,
                  lyrics: llmData?.lyrics ?? params.lyrics,
                  style: llmData?.prompt ?? params.style,
                  title: llmData?.song_title ?? params.title,
                  instrumental: params.instrumental,
                  vocalLanguage: params.vocalLanguage,
                  instructMode: extendedParams.instructMode,
                  instructParams: extendedParams.instructParams,
                  llmData,
                };
                await radio.addToQueue(radioSong, genParams);
                showToast('Song added to radio queue');
              } catch (queueError) {
                console.error('Failed to add to radio queue:', queueError);
              }
            }
          } else if (status.status === 'failed') {
            cleanupJob(job.jobId, tempId);
            console.error(`Job ${job.jobId} failed:`, status.error);
            showToast(`Generation failed: ${status.error || 'Unknown error'}`, 'error');
          }
        } catch (pollError) {
          console.error(`Polling error for job ${job.jobId}:`, pollError);
          cleanupJob(job.jobId, tempId);
        }
      }, 2000);

      // Track this job
      activeJobsRef.current.set(job.jobId, { tempId, pollInterval });
      setActiveJobCount(activeJobsRef.current.size);

      // Timeout after 10 minutes
      setTimeout(() => {
        if (activeJobsRef.current.has(job.jobId)) {
          console.warn(`Job ${job.jobId} timed out`);
          cleanupJob(job.jobId, tempId);
          showToast('Generation timed out', 'error');
        }
      }, 600000);

    } catch (e) {
      console.error('Generation error:', e);
      if (activeJobsRef.current.size === 0) {
        setIsGenerating(false);
      }
      showToast('Generation failed. Please try again.', 'error');
    }
  };

  const togglePlay = () => {
    if (!currentSong) return;
    setIsPlaying(!isPlaying);
  };

  // Handle username setup
  const handleUsernameSubmit = (username: string) => {
    localStorage.setItem('radio_username', username);
    setRadioUsername(username);
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-suno-DEFAULT text-zinc-900 dark:text-white font-sans antialiased selection:bg-pink-500/30 transition-colors duration-300">
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 flex overflow-hidden relative">
          {currentView === 'admin' ? (
            <AdminSettingsPage theme={theme} onBack={() => { setCurrentView('radio'); window.history.pushState({}, '', '/'); }} />
          ) : (
            <RadioPage
              isPlaying={isPlaying}
              onTogglePlay={togglePlay}
              currentTime={currentTime}
              duration={duration}
              volume={volume}
              onVolumeChange={setVolume}
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
              onOpenSettings={() => setShowSettingsModal(true)}
              onOpenAdminSettings={() => { setCurrentView('admin'); window.history.pushState({}, '', '/admin'); }}
              user={radioUsername ? { username: radioUsername } : null}
              onUsernameSubmit={handleUsernameSubmit}
            />
          )}
        </main>
      </div>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={closeToast}
      />
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        theme={theme}
        onToggleTheme={toggleTheme}
        username={radioUsername}
      />
    </div>
  );
}
