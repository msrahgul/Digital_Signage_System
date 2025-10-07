import React from 'react';
import { Player } from '../../types';
import { X, Monitor, Wifi, MapPin, Clock, Settings, RotateCcw } from 'lucide-react';

interface PlayerDetailsModalProps {
  player: Player;
  onClose: () => void;
  onRestart: (id: string) => void;
}

const PlayerDetailsModal: React.FC<PlayerDetailsModalProps> = ({ player, onClose, onRestart }) => {
  const getStatusColor = (status: Player['status']) => {
    switch (status) {
      case 'online':
        return 'text-green-600 bg-green-50';
      case 'offline':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Monitor className="mr-2 h-5 w-5" />
                Player Details
              </h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Player Info */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">{player.name}</h4>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Status:</span>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(player.status)}`}>
                      {player.status.charAt(0).toUpperCase() + player.status.slice(1)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 flex items-center">
                      <MapPin className="h-3 w-3 mr-1" />
                      Location:
                    </span>
                    <span className="text-sm font-medium text-gray-900">{player.location}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 flex items-center">
                      <Wifi className="h-3 w-3 mr-1" />
                      IP Address:
                    </span>
                    <span className="text-sm font-medium text-gray-900 font-mono">{player.ipAddress}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 flex items-center">
                      <Settings className="h-3 w-3 mr-1" />
                      Version:
                    </span>
                    <span className="text-sm font-medium text-gray-900">{player.version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      Last Sync:
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {new Date(player.lastSync).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Current Content */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Current Content</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  {player.currentPlaylist ? (
                    <div>
                      <p className="text-sm font-medium text-gray-900">{player.currentPlaylist}</p>
                      <p className="text-xs text-gray-500 mt-1">Active playlist</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No content currently playing</p>
                  )}
                </div>
              </div>

              
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-between">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              {player.status === 'online' && (
                <button
                  onClick={() => {
                    onRestart(player.id);
                    onClose();
                  }}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Restart Player
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerDetailsModal;