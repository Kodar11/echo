import { ipcMain, WebContents, WebFrameMain } from 'electron';
import { getUIPath } from './pathResolver.js';
import { pathToFileURL } from 'url';

export function isDev(): boolean {
  return process.env.NODE_ENV === 'development';
}

export function ipcMainHandle<Key extends keyof EventPayloadInputMapping>(
  key: Key,
  handler: (
    input: EventPayloadInputMapping[Key]
  ) => Promise<EventPayloadOutputMapping[Key]> | EventPayloadOutputMapping[Key]
) {
  ipcMain.handle(key, (event, input) => {
    validateEventFrame(event.senderFrame);
    return handler(input);
  });
}

export function ipcMainOn<Key extends keyof EventPayloadInputMapping>(
  key: Key,
  handler: (payload: EventPayloadInputMapping[Key]) => void
) {
  ipcMain.on(key, (event, payload) => {
    validateEventFrame(event.senderFrame);
    return handler(payload);
  });
}

export function ipcWebContentsSend<Key extends keyof EventPayloadInputMapping>(
  key: Key,
  webContents: WebContents,
  payload: EventPayloadInputMapping[Key]
) {
  webContents.send(key, payload);
}

export function validateEventFrame(frame: WebFrameMain) {
  if (isDev() && new URL(frame.url).host === 'localhost:5123') {
    return;
  }
  if (frame.url !== pathToFileURL(getUIPath()).toString()) {
    throw new Error('Malicious event');
  }
}
