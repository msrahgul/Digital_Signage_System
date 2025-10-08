import tkinter as tk
from tkinter import ttk
import cv2
import numpy as np
import requests
import json
import os
import time
import threading
import platform
import subprocess
from datetime import datetime
import websocket
import queue
from PIL import Image, ImageTk, ImageDraw, ImageFont
import hashlib
import vlc
import sys
from urllib.parse import urljoin

# Configuration
# IMPORTANT: Replace "YOUR_SERVER_IP" with the actual IP address of your backend server.
# For example: "http://192.168.1.100:4000/"
BACKEND_URL = "http://10.111.76.220:4000/"
WS_URL = f"ws://{BACKEND_URL.split('//')[1].split(':')[0]}:4000"

CACHE_DIR = "media_cache"
CONFIG_FILE = "player_config.json"
SCHEDULE_CACHE_FILE = "current_schedule.json"
DEVICE_INFO_FILE = "device_info.json"
LOGO_PATH = "KIDS Logo.png"  # Updated to match your logo file

# Ensure cache directory exists
os.makedirs(CACHE_DIR, exist_ok=True)

class UltraPlayerManager:
    def __init__(self):
        self.player_id = None
        self.token = None
        self.ws = None
        self.connected = False
        self.config = self.load_config()
        self.device_info = self.detect_device_info()
        
        self.force_content_refresh = False
        self.current_playing_schedule_id = None
        self.last_content_hash = ""
        self.last_ticker_hash = ""
        
        self.logo = None
        self.logo_mtime = None
        
        self.ticker_text = "KARUNYA INNOVATION AND DESIGN STUDIO • WELCOMES YOU ALL"
        self.show_ticker = True
        self.ticker_speed = 2
        self.ticker_update_queue = queue.Queue()
        
        self.show_logo = True
        
        self.content_update_queue = []
        self.content_update_lock = threading.Lock()
        
        self.vlc_instance = None
        self.vlc_player = None
        self.init_vlc()
        
        self.load_logo()
    
    def init_vlc(self):
        """Initialize VLC with optimal settings and a permanent logo overlay"""
        try:
            logo_path = os.path.abspath(LOGO_PATH)
            if not os.path.exists(logo_path):
                print(f"⚠️ Logo file not found at {logo_path}, video overlay will be disabled.")
                vlc_args = [
                    '--intf', 'dummy',
                    '--no-video-title-show',
                    '--quiet',
                    '--avcodec-hw=any',
                    '--network-caching=300',
                    '--file-caching=300'
                ]
            else:
                # Arguments to add a persistent, transparent logo to all videos
                vlc_args = [
                    '--intf', 'dummy',
                    '--no-video-title-show',
                    '--quiet',
                    '--avcodec-hw=any',
                    '--network-caching=300',
                    '--file-caching=300',
                    '--logo-file=' + logo_path,  # Path to your logo
                    '--logo-position=10',        # 10 = Top-Right
                    '--logo-opacity=255',        # 255 = Fully opaque
                    '--logo-x=20',               # Padding from the right edge
                    '--logo-y=20'                # Padding from the top edge
                ]

            self.vlc_instance = vlc.Instance(vlc_args)
            if self.vlc_instance:
                print("✅ VLC initialized successfully with logo overlay for videos")
            else:
                print("❌ VLC initialization failed")

        except Exception as e:
            print(f"VLC initialization error: {e}")
            self.vlc_instance = None
    
    def load_config(self):
        try:
            if os.path.exists(CONFIG_FILE):
                with open(CONFIG_FILE, 'r') as f:
                    return json.load(f)
        except Exception as e:
            print(f"Failed to load config: {e}")
        return {"name": f"Display-{platform.node()}", "location": "Unknown Location"}
    
    def save_config(self):
        try:
            with open(CONFIG_FILE, 'w') as f:
                json.dump(self.config, f, indent=2)
        except Exception as e:
            print(f"Failed to save config: {e}")
    
    def detect_device_info(self):
        device_info = {
            'screen_width': 1920,
            'screen_height': 1080,
            'orientation': 'landscape',
            'device_type': 'display',
            'os': platform.system(),
            'os_version': platform.release(),
            'python_version': platform.python_version(),
            'hostname': platform.node(),
            'architecture': platform.machine()
        }

        try:
            if platform.system() == "Linux":
                try:
                    result = subprocess.run(['xrandr'], capture_output=True, text=True, timeout=5)
                    if result.returncode == 0:
                        for line in result.stdout.split('\n'):
                            if ' connected ' in line and 'x' in line:
                                try:
                                    parts = line.split()
                                    for part in parts:
                                        if 'x' in part and '+' not in part:
                                            resolution = part.split('+')[0]
                                            if 'x' in resolution:
                                                width, height = map(int, resolution.split('x'))
                                                device_info['screen_width'] = width
                                                device_info['screen_height'] = height
                                                break
                                    if device_info['screen_width'] != 1920:
                                        break
                                except:
                                    continue
                except:
                    pass
            
            elif platform.system() == "Windows":
                try:
                    # Using a more robust way to get screen size on Windows
                    from win32api import GetSystemMetrics
                    device_info['screen_width'] = GetSystemMetrics(0)
                    device_info['screen_height'] = GetSystemMetrics(1)
                except ImportError:
                    # Fallback to tkinter if pywin32 is not installed
                    try:
                        root = tk.Tk()
                        device_info['screen_width'] = root.winfo_screenwidth()
                        device_info['screen_height'] = root.winfo_screenheight()
                        root.destroy()
                    except:
                        pass

        except Exception as e:
            print(f"Could not detect display info: {e}")

        with open(DEVICE_INFO_FILE, 'w') as f:
            json.dump(device_info, f, indent=2)
        
        print(f"📺 Display detected: {device_info['screen_width']}x{device_info['screen_height']}")
        return device_info
    
    def load_logo(self):
        try:
            if os.path.exists(LOGO_PATH):
                current_mtime = os.path.getmtime(LOGO_PATH)
                if current_mtime == self.logo_mtime:
                    return
                
                with Image.open(LOGO_PATH) as img:
                    # Resize logo to be 8% of the screen height
                    logo_height = int(self.device_info['screen_height'] * 0.08)
                    aspect_ratio = img.width / img.height
                    logo_width = int(logo_height * aspect_ratio)
                    
                    if img.mode != 'RGBA':
                        img = img.convert('RGBA')
                    
                    self.logo = img.resize((logo_width, logo_height), Image.Resampling.LANCZOS)
                    self.logo_mtime = current_mtime
                    
                    print(f"✅ Logo loaded with transparency: {logo_width}x{logo_height}")
        except Exception as e:
            print(f"Error loading logo: {e}")
            
    def register_player(self):
        try:
            payload = {
                "deviceInfo": self.device_info,
                "location": self.config.get("location", "Unknown Location"),
                "name": self.config.get("name", f"Display-{platform.node()}")
            }
            
            response = requests.post(f"{BACKEND_URL}players/register", json=payload, timeout=10)
            if response.status_code == 200:
                data = response.json()
                self.player_id = data['playerId']
                self.token = data['token']
                self.config['playerId'] = self.player_id
                self.config['token'] = self.token
                self.save_config()
                print(f"Registered as player {self.player_id}")
                return True
            else:
                print(f"Registration failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"Registration error: {e}")
            return False
    
    def authenticate(self):
        if not self.config.get('playerId') or not self.config.get('token'):
            return False
        
        try:
            payload = {
                "playerId": self.config['playerId'],
                "token": self.config['token']
            }
            
            response = requests.post(f"{BACKEND_URL}players/auth", json=payload, timeout=10)
            if response.status_code == 200:
                self.player_id = self.config['playerId']
                self.token = self.config['token']
                print(f"✅ Authenticated as player {self.player_id}")
                return True
            else:
                print("Authentication failed, need to re-register")
                return False
        except Exception as e:
            print(f"Authentication error: {e}")
            return False
    
    def connect_websocket(self):
        try:
            def on_message(ws, message):
                try:
                    data = json.loads(message)
                    self.handle_ws_message(data)
                except Exception as e:
                    print(f"WebSocket message error: {e}")
            
            def on_error(ws, error):
                print(f"WebSocket error: {error}")
                self.connected = False
            
            def on_close(ws, close_status_code, close_msg):
                print("WebSocket connection closed")
                self.connected = False
            
            def on_open(ws):
                print("WebSocket connected")
                ws.send(json.dumps({
                    "type": "player-connect",
                    "playerId": self.player_id,
                    "token": self.token
                }))
            
            self.ws = websocket.WebSocketApp(WS_URL,
                                           on_message=on_message,
                                           on_error=on_error,
                                           on_close=on_close,
                                           on_open=on_open)
            
            ws_thread = threading.Thread(target=self.ws.run_forever)
            ws_thread.daemon = True
            ws_thread.start()
            time.sleep(2)
            
        except Exception as e:
            print(f"WebSocket connection error: {e}")
    
    def handle_ws_message(self, data):
        message_type = data.get('type')
        
        if message_type == 'connection-confirmed':
            self.connected = True
            print("✅ WebSocket connection confirmed by server")
        
        elif message_type == 'connection-rejected':
            print(f"WebSocket connection rejected: {data.get('reason')}")
            self.connected = False
        
        elif message_type == 'player-deleted':
            print("Player has been removed from the system. Shutting down...")
            self.shutdown()
        
        elif message_type == 'content-changed':
            print("🚀 INSTANT CONTENT UPDATE RECEIVED! Waiting 1s for server...")
            # FIX: Wait 1 second before triggering the refresh
            time.sleep(1)
            with self.content_update_lock:
                self.content_update_queue.append('instant_check')
        
        elif message_type == 'ticker-updated':
            print("🎯 TICKER SETTINGS UPDATE RECEIVED!")
            ticker_text = data.get('tickerText', '')
            if ticker_text:
                self.ticker_update_queue.put({
                    'text': ticker_text,
                    'enabled': True,
                    'speed': data.get('tickerSpeed', self.ticker_speed)
                })
                print(f"🎯 Updated ticker text from CMS: '{ticker_text}'")
            else:
                print("🎯 CMS ticker text empty - keeping default ticker")
        
        elif message_type == 'command':
            self.handle_remote_command(data.get('command'), data.get('data'))
    
    def handle_remote_command(self, command, data):
        print(f"Received command: {command}")
        
        if command == 'toggle_ticker':
            print(f"⚠️ Ticker toggle command ignored - ticker stays ALWAYS enabled")
        elif command == 'set_ticker_speed':
            self.ticker_speed = data.get('speed', 2) if data else 2
            print(f"Ticker speed set to: {self.ticker_speed}")
    
    def check_for_instant_updates(self):
        with self.content_update_lock:
            if self.content_update_queue:
                self.content_update_queue.clear()
                return True
        return False
    
    def send_heartbeat(self):
        try:
            if self.ws and self.connected:
                self.ws.send(json.dumps({
                    "type": "player-heartbeat",
                    "playerId": self.player_id,
                    "timestamp": datetime.now().isoformat()
                }))
        except Exception as e:
            print(f"Heartbeat error: {e}")
    
    def send_status(self, status):
        try:
            if self.ws and self.connected:
                self.ws.send(json.dumps({
                    "type": "player-status",
                    "playerId": self.player_id,
                    "status": status,
                    "timestamp": datetime.now().isoformat()
                }))
        except Exception as e:
            print(f"Status update error: {e}")
    
    def push_playback_state(self, media_item, status, current_time=0):
        if not self.player_id:
            return

        media_type = media_item.get('type') if media_item else 'none'
        # FIX: ONLY send the relative path, not the full URL.
        relative_url = media_item.get('url', '') if media_item else ''

        state = {
            'playerId': self.player_id,
            'status': status,
            'mediaType': media_type,
            'mediaUrl': relative_url, # Pass the relative URL
            'currentTime': current_time,
            'timestamp': datetime.now().isoformat()
        }
        
        try:
            requests.post(f"{BACKEND_URL}api/players/{self.player_id}/state", json=state, timeout=2)
        except Exception as e:
            print(f"Failed to push player state: {e}")

    def shutdown(self):
        self.connected = False
        if self.vlc_player:
            try:
                self.vlc_player.stop()
            except: pass
            self.vlc_player = None
        if self.ws:
            try:
                self.ws.close()
            except: pass

class UltraDisplayApp:
    def __init__(self):
        self.player_manager = UltraPlayerManager()
        
        self.root = tk.Tk()
        self.root.title("Ultra Digital Signage Player")
        self.root.configure(bg='black')
        self.root.attributes('-topmost', True)
        
        self.screen_width = self.player_manager.device_info['screen_width']
        self.screen_height = self.player_manager.device_info['screen_height']
        
        self.root.attributes('-fullscreen', True)
        self.root.geometry(f"{self.screen_width}x{self.screen_height}+0+0")
        self.root.configure(cursor='none')
        
        self.is_destroying = False

        # --- NEW: Define a constant for the ticker height ---
        self.TICKER_HEIGHT = 60
        
        self.display_frame = tk.Frame(self.root, bg='black', highlightthickness=0)
        self.display_frame.pack(fill='both', expand=True)
        
        self.content_label = tk.Label(self.display_frame, bg='black', highlightthickness=0)
        self.video_frame = tk.Frame(self.display_frame, bg='black', highlightthickness=0)
        
        # REMOVED OLD LOGO WIDGETS
        
        # --- MODIFIED: Use the ticker height constant ---
        self.ticker_frame = tk.Frame(self.root, bg='black', height=self.TICKER_HEIGHT, highlightthickness=0)
        self.ticker_frame.pack(side='bottom', fill='x')
        self.ticker_frame.pack_propagate(False)
        
        # --- MODIFIED: Use the ticker height constant ---
        self.ticker_canvas = tk.Canvas(self.ticker_frame, bg='black', highlightthickness=0, height=self.TICKER_HEIGHT)
        self.ticker_canvas.pack(fill='both', expand=True)
        
        self.current_media_list = []
        self.current_index = 0
        self.current_media_item = None
        self.media_start_time = 0
        self.last_schedule_check = 0
        self.last_heartbeat = 0
        
        self.ticker_job = None
        self.ticker_x = self.screen_width
        self.ticker_text_id = None
        self.ticker_text_width = 0
        self.ticker_running = False
        self.ticker_bg_photo = None
        
        self.root.bind('<Escape>', self.on_escape)
        self.root.bind('<KeyPress>', self.on_key_press)
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        
        self.root.after(100, self.create_default_overlays)
        
        print(f"🚀 Ultra Player initialized: {self.screen_width}x{self.screen_height}")
    
    def create_default_overlays(self):
        """Create Ticker by default - ALWAYS VISIBLE"""
        print("🎨 Creating default overlays: Ticker")
        self.start_default_ticker()
    
    def create_translucent_background(self, width, height, alpha=128):
        try:
            image = Image.new('RGBA', (width, height), (0, 0, 0, alpha))
            return ImageTk.PhotoImage(image)
        except Exception as e:
            print(f"Error creating translucent background: {e}")
            return None
    
    def ensure_overlays_visible(self):
        """Ensure ticker is ALWAYS visible on top"""
        try:
            if not self.ticker_frame.winfo_viewable():
                self.ticker_frame.pack(side='bottom', fill='x')
            self.ticker_frame.lift()
            self.ticker_frame.tkraise()
        except Exception as e:
            print(f"Error ensuring overlays visible: {e}")
    
    def start_default_ticker(self):
        print("🎪 Starting DEFAULT ticker (ALWAYS VISIBLE)")
        if not self.player_manager.ticker_text:
            self.player_manager.ticker_text = "KARUNYA INNOVATION AND DESIGN STUDIO • WELCOMES YOU ALL"
        self.player_manager.show_ticker = True
        self.start_ticker()
    
    def on_escape(self, event):
        self.stop()
    
    def on_key_press(self, event):
        if event.keysym == 'q':
            self.stop()
    
    def on_closing(self):
        self.stop()
    
    def connect_to_cms(self):
        print("Connecting to CMS...")
        if not self.player_manager.authenticate():
            if not self.player_manager.register_player():
                print("❌ Critical: Failed to connect to CMS. Continuing with defaults...")
                return True
        self.player_manager.connect_websocket()
        return True
    
    def make_full_url(self, path):
        # FIX: Use urljoin for robust URL construction
        if path.startswith(('http://', 'https://')):
            return path
        return urljoin(BACKEND_URL, path)
    
    def download_media_file(self, media_item):
        try:
            url = self.make_full_url(media_item['url'])
            filename = f"{media_item['id']}_{os.path.basename(media_item['url'])}"
            local_path = os.path.join(CACHE_DIR, filename)
            
            if os.path.exists(local_path):
                return local_path
            
            print(f"📥 Downloading {media_item.get('name', 'Unknown')} from {url}...")
            with requests.get(url, stream=True, timeout=60) as r:
                r.raise_for_status()
                with open(local_path, 'wb') as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        f.write(chunk)
            print(f"✅ Downloaded: {filename}")
            return local_path
        except Exception as e:
            print(f"❌ Failed to download {media_item.get('name', 'Unknown')}: {e}")
            return None
    
    def fetch_schedule(self):
        try:
            headers = {'Authorization': f"Bearer {self.player_manager.token}"}
            url = f"{BACKEND_URL}player-schedule/{self.player_manager.player_id}"
            resp = requests.get(url, headers=headers, timeout=10)
            
            if resp.status_code == 200:
                schedule_data = resp.json()
                with open(SCHEDULE_CACHE_FILE, 'w') as f:
                    json.dump(schedule_data, f, indent=2)
                return schedule_data
            elif resp.status_code == 401:
                print("Authentication failed - re-authenticating...")
                if self.player_manager.authenticate():
                    return self.fetch_schedule()
            else:
                print(f"Failed to fetch schedule: HTTP {resp.status_code}")
            return self.load_cached_schedule()
        except Exception as e:
            print(f"Failed to fetch schedule: {e}")
            return self.load_cached_schedule()
    
    def load_cached_schedule(self):
        try:
            if os.path.exists(SCHEDULE_CACHE_FILE):
                with open(SCHEDULE_CACHE_FILE, 'r') as f:
                    return json.load(f)
        except Exception as e:
            print(f"Failed to load cached schedule: {e}")
        return None
    
    def download_all_media(self, media_list):
        local_media = []
        for media_item in media_list:
            if media_item.get('type') in ['image', 'video']:
                local_path = self.download_media_file(media_item)
                if local_path:
                    media_item['local_path'] = local_path
                    local_media.append(media_item)
            else:
                local_media.append(media_item)
        return local_media
    
    def display_image(self, media_item):
        """Display image with proper screen fitting and a burned-in logo"""
        try:
            image_path = media_item.get('local_path')
            if not image_path or not os.path.exists(image_path):
                return False

            # --- FIX: Calculate content area dimensions using a reliable constant ---
            content_width = self.screen_width
            content_height = self.screen_height - self.TICKER_HEIGHT
            # --- END FIX ---

            with Image.open(image_path) as img:
                img = img.convert('RGB')

                # --- FIX: Use content area dimensions for scaling the image ---
                img_ratio = img.width / img.height
                content_ratio = content_width / content_height
                if img_ratio > content_ratio:
                    new_width = content_width
                    new_height = int(content_width / img_ratio)
                else:
                    new_height = content_height
                    new_width = int(content_height * img_ratio)
                
                img_resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                
                # --- FIX: Create the background image using content area dimensions ---
                final_image = Image.new('RGB', (content_width, content_height), 'black')
                paste_x = (content_width - new_width) // 2
                paste_y = (content_height - new_height) // 2
                final_image.paste(img_resized, (paste_x, paste_y))
                
                if self.player_manager.logo:
                    logo = self.player_manager.logo
                    # --- FIX: Position logo relative to the smaller content area ---
                    logo_x = content_width - logo.width - 20
                    logo_y = 20
                    final_image.paste(logo, (logo_x, logo_y), mask=logo)
                
                photo = ImageTk.PhotoImage(final_image)
                
                self.video_frame.pack_forget()
                self.content_label.configure(image=photo, text="")
                self.content_label.image = photo
                self.content_label.pack(fill='both', expand=True)
                
                self.root.after(50, self.ensure_overlays_visible)
                return True
                
        except Exception as e:
            print(f"Error displaying image: {e}")
            return False
    
    def display_text(self, text):
        """Display text with proper formatting and a burned-in logo"""
        try:
            # --- FIX: Calculate content area dimensions using a reliable constant ---
            content_width = self.screen_width
            content_height = self.screen_height - self.TICKER_HEIGHT
            # --- END FIX ---

            # --- FIX: Create the background image using content area dimensions ---
            final_image = Image.new('RGB', (content_width, content_height), 'black')
            draw = ImageDraw.Draw(final_image)
            
            font_paths = [
                "arial.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
            ]
            
            try:
                # --- FIX: Base font size on the content area's height ---
                font_size = max(24, content_height // 25)
                font = None
                for font_path in font_paths:
                    try:
                        font = ImageFont.truetype(font_path, font_size)
                        break
                    except: continue
                if not font:
                    font = ImageFont.load_default()
            except:
                font = ImageFont.load_default()
            
            words = text.split()
            lines = []
            current_line = ""
            
            for word in words:
                test_line = (current_line + " " + word).strip()
                try:
                    bbox = draw.textbbox((0, 0), test_line, font=font)
                    text_width = bbox[2] - bbox[0]
                except:
                    text_width, _ = draw.textsize(test_line, font=font)
                
                # --- FIX: Wrap text based on the content area's width ---
                if text_width < content_width * 0.9:
                    current_line = test_line
                else:
                    lines.append(current_line)
                    current_line = word
            if current_line:
                lines.append(current_line)
            
            line_height = font_size + 10
            total_height = len(lines) * line_height
            # --- FIX: Center text vertically within the content area ---
            y = (content_height - total_height) / 2
            
            for line in lines:
                try:
                    bbox = draw.textbbox((0, 0), line, font=font)
                    line_width = bbox[2] - bbox[0]
                except:
                    line_width, _ = draw.textsize(line, font=font)
                x = (content_width - line_width) / 2
                draw.text((x, y), line, font=font, fill="white")
                y += line_height
            
            if self.player_manager.logo:
                logo = self.player_manager.logo
                # --- FIX: Position logo relative to the smaller content area ---
                logo_x = content_width - logo.width - 20
                logo_y = 20
                final_image.paste(logo, (logo_x, logo_y), mask=logo)

            photo = ImageTk.PhotoImage(final_image)
            self.video_frame.pack_forget()
            self.content_label.configure(image=photo, text="")
            self.content_label.image = photo
            self.content_label.pack(fill='both', expand=True)
            self.root.after(50, self.ensure_overlays_visible)
            return True
        except Exception as e:
            print(f"Error displaying text: {e}")
            return False
    
    def display_video(self, media_item):
        """Display video with PERFECT screen fitting and ENSURE overlays visible"""
        try:
            if not self.player_manager.vlc_instance:
                print("No VLC instance available.")
                return False
            
            video_path = media_item.get('local_path')
            if not video_path or not os.path.exists(video_path):
                return False
            
            print(f"🎥 Playing video: {media_item.get('name', 'Unknown')}")
            
            self.content_label.pack_forget()
            self.video_frame.pack(fill='both', expand=True)
            
            if self.player_manager.vlc_player:
                try: self.player_manager.vlc_player.stop()
                except: pass
            
            self.player_manager.vlc_player = self.player_manager.vlc_instance.media_player_new()
            
            self.root.update_idletasks()
            wid = self.video_frame.winfo_id()
            
            try:
                if platform.system() == 'Windows':
                    self.player_manager.vlc_player.set_hwnd(wid)
                else:
                    self.player_manager.vlc_player.set_xwindow(wid)
            except Exception as e:
                print(f"Warning: unable to set window id for VLC: {e}")
            
            media = self.player_manager.vlc_instance.media_new(video_path)
            self.player_manager.vlc_player.set_media(media)
            
            try:
                self.player_manager.vlc_player.video_set_scale(0)
                aspect_ratio = f"{self.screen_width}:{self.screen_height}"
                self.player_manager.vlc_player.video_set_aspect_ratio(aspect_ratio)
                self.player_manager.vlc_player.set_fullscreen(False)
                self.player_manager.vlc_player.video_set_crop_geometry(None)
            except Exception as e:
                print(f"Video scaling settings error: {e}")
            
            self.player_manager.vlc_player.play()
            
            self.root.after(1000, self.ensure_overlays_visible)
            return True
        except Exception as e:
            print(f"Error playing video: {e}")
            return False
    
    def start_ticker(self):
        try:
            if not self.player_manager.ticker_text:
                self.player_manager.ticker_text = "KARUNYA INNOVATION AND DESIGN STUDIO • WELCOMES YOU ALL"
            
            if self.ticker_job:
                try: self.root.after_cancel(self.ticker_job)
                except: pass
                self.ticker_job = None
            
            self.ticker_canvas.delete("all")
            
            self.ticker_bg_photo = self.create_translucent_background(self.screen_width, self.TICKER_HEIGHT, alpha=128)
            
            if self.ticker_bg_photo:
                self.ticker_canvas.create_image(0, 0, anchor='nw', image=self.ticker_bg_photo, tags='ticker_bg')
            else:
                self.ticker_canvas.create_rectangle(0, 0, self.screen_width, self.TICKER_HEIGHT, fill='black', outline='', tags='ticker_bg')
            
            font_paths = ["arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
            try:
                font_size = max(16, int(self.screen_height * 0.03))
                font = None
                for font_path in font_paths:
                    try:
                        font = ImageFont.truetype(font_path, font_size)
                        font_tuple = (font_path, font_size, "bold")
                        break
                    except: continue
                if not font:
                    font_tuple = ("Arial", 20, "bold")
            except:
                font_tuple = ("Arial", 20, "bold")
            
            self.ticker_x = self.screen_width + 50
            
            y_pos = self.TICKER_HEIGHT // 2
            self.ticker_text_id = self.ticker_canvas.create_text(
                self.ticker_x, y_pos,
                text=self.player_manager.ticker_text,
                fill='white', font=font_tuple, anchor='w')
            
            self.root.update_idletasks()
            bbox = self.ticker_canvas.bbox(self.ticker_text_id)
            self.ticker_text_width = (bbox[2] - bbox[0]) if bbox else len(self.player_manager.ticker_text) * 10
            
            self.ticker_running = True
            self.animate_ticker()
            print(f"🎪 DEFAULT TICKER started (ALWAYS RUNNING): '{self.player_manager.ticker_text}'")
        except Exception as e:
            print(f"Error starting ticker: {e}")
    
    def animate_ticker(self):
        try:
            if not self.ticker_running or not self.ticker_text_id:
                return
            
            speed = max(1, int(self.player_manager.ticker_speed))
            self.ticker_x -= speed
            
            reset_position = -(self.ticker_text_width + 100)
            
            if self.ticker_x <= reset_position:
                self.ticker_x = self.screen_width + 50
            
            y_pos = self.TICKER_HEIGHT // 2
            self.ticker_canvas.coords(self.ticker_text_id, self.ticker_x, y_pos)
            
            self.ticker_job = self.root.after(16, self.animate_ticker)
        except Exception as e:
            print(f"Error in ticker animation: {e}")
            self.ticker_running = False
            self.root.after(1000, self.start_ticker)
    
    def stop_ticker(self):
        try:
            self.ticker_running = False
            if self.ticker_job:
                try: self.root.after_cancel(self.ticker_job)
                except: pass
                self.ticker_job = None
            print("⚠️ Ticker stopped (unusual - should be ALWAYS running)")
        except Exception as e:
            print(f"Error stopping ticker: {e}")
    
    def update_ticker(self):
        try:
            while not self.player_manager.ticker_update_queue.empty():
                update = self.player_manager.ticker_update_queue.get_nowait()
                old_text = self.player_manager.ticker_text
                old_speed = self.player_manager.ticker_speed
                new_text = update.get('text', self.player_manager.ticker_text)
                if new_text:
                    self.player_manager.ticker_text = new_text
                self.player_manager.show_ticker = True
                self.player_manager.ticker_speed = update.get('speed', self.player_manager.ticker_speed)
                if (old_text != self.player_manager.ticker_text or old_speed != self.player_manager.ticker_speed):
                    self.start_ticker()
                    print(f"🎯 Ticker updated (ALWAYS ENABLED): '{self.player_manager.ticker_text}', Speed={self.player_manager.ticker_speed}")
        except Exception as e:
            print(f"Error updating ticker: {e}")
    
    def check_schedule(self):
        now = time.time()
        instant_update_triggered = self.player_manager.check_for_instant_updates()
        if now - self.last_schedule_check > 5 or instant_update_triggered:
            schedule_data = self.fetch_schedule()
            if not schedule_data:
                self.last_schedule_check = now
                return
            
            ticker_text = schedule_data.get("tickerText", "")
            if ticker_text:
                self.player_manager.ticker_update_queue.put({
                    'text': ticker_text,
                    'enabled': True,
                    'speed': schedule_data.get("tickerSpeed", 2)
                })
            
            current_schedule = schedule_data.get("currentSchedule", {})
            current_schedule_id = current_schedule.get("id", "") if current_schedule else ""
            
            if (current_schedule_id != self.player_manager.current_playing_schedule_id or self.player_manager.force_content_refresh):
                print(f"🔄 CURRENTLY PLAYING schedule changed: {self.player_manager.current_playing_schedule_id} -> {current_schedule_id}")
                print("📺 Restarting player with new content...")
                
                self.player_manager.send_status("downloading")
                if self.player_manager.vlc_player:
                    try: self.player_manager.vlc_player.stop()
                    except: pass
                
                self.current_media_list = self.download_all_media(schedule_data.get("media", []))
                self.current_index = 0
                self.current_media_item = None
                
                self.player_manager.current_playing_schedule_id = current_schedule_id
                self.player_manager.force_content_refresh = False
                
                if current_schedule:
                    schedule_name = current_schedule.get("name", "Unknown")
                    print(f"📺 Loaded schedule: {schedule_name}")
                    print(f"🎬 Media items: {len(self.current_media_list)}")
                    self.player_manager.send_status("playing" if self.current_media_list else "idle")
                else:
                    self.player_manager.send_status("idle")
            else:
                print("✅ Schedule checked. CURRENTLY PLAYING schedule unchanged, no restart needed.")
            self.last_schedule_check = now
    
    def display_current_media(self):
        now = time.time()
        should_move_to_next = False
        
        if not self.current_media_item:
            should_move_to_next = True
        elif self.current_media_item.get('type') == 'video':
            if self.player_manager.vlc_player:
                try:
                    state = self.player_manager.vlc_player.get_state()
                    if state in [vlc.State.Ended, vlc.State.Error]:
                        should_move_to_next = True
                except: should_move_to_next = True
        else:
            duration = self.current_media_item.get('playlistDuration') or self.current_media_item.get('duration', 5)
            if now - self.media_start_time >= duration:
                should_move_to_next = True
        
        if should_move_to_next and self.current_media_list:
            if self.current_index >= len(self.current_media_list):
                self.current_index = 0
            
            self.current_media_item = self.current_media_list[self.current_index]
            media_type = self.current_media_item.get('type')
            
            print(f"🎬 Loading {self.current_index + 1}/{len(self.current_media_list)}: {self.current_media_item.get('name', 'N/A')} ({media_type})")
            
            success = False
            if media_type == 'image': success = self.display_image(self.current_media_item)
            elif media_type == 'text': success = self.display_text(self.current_media_item.get('url', ''))
            elif media_type == 'video': success = self.display_video(self.current_media_item)
            
            if success:
                self.media_start_time = now
                self.player_manager.push_playback_state(self.current_media_item, 'playing')
                self.current_index += 1
            else:
                print(f"❌ Failed to display {self.current_media_item.get('name', 'Unknown')}")
                self.current_media_item = None
                self.current_index += 1
    
    def show_waiting_screen(self):
        if not self.current_media_list and (time.time() - self.last_schedule_check > 2):
            self.player_manager.push_playback_state(None, 'idle')
            self.display_text("Waiting for content from CMS...")
    
    def main_loop(self):
        try:
            if self.is_destroying:
                return
            
            self.update_ticker()
            self.check_schedule()
            
            if self.current_media_list:
                self.display_current_media()
            else:
                self.show_waiting_screen()
            
            self.ensure_overlays_visible()
            self.player_manager.load_logo()
            
            now = time.time()
            if now - self.last_heartbeat > 60:
                self.player_manager.send_heartbeat()
                self.last_heartbeat = now

            if self.current_media_item and self.current_media_item.get('type') == 'video' and self.player_manager.vlc_player:
                try:
                    vlc_time = self.player_manager.vlc_player.get_time() / 1000.0
                    if vlc_time > 0:
                        self.player_manager.push_playback_state(self.current_media_item, 'playing', vlc_time)
                except Exception:
                    pass
            
            if not self.is_destroying:
                self.root.after(100, self.main_loop)
        except Exception as e:
            print(f"Error in main loop: {e}")
            if not self.is_destroying:
                self.root.after(2000, self.main_loop)
    
    def start(self):
        if not self.connect_to_cms():
            print("⚠️ CMS connection failed - continuing with default overlays")
        
        print(f"🚀 Starting Ultra Player for Player ID: {self.player_manager.player_id}")
        
        self.root.after(100, self.main_loop)
        
        try:
            self.root.mainloop()
        except Exception as e:
            print(f"Mainloop error: {e}")
    
    def stop(self):
        if self.is_destroying: return
        self.is_destroying = True
        print("🛑 Stopping Ultra Player...")
        
        try:
            self.stop_ticker()
            if self.player_manager.vlc_player:
                try: self.player_manager.vlc_player.stop()
                except: pass
            
            self.player_manager.send_status("offline")
            self.player_manager.shutdown()
            
            try: self.root.quit()
            except: pass
            try: self.root.destroy()
            except: pass
        except Exception as e:
            print(f"Error during shutdown: {e}")
        
        try: sys.exit(0)
        except: os._exit(0)

def main():
    print("🎬 ULTRA DIGITAL SIGNAGE PLAYER - HYBRID LOGO VERSION")
    print("==========================================================")
    print("✅ LOGO is now burned into content for perfect transparency.")
    print("✅ VLC handles logo overlay for videos.")
    print("✅ Pillow handles logo overlay for images and text.")
    print("✅ TICKER ALWAYS VISIBLE by default (translucent background)")


if __name__ == "__main__":
    app = UltraDisplayApp()
    
    try:
        app.start()
    except KeyboardInterrupt:
        print("\n🛑 Interrupted by user")
    except Exception as e:
        print(f"❌ Fatal error: {e}")
    finally:
        app.stop()