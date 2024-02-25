import { extname, basename, join } from 'upath'

function isOneOf(file: string, exts: string[]) {
  if (!file) return false
  return exts.includes(extname(file).slice(1).toLowerCase())
}

export function isVideo(file: string) {
  return isOneOf(file, [
    'mov',
    'mp4',
    'm4v',
    'mpeg',
    'mpg',
    'ogg',
    'ogv',
    'webm',
  ])
}

export function isImage(file: string) {
  return isOneOf(file, [
    'jpg',
    'png',
    'gif',
    'bmp',
    'jpeg',
    'jfif',
    // 'svg',
    'heic',
    'webp',
  ])
}

export function isAudio(file: string) {
  return isOneOf(file, ['mp3', 'ogg', 'wav'])
}

export function strip(value: string, type = 'id') {
  if (!value) return ''
  switch (type) {
    case 'id':
      return value.replace(
        // eslint-disable-next-line no-control-regex
        /[\s "»“”‘’«(){}№+[\]$<>,/\\:*\x00-\x1F\x80-\x9F\u0000-\u001F]/gu,
        '',
      )
    case 'file':
      return (
        value
          // Common separators
          .replace(/ *[—?;:|.!] */gu, ' - ')
          // Breaking space
          .replace(/\u00A0\t/gu, ' ')
          // Illegal filename characters
          .replace(
            // eslint-disable-next-line no-control-regex
            /['"»“”‘’«(){}№+[\]$<>,/\\:*\x00-\x1F\x80-\x9F\u0000-\u001F]/gu,
            '',
          )
          .trim()
          .replace(/[ -]+$/g, '')
      )
    default:
      throw new Error('Invalid type: ' + type)
  }
}

export function sanitize(name: string, isFile = false, first = true): string {
  const ext = isFile ? extname(name).toLowerCase() : ''

  // Remove special characters from filename
  name = strip(isFile ? basename(name, ext) : name, 'file') + ext
  const mPath = mediaPath()

  if (isFile && mPath) {
    // Cutoff filename if path is longer than 245 characters
    const maxCharactersInPath = 245
    const projectedPathCharLength = join(
      mPath,
      '9999-99-99 - AAAAAAAAAA AAAAAAAAAA',
      name,
    ).length
    if (projectedPathCharLength > maxCharactersInPath) {
      name =
        basename(name, ext)
          .slice(0, -(projectedPathCharLength - maxCharactersInPath))
          .trim() + ext
    }

    // Cutoff filename until path is smaller than 200 bytes
    let currentBytes = Buffer.byteLength(name, 'utf8')
    while (currentBytes > MAX_BYTES_IN_FILENAME) {
      name = basename(name, ext).slice(0, -1).trim() + ext
      currentBytes = Buffer.byteLength(name, 'utf8')
    }
  }

  return first ? sanitize(name, isFile, false) : name
}
