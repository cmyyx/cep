/**
 * postbuild hook: upload production source maps to Sentry so minified
 * client stack traces resolve back to readable source.
 *
 * Runs only when SENTRY_AUTH_TOKEN is present — local/dev builds without a
 * token are skipped silently. Source maps are uploaded (not the original
 * sources themselves); Next.js already emits them into out/_next/static/
 * during `next build`.
 *
 * Release tag MUST match the `release` set in SentryProvider init
 * (versionData.version) so Sentry can correlate events -> source maps.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const OUT_DIR = path.resolve('out')
const STATIC_DIR = path.join(OUT_DIR, '_next', 'static')
const VERSION_DATA_PATH = path.resolve('src', 'generated', 'version-data.ts')

// Sentry org/project slugs — hard-coded (non-secret). The auth token is the
// only secret, passed via SENTRY_AUTH_TOKEN in CI.
const SENTRY_ORG = 'canmoe'
const SENTRY_PROJECT = 'javascript-nextjs'

export function extractRelease(src) {
  const match = src.match(/"version":\s*"([^"]+)"/)
  if (!match) throw new Error('could not extract version from version-data.ts')
  return match[1]
}

function getRelease() {
  if (!existsSync(VERSION_DATA_PATH)) {
    throw new Error('src/generated/version-data.ts not found - run prebuild first')
  }
  return extractRelease(readFileSync(VERSION_DATA_PATH, 'utf-8'))
}

function main() {
  const authToken = process.env.SENTRY_AUTH_TOKEN
  if (!authToken) {
    console.log('[sentry-sourcemaps] SENTRY_AUTH_TOKEN not set — skipping upload.')
    return
  }
  if (!existsSync(STATIC_DIR)) {
    console.warn(`[sentry-sourcemaps] ${STATIC_DIR} not found — nothing to upload.`)
    return
  }

  const release = getRelease()
  const cli = path.resolve('node_modules', '.bin', 'sentry-cli')

  // Create the release (idempotent).
  execFileSync(cli, ['releases', 'new', release, '--org', SENTRY_ORG, '--project', SENTRY_PROJECT], { stdio: 'inherit', env: process.env })

  // Upload source maps under out/_next/static, url-prefixed so Sentry can match
  // them to runtime chunk URLs like /_next/static/chunks/xxx.js.
  execFileSync(
    cli,
    ['sourcemaps', 'upload', '--release', release, '--org', SENTRY_ORG, '--project', SENTRY_PROJECT, '--url-prefix', '~/_next/static', STATIC_DIR],
    { stdio: 'inherit', env: process.env },
  )

  console.log(`[sentry-sourcemaps] uploaded for release ${release}`)
}

const isCli = process.argv[1]
  ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
  : false

if (isCli) main()
