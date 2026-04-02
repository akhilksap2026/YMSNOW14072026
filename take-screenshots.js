const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE_URL = 'http://localhost:5000';

const MODULES = [
  { id: '01', name: 'dashboard',           label: 'Dashboard',           path: '/' },
  { id: '02', name: 'appointments',        label: 'Appointments',        path: '/appointments' },
  { id: '03', name: 'gate-check-in',       label: 'Gate Check-In',       path: '/gate/check-in' },
  { id: '04', name: 'gate-check-out',      label: 'Gate Check-Out',      path: '/gate/check-out' },
  { id: '05', name: 'yard-inventory',      label: 'Yard Inventory',      path: '/yard/inventory' },
  { id: '06', name: 'yard-map',            label: 'Yard Map',            path: '/yard/map' },
  { id: '07', name: 'dock-management',     label: 'Dock Management',     path: '/dock' },
  { id: '08', name: 'yard-moves',          label: 'Yard Moves',          path: '/moves' },
  { id: '09', name: 'holds-exceptions',    label: 'Holds & Exceptions',  path: '/exceptions' },
  { id: '10', name: 'inspections',         label: 'Inspections',         path: '/inspections' },
  { id: '11', name: 'yard-audit',          label: 'Yard Audit',          path: '/yard/audit' },
  { id: '12', name: 'reports-analytics',   label: 'Reports & Analytics', path: '/reports' },
  { id: '13', name: 'revenue',             label: 'Revenue Intelligence',path: '/revenue' },
  { id: '14', name: 'notifications',       label: 'Notifications',       path: '/notifications' },
  { id: '15', name: 'carrier-management',  label: 'Carrier Management',  path: '/admin/carriers' },
  { id: '16', name: 'yard-setup',          label: 'Yard Setup',          path: '/admin/yard-setup' },
  { id: '17', name: 'users',               label: 'Users',               path: '/admin/users' },
  { id: '18', name: 'audit-log',           label: 'Audit Log',           path: '/admin/audit' },
  { id: '19', name: 'email-intelligence',  label: 'Email Intelligence',  path: '/email-intelligence' },
  { id: '20', name: 'ai-configuration',    label: 'AI Configuration',    path: '/admin/ai-config' },
];

const VIEWS = [
  {
    key: 'laptop',
    label: 'Laptop',
    width: 1440,
    height: 900,
    tablet: false,
    deviceScaleFactor: 1,
  },
  {
    key: 'tablet',
    label: 'Tablet',
    width: 1024,
    height: 768,
    tablet: true,
    deviceScaleFactor: 1,
  },
];

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function setLocalStorage(page, mode, tablet) {
  await page.evaluate((m, t) => {
    localStorage.setItem('ymsnow_product_mode', m);
    localStorage.setItem('ymsnow_tablet_mode', t ? 'true' : 'false');
    localStorage.setItem('ymsnow_tablet_orientation', 'landscape');
  }, mode, tablet);
}

async function waitForLoad(page) {
  await page.waitForFunction(() => {
    const spinners = document.querySelectorAll('[data-loading="true"], .animate-spin');
    return spinners.length === 0;
  }, { timeout: 8000 }).catch(() => {});
  await sleep(800);
}

(async () => {
  // Create output directories
  const outBase = path.join(__dirname, 'screenshots');
  fs.mkdirSync(path.join(outBase, 'laptop'), { recursive: true });
  fs.mkdirSync(path.join(outBase, 'tablet'), { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1440,900',
    ],
  });

  console.log('Browser launched. Taking screenshots...\n');

  for (const view of VIEWS) {
    console.log(`\n═══ ${view.label.toUpperCase()} VIEW (${view.width}×${view.height}) ═══`);

    const page = await browser.newPage();
    await page.setViewport({
      width: view.width,
      height: view.height,
      deviceScaleFactor: view.deviceScaleFactor,
    });

    // First load the app to set localStorage
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    await setLocalStorage(page, 'enhanced', view.tablet);

    for (const mod of MODULES) {
      const url = `${BASE_URL}${mod.path}`;
      const filename = `${mod.id}-${mod.name}.png`;
      const filepath = path.join(outBase, view.key, filename);

      try {
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
        // Re-apply localStorage after navigation (SPA should preserve it, but just in case)
        await setLocalStorage(page, 'enhanced', view.tablet);
        await sleep(600);
        await waitForLoad(page);

        await page.screenshot({ path: filepath, fullPage: false });
        console.log(`  ✓  ${mod.id} ${mod.label} → ${filename}`);
      } catch (err) {
        console.error(`  ✗  ${mod.id} ${mod.label} — ERROR: ${err.message}`);
        // Try to save whatever is on screen
        try {
          await page.screenshot({ path: filepath, fullPage: false });
          console.log(`       (saved partial screenshot)`);
        } catch (_) {}
      }
    }

    await page.close();
  }

  await browser.close();
  console.log('\n✅ All screenshots captured.');

  // Create zip files
  console.log('\nCreating zip files...');
  try {
    execSync(`cd "${outBase}" && zip -r "../YMSNOW-screenshots-laptop.zip" laptop/`, { stdio: 'inherit' });
    execSync(`cd "${outBase}" && zip -r "../YMSNOW-screenshots-tablet.zip" tablet/`, { stdio: 'inherit' });
    execSync(`cd "${outBase}" && zip -r "../YMSNOW-screenshots-all.zip" laptop/ tablet/`, { stdio: 'inherit' });
    console.log('✅ Zip files created:');
    console.log('   YMSNOW-screenshots-laptop.zip');
    console.log('   YMSNOW-screenshots-tablet.zip');
    console.log('   YMSNOW-screenshots-all.zip');
  } catch (err) {
    console.error('Zip error:', err.message);
  }
})();
