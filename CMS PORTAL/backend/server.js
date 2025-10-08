import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import multer from 'multer';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES module equivalent of __dirname and __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execAsync = promisify(exec);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Set timezone to IST for Node.js process
process.env.TZ = 'Asia/Kolkata';

// Storage folders
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const DATA_DIR = path.join(process.cwd(), 'data');

await fs.mkdir(UPLOAD_DIR, { recursive: true });
await fs.mkdir(DATA_DIR, { recursive: true });

// File paths
const MEDIA_JSON_PATH = path.join(DATA_DIR, 'media.json');
const SCHEDULES_JSON_PATH = path.join(DATA_DIR, 'schedules.json');
const PLAYLISTS_JSON_PATH = path.join(DATA_DIR, 'playlists.json');
const PLAYERS_JSON_PATH = path.join(DATA_DIR, 'players.json');
const PLAYER_TOKENS_PATH = path.join(DATA_DIR, 'player_tokens.json');
const SETTINGS_JSON_PATH = path.join(DATA_DIR, 'settings.json');

// Store active WebSocket connections
const playerConnections = new Map();

// Store player states for real-time preview
const playerStates = new Map();

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  }
});

const upload = multer({ storage });

// DYNAMIC IMPORT HELPERS
let pdfLibraries = {
  pdfImgConvert: null,
  pdf2pic: null,
  pdfjs: null,
  canvas: null
};

// Dynamically load PDF libraries with error handling
async function loadPdfLibraries() {
  console.log('Loading PDF conversion libraries...');

  // Try to load pdf-img-convert
  try {
    const { default: pdfImgConvert } = await import('pdf-img-convert');
    pdfLibraries.pdfImgConvert = pdfImgConvert;
    console.log('✓ pdf-img-convert loaded successfully');
  } catch (error) {
    console.log('✗ pdf-img-convert not available:', error.message);
  }

  // Try to load pdf2pic
  try {
    const { fromPath } = await import('pdf2pic');
    pdfLibraries.pdf2pic = fromPath;
    console.log('✓ pdf2pic loaded successfully');
  } catch (error) {
    console.log('✗ pdf2pic not available:', error.message);
  }

  // Try to load pdfjs-dist
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
    pdfLibraries.pdfjs = pdfjs.getDocument;
    console.log('✓ pdfjs-dist loaded successfully');
  } catch (error) {
    console.log('✗ pdfjs-dist not available:', error.message);
  }

  // Try to load canvas
  try {
    const canvas = await import('canvas');
    pdfLibraries.canvas = canvas;
    console.log('✓ canvas loaded successfully');
  } catch (error) {
    console.log('✗ canvas not available:', error.message);
  }
}

// PLATFORM-INDEPENDENT PDF CONVERSION UTILITIES

// Method 1: pdftoppm from poppler-utils - most reliable on Linux
async function convertWithPdftoppm(pdfPath, outputDir, baseName) {
  const outputPath = path.join(outputDir, baseName);
  await execAsync(`pdftoppm -png -r 300 "${pdfPath}" "${outputPath}"`);
  const files = await fs.readdir(outputDir);
  return files.filter(f => f.startsWith(baseName) && f.endsWith('.png'));
}

// Platform-independent PDF to image conversion function with fallbacks
async function convertPDFToImages(pdfPath, outputDir, baseName) {
  console.log(`Converting PDF ${pdfPath} to images...`);

  // Method 1: PDF.js + Canvas (pure JS, most compatible)
  try {
    if (pdfLibraries.pdfjs && pdfLibraries.canvas) {
      console.log('Attempting conversion with PDF.js + Canvas...');
      return await convertWithPDFJS(pdfPath, outputDir, baseName);
    }
  } catch (error) {
    console.log('PDF.js + Canvas failed:', error.message);
  }

  // Method 2: pdf-img-convert (pure JS)
  try {
    if (pdfLibraries.pdfImgConvert) {
      console.log('Attempting conversion with pdf-img-convert...');
      return await convertWithPdfImgConvert(pdfPath, outputDir, baseName);
    }
  } catch (error) {
    console.log('pdf-img-convert failed:', error.message);
  }

  // Method 3: pdftoppm CLI tool, reliable on Linux/Docker
  try {
    console.log('Attempting conversion with pdftoppm...');
    return await convertWithPdftoppm(pdfPath, outputDir, baseName);
  } catch (error) {
    console.log('pdftoppm failed:', error.message);
  }

  // Method 4: pdf2pic (wrapper for GraphicsMagick)
  try {
    if (pdfLibraries.pdf2pic) {
      console.log('Attempting conversion with pdf2pic...');
      return await convertWithPdf2pic(pdfPath, outputDir, baseName);
    }
  } catch (error) {
    console.log('pdf2pic failed:', error.message);
  }

  // Method 5: ImageMagick/GraphicsMagick CLI tool
  try {
    console.log('Attempting conversion with ImageMagick...');
    return await convertWithImageMagick(pdfPath, outputDir, baseName);
  } catch (error) {
    console.log('ImageMagick failed:', error.message);
  }

  // If all methods fail, throw an error
  throw new Error('All PDF conversion methods failed. Please install at least one PDF processing library.');
}

// Method 1: pdf-img-convert (Pure Node.js, no external dependencies)
async function convertWithPdfImgConvert(pdfPath, outputDir, baseName) {
  const pdfBuffer = await fs.readFile(pdfPath);
  const pages = await pdfLibraries.pdfImgConvert.convert(pdfBuffer);
  const generatedFiles = [];

  for (let i = 0; i < pages.length; i++) {
    const filename = `${baseName}-${i + 1}.png`;
    const filepath = path.join(outputDir, filename);
    await fs.writeFile(filepath, pages[i]);
    generatedFiles.push(filename);
  }

  return generatedFiles;
}

// Method 2: pdf2pic (requires GraphicsMagick but more stable)
async function convertWithPdf2pic(pdfPath, outputDir, baseName) {
  const options = {
    density: 300, // Higher density for better quality
    saveFilename: baseName,
    savePath: outputDir,
    format: "png",
    width: 1920,
    height: 1080
  };

  const convert = pdfLibraries.pdf2pic(pdfPath, options);
  await convert.bulk(-1); // Convert all pages

  // Get generated files
  const files = await fs.readdir(outputDir);
  return files.filter(f => f.startsWith(baseName) && f.endsWith('.png'));
}

// Method 3: PDF.js + Canvas (Completely platform-independent)
async function convertWithPDFJS(pdfPath, outputDir, baseName) {
  const pdfBuffer = await fs.readFile(pdfPath);
  const pdf = await pdfLibraries.pdfjs({ data: pdfBuffer }).promise;
  const generatedFiles = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 3.0 }); // Higher scale for better quality
    const canvas = pdfLibraries.canvas.createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');

    await page.render({ canvasContext: context, viewport: viewport }).promise;

    const filename = `${baseName}-${pageNum}.png`;
    const filepath = path.join(outputDir, filename);
    const buffer = canvas.toBuffer('image/png');
    await fs.writeFile(filepath, buffer);
    generatedFiles.push(filename);
  }

  return generatedFiles;
}

// Method 4: Direct ImageMagick/GraphicsMagick command fallback
async function convertWithImageMagick(pdfPath, outputDir, baseName) {
  const outputPattern = path.join(outputDir, `${baseName}-%d.png`);

  // Try convert command (ImageMagick)
  try {
    await execAsync(`convert -density 300 "${pdfPath}" "${outputPattern}"`); // Higher density
  } catch (error) {
    // Try gm command (GraphicsMagick)
    await execAsync(`gm convert -density 300 "${pdfPath}" "${outputPattern}"`); // Higher density
  }

  // Get generated files
  const files = await fs.readdir(outputDir);
  return files.filter(f => f.startsWith(baseName) && f.endsWith('.png'));
}

// Platform-independent document conversion (DOCX/PPTX to PDF)
async function convertDocumentToPDF(inputPath, outputPath) {
  const platform = os.platform();
  const inputDir = path.dirname(inputPath);
  let command;

  if (platform === 'win32') {
    // Windows-specific commands
    const libreOfficePath = '"C:\\\\Program Files\\\\LibreOffice\\\\program\\\\soffice.exe"';
    command = `${libreOfficePath} --headless --convert-to pdf --outdir "${inputDir}" "${inputPath}"`;
  } else if (platform === 'darwin') {
    // macOS-specific command
    const libreOfficePath = '/Applications/LibreOffice.app/Contents/MacOS/soffice';
    command = `"${libreOfficePath}" --headless --convert-to pdf --outdir "${inputDir}" "${inputPath}"`;
  } else {
    // Linux/Docker commands
    command = `unoconv -f pdf -o "${outputPath}" "${inputPath}"`;
  }

  try {
    console.log(`Trying command: ${command}`);
    await execAsync(command);

    // Verify output (for non-unoconv commands)
    if (platform !== 'linux') {
      const expectedPdfPath = inputPath.replace(path.extname(inputPath), '.pdf');
      await fs.rename(expectedPdfPath, outputPath);
    }

    return outputPath;
  } catch (error) {
    console.error('Command failed:', error.message);

    // Fallback for Linux if unoconv fails
    if (platform === 'linux') {
      try {
        const fallbackCommand = `soffice --headless --convert-to pdf --outdir "${inputDir}" "${inputPath}"`;
        console.log(`Trying fallback command: ${fallbackCommand}`);
        await execAsync(fallbackCommand);
        const expectedPdfPath = inputPath.replace(path.extname(inputPath), '.pdf');
        await fs.rename(expectedPdfPath, outputPath);
        return outputPath;
      } catch (fallbackError) {
        console.error('Fallback command failed:', fallbackError.message);
      }
    }

    throw new Error('Cannot convert document. Please ensure LibreOffice is installed and accessible.');
  }
}

// Helper functions (keeping original structure)
async function loadJSON(filePath, defaultValue = []) {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return defaultValue;
  }
}

async function saveJSON(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// Data loading functions
async function loadMedia() {
  return loadJSON(MEDIA_JSON_PATH);
}

async function saveMedia(data) {
  await saveJSON(MEDIA_JSON_PATH, data);
  // broadcast: type: 'media-updated'
  notifyPlayersOfContentChange();
}

async function loadSchedules() {
  return loadJSON(SCHEDULES_JSON_PATH);
}

async function saveSchedules(data) {
  await saveJSON(SCHEDULES_JSON_PATH, data);
  // broadcast: type: 'schedule-updated'
  notifyPlayersOfContentChange();
}

async function loadPlaylists() {
  return loadJSON(PLAYLISTS_JSON_PATH);
}

async function savePlaylists(data) {
  await saveJSON(PLAYLISTS_JSON_PATH, data);
  // broadcast: type: 'playlist-updated'
  notifyPlayersOfContentChange();
}

async function loadPlayers() {
  return loadJSON(PLAYERS_JSON_PATH);
}

async function savePlayers(data) {
  await saveJSON(PLAYERS_JSON_PATH, data);
  broadcastToCMS({ type: 'players-updated' });
}

// ENHANCED Settings with full ticker support
async function loadSettings() {
  return loadJSON(SETTINGS_JSON_PATH, { 
    tickerText: "",
    tickers: [],
    tickerEnabled: true,
    tickerSpeed: 2
  });
}

async function saveSettings(data) {
  await saveJSON(SETTINGS_JSON_PATH, data);
  
  // IMMEDIATELY notify all players with specific ticker update
  console.log('🎯 TICKER SETTINGS UPDATED - Broadcasting to all players...');
  
  // Send specific ticker update message
  const tickerUpdateMessage = {
    type: 'ticker-updated',
    tickerText: data.tickerText || '',
    tickerEnabled: data.tickerEnabled !== undefined ? data.tickerEnabled : true,
    tickerSpeed: data.tickerSpeed || 2,
    timestamp: new Date().toISOString()
  };
  
  broadcastToAllPlayers(tickerUpdateMessage);
  broadcastToCMS({ type: 'ticker-settings-updated', data: tickerUpdateMessage });
  
  // Also send general content change notification
  notifyPlayersOfContentChange();
}

// Player token management
async function loadPlayerTokens() {
  return loadJSON(PLAYER_TOKENS_PATH, {});
}

async function savePlayerTokens(data) {
  await saveJSON(PLAYER_TOKENS_PATH, data);
}

function generatePlayerToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function validatePlayerToken(playerId, token) {
  const tokens = await loadPlayerTokens();
  return tokens[playerId] === token;
}

// WebSocket functions
function sendToPlayer(playerId, message) {
  const connection = playerConnections.get(playerId);
  if (connection && connection.readyState === connection.OPEN) {
    connection.send(JSON.stringify(message));
    return true;
  }
  return false;
}

function broadcastToAllPlayers(message) {
  console.log(`📡 Broadcasting to ${playerConnections.size} connected players:`, message.type);
  playerConnections.forEach((connection, playerId) => {
    if (connection.readyState === connection.OPEN) {
      connection.send(JSON.stringify(message));
    }
  });
}

function broadcastToCMS(message) {
  wss.clients.forEach(client => {
    if (client.playerData?.type === 'cms' && client.readyState === client.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

function broadcast(message) {
  wss.clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// ENHANCED: Notify players when content changes with immediate broadcast
function notifyPlayersOfContentChange() {
  console.log('🚀 Notifying all players of content change...');
  const message = {
    type: 'content-changed',
    timestamp: new Date().toISOString()
  };

  // Send to all connected players immediately
  broadcastToAllPlayers(message);

  // Also broadcast to CMS clients
  broadcastToCMS({
    type: 'content-updated',
    timestamp: new Date().toISOString()
  });
}

// IST timezone helper function
function getISTDateTime() {
  const now = new Date();

  // Create IST date explicitly
  const istDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));

  const currentDay = istDate.toLocaleDateString("en-US", {
    weekday: 'long',
    timeZone: "Asia/Kolkata"
  }).toLowerCase();

  const currentTime = istDate.toLocaleTimeString("en-US", {
    hour12: false,
    timeZone: "Asia/Kolkata",
    hour: '2-digit',
    minute: '2-digit'
  });

  const currentDate = istDate.toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata"
  }); // YYYY-MM-DD format

  return { istDate, currentDay, currentTime, currentDate };
}

// Serve uploaded files statically
app.use('/uploads', express.static(UPLOAD_DIR));

// ENHANCED SETTINGS ENDPOINTS - FULL TICKER SUPPORT
app.get('/settings', async (req, res) => {
  try {
    const settings = await loadSettings();
    console.log('📋 Settings requested:', settings);
    res.json(settings);
  } catch (error) {
    console.error('Error loading settings:', error);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

app.post('/settings', async (req, res) => {
  try {
    console.log('💾 Saving settings:', req.body);
    
    const currentSettings = await loadSettings();
    const newSettings = { ...currentSettings, ...req.body };
    
    await saveSettings(newSettings);
    
    console.log('✅ Settings saved and broadcasted to all players');
    res.json(newSettings);
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// MEDIA ENDPOINTS
app.get('/media', async (req, res) => {
  const media = await loadMedia();
  res.json(media);
});

app.post('/media', upload.single('file'), async (req, res) => {
  const media = await loadMedia();
  const { name, type, duration, tags, uploadedBy } = req.body;

  let parsedTags = [];
  if (tags) {
    if (Array.isArray(tags)) {
      parsedTags = tags.map(t => t.trim());
    } else if (typeof tags === 'string') {
      parsedTags = tags.split(',').map(t => t.trim());
    }
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileExt = path.extname(req.file.originalname).toLowerCase();

  // Handle documents (PDF, PPTX, DOCX)
  if (['.pdf', '.pptx', '.docx', '.ppt', '.doc'].includes(fileExt)) {
    try {
      let pdfPath = req.file.path;

      // Convert document to PDF if needed
      if (fileExt !== '.pdf') {
        const pdfOutputPath = req.file.path.replace(fileExt, '.pdf');
        pdfPath = await convertDocumentToPDF(req.file.path, pdfOutputPath);
      }

      // Convert PDF to images using platform-independent method
      const baseName = path.basename(pdfPath, path.extname(pdfPath));
      const generatedFiles = await convertPDFToImages(pdfPath, UPLOAD_DIR, baseName);

      const documentGroupId = Date.now().toString();

      // Create a single parent media item for the document group
      const documentGroupItem = {
        id: documentGroupId,
        name: name || req.file.originalname,
        type: 'document-group',
        tags: parsedTags,
        uploadedAt: new Date().toISOString(),
        uploadedBy: uploadedBy || 'Unknown',
        fileSize: req.file.size,
        pages: [] // This will be populated with image media items
      };

      // Create media items for each generated image and link them to the parent
      const pageMediaItems = generatedFiles.map((file, idx) => ({
        id: `${documentGroupId}-${idx}`,
        name: `${name || req.file.originalname} (Page ${idx + 1})`,
        type: 'image',
        duration: parseInt(duration) || 5,
        tags: parsedTags,
        url: `uploads/${file}`,
        uploadedAt: new Date().toISOString(),
        uploadedBy: uploadedBy || 'Unknown',
        fileSize: 0, // Individual page size is not easily available here
        groupId: documentGroupId
      }));

      documentGroupItem.pages = pageMediaItems.map(item => item.id);
      media.push(documentGroupItem, ...pageMediaItems);

      await saveMedia(media);
      return res.status(201).json(documentGroupItem);

    } catch (err) {
      console.error('Document conversion failed:', err);
      return res.status(500).json({ error: 'Failed to process document', details: err.message });
    }
  }

  // Fallback for normal image/video/text
  const newMedia = {
    id: Date.now().toString(),
    name: name || req.file.originalname,
    type: type || (req.file.mimetype.startsWith('video/') ? 'video' : req.file.mimetype.startsWith('image/') ? 'image' : 'text'),
    duration: parseInt(duration) || 5,
    tags: parsedTags,
    url: `uploads/${req.file.filename}`,
    uploadedAt: new Date().toISOString(),
    uploadedBy: uploadedBy || 'Unknown',
    fileSize: req.file.size
  };

  media.push(newMedia);
  await saveMedia(media);
  res.status(201).json(newMedia);
});

app.delete('/media/:id', async (req, res) => {
  let media = await loadMedia();
  const id = req.params.id;
  const item = media.find(m => m.id === id);

  if (!item) {
    return res.status(404).json({ error: 'Media not found' });
  }

  // If it's a document group, delete all associated pages
  if (item.type === 'document-group' && item.pages) {
    for (const pageId of item.pages) {
      const pageItem = media.find(m => m.id === pageId);
      if (pageItem) {
        try {
          await fs.unlink(path.join(process.cwd(), pageItem.url));
        } catch { /* ignore errors */ }
      }
    }
    // Remove all pages from media array
    media = media.filter(m => m.groupId !== id);
  }

  // Delete the main file
  try {
    if (item.url) {
      await fs.unlink(path.join(process.cwd(), item.url));
    }
  } catch { /* ignore errors */ }

  // Remove the item itself
  media = media.filter(m => m.id !== id);
  await saveMedia(media);
  res.json({ success: true });
});

// PLAYLIST ENDPOINTS
app.get('/playlists', async (req, res) => {
  const playlists = await loadPlaylists();
  res.json(playlists);
});

app.post('/playlists', async (req, res) => {
  const playlists = await loadPlaylists();
  const newPlaylist = {
    id: Date.now().toString(),
    ...req.body,
    createdAt: new Date().toISOString()
  };
  playlists.push(newPlaylist);
  await savePlaylists(playlists);
  res.status(201).json(newPlaylist);
});

app.put('/playlists/:id', async (req, res) => {
  let playlists = await loadPlaylists();
  const index = playlists.findIndex(p => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Playlist not found' });
  }

  playlists[index] = { ...playlists[index], ...req.body };
  await savePlaylists(playlists);
  res.json(playlists[index]);
});

app.delete('/playlists/:id', async (req, res) => {
  let playlists = await loadPlaylists();
  playlists = playlists.filter(p => p.id !== req.params.id);
  await savePlaylists(playlists);
  res.json({ success: true });
});

// SCHEDULE ENDPOINTS
app.get('/schedules', async (req, res) => {
  const schedules = await loadSchedules();
  res.json(schedules);
});

app.post('/schedules', async (req, res) => {
  const schedules = await loadSchedules();
  const newSchedule = {
    id: Date.now().toString(),
    ...req.body,
    createdAt: new Date().toISOString()
  };
  schedules.push(newSchedule);
  await saveSchedules(schedules);
  res.status(201).json(newSchedule);
});

app.put('/schedules/:id', async (req, res) => {
  let schedules = await loadSchedules();
  const index = schedules.findIndex(s => s.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Schedule not found' });
  }

  schedules[index] = { ...schedules[index], ...req.body };
  await saveSchedules(schedules);
  res.json(schedules[index]);
});

app.delete('/schedules/:id', async (req, res) => {
  let schedules = await loadSchedules();
  schedules = schedules.filter(s => s.id !== req.params.id);
  await saveSchedules(schedules);
  res.json({ success: true });
});

// PLAYER ENDPOINTS
app.post('/players/register', async (req, res) => {
  try {
    const { deviceInfo, location, name } = req.body;
    const playerId = `player-${Date.now()}`;
    const token = generatePlayerToken();

    const tokens = await loadPlayerTokens();
    tokens[playerId] = token;
    await savePlayerTokens(tokens);

    const players = await loadPlayers();
    const newPlayer = {
      id: playerId,
      name: name || `Display ${players.length + 1}`,
      location: location || 'Unknown Location',
      status: 'online',
      lastSync: new Date().toISOString(),
      version: '1.0.0',
      currentPlaylist: null,
      deviceInfo: deviceInfo || {},
      ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
      registeredAt: new Date().toISOString()
    };

    players.push(newPlayer);
    await savePlayers(players);

    broadcastToCMS({ type: 'player-registered', player: newPlayer });
    res.json({ playerId, token, player: newPlayer });

  } catch (error) {
    console.error('Player registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Get unique player locations
app.get('/players/locations', async (req, res) => {
  try {
    const players = await loadPlayers();
    const locations = [...new Set(players.map(p => p.location || 'Unknown'))];
    res.json(locations);
  } catch (error) {
    console.error('Error fetching player locations:', error);
    res.status(500).json({ error: 'Failed to load locations' });
  }
});

// Player authentication
app.post('/players/auth', async (req, res) => {
  try {
    const { playerId, token } = req.body;

    if (await validatePlayerToken(playerId, token)) {
      const players = await loadPlayers();
      const player = players.find(p => p.id === playerId);

      if (player) {
        player.lastSync = new Date().toISOString();
        player.status = 'online';
        await savePlayers(players);
        res.json({ success: true, player });
      } else {
        res.status(404).json({ error: 'Player not found' });
      }
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Get all players
app.get('/players', async (req, res) => {
  const players = await loadPlayers();
  const playersWithStatus = players.map(player => ({
    ...player,
    isConnected: playerConnections.has(player.id),
    lastPing: player.lastPing || null
  }));
  res.json(playersWithStatus);
});

// Update player
app.put('/players/:id', async (req, res) => {
  try {
    const players = await loadPlayers();
    const index = players.findIndex(p => p.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const allowedFields = ['name', 'location'];
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    players[index] = { ...players[index], ...updates, lastSync: new Date().toISOString() };
    await savePlayers(players);

    sendToPlayer(req.params.id, { type: 'config-update', config: updates });
    broadcastToCMS({ type: 'player-updated', player: players[index] });

    res.json(players[index]);
  } catch (error) {
    res.status(500).json({ error: 'Update failed' });
  }
});

// Delete player
app.delete('/players/:id', async (req, res) => {
  try {
    let players = await loadPlayers();
    const player = players.find(p => p.id === req.params.id);

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    players = players.filter(p => p.id !== req.params.id);
    await savePlayers(players);

    const tokens = await loadPlayerTokens();
    delete tokens[req.params.id];
    await savePlayerTokens(tokens);

    const connection = playerConnections.get(req.params.id);
    if (connection) {
      connection.send(JSON.stringify({
        type: 'player-deleted',
        message: 'Player has been removed from the system'
      }));
      connection.close();
      playerConnections.delete(req.params.id);
    }

    broadcastToCMS({ type: 'player-removed', playerId: req.params.id });
    res.json({ success: true });

  } catch (error) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

// Send command to player
app.post('/players/:id/command', async (req, res) => {
  try {
    const { command, data } = req.body;
    const playerId = req.params.id;

    const success = sendToPlayer(playerId, {
      type: 'command',
      command,
      data,
      timestamp: new Date().toISOString()
    });

    if (success) {
      res.json({ success: true, message: 'Command sent' });
    } else {
      res.status(404).json({ error: 'Player not connected' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Command failed' });
  }
});

// Player state endpoints for real-time preview
app.post('/api/players/:playerId/state', (req, res) => {
  const { playerId } = req.params;
  const state = req.body;
  
  // Construct the absolute URL for media
  if (state.mediaUrl && !state.mediaUrl.startsWith('http')) {
      const baseUrl = `${req.protocol}://${req.get('host')}/`;
      // Use URL constructor to handle joining paths correctly, avoiding double slashes.
      const absoluteUrl = new URL(state.mediaUrl.replace(/\\/g, '/'), baseUrl);
      state.mediaUrl = absoluteUrl.href;
  }

  state.timestamp = new Date().toISOString();
  playerStates.set(playerId, state);
  
  // SSE push to subscribers
  const sseConnection = sseConnections.get(playerId);
  if (sseConnection) {
    sseConnection.res.write(`data: ${JSON.stringify(state)}\n\n`);
  }
  
  res.sendStatus(200);
});

const sseConnections = new Map();

app.get('/api/players/:playerId/subscribe', (req, res) => {
  const { playerId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseConnections.set(playerId, { res });

  req.on('close', () => {
    sseConnections.delete(playerId);
  });
});

app.get('/api/players/:playerId/preview', (req, res) => {
  const { playerId } = req.params;
  const state = playerStates.get(playerId);
  if (state) {
    res.json(state);
  } else {
    res.status(404).json({ status: 'offline' });
  }
});

// ENHANCED Get player schedule - INCLUDES TICKER SETTINGS
app.get('/player-schedule/:playerId', async (req, res) => {
  try {
    const playerId = req.params.playerId;
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token && !await validatePlayerToken(playerId, token)) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const schedules = await loadSchedules();
    const playlists = await loadPlaylists();
    const media = await loadMedia();
    const settings = await loadSettings();

    const { istDate, currentDay, currentTime, currentDate } = getISTDateTime();

    const activeSchedules = schedules.filter(schedule => {
      if (!schedule.isActive) return false;
      if (!schedule.playerIds.includes(playerId)) return false;
      if (schedule.startDate && currentDate < schedule.startDate) return false;
      if (schedule.endDate && currentDate > schedule.endDate) return false;
      if (schedule.recurringDays.length > 0 && !schedule.recurringDays.includes(currentDay)) return false;

      return schedule.timeSlots.some(slot =>
        currentTime >= slot.startTime && currentTime <= slot.endTime
      );
    });

    let activePlaylists = [];
    let playlistMedia = [];

    if (activeSchedules.length > 0) {
      // Merge playlists from ALL active schedules
      const allPlaylistIds = activeSchedules.flatMap(s => s.playlistIds);
      activePlaylists = playlists.filter(p => allPlaylistIds.includes(p.id));

      playlistMedia = activePlaylists.flatMap(currentPlaylist => {
        if (!currentPlaylist.mediaItems) return [];

        return currentPlaylist.mediaItems.flatMap(item => {
          let mediaId, duration;

          if (typeof item === 'string') {
            mediaId = item;
            duration = 5;
          } else {
            mediaId = item.mediaId;
            duration = item.duration || 5;
          }

          const mediaItem = media.find(m => m.id === mediaId);
          if (!mediaItem) return [];

          if (mediaItem.type === 'document-group') {
            return mediaItem.pages.map(pageId => {
              const pageItem = media.find(p => p.id === pageId);
              return pageItem ? { ...pageItem, playlistDuration: duration } : null;
            }).filter(Boolean);
          }

          return { ...mediaItem, playlistDuration: duration };
        }).filter(Boolean);
      });
    }

    // Save current playlists for this player
    const players = await loadPlayers();
    const playerIndex = players.findIndex(p => p.id === playerId);
    if (playerIndex !== -1) {
      players[playerIndex].currentPlaylist = activePlaylists.map(p => p.name).join(', ');
      players[playerIndex].lastSync = new Date().toISOString();
      players[playerIndex].status = 'online';
      await savePlayers(players);
    }

    // ENHANCED: Include full ticker settings
    const response = {
      playerId,
      currentSchedule: activeSchedules[0] || null,
      playlists: activePlaylists,
      media: playlistMedia,
      tickerText: settings.tickerText || "",
      tickerEnabled: settings.tickerEnabled !== undefined ? settings.tickerEnabled : true,
      tickerSpeed: settings.tickerSpeed || 2,
      serverTime: istDate.toISOString(),
      contentHash: JSON.stringify(playlistMedia.length + (settings.tickerText || '').length + (settings.tickerEnabled ? 1 : 0) + (settings.tickerSpeed || 2))
    };

    console.log(`📤 Sending schedule to ${playerId}:`, {
      media: playlistMedia.length,
      ticker: settings.tickerText ? 'YES' : 'NO',
      enabled: response.tickerEnabled
    });

    res.json(response);

  } catch (error) {
    console.error('Error fetching player schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Stats endpoint
app.get('/stats', async (req, res) => {
  const [media, playlists, schedules, players] = await Promise.all([
    loadMedia(),
    loadPlaylists(),
    loadSchedules(),
    loadPlayers()
  ]);

  const stats = {
    totalMedia: media.length,
    totalPlaylists: playlists.length,
    activePlaylists: playlists.filter(p => p.isActive).length,
    totalSchedules: schedules.length,
    activeSchedules: schedules.filter(s => s.isActive).length,
    totalPlayers: players.length,
    onlinePlayers: players.filter(p => p.status === 'online').length,
    offlinePlayers: players.filter(p => p.status === 'offline').length
  };

  res.json(stats);
});

// ENHANCED WEBSOCKET CONNECTION HANDLING
wss.on('connection', (ws, req) => {
  console.log('📡 WebSocket client connected');

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'player-connect':
          if (await validatePlayerToken(message.playerId, message.token)) {
            ws.playerData = { type: 'player', playerId: message.playerId };
            playerConnections.set(message.playerId, ws);

            const players = await loadPlayers();
            const playerIndex = players.findIndex(p => p.id === message.playerId);
            if (playerIndex !== -1) {
              players[playerIndex].status = 'online';
              players[playerIndex].lastSync = new Date().toISOString();
              await savePlayers(players);
              playerStates.set(message.playerId, { status: 'online', timestamp: new Date().toISOString() });
              broadcastToCMS({ type: 'player-connected', player: players[playerIndex] });
            }

            ws.send(JSON.stringify({
              type: 'connection-confirmed',
              playerId: message.playerId
            }));
            
            // Send current ticker settings immediately upon connection
            const settings = await loadSettings();
            ws.send(JSON.stringify({
              type: 'ticker-updated',
              tickerText: settings.tickerText || '',
              tickerEnabled: settings.tickerEnabled !== undefined ? settings.tickerEnabled : true,
              tickerSpeed: settings.tickerSpeed || 2,
              timestamp: new Date().toISOString()
            }));
            
            console.log('✅ Player connected:', message.playerId);
          } else {
            ws.send(JSON.stringify({
              type: 'connection-rejected',
              reason: 'Invalid credentials'
            }));
            ws.close();
            console.log('❌ Player connection rejected:', message.playerId);
          }
          break;

        case 'cms-connect':
          ws.playerData = { type: 'cms' };
          ws.send(JSON.stringify({ type: 'cms-connected' }));
          console.log('🖥️ CMS client connected');
          break;

        case 'player-heartbeat':
          if (ws.playerData?.type === 'player') {
            const players = await loadPlayers();
            const playerIndex = players.findIndex(p => p.id === ws.playerData.playerId);
            if (playerIndex !== -1) {
              players[playerIndex].lastPing = new Date().toISOString();
              await savePlayers(players);
            }
          }
          break;

        case 'player-status':
          if (ws.playerData?.type === 'player') {
            broadcastToCMS({
              type: 'player-status',
              playerId: ws.playerData.playerId,
              status: message.status
            });
          }
          break;
      }
    } catch (e) {
      console.log('❌ Invalid WebSocket message:', data);
    }
  });

  ws.on('close', async () => {
    if (ws.playerData?.type === 'player') {
      const playerId = ws.playerData.playerId;
      playerConnections.delete(playerId);

      const players = await loadPlayers();
      const playerIndex = players.findIndex(p => p.id === playerId);
      if (playerIndex !== -1) {
        players[playerIndex].status = 'offline';
        players[playerIndex].lastSync = new Date().toISOString();
        await savePlayers(players);
        
        const offlineState = { status: 'offline', timestamp: new Date().toISOString() };
        playerStates.set(playerId, offlineState);

        const sseConnection = sseConnections.get(playerId);
        if (sseConnection) {
            sseConnection.res.write(`data: ${JSON.stringify(offlineState)}\n\n`);
        }
        
        broadcastToCMS({ type: 'player-disconnected', player: players[playerIndex] });
      }

      console.log('🔌 Player disconnected:', playerId);
    }
  });
});

// Initialize PDF libraries on startup
(async () => {
  try {
    await loadPdfLibraries();
    console.log('📚 PDF libraries initialization completed');
  } catch (error) {
    console.error('Error initializing PDF libraries:', error);
  }
})();

const PORT = 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend server listening on http://0.0.0.0:${PORT}`);
  console.log(`🌐 Server timezone: ${process.env.TZ} (UTC${new Date().getTimezoneOffset() / -60})`);
  const { istDate } = getISTDateTime();
  console.log(`⏰ Current IST time: ${istDate.toISOString()}`);
});