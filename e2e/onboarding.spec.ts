import { test, expect, _electron, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import os from 'os';

let userDataDir: string;
let electronApp: ElectronApplication | null = null;

async function launch(): Promise<Page> {
  electronApp = await _electron.launch({
    args: ['.', `--user-data-dir=${userDataDir}`],
    env: { NODE_ENV: 'development' },
  });
  const page = await electronApp.firstWindow();
  await page.waitForFunction(() => Boolean((window as Window & { electron?: unknown }).electron));
  return page;
}

async function relaunch(): Promise<Page> {
  await electronApp?.close();
  return launch();
}

/** Makes the native folder picker return `folder` without showing a dialog. */
async function stubFolderPicker(folder: string | null) {
  await electronApp!.evaluate(({ dialog }, picked) => {
    dialog.showOpenDialog = (async () => ({ canceled: picked === null, filePaths: picked ? [picked] : [] })) as typeof dialog.showOpenDialog;
  }, folder);
}

const onboardingNav = (page: Page) => page.getByRole('navigation', { name: 'Onboarding' });
const searchInput = (page: Page) => page.getByRole('combobox', { name: 'Search your files' });

test.beforeEach(() => {
  userDataDir = path.join(os.tmpdir(), `echo-e2e-onb-${Date.now()}-${Math.random().toString(36).slice(2)}`);
});

test.afterEach(async () => {
  await electronApp?.close();
  electronApp = null;
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup failures on Windows locked files.
  }
});

test('first launch shows onboarding and completing it opens search for good', async () => {
  let page = await launch();

  await expect(page.getByRole('heading', { name: 'Search everything you remember.' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Give Echo something to search.' })).toBeVisible();

  // Continuing without a folder is allowed.
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Search naturally. Go deeper when you need to.' })).toBeVisible();

  await onboardingNav(page).getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Give Echo something to search.' })).toBeVisible();
  await page.keyboard.press('ArrowRight');

  await page.getByRole('button', { name: 'Start using Echo' }).click();
  await expect(searchInput(page)).toBeFocused();

  page = await relaunch();
  await expect(searchInput(page)).toBeVisible();
  await expect(onboardingNav(page)).toHaveCount(0);
});

test('skipping onboarding is remembered', async () => {
  let page = await launch();
  await onboardingNav(page).getByRole('button', { name: 'Skip' }).click();
  await expect(searchInput(page)).toBeVisible();

  page = await relaunch();
  await expect(searchInput(page)).toBeVisible();
  await expect(onboardingNav(page)).toHaveCount(0);
});

test('closing the window mid-onboarding shows it again next launch', async () => {
  let page = await launch();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Give Echo something to search.' })).toBeVisible();

  page = await relaunch();
  await expect(page.getByRole('heading', { name: 'Search everything you remember.' })).toBeVisible();
});

test('keyboard: Enter advances, Escape skips', async () => {
  const page = await launch();
  await expect(page.getByRole('heading', { name: 'Search everything you remember.' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Give Echo something to search.' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(searchInput(page)).toBeVisible();
});

test('choosing folders adds them to the library once', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-e2e-onb-lib-'));
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'database architecture notes');

  const page = await launch();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Cancelling the picker keeps the user on the step.
  await stubFolderPicker(null);
  await page.getByRole('button', { name: 'Choose folders' }).click();
  await expect(page.getByRole('heading', { name: 'Give Echo something to search.' })).toBeVisible();

  await stubFolderPicker(dir);
  await page.getByRole('button', { name: 'Choose folders' }).click();
  await expect(page.getByText('1 folder', { exact: true })).toBeVisible();
  await expect(page.getByText(path.basename(dir), { exact: true })).toBeVisible();

  // Picking the same folder again doesn't duplicate it.
  await page.getByRole('button', { name: 'Add another folder' }).click();
  await expect(page.getByText(`${path.basename(dir)} is already in your library.`)).toBeVisible();
  await expect(page.getByText('1 folder', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.electron.getFolders().then((f) => f.length))).toBe(1);

  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Start using Echo' }).click();
  await searchInput(page).fill('architecture');
  await expect(page.getByRole('option').first()).toContainText('notes.txt', { timeout: 15000 });

  await electronApp?.close();
  electronApp = null;
  fs.rmSync(dir, { recursive: true, force: true });
});
