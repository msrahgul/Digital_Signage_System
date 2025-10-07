// src/pages/Ticker.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Save, AlertTriangle, Plus, Edit, Trash2, Play, Pause, Zap } from 'lucide-react';

const BACKEND_URL = 'http://localhost:4000';

interface TickerItem {
  id: string;
  text: string;
}

interface TickerSettings {
  tickers: TickerItem[];
  tickerText: string;
  tickerEnabled: boolean;
  tickerSpeed: number;
}

const Ticker: React.FC = () => {
  const [tickers, setTickers] = useState<TickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newTickerText, setNewTickerText] = useState('');
  const [editingTicker, setEditingTicker] = useState<TickerItem | null>(null);
  const [tickerEnabled, setTickerEnabled] = useState(true);
  const [tickerSpeed, setTickerSpeed] = useState(2);
  const [saveMessage, setSaveMessage] = useState('');

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/settings`);
      if (response.ok) {
        const data = await response.json();
        setTickers(data.tickers || []);
        setTickerEnabled(data.tickerEnabled !== undefined ? data.tickerEnabled : true);
        setTickerSpeed(data.tickerSpeed || 2);
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
      // Combine all ticker texts into one string
      const combinedTickerText = tickers.map(t => t.text).join(' • ');
      
      const settings = {
        tickerText: combinedTickerText,
        tickers: tickers,
        tickerEnabled: tickerEnabled,
        tickerSpeed: tickerSpeed
      };

      const response = await fetch(`${BACKEND_URL}/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setSaveMessage('✅ Ticker settings saved and updated on all players!');
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        setSaveMessage('❌ Failed to save ticker settings');
      }
    } catch (error) {
      console.error('Error saving tickers:', error);
      setSaveMessage('❌ Error saving ticker settings');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTicker = () => {
    if (newTickerText.trim()) {
      const newTicker: TickerItem = {
        id: Date.now().toString(),
        text: newTickerText.trim(),
      };
      setTickers([...tickers, newTicker]);
      setNewTickerText('');
    }
  };

  const handleRemoveTicker = (id: string) => {
    setTickers(tickers.filter(t => t.id !== id));
  };

  const handleEditTicker = (ticker: TickerItem) => {
    setEditingTicker(ticker);
  };

  const handleUpdateTicker = () => {
    if (editingTicker && editingTicker.text.trim()) {
      setTickers(tickers.map(t => t.id === editingTicker.id ? editingTicker : t));
      setEditingTicker(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      action();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading ticker settings...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Ticker Settings</h1>
        <p className="text-gray-600 mb-6">
          Manage the scrolling text that appears at the bottom of your displays with full control over visibility and speed.
        </p>

        {/* Ticker Controls */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Ticker Controls</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Enable/Disable Ticker */}
            <div>
              <label className="flex items-center space-x-3 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={tickerEnabled}
                    onChange={(e) => setTickerEnabled(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`block w-14 h-8 rounded-full transition-colors duration-200 ${
                    tickerEnabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}></div>
                  <div className={`absolute left-1 top-1 w-6 h-6 bg-white rounded-full transition-transform duration-200 transform ${
                    tickerEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}></div>
                </div>
                <div className="flex items-center space-x-2">
                  {tickerEnabled ? (
                    <Play className="h-5 w-5 text-green-600" />
                  ) : (
                    <Pause className="h-5 w-5 text-gray-600" />
                  )}
                  <span className="text-lg font-medium">
                    Ticker {tickerEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </label>
            </div>

            {/* Speed Control */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Zap className="inline h-4 w-4 mr-1" />
                Ticker Speed: {tickerSpeed}x
              </label>
              <input
                type="range"
                min="1"
                max="5"
                step="0.5"
                value={tickerSpeed}
                onChange={(e) => setTickerSpeed(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${(tickerSpeed - 1) / 4 * 100}%, #E5E7EB ${(tickerSpeed - 1) / 4 * 100}%, #E5E7EB 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Slow</span>
                <span>Normal</span>
                <span>Fast</span>
              </div>
            </div>
          </div>
        </div>

        {/* Add New Ticker */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Add New Ticker Message</h2>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Enter ticker message..."
              value={newTickerText}
              onChange={(e) => setNewTickerText(e.target.value)}
              onKeyPress={(e) => handleKeyPress(e, handleAddTicker)}
              className="flex-grow px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={saving}
            />
            <button
              onClick={handleAddTicker}
              disabled={!newTickerText.trim() || saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Ticker
            </button>
          </div>
        </div>

        {/* Current Ticker Messages */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Current Ticker Messages</h2>
          {tickers.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No ticker messages added yet. Add some messages above to get started!
            </p>
          ) : (
            <div className="space-y-3">
              {tickers.map((ticker, index) => (
                <div key={ticker.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  
                  {editingTicker?.id === ticker.id ? (
                    <input
                      type="text"
                      value={editingTicker.text}
                      onChange={(e) => setEditingTicker({ ...editingTicker, text: e.target.value })}
                      onKeyPress={(e) => handleKeyPress(e, handleUpdateTicker)}
                      className="flex-grow px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      autoFocus
                      disabled={saving}
                    />
                  ) : (
                    <div className="flex-grow px-3 py-2 bg-white rounded border">
                      {ticker.text}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {editingTicker?.id === ticker.id ? (
                      <>
                        <button
                          onClick={handleUpdateTicker}
                          disabled={saving}
                          className="p-2 text-green-600 bg-green-100 rounded-lg hover:bg-green-200 disabled:opacity-50"
                          title="Save changes"
                        >
                          <Save className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditingTicker(null)}
                          disabled={saving}
                          className="p-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                          title="Cancel editing"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEditTicker(ticker)}
                          disabled={saving}
                          className="p-2 text-blue-600 bg-blue-100 rounded-lg hover:bg-blue-200 disabled:opacity-50"
                          title="Edit message"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleRemoveTicker(ticker.id)}
                          disabled={saving}
                          className="p-2 text-red-600 bg-red-100 rounded-lg hover:bg-red-200 disabled:opacity-50"
                          title="Delete message"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview */}
        {tickers.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Ticker Preview</h2>
            <div className="bg-black text-white p-4 rounded-lg overflow-hidden relative h-16">
              <div className="absolute bottom-4 whitespace-nowrap animate-scroll">
                {tickers.map(t => t.text).join(' • ')}
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Preview of how the ticker will appear on displays (actual speed: {tickerSpeed}x)
            </p>
          </div>
        )}

        {/* Save Button */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 text-lg font-medium"
              >
                {saving ? (
                  <>
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5" />
                    Save All Changes
                  </>
                )}
              </button>
              
              {saveMessage && (
                <div className={`px-4 py-2 rounded-lg font-medium ${
                  saveMessage.includes('✅') 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {saveMessage}
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm font-medium">Don't Forget to Save Your Changes</span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes scroll {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-scroll {
          animation: scroll 10s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default Ticker;