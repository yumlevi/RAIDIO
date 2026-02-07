import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { RadioSettings, RadioSong, RadioListener, RadioState, RadioChatMessage } from '../types';
import { radioApi } from '../services/api';

const OWNER_SECRET_KEY = 'radio_owner_secret';

interface RadioContextType {
  // Connection state
  isConnected: boolean;
  listenerId: string | null;

  // Radio state
  currentSong: RadioSong | null;
  playbackStartTime: number;
  queue: RadioSong[];
  history: RadioSong[];
  listeners: RadioListener[];
  listenerCount: number;
  skipVotes: number;
  skipRequired: number;
  skipPending: boolean;
  skipPendingMessage: string | null;
  djStyleVotes: { explore: number; similar: number; consistent: number };
  djStyleVoteRequired: number;
  isOwner: boolean;
  ownerId: string | null;
  settings: RadioSettings;
  isAutoGenerating: boolean;
  chatMessages: RadioChatMessage[];

  // Actions
  connect: (username: string) => void;
  disconnect: () => void;
  voteSkip: () => void;
  voteDjStyle: (style: 'explore' | 'similar' | 'consistent') => void;
  ownerSkip: () => void;
  claimOwner: (secret: string) => Promise<boolean>;
  updateSettings: (settings: Partial<RadioSettings>) => void;
  sendChatMessage: (message: string) => void;
  requeueSong: (songId: string) => void;
  addToQueue: (song: RadioSong, genParams?: {
    customMode: boolean;
    songDescription?: string;
    lyrics?: string;
    style?: string;
    title?: string;
    instrumental?: boolean;
    vocalLanguage?: string;
    instructMode?: boolean;
    instructParams?: { effects: string[]; customInstruction?: string };
    llmData?: { song_title?: string; prompt?: string; lyrics?: string; audio_duration?: number; bpm?: number; key_scale?: string; time_signature?: string };
  }) => Promise<void>;
}

const defaultSettings: RadioSettings = {
  inferenceSteps: 8,
  guidanceScale: 7.0,
  batchSize: 1,
  audioFormat: 'mp3',
  inferMethod: 'ode',
  shift: 3.0,
  thinking: false,
  lmTemperature: 0.85,
  lmCfgScale: 2.0,
  lmTopK: 0,
  lmTopP: 0.9,
  lmNegativePrompt: 'NO USER INPUT',
  randomSeed: true,
  seed: -1,
  duration: -1,
  useLLM: false,
  llmProvider: 'claude',
  // Auto-DJ controls
  autoDjFreshLLM: false,
  autoDjStyle: 'explore',
  autoDjStyleLocked: false,
  autoDjPrompt: '',
  autoDjBpmVariation: false,
  autoDjBpmMin: 80,
  autoDjBpmMax: 160,
  autoDjDurationMin: 60,
  autoDjDurationMax: 180,
  autoDjKeyRandomize: true,
  autoDjForceInstrumental: false,
  autoDjLanguage: '',
  autoDjMinQueueSize: 1,
  autoDjPreGenSeconds: 15,
  autoDjFadeIn: 2,
  autoDjFadeOut: 3,
  // ACE-Step internal LM
  useCotCaption: false,
  constrainedDecoding: false,
};

const RadioContext = createContext<RadioContextType | null>(null);

export function useRadio(): RadioContextType {
  const context = useContext(RadioContext);
  if (!context) {
    throw new Error('useRadio must be used within a RadioProvider');
  }
  return context;
}

interface RadioProviderProps {
  children: ReactNode;
}

export function RadioProvider({ children }: RadioProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [listenerId, setListenerId] = useState<string | null>(null);
  const [currentSong, setCurrentSong] = useState<RadioSong | null>(null);
  const [playbackStartTime, setPlaybackStartTime] = useState(0);
  const [queue, setQueue] = useState<RadioSong[]>([]);
  const [history, setHistory] = useState<RadioSong[]>([]);
  const [listeners, setListeners] = useState<RadioListener[]>([]);
  const [listenerCount, setListenerCount] = useState(0);
  const [skipVotes, setSkipVotes] = useState(0);
  const [skipRequired, setSkipRequired] = useState(1);
  const [skipPending, setSkipPending] = useState(false);
  const [skipPendingMessage, setSkipPendingMessage] = useState<string | null>(null);
  const [djStyleVotes, setDjStyleVotes] = useState<{ explore: number; similar: number; consistent: number }>({ explore: 0, similar: 0, consistent: 0 });
  const [djStyleVoteRequired, setDjStyleVoteRequired] = useState(1);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [settings, setSettings] = useState<RadioSettings>(defaultSettings);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [chatMessages, setChatMessages] = useState<RadioChatMessage[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usernameRef = useRef<string>('');
  const isConnectingRef = useRef(false);

  const isOwner = listenerId !== null && listenerId === ownerId;

  const connect = useCallback((username: string) => {
    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current) {
      console.log('[Radio] Already connecting, skipping...');
      return;
    }

    // Don't reconnect if already connected with same username
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && usernameRef.current === username) {
      console.log('[Radio] Already connected, skipping...');
      return;
    }

    usernameRef.current = username;
    isConnectingRef.current = true;

    // Determine WebSocket URL based on current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/radio/ws`;

    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      isConnectingRef.current = false;
      setIsConnected(true);
      // Send join message
      ws.send(JSON.stringify({
        type: 'join',
        payload: { name: username },
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as {
          type: string;
          payload?: Record<string, unknown>;
        };

        switch (message.type) {
          case 'joined':
            setListenerId(message.payload?.listenerId as string);
            // Auto-reclaim ownership if secret is stored
            {
              const storedSecret = localStorage.getItem(OWNER_SECRET_KEY);
              if (storedSecret && ws) {
                ws.send(JSON.stringify({
                  type: 'claim-owner',
                  payload: { secret: storedSecret },
                }));
              }
            }
            break;

          case 'state':
            handleStateUpdate(message.payload as unknown as RadioState);
            break;

          case 'song-change':
            setCurrentSong(message.payload?.song as RadioSong | null);
            setPlaybackStartTime(message.payload?.startTime as number || 0);
            break;

          case 'queue-update':
            setQueue(message.payload?.queue as RadioSong[] || []);
            break;

          case 'history-update':
            setHistory(message.payload?.history as RadioSong[] || []);
            break;

          case 'listeners-update':
            setListeners(message.payload?.listeners as RadioListener[] || []);
            setListenerCount(message.payload?.count as number || 0);
            break;

          case 'skip-votes-update':
            setSkipVotes(message.payload?.votes as number || 0);
            setSkipRequired(message.payload?.required as number || 1);
            break;

          case 'dj-style-votes-update':
            setDjStyleVotes(message.payload?.votes as { explore: number; similar: number; consistent: number } || { explore: 0, similar: 0, consistent: 0 });
            setDjStyleVoteRequired(message.payload?.required as number || 1);
            break;

          case 'owner-change':
            setOwnerId(message.payload?.ownerId as string | null);
            break;

          case 'settings-update':
            setSettings(message.payload?.settings as RadioSettings || defaultSettings);
            break;

          case 'skip-pending':
            setSkipPending(message.payload?.pending as boolean || false);
            setSkipPendingMessage(message.payload?.message as string || null);
            break;

          case 'auto-generating':
            setIsAutoGenerating(message.payload?.isGenerating as boolean || false);
            break;

          case 'chat-message':
            const chatMsg = message.payload as unknown as RadioChatMessage;
            if (chatMsg && chatMsg.id && chatMsg.message) {
              setChatMessages(prev => {
                // Don't add duplicates (important for history loading)
                if (prev.some(m => m.id === chatMsg.id)) {
                  return prev;
                }
                // Keep last 100 messages
                const updated = [...prev, chatMsg];
                return updated.slice(-100);
              });
            }
            break;

          case 'claim-owner-result':
            // Handled by the claimOwner promise; also clear stored secret on failed auto-reclaim
            if (message.payload?.success === false) {
              localStorage.removeItem(OWNER_SECRET_KEY);
            }
            break;

          default:
            // Ignore unknown message types
            break;
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      isConnectingRef.current = false;
      setIsConnected(false);
      setListenerId(null);
      // Clear chat messages - they'll be reloaded on reconnect
      setChatMessages([]);

      // Attempt reconnection after 3 seconds
      if (usernameRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          if (usernameRef.current) {
            connect(usernameRef.current);
          }
        }, 3000);
      }
    };

    ws.onerror = (error) => {
      isConnectingRef.current = false;
      console.error('WebSocket error:', error);
    };
  }, []);

  const disconnect = useCallback(() => {
    usernameRef.current = '';
    localStorage.removeItem(OWNER_SECRET_KEY);
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setListenerId(null);
  }, []);

  const handleStateUpdate = (state: RadioState) => {
    setCurrentSong(state.currentSong);
    setPlaybackStartTime(state.playbackStartTime);
    setQueue(state.queue);
    setHistory(state.history || []);
    setListeners(state.listeners);
    setListenerCount(state.listenerCount);
    setSkipVotes(state.skipVotes);
    setSkipRequired(state.skipRequired);
    setDjStyleVotes(state.djStyleVotes || { explore: 0, similar: 0, consistent: 0 });
    setDjStyleVoteRequired(state.djStyleVoteRequired || 1);
    setOwnerId(state.ownerId);
    setSettings(state.settings);
  };

  const voteSkip = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'skip-vote' }));
    }
  }, []);

  const voteDjStyle = useCallback((style: 'explore' | 'similar' | 'consistent') => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'dj-style-vote', payload: { style } }));
    }
  }, []);

  const ownerSkip = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'owner-skip' }));
    }
  }, []);

  const claimOwner = useCallback(async (secret: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        resolve(false);
        return;
      }

      const handleMessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'claim-owner-result') {
            wsRef.current?.removeEventListener('message', handleMessage);
            const success = message.payload?.success === true;
            if (success) {
              localStorage.setItem(OWNER_SECRET_KEY, secret);
            }
            resolve(success);
          }
        } catch {
          // Ignore parse errors
        }
      };

      wsRef.current.addEventListener('message', handleMessage);
      wsRef.current.send(JSON.stringify({
        type: 'claim-owner',
        payload: { secret },
      }));

      // Timeout after 5 seconds
      setTimeout(() => {
        wsRef.current?.removeEventListener('message', handleMessage);
        resolve(false);
      }, 5000);
    });
  }, []);

  const updateSettings = useCallback((newSettings: Partial<RadioSettings>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'update-settings',
        payload: { settings: newSettings },
      }));
    }
  }, []);

  const sendChatMessage = useCallback((message: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && message.trim()) {
      wsRef.current.send(JSON.stringify({
        type: 'chat-message',
        payload: { message: message.trim() },
      }));
    }
  }, []);

  const requeueSong = useCallback((songId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'requeue-song',
        payload: { songId },
      }));
    }
  }, []);

  const addToQueue = useCallback(async (song: RadioSong, genParams?: {
    customMode: boolean;
    songDescription?: string;
    lyrics?: string;
    style?: string;
    title?: string;
    instrumental?: boolean;
    vocalLanguage?: string;
    instructMode?: boolean;
    instructParams?: { effects: string[]; customInstruction?: string };
    llmData?: { song_title?: string; prompt?: string; lyrics?: string; audio_duration?: number; bpm?: number; key_scale?: string; time_signature?: string };
  }): Promise<void> => {
    await radioApi.addToQueue(song, genParams);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const value: RadioContextType = {
    isConnected,
    listenerId,
    currentSong,
    playbackStartTime,
    queue,
    history,
    listeners,
    listenerCount,
    skipVotes,
    skipRequired,
    skipPending,
    skipPendingMessage,
    djStyleVotes,
    djStyleVoteRequired,
    isOwner,
    ownerId,
    settings,
    isAutoGenerating,
    chatMessages,
    connect,
    disconnect,
    voteSkip,
    voteDjStyle,
    ownerSkip,
    claimOwner,
    updateSettings,
    sendChatMessage,
    requeueSong,
    addToQueue,
  };

  return (
    <RadioContext.Provider value={value}>
      {children}
    </RadioContext.Provider>
  );
}
