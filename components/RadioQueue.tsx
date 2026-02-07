import React from 'react';
import { Radio, Users, Music, Crown, Clock, Play, Pause } from 'lucide-react';
import { useRadio } from '../context/RadioContext';
import { AlbumCover } from './AlbumCover';

interface RadioQueueProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
}

export const RadioQueue: React.FC<RadioQueueProps> = ({ isPlaying, onTogglePlay }) => {
  const {
    isConnected,
    currentSong,
    queue,
    listeners,
    listenerCount,
    skipVotes,
    skipRequired,
    isOwner,
    ownerId,
    voteSkip,
    ownerSkip,
  } = useRadio();

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isConnected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
          <Radio size={32} className="text-zinc-400" />
        </div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Connecting to Radio...</h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">Please wait while we connect you to the radio station.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-white/5 bg-gradient-to-r from-pink-500/10 to-purple-500/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center">
              <Radio size={20} className="text-pink-500 animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-zinc-900 dark:text-white">Radio Station</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Everyone hears the same music</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
              <Users size={16} />
              <span className="text-sm font-medium">{listenerCount} listening</span>
            </div>
            {isOwner && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">
                <Crown size={12} />
                <span className="text-xs font-medium">Admin</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Now Playing */}
      <div className="p-6 border-b border-zinc-200 dark:border-white/5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-4">Now Playing</h2>
        {currentSong ? (
          <div className="flex gap-4">
            {/* Album Art */}
            <div className="w-32 h-32 rounded-lg overflow-hidden shadow-lg flex-shrink-0 relative group">
              {currentSong.coverUrl ? (
                <img src={currentSong.coverUrl} alt={currentSong.title} className="w-full h-full object-cover" />
              ) : (
                <AlbumCover seed={currentSong.id} size="full" className="w-full h-full" />
              )}
              {/* Play/Pause overlay */}
              <button
                onClick={onTogglePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {isPlaying ? (
                  <Pause size={40} className="text-white" fill="white" />
                ) : (
                  <Play size={40} className="text-white ml-1" fill="white" />
                )}
              </button>
            </div>

            {/* Song Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white truncate">{currentSong.title}</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{currentSong.creator || 'Unknown Artist'}</p>
              {currentSong.style && (
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2 line-clamp-2">{currentSong.style}</p>
              )}
              <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                  <Clock size={14} />
                  <span className="text-xs">{formatDuration(currentSong.duration)}</span>
                </div>
                {/* Skip Vote */}
                <button
                  onClick={voteSkip}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/20 transition-colors text-sm"
                >
                  <span className="text-zinc-600 dark:text-zinc-300">Skip</span>
                  <span className="text-zinc-400">({skipVotes}/{skipRequired})</span>
                </button>
                {isOwner && (
                  <button
                    onClick={ownerSkip}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-500/20 hover:bg-yellow-500/30 transition-colors text-yellow-600 dark:text-yellow-400 text-sm"
                  >
                    <Crown size={12} />
                    Force Skip
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg">
            <div className="text-center">
              <Music size={32} className="mx-auto text-zinc-400 mb-2" />
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">No song playing</p>
              <p className="text-zinc-400 dark:text-zinc-500 text-xs mt-1">Generate a song to start the radio!</p>
            </div>
          </div>
        )}
      </div>

      {/* Queue */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Up Next</h2>
            <span className="text-xs text-zinc-400">{queue.length} songs</span>
          </div>

          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                <Music size={24} className="text-zinc-400" />
              </div>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">Queue is empty</p>
              <p className="text-zinc-400 dark:text-zinc-500 text-xs mt-1">Generated songs will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {queue.map((song, index) => (
                <div
                  key={song.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
                >
                  {/* Position */}
                  <div className="w-6 text-center text-sm font-medium text-zinc-400">
                    {index + 1}
                  </div>

                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0">
                    {song.coverUrl ? (
                      <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
                    ) : (
                      <AlbumCover seed={song.id} size="full" className="w-full h-full" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-zinc-900 dark:text-white truncate">{song.title}</h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{song.creator || 'Unknown'}</p>
                  </div>

                  {/* Duration */}
                  <div className="text-xs text-zinc-400 font-mono">
                    {formatDuration(song.duration)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Listeners Panel */}
      <div className="border-t border-zinc-200 dark:border-white/5 p-4 bg-zinc-50 dark:bg-white/5">
        <div className="flex items-center gap-2 mb-3">
          <Users size={14} className="text-zinc-500" />
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Listeners ({listenerCount})</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {listeners.slice(0, 10).map((listener) => (
            <div
              key={listener.id}
              className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs"
            >
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-[8px] text-white font-bold">
                {listener.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-zinc-700 dark:text-zinc-300 max-w-[80px] truncate">{listener.name}</span>
              {listener.id === ownerId && <Crown size={10} className="text-yellow-500" />}
            </div>
          ))}
          {listeners.length > 10 && (
            <div className="px-2 py-1 text-xs text-zinc-400">
              +{listeners.length - 10} more
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
