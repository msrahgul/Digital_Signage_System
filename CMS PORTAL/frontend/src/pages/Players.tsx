import React, { useState, useEffect, useCallback } from 'react';
import { Player } from '../types';
import PlayerTable from '../components/Player/PlayerTable';
import PlayerDetailsModal from '../components/Player/PlayerDetailsModal';
import PlayerEditModal from '../components/Player/PlayerEditModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import { Monitor, Wifi, WifiOff, AlertTriangle } from 'lucide-react';

const BACKEND_URL = 'http://localhost:4000';

const Players: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchPlayers = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/players`);
      if (response.ok) {
        const data = await response.json();
        setPlayers(data);
      }
    } catch (error) {
      console.error('Error fetching players:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlayers();

    const websocket = new WebSocket('ws://localhost:4000');
    
    websocket.onopen = () => {
      websocket.send(JSON.stringify({ type: 'cms-connect' }));
    };
    
    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (['player-connected', 'player-disconnected', 'players-updated', 'player-registered', 'player-updated', 'player-removed'].includes(message.type)) {
          fetchPlayers();
        }
      } catch (e) {
        // Ignore invalid messages
      }
    };

    const interval = setInterval(fetchPlayers, 30000);

    return () => {
      websocket.close();
      clearInterval(interval);
    };
  }, [fetchPlayers]);

  const handlePlayerDetails = (player: Player) => {
    setSelectedPlayer(player);
    setShowDetailsModal(true);
  };

  const handleEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setShowEditModal(true);
  };

  const handleSavePlayer = async (playerId: string, updates: { name: string; location: string }) => {
    try {
      const response = await fetch(`${BACKEND_URL}/players/${playerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        setShowEditModal(false);
        setEditingPlayer(null);
        fetchPlayers();
      } else {
        alert('Failed to update player');
      }
    } catch (error) {
      console.error('Error updating player:', error);
      alert('Error updating player');
    }
  };

  const handleDeletePlayer = (player: Player) => {
    setSelectedPlayer(player);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!selectedPlayer) return;

    try {
      const response = await fetch(`${BACKEND_URL}/players/${selectedPlayer.id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setShowDeleteModal(false);
        setSelectedPlayer(null);
        fetchPlayers();
      } else {
        alert('Failed to delete player');
      }
    } catch (error) {
      console.error('Error deleting player:', error);
      alert('Error deleting player');
    }
  };

  const handleRestartPlayer = async (id: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/players/${id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'restart' })
      });
      
      if (response.ok) {
        console.log('Restart command sent');
      }
    } catch (error) {
      console.error('Error sending restart command:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const onlinePlayers = players.filter(p => p.status === 'online').length;
  const offlinePlayers = players.filter(p => p.status === 'offline').length;


  const statusStats = [
    {
      label: 'Online',
      count: onlinePlayers,
      icon: Wifi,
      color: 'text-green-600 bg-green-50'
    },
    {
      label: 'Offline',
      count: offlinePlayers,
      icon: WifiOff,
      color: 'text-red-600 bg-red-50'
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Player Management</h1>
        <p className="mt-2 text-sm text-gray-700">Monitor and manage your display devices</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
  {statusStats.map((stat) => {
    const Icon = stat.icon;
    return (
      <div
        key={stat.label}
        className={`${stat.color} px-4 py-5 rounded-lg border flex items-center`}
      >
        <Icon className="h-6 w-6 flex-shrink-0" />
        <div className="ml-4">
          <p className="text-sm font-medium">{stat.label}</p>
          <p className="text-lg font-semibold">{stat.count}</p>
        </div>
      </div>
    );
  })}
</div>

      <PlayerTable
        players={players}
        onDetails={handlePlayerDetails}
        onEdit={handleEditPlayer}
        onDelete={handleDeletePlayer}
        onRestart={handleRestartPlayer}
      />

      {showDetailsModal && selectedPlayer && (
        <PlayerDetailsModal
          player={selectedPlayer}
          onClose={() => setShowDetailsModal(false)}
          onRestart={handleRestartPlayer}
        />
      )}

      {showEditModal && editingPlayer && (
        <PlayerEditModal
          player={editingPlayer}
          onSave={handleSavePlayer}
          onClose={() => {
            setShowEditModal(false);
            setEditingPlayer(null);
          }}
        />
      )}

      <DeleteConfirmModal
        open={showDeleteModal}
        itemName={selectedPlayer?.name}
        onConfirm={confirmDelete}
        onCancel={() => {
          setShowDeleteModal(false);
          setSelectedPlayer(null);
        }}
      />
    </div>
  );
};

export default Players;
