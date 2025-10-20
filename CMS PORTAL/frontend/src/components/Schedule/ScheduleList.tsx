import React, { useState } from 'react';
import { Schedule, Playlist, Player, User } from '../../types';
import { Edit, Trash2, Calendar, Clock, Monitor, Play, Pause, MapPin, List } from 'lucide-react';

interface ScheduleListProps {
  schedules: Schedule[];
  playlists: Playlist[];
  players: Player[];
  onEdit: (schedule: Schedule) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  user: User | null;
}

const ScheduleList: React.FC<ScheduleListProps> = ({
  schedules,
  playlists,
  players,
  onEdit,
  onDelete,
  onToggle,
  user
}) => {
  const canEdit = (schedule: Schedule) => {
    if (!user) return false;
    return user.role === 'root' || user.role === 'supervisor';
  };

  const canDelete = (schedule: Schedule) => {
    if (!user) return false;
    if (user.role === 'root') return true;
    if (user.role === 'supervisor') {
      return schedule.createdBy !== 'root';
    }
    return false;
  };

  const getPlaylistNames = (playlistIds: string[]) => {
    return playlistIds
      .map(id => playlists.find(p => p.id === id)?.name)
      .filter(Boolean) as string[];
  };

  const getPlayerAndLocation = (playerIds: string[]) => {
    return playerIds
      .map(id => {
        const player = players.find(p => p.id === id);
        if (!player) return null;
        return { name: player.name, location: player.location };
      })
      .filter(Boolean) as { name: string; location?: string }[];
  };

  const formatTimeSlots = (timeSlots: Schedule['timeSlots']) => {
    return timeSlots.map(slot => `${slot.startTime}-${slot.endTime}`).join(', ');
  };

  const formatRecurringDays = (days: string[]) => {
    const dayAbbr: { [key: string]: string } = {
      monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
      friday: 'Fri', saturday: 'Sat', sunday: 'Sun'
    };
    return days.map(day => dayAbbr[day] || day).join(', ');
  };

  if (schedules.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No schedules found</h3>
        <p className="text-gray-500">Create your first schedule to start broadcasting content</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Schedule
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Playlists
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Players / Locations
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Schedule
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              {(user?.role === 'root' || user?.role === 'supervisor') && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {schedules.map((schedule) => {
              const [playersExpanded, setPlayersExpanded] = useState(false);
              const [playlistsExpanded, setPlaylistsExpanded] = useState(false);
              const playerData = getPlayerAndLocation(schedule.playerIds);
              const playlistNames = getPlaylistNames(schedule.playlistIds || [schedule.playlistId]);

              const visiblePlayers = playersExpanded ? playerData : playerData.slice(0, 1);
              const visiblePlaylists = playlistsExpanded ? playlistNames : playlistNames.slice(0, 1);

              return (
                <tr key={schedule.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{schedule.name}</div>
                      <div className="text-sm text-gray-500">
                        Created by {schedule.createdBy}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {visiblePlaylists.map((name, idx) => (
                          <div key={idx} className="flex items-center space-x-2 text-sm text-gray-900">
                              <List className="h-4 w-4 text-gray-400" />
                              <span>{name}</span>
                          </div>
                      ))}
                      {playlistNames.length > 1 && (
                          <button
                              onClick={() => setPlaylistsExpanded(!playlistsExpanded)}
                              className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                          >
                              {playlistsExpanded ? 'Show less' : `+${playlistNames.length - 1} more`}
                          </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {visiblePlayers.map((pl, idx) => (
                        <div key={idx} className="flex items-center space-x-2 text-sm text-gray-900">
                          <Monitor className="h-4 w-4 text-gray-400" />
                          <span>{pl.name}</span>
                          {pl.location && (
                            <div className="flex items-center text-xs text-gray-600 ml-2">
                              <MapPin className="h-3 w-3 text-gray-400 mr-1" />
                              <span>{pl.location}</span>
                            </div>
                          )}
                        </div>
                      ))}

                      {playerData.length > 1 && (
                        <button
                          onClick={() => setPlayersExpanded(!playersExpanded)}
                          className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                        >
                          {playersExpanded ? 'Show less' : `+${playerData.length - 1} more`}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      <div className="flex items-center mb-1">
                        <Calendar className="h-4 w-4 text-gray-400 mr-1" />
                        {schedule.startDate} {schedule.endDate && `- ${schedule.endDate}`}
                      </div>
                      <div className="flex items-center mb-1">
                        <Clock className="h-4 w-4 text-gray-400 mr-1" />
                        {formatTimeSlots(schedule.timeSlots)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatRecurringDays(schedule.recurringDays)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => (user?.role === 'root' || user?.role === 'supervisor') && onToggle(schedule.id)}
                      disabled={!(user?.role === 'root' || user?.role === 'supervisor')}
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        schedule.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      } ${(user?.role === 'root' || user?.role === 'supervisor') ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
                    >
                      {schedule.isActive ? <Play className="h-3 w-3 mr-1" /> : <Pause className="h-3 w-3 mr-1" />}
                      {schedule.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  {(user?.role === 'root' || user?.role === 'supervisor') && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        {canEdit(schedule) && (
                          <button
                            onClick={() => onEdit(schedule)}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete(schedule) && (
                          <button
                            onClick={() => onDelete(schedule.id)}
                            className="text-red-600 hover:text-red-900 p-1 rounded"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ScheduleList;