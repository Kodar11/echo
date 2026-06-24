import { test, expect, _electron } from '@playwright/test';

let electronApp: Awaited<ReturnType<typeof _electron.launch>>;
let mainPage: Awaited<ReturnType<typeof electronApp.firstWindow>>;

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
  electronApp = await _electron.launch({
    args: ['.'],
    env: { NODE_ENV: 'development' },
  });
  mainPage = await electronApp.firstWindow();
  await waitForPreloadScript();
});

test.afterEach(async () => {
  await electronApp.close();
});

test('should show the Echo search page', async () => {
  await expect(mainPage.locator('text=Echo').first()).toBeVisible();
  await expect(
    mainPage.locator('input[placeholder="Search your files..."]')
  ).toBeVisible();
});

test('should create a custom menu', async () => {
  const menu = await electronApp.evaluate((electron) => {
    return electron.Menu.getApplicationMenu();
  });
  expect(menu).not.toBeNull();
  expect(menu!.items.length).toBeGreaterThanOrEqual(1);
  expect(menu!.items[0].label).toBe(process.platform === 'darwin' ? '' : 'Echo');
});

test('should navigate to settings', async () => {
  await mainPage.click('text=Settings');
  await expect(mainPage.locator('text=Indexed Folders')).toBeVisible();
});
