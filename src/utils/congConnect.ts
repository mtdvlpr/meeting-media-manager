import { join, dirname, basename, resolve } from 'upath'
import type { WebDAVClient, FileStat } from 'webdav/web/types'
import type { CongPrefs, DateFormat } from '~~/types'

export async function connect(
  host: string,
  username: string,
  password: string,
  dir = '/',
) {
  if (getPrefs<boolean>('app.offline')) return 'offline'
  const store = useCongStore()
  try {
    const { createClient } = await import('webdav/web')
    const client = createClient('https://' + host, {
      username,
      password,
    })

    const contents = await getCongDirectory(
      client,
      host,
      username,
      password,
      dir,
    )

    // Clean up old dates
    const promises: Promise<void>[] = []
    contents
      .filter(({ type }) => type === 'directory')
      .forEach((dir) => {
        promises.push(removeOldDate(client, dir))
      })

    const bg = contents.find(({ basename }) =>
      basename.startsWith(
        `custom-background-image-${getPrefs<string>('app.congregationName')}`,
      ),
    )

    // If bg on cong server, force it to be used
    if (bg) {
      rm(
        findAll(
          join(
            appPath(),
            `custom-background-image-${getPrefs<string>(
              'app.congregationName',
            )}*`,
          ),
        ),
      )
      write(
        join(appPath(), bg.basename),
        Buffer.from(
          new Uint8Array(
            (await client.getFileContents(bg.filename)) as ArrayBuffer,
          ),
        ),
      )
    }

    await Promise.allSettled(promises)

    store.contents = contents
    store.client = client

    if (UNSUPPORTED.find((h) => host.includes(h))) {
      warn(`errorWebdavNotSupported`, { identifier: host })
    }

    return 'success'
  } catch (e: any) {
    store.$reset()
    log.debug('error:', e.message)

    // Return error message
    if (
      e.message === 'Network Error' ||
      e.message.includes('501') // Not Implemented
    ) {
      return 'host'
    } else if (
      e.message.includes('401') // Unauthorized
    ) {
      return 'credentials'
    } else if (
      e.message.includes('403') || // Forbidden
      e.message.includes('404') || // Not Found
      e.message.includes('405') // Method not Allowed
    ) {
      return 'dir'
    } else if (e.message.includes('429')) {
      warn('errorWebdavTooManyRequests')
      return null
    } else {
      const match = HOSTS.find((h) => h.server === host)
      if (match && !dir.startsWith(match.dir)) {
        return 'dir'
      } else {
        error('errorWebdavLs', e, dir)
        return null
      }
    }
  }
}

// Update the local contents of the cong server
export async function updateContent() {
  const store = useCongStore()
  if (!store.client) return

  const { server, username, password, dir } = getPrefs<CongPrefs>('cong')
  let contents: FileStat[] = []
  if (server && username && password && dir) {
    contents = await getCongDirectory(
      store.client,
      server,
      username,
      password,
      dir,
    )
  }
  store.contents = contents
}

export async function createCongDir(dir: string) {
  const store = useCongStore()
  const contents = store.contents
  if (!contents.find(({ filename }) => filename === dir)) {
    const client = store.client
    if (!client) return
    try {
      await client.createDirectory(dir)
    } catch (e: any) {
      if (await client.exists(dir)) {
        log.debug('Directory already exists')
      } else if (e.message.includes(LOCKED.toString())) {
        warn('errorWebdavLocked', { identifier: dir })
      } else {
        throw e
      }
    }
  }
}

// Update the contents tree of the cong server
export function updateContentsTree() {
  const store = useCongStore()
  const tree: typeof store.contentsTree = []
  let root = getPrefs<string>('cong.dir')
  if (!root) return []
  if (root.length > 1 && root.endsWith('/')) root = root.slice(0, -1)
  const contents = cloneDeep(store.contents)

  // Get directories
  const dirs = [...contents.filter(({ type }) => type === 'directory')].sort(
    (a, b) => a.basename.localeCompare(b.basename),
  )

  // Get files
  const files = [...contents.filter(({ type }) => type === 'file')].sort(
    (a, b) => a.basename.localeCompare(b.basename),
  )
  // Add each file to its directory
  files.forEach((file) => {
    const fileDir = dirname(file.filename)
    if (fileDir === root) {
      tree.push(file)
    } else {
      const dir = dirs.find(({ filename }) => filename === fileDir)
      if (dir) {
        if (!dir.children) {
          dir.children = []
        }
        dir.children.push(file)
      }
    }
  })

  // Add subdirectories to their parent
  dirs.forEach((dir) => {
    const dirName = dirname(dir.filename)
    if (dirName !== root) {
      const parent = dirs.find(({ filename }) => filename === dirName)
      if (parent) {
        if (!parent.children) {
          parent.children = []
        }
        parent.children.push(dir)
      }
    }
  })

  // Add root directories to root
  dirs
    .filter(({ filename }) => dirname(filename) === root)
    .forEach((dir) => {
      tree.push(dir)
    })
  store.contentsTree = tree
  return tree
}

// Get the immediate contents of a directory
async function getFolderContent(
  host: string,
  username: string,
  password: string,
  dir = '/',
) {
  const result = await $fetch<string>(`https://${host}${dir}`, {
    // @ts-expect-error: PROPFIND is not a valid method
    method: 'PROPFIND',
    responseType: 'text',
    headers: {
      Accept: 'text/plain',
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString(
        'base64',
      )}`,
      Depth: '1',
    },
  })

  const { XMLParser } = await import('fast-xml-parser')
  const parsed = new XMLParser({ removeNSPrefix: true }).parse(result)
  if (Array.isArray(parsed?.multistatus?.response)) {
    const items: FileStat[] = parsed.multistatus.response
      .filter((item: any) => {
        return resolve(decodeURIComponent(item.href)) !== resolve(dir)
      })
      .map((item: any) => {
        const href = decodeURIComponent(item.href)
        return {
          filename: href.endsWith('/') ? href.slice(0, -1) : href,
          basename: basename(href),
          lastmod: item.propstat.prop.getlastmodified,
          type:
            typeof item.propstat.prop.resourcetype === 'object' &&
            'collection' in item.propstat.prop.resourcetype
              ? 'directory'
              : 'file',
          size: item.propstat.prop.getcontentlength ?? 0,
        }
      })
    return items
  } else if (parsed?.multistatus?.response.propstat?.status?.includes('200')) {
    return []
  } else {
    log.debug('result', result)
    log.debug('parsed:', JSON.stringify(parsed))
    throw new TypeError('Invalid response')
  }
}

// Fallback to get the entire directory contents of the cong server
async function getCongDirectory(
  client: WebDAVClient,
  host: string,
  username: string,
  password: string,
  dir = '/',
) {
  const brokenServers = ['4shared', 'cloudwise']
  if (!brokenServers.some((s) => host.includes(s))) {
    return (await client.getDirectoryContents(dir, {
      deep: true,
    })) as FileStat[]
  } else {
    let contents: FileStat[] = []

    // Get root content
    const rootFiles = await getFolderContent(host, username, password, dir)
    contents = contents.concat(rootFiles)

    // Get date folders
    let dateFolders: FileStat[] = []
    const datePromises: Promise<FileStat[]>[] = []
    rootFiles
      .filter(({ type }) => type === 'directory')
      .forEach((dir) => {
        datePromises.push(
          getFolderContent(host, username, password, dir.filename),
        )
      })

    const dateFolderResult = await Promise.allSettled(datePromises)
    dateFolderResult.forEach((dateDirs) => {
      if (dateDirs.status === 'fulfilled') {
        dateFolders = dateFolders.concat(dateDirs.value)
      }
    })

    // Get media files
    let mediaFiles: FileStat[] = []
    const mediaPromises: Promise<FileStat[]>[] = []
    dateFolders
      .filter(({ type }) => type === 'directory')
      .forEach((dir) => {
        mediaPromises.push(
          getFolderContent(host, username, password, dir.filename),
        )
      })

    const mediaFolderResult = await Promise.allSettled(mediaPromises)
    mediaFolderResult.forEach((media) => {
      if (media.status === 'fulfilled') {
        mediaFiles = mediaFiles.concat(media.value)
      }
    })

    // Return all files and directories
    return contents.concat(dateFolders, mediaFiles)
  }
}

// Remove old date folders that are not used any more
async function removeOldDate(
  client: WebDAVClient,
  dir: FileStat,
): Promise<void> {
  const dayjs = useDayjs()
  const date = dayjs(
    dir.basename,
    getPrefs<DateFormat>('app.outputFolderDateFormat'),
  )
  if (date.isValid() && date.isBefore(dayjs().subtract(1, 'day'))) {
    try {
      await client.deleteFile(dir.filename)
    } catch (e: any) {
      if (e.message.includes(LOCKED.toString())) {
        warn('errorWebdavLocked', { identifier: dir.filename })
      } else if (e.status !== NOT_FOUND) {
        error('errorWebdavRm', e, dir.filename)
      }
    }
  }
}
