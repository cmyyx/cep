export interface GameDataVersion {
  /** Published AKEData version id, e.g. 1.6.4@11944529-13 (legacy builds: SHA prefix). */
  version: string
  /** Publish time reported by the data host; null for legacy snapshots. */
  publishedAt: string | null
}

export interface VersionInfo {
  commit: string
  count: number
  commitTime: string
  buildTime: string
  version: string
  forceUpgradeSerial: number
  /** Baked-in game data version. Display only — never part of the update gate. */
  gameData?: GameDataVersion
}

export interface ChangelogEntry {
  commit: string
  commitTime: string
  message: string
  version?: string
  forceUpdate: boolean
}
