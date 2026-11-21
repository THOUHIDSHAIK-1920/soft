import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const AI_DIR = path.join(ROOT, 'ai-service');
const isWin = process.platform === 'win32';
const venvPy = isWin
  ? path.join(AI_DIR, '.venv', 'Scripts', 'python.exe')
  : path.join(AI_DIR, '.venv', 'bin', 'python');

const pythonBin = fs.existsSync(venvPy) ? venvPy : isWin ? 'python' : 'python3';

const child = spawn(pythonBin, ['main.py'], {
  cwd: AI_DIR,
  env: process.env,
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
