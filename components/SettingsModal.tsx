import React, { useState } from 'react';
import { X, User as UserIcon, Palette, Info, Radio, Crown, Users } from 'lucide-react';
import { useRadio } from '../context/RadioContext';
import { useTheme, ACCENT_COLORS } from '../context/ThemeContext';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    theme: 'light' | 'dark';
    onToggleTheme: () => void;
    username?: string | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, theme, onToggleTheme, username }) => {
    const radio = useRadio();
    const { accent, setAccent, accentColor, accentColorDark, accentTextColor, nowPlayingScale, setNowPlayingScale } = useTheme();
    const [ownerSecret, setOwnerSecret] = useState('');
    const [claimError, setClaimError] = useState('');
    const [isClaiming, setIsClaiming] = useState(false);

    const handleClaimOwner = async () => {
        if (!ownerSecret.trim()) return;
        setIsClaiming(true);
        setClaimError('');
        try {
            const success = await radio.claimOwner(ownerSecret);
            if (success) {
                setOwnerSecret('');
            } else {
                setClaimError('Invalid secret. Please try again.');
            }
        } catch {
            setClaimError('Failed to claim owner status.');
        } finally {
            setIsClaiming(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-zinc-200 dark:border-white/10"
                onClick={(e) => e.stopPropagation()}
                style={{
                    backgroundImage: `radial-gradient(circle at 50% -10%, ${accentColor}20 0%, transparent 70%)`,
                    boxShadow: `0 0 40px 8px ${accentColor}15, 0 25px 50px -12px rgba(0,0,0,0.25)`,
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-white/10">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Settings</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full transition-colors hover:opacity-80"
                        style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-8">
                    {/* User Section */}
                    {username && (
                        <div className="rounded-xl p-6" style={{ backgroundColor: `${accentColor}08` }}>
                            <div className="flex items-center gap-4">
                                <div
                                    className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shadow-lg"
                                    style={{
                                        background: `linear-gradient(to bottom right, ${accentColor}, ${accentColorDark})`,
                                        color: accentTextColor,
                                        boxShadow: `0 4px 12px ${accentColor}40`,
                                    }}
                                >
                                    {username[0].toUpperCase()}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white">@{username}</h3>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Account Section */}
                    {username && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <UserIcon size={20} style={{ color: accentColor }} />
                                <h3 className="font-semibold text-zinc-900 dark:text-white">Account</h3>
                            </div>
                            <div className="pl-7 space-y-3">
                                <div>
                                    <label className="text-sm text-zinc-500 dark:text-zinc-400">Username</label>
                                    <p className="text-zinc-900 dark:text-white font-medium">@{username}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Theme Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Palette size={20} style={{ color: accentColor }} />
                            <h3 className="font-semibold text-zinc-900 dark:text-white">Appearance</h3>
                        </div>
                        <div className="pl-7 space-y-4">
                            {/* Light/Dark Mode */}
                            <div className="space-y-2">
                                <label className="text-sm text-zinc-500 dark:text-zinc-400">Mode</label>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => theme === 'dark' && onToggleTheme()}
                                        className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-colors ${theme === 'light'
                                                ? ''
                                                : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 text-zinc-600 dark:text-zinc-400'
                                            }`}
                                        style={theme === 'light' ? { borderColor: accentColor, backgroundColor: `${accentColor}1A`, color: accentColor } : undefined}
                                    >
                                        Light
                                    </button>
                                    <button
                                        onClick={() => theme === 'light' && onToggleTheme()}
                                        className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-colors ${theme === 'dark'
                                                ? ''
                                                : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 text-zinc-600 dark:text-zinc-400'
                                            }`}
                                        style={theme === 'dark' ? { borderColor: accentColor, backgroundColor: `${accentColor}1A`, color: accentColor } : undefined}
                                    >
                                        Dark
                                    </button>
                                </div>
                            </div>

                            {/* Accent Color */}
                            <div className="space-y-2">
                                <label className="text-sm text-zinc-500 dark:text-zinc-400">Accent Color</label>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {ACCENT_COLORS.map((color) => {
                                        const isSelected = accent === color.id;
                                        const isDynamic = color.id === 'dynamic';
                                        return (
                                            <button
                                                key={color.id}
                                                onClick={() => setAccent(color.id)}
                                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                                    isSelected
                                                        ? 'text-white shadow-sm'
                                                        : 'bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/10'
                                                }`}
                                                style={isSelected ? { backgroundColor: isDynamic ? '#7c3aed' : color.preview, color: isDynamic ? '#fff' : accentTextColor } : undefined}
                                            >
                                                <span
                                                    className="w-4 h-4 rounded-full flex-shrink-0"
                                                    style={isDynamic
                                                        ? { backgroundImage: 'linear-gradient(135deg, #ef4444, #eab308, #22c55e, #3b82f6, #a855f7)' }
                                                        : { backgroundColor: color.preview }
                                                    }
                                                />
                                                {color.name}
                                            </button>
                                        );
                                    })}
                                </div>
                                {accent === 'dynamic' && (
                                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                                        Changes with album art
                                    </p>
                                )}
                            </div>

                            {/* Now Playing Size */}
                            <div className="space-y-2">
                                <label className="text-sm text-zinc-500 dark:text-zinc-400">Now Playing Size</label>
                                <div className="flex gap-3">
                                    {([['compact', 'Compact'], ['default', 'Default'], ['large', 'Large'], ['xlarge', 'Extra Large']] as const).map(([value, label]) => (
                                        <button
                                            key={value}
                                            onClick={() => setNowPlayingScale(value)}
                                            className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-colors ${nowPlayingScale === value
                                                    ? ''
                                                    : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 text-zinc-600 dark:text-zinc-400'
                                                }`}
                                            style={nowPlayingScale === value ? { borderColor: accentColor, backgroundColor: `${accentColor}1A`, color: accentColor } : undefined}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Radio Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Radio size={20} style={{ color: accentColor }} />
                            <h3 className="font-semibold text-zinc-900 dark:text-white">Radio Station</h3>
                        </div>
                        <div className="pl-7 space-y-4">
                            {/* Connection Status */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-zinc-500 dark:text-zinc-400">Status</span>
                                <div className="flex items-center gap-2">
                                    <div
                                        className={`w-2 h-2 rounded-full ${radio.isConnected ? 'animate-pulse' : 'bg-zinc-400'}`}
                                        style={radio.isConnected ? { backgroundColor: accentColor } : undefined}
                                    />
                                    <span className="text-sm text-zinc-900 dark:text-white">
                                        {radio.isConnected ? 'Connected' : 'Disconnected'}
                                    </span>
                                </div>
                            </div>

                            {/* Listener Count */}
                            {radio.isConnected && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-zinc-500 dark:text-zinc-400">Listeners</span>
                                    <div className="flex items-center gap-2">
                                        <Users size={14} style={{ color: accentColor }} />
                                        <span className="text-sm text-zinc-900 dark:text-white">{radio.listenerCount}</span>
                                    </div>
                                </div>
                            )}

                            {/* Owner Status */}
                            {radio.isConnected && (
                                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700/50">
                                    {radio.isOwner ? (
                                        <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 px-3 py-2 rounded-lg">
                                            <Crown size={16} />
                                            <span className="text-sm font-medium">You are the radio owner</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <label className="text-sm text-zinc-500 dark:text-zinc-400">Claim Admin Access</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="password"
                                                    value={ownerSecret}
                                                    onChange={(e) => setOwnerSecret(e.target.value)}
                                                    placeholder="Enter owner secret"
                                                    className="flex-1 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2"
                                                    style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleClaimOwner()}
                                                />
                                                <button
                                                    onClick={handleClaimOwner}
                                                    disabled={isClaiming || !ownerSecret.trim()}
                                                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                                                    style={{
                                                        background: `linear-gradient(to right, ${accentColor}, ${accentColorDark})`,
                                                        color: accentTextColor,
                                                    }}
                                                >
                                                    {isClaiming ? '...' : 'Claim'}
                                                </button>
                                            </div>
                                            {claimError && (
                                                <p className="text-xs text-red-500">{claimError}</p>
                                            )}
                                            <p className="text-xs text-zinc-400 dark:text-zinc-500">
                                                Admin can instantly skip songs and change generation settings.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* About Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Info size={20} style={{ color: accentColor }} />
                            <h3 className="font-semibold text-zinc-900 dark:text-white">About</h3>
                        </div>
                        <div className="pl-7 space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
                            <p>Version 1.0.0</p>
                            <p>RAIDIO - AI Music Radio</p>
                            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
                                Open source and free to use. Powered by ACE-Step.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-zinc-200 dark:border-white/10 p-6 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 font-semibold rounded-lg transition-colors hover:opacity-90"
                        style={{
                            background: `linear-gradient(to right, ${accentColor}, ${accentColorDark})`,
                            color: accentTextColor,
                            boxShadow: `0 0 8px 1px ${accentColor}50, 0 0 16px 4px ${accentColor}25`,
                        }}
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};
