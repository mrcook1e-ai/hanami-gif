import fs from 'fs';
import path from 'path';
import { registerFont, createCanvas, loadImage } from 'canvas';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const ASSETS = path.join(process.cwd(), 'assets');
const FINAL_GIF = 'output.gif';
const TMP = path.join(process.cwd(), '.tmp');

const WIDTH = 960;
const HEIGHT = 540;

const isWin = process.platform === 'win32';
const pkgRoot = path.dirname(require.resolve('gifski/package.json'));
const gifskiBin = isWin 
    ? path.join(pkgRoot, 'bin', 'windows', 'gifski.exe')
    : path.join(pkgRoot, 'bin', 'linux', 'gifski');

const rawArgs = process.argv.slice(2);
let num = '5';
if (rawArgs.length > 0 && !rawArgs[0].startsWith('-')) {
    num = rawArgs[0];
    rawArgs.shift();
}

const gifskiFlags: string[] = rawArgs;

if (!gifskiFlags.some(a => a === '-Q' || a === '--quality')) gifskiFlags.push('--quality', '100');
if (!gifskiFlags.some(a => a === '-r' || a === '--fps')) gifskiFlags.push('--fps', '25');
if (!gifskiFlags.some(a => a === '-W' || a === '--width')) gifskiFlags.push('--width', WIDTH.toString());
if (!gifskiFlags.some(a => a === '-H' || a === '--height')) gifskiFlags.push('--height', HEIGHT.toString());
if (!gifskiFlags.includes('--quiet')) gifskiFlags.push('--quiet');

(async () => {
    const start = Date.now();
    if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP);

    registerFont('TomatoGrotesk-SemiBold.otf', { family: 'TG', weight: '600' });
    const getF = (d: string) => fs.readdirSync(path.join(ASSETS, d)).filter(f => f.endsWith('.png')).sort();
    const [bgs, pgs, fgs] = ['bg', 'pg', 'fg'].map(getF);
    const totalFrames = Math.min(bgs.length, pgs.length, fgs.length);

    console.log(`Render: ${WIDTH}x${HEIGHT} | Num: ${num}`);
    console.log(`Gifski Flags: ${gifskiFlags.join(' ')}`);

    const fileList: string[] = [];
    for (let i = 0; i < totalFrames; i += 10) {
        const end = Math.min(i + 10, totalFrames);
        await Promise.all(Array.from({ length: end - i }, (_, k) => i + k).map(async (idx) => {
            const cvs = createCanvas(WIDTH, HEIGHT), ctx = cvs.getContext('2d');
            const [b, p, f] = await Promise.all([
                loadImage(path.join(ASSETS, 'bg', bgs[idx])),
                loadImage(path.join(ASSETS, 'pg', pgs[idx])),
                loadImage(path.join(ASSETS, 'fg', fgs[idx]))
            ]);
            
            ctx.drawImage(b, 0, 0, WIDTH, HEIGHT);
            ctx.font = '600 71px "TG"';
            ctx.fillStyle = '#1e1e1e';
            ctx.textAlign = 'center';
            ctx.fillText(num, 158.25, 382.5);
            ctx.drawImage(p, 0, 0, WIDTH, HEIGHT);
            ctx.drawImage(f, 0, 0, WIDTH, HEIGHT);
            
            const fpath = path.join(TMP, `f${idx.toString().padStart(4, '0')}.png`);
            fs.writeFileSync(fpath, cvs.toBuffer('image/png'));
            fileList[idx] = fpath;
        }));
        process.stdout.write('.');
    }

    console.log(`\nEncoding with Gifski...`);
    try {
        await execFileAsync(gifskiBin, ['-o', FINAL_GIF, ...gifskiFlags, ...fileList]);
    } catch (e) {
        console.error('Gifski Error:', e);
        process.exit(1);
    }

    fs.rmSync(TMP, { recursive: true, force: true });
    const size = fs.statSync(FINAL_GIF).size;
    const time = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\nDone! Time: ${time}s | Size: ${(size / 1024 / 1024).toFixed(2)} MB`);
})();
