import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Playlist, MediaItem } from '../types';
import PlaylistForm from '../components/Playlist/PlaylistForm';
import PlaylistList from '../components/Playlist/PlaylistList';
import { Plus } from 'lucide-react';

const BACKEND_URL = 'http://localhost:4000';

const PlaylistBuilder: React.FC = () => {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch playlists and media from backend
  const fetchData = async () => {
    try {
      const [playlistsRes, mediaRes] = await Promise.all([
        fetch(`${BACKEND_URL}/playlists`),
        fetch(`${BACKEND_URL}/media`)
      ]);

      if (playlistsRes.ok) {
        const playlistsData = await playlistsRes.json();
        setPlaylists(playlistsData);
      }

      if (mediaRes.ok) {
        const mediaData = await mediaRes.json();
        setMedia(mediaData);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSavePlaylist = async (playlistData: Omit<Playlist, 'id' | 'createdAt' | 'createdBy'>) => {
    try {
      const payload = {
        ...playlistData,
        createdBy: user?.username || 'Unknown'
      };

      if (editingPlaylist) {
        // Update existing playlist
        const response = await fetch(`${BACKEND_URL}/playlists/${editingPlaylist.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const updatedPlaylist = await response.json();
          setPlaylists(playlists.map(p => p.id === editingPlaylist.id ? updatedPlaylist : p));
        }
      } else {
        // Create new playlist
        const response = await fetch(`${BACKEND_URL}/playlists`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const newPlaylist = await response.json();
          setPlaylists([newPlaylist, ...playlists]);
        }
      }

      setShowForm(false);
      setEditingPlaylist(null);
    } catch (error) {
      console.error('Failed to save playlist:', error);
    }
  };

  const handleEditPlaylist = (playlist: Playlist) => {
    setEditingPlaylist(playlist);
    setShowForm(true);
  };

  const handleDeletePlaylist = async (id: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/playlists/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setPlaylists(playlists.filter(p => p.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete playlist:', error);
    }
  };

  const handleDuplicatePlaylist = async (playlist: Playlist) => {
    const duplicatedData = {
      ...playlist,
      name: `${playlist.name} (Copy)`,
      createdBy: user?.username || 'Unknown'
    };


    await handleSavePlaylist(duplicatedData);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingPlaylist(null);
  };

  const canCreate = user?.role === 'root' || user?.role === 'supervisor' || user?.role === 'user';


  if (loading) {
    return <div>Loading playlists...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Playlist Builder</h1>
          <p className="mt-2 text-sm text-gray-700">Create and manage content playlists</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} className="mr-2" />
            New Playlist
          </button>
        )}
      </div>

      {!showForm ? (
        <PlaylistList
          playlists={playlists}
          media={media}
          onEdit={handleEditPlaylist}
          onDelete={handleDeletePlaylist}
          onDuplicate={handleDuplicatePlaylist}
          user={user}
        />
      ) : (
        <PlaylistForm
          playlist={editingPlaylist}
          media={media}
          onSave={handleSavePlaylist}
          onCancel={handleCloseForm}
        />
      )}
    </div>
  );
};

export default PlaylistBuilder;