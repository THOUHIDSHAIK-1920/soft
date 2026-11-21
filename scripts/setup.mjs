import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const AI_DIR = path.join(ROOT, 'ai-service');
const VENV_DIR = path.join(AI_DIR, '.venv');
const isWin = process.platform === 'win32';
const VENV_PYTHON = isWin
  ? path.join(VENV_DIR, 'Scripts', 'python.exe')
  : path.join(VENV_DIR, 'bin', 'python');

function run(cmd, cwd = ROOT) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

console.log('=== Setting up AI-Powered Movie Ticket Testing Framework ===');

// 1. Create Python virtualenv & install AI microservice dependencies
if (!fs.existsSync(VENV_PYTHON)) {
  const pyCmd = isWin ? 'python' : 'python3';
  run(`${pyCmd} -m venv "${VENV_DIR}"`, AI_DIR);
}
run(`"${VENV_PYTHON}" -m pip install --upgrade pip`, AI_DIR);
run(`"${VENV_PYTHON}" -m pip install -r requirements.txt`, AI_DIR);

// 2. Install Playwright Chromium browser binary
run('npx playwright install chromium', ROOT);

console.log('\n=== Setup Complete! ===');
