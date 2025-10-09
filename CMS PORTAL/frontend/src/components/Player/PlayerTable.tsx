import React from 'react';
import { Player } from '../../types';
import { Monitor, Edit, Trash2, RotateCcw, Eye, PlaySquare } from 'lucide-react';

interface PlayerTableProps {
  players: Player[];
  onDetails: (player: Player) => void;
  onEdit: (player: Player) => void;
  onPreview: (player: Player) => void;
  onDelete: (player: Player) => void;
  onRestart: (id: string) => void;
}

const PlayerTable: React.FC<PlayerTableProps> = ({
  players,
  onDetails,
  onPreview,
  onEdit,
  onDelete,
  onRestart
}) => {
  const getStatusBadge = (status: Player['status']) => {
    const colors = {
      online: 'bg-green-100 text-green-800',
      offline: 'bg-red-100 text-red-800',
      maintenance: 'bg-yellow-100 text-yellow-800'
    };

    return (
      <span className={`inline-flex px-2 text-xs font-semibold rounded-full ${colors[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatLastSync = (lastSync: string) => {
    const date = new Date(lastSync);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (players.length === 0) {
    return (
      <div className="text-center py-12">
        <Monitor size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900">No Players Connected</h3>
        <p className="text-gray-500">Start a player app to see it appear here</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Player
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Sync
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {players.map((player) => (
              <tr key={player.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <Monitor size={20} className="text-gray-400 mr-3" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{player.name}</div>
                      <div className="text-sm text-gray-500">{player.ipAddress}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {player.location}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(player.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{formatLastSync(player.lastSync)}</div>
                  <div className="text-sm text-gray-500">Version {player.version}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onDetails(player)}
                      className="text-blue-600 hover:text-blue-900"
                      title="View Details"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => onPreview(player)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Live Preview"
                    >
                      <PlaySquare size={16} />
                    </button>
                    <button
                      onClick={() => onEdit(player)}
                      className="text-green-600 hover:text-green-900"
                      title="Edit Player"
                    >
                      <Edit size={16} />
                    </button>
                    {player.status === 'online' && (
                      <button
                        onClick={() => onRestart(player.id)}
                        className="text-yellow-600 hover:text-yellow-900"
                        title="Restart Player"
                      >
                        <RotateCcw size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(player)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete Player"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PlayerTable;
