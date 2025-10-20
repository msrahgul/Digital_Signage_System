// src/components/Media/MediaTable.tsx
import React from 'react';
import { MediaItem, User } from '../../types';
import { Image, Video, Type, Trash, Eye, FileText, Link as LinkIcon } from 'lucide-react';

interface MediaTableProps {
  media: MediaItem[];
  onDelete: (media: MediaItem) => void;
  onPreview: (media: MediaItem) => void;
  canEdit: boolean;
  currentUser: User | null;
}

const MediaTable: React.FC<MediaTableProps> = ({
  media,
  onDelete,
  onPreview,
  canEdit,
  currentUser,
}) => {
  const getTypeIcon = (type: MediaItem['type']) => {
    switch (type) {
      case 'image':
        return <Image className="inline-block mr-1" />;
      case 'video':
        return <Video className="inline-block mr-1" />;
      case 'document-group':
        return <FileText className="inline-block mr-1" />;
      case 'url':
        return <LinkIcon className="inline-block mr-1" />;
      default:
        return null;
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const canDelete = (item: MediaItem) => {
    if (!currentUser) return false;
    if (currentUser.role === 'root') return true;
    if (currentUser.role === 'supervisor') {
      return item.uploadedBy !== 'root';
    }
    if (currentUser.role === 'user') {
      return item.uploadedBy === currentUser.username;
    }
    return false;
  };

  if (media.length === 0) {
    return (
      <p className="text-gray-600 italic mt-4">
        No media found. Upload your first media file to get started.
      </p>
    );
  }

  return (
    <table className="w-full border-collapse border border-gray-300 rounded-md overflow-hidden">
      <thead className="bg-gray-100">
        <tr>
          <th className="p-3 border border-gray-300 text-left">Media</th>
          <th className="p-3 border border-gray-300">Type</th>
          <th className="p-3 border border-gray-300">Size</th>
          <th className="p-3 border border-gray-300">Tags</th>
          {canEdit && <th className="p-3 border border-gray-300">Actions</th>}
        </tr>
      </thead>
      <tbody>
        {media.map((item) => (
          <tr key={item.id} className="hover:bg-gray-50">
            <td className="p-3 border border-gray-300 align-middle">
              {item.type === 'image' && item.url?.startsWith('http') && (
                <img
                  src={item.url}
                  alt={item.name}
                  className="inline-block w-12 h-8 object-cover rounded mr-2 align-middle"
                />
              )}
              <span className="align-middle">{item.name}</span>
              <br />
              <small className="text-gray-500">
                Uploaded by {item.uploadedBy}
              </small>
            </td>
            <td className="p-3 border border-gray-300 text-center align-middle">
              {getTypeIcon(item.type)} {item.type}
            </td>
            <td className="p-3 border border-gray-300 text-center align-middle">
              {formatFileSize(item.fileSize)}
            </td>
            <td className="p-3 border border-gray-300 text-center align-middle">
              {item.tags.slice(0, 2).map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-block bg-blue-100 text-blue-700 px-2 py-0.5 rounded mr-1 text-xs"
                >
                  {tag}
                </span>
              ))}
              {item.tags.length > 2 && (
                <span className="text-xs">+{item.tags.length - 2}</span>
              )}
            </td>
            {canEdit && (
              <td className="p-3 border border-gray-300 text-center align-middle space-x-4">
                <button
                  onClick={() => onPreview(item)}
                  title="Preview Media"
                  className="text-blue-600 hover:text-blue-800"
                  aria-label={`Preview ${item.name}`}
                >
                  <Eye />
                </button>
                {canDelete(item) && (
                  <button
                    onClick={() => onDelete(item)}
                    title="Delete Media"
                    className="text-red-600 hover:text-red-800"
                    aria-label={`Delete ${item.name}`}
                  >
                    <Trash />
                  </button>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default MediaTable;