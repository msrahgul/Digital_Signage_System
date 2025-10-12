import React, { useState, useEffect, useMemo } from 'react';
import { MediaItem } from '../../types';
import { X, Tag, User, Calendar, ChevronLeft, ChevronRight, File as FileIcon, HardDrive } from 'lucide-react';

interface MediaPreviewModalProps {
  media: MediaItem;
  allMedia: MediaItem[];
  onClose: () => void;
}

const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  media,
  allMedia,
  onClose,
}) => {
  const [docPageIndex, setDocPageIndex] = useState(0);

  const BACKEND_URL = `${window.location.protocol}//${window.location.hostname}:4000`;

  const pageItems = useMemo(() => {
    if (media.type === 'document-group' && media.pages && allMedia) {
      return media.pages
        .map(pageId => allMedia.find(m => m.id === pageId))
        .filter((item): item is MediaItem => !!item);
    }
    return [];
  }, [media, allMedia]);
  
  useEffect(() => {
    setDocPageIndex(0);
  }, [media]);

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
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
          <div className="bg-white">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Media Preview</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close Preview">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-6">
                {media.type === 'image' && (
                  <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                    <img src={`${BACKEND_URL}/${media.url}`} alt={media.name} className="w-full h-full object-contain" />
                  </div>
                )}
                {media.type === 'video' && (
                  <div className="aspect-video bg-black rounded-lg overflow-hidden">
                    <video src={`${BACKEND_URL}/${media.url}`} controls autoPlay className="w-full h-full object-contain">
                      Your browser does not support the video tag.
                    </video>
                  </div>
                )}
                {media.type === 'document-group' && (
                  <div className="aspect-video bg-gray-200 rounded-lg flex flex-col items-center justify-center p-2 relative">
                    {pageItems.length > 0 ? (
                      <>
                        <img
                          key={pageItems[docPageIndex].id}
                          src={`${BACKEND_URL}/${pageItems[docPageIndex].url}`}
                          alt={`${media.name} - Page ${docPageIndex + 1}`}
                          className="w-full h-full object-contain"
                        />
                        {pageItems.length > 1 && (
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm flex items-center gap-4">
                            <button onClick={() => setDocPageIndex(p => Math.max(0, p - 1))} disabled={docPageIndex === 0} className="disabled:opacity-50">
                              <ChevronLeft size={16} />
                            </button>
                            <span>Page {docPageIndex + 1} of {pageItems.length}</span>
                            <button onClick={() => setDocPageIndex(p => Math.min(pageItems.length - 1, p + 1))} disabled={docPageIndex === pageItems.length - 1} className="disabled:opacity-50">
                              <ChevronRight size={16} />
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-gray-700">No pages found for this document.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Redesigned Metadata Section */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-gray-800 break-words">{media.name}</h3>
                
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full font-medium bg-blue-100 text-blue-800">
                    <FileIcon size={14} /> {media.type}
                  </span>
                  <span className="inline-flex items-center gap-2 text-gray-600">
                    <HardDrive size={14} /> {formatFileSize(media.fileSize)}
                  </span>
                </div>

                <div className="text-sm text-gray-500 border-t border-gray-200 pt-4">
                  <div className="flex items-center gap-x-6">
                    <span className="inline-flex items-center gap-2">
                      <User size={14} /> Uploaded by <strong>{media.uploadedBy}</strong>
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Calendar size={14} /> On {new Date(media.uploadedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-800 mb-2 flex items-center"><Tag size={16} className="mr-2 text-gray-500"/>Tags</h4>
                  <div className="flex flex-col items-start gap-2">
                    {media.tags?.length > 0 ? (
                      media.tags.map((tag) => (
                        <span key={tag} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">{tag}</span>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No tags</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end">
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaPreviewModal;