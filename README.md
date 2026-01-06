# Facebook Video Downloader

A simple tool to download Facebook videos by merging DASH video + audio streams.

## Why This Exists

Facebook uses DASH streaming which splits video and audio into separate streams. This tool downloads both streams and merges them with ffmpeg.

## Requirements

- Node.js 16+
- ffmpeg (must be in PATH)

## Installation

```bash
git clone https://github.com/jacobe603/fb-video-downloader.git
cd fb-video-downloader
npm install
```

## Usage

### Web Interface (Recommended)

```bash
node index.js --web
# Opens at http://localhost:3000
```

### Interactive CLI

```bash
node index.js
# or
npm start
```

### Command Line

```bash
node index.js -v "VIDEO_URL" -a "AUDIO_URL" -o output.mp4
```

## How to Get Stream URLs

1. Open the Facebook video in your browser
2. Open DevTools (F12) → **Network** tab
3. In the filter box, type `video.` to filter requests
4. Play the video for a few seconds
5. Find **TWO different** `.mp4` URLs from `video.*.fbcdn.net`:

| Stream | How to Identify |
|--------|-----------------|
| **VIDEO** | Large size (100+ MB), URL path contains `/m366/` |
| **AUDIO** | Small size (5-20 MB), URL path contains `/m311/` |

6. Right-click each → **Copy** → **Copy URL**

> **Tip:** Sort by the Size column to easily distinguish video (large) from audio (small).

The tool auto-detects which URL is video vs audio based on the `efg` parameter, but you need one of each type!

## Options

| Flag | Description |
|------|-------------|
| `-v, --video` | Video stream URL |
| `-a, --audio` | Audio stream URL |
| `-o, --output` | Output filename |
| `--web` | Start web interface |
| `--port` | Web server port (default: 3000) |
| `-h, --help` | Show help |

## Features

- Auto-detects video vs audio streams from URL metadata
- Validates that you have one video and one audio URL before downloading
- Progress bars for download status
- Automatic `.mp4` extension handling
- Timestamped output filenames to prevent overwrites
- Web UI and CLI interfaces

## How It Works

1. Parses the `efg` parameter (base64-encoded JSON) from each URL
2. Identifies stream type from `vencode_tag` field (`_video` or `_audio` suffix)
3. Downloads both streams in parallel with progress tracking
4. Merges streams using ffmpeg with stream copy (no re-encoding)
5. Cleans up temporary files

## License

MIT
