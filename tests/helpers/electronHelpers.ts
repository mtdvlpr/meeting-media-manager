/* eslint-disable no-console */
import { join } from 'upath'
import { writeJson } from 'fs-extra'
import {
  findLatestBuild,
  ipcRendererInvoke,
  parseElectronApp,
} from 'electron-playwright-helpers'
import {
  expect,
  _electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test'
import { sync } from 'fast-glob'
import { name } from '../../package.json'
import { delay } from './generalHelpers'
import prefsNew from './../mocks/prefs/prefsNew.json'

export async function startApp(options: any = {}) {
  // find the latest build in the out directory
  const latestBuild = findLatestBuild('build')
  // parse the directory and find paths and other info
  const appInfo = parseElectronApp(latestBuild)
  // set the CI environment variable to true
  process.env.CI = 'e2e'

  const electronApp = await _electron.launch({
    ...options,
    args: [appInfo.main],
    executablePath: appInfo.executable,
  })

  electronApp.on('window', (page) => {
    const filename = page.url().split('/').pop()
    console.log(`Window opened: ${filename}`)

    // capture errors
    page.on('pageerror', (error) => {
      console.error(error)
    })

    // capture console messages
    page.on('console', (msg) => {
      console.log(msg.text())
    })
  })

  return electronApp
}

async function selectCong(page: Page, congName: string) {
  await page.locator('.cong-select .v-list').waitFor({ state: 'visible' })
  const cong = page.getByText(congName, { exact: true })
  if ((await cong.count()) > 0 && (await cong.isVisible())) {
    // Select congregation from list
    await cong.click()
  } else {
    // Click on first cong in list
    await page.locator(`.cong-select .v-list-item`).first().click()
  }
}

export async function openHomePage(
  app: ElectronApplication,
  prefsObject?: any,
) {
  // Set first browser window as page
  const page = await app.firstWindow()

  // Wait for page to finish loading
  await page.waitForLoadState('domcontentloaded')

  // Set mock preferences
  const congId = 'test'
  const prefs = prefsObject ?? prefsNew

  const appPath = (await ipcRendererInvoke(page, 'userData')) as string
  expect(appPath.endsWith(name)).toBe(true)

  const downloadsPath = (await ipcRendererInvoke(page, 'downloads')) as string
  if (prefs.app) {
    prefs.app.localOutputPath = downloadsPath
  } else {
    prefs.localOutputPath = downloadsPath
  }

  const congName = prefs.app
    ? prefs.app.congregationName
    : prefs.congregationName

  const onCongSelect = (await page.locator('.fa-building-user').count()) > 0

  // Insert mock preferences
  try {
    await writeJson(join(appPath, `prefs-${congId}.json`), prefs)
  } catch (error) {
    log.error(error)
  }
  const nrOfCongs = sync(join(appPath, 'prefs-*.json')).length

  if (onCongSelect && nrOfCongs > 1) {
    await selectCong(page, congName)
  } else if (page.url().includes('settings')) {
    // Open the home page as test congregation
    await page.reload({ waitUntil: 'domcontentloaded' })
    if (
      nrOfCongs > 1 &&
      (await page.locator('.fa-building-user').count()) > 0
    ) {
      await selectCong(page, congName)
    }
  }

  // While still on the settings page, click on the home page button, until the prefs are accepted as valid
  await delay(10 ** 3)
  let url = page.url()

  while (url.includes('settings')) {
    await page.locator('href="#/home"').click()
    await delay(10 ** 3)
    url = page.url()
  }

  // If not on correct cong, switch cong through menu
  if ((await page.locator(`text=${congName}`).count()) !== 1) {
    await page.reload({ waitUntil: 'domcontentloaded' })
    if (nrOfCongs > 1) await selectCong(page, congName)
  }

  // Wait for page to finish loading
  await page.waitForLoadState('domcontentloaded')

  return page
}
