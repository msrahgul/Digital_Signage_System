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

# Configuration
# IMPORTANT: Replace "YOUR_SERVER_IP" with the actual IP address of your backend server.
# For example: "http://192.168.1.100:4000/"
BACKEND_URL = "http://10.52.54.220:4000/"
WS_URL = f"ws://{BACKEND_URL.split('//')[1].split(':')[0]}:4000"

CACHE_DIR = "media_cache"
CONFIG_FILE = "player_config.json"
SCHEDULE_CACHE_FILE = "current_schedule.json"
DEVICE_INFO_FILE = "device_info.json"
LOGO_PATH = "KIDS Logo.png"

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
            vlc_args = [
                '--intf', 'dummy',
                '--no-video-title-show',
                '--quiet',
                '--avcodec-hw=any',
                '--network-caching=1500',
                '--file-caching=1500'
            ]

            if os.path.exists(logo_path):
                print("✅ Logo file found. Enabling video overlay.")
                vlc_args.extend([
                    '--logo-file=' + logo_path,
                    '--logo-position=10',        # 10 = Top-Right
                    '--logo-opacity=255',        # 255 = Fully opaque
                    '--logo-x=20',               # Padding from the right edge
                    '--logo-y=20'                # Padding from the top edge
                ])
            else:
                print(f"⚠️ Logo file not found at {logo_path}, video overlay will be disabled.")

            self.vlc_instance = vlc.Instance(vlc_args)
            if self.vlc_instance:
                print("✅ VLC initialized successfully.")
            else:
                print("❌ VLC initialization failed.")
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
            # Use Tkinter for reliable, cross-platform screen size detection
            root = tk.Tk()
            root.withdraw() # Hide the main window
            device_info['screen_width'] = root.winfo_screenwidth()
            device_info['screen_height'] = root.winfo_screenheight()
            root.destroy()
        except Exception as e:
            print(f"Could not detect display info using Tkinter: {e}")


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
            print("🚀 INSTANT CONTENT UPDATE RECEIVED!")
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
        relative_url = media_item.get('url', '') if media_item else ''

        state = {
            'playerId': self.player_id,
            'status': status,
            'mediaType': media_type,
            'mediaUrl': relative_url,
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

        self.TICKER_HEIGHT = 60
        
        self.display_frame = tk.Frame(self.root, bg='black', highlightthickness=0)
        self.display_frame.pack(fill='both', expand=True)
        
        self.content_label = tk.Label(self.display_frame, bg='black', highlightthickness=0)
        self.video_frame = tk.Frame(self.display_frame, bg='black', highlightthickness=0)
        
        self.ticker_frame = tk.Frame(self.root, bg='black', height=self.TICKER_HEIGHT, highlightthickness=0)
        self.ticker_frame.pack(side='bottom', fill='x')
        self.ticker_frame.pack_propagate(False)
        
        self.ticker_canvas = tk.Canvas(self.ticker_frame, bg='black', highlightthickness=0, height=self.TICKER_HEIGHT)
        self.ticker_canvas.pack(fill='both', expand=True)
        
        self.current_media_list = []
        self.current_index = 0
        self.current_media_item = None
        self.media_start_time = 0
        self.last_schedule_check = 0
        self.last_heartbeat = 0
        
        self.image_cache = {}
        self.image_preload_thread = None
        
        # Ticker Threading
        self.ticker_thread = None
        self.ticker_stop_event = threading.Event()
        self.ticker_coords_queue = queue.Queue()
        self.ticker_text_id = None
        
        self.root.bind('<Escape>', self.on_escape)
        self.root.bind('<KeyPress>', self.on_key_press)
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        
        self.root.after(100, self.create_default_overlays)
        
        print(f"🚀 Ultra Player initialized: {self.screen_width}x{self.screen_height}")
    
    def create_default_overlays(self):
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
        if path.startswith(('http://', 'https://')):
            return path
        return f"{BACKEND_URL.rstrip('/')}/{path.lstrip('/')}"
    
    def download_media_file(self, media_item):
        try:
            url = self.make_full_url(media_item['url'])
            filename = f"{media_item['id']}_{os.path.basename(media_item['url'])}"
            local_path = os.path.join(CACHE_DIR, filename)
            
            if os.path.exists(local_path):
                return local_path
            
            print(f"📥 Downloading {media_item.get('name', 'Unknown')}...")
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
                if 'h265_url' in media_item and media_item['h265_url']:
                    media_item['url'] = media_item['h265_url']
                
                local_path = self.download_media_file(media_item)
                if local_path:
                    media_item['local_path'] = local_path
                    local_media.append(media_item)
            else:
                local_media.append(media_item)
        return local_media
        
    def preload_images(self, media_list):
        def _preload():
            for media_item in media_list:
                if self.is_destroying:
                    break
                if media_item.get('type') == 'image' and media_item.get('local_path') not in self.image_cache:
                    try:
                        self.process_image(media_item)
                    except Exception as e:
                        print(f"Error preloading image {media_item.get('name')}: {e}")
        
        if self.image_preload_thread and self.image_preload_thread.is_alive():
            self.image_preload_thread.join()
            
        self.image_preload_thread = threading.Thread(target=_preload)
        self.image_preload_thread.daemon = True
        self.image_preload_thread.start()

    def process_image(self, media_item):
        image_path = media_item.get('local_path')
        if not image_path or not os.path.exists(image_path):
            return None

        content_width = self.screen_width
        content_height = self.screen_height - self.TICKER_HEIGHT

        with Image.open(image_path) as img:
            img = img.convert('RGB')
            img_ratio = img.width / img.height
            content_ratio = content_width / content_height
            if img_ratio > content_ratio:
                new_width = content_width
                new_height = int(content_width / img_ratio)
            else:
                new_height = content_height
                new_width = int(content_height * img_ratio)
            
            img_resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            final_image = Image.new('RGB', (content_width, content_height), 'black')
            paste_x = (content_width - new_width) // 2
            paste_y = (content_height - new_height) // 2
            final_image.paste(img_resized, (paste_x, paste_y))
            
            if self.player_manager.logo:
                logo = self.player_manager.logo
                logo_x = content_width - logo.width - 20
                logo_y = 20
                final_image.paste(logo, (logo_x, logo_y), mask=logo)
            
            photo = ImageTk.PhotoImage(final_image)
            self.image_cache[image_path] = photo
            return photo
    
    def display_image(self, media_item):
        image_path = media_item.get('local_path')
        photo = self.image_cache.get(image_path)
        
        if not photo:
            photo = self.process_image(media_item)
        
        if photo:
            self.video_frame.pack_forget()
            self.content_label.configure(image=photo, text="")
            self.content_label.image = photo
            self.content_label.pack(fill='both', expand=True)
            self.root.after(50, self.ensure_overlays_visible)
            return True
        return False
    
    def display_text(self, text):
        try:
            content_width = self.screen_width
            content_height = self.screen_height - self.TICKER_HEIGHT

            final_image = Image.new('RGB', (content_width, content_height), 'black')
            draw = ImageDraw.Draw(final_image)
            
            font_paths = [
                "arial.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
            ]
            
            try:
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
                
                if text_width < content_width * 0.9:
                    current_line = test_line
                else:
                    lines.append(current_line)
                    current_line = word
            if current_line:
                lines.append(current_line)
            
            line_height = font_size + 10
            total_height = len(lines) * line_height
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
    
    def _ticker_thread_func(self):
        """The function that runs in a separate thread to calculate ticker coordinates."""
        try:
            ticker_text = self.player_manager.ticker_text
            font_size = max(16, int(self.screen_height * 0.03))
            
            # This is a bit of a hack to get text width without a canvas in a thread
            text_width = len(ticker_text) * (font_size // 2)

            x_pos = self.screen_width + 50
            
            while not self.ticker_stop_event.is_set():
                speed = max(1, int(self.player_manager.ticker_speed))
                x_pos -= speed
                
                if x_pos <= -(text_width + 100):
                    x_pos = self.screen_width + 50
                
                self.ticker_coords_queue.put(x_pos)
                time.sleep(0.016) # ~60 FPS
        except Exception as e:
            print(f"Error in ticker thread: {e}")

    def _update_ticker_canvas(self):
        """Safely updates the ticker canvas from the main thread."""
        try:
            while not self.ticker_coords_queue.empty():
                x_pos = self.ticker_coords_queue.get_nowait()
                if self.ticker_text_id:
                    self.ticker_canvas.coords(self.ticker_text_id, x_pos, self.TICKER_HEIGHT // 2)
        except queue.Empty:
            pass
        except Exception as e:
            print(f"Error updating ticker canvas: {e}")
        
        if not self.is_destroying:
            self.root.after(16, self._update_ticker_canvas)

    def start_ticker(self):
        if self.ticker_thread and self.ticker_thread.is_alive():
            self.ticker_stop_event.set()
            self.ticker_thread.join()
        
        # Clear previous ticker items from canvas
        self.ticker_canvas.delete("all")
        
        # Setup the canvas items in the main thread
        bg_photo = self.create_translucent_background(self.screen_width, self.TICKER_HEIGHT, alpha=128)
        self.ticker_canvas.create_image(0, 0, anchor='nw', image=bg_photo, tags='ticker_bg')
        self.ticker_canvas.image = bg_photo # Keep a reference

        font_size = max(16, int(self.screen_height * 0.03))
        self.ticker_text_id = self.ticker_canvas.create_text(
            self.screen_width, self.TICKER_HEIGHT // 2,
            text=self.player_manager.ticker_text,
            fill='white', font=("Arial", font_size, "bold"), anchor='w'
        )
        
        # Start the background thread for calculations
        self.ticker_stop_event.clear()
        self.ticker_thread = threading.Thread(target=self._ticker_thread_func)
        self.ticker_thread.daemon = True
        self.ticker_thread.start()
        
        # Start the GUI update loop
        self.root.after(16, self._update_ticker_canvas)
        
        print(f"🎪 Ticker started: '{self.player_manager.ticker_text}'")

    def stop_ticker(self):
        self.ticker_stop_event.set()
        if self.ticker_thread and self.ticker_thread.is_alive():
            self.ticker_thread.join()
        print("🛑 Ticker thread stopped.")

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
        
        # Only check if 5 seconds have passed OR an instant update was triggered
        if now - self.last_schedule_check > 5 or instant_update_triggered:
            schedule_data = self.fetch_schedule()
            if not schedule_data:
                self.last_schedule_check = now
                return

            # --- Create unique hashes for the new content and ticker ---
            media_list = schedule_data.get("media", [])
            # A stable representation of media items for accurate comparison
            media_identifiers = [(item.get('id'), item.get('playlistDuration')) for item in media_list]
            new_content_hash = hashlib.md5(json.dumps(media_identifiers, sort_keys=True).encode()).hexdigest()

            ticker_text = schedule_data.get("tickerText", "") or self.player_manager.ticker_text
            ticker_speed = schedule_data.get("tickerSpeed", 2)
            new_ticker_hash = hashlib.md5(f"{ticker_text}{ticker_speed}".encode()).hexdigest()

            # --- Compare hashes and decide what to update ---

            # 1. Check for Ticker updates
            if new_ticker_hash != self.player_manager.last_ticker_hash:
                print("🎯 Ticker content has changed. Updating ticker only.")
                self.player_manager.ticker_update_queue.put({
                    'text': ticker_text, 'speed': ticker_speed
                })
                self.player_manager.last_ticker_hash = new_ticker_hash

            # 2. Check for Main Content updates (full reload)
            current_schedule = schedule_data.get("currentSchedule", {})
            current_schedule_id = current_schedule.get("id", "") if current_schedule else ""
            
            content_changed = new_content_hash != self.player_manager.last_content_hash
            schedule_id_changed = current_schedule_id != self.player_manager.current_playing_schedule_id

            if content_changed or schedule_id_changed or self.player_manager.force_content_refresh:
                reason = "New Schedule Assigned" if schedule_id_changed else "Media Content Updated"
                print(f"🔄 Full content refresh triggered. Reason: {reason}.")
                
                self.player_manager.send_status("downloading")
                if self.player_manager.vlc_player:
                    try: self.player_manager.vlc_player.stop()
                    except: pass
                
                self.image_cache.clear()
                self.current_media_list = self.download_all_media(media_list)
                self.current_index = 0
                self.current_media_item = None
                
                self.preload_images(self.current_media_list)
                
                # Update hashes and IDs after successful reload
                self.player_manager.current_playing_schedule_id = current_schedule_id
                self.player_manager.last_content_hash = new_content_hash
                self.player_manager.force_content_refresh = False
                
                if current_schedule:
                    schedule_name = current_schedule.get("name", "Unknown")
                    print(f"📺 Loaded schedule: {schedule_name} with {len(self.current_media_list)} items.")
                    self.player_manager.send_status("playing" if self.current_media_list else "idle")
                else:
                    self.player_manager.send_status("idle")

            elif instant_update_triggered:
                 print("✅ Instant update checked. No effective changes to content or ticker found.")

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
            self.display_text("Waiting for content ...")
    
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