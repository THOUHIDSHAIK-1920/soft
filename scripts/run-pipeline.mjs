import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SUT_PORT = process.env.SUT_PORT || '3100';
const AI_PORT = process.env.AI_PORT || '8100';
const SUT_URL = `http://127.0.0.1:${SUT_PORT}`;
const AI_URL = `http://127.0.0.1:${AI_PORT}`;
const isWin = process.platform === 'win32';

const children = [];

function startBg(command, args, cwd, env, label) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => process.stdout.write(`[${label}] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[${label}] ${d}`));
  children.push(child);
  return child;
}

async function postJson(url, body = undefined) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          Connection: 'close',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
      return res;
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}

async function waitForHealth(url, label, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        console.log(`[Pipeline] ${label} is ready (${url})`);
        return;
      }
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timed out waiting for ${label} at ${url}`);
}

function runCmd(cmd, env = {}, allowFail = false) {
  console.log(`\n[Pipeline] $ ${cmd}`);
  try {
    execSync(cmd, {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });
    return 0;
  } catch (err) {
    if (allowFail) {
      return err.status || 1;
    }
    throw err;
  }
}

function cleanup() {
  for (const child of children) {
    try {
      if (isWin && child.pid) {
        execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' });
      } else {
        child.kill('SIGTERM');
      }
    } catch {
      // ignore already exited
    }
  }
}

async function main() {
  try {
    console.log('====================================================================');
    console.log(' AI-Powered Intelligent Movie Ticket Booking Test Framework Pipeline');
    console.log('====================================================================');

    // Clear previous run history & baseline snapshots so pipeline starts clean
    const historyFile = path.join(ROOT, 'reports', 'history.json');
    const snapshotsFile = path.join(ROOT, 'reports', 'dom-snapshots.json');
    if (fs.existsSync(historyFile)) fs.unlinkSync(historyFile);
    if (fs.existsSync(snapshotsFile)) fs.unlinkSync(snapshotsFile);

    // 1. Start AI Microservice (FastAPI + scikit-learn)
    const venvPy = isWin
      ? path.join(ROOT, 'ai-service', '.venv', 'Scripts', 'python.exe')
      : path.join(ROOT, 'ai-service', '.venv', 'bin', 'python');
    const pythonBin = fs.existsSync(venvPy) ? venvPy : isWin ? 'python' : 'python3';
    startBg(pythonBin, ['-u', 'main.py'], path.join(ROOT, 'ai-service'), { AI_PORT, PYTHONUNBUFFERED: '1' }, 'AI');

    // 2. Start SUT (Express + SQLite)
    startBg(process.execPath, [path.join(ROOT, 'sut', 'server.js')], ROOT, { SUT_PORT }, 'SUT');

    await Promise.all([
      waitForHealth(`${AI_URL}/health`, 'FastAPI AI Service'),
      waitForHealth(`${SUT_URL}/api/health`, 'CineBook Pro SUT'),
    ]);

    // 3. MODULE 1: Generate test cases, Playwright scripts, validation & coverage
    console.log('\n--- STEP 1: Module 1 (Test Case Design, Script Generation & Coverage) ---');
    runCmd('npm run generate', { SUT_URL, AI_SERVICE_URL: AI_URL });

    // 4. RUN 1: Normal Mode (Clean SUT) — Establishes DOM snapshots & visual baseline
    console.log('\n--- STEP 2: Run 1 — Normal Mode (Clean SUT, Baseline DOM Snapshots & Visuals) ---');
    await postJson(`${SUT_URL}/api/reset`);
    await postJson(`${SUT_URL}/api/config`, { locatorChange: false, bugInjection: false });

    const snapshotDir = path.join(ROOT, 'tests', 'manual', 'seat-map-visual.manual.spec.ts-snapshots');
    const hasVisualBaseline = fs.existsSync(snapshotDir) && fs.readdirSync(snapshotDir).length > 0;
    const updateSnapFlag = hasVisualBaseline ? '' : ' --update-snapshots';

    runCmd(`npx playwright test${updateSnapFlag}`, {
      SUT_URL,
      AI_SERVICE_URL: AI_URL,
      LOCATOR_CHANGE: 'false',
      BUG_INJECTION: 'false',
      RUN_MODE: 'normal',
      PW_RETRIES: '0',
    });

    // Record normal baseline run in history & reports
    runCmd('npm run report', {
      SUT_URL,
      AI_SERVICE_URL: AI_URL,
      LOCATOR_CHANGE: 'false',
      BUG_INJECTION: 'false',
      RUN_MODE: 'normal',
    });

    // 5. RUN 2: Locator-Change + Bug-Injection Mode (Self-Healing + 8-Bug Detection)
    console.log('\n--- STEP 3: Run 2 — Locator-Change + Bug-Injection Mode (Self-Healing + 8 Bugs) ---');
    await postJson(`${SUT_URL}/api/reset`);
    await postJson(`${SUT_URL}/api/config`, { locatorChange: true, bugInjection: true });

    // Non-zero exit is expected here because the 8 injected bugs deliberately trigger assertion failures
    const bugRunCode = runCmd(
      'npx playwright test',
      {
        SUT_URL,
        AI_SERVICE_URL: AI_URL,
        LOCATOR_CHANGE: 'true',
        BUG_INJECTION: 'true',
        RUN_MODE: 'locator-change+bugs',
        PW_RETRIES: '0',
      },
      true
    );
    console.log(`[Pipeline] Run 2 finished with exit code ${bugRunCode} (expected non-zero due to 8 injected defects).`);

    // 6. MODULE 3: Final RCA, Bug Prediction, Metrics & HTML Dashboard
    console.log('\n--- STEP 4: Module 3 (RCA, RandomForest Bug Prediction, Metrics & Dashboard) ---');
    runCmd('npm run report', {
      SUT_URL,
      AI_SERVICE_URL: AI_URL,
      LOCATOR_CHANGE: 'true',
      BUG_INJECTION: 'true',
      RUN_MODE: 'locator-change+bugs',
    });

    console.log('=== Full Pipeline Completed Successfully! ===');
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error('[Pipeline] Fatal error:', err);
  cleanup();
  process.exit(1);
});
