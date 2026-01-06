# Facebook Video Downloader

A simple tool to download Facebook videos by merging DASH video + audio streams.

## Why This Exists

Facebook uses DASH streaming which splits video and audio into separate streams. This tool downloads both streams and merges them with ffmpeg.

## Requirements

- Node.js 16+
- ffmpeg (must be in PATH)

## Installation

```bash
git clone https://github.com/yourusername/fb-video-downloader.git
cd fb-video-downloader
npm install
```

## Usage

### Interactive TUI

```bash
node index.js
# or
npm start
```

### Web Interface

```bash
node index.js --web
# Opens at http://localhost:3000
```

### Command Line

```bash
node index.js -v "VIDEO_URL" -a "AUDIO_URL" -o output.mp4
```

## How to Get Stream URLs

1. Open the Facebook video in your browser
2. Open DevTools (F12) → Network tab
3. Filter requests by `.mp4`
4. Play the video
5. Look for two `fbcdn.net` URLs:
   - One with `video` in the encoded `efg` parameter
   - One with `audio` in the encoded `efg` parameter
6. Right-click → Copy → Copy URL (or Copy as cURL)

The tool auto-detects which URL is video vs audio based on the `efg` parameter.

## Options

| Flag | Description |
|------|-------------|
| `-v, --video` | Video stream URL |
| `-a, --audio` | Audio stream URL |
| `-o, --output` | Output filename |
| `--web` | Start web interface |
| `--port` | Web server port (default: 3000) |
| `-h, --help` | Show help |

## License

MIT
