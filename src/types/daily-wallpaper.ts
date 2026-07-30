export interface WeeklyWallpaperItem {
  id: string
  imageUrl: string | null
}

export interface WeeklyWallpaperFeed {
  serverDate: string
  weekStart: string
  displayUntil: string
  isActive: boolean
  weekItems: WeeklyWallpaperItem[]
  actionUrl: string | null
  history: WeeklyWallpaperItem[]
}
