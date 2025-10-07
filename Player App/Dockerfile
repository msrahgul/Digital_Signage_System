FROM python:3.11-slim

# Install dependencies including VLC and audio/video libraries
RUN apt-get update && apt-get install -y \
    ffmpeg libsm6 libxext6 libxrender-dev libglib2.0-0 libgtk-3-0 \
    libavcodec-dev libavformat-dev libswscale-dev libv4l-dev x11-utils \
    pulseaudio alsa-utils vlc python3-tk \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . ./

# Install Python dependencies with fixed versions
RUN pip install --no-cache-dir \
    opencv-python-headless==4.8.* \
    pygame==2.5.* \
    requests==2.31.* \
    websocket-client==1.6.* \
    numpy==1.24.* \
    Pillow==10.0.* \
    python-vlc \
    yt-dlp

# Create media cache directory
RUN mkdir -p media_cache

# Set environment variables for X11 display and audio
ENV SDL_AUDIODRIVER=alsa
ENV DISPLAY=:0

CMD ["python", "-u", "playerapp.py"]
