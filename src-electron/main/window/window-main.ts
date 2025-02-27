import type { BrowserWindow } from 'electron';

import { PLATFORM } from 'app/src-electron/constants';

import { cancelAllDownloads } from './../downloads';
import { throttle } from './../utils';
import { closeOtherWindows, createWindow, sendToWindow } from './window-base';
import { createMediaWindow, moveMediaWindow } from './window-media';

export let mainWindow: BrowserWindow | null = null;
let closeAttempts = 0;
export let authorizedClose = false;

/**
 * Creates the main window
 */
export function createMainWindow() {
  // If the window is already open, just focus it
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    return;
  }

  // Create the browser window
  mainWindow = createWindow('main');

  mainWindow.on(
    'move',
    throttle(() => moveMediaWindow(), 100),
  );

  if (PLATFORM !== 'darwin') mainWindow.on('moved', moveMediaWindow); // On macOS, the 'moved' event is just an alias for 'move'

  mainWindow.on('close', (e) => {
    if (mainWindow && (authorizedClose || closeAttempts > 2)) {
      cancelAllDownloads();
      closeOtherWindows(mainWindow);
    } else {
      e.preventDefault();
      sendToWindow(mainWindow, 'attemptedClose');
      closeAttempts++;
      setTimeout(() => {
        closeAttempts = 0;
      }, 10000);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createMediaWindow();
}

/**
 * Toggles the authorizedClose state
 * @param authorized Whether the window is authorized to close
 */
export function toggleAuthorizedClose(authorized: boolean) {
  authorizedClose = authorized;
}
