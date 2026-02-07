import React, { useState } from 'react';
import { Users, Crown, X, Radio } from 'lucide-react';
import { useRadio } from '../context/RadioContext';
import { useTheme } from '../context/ThemeContext';

interface RadioListenersProps {
  className?: string;
}

export const RadioListeners: React.FC<RadioListenersProps> = ({ className = '' }) => {
  const { listeners, listenerCount, ownerId, isOwner, isConnected } = useRadio();
  const { accentColor, accentColorDark, accentTextColor } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isConnected) {
    return null;
  }

  const panelGradient = `radial-gradient(circle at 50% -10%, ${accentColor}20 0%, transparent 70%)`;

  return (
    <div className={`relative ${className}`}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-3 py-2 rounded-full transition-colors hover:opacity-80"
        style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
      >
        <Radio size={16} />
        <Users size={16} />
        <span className="text-sm font-medium">{listenerCount}</span>
      </button>

      {/* Expanded Panel */}
      {isExpanded && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsExpanded(false)}
          />

          {/* Panel */}
          <div
            className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-white/10 z-50 overflow-hidden"
            style={{ backgroundImage: panelGradient }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Radio size={16} style={{ color: accentColor }} />
                <span className="font-semibold text-sm">Radio Listeners</span>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 rounded transition-colors hover:opacity-80"
                style={{ color: accentColor }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {listeners.length === 0 ? (
                <div className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400 text-sm">
                  No listeners connected
                </div>
              ) : (
                <ul className="py-2">
                  {listeners.map((listener) => (
                    <li
                      key={listener.id}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-zinc-50 dark:hover:bg-white/5"
                    >
                      {/* Avatar */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          background: `linear-gradient(to bottom right, ${accentColor}, ${accentColorDark})`,
                          color: accentTextColor,
                        }}
                      >
                        {listener.name.charAt(0).toUpperCase()}
                      </div>

                      {/* Name */}
                      <span className="flex-1 text-sm font-medium truncate">
                        {listener.name}
                      </span>

                      {/* Owner Badge */}
                      {listener.id === ownerId && (
                        <Crown size={14} className="text-yellow-500" />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {isOwner && (
              <div className="px-4 py-3 border-t border-zinc-200 dark:border-white/10" style={{ backgroundColor: `${accentColor}08` }}>
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <Crown size={12} className="text-yellow-500" />
                  <span>You are the radio owner</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
