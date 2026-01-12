const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  'Referer': 'https://www.facebook.com/',
  'DNT': '1'
};

// Strip byte range params from URL to get full file
function cleanUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('bytestart');
    parsed.searchParams.delete('byteend');
    return parsed.toString();
  } catch {
    return url;
  }
}

// Detect if URL is video or audio based on efg parameter
function detectStreamType(url) {
  try {
    const parsed = new URL(url);
    const efg = parsed.searchParams.get('efg');
    if (efg) {
      const decoded = Buffer.from(efg, 'base64').toString('utf8');
      // Check vencode_tag for "_video" or "_audio" suffix (more specific than just "video"/"audio")
      if (decoded.includes('_audio')) return 'audio';
      if (decoded.includes('_video')) return 'video';
      // Fallback to original check
      if (decoded.includes('audio')) return 'audio';
      if (decoded.includes('video')) return 'video';
    }
  } catch {}
  return 'unknown';
}

// Sort URLs into video/audio
function categorizeUrls(url1, url2) {
  const type1 = detectStreamType(url1);
  const type2 = detectStreamType(url2);

  if (type1 === 'video' && type2 === 'audio') {
    return { videoUrl: url1, audioUrl: url2 };
  } else if (type1 === 'audio' && type2 === 'video') {
    return { videoUrl: url2, audioUrl: url1 };
  }
  return null; // Could not auto-detect
}

// Download file with progress callback
async function downloadFile(url, outputPath, onProgress) {
  const cleanedUrl = cleanUrl(url);

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const headRes = await axios.head(cleanedUrl, { headers: HEADERS });
  const totalSize = parseInt(headRes.headers['content-length'], 10);

  const writer = fs.createWriteStream(outputPath);
  let downloaded = 0;

  const response = await axios({
    method: 'GET',
    url: cleanedUrl,
    headers: HEADERS,
    responseType: 'stream'
  });

  response.data.on('data', (chunk) => {
    downloaded += chunk.length;
    if (onProgress) {
      onProgress(downloaded, totalSize);
    }
  });

  response.data.on('error', (err) => {
    console.error('[Download] Stream error:', err);
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      resolve({ path: outputPath, size: totalSize });
    });
    writer.on('error', (err) => {
      console.error('[Download] Write error:', err);
      reject(err);
    });
  });
}

// Merge video + audio with ffmpeg
async function mergeStreams(videoPath, audioPath, outputPath) {
  return new Promise((resolve, reject) => {
    let stderr = '';

    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-i', audioPath,
      '-c', 'copy',
      '-map', '0:v:0',
      '-map', '1:a:0',
      outputPath,
      '-y'
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        console.error('ffmpeg stderr:', stderr);
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    ffmpeg.on('error', (err) => {
      console.error('ffmpeg spawn error:', err);
      reject(err);
    });
  });
}

// Cleanup temp files
function cleanup(files) {
  files.forEach(f => {
    try { fs.unlinkSync(f); } catch {}
  });
}

// Main download function
async function downloadFacebookVideo(url1, url2, outputPath, callbacks = {}) {
  const { onVideoProgress, onAudioProgress, onStatus } = callbacks;

  // Categorize URLs
  let videoUrl, audioUrl;
  const categorized = categorizeUrls(url1, url2);

  if (categorized) {
    videoUrl = categorized.videoUrl;
    audioUrl = categorized.audioUrl;
  } else {
    // Default: assume first is video
    videoUrl = url1;
    audioUrl = url2;
  }

  const tempVideo = path.join(path.dirname(outputPath), `.temp_video_${Date.now()}.mp4`);
  const tempAudio = path.join(path.dirname(outputPath), `.temp_audio_${Date.now()}.mp4`);

  try {
    if (onStatus) onStatus('downloading_video');
    await downloadFile(videoUrl, tempVideo, onVideoProgress);

    if (onStatus) onStatus('downloading_audio');
    await downloadFile(audioUrl, tempAudio, onAudioProgress);

    if (onStatus) onStatus('merging');
    await mergeStreams(tempVideo, tempAudio, outputPath);

    cleanup([tempVideo, tempAudio]);

    const stats = fs.statSync(outputPath);

    if (onStatus) onStatus('complete');

    return {
      success: true,
      path: outputPath,
      size: stats.size
    };
  } catch (error) {
    cleanup([tempVideo, tempAudio]);
    throw error;
  }
}

module.exports = {
  downloadFacebookVideo,
  downloadFile,
  mergeStreams,
  detectStreamType,
  categorizeUrls,
  cleanUrl,
  cleanup,
  HEADERS
};
