// src/pages/Dashboard.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import StatCard from '../components/Dashboard/StatCard';
import { Monitor, Image, List, Calendar, Activity, TrendingUp, ArrowRight, Play, AlertTriangle } from 'lucide-react';

const BACKEND_URL = 'http://localhost:4000';

interface Stats {
  totalMedia: number;
  totalPlaylists: number;
  activePlaylists: number;
  totalSchedules: number;
  activeSchedules: number;
  totalPlayers: number;
  onlinePlayers: number;
  offlinePlayers: number;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalMedia: 0,
    totalPlaylists: 0,
    activePlaylists: 0,
    totalSchedules: 0,
    activeSchedules: 0,
    totalPlayers: 0,
    onlinePlayers: 0,
    offlinePlayers: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();

    // Setup WebSocket for real-time updates
    const ws = new WebSocket('ws://localhost:4000');
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'cms-connect' }));
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (['media-updated', 'playlist-updated', 'schedule-updated', 'players-updated', 'player-connected', 'player-disconnected'].includes(message.type)) {
          fetchStats();
        }
      } catch (e) {
        // Ignore invalid messages
      }
    };

    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);

    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, [fetchStats]);

  const quickLinks = [
    { name: 'Upload Media', href: '/media', icon: Image, description: 'Add new content to your library' },
    { name: 'Create Playlist', href: '/playlists', icon: List, description: 'Build new content sequences' },
    { name: 'Schedule Content', href: '/schedules', icon: Calendar, description: 'Assign playlists to displays' },
    { name: 'Monitor Players', href: '/players', icon: Monitor, description: 'Check player status and health' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-700">
          Welcome back, {user?.username}! Manage your digital signage network from this central dashboard.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Media"
          value={stats.totalMedia}
          icon={Image}
          color="blue"
          subtitle="files uploaded"
        />
        <StatCard
          title="Active Playlists"
          value={stats.activePlaylists}
          icon={List}
          color="green"
          subtitle={`of ${stats.totalPlaylists} total`}
        />
        <StatCard
          title="Active Schedules"
          value={stats.activeSchedules}
          icon={Calendar}
          color="amber"
          subtitle={`of ${stats.totalSchedules} total`}
        />
        <StatCard
          title="Online Players"
          value={stats.onlinePlayers}
          icon={Monitor}
          color={stats.offlinePlayers > 0 ? "red" : "green"}
          subtitle={`of ${stats.totalPlayers} total`}
        />
      </div>

      {/* Alerts */}
      {stats.offlinePlayers > 0 && (
        <div className="rounded-md bg-yellow-50 p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Player Status Alert
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  {stats.offlinePlayers} player{stats.offlinePlayers > 1 ? 's are' : ' is'} currently offline.{' '}
                  <Link to="/players" className="font-medium underline text-yellow-700 hover:text-yellow-600">
                    View details
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.name}
                to={link.href}
                className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-500 rounded-lg shadow hover:shadow-md transition-shadow"
              >
                <div>
                  <span className="rounded-lg inline-flex p-3 bg-blue-50 text-blue-700 ring-4 ring-white">
                    <Icon size={24} />
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    <span className="absolute inset-0" aria-hidden="true" />
                    {link.name}
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    {link.description}
                  </p>
                </div>
                <span
                  className="pointer-events-none absolute top-6 right-6 text-gray-300 group-hover:text-gray-400"
                  aria-hidden="true"
                >
                  <ArrowRight size={20} />
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">System Status</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.onlinePlayers}</div>
              <div className="text-sm text-gray-500">Players Online</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.activePlaylists}</div>
              <div className="text-sm text-gray-500">Active Content</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.totalMedia}</div>
              <div className="text-sm text-gray-500">Media Files</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;