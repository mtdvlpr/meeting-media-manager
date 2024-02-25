import { readFile, readFileSync, stat, writeFile } from 'fs-extra'
import { join, extname } from 'upath'

export async function extractAllTo(zip: string, dest: string, date?: string) {
  try {
    const store = useMediaStore()
    const zipSize = (await stat(zip)).size
    store.setDownloadProgress({
      key: zip,
      downloadProgress: {
        current: 0,
        total: zipSize,
        date,
      },
    })
    const zipFile = await readFile(zip)
    const { default: JSZip } = await import('jszip')
    const zipContents = await JSZip.loadAsync(zipFile)
    const fileBuffer = zipContents.file('contents')?.async('arraybuffer')
    store.setDownloadProgress({
      key: zip,
      downloadProgress: {
        current: zipSize,
        total: zipSize,
        date,
      },
    })
    if (!fileBuffer) throw new Error('Could not extract files from zip')
    const contents = await JSZip.loadAsync(fileBuffer)
    const contentsTotal = Object.keys(contents.files).reduce((acc, key) => {
      // @ts-expect-error
      return acc + contents.files[key]._data.uncompressedSize
    }, 0)
    let current = 0
    store.setDownloadProgress({
      key: dest,
      downloadProgress: {
        current: 0,
        total: contentsTotal,
        date,
      },
    })
    await Promise.allSettled(
      Object.entries(contents.files).map(async ([filename, fileObject]) => {
        await writeFile(
          join(dest, filename),
          await fileObject.async('nodebuffer'),
        )
        // @ts-expect-error: property _data does not exist on type 'JSZipObject'
        current += fileObject._data.uncompressedSize
        store.setDownloadProgress({
          key: dest,
          downloadProgress: {
            current,
            total: contentsTotal,
            date,
          },
        })
      }),
    )
  } catch (e) {
    warn('errorExtractFromJWPUB', { identifier: zip })
  }
}

async function getContents(
  file: string,
  jwpub = true,
): Promise<ArrayBuffer | undefined> {
  const zipFile = readFileSync(file)
  if (!jwpub) return zipFile
  const { default: JSZip } = await import('jszip')
  const zipper = new JSZip()
  const zipContents = await zipper.loadAsync(zipFile)
  return zipContents.file('contents')?.async('arraybuffer')
}

export async function getZipContentsByExt(
  zip: string,
  ext: string,
  jwpub = true,
) {
  try {
    const { default: JSZip } = await import('jszip')
    // const zipFile = await readFile(zip)
    // const zipContents = await JSZip.loadAsync(zipFile)
    // const fileBuffer = zipContents.file('contents')?.async('arraybuffer')
    const fileBuffer = await getContents(zip, jwpub)
    if (!fileBuffer) throw new Error('Could not extract files from zip')
    const contents = await JSZip.loadAsync(fileBuffer)
    for (const [filename, fileObject] of Object.entries(contents.files)) {
      if (extname(filename).toLowerCase() === ext) {
        return fileObject.async('nodebuffer')
      }
    }
  } catch (e) {
    warn('errorExtractFromJWPUB', { identifier: zip })
  }
  return null
}

export async function getZipContentsByName(
  zip: string,
  name: string,
  jwpub = true,
) {
  try {
    const { default: JSZip } = await import('jszip')
    const zipper = new JSZip()
    // const zipFile = await readFile(zip)
    // const zipContents = await zipper.loadAsync(zipFile)
    // const fileBuffer = zipContents.file('contents')?.async('arraybuffer')
    const fileBuffer = await getContents(zip, jwpub)
    if (!fileBuffer) throw new Error('Could not extract files from zip')
    const contents = await zipper.loadAsync(fileBuffer)
    for (const [filename, fileObject] of Object.entries(contents.files)) {
      if (filename === name) {
        return fileObject.async('nodebuffer')
      }
    }
  } catch (e) {
    warn('errorExtractFromJWPUB', { identifier: zip })
  }
  return null
}
