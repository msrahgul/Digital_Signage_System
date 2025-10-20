// src/types/index.ts
export interface User {
  id: string;
  username: string;
  role: 'root' | 'supervisor' | 'user';
  email: string;
  lastLogin?: string;
}

export interface MediaItem {
  id: string;
  name: string;
  type: 'image' | 'video' | 'document' | 'url' | 'document-group';
  url: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;
  tags: string[];
  pages?: string[]; // For document-group
  groupId?: string; // For document pages
  playlistDuration?: number;
}


export interface Playlist {
  id: string;
  name: string;
  description: string;
  mediaItems: any[];
  totalDuration: number;
  createdAt: string;
  createdBy: string;
  isActive: boolean;
}

export interface Schedule {
  id: string;
  name: string;
  playlistId: string; // for backwards compatibility
  playlistIds: string[];
  playerIds: string[];
  startDate: string;
  endDate: string;
  timeSlots: TimeSlot[];
  recurringDays: string[]; // ['monday', 'tuesday', etc.]
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  priority: number;
  executionMode: 'sequential' | 'replace';
  chyronText?: string;
}

export interface TimeSlot {
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
}

export interface Player {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline' | 'connecting';
  lastSync: string;
  currentPlaylist?: string;
  currentSchedule?: string;
  upcomingSchedules?: ScheduleExecution[];
  ipAddress: string;
  version: string;
  deviceInfo?: any;
  isConnected?: boolean;
}

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