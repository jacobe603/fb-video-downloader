const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { downloadFacebookVideo, detectStreamType, categorizeUrls } = require('./lib/downloader');

const DOWNLOADS_DIR = path.join(process.cwd(), 'downloads');

// Ensure downloads directory exists
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// Active downloads for progress tracking
const activeDownloads = new Map();

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Facebook Video Downloader</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: rgba(255,255,255,0.05);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 40px;
      width: 100%;
      max-width: 600px;
      box-shadow: 0 25px 50px rgba(0,0,0,0.3);
    }
    h1 {
      color: #fff;
      font-size: 28px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    h1::before {
      content: '';
      width: 40px;
      height: 40px;
      background: #1877f2;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .subtitle {
      color: rgba(255,255,255,0.6);
      margin-bottom: 30px;
      font-size: 14px;
    }
    label {
      color: rgba(255,255,255,0.8);
      font-size: 14px;
      display: block;
      margin-bottom: 8px;
    }
    textarea {
      width: 100%;
      padding: 14px;
      border: 2px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      background: rgba(0,0,0,0.3);
      color: #fff;
      font-size: 13px;
      font-family: monospace;
      resize: vertical;
      min-height: 80px;
      margin-bottom: 20px;
      transition: border-color 0.3s;
    }
    textarea:focus {
      outline: none;
      border-color: #1877f2;
    }
    textarea::placeholder { color: rgba(255,255,255,0.3); }
    input[type="text"] {
      width: 100%;
      padding: 14px;
      border: 2px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      background: rgba(0,0,0,0.3);
      color: #fff;
      font-size: 14px;
      margin-bottom: 20px;
    }
    input[type="text"]:focus {
      outline: none;
      border-color: #1877f2;
    }
    button {
      width: 100%;
      padding: 16px;
      background: #1877f2;
      border: none;
      border-radius: 10px;
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
    }
    button:hover { background: #166fe5; transform: translateY(-2px); }
    button:disabled {
      background: #555;
      cursor: not-allowed;
      transform: none;
    }
    .progress-container {
      margin-top: 20px;
      display: none;
    }
    .progress-container.active { display: block; }
    .progress-item {
      margin-bottom: 15px;
    }
    .progress-label {
      display: flex;
      justify-content: space-between;
      color: rgba(255,255,255,0.8);
      font-size: 13px;
      margin-bottom: 6px;
    }
    .progress-bar {
      height: 8px;
      background: rgba(255,255,255,0.1);
      border-radius: 4px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #1877f2, #42b883);
      border-radius: 4px;
      width: 0%;
      transition: width 0.3s;
    }
    .status {
      text-align: center;
      padding: 15px;
      border-radius: 10px;
      margin-top: 20px;
      display: none;
    }
    .status.success {
      display: block;
      background: rgba(66, 184, 131, 0.2);
      color: #42b883;
    }
    .status.error {
      display: block;
      background: rgba(255, 82, 82, 0.2);
      color: #ff5252;
    }
    .download-link {
      display: inline-block;
      margin-top: 10px;
      padding: 10px 20px;
      background: #42b883;
      color: #fff;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 500;
    }
    .tip {
      background: rgba(255,255,255,0.05);
      padding: 15px;
      border-radius: 10px;
      margin-bottom: 25px;
      font-size: 13px;
      color: rgba(255,255,255,0.7);
      line-height: 1.5;
    }
    .tip strong { color: #1877f2; }
  </style>
</head>
<body>
  <div class="container">
    <h1>FB Video Downloader</h1>
    <p class="subtitle">Download Facebook videos by providing DASH stream URLs</p>

    <div class="tip">
      <strong>How to get stream URLs:</strong><br>
      1. Open DevTools (F12) → Network tab → Filter by <code>video.</code><br>
      2. Play the Facebook video for a few seconds<br>
      3. Find TWO different .mp4 URLs from <code>video.*.fbcdn.net</code>:<br>
      &nbsp;&nbsp;&nbsp;• <strong>VIDEO</strong>: Large size (100+ MB), path has <code>/m366/</code><br>
      &nbsp;&nbsp;&nbsp;• <strong>AUDIO</strong>: Small size (5-20 MB), path has <code>/m311/</code><br>
      4. Right-click each → Copy → Copy URL
    </div>

    <form id="downloadForm">
      <label>Stream URL 1 (video or audio)</label>
      <textarea id="url1" placeholder="Paste first fbcdn.net stream URL..." required></textarea>

      <label>Stream URL 2 (video or audio)</label>
      <textarea id="url2" placeholder="Paste second fbcdn.net stream URL..." required></textarea>

      <label>Output filename (optional)</label>
      <input type="text" id="filename" placeholder="my_video.mp4">

      <button type="submit" id="submitBtn">Download & Merge</button>
    </form>

    <div class="progress-container" id="progress">
      <div class="progress-item">
        <div class="progress-label">
          <span>Video stream</span>
          <span id="videoPercent">0%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" id="videoProgress"></div>
        </div>
      </div>
      <div class="progress-item">
        <div class="progress-label">
          <span>Audio stream</span>
          <span id="audioPercent">0%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" id="audioProgress"></div>
        </div>
      </div>
      <div class="progress-item">
        <div class="progress-label">
          <span id="statusText">Preparing...</span>
        </div>
      </div>
    </div>

    <div class="status" id="status"></div>
  </div>

  <script>
    const form = document.getElementById('downloadForm');
    const submitBtn = document.getElementById('submitBtn');
    const progressDiv = document.getElementById('progress');
    const statusDiv = document.getElementById('status');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const url1 = document.getElementById('url1').value.trim();
      const url2 = document.getElementById('url2').value.trim();
      const filename = document.getElementById('filename').value.trim() || 'facebook_video.mp4';

      submitBtn.disabled = true;
      submitBtn.textContent = 'Processing...';
      progressDiv.classList.add('active');
      statusDiv.className = 'status';
      statusDiv.style.display = 'none';

      try {
        const res = await fetch('/api/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url1, url2, filename })
        });

        const data = await res.json();

        if (data.id) {
          pollProgress(data.id, filename);
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (err) {
        statusDiv.className = 'status error';
        statusDiv.innerHTML = 'Error: ' + err.message;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Download & Merge';
      }
    });

    async function pollProgress(id, filename) {
      const interval = setInterval(async () => {
        try {
          const res = await fetch('/api/progress/' + id);
          const data = await res.json();

          document.getElementById('videoProgress').style.width = data.videoProgress + '%';
          document.getElementById('videoPercent').textContent = data.videoProgress + '%';
          document.getElementById('audioProgress').style.width = data.audioProgress + '%';
          document.getElementById('audioPercent').textContent = data.audioProgress + '%';
          document.getElementById('statusText').textContent = data.statusText || 'Processing...';

          if (data.status === 'complete') {
            clearInterval(interval);
            statusDiv.className = 'status success';
            statusDiv.innerHTML = 'Download complete! (' + (data.size / 1024 / 1024).toFixed(1) + ' MB)<br>' +
              '<a class="download-link" href="/api/file/' + id + '/' + encodeURIComponent(filename) + '" download>Save File</a>';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Download & Merge';
          } else if (data.status === 'error') {
            clearInterval(interval);
            statusDiv.className = 'status error';
            statusDiv.innerHTML = 'Error: ' + data.error;
            submitBtn.disabled = false;
            submitBtn.textContent = 'Download & Merge';
          }
        } catch (err) {
          clearInterval(interval);
          statusDiv.className = 'status error';
          statusDiv.innerHTML = 'Connection error';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Download & Merge';
        }
      }, 500);
    }
  </script>
</body>
</html>`;

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

async function handleDownload(req, res) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { url1, url2, filename } = JSON.parse(body);

      // Validate that we have both video and audio streams
      const type1 = detectStreamType(url1);
      const type2 = detectStreamType(url2);

      console.log(`[Validate] URL1 detected as: ${type1}`);
      console.log(`[Validate] URL2 detected as: ${type2}`);

      if (type1 === type2 && type1 !== 'unknown') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: `Both URLs are ${type1} streams! You need one VIDEO and one AUDIO URL. Look for a smaller file (~5-20 MB) with /m311/ in the path for audio.`
        }));
        return;
      }

      if (type1 === 'unknown' && type2 === 'unknown') {
        console.log('[Validate] Warning: Could not detect stream types, proceeding anyway');
      }

      const id = generateId();
      // Ensure filename has .mp4 extension and add timestamp
      let baseName = filename || 'video';
      if (baseName.toLowerCase().endsWith('.mp4')) {
        baseName = baseName.slice(0, -4);
      }
      const now = new Date();
      const timestamp = now.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '');
      const safeFilename = `${baseName}_${timestamp}.mp4`;
      const outputPath = path.join(DOWNLOADS_DIR, safeFilename);

      activeDownloads.set(id, {
        status: 'starting',
        videoProgress: 0,
        audioProgress: 0,
        statusText: 'Starting download...',
        outputPath
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id }));

      // Start download in background
      downloadFacebookVideo(url1, url2, outputPath, {
        onVideoProgress: (downloaded, total) => {
          const dl = activeDownloads.get(id);
          if (dl) {
            dl.videoProgress = Math.round((downloaded / total) * 100);
            dl.statusText = 'Downloading video stream...';
          }
        },
        onAudioProgress: (downloaded, total) => {
          const dl = activeDownloads.get(id);
          if (dl) {
            dl.audioProgress = Math.round((downloaded / total) * 100);
            dl.statusText = 'Downloading audio stream...';
          }
        },
        onStatus: (status) => {
          const dl = activeDownloads.get(id);
          if (dl) {
            if (status === 'merging') dl.statusText = 'Merging streams with ffmpeg...';
            if (status === 'complete') {
              dl.status = 'complete';
              dl.statusText = 'Complete!';
              dl.size = fs.statSync(outputPath).size;
            }
          }
        }
      }).catch(err => {
        const dl = activeDownloads.get(id);
        if (dl) {
          dl.status = 'error';
          dl.error = err.message;
        }
      });

    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

function handleProgress(req, res, id) {
  const dl = activeDownloads.get(id);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  if (dl) {
    res.end(JSON.stringify(dl));
  } else {
    res.end(JSON.stringify({ status: 'not_found' }));
  }
}

function handleFile(req, res, id, filename) {
  const dl = activeDownloads.get(id);
  if (dl && dl.outputPath && fs.existsSync(dl.outputPath)) {
    const stat = fs.statSync(dl.outputPath);
    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Length': stat.size,
      'Content-Disposition': `attachment; filename="${filename}"`
    });
    fs.createReadStream(dl.outputPath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('File not found');
  }
}

module.exports = function startServer(port = 3000) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);

    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(HTML);
    } else if (req.method === 'POST' && url.pathname === '/api/download') {
      handleDownload(req, res);
    } else if (req.method === 'GET' && url.pathname.startsWith('/api/progress/')) {
      const id = url.pathname.split('/')[3];
      handleProgress(req, res, id);
    } else if (req.method === 'GET' && url.pathname.startsWith('/api/file/')) {
      const parts = url.pathname.split('/');
      const id = parts[3];
      const filename = decodeURIComponent(parts[4] || 'video.mp4');
      handleFile(req, res, id, filename);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(port, () => {
    console.log(`\n  Facebook Video Downloader - Web Interface`);
    console.log(`  ─────────────────────────────────────────`);
    console.log(`  Server running at: http://localhost:${port}`);
    console.log(`  Downloads saved to: ${DOWNLOADS_DIR}\n`);
  });
};
