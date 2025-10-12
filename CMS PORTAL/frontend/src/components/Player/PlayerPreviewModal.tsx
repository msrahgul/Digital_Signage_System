import React, { useState, useEffect, useRef } from 'react';
import { Player, MediaItem } from '../../types';
import { X, WifiOff, Loader, AlertTriangle, Film, Image as ImageIcon, Type, Clock, Radio } from 'lucide-react';

const BACKEND_URL = `${window.location.protocol}//${window.location.hostname}:4000`;

interface PlayerPreviewModalProps {
  player: Player;
  onClose: () => void;
}

const PlayerPreviewModal: React.FC<PlayerPreviewModalProps> = ({ player, onClose }) => {
  const [playerState, setPlayerState] = useState<any>({ status: player.status || 'connecting' });
  const [playlist, setPlaylist] = useState<MediaItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);

  // Effect to fetch initial data and subscribe to live updates
  useEffect(() => {
    if (player.status === 'offline') {
      setPlayerState({ status: 'offline' });
      return;
    }

    const fetchSchedule = async () => {
      try {
        const scheduleResponse = await fetch(`${BACKEND_URL}/player-schedule/${player.id}`);
        if (scheduleResponse.ok) {
          const scheduleData = await scheduleResponse.json();
          setPlaylist(scheduleData.media);
        }
      } catch (err) {
        console.error("Failed to fetch schedule:", err);
      }
    };

    fetchSchedule();

    const eventSource = new EventSource(`${BACKEND_URL}/api/players/${player.id}/subscribe`);

    const fetchInitialState = async () => {
      try {
        const stateResponse = await fetch(`${BACKEND_URL}/api/players/${player.id}/preview`);
        setPlayerState(stateResponse.ok ? await stateResponse.json() : { status: 'offline' });
      } catch (err) {
        setPlayerState({ status: 'offline' });
      }
    };

    eventSource.onopen = fetchInitialState;
    eventSource.onmessage = (event) => {
      setPlayerState(JSON.parse(event.data));
      setError(null);
    };
    eventSource.onerror = () => {
      setError("Connection to the player was lost.");
      setPlayerState({ status: 'offline' });
      eventSource.close();
    };

    return () => eventSource.close();
  }, [player.id, player.status]);

  // Effect to sync video time ONLY when in "Live" mode
  useEffect(() => {
    if (previewItem === null && videoRef.current && playerState?.mediaType === 'video' && playerState.status === 'playing') {
      // If we are far behind, jump to the correct time
      if (Math.abs(videoRef.current.currentTime - playerState.currentTime) > 2) {
        videoRef.current.currentTime = playerState.currentTime;
      }
      // Sync play/pause state
      if (videoRef.current.paused) {
        videoRef.current.play().catch(console.error);
      }
    } else if (previewItem === null && videoRef.current && playerState.status !== 'playing' && !videoRef.current.paused) {
      videoRef.current.pause();
    }
  }, [playerState, previewItem]);

  const handleMediaError = () => {
    setError(`Failed to load media.`);
  };

  const getIcon = (type: string, size = 24) => {
    switch (type) {
      case 'video': return <Film size={size} className="text-purple-300" />;
      case 'image': return <ImageIcon size={size} className="text-teal-300" />;
      case 'text': return <Type size={size} className="text-amber-300" />;
      default: return null;
    }
  };
 
  const renderContent = () => {
    const nowPlayingItem = playerState.status === 'playing' ? playlist.find(item => playerState.mediaUrl?.includes(item.url)) : null;
    const itemToRender = previewItem || nowPlayingItem;

    if (error && playerState.status !== 'playing') {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full text-white bg-gray-900 rounded-lg">
          <AlertTriangle className="h-16 w-16 text-yellow-400 mb-4" />
          <p className="text-lg text-yellow-400">Error</p>
          <p className="text-sm text-gray-300 break-all">{error}</p>
        </div>
      );
    }
    if (playerState.status === 'offline') {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-gray-900 rounded-lg">
          <WifiOff className="h-16 w-16 text-gray-400 mb-4" />
          <p className="text-lg text-gray-400">Player is offline</p>
        </div>
      );
    }
    if (playerState.status === 'idle' || playerState.status === 'connecting' || !itemToRender) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-gray-900 rounded-lg">
          <Loader className="h-16 w-16 text-gray-400 mb-4 animate-spin" />
          <p className="text-lg text-gray-400">{playerState.status === 'idle' ? 'Player is idle' : 'Connecting...'}</p>
        </div>
      );
    }

    if (itemToRender.type === 'image') {
      return <img key={itemToRender.id} src={`${BACKEND_URL}/${itemToRender.url}`} onError={handleMediaError} className="max-h-full max-w-full object-contain rounded-lg shadow-lg" alt={itemToRender.name} />;
    }
    if (itemToRender.type === 'video') {
      return (
        <video
          key={itemToRender.id} // Using ID as key forces re-mount and starts video from beginning
          ref={videoRef}
          src={`${BACKEND_URL}/${itemToRender.url}`}
          className="max-h-full max-w-full object-contain rounded-lg shadow-lg"
          controls
          autoPlay
          muted
          onError={handleMediaError}
        />
      );
    }
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 rounded-lg">
        <p className="text-white">Unsupported media type: {itemToRender.type}</p>
      </div>
    );
  };

  const currentMediaIndex = playlist.findIndex(item => playerState?.mediaUrl?.includes(item.url));
  const nowPlaying = currentMediaIndex !== -1 ? playlist[currentMediaIndex] : null;
  const upcomingMedia = currentMediaIndex !== -1 ? playlist.slice(currentMediaIndex + 1) : playlist;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 bg-opacity-80 border border-gray-700 rounded-2xl shadow-2xl w-full h-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-medium text-white">Live Preview: {player.name}</h3>
            {previewItem ? (
              <span className="px-2 py-1 text-xs font-medium text-yellow-300 bg-yellow-900 rounded-md">PREVIEW</span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-300 bg-red-900 rounded-md">
                <Radio size={12} className="animate-pulse" /> LIVE
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
        </div>
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-grow flex items-center justify-center p-4 overflow-hidden">
            {renderContent()}
          </div>
          <div className="w-96 bg-gray-900 bg-opacity-70 border-l border-gray-700 p-4 flex flex-col">
            <h4 className="text-white text-lg mb-4 font-semibold">Playlist</h4>
            {nowPlaying && (
              <div className="mb-4">
                <p className="text-sm text-gray-400 mb-2">Now Playing (Click to Sync)</p>
                <div className="bg-gray-700 rounded-lg p-3 shadow-md cursor-pointer" onClick={() => setPreviewItem(null)}>
                  <div className="flex items-center">
                    <div className="flex-shrink-0">{getIcon(nowPlaying.type, 20)}</div>
                    <div className="ml-3">
                      <p className="text-white font-medium truncate">{nowPlaying.name}</p>
                      <div className="flex items-center text-xs text-gray-400">
                        <Clock size={12} className="mr-1" />
                        <span>{nowPlaying.playlistDuration || 'N/A'}s</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <p className="text-sm text-gray-400 mb-2">Upcoming</p>
            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              {upcomingMedia.length > 0 ? (
                upcomingMedia.map((item) => (
                  <div key={item.id} className="bg-gray-800 rounded-lg p-3 shadow-sm hover:bg-gray-700 transition-colors group cursor-pointer" onClick={() => setPreviewItem(item)}>
                    <div className="flex items-center">
                      <div className="flex-shrink-0">{getIcon(item.type)}</div>
                      <div className="ml-4">
                        <p className="text-white font-medium truncate">{item.name}</p>
                        <div className="flex items-center text-xs text-gray-400">
                          <Clock size={12} className="mr-1" />
                          <span>{item.playlistDuration || 'N/A'}s</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10"><p className="text-gray-500">No upcoming media.</p></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerPreviewModal;