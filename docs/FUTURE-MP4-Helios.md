# MP4-Helios: Video Highlight Reel Generator

> Future development concept for automated highlight reel creation from clock-time based markers.

## Problem Statement

Sports videos (games, practices) are recorded without embedded timestamps. Later, someone reviews the footage and logs highlight moments using **real-world clock times** (e.g., "great play at 11:48:00am").

To create highlight reels, we need to:
1. Map clock times to video timestamps
2. Extract those segments from the video
3. Optionally combine them into a single highlight reel

## Proposed Solution

### Input Requirements

1. **Video file** (MP4)
2. **Sync point** - A reference mapping video time to clock time
   - Example: `38s = 11:48:00` (at 38 seconds into the video, the clock read 11:48:00am)
3. **CSV file** with highlights
   ```csv
   start_time,end_time,description
   11:48:00,11:49:31,Goal scored
   12:15:45,12:16:30,Great save
   13:02:00,13:02:45,Penalty shot
   ```

### Processing Logic

```
For each CSV row:
  1. Parse clock-based start/end times
  2. Convert to video timestamps using sync point:
     video_time = clock_time - sync_clock + sync_video
  3. Add padding (default ±5 seconds)
  4. Validate timestamps are within video duration
  5. Extract clip using ffmpeg (stream copy, no re-encode)
```

### Output Options

1. **Individual clips** - Separate MP4 for each highlight
   - `highlight_001_Goal_scored.mp4`
   - `highlight_002_Great_save.mp4`
2. **Merged reel** - All highlights concatenated into one video
   - `highlights_combined.mp4`
3. **Both** - Individual clips + merged reel

## Technical Implementation

### Time Conversion Formula

```javascript
// Given: sync_video_sec = 38, sync_clock = "11:48:00"
// Convert clock time to video time:

function clockToVideoTime(clockTime, syncVideoSec, syncClockTime) {
  const clockSec = parseClockTime(clockTime);      // "11:48:00" → 42480
  const syncClockSec = parseClockTime(syncClockTime); // "11:48:00" → 42480
  return syncVideoSec + (clockSec - syncClockSec);
}

// Example:
// clockToVideoTime("11:49:31", 38, "11:48:00")
// = 38 + (42571 - 42480)
// = 38 + 91
// = 129 seconds into video
```

### FFmpeg Commands

**Extract single clip (stream copy, fast):**
```bash
ffmpeg -ss 33 -i input.mp4 -t 101 -c copy -avoid_negative_ts 1 clip_001.mp4
```

**Concatenate clips:**
```bash
# Create file list
echo "file 'clip_001.mp4'" > list.txt
echo "file 'clip_002.mp4'" >> list.txt

# Concatenate
ffmpeg -f concat -safe 0 -i list.txt -c copy highlights.mp4
```

## CLI Interface Design

```bash
# Basic usage
mp4-helios -i game.mp4 -c highlights.csv --sync "38=11:48:00"

# With options
mp4-helios \
  -i game.mp4 \
  -c highlights.csv \
  --sync "38=11:48:00" \
  --padding 5 \
  --output-dir ./clips \
  --merge \
  --merge-name "Game_Highlights.mp4"
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `-i, --input` | Input video file | required |
| `-c, --csv` | CSV file with timestamps | required |
| `--sync` | Sync point "video_sec=HH:MM:SS" | required |
| `--padding` | Seconds to add before/after | 5 |
| `--output-dir` | Output directory | ./highlights |
| `--clips` | Generate individual clips | true |
| `--merge` | Merge into single reel | false |
| `--merge-name` | Merged output filename | highlights.mp4 |

## CSV Format Specification

```csv
start_time,end_time,description
HH:MM:SS,HH:MM:SS,Optional text label
```

- **start_time**: Clock time when highlight begins (24hr or 12hr with AM/PM)
- **end_time**: Clock time when highlight ends
- **description**: (Optional) Label for the clip filename

### Example CSV

```csv
start_time,end_time,description
11:48:00,11:49:31,First period goal
11:52:15,11:52:45,Power play chance
12:15:00,12:16:30,Goalie save
12:45:00,12:45:30,Fight
13:02:00,13:02:45,Penalty shot goal
```

## Future Enhancements

1. **Web UI** - Drag/drop interface for video + CSV
2. **Multiple sync points** - Handle clock drift over long videos
3. **Auto-detect sync** - If video has visible clock/scoreboard, use OCR
4. **Transition effects** - Add fades between clips in merged reel
5. **Thumbnail generation** - Create preview images for each clip
6. **JSON output** - Export clip metadata for other tools

## Dependencies

- Node.js 16+
- ffmpeg (in PATH)

## Related

- Part of the `fb-video-downloader` project
- Designed for sports footage highlight creation
