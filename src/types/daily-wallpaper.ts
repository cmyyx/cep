export interface DailyWallpaperItem {
  contentDate: string
  isToday: boolean
  imageUrl: string | null
  actionUrl: string | null
}

export interface DailyWallpaperFeed {
  serverDate: string
  current: DailyWallpaperItem | null
  history: DailyWallpaperItem[]
}
