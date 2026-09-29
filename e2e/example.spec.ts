import { test, expect, _electron } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import os from 'os';

let electronApp: Awaited<ReturnType<typeof _electron.launch>>;
let mainPage: Awaited<ReturnType<typeof electronApp.firstWindow>>;
let userDataDir: string;

async function waitForPreloadScript() {
  return new Promise<void>((resolve) => {
    const interval = setInterval(async () => {
      const electronBridge = await mainPage.evaluate(() => {
        return (window as Window & { electron?: unknown }).electron;
      });
      if (electronBridge) {
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });
}

test.beforeEach(async () => {
  userDataDir = path.join(
    os.tmpdir(),
    `echo-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  electronApp = await _electron.launch({
    args: ['.', `--user-data-dir=${userDataDir}`],
    env: { NODE_ENV: 'development' },
  });
  mainPage = await electronApp.firstWindow();
  await waitForPreloadScript();
});

test.afterEach(async () => {
  await electronApp.close();
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup failures on Windows locked files.
  }
});

test('should show the Echo search page', async () => {
  await expect(mainPage.getByRole('combobox', { name: 'Search your files' })).toBeVisible();
  await expect(mainPage.getByRole('heading', { name: 'Echo' })).toBeVisible();
  await expect(mainPage.getByRole('button', { name: 'Add your first folder' })).toBeVisible();
});

test('should create a native menu', async () => {
  const menu = await electronApp.evaluate((electron) => {
    return electron.Menu.getApplicationMenu();
  });
  // Windows/Linux use the custom title bar with no menu strip; macOS keeps an app menu.
  if (process.platform === 'darwin') expect(menu).not.toBeNull();
  else expect(menu).toBeNull();
});

test('should navigate between Search, Library and Settings', async () => {
  const nav = mainPage.getByRole('navigation', { name: 'Main' });

  await nav.getByRole('button', { name: 'Library' }).click();
  await expect(mainPage.getByRole('heading', { name: 'Library', exact: true })).toBeVisible();
  await expect(mainPage.getByRole('heading', { name: 'Your library is empty' })).toBeVisible();

  await nav.getByRole('button', { name: 'Settings' }).click();
  await expect(mainPage.getByRole('heading', { name: 'Appearance', exact: true })).toBeVisible();

  const settingsNav = mainPage.getByRole('tablist', { name: 'Settings' });
  await settingsNav.getByRole('tab', { name: 'Diagnostics' }).click();
  await expect(mainPage.getByRole('heading', { name: 'Files that need attention' })).toBeVisible({ timeout: 10000 });

  await nav.getByRole('button', { name: 'Search' }).click();
  await expect(mainPage.getByRole('combobox', { name: 'Search your files' })).toBeFocused();
});

test('should explain an empty library when searching', async () => {
  await mainPage.getByRole('combobox', { name: 'Search your files' }).fill('anything');
  await expect(mainPage.getByRole('heading', { name: 'Echo has no folders to search yet' })).toBeVisible();
});

test('should report invalid filters inline instead of empty results', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-e2e-lib-'));
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'distributed systems notes');
  await mainPage.evaluate(async (p) => {
    await window.electron.addFolder({ path: p });
  }, dir);
  const input = mainPage.getByRole('combobox', { name: 'Search your files' });
  await input.fill('notes foo:bar');
  await expect(mainPage.getByRole('heading', { name: 'Echo couldn’t understand this search' })).toBeVisible({ timeout: 10000 });
  await expect(mainPage.getByText('Unknown filter "foo"', { exact: false })).toBeVisible();
  fs.rmSync(dir, { recursive: true, force: true });
});
