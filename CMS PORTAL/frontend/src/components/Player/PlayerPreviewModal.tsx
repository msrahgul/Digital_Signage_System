import React, { useState, useEffect, useRef } from 'react';
import { Player } from '../../types';
import { X, WifiOff, Loader, AlertTriangle } from 'lucide-react';

const BACKEND_URL = 'http://localhost:4000';

interface PlayerPreviewModalProps {
  player: Player;
  onClose: () => void;
}

const PlayerPreviewModal: React.FC<PlayerPreviewModalProps> = ({ player, onClose }) => {
  const [playerState, setPlayerState] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Fetch initial state
    const fetchInitialState = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/players/${player.id}/preview`);
        if (response.ok) {
          const state = await response.json();
          setPlayerState(state);
        } else {
          setPlayerState({ status: 'offline' });
        }
      } catch (error) {
        setPlayerState({ status: 'offline' });
      }
    };

    fetchInitialState();

    const eventSource = new EventSource(`${BACKEND_URL}/api/players/${player.id}/subscribe`);
    eventSource.onmessage = (event) => {
      const state = JSON.parse(event.data);
      setPlayerState(state);
      setError(null); // Clear previous errors on new state
    };
    
    eventSource.onerror = () => {
      setError("Connection to server lost.");
      setPlayerState({ status: 'offline' });
    };

    return () => {
      eventSource.close();
    };
  }, [player.id]);


  useEffect(() => {
    if (videoRef.current && playerState?.mediaType === 'video') {
      // Only seek if the time difference is significant
      if (Math.abs(videoRef.current.currentTime - playerState.currentTime) > 2) {
        videoRef.current.currentTime = playerState.currentTime;
      }
      if (playerState.status === 'playing' && videoRef.current.paused) {
        videoRef.current.play().catch(error => {
            console.error("Autoplay failed", error);
            setError("Could not autoplay video. Please click play.");
        });
      } else if (playerState.status !== 'playing' && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    }
  }, [playerState]);
  
  const handleMediaError = () => {
    setError(`Failed to load media: ${playerState?.mediaUrl}`);
  };

  const renderContent = () => {
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-white">
              <AlertTriangle className="h-16 w-16 text-yellow-400 mb-4" />
              <p className="text-lg text-yellow-400">Media Error</p>
              <p className="text-sm text-gray-300 break-all">{error}</p>
            </div>
          );
    }
    
    if (!playerState || playerState.status === 'offline') {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <WifiOff className="h-16 w-16 text-gray-400 mb-4" />
          <p className="text-lg text-gray-600">Player is offline</p>
        </div>
      );
    }

    if (playerState.status === 'idle') {
        return (
            <div className="flex flex-col items-center justify-center h-full">
            <Loader className="h-16 w-16 text-gray-400 mb-4 animate-spin" />
            <p className="text-lg text-gray-600">Player is idle</p>
            </div>
        );
    }

    if (playerState.mediaType === 'image') {
      return <img key={playerState.mediaUrl} src={playerState.mediaUrl} onError={handleMediaError} className="max-h-full max-w-full object-contain" alt={playerState.mediaUrl} />;
    }

    if (playerState.mediaType === 'video') {
      return (
        <video 
            key={playerState.mediaUrl} 
            ref={videoRef} 
            src={playerState.mediaUrl} 
            className="max-h-full max-w-full object-contain" 
            controls 
            autoPlay 
            muted
            onError={handleMediaError}
        />
      );
    }
    
    return <p className="text-white">Unsupported media type: {playerState.mediaType}</p>;
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-black rounded-lg shadow-xl w-3/4 h-3/4 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-lg font-medium text-white">Live Preview: {player.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default PlayerPreviewModal;