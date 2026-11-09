const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const PORT = 3099;
const SNAPSHOT_DIR = path.join(__dirname, '..', 'snapshots');

// Ensure output directories
fs.mkdirSync(path.join(SNAPSHOT_DIR, 'order-placed'), { recursive: true });
fs.mkdirSync(path.join(SNAPSHOT_DIR, 'delivered'), { recursive: true });

function waitForServer(url, timeout = 60000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function ping() {
      const req = http.get(url, (res) => {
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeout) {
          reject(new Error(`Timeout waiting for ${url}`));
        } else {
          setTimeout(ping, 800);
        }
      });
    }
    ping();
  });
}

async function run() {
  console.log(`Starting Next.js dev server on port ${PORT}...`);
  const server = spawn('npx.cmd', ['next', 'dev', '-p', String(PORT), '--hostname', '127.0.0.1', '--webpack'], {
    stdio: 'inherit',
    shell: true,
  });

  try {
    await waitForServer(`http://127.0.0.1:${PORT}`);
    console.log('Next.js dev server responded!');

    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    console.log('Launching browser via Playwright:', edgePath);
    const browser = await chromium.launch({
      executablePath: edgePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      viewport: { width: 440, height: 920 },
      deviceScaleFactor: 2,
    });

    // ──────────────────────────────────────────────────────────
    // 1. CAPTURE ORDER PLACED FRAMES: 0, 400, 800, 1200, 2600 ms
    // ──────────────────────────────────────────────────────────
    console.log('\n--- Capturing Order Placed Celebration Frames ---');
    const placedTimes = [0, 400, 800, 1200, 2600];

    // Pre-warm the preview-sheets route
    const warmPage = await context.newPage();
    console.log('Compiling /preview-sheets route...');
    await warmPage.goto(`http://127.0.0.1:${PORT}/preview-sheets?sheet=placed`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await warmPage.waitForTimeout(2000);
    await warmPage.close();
    console.log('Compilation complete!');

    for (const ms of placedTimes) {
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${PORT}/preview-sheets?sheet=placed`, { waitUntil: 'domcontentloaded' });
      if (ms > 0) {
        await page.waitForTimeout(ms);
      }
      const phone = await page.$('#mobile-phone-stage');
      const target = phone || page;
      const file = path.join(SNAPSHOT_DIR, 'order-placed', `frame_${ms}ms.png`);
      await target.screenshot({ path: file });
      console.log(`✓ Captured Order Placed: ${ms}ms -> ${file}`);
      await page.close();
    }

    // ──────────────────────────────────────────────────────────
    // 2. CAPTURE DELIVERED CELEBRATION FRAMES: 0, 600, 1400, 2400, 3200, 4400 ms
    // ──────────────────────────────────────────────────────────
    console.log('\n--- Capturing Delivered Celebration Frames ---');
    const deliveredTimes = [0, 600, 1400, 2400, 3200, 4400];

    // Pre-warm delivered sheet
    const warmDelivered = await context.newPage();
    await warmDelivered.goto(`http://127.0.0.1:${PORT}/preview-sheets?sheet=delivered`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await warmDelivered.waitForTimeout(1000);
    await warmDelivered.close();

    for (const ms of deliveredTimes) {
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${PORT}/preview-sheets?sheet=delivered`, { waitUntil: 'domcontentloaded' });
      if (ms > 0) {
        await page.waitForTimeout(ms);
      }
      const phone = await page.$('#mobile-phone-stage');
      const target = phone || page;
      const file = path.join(SNAPSHOT_DIR, 'delivered', `frame_${ms}ms.png`);
      await target.screenshot({ path: file });
      console.log(`✓ Captured Delivered Celebration: ${ms}ms -> ${file}`);
      await page.close();
    }

    await browser.close();
    console.log('\nAll requested frames captured successfully in /snapshots directory!');
  } finally {
    console.log('Stopping dev server...');
    server.kill();
    try {
      spawn('taskkill', ['/pid', String(server.pid), '/f', '/t'], { stdio: 'ignore' });
    } catch (e) {}
  }
}

run().catch((err) => {
  console.error('Capture script error:', err);
  process.exit(1);
});
