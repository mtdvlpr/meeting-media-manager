/* eslint-disable playwright/no-conditional-expect */
import { platform } from 'os'
import { existsSync } from 'fs-extra'
import { sync } from 'fast-glob'
import {
  expect,
  test,
  type ElectronApplication,
  type Page,
} from '@playwright/test'
import jimp from 'jimp'
import { join } from 'upath'
import { ipcRendererInvoke } from 'electron-playwright-helpers'
import { version } from '../../package.json'
import { startApp, openHomePage } from './../helpers/electronHelpers'
import { delay, getDate } from './../helpers/generalHelpers'
import prefs from './../mocks/prefs/prefsOld.json'
import locale from './../../src/locales/en.json'

let electronApp: ElectronApplication
let page: Page

test.beforeAll(async () => {
  electronApp = await startApp()
})

test.afterAll(async () => {
  test.setTimeout(0)
  await page.locator('[aria-label="home"]').click()
  await electronApp.close()
})

test('render the presentation mode page correctly', async () => {
  page = await openHomePage(electronApp)

  // Open settings page
  await page.locator('[aria-label="settings"]').click()
  if (platform() === 'darwin') {
    await delay(5 * 100)
  }

  // Check for correct version
  expect((await page.locator('text=M³ v').innerText()).toLowerCase()).toBe(
    `m³ v${version}`,
  )

  // Expand media setup
  await page.locator('button', { hasText: locale.optionsMedia }).click()

  // Turn media presentation mode on
  await page.locator(`text=${locale.enableMediaDisplayButton}`).check()

  // Go back to home page
  await page.locator('[aria-label="home"]').click()

  // Verify home page
  expect(page.locator(`text=${prefs.congregationName}`).innerText).toBeTruthy()

  if (platform() === 'linux') {
    await delay(5 * 100)
    await page.screenshot({ path: 'img/present/launch-present-mode.png' })

    // Click on fetch button
    await page.locator('button', { hasText: locale.fetchMedia }).click()

    // Wait for jw sync to complete successfully
    // eslint-disable-next-line playwright/no-wait-for-selector
    await page.waitForSelector('div.bg-success:has-text("JW.org (English)")', {
      timeout: 0,
    })
  }

  const mediaWin = electronApp
    .windows()
    .find((win) => win.url().split('/').pop() === 'media')
  if (mediaWin) {
    await mediaWin.screenshot({ path: 'img/present/default-bg.png' })
  }

  // Open presentation mode
  await page.locator('[aria-label="present"]').click()

  // If one date or todays date, that one gets opened automatically
  const mediaPath = await ipcRendererInvoke(page, 'downloads')
  if (
    existsSync(join(mediaPath, prefs.lang, getDate())) ||
    sync(join(mediaPath, prefs.lang, '*'), {
      onlyDirectories: true,
      ignore: [join(mediaPath, prefs.lang, 'Recurring')],
    }).filter((p) => {
      return sync(join(p, '*.!(title|vtt|json)')).length > 0
    }).length === 1
  ) {
    // Check if more actions button is present
    await expect(page.locator('[aria-label="More actions"]')).toHaveAttribute(
      'aria-label',
      'More actions',
    )

    if (platform() === 'linux') {
      await delay(10 * 100)
      await page.screenshot({ path: 'img/present/media-list.png' })
    }
  } else if (platform() !== 'win32') {
    // Check for correct heading
    /*await expect(page.locator('.v-toolbar-title__placeholder')).toHaveText(
      locale.selectDate,
    )*/

    if (platform() === 'linux') {
      await page.screenshot({ path: 'img/present/meeting-picker.png' })
    }
    await page.locator('.present-select .v-list-item').nth(0).click()
    await expect(page.locator('[aria-label="More actions"]')).toHaveAttribute(
      'aria-label',
      'More actions',
    )

    if (platform() === 'linux') {
      await delay(10 * 100)
      await page.screenshot({ path: 'img/present/media-list.png' })
    }
  }
})
/*
 test('send IPC message from renderer', async () => {
   // evaluate this script in render process
   // requires webPreferences.nodeIntegration true and contextIsolation false
   await page.evaluate(() => {
     require('electron').ipcRenderer.send('new-window')
   })
   const newPage = await electronApp.waitForEvent('window')
   expect(newPage).toBeTruthy()
   expect(await newPage.title()).toBe('Window 4')
   page = newPage
 }) */

test('receive IPC invoke/handle via renderer', async () => {
  // evaluate this script in RENDERER process and collect the result
  const result = await ipcRendererInvoke(page, 'appVersion')
  expect(result).toBe(version)
})

test('make sure two screenshots of the same page match', async ({ page }) => {
  // take a screenshot of the current page
  const screenshot1: Buffer = await page.screenshot()
  // create a visual hash using Jimp
  const screenshot1hash = (await jimp.read(screenshot1)).hash()
  // take a screenshot of the page
  const screenshot2: Buffer = await page.screenshot()
  // create a visual hash using Jimp
  const screenshot2hash = (await jimp.read(screenshot2)).hash()
  // compare the two hashes
  expect(screenshot1hash).toEqual(screenshot2hash)
})
