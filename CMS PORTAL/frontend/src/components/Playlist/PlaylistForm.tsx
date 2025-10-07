import React, { useState, useEffect } from 'react';
import { Playlist, MediaItem, PlaylistMediaItem } from '../../types';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Save, X, Plus, GripVertical, Clock, Image, Video, Type, Trash2, FileText } from 'lucide-react';

interface PlaylistFormProps {
  playlist: Playlist | null;
  media: MediaItem[];
  onSave: (playlist: Omit<Playlist, 'id' | 'createdAt' | 'createdBy'>) => void;
  onCancel: () => void;
}

const PlaylistForm: React.FC<PlaylistFormProps> = ({ playlist, media, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: playlist?.name || '',
    description: playlist?.description || '',
    isActive: playlist?.isActive ?? true
  });

  const [selectedMediaItems, setSelectedMediaItems] = useState<PlaylistMediaItem[]>(
    playlist?.mediaItems || []
  );

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    const items = Array.from(selectedMediaItems);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setSelectedMediaItems(items);
  };

  const addMediaToPlaylist = (mediaItem: MediaItem) => {
    if (mediaItem.type === 'document-group' && mediaItem.pages) {
      const newItems = mediaItem.pages
        .map(pageId => {
          const pageMediaItem = media.find(m => m.id === pageId);
          if (pageMediaItem && !selectedMediaItems.find(item => item.mediaId === pageId)) {
            const defaultDuration = 5;
            return {
              mediaId: pageId,
              duration: defaultDuration,
            };
          }
          return null;
        })
        .filter((item): item is PlaylistMediaItem => item !== null);

      setSelectedMediaItems([...selectedMediaItems, ...newItems]);
    } else {
      if (!selectedMediaItems.find(item => item.mediaId === mediaItem.id)) {
        const defaultDuration = mediaItem?.type === 'image' ? 5 : (mediaItem?.type === 'video' ? 30 : 5);
        
        setSelectedMediaItems([...selectedMediaItems, {
          mediaId: mediaItem.id,
          duration: defaultDuration
        }]);
      }
    }
  };

  const removeMediaFromPlaylist = (mediaId: string) => {
    const mediaItem = getMediaById(mediaId);
    if (mediaItem?.groupId) {
      const group = media.find(m => m.id === mediaItem.groupId);
      if (group && group.pages) {
        const pageIds = new Set(group.pages);
        setSelectedMediaItems(selectedMediaItems.filter(item => !pageIds.has(item.mediaId)));
      }
    } else {
      setSelectedMediaItems(selectedMediaItems.filter(item => item.mediaId !== mediaId));
    }
  };

  const updateMediaDuration = (mediaId: string, duration: number) => {
    setSelectedMediaItems(selectedMediaItems.map(item =>
      item.mediaId === mediaId ? { ...item, duration } : item
    ));
  };

  const getMediaById = (id: string) => media.find(m => m.id === id);

  const totalDuration = selectedMediaItems.reduce((total, item) => {
    return total + item.duration;
  }, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      mediaItems: selectedMediaItems,
      totalDuration
    });
  };

  const getTypeIcon = (type: MediaItem['type']) => {
    switch (type) {
      case 'image': return <Image size={16} className="text-blue-500" />;
      case 'video': return <Video size={16} className="text-green-500" />;
      case 'text': return <Type size={16} className="text-purple-500" />;
      case 'document-group': return <FileText size={16} className="text-indigo-500" />;
      default: return null;
    }
  };

  // Auto-detect video duration when added
  useEffect(() => {
    selectedMediaItems.forEach(item => {
      const mediaItem = getMediaById(item.mediaId);
      if (mediaItem?.type === 'video' && item.duration === 30) {
        // Try to get actual video duration
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = `http://localhost:4000${mediaItem.url}`;
        video.onloadedmetadata = () => {
          if (video.duration && !isNaN(video.duration)) {
            updateMediaDuration(item.mediaId, Math.round(video.duration));
          }
        };
      }
    });
  }, [selectedMediaItems]);

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">
          {playlist ? 'Edit Playlist' : 'Create New Playlist'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Basic Info */}
        <div className="grid grid-cols-1 gap-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Playlist Name
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter playlist name"
              required
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isActive" className="ml-2 text-sm font-medium text-gray-700">
              Active
            </label>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter playlist description"
            />
          </div>
        </div>

        {/* Available Media */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3">Available Media</h3>
          <div className="border border-gray-200 rounded-md max-h-48 overflow-y-auto">
            {media.filter(item => !item.groupId).map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                <div className="flex items-center space-x-3">
                  {getTypeIcon(item.type)}
                  <span className="text-sm font-medium text-gray-900">{item.name}</span>
                  <span className="text-xs text-gray-500">
                    ({item.type === 'document-group' ? `${item.pages?.length || 0} pages` : item.type})
                  </span>
                </div>
                {!selectedMediaItems.find(selected => selected.mediaId === item.id) && (
                  <button
                    type="button"
                    onClick={() => addMediaToPlaylist(item)}
                    className="text-blue-600 hover:text-blue-800 p-1 rounded"
                  >
                    <Plus size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Selected Media with Duration Control */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-900">Playlist Items</h3>
            <div className="text-sm text-gray-500">
              Total: {Math.floor(totalDuration / 60)}m {totalDuration % 60}s
            </div>
          </div>

          {selectedMediaItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Clock size={48} className="mx-auto mb-4 text-gray-400" />
              <p>Add media to your playlist</p>
            </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="playlist-items">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-2"
                  >
                    {selectedMediaItems.map((playlistItem, index) => {
                      const mediaItem = getMediaById(playlistItem.mediaId);
                      if (!mediaItem) return null;

                      return (
                        <Draggable
                          key={playlistItem.mediaId}
                          draggableId={playlistItem.mediaId}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`flex items-center space-x-3 p-3 bg-white border rounded-md ${
                                snapshot.isDragging ? 'shadow-lg' : 'shadow-sm'
                              }`}
                            >
                              <div {...provided.dragHandleProps}>
                                <GripVertical size={16} className="text-gray-400" />
                              </div>
                              
                              {getTypeIcon(mediaItem.type)}
                              
                              <div className="flex-1">
                                <span className="text-sm font-medium text-gray-900">
                                  {mediaItem.name}
                                </span>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                <label className="text-xs text-gray-500">Duration (s):</label>
                                <input
                                  type="number"
                                  min="1"
                                  max={mediaItem.type === 'video' ? '3600' : '300'}
                                  value={playlistItem.duration}
                                  onChange={(e) => updateMediaDuration(
                                    playlistItem.mediaId, 
                                    Math.max(1, parseInt(e.target.value) || 1)
                                  )}
                                  className="w-16 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                                />
                                <span className="text-xs text-gray-500">s</span>
                              </div>
                              
                              <button
                                type="button"
                                onClick={() => removeMediaFromPlaylist(playlistItem.mediaId)}
                                className="text-red-600 hover:text-red-800 p-1 rounded"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            {playlist ? 'Update Playlist' : 'Create Playlist'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PlaylistForm;