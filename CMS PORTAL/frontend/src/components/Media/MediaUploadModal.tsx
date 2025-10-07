import React, { useState, useEffect } from 'react';
import { MediaItem } from '../../types';
import { Upload, Image, Video, FileText } from 'lucide-react';

interface MediaUploadProps {
  onClose: () => void;
  onUpload: (
    media: Omit<
      MediaItem,
      'id' | 'url' | 'uploadedAt' | 'uploadedBy' | 'fileSize'
    > & { file: File, duration: number }
  ) => void;
}

const acceptedImageTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
];
const acceptedVideoTypes = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/avi',
  'video/mov',
  'video/mpeg',
  'video/quicktime',
];
const acceptedDocumentTypes = [
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];


const isImageFile = (file: File) => acceptedImageTypes.includes(file.type);
const isVideoFile = (file: File) => acceptedVideoTypes.includes(file.type);
const isDocumentFile = (file: File) => acceptedDocumentTypes.includes(file.type);


const MediaUpload: React.FC<MediaUploadProps> = ({ onClose, onUpload }) => {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<'image' | 'video' | 'document' | 'text'>(
    'image'
  );
  const [duration, setDuration] = useState<number>(5);
  const [tags, setTags] = useState('');
  const [videoDurationDisplay, setVideoDurationDisplay] = useState<string>('');

  // Detect type based on file
  useEffect(() => {
    if (!file) {
      setName('');
      setType('image');
      setDuration(5);
      setVideoDurationDisplay('');
      return;
    }

    if (isImageFile(file)) setType('image');
    else if (isVideoFile(file)) setType('video');
    else if (isDocumentFile(file)) setType('document');
    else setType('text');

    const suggestedName = file.name.replace(/\.[^/.]+$/, '');
    setName((prev) => (prev === '' ? suggestedName : prev));

    if (isImageFile(file) || isDocumentFile(file)) {
      setDuration(5);
      setVideoDurationDisplay('');
    }

    if (isVideoFile(file)) {
      setDuration(0);
      setVideoDurationDisplay('Loading...');
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = url;
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        const dur = video.duration;
        setDuration(dur);
        const m = Math.floor(dur / 60);
        const s = Math.floor(dur % 60);
        setVideoDurationDisplay(m > 0 ? `${m}m ${s}s` : `${s}s`);
      };
      video.onerror = () => {
        setVideoDurationDisplay('Unable to retrieve duration');
      };
    }
  }, [file]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selected = e.target.files[0];
    if (
      !isImageFile(selected) &&
      !isVideoFile(selected) &&
      !isDocumentFile(selected)
    ) {
      alert('Unsupported file type. Please select a valid image, video or document.');
      return;
    }
    setFile(selected);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      const dropped = e.dataTransfer.files[0];
      if (!isImageFile(dropped) && !isVideoFile(dropped) && !isDocumentFile(dropped)) {
        alert('Unsupported file type. Please select a valid image, video or document.');
        return;
      }
      setFile(dropped);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      alert('Please select a file.');
      return;
    }
    if (!name.trim()) {
      alert('Please enter a valid name.');
      return;
    }
    if ((type === 'image' || type === 'document') && duration < 1) {
      alert('Duration must be at least 1 second.');
      return;
    }
    const parsedTags = tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    onUpload({
      name: name.trim(),
      type,
      tags: parsedTags,
      file,
      duration,
    });
  };

  const getTypeIcon = () => {
    switch (type) {
      case 'video':
        return <Video className="mr-1" />;
      case 'document':
        return <FileText className="mr-1" />;
      default:
        return <Image className="mr-1" />;
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
      <form
        className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full"
        onSubmit={handleSubmit}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Upload className="mr-2" /> Upload Media
        </h2>

        <div
          className={`mb-4 flex flex-col items-center justify-center p-6 border-2 border-dashed rounded cursor-pointer ${
            dragOver ? 'border-blue-600 bg-blue-50' : 'border-gray-300'
          }`}
          onClick={() => document.getElementById('fileInput')?.click()}
        >
          {file ? <p>{file.name}</p> : <p>Drag & drop or click to select</p>}
          <input
            id="fileInput"
            type="file"
            accept={[
              ...acceptedImageTypes,
              ...acceptedVideoTypes,
              ...acceptedDocumentTypes,
            ].join(',')}
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <label className="block mb-1 font-medium" htmlFor="name">
          Name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full mb-4 border p-2 rounded"
        />

        <div className="mb-4 flex items-center space-x-2">
          <label className="font-medium">Type:</label>
          <div className="flex items-center">
            {getTypeIcon()}
            {type.toUpperCase()}
          </div>
        </div>

        {(type === 'image' || type === 'document') && (
          <>
            <label className="block mb-1 font-medium" htmlFor="duration">
              Duration (seconds)
            </label>
            <input
              id="duration"
              type="number"
              min={1}
              value={duration}
              onChange={(e) =>
                setDuration(Math.max(1, Number(e.target.value)))
              }
              required
              className="w-full mb-4 border p-2 rounded"
            />
          </>
        )}

        {type === 'video' && (
          <div className="mb-4">
            <label className="block mb-1 font-medium">Video Duration</label>
            <span>{videoDurationDisplay || 'Loading...'}</span>
          </div>
        )}

        <label className="block mb-1 font-medium" htmlFor="tags">
          Tags (comma separated)
        </label>
        <input
          id="tags"
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="promo, event, branding"
          className="w-full mb-4 border p-2 rounded"
        />

        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="border border-gray-300 p-2 rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!file}
            className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Upload
          </button>
        </div>
      </form>
    </div>
  );
};

export default MediaUpload;