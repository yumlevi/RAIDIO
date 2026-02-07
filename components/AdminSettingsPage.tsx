import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Save, Crown, Radio, Sparkles, AudioLines, ShieldAlert, Music2, Plug, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useRadio } from '../context/RadioContext';
import { radioApi } from '../services/api';
import { RadioSettings } from '../types';

const VOCAL_LANGUAGES = [
  { value: '', label: 'Default (use last user setting)' },
  { value: 'unknown', label: 'Auto / Instrumental' },
  { value: 'ar', label: 'Arabic' },
  { value: 'az', label: 'Azerbaijani' },
  { value: 'bg', label: 'Bulgarian' },
  { value: 'bn', label: 'Bengali' },
  { value: 'ca', label: 'Catalan' },
  { value: 'cs', label: 'Czech' },
  { value: 'da', label: 'Danish' },
  { value: 'de', label: 'German' },
  { value: 'el', label: 'Greek' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fa', label: 'Persian' },
  { value: 'fi', label: 'Finnish' },
  { value: 'fr', label: 'French' },
  { value: 'he', label: 'Hebrew' },
  { value: 'hi', label: 'Hindi' },
  { value: 'hr', label: 'Croatian' },
  { value: 'ht', label: 'Haitian Creole' },
  { value: 'hu', label: 'Hungarian' },
  { value: 'id', label: 'Indonesian' },
  { value: 'is', label: 'Icelandic' },
  { value: 'it', label: 'Italian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'la', label: 'Latin' },
  { value: 'lt', label: 'Lithuanian' },
  { value: 'ms', label: 'Malay' },
  { value: 'ne', label: 'Nepali' },
  { value: 'nl', label: 'Dutch' },
  { value: 'no', label: 'Norwegian' },
  { value: 'pa', label: 'Punjabi' },
  { value: 'pl', label: 'Polish' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ro', label: 'Romanian' },
  { value: 'ru', label: 'Russian' },
  { value: 'sa', label: 'Sanskrit' },
  { value: 'sk', label: 'Slovak' },
  { value: 'sr', label: 'Serbian' },
  { value: 'sv', label: 'Swedish' },
  { value: 'sw', label: 'Swahili' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'th', label: 'Thai' },
  { value: 'tl', label: 'Tagalog' },
  { value: 'tr', label: 'Turkish' },
  { value: 'uk', label: 'Ukrainian' },
  { value: 'ur', label: 'Urdu' },
  { value: 'vi', label: 'Vietnamese' },
  { value: 'yue', label: 'Cantonese' },
  { value: 'zh', label: 'Chinese (Mandarin)' },
];

type SectionId = 'auto-dj' | 'ai-provider' | 'music-provider' | 'audio';

const SECTIONS: { id: SectionId; label: string; icon: React.ReactNode }[] = [
  { id: 'auto-dj', label: 'Auto-DJ', icon: <Radio size={16} /> },
  { id: 'ai-provider', label: 'AI Provider', icon: <Sparkles size={16} /> },
  { id: 'music-provider', label: 'Music Provider', icon: <Music2 size={16} /> },
  { id: 'audio', label: 'Audio Processing', icon: <AudioLines size={16} /> },
];

interface AdminSettingsPageProps {
  theme: 'dark' | 'light';
  onBack: () => void;
}

export const AdminSettingsPage: React.FC<AdminSettingsPageProps> = ({ theme, onBack }) => {
  const { isOwner, listenerId, settings, updateSettings } = useRadio();
  const [activeSection, setActiveSection] = useState<SectionId>('auto-dj');
  const [localSettings, setLocalSettings] = useState<RadioSettings>(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [musicTestStatus, setMusicTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [musicTestMessage, setMusicTestMessage] = useState('');
  const [llmTestStatus, setLlmTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [llmTestMessage, setLlmTestMessage] = useState('');

  const dark = theme === 'dark';

  // Theme-dependent colors
  const c = useMemo(() => ({
    bg: dark ? '#09090b' : '#ffffff',
    bgPanel: dark ? '#121214' : '#fafafa',
    bgInput: dark ? '#27272a' : '#f4f4f5',
    bgSubPanel: dark ? 'rgba(39,39,42,0.5)' : '#fafafa',
    border: dark ? '#3f3f46' : '#e4e4e7',
    text: dark ? '#ffffff' : '#09090b',
    textMuted: dark ? '#a1a1aa' : '#71717a',
    textMuted2: dark ? '#71717a' : '#a1a1aa',
    hoverBg: dark ? '#27272a' : 'rgba(228,228,231,0.6)',
    disabledBg: dark ? '#3f3f46' : '#e4e4e7',
  }), [dark]);

  // Common input/select style
  const inputStyle: React.CSSProperties = {
    backgroundColor: c.bgInput,
    borderColor: c.border,
    color: c.text,
  };

  const subPanelStyle: React.CSSProperties = {
    backgroundColor: c.bgSubPanel,
    borderColor: c.border,
  };

  // Sync with server settings on mount
  useEffect(() => {
    setLocalSettings(settings);
    setHasChanges(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOwner) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" style={{ backgroundColor: c.bg, color: c.text }}>
        <ShieldAlert size={48} style={{ color: c.textMuted }} className="mb-4" />
        <h2 className="text-xl font-bold mb-2">Access Denied</h2>
        <p className="mb-6" style={{ color: c.textMuted }}>You need to be the radio owner to access admin settings.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          style={{ backgroundColor: c.bgInput, color: c.text }}
        >
          Back to Radio
        </button>
      </div>
    );
  }

  const handleChange = <K extends keyof RadioSettings>(key: K, value: RadioSettings[K]) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleClaudeSettingsChange = (key: string, value: unknown) => {
    setLocalSettings(prev => ({
      ...prev,
      llmClaudeSettings: {
        temperature: prev.llmClaudeSettings?.temperature ?? 1.0,
        maxTokens: prev.llmClaudeSettings?.maxTokens ?? 4096,
        model: prev.llmClaudeSettings?.model ?? 'claude-sonnet-4-20250514',
        [key]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleVllmSettingsChange = (key: string, value: unknown) => {
    setLocalSettings(prev => ({
      ...prev,
      llmVllmSettings: {
        endpointUrl: prev.llmVllmSettings?.endpointUrl ?? '',
        model: prev.llmVllmSettings?.model ?? '',
        temperature: prev.llmVllmSettings?.temperature ?? 0.7,
        maxTokens: prev.llmVllmSettings?.maxTokens ?? 4096,
        supportsAudio: prev.llmVllmSettings?.supportsAudio ?? false,
        [key]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleMusicProviderSettingChange = (key: string, value: unknown) => {
    setLocalSettings(prev => {
      const mps = { ...(prev.musicProviderSettings || {}) };
      mps[key] = value;
      // Also sync to flat legacy field for backward compat
      return { ...prev, musicProviderSettings: mps, [key]: value } as RadioSettings;
    });
    setHasChanges(true);
  };

  // Helper to read from musicProviderSettings with fallback to flat legacy field
  const getMps = (key: string): unknown => {
    return (localSettings.musicProviderSettings as Record<string, unknown> | undefined)?.[key]
      ?? (localSettings as Record<string, unknown>)[key];
  };

  const handleSave = () => {
    updateSettings(localSettings);
    setHasChanges(false);
  };

  const handleTestMusicProvider = async () => {
    if (!listenerId) return;
    const url = localSettings.musicProviderUrl || 'http://localhost:39871';
    setMusicTestStatus('testing');
    setMusicTestMessage('');
    try {
      const result = await radioApi.testMusicProvider(listenerId, url);
      setMusicTestStatus(result.success ? 'success' : 'error');
      setMusicTestMessage(result.message);
    } catch (err) {
      setMusicTestStatus('error');
      setMusicTestMessage(err instanceof Error ? err.message : 'Test failed');
    }
  };

  const handleTestLLM = async (provider: 'claude' | 'vllm') => {
    if (!listenerId) return;
    setLlmTestStatus('testing');
    setLlmTestMessage('');
    try {
      const testSettings: Record<string, unknown> = provider === 'vllm'
        ? { endpointUrl: localSettings.llmVllmSettings?.endpointUrl, model: localSettings.llmVllmSettings?.model }
        : { apiKey: localSettings.llmClaudeSettings?.apiKey };
      const result = await radioApi.testLLM(listenerId, provider, testSettings);
      setLlmTestStatus(result.success ? 'success' : 'error');
      setLlmTestMessage(result.message);
    } catch (err) {
      setLlmTestStatus('error');
      setLlmTestMessage(err instanceof Error ? err.message : 'Test failed');
    }
  };

  const renderAutoDJ = () => (
    <div className="space-y-6">
      {/* Auto-DJ info */}
      <div className="p-4 rounded-xl border" style={{ borderColor: c.border, backgroundColor: c.bgPanel }}>
        <p className="text-sm" style={{ color: c.textMuted }}>
          Auto-DJ kicks in automatically after the first song is generated. It uses ACE-Step's built-in language model to create new songs with the variety controls below.
        </p>
      </div>

      {/* Fresh AI Each Song — only available with external LLM */}
      {localSettings.useLLM && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Fresh AI Each Song</p>
              <p className="text-xs mt-1" style={{ color: c.textMuted }}>
                Call AI for every Auto-DJ song instead of reusing cached data
              </p>
            </div>
            <div
              onClick={() => handleChange('autoDjFreshLLM', !localSettings.autoDjFreshLLM)}
              className="w-12 h-7 rounded-full transition-colors relative flex-shrink-0 cursor-pointer"
              style={{ backgroundColor: localSettings.autoDjFreshLLM ? '#22c55e' : '#d4d4d8' }}
              role="switch"
              aria-checked={localSettings.autoDjFreshLLM}
            >
              <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform shadow ${
                localSettings.autoDjFreshLLM ? 'left-6' : 'left-1'
              }`} />
            </div>
          </div>
        </div>
      )}

      {/* Auto-DJ Theme/Prompt + DJ Style */}
      {localSettings.autoDjFreshLLM && localSettings.useLLM && (
        <>
          <div>
            <label className="block text-sm font-medium mb-1">DJ Style</label>
            <select
              value={localSettings.autoDjStyle ?? 'explore'}
              onChange={(e) => handleChange('autoDjStyle', e.target.value as 'explore' | 'similar' | 'consistent')}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-green-500"
              style={inputStyle}
            >
              <option value="explore">Explore — Each song is distinctly different</option>
              <option value="similar">Similar Vibe — Same genre/mood, different song</option>
              <option value="consistent">Stay Close — Closely match the current style</option>
            </select>
            <p className="text-xs mt-1" style={{ color: c.textMuted }}>
              Controls how much variety the AI introduces between songs
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Lock DJ Style</p>
              <p className="text-xs mt-0.5" style={{ color: c.textMuted }}>
                {localSettings.autoDjStyleLocked
                  ? 'Listener voting is disabled — your chosen style is used'
                  : 'Listeners can vote to change the DJ style'}
              </p>
            </div>
            <div
              onClick={() => handleChange('autoDjStyleLocked', !localSettings.autoDjStyleLocked)}
              className="w-12 h-7 rounded-full transition-colors relative flex-shrink-0 cursor-pointer"
              style={{ backgroundColor: localSettings.autoDjStyleLocked ? '#22c55e' : '#d4d4d8' }}
              role="switch"
              aria-checked={localSettings.autoDjStyleLocked}
            >
              <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform shadow ${
                localSettings.autoDjStyleLocked ? 'left-6' : 'left-1'
              }`} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Auto-DJ Theme / Prompt</label>
            <textarea
              value={localSettings.autoDjPrompt ?? ''}
              onChange={(e) => handleChange('autoDjPrompt', e.target.value)}
              placeholder="e.g. Chill lo-fi beats for studying, or Japanese city pop..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-green-500 text-sm resize-none"
              style={inputStyle}
            />
            <p className="text-xs mt-1" style={{ color: c.textMuted }}>Leave empty to use the last user's prompt as a base</p>
          </div>
        </>
      )}

      {/* Variety Controls */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: c.textMuted }}>Variety</p>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="autoDjBpmVariation"
            checked={localSettings.autoDjBpmVariation ?? false}
            onChange={(e) => handleChange('autoDjBpmVariation', e.target.checked)}
            className="w-4 h-4 rounded text-green-500 focus:ring-green-500"
          />
          <label htmlFor="autoDjBpmVariation" className="text-sm font-medium">BPM Variation</label>
        </div>

        {localSettings.autoDjBpmVariation && (
          <div className="grid grid-cols-2 gap-4 ml-7">
            <div>
              <label className="block text-sm font-medium mb-1">Min BPM</label>
              <input
                type="number"
                min={40}
                max={300}
                value={localSettings.autoDjBpmMin ?? 80}
                onChange={(e) => handleChange('autoDjBpmMin', parseInt(e.target.value) || 80)}
                className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-green-500"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max BPM</label>
              <input
                type="number"
                min={40}
                max={300}
                value={localSettings.autoDjBpmMax ?? 160}
                onChange={(e) => handleChange('autoDjBpmMax', parseInt(e.target.value) || 160)}
                className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-green-500"
                style={inputStyle}
              />
            </div>
          </div>
        )}

        {/* Duration Range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Duration Min (s)</label>
            <input
              type="number"
              min={0}
              max={600}
              value={localSettings.autoDjDurationMin ?? 60}
              onChange={(e) => handleChange('autoDjDurationMin', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-green-500"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Duration Max (s)</label>
            <input
              type="number"
              min={0}
              max={600}
              value={localSettings.autoDjDurationMax ?? 180}
              onChange={(e) => handleChange('autoDjDurationMax', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-green-500"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Key Randomization */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="autoDjKeyRandomize"
            checked={localSettings.autoDjKeyRandomize !== false}
            onChange={(e) => handleChange('autoDjKeyRandomize', e.target.checked)}
            className="w-4 h-4 rounded text-green-500 focus:ring-green-500"
          />
          <label htmlFor="autoDjKeyRandomize" className="text-sm font-medium">
            Key Randomization <span style={{ color: c.textMuted }}>(random key/scale each song)</span>
          </label>
        </div>
      </div>

      {/* Style Overrides */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: c.textMuted }}>Style Overrides</p>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="autoDjForceInstrumental"
            checked={localSettings.autoDjForceInstrumental ?? false}
            onChange={(e) => handleChange('autoDjForceInstrumental', e.target.checked)}
            className="w-4 h-4 rounded text-green-500 focus:ring-green-500"
          />
          <label htmlFor="autoDjForceInstrumental" className="text-sm font-medium">Force Instrumental</label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Preferred Language</label>
          <select
            value={localSettings.autoDjLanguage ?? ''}
            onChange={(e) => handleChange('autoDjLanguage', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-green-500"
            style={inputStyle}
          >
            {VOCAL_LANGUAGES.map(lang => (
              <option key={lang.value} value={lang.value}>{lang.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Queue & Timing */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: c.textMuted }}>Queue & Timing</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Min Queue Size</label>
            <input
              type="number"
              min={1}
              max={5}
              value={localSettings.autoDjMinQueueSize ?? 1}
              onChange={(e) => handleChange('autoDjMinQueueSize', Math.max(1, Math.min(5, parseInt(e.target.value) || 1)))}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-green-500"
              style={inputStyle}
            />
            <p className="text-xs mt-1" style={{ color: c.textMuted }}>Songs to keep ready</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Pre-gen Lead (s)</label>
            <input
              type="number"
              min={5}
              max={60}
              value={localSettings.autoDjPreGenSeconds ?? 15}
              onChange={(e) => handleChange('autoDjPreGenSeconds', Math.max(5, Math.min(60, parseInt(e.target.value) || 15)))}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-green-500"
              style={inputStyle}
            />
            <p className="text-xs mt-1" style={{ color: c.textMuted }}>Seconds before end</p>
          </div>
        </div>
      </div>

      {/* Stream (Fades) */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: c.textMuted }}>Stream</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Fade In (s)</label>
            <input
              type="number"
              min={0}
              max={10}
              step={0.5}
              value={localSettings.autoDjFadeIn ?? 2}
              onChange={(e) => handleChange('autoDjFadeIn', Math.max(0, Math.min(10, parseFloat(e.target.value) || 0)))}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-green-500"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Fade Out (s)</label>
            <input
              type="number"
              min={0}
              max={10}
              step={0.5}
              value={localSettings.autoDjFadeOut ?? 3}
              onChange={(e) => handleChange('autoDjFadeOut', Math.max(0, Math.min(10, parseFloat(e.target.value) || 0)))}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-green-500"
              style={inputStyle}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderAIProvider = () => (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Use AI for Prompt Enhancement</p>
            <p className="text-xs mt-1" style={{ color: c.textMuted }}>
              Enable intelligent prompt enhancement with an AI model. When enabled, the "vibes" tab becomes available in the generation form.
            </p>
          </div>
          <div
            onClick={() => {
              const newValue = !localSettings.useLLM;
              handleChange('useLLM', newValue);
              if (newValue && localSettings.thinking) {
                handleChange('thinking', false);
              }
              // Auto-switch interaction mode when toggling AI
              if (!newValue) {
                handleChange('interactionMode', 'create');
              } else {
                handleChange('interactionMode', 'vibe');
              }
            }}
            className="w-12 h-7 rounded-full transition-colors relative flex-shrink-0 cursor-pointer"
            style={{ backgroundColor: localSettings.useLLM ? '#a855f7' : '#d4d4d8' }}
            role="switch"
            aria-checked={localSettings.useLLM}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform shadow ${
              localSettings.useLLM ? 'left-6' : 'left-1'
            }`} />
          </div>
        </div>
      </div>

      {/* Generation Mode Toggle */}
      <div>
        <label className="block text-sm font-medium mb-2">Generation Mode</label>
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: c.border }}>
          <button
            onClick={() => handleChange('interactionMode', 'vibe')}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors"
            style={{
              backgroundColor: (localSettings.interactionMode || (localSettings.useLLM ? 'vibe' : 'create')) === 'vibe' ? '#a855f7' : c.bgInput,
              color: (localSettings.interactionMode || (localSettings.useLLM ? 'vibe' : 'create')) === 'vibe' ? '#ffffff' : c.textMuted,
            }}
          >
            <Sparkles size={14} />
            Vibe (AI)
          </button>
          <button
            onClick={() => handleChange('interactionMode', 'create')}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-l"
            style={{
              backgroundColor: (localSettings.interactionMode || (localSettings.useLLM ? 'vibe' : 'create')) === 'create' ? '#ec4899' : c.bgInput,
              color: (localSettings.interactionMode || (localSettings.useLLM ? 'vibe' : 'create')) === 'create' ? '#ffffff' : c.textMuted,
              borderColor: c.border,
            }}
          >
            <Music2 size={14} />
            Create (Manual)
          </button>
        </div>
        <p className="text-xs mt-1.5" style={{ color: c.textMuted }}>
          Vibe mode uses AI to fill in details from a simple prompt. Create mode gives direct control over style, lyrics, and title.
        </p>
      </div>

      {localSettings.useLLM && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Provider</label>
            <select
              value={localSettings.llmProvider || 'claude'}
              onChange={(e) => handleChange('llmProvider', e.target.value as 'claude' | 'vllm')}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500"
              style={inputStyle}
            >
              <option value="claude">Claude (Anthropic)</option>
              <option value="vllm">vLLM (OpenAI-compatible)</option>
            </select>
          </div>

          {(localSettings.llmProvider || 'claude') === 'claude' && (
            <div className="space-y-4 p-4 rounded-xl border" style={subPanelStyle}>
              <p className="text-xs text-purple-400 font-medium">Claude Settings</p>

              <div>
                <label className="block text-sm font-medium mb-1">API Key</label>
                <input
                  type="password"
                  value={localSettings.llmClaudeSettings?.apiKey || ''}
                  onChange={(e) => handleClaudeSettingsChange('apiKey', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                  style={inputStyle}
                  placeholder="sk-ant-..."
                  autoComplete="off"
                />
                <p className="text-xs mt-1" style={{ color: c.textMuted }}>
                  Get a key at <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-purple-400 underline">console.anthropic.com</a>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Model</label>
                <select
                  value={localSettings.llmClaudeSettings?.model || 'claude-sonnet-4-20250514'}
                  onChange={(e) => handleClaudeSettingsChange('model', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500"
                  style={inputStyle}
                >
                  <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                  <option value="claude-opus-4-20250514">Claude Opus 4</option>
                  <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                  <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Temperature</label>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={localSettings.llmClaudeSettings?.temperature ?? 1.0}
                    onChange={(e) => handleClaudeSettingsChange('temperature', parseFloat(e.target.value) || 1.0)}
                    className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500"
                    style={inputStyle}
                  />
                  <p className="text-xs mt-1" style={{ color: c.textMuted }}>0 = deterministic, 1 = creative</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Max Tokens</label>
                  <input
                    type="number"
                    min={256}
                    max={8192}
                    step={256}
                    value={localSettings.llmClaudeSettings?.maxTokens ?? 4096}
                    onChange={(e) => handleClaudeSettingsChange('maxTokens', parseInt(e.target.value) || 4096)}
                    className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500"
                    style={inputStyle}
                  />
                  <p className="text-xs mt-1" style={{ color: c.textMuted }}>Response length limit</p>
                </div>
              </div>

              <button
                onClick={() => handleTestLLM('claude')}
                disabled={llmTestStatus === 'testing'}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: llmTestStatus === 'testing' ? c.disabledBg : 'rgba(168,85,247,0.15)',
                  color: llmTestStatus === 'testing' ? c.textMuted : '#a855f7',
                }}
              >
                {llmTestStatus === 'testing' ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
                Test Connection
              </button>
              {llmTestStatus !== 'idle' && llmTestStatus !== 'testing' && (localSettings.llmProvider || 'claude') === 'claude' && (
                <div className={`flex items-center gap-1.5 text-xs ${llmTestStatus === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                  {llmTestStatus === 'success' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  {llmTestMessage}
                </div>
              )}
            </div>
          )}

          {localSettings.llmProvider === 'vllm' && (
            <div className="space-y-4 p-4 rounded-xl border" style={subPanelStyle}>
              <p className="text-xs text-purple-400 font-medium">vLLM Settings</p>

              <div>
                <label className="block text-sm font-medium mb-1">Endpoint URL</label>
                <input
                  type="text"
                  value={localSettings.llmVllmSettings?.endpointUrl || ''}
                  onChange={(e) => handleVllmSettingsChange('endpointUrl', e.target.value)}
                  placeholder="http://localhost:8000/v1/chat/completions"
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  style={inputStyle}
                />
                <p className="text-xs mt-1" style={{ color: c.textMuted }}>Full URL to chat completions endpoint</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Model ID</label>
                <input
                  type="text"
                  value={localSettings.llmVllmSettings?.model || ''}
                  onChange={(e) => handleVllmSettingsChange('model', e.target.value)}
                  placeholder="Qwen/Qwen3-Omni"
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  style={inputStyle}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Temperature</label>
                  <input
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    value={localSettings.llmVllmSettings?.temperature ?? 0.7}
                    onChange={(e) => handleVllmSettingsChange('temperature', parseFloat(e.target.value) || 0.7)}
                    className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Max Tokens</label>
                  <input
                    type="number"
                    min={256}
                    max={8192}
                    step={256}
                    value={localSettings.llmVllmSettings?.maxTokens ?? 4096}
                    onChange={(e) => handleVllmSettingsChange('maxTokens', parseInt(e.target.value) || 4096)}
                    className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="vllmSupportsAudio"
                  checked={localSettings.llmVllmSettings?.supportsAudio ?? false}
                  onChange={(e) => handleVllmSettingsChange('supportsAudio', e.target.checked)}
                  className="w-4 h-4 rounded text-purple-500 focus:ring-purple-500"
                />
                <label htmlFor="vllmSupportsAudio" className="text-sm font-medium">
                  Supports Audio Input
                </label>
              </div>
              <p className="text-xs" style={{ color: c.textMuted }}>
                Enable if your model supports multimodal audio input (e.g. Qwen3-Omni). This enables audio analysis on the radio page.
              </p>

              <button
                onClick={() => handleTestLLM('vllm')}
                disabled={llmTestStatus === 'testing'}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: llmTestStatus === 'testing' ? c.disabledBg : 'rgba(168,85,247,0.15)',
                  color: llmTestStatus === 'testing' ? c.textMuted : '#a855f7',
                }}
              >
                {llmTestStatus === 'testing' ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
                Test Connection
              </button>
              {llmTestStatus !== 'idle' && llmTestStatus !== 'testing' && localSettings.llmProvider === 'vllm' && (
                <div className={`flex items-center gap-1.5 text-xs ${llmTestStatus === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                  {llmTestStatus === 'success' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  {llmTestMessage}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderMusicProvider = () => (
    <div className="space-y-6">
      {/* Provider selector */}
      <div>
        <label className="block text-sm font-medium mb-1">Provider</label>
        <select
          value={localSettings.musicProvider || 'acestep'}
          onChange={(e) => handleChange('musicProvider', e.target.value)}
          className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500"
          style={inputStyle}
        >
          <option value="acestep">ACE-Step 1.5</option>
        </select>
      </div>

      {/* API URL + Test */}
      <div>
        <label className="block text-sm font-medium mb-1">API URL</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={localSettings.musicProviderUrl || 'http://localhost:39871'}
            onChange={(e) => handleChange('musicProviderUrl', e.target.value)}
            placeholder="http://localhost:39871"
            className="flex-1 px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm font-mono"
            style={inputStyle}
          />
          <button
            onClick={handleTestMusicProvider}
            disabled={musicTestStatus === 'testing'}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            style={{
              backgroundColor: musicTestStatus === 'testing' ? c.disabledBg : 'rgba(236,72,153,0.15)',
              color: musicTestStatus === 'testing' ? c.textMuted : '#ec4899',
            }}
          >
            {musicTestStatus === 'testing' ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
            Test
          </button>
        </div>
        {musicTestStatus !== 'idle' && musicTestStatus !== 'testing' && (
          <div className={`flex items-center gap-1.5 mt-1.5 text-xs ${musicTestStatus === 'success' ? 'text-green-500' : 'text-red-500'}`}>
            {musicTestStatus === 'success' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
            {musicTestMessage}
          </div>
        )}
        <p className="text-xs mt-1" style={{ color: c.textMuted }}>ACE-Step REST API endpoint</p>
      </div>

      {/* Universal settings (always visible) */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: c.textMuted }}>Universal</p>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="randomSeed"
            checked={localSettings.randomSeed}
            onChange={(e) => handleChange('randomSeed', e.target.checked)}
            className="w-4 h-4 rounded text-pink-500 focus:ring-pink-500"
          />
          <label htmlFor="randomSeed" className="text-sm font-medium">Random Seed</label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Seed {localSettings.randomSeed && <span style={{ color: c.textMuted }}>(ignored)</span>}
            </label>
            <input
              type="number"
              min={-1}
              value={localSettings.seed}
              onChange={(e) => handleChange('seed', parseInt(e.target.value) || -1)}
              disabled={localSettings.randomSeed}
              className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500 ${
                localSettings.randomSeed ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Duration (seconds)</label>
            <input
              type="number"
              min={-1}
              max={300}
              value={localSettings.duration}
              onChange={(e) => handleChange('duration', parseInt(e.target.value) || -1)}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500"
              style={inputStyle}
            />
            <p className="text-xs mt-1" style={{ color: c.textMuted }}>-1 for auto duration</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Batch Size</label>
            <input
              type="number"
              min={1}
              max={8}
              value={localSettings.batchSize}
              onChange={(e) => handleChange('batchSize', parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Audio Format</label>
            <select
              value={localSettings.audioFormat}
              onChange={(e) => handleChange('audioFormat', e.target.value as 'mp3' | 'flac')}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500"
              style={inputStyle}
            >
              <option value="mp3">MP3</option>
              <option value="flac">FLAC</option>
            </select>
          </div>
        </div>
      </div>

      {/* ACE-Step settings (shown when ACE-Step selected) */}
      {(localSettings.musicProvider || 'acestep') === 'acestep' && (
        <>
          {/* Inference group */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: c.textMuted }}>Inference</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Steps</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={(getMps('inferenceSteps') as number) ?? 8}
                  onChange={(e) => handleMusicProviderSettingChange('inferenceSteps', parseInt(e.target.value) || 8)}
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Guidance Scale</label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  step={0.1}
                  value={(getMps('guidanceScale') as number) ?? 7.0}
                  onChange={(e) => handleMusicProviderSettingChange('guidanceScale', parseFloat(e.target.value) || 7.0)}
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Shift</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={(getMps('shift') as number) ?? 3.0}
                  onChange={(e) => handleMusicProviderSettingChange('shift', parseFloat(e.target.value) || 3.0)}
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Method</label>
                <select
                  value={(getMps('inferMethod') as string) ?? 'ode'}
                  onChange={(e) => handleMusicProviderSettingChange('inferMethod', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500"
                  style={inputStyle}
                >
                  <option value="ode">ODE (Faster)</option>
                  <option value="sde">SDE (Higher Quality)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="thinking"
                checked={(getMps('thinking') as boolean) ?? false}
                onChange={(e) => handleMusicProviderSettingChange('thinking', e.target.checked)}
                disabled={localSettings.useLLM}
                className={`w-4 h-4 rounded text-pink-500 focus:ring-pink-500 ${
                  localSettings.useLLM ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              />
              <label htmlFor="thinking" className={`text-sm font-medium ${localSettings.useLLM ? 'opacity-50' : ''}`}>
                Enable Thinking (CoT) {localSettings.useLLM && <span style={{ color: c.textMuted }}>(disabled when AI is enabled)</span>}
              </label>
            </div>
          </div>

          {/* Internal LM group */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 space-y-4">
            <div>
              <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider mb-1">Internal LM</p>
              <p className="text-xs" style={{ color: c.textMuted }}>
                ACE-Step's own language model for prompt refinement. Works alongside an external AI provider.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">CoT Caption Rewrite</p>
                <p className="text-xs mt-0.5" style={{ color: c.textMuted }}>Enhance the caption via chain-of-thought</p>
              </div>
              <div
                onClick={() => handleMusicProviderSettingChange('useCotCaption', !(getMps('useCotCaption') as boolean))}
                className="w-12 h-7 rounded-full transition-colors relative flex-shrink-0 cursor-pointer"
                style={{ backgroundColor: (getMps('useCotCaption') as boolean) ? '#f59e0b' : '#d4d4d8' }}
                role="switch"
                aria-checked={(getMps('useCotCaption') as boolean) ?? false}
              >
                <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform shadow ${
                  (getMps('useCotCaption') as boolean) ? 'left-6' : 'left-1'
                }`} />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Constrained Decoding</p>
                <p className="text-xs mt-0.5" style={{ color: c.textMuted }}>FSM-based structured output for consistent results</p>
              </div>
              <div
                onClick={() => handleMusicProviderSettingChange('constrainedDecoding', !(getMps('constrainedDecoding') as boolean))}
                className="w-12 h-7 rounded-full transition-colors relative flex-shrink-0 cursor-pointer"
                style={{ backgroundColor: (getMps('constrainedDecoding') as boolean) ? '#f59e0b' : '#d4d4d8' }}
                role="switch"
                aria-checked={(getMps('constrainedDecoding') as boolean) ?? false}
              >
                <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform shadow ${
                  (getMps('constrainedDecoding') as boolean) ? 'left-6' : 'left-1'
                }`} />
              </div>
            </div>
          </div>

          {/* LM Parameters group */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: c.textMuted }}>LM Parameters</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Temperature</label>
                <input
                  type="number"
                  min={0}
                  max={2}
                  step={0.05}
                  value={(getMps('lmTemperature') as number) ?? 0.85}
                  onChange={(e) => handleMusicProviderSettingChange('lmTemperature', parseFloat(e.target.value) || 0.85)}
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">CFG Scale</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={(getMps('lmCfgScale') as number) ?? 2.0}
                  onChange={(e) => handleMusicProviderSettingChange('lmCfgScale', parseFloat(e.target.value) || 2.0)}
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Top-K</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={(getMps('lmTopK') as number) ?? 0}
                  onChange={(e) => handleMusicProviderSettingChange('lmTopK', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Top-P</label>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={(getMps('lmTopP') as number) ?? 0.9}
                  onChange={(e) => handleMusicProviderSettingChange('lmTopP', parseFloat(e.target.value) || 0.9)}
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500"
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Negative Prompt</label>
              <input
                type="text"
                value={(getMps('lmNegativePrompt') as string) ?? 'NO USER INPUT'}
                onChange={(e) => handleMusicProviderSettingChange('lmNegativePrompt', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500"
                style={inputStyle}
                placeholder="NO USER INPUT"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderAudio = () => (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Enable Post-Processing</p>
            <p className="text-xs mt-1" style={{ color: c.textMuted }}>
              Apply EQ filters to generated audio before streaming. Requires ffmpeg.
            </p>
          </div>
          <div
            onClick={() => handleChange('audioPostProcess', !localSettings.audioPostProcess)}
            className="w-12 h-7 rounded-full transition-colors relative flex-shrink-0 cursor-pointer"
            style={{ backgroundColor: localSettings.audioPostProcess ? '#3b82f6' : '#d4d4d8' }}
            role="switch"
            aria-checked={localSettings.audioPostProcess}
          >
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform shadow ${
              localSettings.audioPostProcess ? 'left-6' : 'left-1'
            }`} />
          </div>
        </div>
      </div>

      {localSettings.audioPostProcess && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">High Pass Filter (Hz)</label>
            <input
              type="number"
              min={0}
              max={200}
              value={localSettings.audioHighPass ?? 30}
              onChange={(e) => handleChange('audioHighPass', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={inputStyle}
            />
            <p className="text-xs mt-1" style={{ color: c.textMuted }}>Removes rumble below this frequency (gentle 12dB/oct roll-off). 0 to disable.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Low Pass 1 (Hz)</label>
              <input
                type="number"
                min={0}
                max={20000}
                step={100}
                value={localSettings.audioLowPass1 ?? 10000}
                onChange={(e) => handleChange('audioLowPass1', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={inputStyle}
              />
              <p className="text-xs mt-1" style={{ color: c.textMuted }}>Gentle roll-off (12dB/oct)</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Low Pass 2 (Hz)</label>
              <input
                type="number"
                min={0}
                max={20000}
                step={100}
                value={localSettings.audioLowPass2 ?? 14000}
                onChange={(e) => handleChange('audioLowPass2', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={inputStyle}
              />
              <p className="text-xs mt-1" style={{ color: c.textMuted }}>Steep roll-off (24dB/oct)</p>
            </div>
          </div>

          <p className="text-xs text-blue-400">
            Default: HP 30Hz, LP1 10kHz, LP2 14kHz. Set any to 0 to disable that filter.
          </p>
        </div>
      )}
    </div>
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'auto-dj': return renderAutoDJ();
      case 'ai-provider': return renderAIProvider();
      case 'music-provider': return renderMusicProvider();
      case 'audio': return renderAudio();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ backgroundColor: c.bg, color: c.text }}>
      {/* Sticky Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b"
        style={{ backgroundColor: c.bg, borderColor: c.border }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-full transition-colors"
            style={{ color: c.text }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.hoverBg)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <ArrowLeft size={20} />
          </button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
            <Crown size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Admin Settings</h2>
            <p className="text-xs" style={{ color: c.textMuted }}>Radio generation defaults</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
          style={hasChanges
            ? { backgroundColor: '#ec4899', color: '#ffffff' }
            : { backgroundColor: c.disabledBg, color: c.textMuted, cursor: 'not-allowed' }
          }
        >
          <Save size={16} />
          Save
        </button>
      </div>

      {/* Mobile: Horizontal tabs */}
      <div
        className="lg:hidden flex-shrink-0 overflow-x-auto border-b"
        style={{ backgroundColor: c.bg, borderColor: c.border }}
      >
        <div className="flex px-4 py-2 gap-2 min-w-max">
          {SECTIONS.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors"
              style={activeSection === section.id
                ? { backgroundColor: '#ec4899', color: '#ffffff' }
                : { backgroundColor: c.bgInput, color: c.textMuted }
              }
            >
              {section.icon}
              {section.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content area: sidebar + panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop sidebar */}
        <nav
          className="hidden lg:flex flex-col w-56 flex-shrink-0 border-r py-4 px-3 gap-1"
          style={{ backgroundColor: c.bgPanel, borderColor: c.border }}
        >
          {SECTIONS.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors"
              style={activeSection === section.id
                ? { backgroundColor: 'rgba(236,72,153,0.1)', color: '#ec4899' }
                : { color: c.textMuted }
              }
              onMouseEnter={(e) => {
                if (activeSection !== section.id) e.currentTarget.style.backgroundColor = c.hoverBg;
              }}
              onMouseLeave={(e) => {
                if (activeSection !== section.id) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <span className="flex-shrink-0">
                {section.icon}
              </span>
              {section.label}
              {activeSection === section.id && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-pink-500" />
              )}
            </button>
          ))}
        </nav>

        {/* Right panel */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8" style={{ backgroundColor: c.bg }}>
          <div className="max-w-2xl">
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-6 flex items-center gap-2" style={{ color: c.textMuted }}>
              {SECTIONS.find(s => s.id === activeSection)?.icon}
              {SECTIONS.find(s => s.id === activeSection)?.label}
            </h3>
            {renderSectionContent()}
          </div>
        </div>
      </div>
    </div>
  );
};
