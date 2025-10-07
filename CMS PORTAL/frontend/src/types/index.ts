// src/types/index.ts
export interface User {
  id: string;
  username: string;
  role: 'Admin' | 'Publisher' | 'Viewer';
  email: string;
  lastLogin?: string;
}

export interface MediaItem {
  id: string;
  name: string;
  type: 'image' | 'video' | 'text' | 'document' | 'url' | 'document-group';
  url: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;
  tags: string[];
  pages?: string[]; // For document-group
  groupId?: string; // For document pages
}


export interface Playlist {
  id: string;
  name: string;
  description: string;
  mediaItems: string[]; // media IDs
  totalDuration: number;
  createdAt: string;
  createdBy: string;
  isActive: boolean;
}

export interface Schedule {
  id: string;
  name: string;
  playlistId: string;
  playerIds: string[];
  startDate: string;
  endDate: string;
  timeSlots: TimeSlot[];
  recurringDays: string[]; // ['monday', 'tuesday', etc.]
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  priority: number; // NEW: Priority for sequential execution (lower number = higher priority)
  executionMode: 'sequential' | 'replace'; // NEW: How to handle conflicts
  tickerText?: string;
}

export interface TimeSlot {
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
}

export interface Player {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline';
  lastSync: string;
  currentPlaylist?: string;
  currentSchedule?: string; // NEW: Track current schedule
  upcomingSchedules?: ScheduleExecution[]; // NEW: Queue of upcoming schedules
  ipAddress: string;
  version: string;
}

// NEW: Interface for schedule execution queue
export interface ScheduleExecution {
  scheduleId: string;
  scheduleName: string;
  playlistId: string;
  playlistName: string;
  startTime: string;
  endTime: string;
  estimatedDuration: number;
  priority: number;
  executionOrder: number;
}

// NEW: Interface for schedule conflicts
export interface ScheduleConflict {
  timeSlot: string;
  playerIds: string[];
  conflictingSchedules: {
    id: string;
    name: string;
    priority: number;
    playlistDuration: number;
  }[];
  resolvedOrder: {
    scheduleId: string;
    scheduleName: string;
    executionStart: string;
    executionEnd: string;
    executionOrder: number;
  }[];
}

export interface DashboardStats {
  totalPlayers: number;
  totalMedia: number;
  activePlaylists: number;
  activeCampaigns: number;
  onlinePlayers: number;
  offlinePlayers: number;
}