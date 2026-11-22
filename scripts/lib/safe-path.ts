// Guards for upstream data used as file names.
// ================================================================================
// Table and asset ids come from the data host. They are normally plain slugs
// (wpn_funnel_0017, chr_0004_pelica), but a compromised or broken publisher
// could send "../../package" and make the sync write outside its output tree.
// Every id that becomes a path segment goes through this module.

import { isAbsolute, relative, resolve } from 'node:path'

/** Slug-shaped ids only: no separators, no leading dot/dash, no "..". */
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

export function assertSafeFileId(id: string, label = 'id'): string {
  if (!SAFE_ID.test(id) || id.includes('..')) {
    throw new Error(`Refusing unsafe ${label}: "${id}"`)
  }
  return id
}

/** Join under baseDir and reject anything that resolves outside it. */
export function joinWithin(baseDir: string, fileName: string): string {
  const base = resolve(baseDir)
  const target = resolve(base, fileName)
  const relativePath = relative(base, target)
  if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new Error(`Refusing path outside "${baseDir}": "${fileName}"`)
  }
  return target
}
