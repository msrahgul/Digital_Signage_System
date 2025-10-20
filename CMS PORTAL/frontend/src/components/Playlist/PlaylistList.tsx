import React from 'react';
import { Playlist, MediaItem, User } from '../../types';
import { Edit, Trash2, Copy, Play, Clock, Calendar, User as UserIcon } from 'lucide-react';

interface PlaylistListProps {
  playlists: Playlist[];
  media: MediaItem[];
  onEdit: (playlist: Playlist) => void;
  onDelete: (id: string) => void;
  onDuplicate: (playlist: Playlist) => void;
  user: User | null;
}

const PlaylistList: React.FC<PlaylistListProps> = ({
  playlists,
  media,
  onEdit,
  onDelete,
  onDuplicate,
  user
}) => {
  const canEdit = (playlist: Playlist) => {
    if (!user) return false;
    if (user.role === 'root' || user.role === 'supervisor') return true;
    if (user.role === 'user') {
      return playlist.createdBy === user.username;
    }
    return false;
  };

  const canDelete = (playlist: Playlist) => {
    if (!user) return false;
    if (user.role === 'root') return true;
    if (user.role === 'supervisor') {
      const playlistCreatedBy = playlists.find(p => p.id === playlist.id)?.createdBy;
      const users = ['user1', 'user2'];
      return users.includes(playlistCreatedBy || '');
    }
    if (user.role === 'user') {
      return playlist.createdBy === user.username;
    }
    return false;
  };

  const getMediaNames = (mediaIds: string[]) => {
    return mediaIds
      .map(id => media.find(m => m.id === id)?.name)
      .filter(Boolean)
      .slice(0, 3)
      .join(', ');
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };

  if (playlists.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <Play className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No playlists found</h3>
        <p className="text-gray-500">Create your first playlist to get started</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {playlists.map((playlist) => (
        <div
          key={playlist.id}
          className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">{playlist.name}</h3>
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                playlist.isActive
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {playlist.isActive ? 'Active' : 'Inactive'}
              </div>
            </div>

            <p className="text-gray-600 text-sm mb-4 line-clamp-2">{playlist.description}</p>

            <div className="space-y-2 mb-4">
              <div className="flex items-center text-sm text-gray-500">
                <Clock className="h-4 w-4 mr-2" />
                Duration: {formatDuration(playlist.totalDuration)}
              </div>
              <div className="flex items-center text-sm text-gray-500">
                <Play className="h-4 w-4 mr-2" />
                {playlist.mediaItems.length} item{playlist.mediaItems.length !== 1 ? 's' : ''}
              </div>
              <div className="flex items-center text-sm text-gray-500">
                <UserIcon className="h-4 w-4 mr-2" />
                Created by {playlist.createdBy}
              </div>
              <div className="flex items-center text-sm text-gray-500">
                <Calendar className="h-4 w-4 mr-2" />
                {new Date(playlist.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-2">
            <button
              onClick={() => onDuplicate(playlist)}
              className="text-gray-600 hover:text-gray-800 p-1 rounded"
              title="Duplicate"
            >
              <Copy className="h-4 w-4" />
            </button>
            {canEdit(playlist) && (
              <button
                onClick={() => onEdit(playlist)}
                className="text-blue-600 hover:text-blue-800 p-1 rounded"
                title="Edit"
              >
                <Edit className="h-4 w-4" />
              </button>
            )}
            {canDelete(playlist) && (
              <button
                onClick={() => onDelete(playlist.id)}
                className="text-red-600 hover:text-red-800 p-1 rounded"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PlaylistList;