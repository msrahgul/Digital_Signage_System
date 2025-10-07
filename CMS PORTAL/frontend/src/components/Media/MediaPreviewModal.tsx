// src/components/Media/MediaPreviewModal.tsx
import React from 'react';
import { MediaItem } from '../../types';
import { X, Tag, User, Calendar } from 'lucide-react';

interface MediaPreviewModalProps {
  media: MediaItem;
  onClose: () => void;
}

const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  media,
  onClose,
}) => {
  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4 text-center sm:block sm:p-0">
        {/* Overlay */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        ></div>

        {/* Modal */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
          <div className="bg-white">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Media Preview
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close Preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Media Preview */}
              <div className="mb-6">
                {media.type === 'image' && (
                  <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={`http://localhost:4000${media.url}`}
                      alt={media.name || 'Uploaded image'}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}

                {media.type === 'video' && (
                  <div className="aspect-video bg-black rounded-lg overflow-hidden">
                    <video
                      src={`http://localhost:4000${media.url}`}
                      controls
                      autoPlay
                      className="w-full h-full object-contain"
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                )}


                {media.type === 'text' && (
                  <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center p-6">
                    <p className="text-white text-sm break-words max-h-80 overflow-y-auto">
                      {media.url || 'No text content available'}
                    </p>
                  </div>
                )}

                {(media.type === 'document-group' || media.type === 'document') && (
                  <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center p-2">
                    <p className="text-gray-700 mb-2">
                      Document preview is not available here.
                    </p>
                  </div>
                )}
              </div>

              {/* Media Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Details</h4>
                  <dl className="space-y-2">
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-600">Name:</dt>
                      <dd className="text-sm font-medium text-gray-900">
                        {media.name}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-600">Type:</dt>
                      <dd className="text-sm font-medium text-gray-900 capitalize">
                        {media.type}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-600">Size:</dt>
                      <dd className="text-sm font-medium text-gray-900">
                        {formatFileSize(media.fileSize)}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Metadata</h4>
                  <dl className="space-y-2">
                    <div>
                      <dt className="text-sm text-gray-600 flex items-center mb-1">
                        <User className="h-3 w-3 mr-1" />
                        Uploaded by:
                      </dt>
                      <dd className="text-sm font-medium text-gray-900">
                        {media.uploadedBy}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-600 flex items-center mb-1">
                        <Calendar className="h-3 w-3 mr-1" />
                        Upload date:
                      </dt>
                      <dd className="text-sm font-medium text-gray-900">
                        {new Date(media.uploadedAt).toLocaleDateString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-600 flex items-center mb-1">
                        <Tag className="h-3 w-3 mr-1" />
                        Tags:
                      </dt>
                      <dd className="flex flex-wrap gap-1">
                        {media.tags && media.tags.length > 0 ? (
                          media.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                            >
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-gray-500">No tags</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaPreviewModal;