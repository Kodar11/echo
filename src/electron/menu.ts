import { BrowserWindow, Menu, app } from 'electron';
import { isDev } from './util.js';

export function createMenu(mainWindow: BrowserWindow) {
  if (process.platform !== 'darwin') {
    // On Windows/Linux we use the native OS title bar only. Hide the
    // application menu bar so there is no second "Echo" strip below it.
    Menu.setApplicationMenu(null);
    return;
  }

  // On macOS, keep a minimal app menu so the standard Quit / DevTools
  // accelerators work and the menu bar is not empty.
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: app.getName(),
        submenu: [{ role: 'quit' }],
      },
      {
        label: 'View',
        submenu: [
          {
            label: 'Toggle Developer Tools',
            accelerator: 'Alt+Command+I',
            click: () => mainWindow.webContents.toggleDevTools(),
            visible: isDev(),
          },
        ],
      },
    ])
  );
}
