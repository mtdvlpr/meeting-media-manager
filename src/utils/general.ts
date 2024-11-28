/**
 * Converts a camelCase string to kebab-case.
 * @param str The camelCase string to convert.
 * @returns The kebab-case string.
 * @example
 * camelToKebabCase('camelCase') // 'camel-case'
 */
export const camelToKebabCase = (str: string) =>
  str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/**
 * Converts a kebab-case string to camelCase.
 * @param str The kebab-case string to convert.
 * @returns The camelCase string.
 * @example
 * kebabToCamelCase('kebab-case') // 'kebabCase'
 */
export const kebabToCamelCase = (str: string) =>
  str.replace(/-./g, (x) => x[1].toUpperCase());

/**
 * Capitalizes the first letter of a string.
 * @param str The string to capitalize.
 * @returns The capitalized string.
 * @example
 * capitalize('hello') // 'Hello'
 */
export const capitalize = (str: string) =>
  str.charAt(0).toUpperCase() + str.slice(1);

/**
 * Checks if a value is empty.
 * @param val The value to check.
 * @returns Weather the value is empty.
 */
export const isEmpty = (val: unknown) =>
  val === '' || val === null || val === undefined;

/**
 * Parses a version string into an object.
 * @param version The version string to parse.
 * @returns The version object.
 * @example
 * parseVersion('1.2.3') // { major: 1, minor: 2, patch: 3 }
 */
export const parseVersion = (version: string) => {
  const [major, minor, patch] = version.split('.').map((v) => parseInt(v, 10));
  return { major, minor, patch };
};

/**
 * Checks if a version is within bounds.
 * @param version The version to check.
 * @param minVersion The minimum version.
 * @param maxVersion The maximum version.
 * @returns Weather the version is within bounds.
 * @example
 * isVersionWithinBounds('1.2.3', '1.0.0', '2.0.0') // true
 * isVersionWithinBounds('1.2.3', '1.3.0', '2.0.0') // false
 */
export const isVersionWithinBounds = (
  version: string,
  minVersion?: string,
  maxVersion?: string,
) => {
  if (!version || (!minVersion && !maxVersion)) return true;
  const { major, minor, patch } = parseVersion(version);

  if (minVersion) {
    const {
      major: minMajor,
      minor: minMinor,
      patch: minPatch,
    } = parseVersion(minVersion);
    if (major < minMajor) return false;
    if (major === minMajor && minor < minMinor) return false;
    if (major === minMajor && minor === minMinor && patch < minPatch) {
      return false;
    }
  }

  if (maxVersion) {
    const {
      major: maxMajor,
      minor: maxMinor,
      patch: maxPatch,
    } = parseVersion(maxVersion);
    if (major > maxMajor) return false;
    if (major === maxMajor && minor > maxMinor) return false;
    if (major === maxMajor && minor === maxMinor && patch > maxPatch) {
      return false;
    }
  }

  return true;
};

/**
 * Generates a UUID.
 * @returns The generated UUID.
 * @example
 * uuid() // '8e8679e3-02b1-410b-9399-2c1e5606a971'
 */
export const uuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Adds padding to a string or number.
 * @param v The value to pad.
 * @param length The length of the padding.
 * @param char The character to pad with.
 * @returns The padded value.
 */
export const pad = (v: number | string, length = 2, char = '0') =>
  v.toString().padStart(length, char);
