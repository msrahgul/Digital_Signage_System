import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import MediaUploadModal from '../components/Media/MediaUploadModal';
import MediaTable from '../components/Media/MediaTable';
import MediaPreviewModal from '../components/Media/MediaPreviewModal';
import { MediaItem } from '../types';
import DeleteConfirmModal from '../components/DeleteConfirmModal';

const BACKEND_URL = 'http://localhost:4000';

type FilterType = 'all' | 'image' | 'video' | 'document';

const MediaLibrary: React.FC = () => {
  const { user } = useAuth();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);

  const fetchMedia = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/media`);
      if (response.ok) {
        const data = await response.json();
        setMedia(data);
      } else {
        console.error('Failed to fetch media');
        alert('Failed to fetch media from server.');
      }
    } catch (error) {
      console.error('Failed to fetch media:', error);
      alert('Error fetching media from server.');
    }
  }, []);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setShowDeleteModal(false);

    try {
      const response = await fetch(`${BACKEND_URL}/media/${deleteTarget.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMedia((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      } else {
        alert('Failed to delete media. Please try again.');
      }
    } catch (error) {
      alert('Error deleting media. Please try again.');
    }

    setDeleteTarget(null);
  };

  useEffect(() => {
    fetchMedia();

    const ws = new WebSocket(`ws://localhost:4000`);
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'media-updated') {
          fetchMedia();
        }
      } catch (e) {
        // Ignore
      }
    };
    return () => {
      ws.close();
    };
  }, [fetchMedia]);

  const handleUpload = async (
    newMediaData: Omit<
      MediaItem,
      'id' | 'url' | 'uploadedAt' | 'uploadedBy' | 'fileSize'
    > & { file: File, duration: number }
  ) => {
    try {
      const formData = new FormData();
      formData.append('file', newMediaData.file);
      formData.append('name', newMediaData.name);
      formData.append('type', newMediaData.type);
      formData.append('tags', newMediaData.tags.join(','));
      formData.append('uploadedBy', user?.username || 'Unknown');
      formData.append('duration', newMediaData.duration.toString());


      const response = await fetch(`${BACKEND_URL}/media`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setShowUploadModal(false);
        fetchMedia();
      } else {
        const errorData = await response.json();
        console.error('Upload failed:', errorData.details);
        alert(`Failed to upload media: ${errorData.details || 'Please try again.'}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error uploading media. Please try again.');
    }
  };

  const requestDelete = (mediaItem: MediaItem) => {
    setDeleteTarget(mediaItem);
    setShowDeleteModal(true);
  };

  const handlePreview = (mediaItem: MediaItem) => {
    setSelectedMedia(mediaItem);
    setShowPreviewModal(true);
  };

  const filteredMedia = media.filter((item) => {
    if (item.groupId) {
      return false;
    }
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.tags.some((tag) =>
        tag.toLowerCase().includes(searchTerm.toLowerCase())
      );
    const matchesType = filterType === 'all' || item.type === filterType || (filterType === 'document' && item.type === 'document-group');
    return matchesSearch && matchesType;
  });

  const canUpload = user?.role === 'root' || user?.role === 'supervisor' || user?.role === 'user';

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Media Library</h1>
      <p className="mb-4">Manage your digital content assets</p>

      {canUpload && (
        <button
          onClick={() => setShowUploadModal(true)}
          className="mb-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Upload Media
        </button>
      )}

      <div className="mb-4 flex gap-4">
        <input
          type="text"
          placeholder="Search media or tags"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-grow px-3 py-2 border rounded"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as FilterType)}
          className="px-3 py-2 border rounded"
        >
          <option value="all">All Types</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
          <option value="document">Documents (PDF, PPTX, DOCX)</option>
        </select>
      </div>

      <MediaTable
        media={filteredMedia}
        onDelete={requestDelete}
        onPreview={handlePreview}
        canEdit={canUpload}
        currentUser={user}
      />

      {showUploadModal && (
        <MediaUploadModal
          onClose={() => setShowUploadModal(false)}
          onUpload={handleUpload}
        />
      )}

      {showPreviewModal && selectedMedia && (
        <MediaPreviewModal
          media={selectedMedia}
          allMedia={media}
          onClose={() => setShowPreviewModal(false)}
        />
      )}

      <DeleteConfirmModal
        open={showDeleteModal}
        itemName={deleteTarget?.name}
        onConfirm={confirmDelete}
        onCancel={() => {
          setShowDeleteModal(false);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
};

export default MediaLibrary;