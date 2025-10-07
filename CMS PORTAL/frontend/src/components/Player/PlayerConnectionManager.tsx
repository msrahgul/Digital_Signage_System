import React, { useState, useEffect } from 'react';
import { Player } from '../../types';
import { Monitor, Wifi, WifiOff, Settings, RotateCcw, RefreshCw } from 'lucide-react';

interface PlayerConnectionManagerProps {
  players: Player[];
  onPlayerCommand: (playerId: string, command: string, data?: any) => void;
}

const PlayerConnectionManager: React.FC<PlayerConnectionManagerProps> = ({
  players,
  onPlayerCommand
}) => {
  const [connectedPlayers, setConnectedPlayers] = useState<Set<string>>(new Set());
  const [playerStatuses, setPlayerStatuses] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    // WebSocket connection for real-time updates
    const ws = new WebSocket('ws://localhost:4000');
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'cms-connect' }));
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (e) {
        console.error('WebSocket message error:', e);
      }
    };
    
    return () => {
      ws.close();
    };
  }, []);

  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'player-connected':
        setConnectedPlayers(prev => new Set([...prev, data.player.id]));
        break;
      case 'player-disconnected':
        setConnectedPlayers(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.player.id);
          return newSet;
        });
        break;
      case 'player-status':
        setPlayerStatuses(prev => new Map(prev.set(data.playerId, data.status)));
        break;
    }
  };

  const sendPlayerCommand = (playerId: string, command: string, data?: any) => {
    onPlayerCommand(playerId, command, data);
  };

  const getDeviceTypeIcon = (deviceType?: string) => {
    switch (deviceType) {
      case 'large_display':
        return '🖥️';
      case 'small_display':
        return '📱';
      default:
        return '💻';
    }
  };

  const formatDeviceInfo = (deviceInfo?: any) => {
    if (!deviceInfo) return 'Unknown Device';
    return `${deviceInfo.screenWidth}x${deviceInfo.screenHeight} (${deviceInfo.deviceType})`;
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900">Connected Players</h3>
        <div className="text-sm text-gray-500">
          {connectedPlayers.size} of {players.length} online
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {players.map((player) => {
          const isConnected = connectedPlayers.has(player.id) || player.isConnected;
          const playerStatus = playerStatuses.get(player.id) || player.status;
          
          return (
            <div
              key={player.id}
              className={`border rounded-lg p-4 transition-colors ${
                isConnected ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{getDeviceTypeIcon(player.deviceInfo?.deviceType)}</span>
                  <div>
                    <span className="font-medium text-gray-900">{player.name}</span>
                    <div className="text-xs text-gray-500">{player.location}</div>
                  </div>
                </div>
                {isConnected ? (
                  <Wifi size={16} className="text-green-600" />
                ) : (
                  <WifiOff size={16} className="text-red-600" />
                )}
              </div>
              
              <div className="text-sm text-gray-600 mb-3 space-y-1">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={`capitalize ${
                    playerStatus === 'online' ? 'text-green-600' : 
                    playerStatus === 'offline' ? 'text-red-600' : 
                    'text-yellow-600'
                  }`}>
                    {playerStatus}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Resolution:</span>
                  <span>{formatDeviceInfo(player.deviceInfo)}</span>
                </div>
                <div className="flex justify-between">
                  <span>IP Address:</span>
                  <span>{player.ipAddress}</span>
                </div>
                {player.lastSync && (
                  <div className="flex justify-between">
                    <span>Last Sync:</span>
                    <span>{new Date(player.lastSync).toLocaleTimeString()}</span>
                  </div>
                )}
              </div>

              {player.currentPlaylist && (
                <div className="text-sm text-blue-600 mb-3 p-2 bg-blue-50 rounded">
                  <div className="flex items-center space-x-1">
                    <Monitor size={12} />
                    <span>Playing: {player.currentPlaylist}</span>
                  </div>
                </div>
              )}

              {playerStatuses.get(player.id) && (
                <div className="text-xs text-gray-500 mb-3">
                  Status: {playerStatuses.get(player.id)}
                </div>
              )}

              <div className="flex space-x-2">
                <button
                  onClick={() => sendPlayerCommand(player.id, 'refresh_content')}
                  className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center justify-center space-x-1"
                  disabled={!isConnected}
                >
                  <RefreshCw size={10} />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={() => sendPlayerCommand(player.id, 'restart')}
                  className="flex-1 px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors flex items-center justify-center space-x-1"
                  disabled={!isConnected}
                >
                  <RotateCcw size={10} />
                  <span>Restart</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {players.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Monitor size={48} className="mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium">No Players Connected</p>
          <p className="text-sm">Start a player app to see it appear here</p>
        </div>
      )}
    </div>
  );
};

export default PlayerConnectionManager;
