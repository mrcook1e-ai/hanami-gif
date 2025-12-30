import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import ffmpegPath from 'ffmpeg-static';

const execFileAsync = promisify(execFile);
const CWD = process.cwd();
const TMP_DIR = path.join(CWD, '.tmp_avatar');
const SIZE = 1024;

const rawArgs = process.argv.slice(2);
let inputFile = 'Avatar.mov';

// 1. Extract filename if it's the first positional arg
if (rawArgs.length > 0 && !rawArgs[0].startsWith('-')) {
    inputFile = rawArgs[0];
    rawArgs.shift();
}

const inputPath = path.join(CWD, inputFile);
const outputGif = path.join(CWD, path.basename(inputFile, path.extname(inputFile)) + '.gif');
const gifskiFlags: string[] = [...rawArgs];

// Defaults
if (!gifskiFlags.some(a => a === '-r' || a === '--fps')) gifskiFlags.push('--fps', '25');
if (!gifskiFlags.some(a => a === '-Q' || a === '--quality')) gifskiFlags.push('--quality', '90');
if (!gifskiFlags.some(a => a === '-W' || a === '--width')) gifskiFlags.push('--width', SIZE.toString());
if (!gifskiFlags.some(a => a === '-H' || a === '--height')) gifskiFlags.push('--height', SIZE.toString()); // Oops, WIDTH/HEIGHT not defined, use SIZE
if (!gifskiFlags.includes('--quiet')) gifskiFlags.push('--quiet');

// Re-writing the defaults part correctly:
const finalFlags = [...rawArgs];
if (!finalFlags.some(a => a === '-r' || a === '--fps')) finalFlags.push('--fps', '25');
if (!finalFlags.some(a => a === '-Q' || a === '--quality')) finalFlags.push('--quality', '90');
if (!finalFlags.some(a => a === '-W' || a === '--width')) finalFlags.push('--width', SIZE.toString());
if (!finalFlags.some(a => a === '-H' || a === '--height')) finalFlags.push('--height', SIZE.toString());
if (!finalFlags.includes('--quiet')) finalFlags.push('--quiet');

const isWin = process.platform === 'win32';
const pkgRoot = path.dirname(require.resolve('gifski/package.json'));
const gifskiBin = isWin 
    ? path.join(pkgRoot, 'bin', 'windows', 'gifski.exe')
    : path.join(pkgRoot, 'bin', 'linux', 'gifski');

(async () => {
    if (!fs.existsSync(inputPath)) {
        console.error(`Error: File not found: ${inputPath}`);
        process.exit(1);
    }

    const start = Date.now();
    console.log(`Processing Avatar: ${inputFile}`);
    console.log(`Gifski Flags: ${finalFlags.join(' ')}`);

    if (fs.existsSync(TMP_DIR)) fs.rmSync(TMP_DIR, { recursive: true, force: true });
    fs.mkdirSync(TMP_DIR);

    console.log('Extracting frames (FFmpeg)...');
    try {
        if (!ffmpegPath) throw new Error("FFmpeg binary not found");
        await execFileAsync(ffmpegPath, [
            '-i', inputPath,
            '-vf', `fps=25,scale=${SIZE}:${SIZE}:force_original_aspect_ratio=decrease,pad=${SIZE}:${SIZE}:(ow-iw)/2:(oh-ih)/2`,
            path.join(TMP_DIR, 'f%04d.png')
        ]);
    } catch (e) {
        console.error('FFmpeg Error:', e);
        process.exit(1);
    }

    console.log('Encoding HQ GIF (Gifski)...');
    try {
        const frames = fs.readdirSync(TMP_DIR).filter(f => f.endsWith('.png')).map(f => path.join(TMP_DIR, f)).sort();
        await execFileAsync(gifskiBin, ['-o', outputGif, ...finalFlags, ...frames]);
    } catch (e) {
        console.error('Gifski Error:', e);
        process.exit(1);
    }

    fs.rmSync(TMP_DIR, { recursive: true, force: true });
    const size = fs.statSync(outputGif).size;
    const time = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\nDone! Time: ${time}s | Size: ${(size / 1024 / 1024).toFixed(2)} MB`);
})();