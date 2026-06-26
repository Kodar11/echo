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
  await expect(
    mainPage.locator('input[placeholder="Search your files..."]')
  ).toBeVisible();
});

test('should create a native menu', async () => {
  const menu = await electronApp.evaluate((electron) => {
    return electron.Menu.getApplicationMenu();
  });
  expect(menu).not.toBeNull();
});

test('should navigate through sidebar pages', async () => {
  await mainPage.getByText('Folders', { exact: true }).click();
  await expect(
    mainPage.getByText('Browse for a folder...')
  ).toBeVisible();

  await mainPage.getByText('Statistics', { exact: true }).click();
  await expect(mainPage.getByText('Overview')).toBeVisible();

  await mainPage.getByText('Duplicates', { exact: true }).click();
  await expect(
    mainPage.getByRole('heading', { name: 'No duplicates found' })
  ).toBeVisible({ timeout: 10000 });

  await mainPage.getByText('Health', { exact: true }).click();
  await expect(
    mainPage.getByRole('heading', { name: 'Index Health' })
  ).toBeVisible({ timeout: 10000 });

  await mainPage.getByText('Broken Files', { exact: true }).click();
  await expect(
    mainPage.getByRole('heading', { name: 'Broken Files' })
  ).toBeVisible({ timeout: 10000 });

  await mainPage.getByText('Settings', { exact: true }).click();
  await expect(
    mainPage.getByRole('heading', { name: 'Appearance' })
  ).toBeVisible();
});
