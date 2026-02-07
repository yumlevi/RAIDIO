import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipForward, Users, Crown, Radio, Volume2, VolumeX, Settings, Sparkles, Music2, ChevronDown, X, ListMusic, History, Download, Info, Send, MessageCircle, Waves, ChevronRight, ListPlus, PanelRightOpen, PanelRightClose, AlignLeft } from 'lucide-react';
import { AudioVisualizer, ColorScheme, COLOR_SCHEMES, VisualizerShape, VISUALIZER_SHAPES, extractColorsFromImage, audioNodeCache } from './AudioVisualizer';
import { useRadio } from '../context/RadioContext';
import { useTheme } from '../context/ThemeContext';
import { AlbumCover, getAlbumAccentColors } from './AlbumCover';
import DiffusionPlaceholder from './DiffusionPlaceholder';
import { GenerationParams, View, RadioSong, InstructParams } from '../types';

// Vibey effect pills for the Instruct tab - evocative words that feel creative
const VIBE_PILLS = [
  // Moods & feelings
  'dreamy', 'euphoric', 'melancholic', 'nostalgic', 'ethereal', 'raw', 'intimate', 'anthemic',
  'hypnotic', 'groovy', 'haunting', 'blissful', 'bittersweet', 'cosmic', 'nocturnal',
  // Energy & texture
  'lush', 'gritty', 'airy', 'heavy', 'bouncy', 'floating', 'punchy', 'smooth', 'chaotic',
  // Temperature & space
  'warm', 'cold', 'vast', 'cozy', 'cavernous', 'crisp',
  // Time & style
  'vintage', 'futuristic', 'retro', 'cinematic', 'lo-fi', 'hi-fi', 'stripped back',
  // Intensity
  'intense', 'gentle', 'explosive', 'subtle', 'bold', 'delicate',
  // Movement
  'faster', 'slower', 'building', 'fading', 'pulsing', 'swaying',
];

const VOCAL_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ru', label: 'Russian' },
  { value: 'unknown', label: 'Auto' },
];

/** Accent-tinted radial gradient overlay for panels/modals.
 *  Use as backgroundImage on top of bg-white dark:bg-zinc-900 classes. */
function accentPanelGradient(accentColor: string, origin: 'top' | 'center' = 'top') {
  const pos = origin === 'top' ? '50% -10%' : '50% 30%';
  return `radial-gradient(circle at ${pos}, ${accentColor}20 0%, transparent 70%)`;
}

interface RadioPageProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentTime: number;
  duration: number;
  volume: number;
  onVolumeChange: (v: number) => void;
  onGenerate: (params: GenerationParams) => void;
  isGenerating: boolean;
  onOpenSettings: () => void;
  onOpenAdminSettings: () => void;
  onNavigate?: (view: View) => void;
  user?: { username: string } | null;
  onUsernameSubmit?: (username: string) => void;
}

export const RadioPage: React.FC<RadioPageProps> = ({
  isPlaying,
  onTogglePlay,
  currentTime,
  duration,
  volume,
  onVolumeChange,
  onGenerate,
  isGenerating,
  onOpenSettings,
  onOpenAdminSettings,
  onNavigate,
  user,
  onUsernameSubmit,
}) => {
  const radio = useRadio();
  const { accent, accentColor, accentColorDark, accentTextColor, setDynamicPalette, nowPlayingScale } = useTheme();

  // Now-playing scale config
  const scaleConfig = {
    compact:  { container: 'max-w-xl',  artPx: 144, title: 'text-lg lg:text-xl',   artist: 'text-sm' },
    default:  { container: 'max-w-2xl', artPx: 192, title: 'text-xl lg:text-2xl',  artist: 'text-sm' },
    large:    { container: 'max-w-4xl', artPx: 288, title: 'text-2xl lg:text-3xl', artist: 'text-base' },
    xlarge:   { container: 'max-w-5xl', artPx: 384, title: 'text-3xl lg:text-4xl', artist: 'text-lg' },
  };
  const npScale = scaleConfig[nowPlayingScale];
  const [usernameInput, setUsernameInput] = useState('');
  const [mode, setMode] = useState<'simple' | 'custom' | 'instruct'>('simple');
  const [description, setDescription] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [style, setStyle] = useState('');
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState('en');
  const [instrumental, setInstrumental] = useState(false);
  // Instruct mode state
  const [instructEffects, setInstructEffects] = useState<string[]>([]);
  const [customInstruction, setCustomInstruction] = useState('');
  const [showQueue, setShowQueue] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('radio_sidebar_collapsed') === 'true';
  });
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');
  const [streamPlaying, setStreamPlaying] = useState(false);
  const [selectedSong, setSelectedSong] = useState<RadioSong | null>(null);
  const [showListenersPanel, setShowListenersPanel] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [showVisualizer, setShowVisualizer] = useState(() => {
    const stored = localStorage.getItem('radio_visualizer');
    return stored === null ? true : stored === 'true';
  });
  const [visualizerOpacity, setVisualizerOpacity] = useState(() => {
    return parseFloat(localStorage.getItem('radio_visualizer_opacity') || '1');
  });
  const [visualizerColorScheme, setVisualizerColorScheme] = useState<ColorScheme>(() => {
    return (localStorage.getItem('radio_visualizer_color') as ColorScheme) || 'album';
  });
  const [visualizerShape, setVisualizerShape] = useState<VisualizerShape>(() => {
    return (localStorage.getItem('radio_visualizer_shape') as VisualizerShape) || 'grid';
  });
  const [zenMode, setZenMode] = useState(false);
  const [showVisualizerSettings, setShowVisualizerSettings] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showDjStyleMenu, setShowDjStyleMenu] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const formIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-close form after 30s of inactivity
  const resetFormIdleTimer = useCallback(() => {
    if (formIdleTimerRef.current) clearTimeout(formIdleTimerRef.current);
    formIdleTimerRef.current = setTimeout(() => {
      setFormOpen(false);
    }, 30000);
  }, []);

  useEffect(() => {
    if (formOpen) {
      resetFormIdleTimer();
    } else if (formIdleTimerRef.current) {
      clearTimeout(formIdleTimerRef.current);
    }
    return () => { if (formIdleTimerRef.current) clearTimeout(formIdleTimerRef.current); };
  }, [formOpen, resetFormIdleTimer]);

  const closeForm = useCallback(() => {
    setFormOpen(false);
  }, []);

  // For smooth album cover crossfade - two layers that alternate
  const [coverLayers, setCoverLayers] = useState<{
    layer1: string | null;
    layer2: string | null;
    activeLayer: 1 | 2;
  }>({ layer1: null, layer2: null, activeLayer: 1 });
  const lastSeenChatCountRef = useRef(0);
  const chatInitializedRef = useRef(false);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Stream URL based on current host
  const streamUrl = `${window.location.protocol}//${window.location.host}/api/radio/stream`;

  // Derive effective interaction mode
  const interactionMode = radio.settings.interactionMode ||
    (radio.settings.useLLM ? 'vibe' : 'create');

  // Reset mode to first tab when interaction mode changes
  const prevInteractionModeRef = useRef(interactionMode);
  useEffect(() => {
    if (prevInteractionModeRef.current !== interactionMode) {
      prevInteractionModeRef.current = interactionMode;
      setMode('simple');
    }
  }, [interactionMode]);

  // Dynamic accent: extract colors from actual cover image, fallback to AlbumCover palette
  useEffect(() => {
    if (accent !== 'dynamic' || !radio.currentSong) return;
    const songId = radio.currentSong.id;
    const coverUrl = radio.currentSong.coverUrl;

    const useFallback = () => {
      const colors = getAlbumAccentColors(songId);
      setDynamicPalette(colors);
    };

    if (coverUrl) {
      extractColorsFromImage(coverUrl).then((rgbColors) => {
        if (rgbColors.length === 0) { useFallback(); return; }
        // Convert rgb(r,g,b) strings to hex
        const hexColors = rgbColors.map(c => {
          const m = c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (!m) return c;
          const r = parseInt(m[1]).toString(16).padStart(2, '0');
          const g = parseInt(m[2]).toString(16).padStart(2, '0');
          const b = parseInt(m[3]).toString(16).padStart(2, '0');
          return `#${r}${g}${b}`;
        });
        setDynamicPalette(hexColors);
      });
    } else {
      useFallback();
    }
  }, [accent, radio.currentSong?.id, radio.currentSong?.coverUrl, setDynamicPalette]);

  // Initialize audio element for stream and autoplay
  useEffect(() => {
    audioRef.current = new Audio(streamUrl);
    audioRef.current.volume = volume;

    // Autoplay the stream
    audioRef.current.play()
      .then(() => {
        setStreamPlaying(true);
        console.log('[Radio] Stream autoplay started');
      })
      .catch(err => {
        console.log('[Radio] Autoplay blocked, user interaction required:', err.message);
        // Autoplay was blocked - user will need to click play
        setStreamPlaying(false);
      });

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [radio.chatMessages]);

  // Track unread chat messages (only for NEW messages, not history)
  useEffect(() => {
    const currentCount = radio.chatMessages.length;

    // On first load of messages (history), initialize without counting as unread
    if (!chatInitializedRef.current && currentCount > 0) {
      chatInitializedRef.current = true;
      lastSeenChatCountRef.current = currentCount;
      return;
    }

    if (showListenersPanel) {
      // Panel is open, mark all as read
      lastSeenChatCountRef.current = currentCount;
      setUnreadChatCount(0);
    } else if (chatInitializedRef.current && currentCount > lastSeenChatCountRef.current) {
      // New messages while panel is closed (only after initialization)
      setUnreadChatCount(currentCount - lastSeenChatCountRef.current);
    }
  }, [radio.chatMessages.length, showListenersPanel]);

  // Reset chat initialized state when disconnected
  useEffect(() => {
    if (!radio.isConnected) {
      chatInitializedRef.current = false;
      lastSeenChatCountRef.current = 0;
      setUnreadChatCount(0);
    }
  }, [radio.isConnected]);

  // Handle album cover transitions - preload then crossfade (old stays visible until new is ready)
  const currentCoverUrl = radio.currentSong?.coverUrl || null;
  const lastCoverUrlRef = useRef<string | null>(null);

  useEffect(() => {
    // Skip if same cover
    if (currentCoverUrl === lastCoverUrlRef.current) return;
    lastCoverUrlRef.current = currentCoverUrl;

    // If no new cover, just switch to empty layer (will show fallback)
    if (!currentCoverUrl) {
      setCoverLayers(prev => {
        if (prev.activeLayer === 1) {
          return { layer1: prev.layer1, layer2: null, activeLayer: 2 };
        } else {
          return { layer1: null, layer2: prev.layer2, activeLayer: 1 };
        }
      });
      return;
    }

    // Preload the new image, only switch once loaded
    const img = new Image();
    img.onload = () => {
      setCoverLayers(prev => {
        // Put loaded image on inactive layer and switch to it
        if (prev.activeLayer === 1) {
          return { layer1: prev.layer1, layer2: currentCoverUrl, activeLayer: 2 };
        } else {
          return { layer1: currentCoverUrl, layer2: prev.layer2, activeLayer: 1 };
        }
      });
    };
    img.src = currentCoverUrl;
  }, [currentCoverUrl]);


  // Escape key to exit zen mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && zenMode) {
        setZenMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zenMode]);

  const handleSendChat = () => {
    if (chatMessage.trim()) {
      radio.sendChatMessage(chatMessage);
      setChatMessage('');
    }
  };

  const toggleVisualizer = () => {
    const newValue = !showVisualizer;
    setShowVisualizer(newValue);
    localStorage.setItem('radio_visualizer', String(newValue));
  };

  const toggleSidebar = () => {
    const newValue = !sidebarCollapsed;
    setSidebarCollapsed(newValue);
    localStorage.setItem('radio_sidebar_collapsed', String(newValue));
  };

  const handleOpacityChange = (opacity: number) => {
    setVisualizerOpacity(opacity);
    localStorage.setItem('radio_visualizer_opacity', String(opacity));
  };

  const toggleZenMode = () => {
    setZenMode(!zenMode);
    setShowVisualizerSettings(false);
    // Enable visualizer when entering zen mode
    if (!zenMode && !showVisualizer) {
      setShowVisualizer(true);
      localStorage.setItem('radio_visualizer', 'true');
    }
  };

  const handleChatKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  };

  const handleStreamToggle = () => {
    if (!audioRef.current) return;

    if (streamPlaying) {
      audioRef.current.pause();
      setStreamPlaying(false);
    } else {
      // Reload stream to get current position
      audioRef.current.src = streamUrl;
      audioRef.current.play()
        .then(() => setStreamPlaying(true))
        .catch(err => {
          console.error('Stream play failed:', err);
          // If no song is playing, still show the UI so user can create one
          if (!radio.currentSong) {
            setStreamPlaying(true);
          }
        });
    }
  };

  const handleEnterStudio = () => {
    setStreamPlaying(true);
  };

  const toggleEffect = (effectId: string) => {
    setInstructEffects(prev =>
      prev.includes(effectId)
        ? prev.filter(e => e !== effectId)
        : [...prev, effectId]
    );
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleGenerate = () => {
    if (mode === 'simple' && !description.trim()) return;
    if (mode === 'custom' && !style.trim()) return;
    // For instruct mode: need either a starting point, selected vibes, custom instruction, OR a current song to modify
    const hasCurrentSong = !!radio.currentSong;
    if (mode === 'instruct' && !style.trim() && !description.trim() && instructEffects.length === 0 && !customInstruction.trim() && !hasCurrentSong) return;

    // For custom/instruct mode, use style as songDescription if no explicit description
    // This ensures the generation works properly
    let songDesc: string;
    let isCustomMode: boolean;

    if (mode === 'simple') {
      songDesc = description;
      isCustomMode = false;
    } else if (mode === 'custom') {
      songDesc = title ? `${title} - ${style}` : style;
      isCustomMode = true;
    } else {
      // Instruct mode - use custom mode with style if available, otherwise description
      songDesc = style || description;
      isCustomMode = !!style;
    }

    // Build instruct params if in instruct mode
    const instructParams: InstructParams | undefined = mode === 'instruct' && radio.settings.useLLM
      ? { effects: instructEffects, customInstruction: customInstruction || undefined }
      : undefined;

    // For vibes mode, get the current song's LLM data to modify
    // Prefer the actual llmData from genParams if available (has full LLM response)
    // Fall back to song properties if llmData not available
    const currentSongData = (mode === 'instruct' && radio.currentSong) ? (
      radio.currentSong.genParams?.llmData || {
        song_title: radio.currentSong.title,
        prompt: radio.currentSong.style,
        lyrics: radio.currentSong.lyrics,
        audio_duration: radio.currentSong.duration,
      }
    ) : undefined;

    console.log('[RadioPage] Generating:', {
      mode,
      useLLM: radio.settings.useLLM,
      hasInstructParams: !!instructParams,
      instructEffects: instructEffects.length,
      customInstruction: !!customInstruction,
      hasCurrentSongData: !!currentSongData,
      currentSongTitle: radio.currentSong?.title,
      usingLLMData: !!radio.currentSong?.genParams?.llmData,
      llmDataPrompt: currentSongData?.prompt?.slice(0, 80),
    });

    onGenerate({
      customMode: isCustomMode,
      songDescription: songDesc,
      lyrics: mode !== 'simple' ? lyrics : '',
      style: mode !== 'simple' ? style : '',
      title: mode !== 'simple' ? title : '',
      instrumental,
      vocalLanguage: language,
      prompt: '',
      bpm: 0,
      keyScale: '',
      timeSignature: '',
      duration: -1,
      inferenceSteps: radio.settings.inferenceSteps,
      guidanceScale: radio.settings.guidanceScale,
      batchSize: radio.settings.batchSize,
      randomSeed: radio.settings.randomSeed,
      seed: radio.settings.seed,
      // Disable thinking when AI is enabled
      thinking: radio.settings.useLLM ? false : radio.settings.thinking,
      audioFormat: radio.settings.audioFormat,
      inferMethod: radio.settings.inferMethod,
      shift: radio.settings.shift,
      lmTemperature: radio.settings.lmTemperature,
      lmCfgScale: radio.settings.lmCfgScale,
      lmTopK: radio.settings.lmTopK,
      lmTopP: radio.settings.lmTopP,
      lmNegativePrompt: radio.settings.lmNegativePrompt,
      // Pass instruct params when in instruct mode, including current song data
      ...(instructParams && {
        instructMode: true,
        instructParams,
        llmData: currentSongData, // Pass current song as previous data for LLM to modify
      }),
    } as GenerationParams & { instructMode?: boolean; instructParams?: InstructParams; llmData?: any });

    // Don't clear inputs - keep them for easy re-generation with tweaks
  };

  return (
    <div className="relative flex flex-col h-[100dvh] w-full bg-gradient-to-b from-zinc-100 via-zinc-100 to-zinc-200 dark:from-zinc-900 dark:via-zinc-900 dark:to-black text-zinc-900 dark:text-white">
      {/* Global keyframes for generation animations */}
      <style>{`
        @keyframes genBar {
          0% { height: 20%; opacity: 0.6; }
          100% { height: 100%; opacity: 1; }
        }
      `}</style>
      {/* Overlay - opacity controlled by visualizer settings (z-0 = behind everything) */}
      <div
        className="absolute inset-0 z-0 bg-white dark:bg-black pointer-events-none"
        style={{ opacity: visualizerOpacity }}
      />

      {/* Audio Visualizer - transparent background, shapes only (z-[1] = above overlay, below UI) */}
      {showVisualizer && (
        <AudioVisualizer
          audioElement={audioRef.current}
          isPlaying={streamPlaying}
          colorScheme={visualizerColorScheme}
          shape={visualizerShape}
          coverUrl={radio.currentSong?.coverUrl}
          coverSeed={radio.currentSong?.id}
        />
      )}

      {/* Landing Screen - shown when not streaming */}
      <div className={`absolute inset-0 z-30 flex flex-col items-center justify-center p-8 ${
        streamPlaying ? 'transition-all duration-500 ease-out opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
      }`}>
        <div className="flex flex-col items-center gap-6 max-w-sm">
          {/* Album art - clickable to play (only when user already has username) */}
          <div
            onClick={user ? handleStreamToggle : undefined}
            className={`w-40 min-h-[10rem] sm:w-52 sm:min-h-[13rem] aspect-square shrink-0 rounded-3xl overflow-hidden shadow-2xl relative bg-zinc-200 dark:bg-zinc-800 group ${user ? 'cursor-pointer hover:scale-105' : ''} transition-transform`}
          >
            {radio.currentSong ? (
              <AlbumCover seed={radio.currentSong.id} size="full" className="absolute inset-0 w-full h-full" />
            ) : (
              <DiffusionPlaceholder className="absolute inset-0 w-full h-full" />
            )}
            {coverLayers.layer1 && (
              <img src={coverLayers.layer1} alt="" className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${coverLayers.activeLayer === 1 ? 'opacity-100' : 'opacity-0'}`} />
            )}
            {coverLayers.layer2 && (
              <img src={coverLayers.layer2} alt="" className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${coverLayers.activeLayer === 2 ? 'opacity-100' : 'opacity-0'}`} />
            )}
            {/* Play icon overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
              <Play size={48} fill="white" className="ml-1 text-white drop-shadow-lg" />
            </div>
          </div>

          {/* Song / branding info */}
          <div className="text-center">
            {radio.currentSong ? (
              <>
                <p className="text-lg font-bold text-zinc-900 dark:text-white">{radio.currentSong.title}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{radio.currentSong.creator || 'Unknown Artist'}</p>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(to bottom right, ${accentColor}, ${accentColorDark})`, color: accentTextColor }}>
                    <Radio size={12} />
                  </div>
                  <span className="text-lg font-bold text-zinc-900 dark:text-white">RAIDIO</span>
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">AI-Generated Music Radio</p>
              </>
            )}
          </div>

          {/* Listener count */}
          {radio.listenerCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <Users size={14} />
              <span>{radio.listenerCount} listening</span>
            </div>
          )}

          {/* Username input for new users */}
          {!user && onUsernameSubmit ? (
            <div className="flex flex-col items-center gap-3 w-full">
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && usernameInput.trim()) {
                    onUsernameSubmit(usernameInput.trim());
                    if (radio.currentSong) handleStreamToggle();
                    else handleEnterStudio();
                  }
                }}
                placeholder="Choose a username..."
                maxLength={20}
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-white/10 border border-zinc-200 dark:border-white/10 text-center text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
                autoFocus
              />
              <button
                onClick={() => {
                  if (!usernameInput.trim()) return;
                  onUsernameSubmit(usernameInput.trim());
                  if (radio.currentSong) handleStreamToggle();
                  else handleEnterStudio();
                }}
                disabled={!usernameInput.trim()}
                className="px-6 py-2.5 rounded-full text-sm font-medium transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
                style={{ backgroundColor: accentColor, color: accentTextColor }}
              >
                {radio.currentSong ? 'Tune In' : 'Start Creating'}
              </button>
            </div>
          ) : radio.currentSong ? (
            <p className="text-sm text-zinc-400 dark:text-zinc-500 cursor-pointer" onClick={handleStreamToggle}>Tap to tune in</p>
          ) : (
            <button
              onClick={handleEnterStudio}
              className="px-6 py-2.5 rounded-full text-sm font-medium transition-all hover:scale-105"
              style={{ backgroundColor: accentColor, color: accentTextColor }}
            >
              Start Creating
            </button>
          )}
        </div>
      </div>

      {/* Zen Mode Overlay - shows only visualizer and exit button */}
      <div className={`absolute inset-0 z-40 transition-opacity duration-700 ${zenMode ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {/* Zen mode exit button */}
        <button
          onClick={toggleZenMode}
          className="absolute top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full backdrop-blur hover:opacity-80 transition-all text-sm"
          style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
        >
          <X size={16} />
          Exit Zen Mode
        </button>
        {/* Current song info - minimal */}
        {radio.currentSong && (
          <div
            className={`absolute bottom-8 left-1/2 z-50 flex items-center gap-4 px-6 py-4 rounded-2xl bg-black/50 backdrop-blur border transition-all duration-700 ${zenMode ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
            style={{ transform: `translateX(-50%)${zenMode ? '' : ' translateY(1rem)'}`, borderColor: `${accentColor}20` }}
          >
            <div className="w-12 h-12 rounded-lg overflow-hidden relative bg-zinc-900" style={{ boxShadow: `0 0 12px 2px ${accentColor}30` }}>
              <AlbumCover seed={radio.currentSong.id} size="full" className="absolute inset-0 w-full h-full" />
              {coverLayers.layer1 && (
                <img
                  src={coverLayers.layer1}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                    coverLayers.activeLayer === 1 ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              )}
              {coverLayers.layer2 && (
                <img
                  src={coverLayers.layer2}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                    coverLayers.activeLayer === 2 ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              )}
            </div>
            <div className="text-center">
              <p className="font-medium text-white">{radio.currentSong.title}</p>
              <p className="text-sm" style={{ color: `${accentColor}99` }}>{radio.currentSong.creator || 'Unknown'}</p>
            </div>
            <button
              onClick={handleStreamToggle}
              className="w-10 h-10 rounded-full flex items-center justify-center hover:scale-105 transition-transform"
              style={{
                background: `linear-gradient(to right, ${accentColor}, ${accentColorDark})`,
                boxShadow: `0 0 8px 1px ${accentColor}50`,
                color: accentTextColor,
              }}
            >
              {streamPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>
          </div>
        )}
      </div>

      {/* Top Bar - Hidden in zen mode */}
      <div className={`relative z-20 flex items-center justify-between px-3 py-2 lg:px-6 lg:py-4 transition-all duration-700 ${zenMode ? 'opacity-0 pointer-events-none -translate-y-4' : ''} ${!streamPlaying ? 'opacity-0 pointer-events-none' : !zenMode ? 'opacity-100' : ''}`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(to bottom right, ${accentColor}, ${accentColorDark})`, color: accentTextColor }}>
            <Radio size={16} />
          </div>
          <span className="font-semibold text-sm">RAIDIO</span>
        </div>

        <div className="flex items-center gap-2 lg:gap-4">
          {/* Listeners - Clickable */}
          <div className="relative">
            {/* Unread chat tooltip */}
            {unreadChatCount > 0 && !showListenersPanel && (
              <div className="absolute bottom-full left-1/2 mb-2 whitespace-nowrap pointer-events-none z-10" style={{ transform: 'translateX(-50%)' }}>
                <div className="text-xs font-medium px-3 py-1.5 rounded-full shadow-lg animate-pulse" style={{ backgroundColor: accentColor, color: accentTextColor }}>
                  {unreadChatCount} new message{unreadChatCount > 1 ? 's' : ''}
                </div>
                <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent mx-auto" style={{ borderTopColor: accentColor }} />
              </div>
            )}
            <button
              onClick={() => setShowListenersPanel(!showListenersPanel)}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors hover:opacity-80"
              style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
            >
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <Users size={14} />
              <span className="text-sm">{radio.listenerCount}</span>
              {radio.chatMessages.length > 0 && (
                <MessageCircle size={12} className="ml-1" style={{ color: accentColor }} />
              )}
              {/* Unread chat badge */}
              {unreadChatCount > 0 && !showListenersPanel && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded-full px-1 animate-pulse" style={{ backgroundColor: accentColor, color: accentTextColor }}>
                  {unreadChatCount > 9 ? '9+' : unreadChatCount}
                </span>
              )}
            </button>
          </div>

          {/* Admin Badge */}
          {radio.isOwner && (
            <button
              onClick={onOpenAdminSettings}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors"
            >
              <Crown size={14} />
              <span className="text-sm">Admin</span>
            </button>
          )}

          {/* Visualizer Toggle with Settings */}
          <div
            className="relative flex items-center rounded-full transition-colors"
            style={showVisualizer
              ? { backgroundColor: `${accentColor}15` }
              : undefined
            }
          >
            <button
              onClick={toggleVisualizer}
              className={`p-2 pl-2.5 rounded-l-full transition-colors hover:opacity-80 ${
                showVisualizer
                  ? ''
                  : 'text-zinc-500 dark:text-zinc-400'
              }`}
              style={showVisualizer ? { color: accentColor } : undefined}
              title="Toggle visualizer"
            >
              <Waves size={18} />
            </button>
            <button
              onClick={() => setShowVisualizerSettings(!showVisualizerSettings)}
              className={`p-2 pr-2.5 rounded-r-full transition-colors hover:opacity-80 ${
                !showVisualizer && !showVisualizerSettings
                  ? 'text-zinc-500 dark:text-zinc-400'
                  : ''
              }`}
              style={(showVisualizer || showVisualizerSettings) ? { color: showVisualizerSettings ? accentColor : `${accentColor}99` } : undefined}
              title="Visualizer settings"
            >
              <ChevronDown size={12} className={`transition-transform ${showVisualizerSettings ? 'rotate-180' : ''}`} />
            </button>

            {/* Visualizer Settings Popover */}
            {showVisualizerSettings && (
              <>
                {/* Backdrop to close on click outside */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowVisualizerSettings(false)}
                />
                <div
                  className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-white/10 shadow-2xl z-50 p-4"
                  style={{ backgroundImage: accentPanelGradient(accentColor) }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-medium text-sm">Visualizer Settings</span>
                    <button
                      onClick={() => setShowVisualizerSettings(false)}
                      className="p-1 hover:bg-zinc-100 dark:hover:bg-white/10 rounded transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Enable Toggle */}
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-zinc-200 dark:border-white/10">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">Enabled</span>
                    <button
                      onClick={toggleVisualizer}
                      className="w-10 h-6 rounded-full transition-colors relative"
                      style={{ backgroundColor: showVisualizer ? accentColor : '#d4d4d8' }}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow ${
                        showVisualizer ? 'left-5' : 'left-1'
                      }`} />
                    </button>
                  </div>

                  {/* Opacity Slider */}
                  <div className="space-y-2 mb-4 pb-4 border-b border-zinc-200 dark:border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">Opacity</span>
                      <span className="text-sm text-zinc-500">{Math.round(visualizerOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.05"
                      value={visualizerOpacity}
                      onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
                      className="w-full"
                      style={{ accentColor: accentColor }}
                    />
                  </div>

                  {/* Shape */}
                  <div className="space-y-2 mb-4 pb-4 border-b border-zinc-200 dark:border-white/10">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">Shape</span>
                    <div className="grid grid-cols-3 gap-2">
                      {VISUALIZER_SHAPES.map((shapeOption) => (
                        <button
                          key={shapeOption.id}
                          onClick={() => {
                            setVisualizerShape(shapeOption.id);
                            localStorage.setItem('radio_visualizer_shape', shapeOption.id);
                          }}
                          className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-all ${
                            visualizerShape === shapeOption.id
                              ? 'border'
                              : 'bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 border border-transparent hover:bg-zinc-200 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white'
                          }`}
                          style={visualizerShape === shapeOption.id ? { backgroundColor: `${accentColor}4D`, color: accentColor, borderColor: `${accentColor}80` } : undefined}
                        >
                          <span className="text-lg">{shapeOption.icon}</span>
                          <span className="text-[10px]">{shapeOption.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color Scheme */}
                  <div className="space-y-2 mb-4">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">Color Scheme</span>
                    <div className="grid grid-cols-4 gap-2">
                      {COLOR_SCHEMES.map((scheme) => (
                        <button
                          key={scheme.id}
                          onClick={() => {
                            setVisualizerColorScheme(scheme.id);
                            localStorage.setItem('radio_visualizer_color', scheme.id);
                          }}
                          className={`relative group aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                            visualizerColorScheme === scheme.id
                              ? 'border-zinc-900 dark:border-white scale-105'
                              : 'border-transparent hover:border-zinc-400 dark:hover:border-white/50'
                          }`}
                          title={scheme.name}
                        >
                          <div
                            className="absolute inset-0"
                            style={{
                              background: `linear-gradient(135deg, ${scheme.preview.join(', ')})`,
                            }}
                          />
                          {visualizerColorScheme === scheme.id && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <div className="w-2 h-2 rounded-full bg-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-zinc-500 text-center">
                      {COLOR_SCHEMES.find(s => s.id === visualizerColorScheme)?.name}
                    </p>
                  </div>

                  {/* Zen Mode Button */}
                  <button
                    onClick={toggleZenMode}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-zinc-200 dark:border-white/10 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
                    style={{ background: `linear-gradient(to right, ${accentColor}33, ${accentColorDark}33)` }}
                  >
                    <Sparkles size={14} />
                    Enter Zen Mode
                  </button>
                  <p className="text-xs text-zinc-500 text-center mt-2">
                    Full screen visualizer only
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-full transition-colors hover:opacity-80"
            style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
          >
            <Settings size={18} />
          </button>

        </div>
      </div>

      {/* Listeners & Chat Panel - Hidden in zen mode */}
      {showListenersPanel && !zenMode && (
        <div
          className="absolute top-16 right-4 z-50 w-80 max-h-[70vh] bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden"
          style={{ backgroundImage: accentPanelGradient(accentColor) }}
        >
          {/* Panel Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-white/10">
            <div className="flex items-center gap-2">
              <Users size={16} style={{ color: accentColor }} />
              <span className="font-medium text-sm">Listeners ({radio.listenerCount})</span>
            </div>
            <button
              onClick={() => setShowListenersPanel(false)}
              className="p-1 hover:bg-zinc-100 dark:hover:bg-white/10 rounded transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Listeners List */}
          <div className="px-4 py-2 border-b border-zinc-200 dark:border-white/10 max-h-32 overflow-y-auto">
            {radio.listeners.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {radio.listeners.map((listener) => (
                  <span
                    key={listener.id}
                    className={`px-2 py-1 rounded-full text-xs ${
                      listener.id === radio.ownerId
                        ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
                        : listener.id === radio.listenerId
                        ? ''
                        : 'bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-300'
                    }`}
                    style={listener.id === radio.listenerId && listener.id !== radio.ownerId ? { backgroundColor: `${accentColor}33`, color: accentColor } : undefined}
                  >
                    {listener.id === radio.ownerId && <Crown size={10} className="inline mr-1" />}
                    {listener.name}
                    {listener.id === radio.listenerId && ' (you)'}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 text-sm">No listeners yet</p>
            )}
          </div>

          {/* Chat Messages */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto px-4 py-2 space-y-2 min-h-[150px] max-h-[300px]"
          >
            {radio.chatMessages.length > 0 ? (
              radio.chatMessages.map((msg) => (
                <div key={msg.id} className="text-sm">
                  <span
                    className={`font-medium ${msg.senderId !== radio.listenerId ? 'text-zinc-500 dark:text-zinc-400' : ''}`}
                    style={msg.senderId === radio.listenerId ? { color: accentColor } : undefined}
                  >
                    {msg.senderName}:
                  </span>{' '}
                  <span className="text-zinc-700 dark:text-zinc-300">{msg.message}</span>
                </div>
              ))
            ) : (
              <p className="text-zinc-500 text-xs text-center py-4">No messages yet. Start the conversation!</p>
            )}
          </div>

          {/* Chat Input */}
          <div className="px-4 py-3 border-t border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyPress={handleChatKeyPress}
                placeholder="Type a message..."
                className="flex-1 bg-white dark:bg-white/10 border border-zinc-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1"
                style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
                maxLength={200}
              />
              <button
                onClick={handleSendChat}
                disabled={!chatMessage.trim()}
                className="p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:opacity-90"
                style={{ backgroundColor: accentColor, color: accentTextColor }}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowMobileSidebar(false)}
          />
          {/* Sidebar */}
          <div
            className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-white/10 flex flex-col"
            style={{ backgroundImage: accentPanelGradient(accentColor) }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-white/10">
              <h3 className="font-semibold">Queue & History</h3>
              <button
                onClick={() => setShowMobileSidebar(false)}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-200 dark:border-white/10">
              <button
                onClick={() => setActiveTab('queue')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'queue'
                    ? 'text-zinc-900 dark:text-white border-b-2'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
                style={activeTab === 'queue' ? { borderBottomColor: accentColor } : undefined}
              >
                <ListMusic size={14} className="inline mr-2" />
                Queue ({radio.queue.filter(s => !s.isAutoDJ).length || (radio.queue.length > 0 ? 'Auto-DJ' : 0)})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'history'
                    ? 'text-zinc-900 dark:text-white border-b-2'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
                style={activeTab === 'history' ? { borderBottomColor: accentColor } : undefined}
              >
                <History size={14} className="inline mr-2" />
                History ({radio.history.length})
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'queue' ? (
                (() => {
                  const userSongs = radio.queue.filter(s => !s.isAutoDJ);
                  if (userSongs.length > 0) {
                    return userSongs.map((song, i) => (
                      <div
                        key={song.id}
                        onClick={() => {
                          setSelectedSong(song);
                          setShowMobileSidebar(false);
                        }}
                        className="flex items-center gap-3 p-3 border-b border-zinc-100 dark:border-white/5 active:bg-zinc-100 dark:active:bg-white/5"
                      >
                        <span className="text-zinc-500 text-xs w-5">{i + 1}</span>
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                          {song.coverUrl ? (
                            <img src={song.coverUrl} className="w-full h-full object-cover" />
                          ) : (
                            <AlbumCover seed={song.id} size="full" className="w-full h-full" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{song.title}</p>
                          <p className="text-xs text-zinc-500 truncate">{song.creator || 'Unknown'}</p>
                        </div>
                      </div>
                    ));
                  }
                  // Show Auto-DJ notice if only Auto-DJ songs
                  if (radio.queue.length > 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: `linear-gradient(to bottom right, ${accentColor}33, ${accentColorDark}33)` }}>
                          <Radio size={24} style={{ color: accentColor }} />
                        </div>
                        <p className="text-sm" style={{ color: accentColor }}>Auto-DJ Active</p>
                        <p className="text-xs mt-1">Songs generated automatically</p>
                      </div>
                    );
                  }
                  if (radio.isAutoGenerating) {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                        <div className="flex items-end gap-[3px] h-8 mb-3">
                          {[0, 1, 2, 3, 4, 5, 6].map(i => (
                            <div
                              key={i}
                              className="w-1 rounded-full"
                              style={{
                                backgroundColor: accentColor,
                                animation: `genBar 1.2s ease-in-out ${i * 0.1}s infinite alternate`,
                              }}
                            />
                          ))}
                        </div>
                        <p className="text-sm font-medium" style={{ color: accentColor }}>Creating next song...</p>
                      </div>
                    );
                  }
                  return (
                    <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                      <ListMusic size={32} className="mb-2 opacity-50" />
                      <p className="text-sm">Queue is empty</p>
                    </div>
                  );
                })()
              ) : (
                radio.history.length > 0 ? (
                  radio.history.map((song, i) => (
                    <div
                      key={`${song.id}-${i}`}
                      onClick={() => {
                        setSelectedSong(song);
                        setShowMobileSidebar(false);
                      }}
                      className="flex items-center gap-3 p-3 border-b border-zinc-100 dark:border-white/5 active:bg-zinc-100 dark:active:bg-white/5"
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                        {song.coverUrl ? (
                          <img src={song.coverUrl} className="w-full h-full object-cover" />
                        ) : (
                          <AlbumCover seed={song.id} size="full" className="w-full h-full" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{song.title}</p>
                        <p className="text-xs text-zinc-500 truncate">{song.creator || 'Unknown'}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          radio.requeueSong(song.id);
                        }}
                        className="p-2 rounded-full hover:opacity-80"
                        style={{ backgroundColor: `${accentColor}33`, color: accentColor }}
                        title="Add to queue"
                      >
                        <ListPlus size={14} />
                      </button>
                      <a
                        href={song.audioUrl}
                        download={`${song.title || 'song'}.mp3`}
                        className="p-2 rounded-full bg-zinc-100 dark:bg-white/10 text-zinc-500 dark:text-zinc-400"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download size={14} />
                      </a>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                    <History size={32} className="mb-2 opacity-50" />
                    <p className="text-sm">No history yet</p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Desktop: main + collapsible sidebar, Mobile: stacked - Hidden in zen mode */}
      <div className={`relative z-10 flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden min-h-0 transition-all duration-700 ${zenMode ? 'opacity-0 pointer-events-none scale-[0.98]' : ''} ${!streamPlaying ? 'opacity-0 pointer-events-none' : !zenMode ? 'opacity-100 scale-100' : ''}`}>

        {/* Main Area: Album Cover + Generation (vertically stacked) */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          <div className="flex-1 flex flex-col items-center justify-center p-4 lg:p-8">
            {/* Now Playing Section */}
            <div className={`w-full ${npScale.container} mx-auto`}>
              {/* Album Art + Song Info + Mode Buttons Row */}
              <div className="flex flex-col lg:flex-row items-center place-self-center gap-6 mb-6">
                {/* Album Art */}
                <div className="relative shrink-0">
                  <div
                    className="rounded-2xl overflow-hidden shadow-2xl shadow-black/30 dark:shadow-black/50 relative bg-zinc-200 dark:bg-zinc-900 group"
                    style={{ width: `min(${npScale.artPx}px, 80vw)`, height: `min(${npScale.artPx}px, 80vw)` }}
                  >
                    {radio.currentSong ? (
                      <AlbumCover seed={radio.currentSong.id} size="full" className="absolute inset-0 w-full h-full" />
                    ) : (
                      <DiffusionPlaceholder className="absolute inset-0 w-full h-full" />
                    )}
                    {coverLayers.layer1 && (
                      <img
                        src={coverLayers.layer1}
                        alt=""
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${
                          coverLayers.activeLayer === 1 ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                    )}
                    {coverLayers.layer2 && (
                      <img
                        src={coverLayers.layer2}
                        alt=""
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${
                          coverLayers.activeLayer === 2 ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                    )}
                    {radio.currentSong?.audioUrl && (
                      <a
                        href={radio.currentSong.audioUrl}
                        download={`${radio.currentSong.title || 'song'}.mp3`}
                        className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors opacity-0 group-hover:opacity-100 z-10"
                        title="Download song"
                      >
                        <Download size={28} className="text-white drop-shadow-lg" />
                      </a>
                    )}
                  </div>
                  {radio.currentSong && (
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
                      {streamPlaying && (
                        <div className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium hover:opacity-80 transition-colors" style={{ backgroundColor: accentColor, color: accentTextColor }}>
                          <div className="flex items-end gap-[2px] h-[10px]">
                            {[0, 1, 2].map(i => (
                              <div
                                key={i}
                                className="w-[2px] rounded-full"
                                style={{
                                  backgroundColor: accentTextColor,
                                  animation: `genBar 1.2s ease-in-out ${i * 0.15}s infinite alternate`,
                                }}
                              />
                            ))}
                          </div>
                          LIVE
                        </div>
                      )}
                      {radio.currentSong.lyrics && radio.currentSong.lyrics !== '[Instrumental]' && (
                        <button
                          onClick={() => setShowLyrics(true)}
                          className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium hover:opacity-80 transition-colors"
                          style={{ backgroundColor: accentColor, color: accentTextColor }}
                        >
                          <AlignLeft size={10} />
                          Lyrics
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Song Info */}
                <div className="flex-1 text-center lg:text-left min-w-0">
                  {radio.currentSong ? (
                    <>
                      <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-1">Now Playing</p>
                      <h1 className={`${npScale.title} font-bold mb-1 truncate`}>{radio.currentSong.title}</h1>
                      <p className={`text-zinc-600 dark:text-zinc-400 ${npScale.artist}`}>{radio.currentSong.creator || 'Unknown Artist'}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-1">Now Playing</p>
                      <h1 className={`${npScale.title} font-bold mb-1 text-zinc-400 dark:text-zinc-500`}>No Song Playing</h1>
                      <p className={`text-zinc-500 dark:text-zinc-600 ${npScale.artist}`}>Generate a song to start the radio</p>
                    </>
                  )}

                  {/* Up Next Preview - Desktop when sidebar collapsed */}
                  {sidebarCollapsed && (
                    <div className="hidden lg:block mt-3">
                      <button
                        onClick={toggleSidebar}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-full transition-all duration-200 text-left group"
                        style={
                          (radio.isAutoGenerating || isGenerating)
                            ? { background: `linear-gradient(to right, ${accentColor}, ${accentColorDark})`, boxShadow: `0 0 12px 2px ${accentColor}60, 0 0 24px 6px ${accentColor}30`, color: accentTextColor }
                            : radio.queue.length > 0 && !radio.queue[0].isAutoDJ
                            ? { background: `linear-gradient(to right, ${accentColor}18, ${accentColorDark}18)`, border: `1px solid ${accentColor}30` }
                            : radio.queue.length > 0
                            ? { background: `linear-gradient(to right, ${accentColor}12, ${accentColorDark}12)`, border: `1px solid ${accentColor}20` }
                            : { background: `linear-gradient(to right, ${accentColor}08, ${accentColorDark}08)`, border: `1px solid ${accentColor}15` }
                        }
                      >
                        {(radio.isAutoGenerating || isGenerating) ? (
                          <>
                            <div className="flex items-end gap-[2px] h-4 flex-shrink-0">
                              {[0, 1, 2, 3, 4].map(i => (
                                <div
                                  key={i}
                                  className="w-[3px] rounded-full"
                                  style={{
                                    backgroundColor: accentTextColor,
                                    animation: `genBar 1.2s ease-in-out ${i * 0.1}s infinite alternate`,
                                  }}
                                />
                              ))}
                            </div>
                            <span className="text-xs font-semibold flex-1 truncate">Creating song...</span>
                            <Sparkles size={12} className="animate-pulse flex-shrink-0 opacity-80" />
                          </>
                        ) : radio.queue.length > 0 && !radio.queue[0].isAutoDJ ? (
                          <>
                            <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 ring-2" style={{ ringColor: `${accentColor}40` }}>
                              {radio.queue[0].coverUrl ? (
                                <img src={radio.queue[0].coverUrl} className="w-full h-full object-cover" />
                              ) : (
                                <AlbumCover seed={radio.queue[0].id} size="full" className="w-full h-full" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold truncate">{radio.queue[0].title}</p>
                            </div>
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>{radio.queue.filter(s => !s.isAutoDJ).length}</span>
                            <PanelRightOpen size={14} className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 flex-shrink-0" />
                          </>
                        ) : radio.queue.length > 0 ? (
                          <>
                            <Radio size={14} className="flex-shrink-0" style={{ color: accentColor }} />
                            <span className="text-xs font-semibold flex-1" style={{ color: accentColor }}>Auto-DJ</span>
                            <PanelRightOpen size={14} className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 flex-shrink-0" />
                          </>
                        ) : (
                          <>
                            <Radio size={14} className="flex-shrink-0 text-zinc-400" />
                            <span className="text-xs font-medium text-zinc-400 flex-1">Empty Queue</span>
                            <PanelRightOpen size={14} className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 flex-shrink-0" />
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Up Next Preview - Mobile Only */}
                  <div className="lg:hidden mt-3">
                    <button
                      onClick={() => setShowMobileSidebar(true)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-full transition-all duration-200 text-left group"
                      style={
                        (radio.isAutoGenerating || isGenerating)
                          ? { background: `linear-gradient(to right, ${accentColor}, ${accentColorDark})`, boxShadow: `0 0 12px 2px ${accentColor}60, 0 0 24px 6px ${accentColor}30`, color: accentTextColor }
                          : radio.queue.length > 0 && !radio.queue[0].isAutoDJ
                          ? { background: `linear-gradient(to right, ${accentColor}18, ${accentColorDark}18)`, border: `1px solid ${accentColor}30` }
                          : radio.queue.length > 0
                          ? { background: `linear-gradient(to right, ${accentColor}12, ${accentColorDark}12)`, border: `1px solid ${accentColor}20` }
                          : { background: `linear-gradient(to right, ${accentColor}08, ${accentColorDark}08)`, border: `1px solid ${accentColor}15` }
                      }
                    >
                      {(radio.isAutoGenerating || isGenerating) ? (
                        <>
                          <div className="flex items-end gap-[2px] h-4 flex-shrink-0">
                            {[0, 1, 2, 3, 4].map(i => (
                              <div
                                key={i}
                                className="w-[3px] rounded-full"
                                style={{
                                  backgroundColor: accentTextColor,
                                  animation: `genBar 1.2s ease-in-out ${i * 0.1}s infinite alternate`,
                                }}
                              />
                            ))}
                          </div>
                          <span className="text-xs font-semibold flex-1 truncate">Creating song...</span>
                          <Sparkles size={12} className="animate-pulse flex-shrink-0 opacity-80" />
                        </>
                      ) : radio.queue.length > 0 && !radio.queue[0].isAutoDJ ? (
                        <>
                          <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 ring-2" style={{ ringColor: `${accentColor}40` }}>
                            {radio.queue[0].coverUrl ? (
                              <img src={radio.queue[0].coverUrl} className="w-full h-full object-cover" />
                            ) : (
                              <AlbumCover seed={radio.queue[0].id} size="full" className="w-full h-full" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">{radio.queue[0].title}</p>
                          </div>
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>{radio.queue.filter(s => !s.isAutoDJ).length}</span>
                          <ChevronRight size={14} className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 flex-shrink-0" />
                        </>
                      ) : radio.queue.length > 0 ? (
                        <>
                          <Radio size={14} className="flex-shrink-0" style={{ color: accentColor }} />
                          <span className="text-xs font-semibold flex-1" style={{ color: accentColor }}>Auto-DJ</span>
                          <ChevronRight size={14} className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 flex-shrink-0" />
                        </>
                      ) : (
                        <>
                          <Radio size={14} className="flex-shrink-0 text-zinc-400" />
                          <span className="text-xs font-medium text-zinc-400 flex-1">Empty Queue</span>
                          <ChevronRight size={14} className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 flex-shrink-0" />
                        </>
                      )}
                    </button>
                  </div>

                  {/* Mode buttons */}
                  <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mt-3">
                    {(interactionMode === 'vibe'
                      ? [{ key: 'simple' as const, label: 'Make', icon: true }, { key: 'instruct' as const, label: 'Change', icon: true }]
                      : [{ key: 'simple' as const, label: 'Simple', icon: false }, { key: 'custom' as const, label: 'Custom', icon: false }]
                    ).map(tab => {
                      const isActive = formOpen && mode === tab.key;
                      return (
                        <button
                          key={tab.key}
                          onClick={() => {
                            if (mode === tab.key && formOpen) {
                              closeForm();
                            } else {
                              setMode(tab.key);
                              setFormOpen(true);
                              setFormClosing(false);
                              resetFormIdleTimer();
                            }
                          }}
                          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 ${
                            isActive
                              ? ''
                              : 'hover:opacity-80'
                          }`}
                          style={isActive
                            ? { background: `linear-gradient(to right, ${accentColor}, ${accentColorDark})`, boxShadow: `0 0 12px 2px ${accentColor}80, 0 0 24px 6px ${accentColor}40, 0 0 60px 18px ${accentColor}20, 0 0 36px 12px ${accentColor}30`, color: accentTextColor }
                            : { backgroundColor: accentColor, boxShadow: `0 0 8px 1px ${accentColor}50, 0 0 16px 4px ${accentColor}25, 0 0 24px 8px ${accentColor}15`, color: accentTextColor }
                          }
                        >
                          {tab.icon && <Sparkles size={12} className={isActive ? 'animate-pulse' : ''} />}
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>


              {/* Generation Form - smooth height animation via CSS grid */}
              <div
                className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
                style={{ gridTemplateRows: formOpen ? '1fr' : '0fr', opacity: formOpen ? 1 : 0 }}
              >
              <div
                className="overflow-hidden min-h-0"
                onMouseMove={formOpen ? resetFormIdleTimer : undefined}
                onKeyDown={formOpen ? resetFormIdleTimer : undefined}
              >
                <div className="bg-white dark:bg-white/5 backdrop-blur rounded-2xl p-5 border border-zinc-200 dark:border-white/10 shadow-sm dark:shadow-none">
                  {/* Vibe Mode - Make tab */}
                  {interactionMode === 'vibe' && mode === 'simple' && (
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="describe anything... a rainy night in tokyo, the feeling after a first kiss, 90s video game music..."
                      className="w-full bg-transparent placeholder-zinc-400 dark:placeholder-zinc-500 resize-none focus:outline-none text-sm"
                      rows={3}
                    />
                  )}

                  {/* Vibe Mode - Change tab */}
                  {interactionMode === 'vibe' && mode === 'instruct' && (
                    <div className="space-y-4">
                      {/* Starting point */}
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2 flex items-center gap-2">
                            <span className="text-purple-400">{'\u25C8'}</span>
                            starting point
                          </p>
                          <textarea
                            value={style || description}
                            onChange={(e) => {
                              setStyle(e.target.value);
                              setDescription(e.target.value);
                            }}
                            placeholder="a late night jazz session... indie rock with shoegaze influences... lo-fi beats for a rainy day..."
                            className="w-full bg-zinc-100 dark:bg-white/5 rounded-xl px-4 py-3 placeholder-zinc-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-1 text-sm"
                            style={{ '--tw-ring-color': '#a855f7' } as React.CSSProperties}
                            rows={2}
                          />
                        </div>
                      </div>

                      {/* Vibe Pills */}
                      <div className="pt-3 border-t border-zinc-200 dark:border-white/10">
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-3 flex items-center gap-2">
                          <Sparkles size={12} className="text-purple-400" />
                          tap the vibes
                        </p>

                        <div className="flex flex-wrap gap-1.5">
                          {VIBE_PILLS.map((vibe) => {
                            const isSelected = instructEffects.includes(vibe);
                            const isLong = vibe.length > 8;
                            const isShort = vibe.length < 5;

                            return (
                              <button
                                key={vibe}
                                onClick={() => toggleEffect(vibe)}
                                className={`
                                  ${isShort ? 'px-2.5 py-1' : isLong ? 'px-4 py-1.5' : 'px-3 py-1'}
                                  rounded-full text-xs font-medium transition-all duration-200
                                  ${isSelected
                                    ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white shadow-lg shadow-purple-500/25 scale-105'
                                    : 'bg-zinc-100 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/10 hover:text-zinc-700 dark:hover:text-zinc-200'
                                  }
                                `}
                              >
                                {vibe}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Custom Instruction */}
                      <div className="pt-3 border-t border-zinc-200 dark:border-white/10">
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2 flex items-center gap-2">
                          <span className="text-purple-400">{'\u2726'}</span>
                          or tell me anything
                        </p>
                        <textarea
                          value={customInstruction}
                          onChange={(e) => setCustomInstruction(e.target.value)}
                          placeholder="add a saxophone solo... make it sound like driving at night... more reverb on the vocals..."
                          className="w-full bg-zinc-100 dark:bg-white/5 rounded-xl px-4 py-3 placeholder-zinc-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-1 text-sm"
                          style={{ '--tw-ring-color': '#a855f7' } as React.CSSProperties}
                          rows={2}
                        />
                      </div>

                      {/* Selected vibes summary */}
                      {(instructEffects.length > 0 || customInstruction) && (
                        <div className="pt-3 border-t border-zinc-200 dark:border-white/10">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 italic">vibes:</span>
                            {instructEffects.map(effect => (
                              <span key={effect} className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300">
                                {effect}
                              </span>
                            ))}
                            {customInstruction && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-400">
                                + custom
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Create Mode - Simple tab */}
                  {interactionMode === 'create' && mode === 'simple' && (
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe the song you want to create... (e.g., 'an upbeat summer pop song about road trips')"
                      className="w-full bg-transparent placeholder-zinc-400 dark:placeholder-zinc-500 resize-none focus:outline-none"
                      rows={3}
                    />
                  )}

                  {/* Create Mode - Custom tab */}
                  {interactionMode === 'create' && mode === 'custom' && (
                    <div className="space-y-4">
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Song title"
                        className="w-full bg-zinc-100 dark:bg-white/5 rounded-lg px-4 py-3 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1"
                        style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
                      />
                      <textarea
                        value={style}
                        onChange={(e) => setStyle(e.target.value)}
                        placeholder="Style of music (e.g., upbeat pop, acoustic folk, electronic dance)"
                        className="w-full bg-zinc-100 dark:bg-white/5 rounded-lg px-4 py-3 placeholder-zinc-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-1"
                        style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
                        rows={2}
                      />
                      <textarea
                        value={lyrics}
                        onChange={(e) => setLyrics(e.target.value)}
                        placeholder="Lyrics (optional)"
                        className="w-full bg-zinc-100 dark:bg-white/5 rounded-lg px-4 py-3 placeholder-zinc-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-1"
                        style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
                        rows={3}
                      />
                    </div>
                  )}

                  {/* Options Row */}
                  <div className={`flex flex-wrap items-center ${interactionMode === 'vibe' ? 'justify-end' : 'justify-between'} gap-4 mt-4 pt-4 border-t border-zinc-200 dark:border-white/10`}>
                    {/* Language & Instrumental - hidden in AI mode (LLM decides these) */}
                    {interactionMode !== 'vibe' && (
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Language */}
                        <select
                          value={language}
                          onChange={(e) => setLanguage(e.target.value)}
                          className="bg-zinc-100 dark:bg-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none cursor-pointer"
                        >
                          {VOCAL_LANGUAGES.map((l) => (
                            <option key={l.value} value={l.value} className="bg-white dark:bg-zinc-800">
                              {l.label}
                            </option>
                          ))}
                        </select>

                        {/* Instrumental Toggle */}
                        <button
                          onClick={() => setInstrumental(!instrumental)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                            instrumental ? '' : 'bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                          }`}
                          style={instrumental ? { backgroundColor: accentColor, color: accentTextColor } : undefined}
                        >
                          <Music2 size={14} />
                          Instrumental
                        </button>
                      </div>
                    )}

                    {/* Generate Button */}
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating || (
                        mode === 'simple' ? !description.trim() :
                        mode === 'custom' ? !style.trim() :
                        (!style.trim() && !description.trim() && instructEffects.length === 0 && !customInstruction.trim())
                      )}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-full font-medium hover:opacity-90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: `linear-gradient(to right, ${accentColor}, ${accentColorDark})`,
                        color: accentTextColor
                      }}
                    >
                      {isGenerating ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          {interactionMode === 'vibe' ? 'creating...' : 'Generating...'}
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} />
                          {interactionMode === 'vibe' ? 'make it' : 'Generate'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Queue/History (Desktop) - Collapsible */}
        <div className={`hidden lg:flex flex-col bg-zinc-50/90 dark:bg-black/30 backdrop-blur-md transition-all duration-300 ${
          sidebarCollapsed ? 'w-12' : 'w-80 xl:w-96'
        }`}>
          {/* Collapse Toggle */}
          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center h-11 transition-colors hover:opacity-80"
            style={{ color: accentColor }}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
          </button>

          {!sidebarCollapsed && (
            <>
              {/* Tabs - pill style */}
              <div className="flex gap-1 mx-3 mb-3 p-1 rounded-xl bg-zinc-100 dark:bg-white/5">
                <button
                  onClick={() => setActiveTab('queue')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    activeTab === 'queue'
                      ? 'shadow-sm text-white'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-white/50 dark:hover:bg-white/5'
                  }`}
                  style={activeTab === 'queue' ? { backgroundColor: accentColor, color: accentTextColor } : undefined}
                >
                  <ListMusic size={13} />
                  Queue
                  {radio.queue.filter(s => !s.isAutoDJ).length > 0 ? (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === 'queue' ? 'bg-white/25' : 'bg-zinc-200 dark:bg-white/10'}`}>
                      {radio.queue.filter(s => !s.isAutoDJ).length}
                    </span>
                  ) : radio.queue.length > 0 ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: activeTab === 'queue' ? 'rgba(255,255,255,0.25)' : `${accentColor}25`, color: activeTab === 'queue' ? undefined : accentColor }}>DJ</span>
                  ) : null}
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    activeTab === 'history'
                      ? 'shadow-sm text-white'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-white/50 dark:hover:bg-white/5'
                  }`}
                  style={activeTab === 'history' ? { backgroundColor: accentColor, color: accentTextColor } : undefined}
                >
                  <History size={13} />
                  History
                  {radio.history.length > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === 'history' ? 'bg-white/25' : 'bg-zinc-200 dark:bg-white/10'}`}>
                      {radio.history.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto px-2 pb-2">
                {activeTab === 'queue' ? (
                  // Queue List - filter out Auto-DJ songs
                  (() => {
                    const userSongs = radio.queue.filter(s => !s.isAutoDJ);
                    if (userSongs.length > 0) {
                      return (
                        <div className="space-y-1">
                          {userSongs.map((song, i) => (
                            <div
                              key={song.id}
                              onClick={() => setSelectedSong(song)}
                              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                            >
                              <span className="text-zinc-400 dark:text-zinc-600 text-[10px] font-bold w-4 text-center">{i + 1}</span>
                              <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 shadow-sm">
                                {song.coverUrl ? (
                                  <img src={song.coverUrl} className="w-full h-full object-cover" />
                                ) : (
                                  <AlbumCover seed={song.id} size="full" className="w-full h-full" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{song.title}</p>
                                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">{song.creator || 'Unknown'}</p>
                              </div>
                              <button
                                className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                title="View details"
                              >
                                <Info size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    // Show Auto-DJ notice if only Auto-DJ songs in queue
                    if (radio.queue.length > 0) {
                      return (
                        <div className="flex flex-col items-center justify-center h-full p-6">
                          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg" style={{ background: `linear-gradient(to bottom right, ${accentColor}, ${accentColorDark})` }}>
                            <Radio size={22} style={{ color: accentTextColor }} />
                          </div>
                          <p className="text-sm font-semibold" style={{ color: accentColor }}>Auto-DJ Active</p>
                          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 text-center">Songs are being generated automatically</p>
                        </div>
                      );
                    }
                    return null;
                  })()
                ) || (radio.isAutoGenerating ? (
                    <div className="flex flex-col items-center justify-center h-full p-6">
                      <div className="flex items-end gap-[3px] h-10 mb-4">
                        {[0, 1, 2, 3, 4, 5, 6].map(i => (
                          <div
                            key={i}
                            className="w-1.5 rounded-full"
                            style={{
                              backgroundColor: accentColor,
                              animation: `genBar 1.2s ease-in-out ${i * 0.1}s infinite alternate`,
                            }}
                          />
                        ))}
                      </div>
                      <p className="text-sm font-semibold" style={{ color: accentColor }}>Creating next song...</p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Auto-DJ is composing</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-400 dark:text-zinc-600 p-6">
                      <ListMusic size={28} className="mb-3 opacity-40" />
                      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Queue is empty</p>
                      <p className="text-xs mt-1">Generate a song to add it</p>
                    </div>
                  )
                ) : (
                  // History List
                  radio.history.length > 0 ? (
                    <div className="space-y-1">
                      {radio.history.map((song, i) => (
                        <div
                          key={`${song.id}-${i}`}
                          onClick={() => setSelectedSong(song)}
                          className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors group cursor-pointer"
                        >
                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 shadow-sm">
                            {song.coverUrl ? (
                              <img src={song.coverUrl} className="w-full h-full object-cover" />
                            ) : (
                              <AlbumCover seed={song.id} size="full" className="w-full h-full" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{song.title}</p>
                            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">{song.creator || 'Unknown'}</p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                radio.requeueSong(song.id);
                              }}
                              className="p-1.5 rounded-lg transition-colors hover:opacity-80"
                              style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                              title="Add to queue"
                            >
                              <ListPlus size={13} />
                            </button>
                            <button
                              className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors"
                              title="View details"
                            >
                              <Info size={13} />
                            </button>
                            <a
                              href={song.audioUrl}
                              download={`${song.title || 'song'}.mp3`}
                              className="p-1.5 rounded-lg bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors"
                              title="Download"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Download size={13} />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-400 dark:text-zinc-600 p-6">
                      <History size={28} className="mb-3 opacity-40" />
                      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No history yet</p>
                      <p className="text-xs mt-1">Played songs will appear here</p>
                    </div>
                  )
                )}
              </div>
            </>
          )}
        </div>
      </div>


      {/* Player Bar - Hidden in zen mode */}
      <div className={`relative z-10 shrink-0 border-t border-zinc-200 dark:border-white/10 bg-white/90 dark:bg-black/90 backdrop-blur transition-all duration-700 ${zenMode ? 'opacity-0 pointer-events-none translate-y-4' : ''} ${!streamPlaying ? 'opacity-0 pointer-events-none' : !zenMode ? 'opacity-100 translate-y-0' : ''}`} style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {/* Live indicator line - distorts when generating */}
        <div className="relative h-1">
          {streamPlaying && (
            <svg
              className={`absolute left-0 right-0 w-full transition-all duration-500 ${(isGenerating || radio.isAutoGenerating) ? 'h-6 -top-3' : 'h-1 top-0'}`}
              viewBox={(isGenerating || radio.isAutoGenerating) ? '0 0 1200 24' : '0 0 1200 4'}
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={accentColor} />
                  <stop offset="50%" stopColor={accentColorDark} />
                  <stop offset="100%" stopColor={accentColor} />
                </linearGradient>
                <linearGradient id="lineGradAnim" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={accentColor}>
                    <animate attributeName="stop-color" dur="5s" repeatCount="indefinite" values={`${accentColor};${accentColorDark};white;${accentColor}`} />
                  </stop>
                  <stop offset="50%" stopColor={accentColorDark}>
                    <animate attributeName="stop-color" dur="5s" repeatCount="indefinite" values={`${accentColorDark};white;${accentColor};${accentColorDark}`} />
                  </stop>
                  <stop offset="100%" stopColor={accentColor}>
                    <animate attributeName="stop-color" dur="5s" repeatCount="indefinite" values={`${accentColor};${accentColor};${accentColorDark};${accentColor}`} />
                  </stop>
                </linearGradient>
                <filter id="bloom">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {(isGenerating || radio.isAutoGenerating) ? (
                <>
                  {/* Bloom glow layer */}
                  <path
                    stroke="url(#lineGradAnim)"
                    strokeWidth="4"
                    fill="none"
                    opacity="0.4"
                    filter="url(#bloom)"
                  >
                    <animate
                      attributeName="d"
                      dur="7s"
                      repeatCount="indefinite"
                      values="
                        M0,12 Q100,2 200,12 Q300,22 400,12 Q500,2 600,12 Q700,22 800,12 Q900,2 1000,12 Q1100,22 1200,12;
                        M0,12 Q100,22 200,12 Q300,2 400,12 Q500,22 600,12 Q700,2 800,12 Q900,22 1000,12 Q1100,2 1200,12;
                        M0,12 Q100,2 200,12 Q300,22 400,12 Q500,2 600,12 Q700,22 800,12 Q900,2 1000,12 Q1100,22 1200,12
                      "
                    />
                  </path>
                  {/* Ghost wave - slower, offset phase */}
                  <path
                    stroke="url(#lineGradAnim)"
                    strokeWidth="2"
                    fill="none"
                    opacity="0.25"
                  >
                    <animate
                      attributeName="d"
                      dur="10s"
                      repeatCount="indefinite"
                      values="
                        M0,12 Q75,0 150,12 Q225,24 300,12 Q375,0 450,12 Q525,24 600,12 Q675,0 750,12 Q825,24 900,12 Q975,0 1050,12 Q1125,24 1200,12;
                        M0,12 Q75,24 150,12 Q225,0 300,12 Q375,24 450,12 Q525,0 600,12 Q675,24 750,12 Q825,0 900,12 Q975,24 1050,12 Q1125,0 1200,12;
                        M0,12 Q75,0 150,12 Q225,24 300,12 Q375,0 450,12 Q525,24 600,12 Q675,0 750,12 Q825,24 900,12 Q975,0 1050,12 Q1125,24 1200,12
                      "
                    />
                  </path>
                  {/* Main wave - faster, full opacity */}
                  <path
                    stroke="url(#lineGradAnim)"
                    strokeWidth="2.5"
                    fill="none"
                  >
                    <animate
                      attributeName="d"
                      dur="7s"
                      repeatCount="indefinite"
                      values="
                        M0,12 Q100,2 200,12 Q300,22 400,12 Q500,2 600,12 Q700,22 800,12 Q900,2 1000,12 Q1100,22 1200,12;
                        M0,12 Q100,22 200,12 Q300,2 400,12 Q500,22 600,12 Q700,2 800,12 Q900,22 1000,12 Q1100,2 1200,12;
                        M0,12 Q100,2 200,12 Q300,22 400,12 Q500,2 600,12 Q700,22 800,12 Q900,2 1000,12 Q1100,22 1200,12
                      "
                    />
                  </path>
                </>
              ) : (
                <rect x="0" y="1" width="1200" height="2" fill="url(#lineGrad)" />
              )}
            </svg>
          )}
        </div>

        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          {/* Left: Current Song */}
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            {radio.currentSong && (
              <>
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg overflow-hidden flex-shrink-0 relative bg-zinc-200 dark:bg-zinc-900">
                  <AlbumCover seed={radio.currentSong.id} size="full" className="absolute inset-0 w-full h-full" />
                  {coverLayers.layer1 && (
                    <img
                      src={coverLayers.layer1}
                      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                        coverLayers.activeLayer === 1 ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                  )}
                  {coverLayers.layer2 && (
                    <img
                      src={coverLayers.layer2}
                      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                        coverLayers.activeLayer === 2 ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                  )}
                </div>
                <div className="min-w-0 hidden sm:block">
                  <p className="text-sm font-medium truncate">{radio.currentSong.title}</p>
                  <p className="text-xs text-zinc-500 truncate">{radio.currentSong.creator || 'Unknown'}</p>
                </div>
                {radio.currentSong.audioUrl && (
                  <a
                    href={radio.currentSong.audioUrl}
                    download={`${radio.currentSong.title || 'song'}.mp3`}
                    className="hidden sm:block p-1.5 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors flex-shrink-0"
                    title="Download song"
                  >
                    <Download size={14} />
                  </a>
                )}
              </>
            )}
          </div>

          {/* Center: Controls */}
          <div className="flex items-center gap-2 sm:gap-3 flex-1 sm:flex-none justify-center">
            {/* DJ Style vote button - to the left of play */}
            {radio.settings.autoDjFreshLLM && radio.settings.useLLM && (
              <div className="relative">
                <button
                  onClick={() => !radio.settings.autoDjStyleLocked && setShowDjStyleMenu(prev => !prev)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-full transition-colors text-sm ${
                    radio.settings.autoDjStyleLocked
                      ? 'bg-zinc-100 dark:bg-white/10 text-zinc-400 dark:text-zinc-500 cursor-default'
                      : showDjStyleMenu
                        ? ''
                        : 'hover:opacity-80'
                  }`}
                  style={radio.settings.autoDjStyleLocked
                    ? undefined
                    : showDjStyleMenu
                      ? { backgroundColor: `${accentColor}20`, color: accentColor }
                      : { backgroundColor: `${accentColor}15`, color: accentColor }}
                  title={radio.settings.autoDjStyleLocked ? 'DJ Style locked by admin' : 'Vote on DJ style'}
                >
                  <Radio size={16} />
                  <span className="hidden sm:inline capitalize">{radio.settings.autoDjStyle || 'explore'}</span>
                  {radio.settings.autoDjStyleLocked && <span className="text-xs">locked</span>}
                </button>
                {/* Dropdown menu */}
                {showDjStyleMenu && !radio.settings.autoDjStyleLocked && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowDjStyleMenu(false)} />
                    <div
                      className="absolute bottom-full left-0 mb-2 w-56 bg-white dark:bg-zinc-900 rounded-xl border shadow-xl z-50 overflow-hidden border-zinc-200 dark:border-zinc-700"
                      style={{ backgroundImage: accentPanelGradient(accentColor, 'center') }}
                    >
                      <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          Vote for DJ Style ({radio.djStyleVoteRequired} needed)
                        </p>
                      </div>
                      {([
                        { key: 'explore' as const, label: 'Explore', desc: 'Each song is distinctly different' },
                        { key: 'similar' as const, label: 'Similar Vibe', desc: 'Same genre/mood, new song' },
                        { key: 'consistent' as const, label: 'Stay Close', desc: 'Closely match current style' },
                      ]).map(({ key, label, desc }) => {
                        const isActive = radio.settings.autoDjStyle === key;
                        const count = radio.djStyleVotes[key];
                        return (
                          <button
                            key={key}
                            onClick={() => { radio.voteDjStyle(key); setShowDjStyleMenu(false); }}
                            className={`w-full text-left px-3 py-2.5 flex items-center justify-between transition-colors ${
                              isActive
                                ? ''
                                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            }`}
                            style={isActive ? { backgroundColor: `${accentColor}10` } : undefined}
                          >
                            <div className="min-w-0">
                              <p className={`text-sm font-medium ${isActive ? '' : 'text-zinc-900 dark:text-zinc-100'}`} style={isActive ? { color: accentColor } : undefined}>
                                {label}
                                {isActive && <span className="ml-1.5 text-xs font-normal" style={{ color: accentColor }}>(current)</span>}
                              </p>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">{desc}</p>
                            </div>
                            {count > 0 && (
                              <span className={`ml-2 flex-shrink-0 min-w-[20px] h-5 flex items-center justify-center rounded-full text-xs font-medium ${
                                isActive ? '' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                              }`}
                              style={isActive ? { backgroundColor: `${accentColor}20`, color: accentColor } : undefined}>
                                {count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
            {/* Play button with tooltip */}
            <div className="relative">
              {!streamPlaying && (
                <div className="absolute bottom-full left-1/2 mb-2 whitespace-nowrap pointer-events-none z-10" style={{ transform: 'translateX(-50%)' }}>
                  <div className="text-xs font-medium px-3 py-1.5 rounded-full shadow-lg animate-pulse" style={{ backgroundColor: accentColor, color: accentTextColor }}>
                    Press to listen
                  </div>
                  <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent mx-auto" style={{ borderTopColor: accentColor }} />
                </div>
              )}
              <button
                onClick={handleStreamToggle}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center hover:scale-105 transition-transform"
                style={{
                  background: `linear-gradient(to right, ${accentColor}, ${accentColorDark})`,
                  boxShadow: `0 0 8px 1px ${accentColor}50, 0 0 16px 4px ${accentColor}25`,
                  color: accentTextColor,
                }}
              >
                {streamPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
              </button>
            </div>
            {/* Skip button - next to play */}
            {radio.currentSong && !radio.skipPending && (
              <button
                onClick={radio.voteSkip}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full transition-colors text-sm hover:opacity-80"
                style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                title="Vote to skip"
              >
                <SkipForward size={16} />
                <span className="hidden sm:inline">{radio.skipVotes}/{radio.skipRequired}</span>
              </button>
            )}
            {radio.currentSong && radio.skipPending && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-orange-500/20 text-orange-600 dark:text-orange-400 text-sm">
                <div className="w-3 h-3 border-2 border-orange-400/30 border-t-orange-500 dark:border-t-orange-400 rounded-full animate-spin" />
                <span className="hidden sm:inline">Skipping...</span>
              </div>
            )}
            {/* Owner force skip - desktop only */}
            {radio.isOwner && radio.currentSong && !radio.skipPending && (
              <button
                onClick={radio.ownerSkip}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-full bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-600 dark:text-yellow-400 transition-colors text-sm"
                title="Force skip (Admin)"
              >
                <Crown size={14} />
              </button>
            )}
            {/* Queue button - mobile/tablet */}
            <button
              onClick={() => setShowMobileSidebar(true)}
              className="lg:hidden p-2 rounded-full transition-colors hover:opacity-80 relative"
              style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
              title="Queue & History"
            >
              <ListMusic size={16} />
              {radio.queue.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center text-[10px] font-bold rounded-full px-1" style={{ backgroundColor: accentColor, color: accentTextColor }}>
                  {radio.queue.length}
                </span>
              )}
            </button>
          </div>

          {/* Right: Volume */}
          <div className="hidden sm:flex items-center gap-3 flex-1 justify-end">
            <button
              onClick={() => onVolumeChange(volume === 0 ? 0.8 : 0)}
              className={`transition-colors ${volume === 0 ? '' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
              style={volume === 0 ? { color: accentColor } : undefined}
            >
              {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <div className="relative w-24 h-1 bg-zinc-200 dark:bg-white/10 rounded-full group">
              <div
                className="h-full rounded-full pointer-events-none"
                style={{ width: `${volume * 100}%`, backgroundColor: accentColor }}
              />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Song Details Modal - Hidden in zen mode */}
      {selectedSong && !zenMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
            onClick={() => setSelectedSong(null)}
          />

          {/* Modal */}
          <div
            className="relative w-full max-w-lg max-h-[90vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col mx-4 border border-zinc-200 dark:border-white/10"
            style={{ backgroundImage: accentPanelGradient(accentColor) }}
          >
            {/* Header */}
            <div className="flex items-start gap-4 p-6 border-b border-zinc-200 dark:border-white/10">
              <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                {selectedSong.coverUrl ? (
                  <img src={selectedSong.coverUrl} className="w-full h-full object-cover" />
                ) : (
                  <AlbumCover seed={selectedSong.id} size="full" className="w-full h-full" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold truncate">{selectedSong.title}</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{selectedSong.creator || 'Unknown Artist'}</p>
                <p className="text-xs text-zinc-500 mt-1">
                  {selectedSong.duration > 0 && `${Math.floor(selectedSong.duration / 60)}:${String(Math.floor(selectedSong.duration % 60)).padStart(2, '0')}`}
                </p>
              </div>
              <button
                onClick={() => setSelectedSong(null)}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Generation Mode */}
              {selectedSong.genParams && (
                <div>
                  <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                    Generation Mode
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      selectedSong.genParams.customMode
                        ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                        : 'bg-green-500/20 text-green-600 dark:text-green-400'
                    }`}>
                      {selectedSong.genParams.customMode ? 'Custom' : 'Simple'}
                    </span>
                    {selectedSong.genParams.instrumental && (
                      <span className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: `${accentColor}33`, color: accentColor }}>
                        Instrumental
                      </span>
                    )}
                    {selectedSong.genParams.vocalLanguage && selectedSong.genParams.vocalLanguage !== 'unknown' && (
                      <span className="px-3 py-1 rounded-full text-sm bg-zinc-200 dark:bg-zinc-500/20 text-zinc-600 dark:text-zinc-400">
                        {VOCAL_LANGUAGES.find(l => l.value === selectedSong.genParams?.vocalLanguage)?.label || selectedSong.genParams.vocalLanguage}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Prompt/Description */}
              {selectedSong.genParams?.songDescription && (
                <div>
                  <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                    Prompt
                  </h3>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-white/5 rounded-lg p-3">
                    {selectedSong.genParams.songDescription}
                  </p>
                </div>
              )}

              {/* Style */}
              {(selectedSong.genParams?.style || selectedSong.style) && (
                <div>
                  <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                    Style
                  </h3>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-white/5 rounded-lg p-3">
                    {selectedSong.genParams?.style || selectedSong.style}
                  </p>
                </div>
              )}

              {/* Lyrics */}
              {(selectedSong.genParams?.lyrics || selectedSong.lyrics) && (
                <div>
                  <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                    Lyrics
                  </h3>
                  <pre className="text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-white/5 rounded-lg p-3 whitespace-pre-wrap font-sans max-h-48 overflow-y-auto">
                    {selectedSong.genParams?.lyrics || selectedSong.lyrics}
                  </pre>
                </div>
              )}

              {/* No generation params available */}
              {!selectedSong.genParams && !selectedSong.style && !selectedSong.lyrics && (
                <div className="text-center text-zinc-500 py-8">
                  <Info size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No generation details available</p>
                  <p className="text-xs mt-1">This song may have been generated before tracking was enabled</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5">
              <a
                href={selectedSong.audioUrl}
                download={`${selectedSong.title || 'song'}.mp3`}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
                style={{ backgroundColor: accentColor, color: accentTextColor }}
              >
                <Download size={16} />
                Download
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Lyrics Modal */}
      {showLyrics && radio.currentSong && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
            onClick={() => setShowLyrics(false)}
          />

          {/* Modal */}
          <div
            className="relative w-full max-w-lg max-h-[85vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col mx-4 border border-zinc-200 dark:border-white/10"
            style={{ backgroundImage: accentPanelGradient(accentColor) }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                >
                  <AlignLeft size={18} />
                </div>
                <div>
                  <h2 className="font-bold">Lyrics</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[200px]">{radio.currentSong.title}</p>
                </div>
              </div>
              <button
                onClick={() => setShowLyrics(false)}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Lyrics Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <pre className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
                {radio.currentSong.lyrics}
              </pre>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end px-6 py-4 border-t border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5">
              <button
                onClick={() => setShowLyrics(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
