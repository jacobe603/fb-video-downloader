#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const cliProgress = require('cli-progress');
const chalk = require('chalk');
const ora = require('ora');
const { downloadFacebookVideo, detectStreamType } = require('./lib/downloader');

const args = process.argv.slice(2);

// Show help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
${chalk.bold.blue('Facebook Video Downloader')}

${chalk.yellow('Usage:')}
  fbdl                           Interactive mode
  fbdl --web                     Start web interface on port 3000
  fbdl --web --port 8080         Start web interface on custom port
  fbdl -v <video_url> -a <audio_url> [-o output.mp4]

${chalk.yellow('Options:')}
  -v, --video <url>    Video stream URL
  -a, --audio <url>    Audio stream URL
  -o, --output <file>  Output filename (default: facebook_<timestamp>.mp4)
  --web                Start web interface
  --port <port>        Web server port (default: 3000)
  -h, --help           Show this help

${chalk.yellow('Examples:')}
  fbdl                           # Interactive TUI mode
  fbdl --web                     # Web interface at http://localhost:3000
  fbdl -v "https://..." -a "https://..." -o myvideo.mp4
`);
  process.exit(0);
}

// Web mode - start server and keep running
if (args.includes('--web')) {
  const portIdx = args.indexOf('--port');
  const port = portIdx !== -1 ? parseInt(args[portIdx + 1]) : 3000;
  require('./server')(port);
  // Server keeps process alive, no need for anything else
} else {

// CLI args mode
const videoIdx = args.findIndex(a => a === '-v' || a === '--video');
const audioIdx = args.findIndex(a => a === '-a' || a === '--audio');

if (videoIdx !== -1 && audioIdx !== -1) {
  // Non-interactive mode
  const videoUrl = args[videoIdx + 1];
  const audioUrl = args[audioIdx + 1];
  const outputIdx = args.findIndex(a => a === '-o' || a === '--output');
  const outputFile = outputIdx !== -1 ? args[outputIdx + 1] : `facebook_${Date.now()}.mp4`;

  runCli(videoUrl, audioUrl, outputFile);
} else {
  // Interactive mode
  runInteractive();
}

async function runCli(videoUrl, audioUrl, outputFile) {
  console.log(chalk.bold.blue('\n  Facebook Video Downloader\n'));

  const outputPath = path.resolve(outputFile);
  const multibar = new cliProgress.MultiBar({
    format: '  {label} |' + chalk.cyan('{bar}') + '| {percentage}% | {value}/{total} MB',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
    clearOnComplete: false
  });

  const videoBar = multibar.create(100, 0, { label: 'Video' });
  const audioBar = multibar.create(100, 0, { label: 'Audio' });

  try {
    const result = await downloadFacebookVideo(videoUrl, audioUrl, outputPath, {
      onVideoProgress: (downloaded, total) => {
        videoBar.setTotal(Math.round(total / 1024 / 1024));
        videoBar.update(Math.round(downloaded / 1024 / 1024));
      },
      onAudioProgress: (downloaded, total) => {
        audioBar.setTotal(Math.round(total / 1024 / 1024));
        audioBar.update(Math.round(downloaded / 1024 / 1024));
      }
    });

    multibar.stop();
    console.log(chalk.bold.green(`\n  Done! Saved to: ${result.path}`));
    console.log(chalk.gray(`  File size: ${(result.size / 1024 / 1024).toFixed(1)} MB\n`));
  } catch (error) {
    multibar.stop();
    console.error(chalk.red(`\n  Error: ${error.message}\n`));
    process.exit(1);
  }
}

async function runInteractive() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const ask = (q) => new Promise(resolve => rl.question(q, resolve));

  console.log(chalk.bold.blue('\n  Facebook Video Downloader\n'));
  console.log(chalk.gray('  Paste the video/audio stream URLs from browser DevTools (Network tab)'));
  console.log(chalk.gray('  Tip: Filter by ".mp4" in Network tab, look for fbcdn.net requests\n'));

  const url1 = await ask(chalk.yellow('  Paste first stream URL: '));
  const url2 = await ask(chalk.yellow('  Paste second stream URL: '));

  // Auto-detect
  const type1 = detectStreamType(url1);
  const type2 = detectStreamType(url2);

  let videoUrl, audioUrl;

  if (type1 === 'video' && type2 === 'audio') {
    videoUrl = url1;
    audioUrl = url2;
    console.log(chalk.green('\n  Auto-detected: URL 1 = Video, URL 2 = Audio'));
  } else if (type1 === 'audio' && type2 === 'video') {
    videoUrl = url2;
    audioUrl = url1;
    console.log(chalk.green('\n  Auto-detected: URL 1 = Audio, URL 2 = Video'));
  } else {
    console.log(chalk.gray('\n  Could not auto-detect stream types.'));
    const which = await ask(chalk.yellow('  Is the FIRST URL the video stream? (y/n): '));
    if (which.toLowerCase() === 'y') {
      videoUrl = url1;
      audioUrl = url2;
    } else {
      videoUrl = url2;
      audioUrl = url1;
    }
  }

  const defaultName = `facebook_${Date.now()}.mp4`;
  const outputName = await ask(chalk.yellow(`  Output filename [${defaultName}]: `)) || defaultName;
  rl.close();

  await runCli(videoUrl, audioUrl, outputName);
}

} // end else (not --web mode)
