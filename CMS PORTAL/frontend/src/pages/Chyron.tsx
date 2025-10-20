// src/pages/Chyron.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Save, AlertTriangle, Plus, Edit, Trash2, Play, Zap } from 'lucide-react';

const BACKEND_URL = `${window.location.protocol}//${window.location.hostname}:4000`;

interface ChyronItem {
  id: string;
  text: string;
}

const Chyron: React.FC = () => {
  const [chyrons, setChyrons] = useState<ChyronItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newChyronText, setNewChyronText] = useState('');
  const [editingChyron, setEditingChyron] = useState<ChyronItem | null>(null);
  const [chyronSpeed, setChyronSpeed] = useState(2);
  const [saveMessage, setSaveMessage] = useState('');

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/settings`);
      if (response.ok) {
        const data = await response.json();
        setChyrons(data.chyrons || []);
        setChyronSpeed(data.chyronSpeed || 2);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage('');
    try {
      const combinedChyronText = chyrons.map(t => t.text).join(' • ');
      const settings = {
        chyronText: combinedChyronText,
        chyrons,
        chyronEnabled: true,
        chyronSpeed,
      };

      const response = await fetch(`${BACKEND_URL}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setSaveMessage('✅ Chyron settings saved and updated on all players!');
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        setSaveMessage('❌ Failed to save chyron settings');
      }
    } catch (error) {
      console.error('Error saving chyrons:', error);
      setSaveMessage('❌ Error saving chyron settings');
    } finally {
      setSaving(false);
    }
  };

  const handleAddChyron = () => {
    if (newChyronText.trim()) {
      const newChyron: ChyronItem = {
        id: Date.now().toString(),
        text: newChyronText.trim(),
      };
      setChyrons([...chyrons, newChyron]);
      setNewChyronText('');
    }
  };

  const handleRemoveChyron = (id: string) => {
    setChyrons(chyrons.filter(t => t.id !== id));
  };

  const handleEditChyron = (chyron: ChyronItem) => {
    setEditingChyron({ ...chyron });
  };

  const handleUpdateChyron = () => {
    if (editingChyron && editingChyron.text.trim()) {
      setChyrons(chyrons.map(t => (t.id === editingChyron.id ? editingChyron : t)));
      setEditingChyron(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-4 text-lg">Loading chyron settings...</span>
      </div>
    );
  }

  const rangeBackground = `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${((chyronSpeed - 1) / 4) * 100}%, #E5E7EB ${((chyronSpeed - 1) / 4) * 100}%, #E5E7EB 100%)`;

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Chyron Settings</h1>
        <p className="text-gray-600 mb-6">
          Manage the scrolling text that appears at the bottom of your displays.
        </p>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Add New Chyron Message</h2>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Enter chyron message..."
              value={newChyronText}
              onChange={(e) => setNewChyronText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddChyron()}
              className="flex-grow px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={saving}
            />
            <button
              onClick={handleAddChyron}
              disabled={!newChyronText.trim() || saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Current Chyron Messages</h2>
          {chyrons.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No chyron messages added yet.</p>
          ) : (
            <div className="space-y-3">
              {chyrons.map((chyron, index) => (
                <div key={chyron.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  {editingChyron?.id === chyron.id ? (
                    <input
                      type="text"
                      value={editingChyron.text}
                      onChange={(e) => setEditingChyron({ ...editingChyron, text: e.target.value })}
                      onKeyPress={(e) => e.key === 'Enter' && handleUpdateChyron()}
                      className="flex-grow px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      autoFocus
                      disabled={saving}
                    />
                  ) : (
                    <div className="flex-grow px-3 py-2 bg-white rounded border">{chyron.text}</div>
                  )}
                  <div className="flex gap-2">
                    {editingChyron?.id === chyron.id ? (
                      <>
                        <button onClick={handleUpdateChyron} disabled={saving} className="p-2 text-green-600 bg-green-100 rounded-lg hover:bg-green-200 disabled:opacity-50" title="Save changes"><Save className="h-4 w-4" /></button>
                        <button onClick={() => setEditingChyron(null)} disabled={saving} className="p-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50" title="Cancel editing">✕</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleEditChyron(chyron)} disabled={saving} className="p-2 text-blue-600 bg-blue-100 rounded-lg hover:bg-blue-200 disabled:opacity-50" title="Edit message"><Edit className="h-4 w-4" /></button>
                        <button onClick={() => handleRemoveChyron(chyron.id)} disabled={saving} className="p-2 text-red-600 bg-red-100 rounded-lg hover:bg-red-200 disabled:opacity-50" title="Delete message"><Trash2 className="h-4 w-4" /></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Chyron Controls</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-full"><Play className="h-5 w-5 text-green-600" /></div>
              <div>
                <h3 className="text-lg font-semibold text-green-700">Chyron Enabled</h3>
                <p className="text-sm text-green-600">The chyron is always active on all displays.</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2"><Zap className="inline h-4 w-4 mr-1" />Chyron Speed: {chyronSpeed}x</label>
              <input type="range" min="1" max="5" step="0.5" value={chyronSpeed} onChange={(e) => setChyronSpeed(parseFloat(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" style={{ background: rangeBackground }} />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Slow</span><span>Normal</span><span>Fast</span>
              </div>
            </div>
          </div>
        </div>

        {chyrons.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Chyron Preview</h2>
            <div className="bg-black text-white p-4 rounded-lg overflow-hidden relative h-16">
              <div className="absolute bottom-4 whitespace-nowrap animate-scroll" style={{ animationDuration: `${20 / chyronSpeed}s` }}>
                {chyrons.map(t => t.text).join(' • ')}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button onClick={handleSave} disabled={saving} className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 text-lg font-medium">
                {saving ? (<><div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>Saving...</>) : (<><Save className="h-5 w-5" />Save All Changes</>)}
              </button>
              {saveMessage && (<div className={`px-4 py-2 rounded-lg font-medium ${saveMessage.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{saveMessage}</div>)}
            </div>
            <div className="flex items-center space-x-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" /><span className="text-sm font-medium">Don't Forget to Save Your Changes</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chyron;