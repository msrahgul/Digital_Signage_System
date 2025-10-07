// src/components/Schedule/ScheduleForm.tsx
import React, { useState } from "react";
import { Schedule, Playlist, Player } from "../../types";
import { Save, X, Plus, Trash2 } from "lucide-react";

interface ScheduleFormProps {
  schedule: Schedule | null;
  playlists: Playlist[];
  players: Player[];
  locations: string[]; // passed from Scheduler.tsx
  onSave: (schedule: Omit<Schedule, "id" | "createdAt" | "createdBy">) => void;
  onCancel: () => void;
}

const ScheduleForm: React.FC<ScheduleFormProps> = ({
  schedule,
  playlists,
  players,
  locations,
  onSave,
  onCancel,
}) => {
  const [formData, setFormData] = useState({
    name: schedule?.name || "",
    playlistIds: schedule?.playlistIds || [], // ✅ multiple playlists
    playerIds: schedule?.playerIds || [],
    startDate: schedule?.startDate || new Date().toISOString().split("T")[0],
    endDate: schedule?.endDate || "",
    timeSlots:
      schedule?.timeSlots || [{ startTime: "09:00", endTime: "17:00" }],
    recurringDays: schedule?.recurringDays || [],
    isActive: schedule?.isActive ?? true,
  });

  const dayOptions = [
    { value: "monday", label: "Monday" },
    { value: "tuesday", label: "Tuesday" },
    { value: "wednesday", label: "Wednesday" },
    { value: "thursday", label: "Thursday" },
    { value: "friday", label: "Friday" },
    { value: "saturday", label: "Saturday" },
    { value: "sunday", label: "Sunday" },
  ];

  // ✅ Toggle playlist selection
  const togglePlaylist = (playlistId: string) => {
    setFormData((prev) => {
      const alreadySelected = prev.playlistIds.includes(playlistId);
      return {
        ...prev,
        playlistIds: alreadySelected
          ? prev.playlistIds.filter((id) => id !== playlistId)
          : [...prev.playlistIds, playlistId],
      };
    });
  };

  // Toggle a whole location group
  const toggleLocation = (location: string) => {
    const locationPlayers = players
      .filter((p) => p.location === location)
      .map((p) => p.id);

    const allSelected = locationPlayers.every((pid) =>
      formData.playerIds.includes(pid)
    );

    if (allSelected) {
      setFormData((prev) => ({
        ...prev,
        playerIds: prev.playerIds.filter(
          (pid) => !locationPlayers.includes(pid)
        ),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        playerIds: [...new Set([...prev.playerIds, ...locationPlayers])],
      }));
    }
  };

  // Toggle an individual player
  const togglePlayer = (playerId: string) => {
    setFormData((prev) => ({
      ...prev,
      playerIds: prev.playerIds.includes(playerId)
        ? prev.playerIds.filter((pid) => pid !== playerId)
        : [...prev.playerIds, playerId],
    }));
  };

  const handleDayToggle = (day: string) => {
    setFormData((prev) => ({
      ...prev,
      recurringDays: prev.recurringDays.includes(day)
        ? prev.recurringDays.filter((d) => d !== day)
        : [...prev.recurringDays, day],
    }));
  };

  const addTimeSlot = () => {
    setFormData((prev) => ({
      ...prev,
      timeSlots: [...prev.timeSlots, { startTime: "09:00", endTime: "17:00" }],
    }));
  };

  const removeTimeSlot = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      timeSlots: prev.timeSlots.filter((_, i) => i !== index),
    }));
  };

  const updateTimeSlot = (
    index: number,
    field: "startTime" | "endTime",
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      timeSlots: prev.timeSlots.map((slot, i) =>
        i === index ? { ...slot, [field]: value } : slot
      ),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as any);
  };

  const selectedPlaylists = playlists.filter((p) =>
    formData.playlistIds.includes(p.id)
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <form onSubmit={handleSubmit}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {schedule ? "Edit Schedule" : "Create New Schedule"}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Schedule Name
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Enter schedule name"
              />
            </div>
            <div className="flex items-center">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      isActive: e.target.checked,
                    }))
                  }
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="ml-2 text-sm font-medium text-gray-700">
                  Active
                </span>
              </label>
            </div>
          </div>

          {/* ✅ Playlist Selection (multiple) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Playlists
            </label>
            <div className="space-y-2">
              {playlists
                .filter((p) => p.isActive)
                .map((playlist) => (
                  <label
                    key={playlist.id}
                    className="flex items-center space-x-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={formData.playlistIds.includes(playlist.id)}
                      onChange={() => togglePlaylist(playlist.id)}
                      className="rounded border-gray-300 text-blue-600"
                    />
                    <span>
                      {playlist.name} (
                      {Math.floor(playlist.totalDuration / 60)}m{" "}
                      {playlist.totalDuration % 60}s)
                    </span>
                  </label>
                ))}
            </div>

            {selectedPlaylists.length > 0 && (
              <ul className="text-sm text-gray-500 mt-2 list-disc pl-4">
                {selectedPlaylists.map((pl) => (
                  <li key={pl.id}>{pl.description || pl.name}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    startDate: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={formData.endDate}
                min={formData.startDate}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    endDate: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          {/* Time Slots */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Time Slots
              </label>
              <button
                type="button"
                onClick={addTimeSlot}
                className="inline-flex items-center text-sm text-blue-600"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Time Slot
              </button>
            </div>
            <div className="space-y-3">
              {formData.timeSlots.map((slot, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <input
                      type="time"
                      value={slot.startTime}
                      onChange={(e) =>
                        updateTimeSlot(index, "startTime", e.target.value)
                      }
                      className="w-full px-3 py-2 border rounded-md"
                    />
                    <input
                      type="time"
                      value={slot.endTime}
                      onChange={(e) =>
                        updateTimeSlot(index, "endTime", e.target.value)
                      }
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  {formData.timeSlots.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTimeSlot(index)}
                      className="text-red-600 hover:text-red-800 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recurring Days */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Recurring Days
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {dayOptions.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => handleDayToggle(day.value)}
                  className={`px-3 py-2 text-sm rounded-md ${
                    formData.recurringDays.includes(day.value)
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {day.label.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* Player Selection by Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Target Players
            </label>
            <div className="space-y-4">
              {locations.map((location) => {
                const locationPlayers = players.filter(
                  (p) => p.location === location
                );
                const allSelected = locationPlayers.every((p) =>
                  formData.playerIds.includes(p.id)
                );
                const someSelected =
                  locationPlayers.some((p) =>
                    formData.playerIds.includes(p.id)
                  ) && !allSelected;

                return (
                  <div
                    key={location}
                    className="border rounded-md p-2 bg-gray-50"
                  >
                    {/* Location checkbox */}
                    <label className="flex items-center font-medium">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someSelected;
                        }}
                        onChange={() => toggleLocation(location)}
                        className="mr-2"
                      />
                      {location}
                    </label>

                    {/* Players */}
                    <div className="ml-6 mt-2 space-y-1">
                      {locationPlayers.map((player) => (
                        <label
                          key={player.id}
                          className="flex items-center text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={formData.playerIds.includes(player.id)}
                            onChange={() => togglePlayer(player.id)}
                            className="mr-2"
                          />
                          {player.name}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm bg-white border rounded-md"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={formData.playlistIds.length === 0 || formData.playerIds.length === 0}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md"
          >
            <Save className="mr-2 h-4 w-4 inline" />
            {schedule ? "Update Schedule" : "Create Schedule"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ScheduleForm;
