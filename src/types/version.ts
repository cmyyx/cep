export interface VersionInfo {
  commit: string
  count: number
  commitTime: string
  buildTime: string
  version: string
  forceUpgradeSerial: number
}

export interface ChangelogEntry {
  commit: string
  commitTime: string
  message: string
  version?: string
  forceUpdate: boolean
}
