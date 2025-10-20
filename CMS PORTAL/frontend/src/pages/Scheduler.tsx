import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Schedule, Playlist, Player } from '../types';
import ScheduleForm from '../components/Schedule/ScheduleForm';
import ScheduleList from '../components/Schedule/ScheduleList';
import { Plus } from 'lucide-react';

const BACKEND_URL = 'http://localhost:4000';

const Scheduler: React.FC = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [schedulesRes, playlistsRes, playersRes, locationsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/schedules`),
        fetch(`${BACKEND_URL}/playlists`),
        fetch(`${BACKEND_URL}/players`),
        fetch(`${BACKEND_URL}/players/locations`)
      ]);

      if (schedulesRes.ok) {
        const schedulesData = await schedulesRes.json();
        setSchedules(schedulesData);
      }

      if (playlistsRes.ok) {
        const playlistsData = await playlistsRes.json();
        setPlaylists(playlistsData);
      }

      if (playersRes.ok) {
        const playersData = await playersRes.json();
        setPlayers(playersData);
      }

      if (locationsRes.ok) {
        const locationsData = await locationsRes.json();
        setLocations(locationsData);
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

  const handleSaveSchedule = async (
    scheduleData: Omit<Schedule, 'id' | 'createdAt' | 'createdBy'>
  ) => {
    try {
      // expand location-based targeting into playerIds
      let expandedPlayerIds = [...scheduleData.playerIds];
      if ((scheduleData as any).locationGroups?.length) {
        const selected = players
          .filter(p => (scheduleData as any).locationGroups.includes(p.location))
          .map(p => p.id);
        expandedPlayerIds = [...new Set([...expandedPlayerIds, ...selected])];
      }

      const payload = {
        ...scheduleData,
        playerIds: expandedPlayerIds,
        createdBy: user?.username || 'Unknown'
      };

      if (editingSchedule) {
        const response = await fetch(`${BACKEND_URL}/schedules/${editingSchedule.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const updatedSchedule = await response.json();
          setSchedules(schedules.map(s => (s.id === editingSchedule.id ? updatedSchedule : s)));
        }
      } else {
        const response = await fetch(`${BACKEND_URL}/schedules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const newSchedule = await response.json();
          setSchedules([newSchedule, ...schedules]);
        }
      }

      setShowForm(false);
      setEditingSchedule(null);
    } catch (error) {
      console.error('Failed to save schedule:', error);
    }
  };

  const handleEditSchedule = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setShowForm(true);
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/schedules/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setSchedules(schedules.filter(s => s.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete schedule:', error);
    }
  };

  const handleToggleSchedule = async (id: string) => {
    const schedule = schedules.find(s => s.id === id);
    if (!schedule) return;

    try {
      const response = await fetch(`${BACKEND_URL}/schedules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...schedule, isActive: !schedule.isActive })
      });

      if (response.ok) {
        const updatedSchedule = await response.json();
        setSchedules(schedules.map(s => (s.id === id ? updatedSchedule : s)));
      }
    } catch (error) {
      console.error('Failed to toggle schedule:', error);
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingSchedule(null);
  };

  const canCreate = user?.role === 'root' || user?.role === 'supervisor';

  if (loading) {
    return <div>Loading schedules...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Scheduler</h1>
          <p className="mt-2 text-sm text-gray-700">
            Schedule playlists for your displays — target by players or location groups
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} className="mr-2" />
            New Schedule
          </button>
        )}
      </div>

      {!showForm ? (
        <ScheduleList
          schedules={schedules}
          playlists={playlists}
          players={players}
          onEdit={handleEditSchedule}
          onDelete={handleDeleteSchedule}
          onToggle={handleToggleSchedule}
          user={user}
        />
      ) : (
        <ScheduleForm
          schedule={editingSchedule}
          playlists={playlists}
          players={players}
          onSave={handleSaveSchedule}
          onCancel={handleCloseForm}
          locations={locations}
        />
      )}
    </div>
  );
};

export default Scheduler;